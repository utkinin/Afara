import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import unittest
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

from lxml import html

ROOT = Path(os.environ['AFARA_STATIC_ROOT']).resolve()
MANIFEST = json.loads((ROOT / 'release.json').read_text())


class StaticLaunch(unittest.TestCase):
    def test_public_pages_have_live_contacts_and_no_demo_form(self):
        self.assertEqual(len(MANIFEST['pages']), 21)
        for url in MANIFEST['pages']:
            path = urlsplit(url).path
            document = html.fromstring((ROOT / path.lstrip('/') / 'index.html').read_text())
            with self.subTest(path=path):
                self.assertEqual(len(document.xpath('//h1')), 1)
                self.assertFalse(document.xpath('//form'))
                self.assertEqual(document.xpath('//link[@rel="canonical"]/@href'), [url])
                self.assertEqual(document.xpath('//meta[@name="robots"]/@content'), ['index,follow'])
                self.assertFalse(document.xpath('//script[contains(@src,"preview-controls")]'))
                self.assertTrue(document.xpath('//a[@href="https://t.me/Ilya_Utkin"]'))
                self.assertFalse('Статический предпросмотр' in document.text_content())
                ids = document.xpath('//@id')
                self.assertEqual(len(ids), len(set(ids)))
                for anchor in document.xpath('//a[@data-contact-event]'):
                    self.assertTrue(anchor.get('href').startswith('https://t.me/Ilya_Utkin'))
                for data in document.xpath('//script[@type="application/ld+json"]/text()'):
                    graph = json.loads(data)['@graph']
                    self.assertEqual(graph[0]['sameAs'], ['https://t.me/Ilya_Utkin'])
                    digest = "'sha256-" + base64.b64encode(hashlib.sha256(data.encode()).digest()).decode() + "'"
                    self.assertIn(digest, document.xpath('//meta[@http-equiv="Content-Security-Policy"]/@content')[0])

    def test_local_resources_and_navigation_resolve(self):
        for page in ROOT.rglob('*.html'):
            document = html.fromstring(page.read_text())
            values = document.xpath('//@src | //@href')
            for srcset in document.xpath('//@srcset'):
                values += [part.strip().split()[0] for part in srcset.split(',')]
            for value in values:
                if value.startswith(('data:', '#', 'mailto:', 'tel:')):
                    continue
                url = urlsplit(value)
                if url.netloc and url.netloc != 'afara.ru':
                    continue
                path = unquote(url.path)
                if path.startswith('/'):
                    target = ROOT / path.lstrip('/')
                else:
                    target = page.parent / path
                if path.endswith('/'):
                    target = target / 'index.html'
                with self.subTest(page=str(page.relative_to(ROOT)), value=value):
                    self.assertTrue(target.is_file(), str(target))
                    self.assertNotIn('/Afara/', value)
            for value in document.xpath('//a[starts-with(@href,"#")]/@href'):
                self.assertTrue(document.xpath('//*[@id=$anchor]', anchor=value[1:]))
        for file in ROOT.rglob('*.css'):
            for raw in re.findall(r'url\([\s\'"]*([^\'"\s)]+)', file.read_text()):
                if raw.startswith('data:'):
                    continue
                target = ROOT / urlsplit(raw).path.lstrip('/') if raw.startswith('/') else file.parent / urlsplit(raw).path
                self.assertTrue(target.is_file(), str(target))

    def test_sitemap_and_serverless_scope(self):
        locs = [node.text for node in ElementTree.parse(ROOT / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(locs, MANIFEST['pages'])
        self.assertFalse((ROOT / 'admin').exists())
        self.assertFalse((ROOT / 'api').exists())
        self.assertFalse((ROOT / 'downloads').exists())
        self.assertFalse((ROOT / 'package.json').exists())
        self.assertFalse((ROOT / 'node_modules').exists())
        for file in ROOT.rglob('*'):
            self.assertFalse(file.name.startswith('.env'))
        controls = (ROOT / 'static-launch.js').read_text()
        for forbidden in ['fetch(', 'sendBeacon', 'localStorage', 'document.cookie', 'sessionStorage']:
            self.assertNotIn(forbidden, controls)
        self.assertFalse(MANIFEST['analytics'])
        self.assertIn('/partnyoram/ /partneram/ 301', (ROOT / '_redirects').read_text())
        self.assertIn('connect-src \'none\'', (ROOT / '_headers').read_text())

    def test_qr_opens_the_new_domain(self):
        program = '''import fs from 'node:fs'; import sharp from 'sharp'; import jsQR from 'jsqr';
const html = fs.readFileSync(process.argv[1], 'utf8');
const png = html.match(/src="data:image\\/png;base64,([^\"]+)/)[1];
const {data,info} = await sharp(Buffer.from(png,'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
console.log(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data);'''
        decoded = subprocess.check_output(['node', '--input-type=module', '-e', program, str(ROOT / 'kontakty/index.html')], text=True).strip()
        self.assertEqual(decoded, 'https://afara.ru/kontakty/')


if __name__ == '__main__':
    unittest.main()
