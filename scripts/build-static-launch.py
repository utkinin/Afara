"""Build a public, serverless AFARA from a pinned anonymous CMS snapshot.

Only public pages, assets and licenses are copied. The source snapshot and CMS
are read-only. This is not Next's output:export and never starts a server.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import quote
from xml.etree import ElementTree

from lxml import etree, html

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'content/static-launch.json').read_text())
ORIGIN = CONFIG['origin']
TELEGRAM = CONFIG['telegram']


def element(tag, text=None, **attributes):
    result = html.Element(tag, **attributes)
    result.text = text
    return result


def contact(draft=None):
    return TELEGRAM + ('?text=' + quote(draft, safe='') if draft else '')


def replace_text(node, text):
    for child in list(node):
        node.remove(child)
    node.text = text


def build(source, destination):
    if source == destination or source in destination.parents or destination in source.parents:
        raise ValueError('Use separate, non-nested input and output directories')
    if destination.exists() and any(destination.iterdir()):
        raise ValueError('Output must be a new empty directory')
    release = json.loads((source / 'deployment.json').read_text())
    if release.get('release') != 'afara-hosting-20261021':
        raise ValueError('Review and pin the expected snapshot before changing its release')
    destination.mkdir(parents=True, exist_ok=True)
    for folder in ['assets', 'licenses']:
        for file in (source / folder).rglob('*'):
            if file.is_file():
                out = destination / file.relative_to(source)
                out.parent.mkdir(parents=True, exist_ok=True)
                if file.suffix in ['.css', '.js']:
                    out.write_text(file.read_text().replace('/Afara/', '/'))
                else:
                    out.write_bytes(file.read_bytes())
    for name in ['material-study-preview.js', 'material-study-controls.js']:
        (destination / name).write_text((source / name).read_text().replace('/Afara/', '/'))
    for name in ['static-launch.js', 'static-launch.css']:
        (destination / name).write_bytes((ROOT / 'scripts' / name).read_bytes())
    qr = subprocess.check_output([
        'node', '--input-type=module', '-e',
        'import QRCode from "qrcode"; process.stdout.write(await QRCode.toDataURL(process.argv[1], {width:240,margin:4}));',
        ORIGIN + CONFIG['contactsPath'],
    ], cwd=ROOT, text=True)
    pages, hashes = [], set()
    for file in sorted(source.rglob('index.html')):
        relative = file.relative_to(source)
        if relative.as_posix() == 'partnyoram/index.html':
            continue
        route = '/' + str(relative.parent).strip('.')
        route = route.rstrip('/') + '/' if route != '/' else '/'
        url = ORIGIN + route
        document = html.document_fromstring(file.read_text().replace('/Afara/', '/'))
        head = document.find('head')
        title = head.find('title')
        title.text = (title.text or '').removeprefix('Предпросмотр · ')
        for node in head.xpath('link[@rel="canonical"] | meta[@name="robots"] | meta[starts-with(@property,"og:")] | script[@type="application/ld+json"]'):
            node.getparent().remove(node)
        head.append(element('link', rel='canonical', href=url))
        head.append(element('meta', name='robots', content='index,follow'))
        description = head.xpath('meta[@name="description"]')[0].get('content', '')
        for key, value in [('og:type', 'website'), ('og:site_name', 'AFARA'), ('og:title', title.text), ('og:description', description), ('og:url', url)]:
            head.append(element('meta', property=key, content=value))
        main_image = document.xpath('//main//img[not(starts-with(@src,"data:"))]')
        if main_image:
            head.append(element('meta', property='og:image', content=ORIGIN + main_image[0].get('src')))
        for script in head.xpath('script[contains(@src,"preview-controls.js")]'):
            script.set('src', '/static-launch.js')
        head.append(element('link', rel='stylesheet', href='/static-launch.css'))
        for footer_note in document.xpath('//footer/p[starts-with(normalize-space(.),"Статический предпросмотр AFARA")]'):
            footer_note.getparent().remove(footer_note)
        for anchor in document.xpath('//a[@href="#consultation"]'):
            # The fabric selector keeps its local event and contact-section anchor.
            if anchor.get('data-ms-transfer') is not None:
                continue
            brief = anchor.get('data-inquiry-brief')
            anchor.set('href', contact(brief + '\n\nСтраница AFARA: ' + url) if brief else TELEGRAM)
            anchor.set('rel', 'noopener noreferrer')
            anchor.set('data-contact-event', 'telegram_open')
            if not brief:
                replace_text(anchor, 'Написать в Telegram')
            anchor.attrib.pop('data-inquiry-brief', None)
        for address in document.xpath('//address'):
            link = element('a', '@Ilya_Utkin · Telegram', href=TELEGRAM, rel='noopener noreferrer')
            link.set('class', 'afara-telegram-contact')
            address.append(link)
        for paragraph in document.xpath('//*[@data-customer-tasks]//p[contains(.,"Задача перейдёт в форму")]'):
            paragraph.text = 'Выберите то, что важно сейчас. Кнопка откроет Telegram с темой обращения. Вы сможете дополнить сообщение и отправить его сами.'
        consultation = document.get_element_by_id('consultation', None)
        if consultation is None:
            raise ValueError('Contact section missing: ' + route)
        form = consultation.find('.//form')
        if form is None:
            raise ValueError('Expected read-only preview form: ' + route)
        button_class = form.xpath('.//button[@type="submit"]')[0].get('class')
        card = element('div', **{'class': 'afara-contact-card'})
        card.append(element('h3', 'Начнём с переписки'))
        card.append(element('p', 'Напишите, где находится объект и какую задачу нужно решить. При желании приложите фотографии окна, эскиз или план.'))
        brief = element('p', **{'class': 'afara-brief', 'role': 'status', 'data-contact-brief': ''})
        card.append(brief)
        card.append(element('a', 'Написать в Telegram', href=TELEGRAM, rel='noopener noreferrer', **{'class': button_class, 'data-contact-primary': '', 'data-contact-base': TELEGRAM, 'data-contact-event': 'telegram_open'}))
        card.append(element('p', 'Откроется переписка с @Ilya_Utkin. Сообщение отправляете вы.', **{'class': 'afara-contact-note'}))
        form.getparent().replace(form, card)
        for image in document.xpath('//img[contains(@alt,"QR-код")]'):
            image.set('src', qr)
            image.getparent().set('href', ORIGIN + CONFIG['contactsPath'])
        graph = [
            {'@type': 'Organization', '@id': ORIGIN + '/#organization', 'name': 'AFARA', 'url': ORIGIN + '/', 'sameAs': [TELEGRAM]},
            {'@type': 'WebPage', '@id': url + '#webpage', 'url': url, 'name': title.text, 'description': description, 'inLanguage': 'ru', 'isPartOf': {'@id': ORIGIN + '/#website'}},
            {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/', 'name': 'AFARA', 'publisher': {'@id': ORIGIN + '/#organization'}},
        ]
        data = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
        head.append(element('script', data, type='application/ld+json'))
        digest = "'sha256-" + base64.b64encode(hashlib.sha256(data.encode()).digest()).decode() + "'"
        hashes.add(digest)
        csp = head.xpath('meta[@http-equiv="Content-Security-Policy"]')[0]
        csp.set('content', csp.get('content').replace("script-src 'self'", "script-src 'self' " + digest))
        out = destination / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(html.tostring(document, encoding='utf-8', doctype='<!DOCTYPE html>', method='html'))
        pages.append(url)
    sitemap = ElementTree.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for url in pages:
        ElementTree.SubElement(ElementTree.SubElement(sitemap, 'url'), 'loc').text = url
    ElementTree.ElementTree(sitemap).write(destination / 'sitemap.xml', encoding='utf-8', xml_declaration=True)
    (destination / 'robots.txt').write_text('User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ' + ORIGIN + '/sitemap.xml\n')
    (destination / '_redirects').write_text('https://www.afara.ru/* https://afara.ru/:splat 301!\n/partnyoram/ /partneram/ 301\n/Afara/* /:splat 301\n')
    policy = "default-src 'none'; script-src 'self' " + ' '.join(sorted(hashes)) + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    (destination / '_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: ' + policy + '\n')
    (destination / 'netlify.toml').write_text('[build]\n  publish = "."\n\n[build.processing]\n  skip_processing = true\n')
    (destination / '404.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Страница не найдена — AFARA</title><h1>Страница не найдена</h1><p><a href="/">Вернуться на главную AFARA</a></p><p><a href="' + TELEGRAM + '">Написать в Telegram</a></p></html>')
    manifest = {'origin': ORIGIN, 'telegram': TELEGRAM, 'sourceSnapshot': CONFIG['snapshotCommit'], 'pages': pages, 'mode': 'static-telegram', 'forms': False, 'analytics': False, 'cms': False}
    (destination / 'release.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'pages': len(pages), 'output': str(destination), 'bytes': sum(f.stat().st_size for f in destination.rglob('*') if f.is_file())}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    build(args.input.resolve(), args.output.resolve())
