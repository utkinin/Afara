import Link from 'next/link'
import type { Page, Site, Document, Knowledge, Work } from '@/payload-types'
import { media, pageURL } from '@/lib/content'
import { Header } from './Header'
import { Photo } from './Photo'
import { InquiryForm } from './InquiryForm'
import { ContactDetails } from './ContactDetails'
import ConsultantLauncher from './ConsultantLauncher'
import styles from './site.module.css'
import { ArrowIcon } from './ArrowIcon'

type Section = NonNullable<Page['sections']>[number]
function ContentSection({ section, pages }: { section: Section; pages: Page[] }) {
  const kind = section.kind
  return <section id={section.anchor || undefined} className={`${styles.section} ${kind === 'conditions' ? styles.conditions : ''}`}><div className={`${styles.container} ${kind === 'materials' && section.image ? styles.materials : kind === 'process' ? styles.processLayout : ''}`}>
    <div className={styles.sectionIntro}>{section.kicker && <p className={styles.kicker}>{section.kicker}</p>}<h2>{section.heading}</h2>{section.body && <p className={styles.sectionBody}>{section.body}</p>}</div>
    {section.image && <div className={styles.materialImage}><Photo image={media(section.image)} alt={section.imageAlt} /></div>}
    {!!section.cards?.length && <div className={kind === 'spaces' ? styles.spaces : kind === 'process' ? styles.process : kind === 'faq' ? styles.faq : styles.cards}>
      {section.cards.map((card, j) => {
        const targetId = typeof card.page === 'object' ? card.page?.id : card.page
        const target = pages.find(p => p.id === targetId)
        if (kind === 'faq') return <details key={card.id || j}><summary>{card.title}<span aria-hidden="true">+</span></summary><p>{card.body}</p></details>
        return <article className={kind === 'spaces' ? styles.spaceCard : styles.card} key={card.id || j}>
          {card.image && <div className={styles.cardImage}><Photo image={media(card.image)} alt={card.imageAlt} /></div>}
          {kind === 'process' && <span className={styles.processNumber}>0{j + 1}</span>}
          <div className={styles.cardText}><h3>{card.title}</h3>{card.body && <p>{card.body}</p>}{target && <Link prefetch={false} className={styles.arrowLink} href={pageURL(target)}>{card.linkLabel || card.title}<span aria-hidden="true"><ArrowIcon/></span></Link>}</div>
        </article>
      })}
    </div>}
  </div></section>
}

export function Website({ page, pages, site, documents, knowledge = [], works = [], preview = false }: { page: Page; pages: Page[]; site: Site; documents: Document[]; knowledge?: Knowledge[]; works?: Work[]; preview?: boolean }) {
  const sections = page.sections?.filter(s => s.visible !== false) || []
  const consent = documents.find(d => d.kind === 'consent'), privacy = documents.find(d => d.kind === 'privacy')
  const parent = typeof page.parent === 'object' ? page.parent : null
  const contacts = pages.find(p => p.type === 'contacts')
  const answers = knowledge.filter(k => (typeof k.page === 'object' ? k.page.id : k.page) === page.id)
  const children = pages.filter(p => (typeof p.parent === 'object' ? p.parent?.id : p.parent) === page.id)
  const studio = site.studio
  const homeSections = pages.find(p => p.type === 'home')?.sections?.filter(s => s.visible !== false) || []
  // Only small navigation records enter the client component; page bodies and CMS settings remain server-side.
  const navigationPages = pages.map(p => ({ id: p.id, title: p.title, path: p.path, type: p.type, parent: typeof p.parent === 'object' ? p.parent?.id : p.parent, navOrder: p.navOrder }))
  return <><Header site={{ brand: site.brand, tagline: site.tagline, menu: site.menu, contactsLabel: site.contactsLabel }} pages={navigationPages} cta={page.cta} anchors={(page.type === 'home' ? sections : homeSections).map(s => s.anchor || '')} />
    <main id="main">{preview && <div className={styles.previewBanner}>Предпросмотр черновика · не опубликовано</div>}
      {page.type !== 'home' && <nav aria-label="Хлебные крошки" className={`${styles.container} ${styles.breadcrumbs}`}><Link prefetch={false} href="/">AFARA</Link><span>/</span>{parent && <><Link prefetch={false} href={pageURL(parent)}>{parent.title}</Link><span>/</span></>}<span>{page.title}</span></nav>}
      {page.type === 'contacts' ? <section className={`${styles.container} ${styles.contactPage}`}><h1>{page.h1}</h1><p>{page.intro}</p><ContactDetails site={site} full /></section> : <section className={`${styles.hero} ${page.type !== 'home' ? styles.innerHero : ''}`}>
        <div className={styles.heroImage}><Photo image={media(page.hero)} mobile={media(page.heroMobile)} priority hero alt={page.heroAlt} position={page.heroPosition ?? 65} /></div>
        <div className={`${styles.container} ${styles.heroContent}`}><p className={styles.heroEyebrow}>{site.brand} · {site.tagline}</p><h1>{page.h1}</h1><p className={styles.heroIntro}>{page.intro}</p><a className={styles.button} href="#consultation">{page.cta}<span aria-hidden="true"><ArrowIcon/></span></a><a className={styles.detailsLink} href={`#${sections.find(s => s.kind === 'details')?.anchor || sections[0]?.anchor || 'consultation'}`}>{page.detailsLabel}<span aria-hidden="true">↓</span></a></div>
        {page.conceptLabel && <span className={styles.heroCaption}>{page.conceptLabel}</span>}
      </section>}
      {sections.map((section, i) => {
        if (section.kind !== 'spaces') return <ContentSection key={section.id || i} section={section} pages={pages} />
        const candidates = page.type === 'home' ? pages.filter(p => p.type === 'overview' || p.type === 'direction' && !p.parent) : children
        const existing = section.cards || []
        const missing = candidates.filter(p => !existing.some(c => (typeof c.page === 'object' ? c.page?.id : c.page) === p.id))
        return <ContentSection key={section.id || i} pages={pages} section={{ ...section, cards: [...existing, ...missing.map(p => ({ title: p.title, body: p.intro, page: p.id }))] }} />
      })}
      {page.type === 'home' && <>
        {studio?.verified && studio.body && <section id="studio" className={styles.section}><div className={styles.container}><h2>{studio.heading}</h2><div className={styles.studioGrid}><div><p className={styles.sectionBody}>{studio.body}</p>{studio.name && <h3>{studio.name}</h3>}{studio.role && <p>{studio.role}</p>}</div>{media(studio.photo) && <div className={styles.materialImage}><Photo image={media(studio.photo)} /></div>}</div></div></section>}
        {works.length > 0 && <section id="works" className={styles.section}><div className={styles.container}><h2>{site.worksHeading}</h2><div className={styles.spaces}>{works.map(work => <article key={work.id} className={styles.card}><h3>{work.title}</h3><p>{work.task}</p><p>{work.space}</p><p>{work.solution}</p>{work.photos?.map(photo => <div className={styles.cardImage} key={photo.id}><Photo image={media(photo.image)} /></div>)}</article>)}</div></div></section>}
        {site.trust?.filter(s => s.visible !== false && !(s.kind === 'faq' && answers.length)).map((s, i) => <ContentSection key={s.id || `trust-${i}`} section={s} pages={pages} />)}
      </>}
      {answers.length > 0 && <section className={styles.section} aria-label="Публичные материалы AFARA"><div className={`${styles.container} ${styles.faq}`}>{page.type === 'home' && <h2>{site.trust?.find(s => s.kind === 'faq')?.heading}</h2>}{answers.map(k => <details key={k.id}><summary>{k.question}<span aria-hidden="true">+</span></summary><p id={`answer-${k.id}`}>{k.answer}</p></details>)}</div></section>}
      <section id="consultation" className={`${styles.section} ${styles.consultation}`}><div className={`${styles.container} ${styles.consultationGrid}`}><div><p className={styles.kicker}>/ Консультация</p><h2>{site.form?.heading}</h2><p className={styles.sectionBody}>{site.form?.intro}</p><ContactDetails site={site} />{contacts && page.id !== contacts.id && <Link prefetch={false} className={styles.arrowLink} href={pageURL(contacts)}>{site.contactsLabel || contacts.title} <ArrowIcon/></Link>}</div>
        <InquiryForm labels={site.form} source={page.path} consent={consent ? { url: `/documents/${consent.slug}/`, version: consent.version } : null} policy={privacy ? `/documents/${privacy.slug}/` : null} /></div></section>
      {site.assistant?.enabled && !preview && <ConsultantLauncher labels={site.assistant} />}
    </main><footer className={styles.footer}><div className={`${styles.container} ${styles.footerInner}`}><Link prefetch={false} className={styles.logo} href="/">{site.brand}<small>{site.tagline}</small></Link><ContactDetails site={site} /><nav aria-label="Контакты и документы">{contacts && <Link prefetch={false} href={pageURL(contacts)}>{site.contactsLabel || contacts.title}</Link>}{documents.map(d => <Link prefetch={false} key={d.id} href={`/documents/${d.slug}/`}>{d.title}</Link>)}</nav><p>{site.footerText}</p></div></footer></>
}
