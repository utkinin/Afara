import type { Page, Media } from '../payload-types'
import { MaterialStudyEnhancer } from './MaterialStudyEnhancer'
import { pleatPath } from '../lib/material-study-controls'

type Section = NonNullable<Page['sections']>[number]
function picture(value: unknown): Media | null { return value && typeof value === 'object' && 'url' in value && value.url ? value as Media : null }
function pictureAttributes(image: Media, alt?: string | null) {
  const sizes = [image.sizes?.thumb, image.sizes?.tablet, image.sizes?.wide, { url: image.url, width: image.width }].filter(s => s?.url && s.width)
  const srcSet = [...new Map(sizes.map(s => [s!.width!, s!.url!])).entries()].sort(([a], [b]) => a - b).map(([w, url]) => `${url} ${w}w`).join(', ')
  return { src: image.sizes?.tablet?.url || image.url!, srcSet, sizes: '(max-width: 767px) calc(100vw - 40px), 52vw', width: image.width || 1536, height: image.height || 1024, loading: 'lazy' as const, decoding: 'async' as const, alt: alt || image.alt }
}
function StudyPicture({ image, alt }: { image: Media; alt?: string | null }) {
  return <picture><img {...pictureAttributes(image, alt)} alt={alt || image.alt} /></picture>
}
function inertPicture(image: Media, alt?: string | null): string {
  // Template children live in a DocumentFragment, which React cannot hydrate as ordinary children.
  // Only these fixed img attributes are serialized; CMS text is escaped, never treated as HTML.
  const escape = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  const attributes = Object.entries(pictureAttributes(image, alt)).map(([key, value]) => `${key.toLowerCase()}="${escape(value)}"`).join(' ')
  return `<picture><img ${attributes}></picture>`
}

export function MaterialStudy({ section }: { section: Section }) {
  const views = (section.cards || []).slice(0, 3).map(card => ({ ...card, photo: picture(card.image) })).filter(v => v.photo)
  if (views.length < 2) return null
  const id = section.anchor || 'material-study'
  return <section className="afara-study" id={id} data-material-study aria-labelledby={`${id}-heading`}>
    <div className="afara-study__container">
      <header className="afara-study__intro">{section.kicker && <p className="afara-study__eyebrow">{section.kicker}</p>}<h2 id={`${id}-heading`}>{section.heading}</h2>{section.body && <p>{section.body}</p>}</header>
      <div className="afara-study__layout">
        <div className="afara-study__visual">
          <div className="afara-study__frame" data-ms-frame aria-busy="false"><StudyPicture image={views[0].photo!} alt={views[0].imageAlt} /></div>
          <button className="afara-study__zoom" type="button" data-ms-zoom aria-label="Увеличить изображение ткани">Рассмотреть ближе <span aria-hidden="true">↗</span></button>
          <div className="afara-study__views" role="group" aria-label="Свет и фактура">{views.map((view, i) => <button key={view.id || i} type="button" data-ms-select={i} aria-pressed={i === 0}>{view.title}</button>)}</div>
          <p className="afara-study__caption" data-ms-caption>{views[0].body}</p>
        </div>
        <div className="afara-study__panel">
          <p className="afara-study__eyebrow">/ Предварительное решение</p><h3>Какой объём вам ближе?</h3>
          <label className="afara-study__range-label" htmlFor={`${id}-fullness`}>Коэффициент сборки <output htmlFor={`${id}-fullness`} data-ms-output>1,7</output></label>
          <input id={`${id}-fullness`} type="range" min="0" max="2" step="1" defaultValue="1" aria-valuetext="1,7" aria-describedby={`${id}-scheme-note`} data-ms-fullness />
          <div className="afara-study__scale" aria-hidden="true"><span>1,5</span><span>1,7</span><span>2,0</span></div>
          <svg className="afara-study__wave" viewBox="0 0 300 68" aria-hidden="true"><path d={pleatPath(1.7)} data-ms-wave fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          <p className="afara-study__note" id={`${id}-scheme-note`}>Схема объёма. Реальная складка зависит от ткани, тесьмы и системы карниза. Расход и конструкцию согласуем отдельно.</p>
          <label className="afara-study__select-label" htmlFor={`${id}-layers`}><span id={`${id}-layers-label`}>Слои у окна</span><select id={`${id}-layers`} aria-labelledby={`${id}-layers-label`} defaultValue="2" data-ms-layers><option value="1">Один слой</option><option value="2">Портьера и прозрачный слой</option></select></label>
          <details className="afara-study__niche"><summary>Что важно проверить в нише?<span aria-hidden="true">+</span></summary><p>Число рядов, размеры профилей, ход складки и выступы подоконника или радиатора. Размер ниши уточняем для выбранной системы и вашего окна.</p></details>
          <a className="afara-study__cta" href="#consultation" data-ms-transfer>{views[0].linkLabel || 'Обсудить образцы и решение'}<span aria-hidden="true">↗</span></a>
          <p className="afara-study__note">Иллюстративный просмотр. Цвет и фактуру подтверждаем по образцу при освещении вашего интерьера.</p>
          <p className="afara-study__status" role="status" aria-live="polite" data-ms-status />
        </div>
      </div>
      {views.map((view, i) => <template key={view.id || i} data-ms-view={i} data-title={view.title} data-caption={view.body || ''} dangerouslySetInnerHTML={{ __html: inertPicture(view.photo!, view.imageAlt) }} />)}
      <dialog className="afara-study__dialog" data-ms-dialog aria-label="Увеличенный просмотр ткани"><button type="button" data-ms-close aria-label="Закрыть просмотр ткани">Закрыть <span aria-hidden="true">×</span></button><div data-ms-zoom-frame /><p>Иллюстрация фактуры; для выбора ткани нужен образец.</p></dialog>
    </div>
    <MaterialStudyEnhancer id={id} />
  </section>
}
