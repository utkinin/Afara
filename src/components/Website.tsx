import Link from 'next/link'
import type { Page, Site, Document } from '@/payload-types'
import { media, pageURL } from '@/lib/content'
import { Header } from './Header'
import { Photo } from './Photo'
import { InquiryForm } from './InquiryForm'
import styles from './site.module.css'
export function Website({page,pages,site,documents,preview=false}:{page:Page,pages:Page[],site:Site,documents:Document[],preview?:boolean}){
  const sections=page.sections?.filter(s=>s.visible!==false)||[]
  const consent=documents.find(d=>d.kind==='consent'),privacy=documents.find(d=>d.kind==='privacy')
  const parent=typeof page.parent==='object'?page.parent:null
  return <><Header site={site} pages={pages.map(p=>({...p,sections:undefined,hero:undefined,heroMobile:undefined}))} cta={page.cta} anchors={page.type==='home'?sections.map(s=>s.anchor||''):['spaces','compositions','materials','approach']}/>
    <main id="main">{preview&&<div className={styles.previewBanner}>Предпросмотр черновика · не опубликовано</div>}
    {page.type!=='home'&&<nav aria-label="Хлебные крошки" className={`${styles.container} ${styles.breadcrumbs}`}><Link href="/">AFARA</Link><span>/</span>{parent&&<><Link href={pageURL(parent)}>{parent.title}</Link><span>/</span></>}<span>{page.title}</span></nav>}
    <section className={`${styles.hero} ${page.type!=='home'?styles.innerHero:''}`}>
      <div className={styles.heroImage}><Photo image={media(page.hero)} mobile={media(page.heroMobile)} priority hero alt={page.heroAlt} position={page.heroPosition??65}/></div>
      <div className={`${styles.container} ${styles.heroContent}`}><p className={styles.heroEyebrow}>{site.brand} · {site.tagline}</p><h1>{page.h1}</h1><p className={styles.heroIntro}>{page.intro}</p><a className={styles.button} href="#consultation">{page.cta}<span>↗</span></a><a className={styles.detailsLink} href={`#${sections.find(s=>s.kind==='details')?.anchor||sections[0]?.anchor||'consultation'}`}>{page.detailsLabel}<span>↓</span></a></div>
      {page.conceptLabel&&<span className={styles.heroCaption}>{page.conceptLabel}</span>}
    </section>
    {sections.map((section,i)=>{
      const kind=section.kind
      return <section id={section.anchor||undefined} key={section.id||i} className={`${styles.section} ${kind==='conditions'?styles.conditions:''}`}><div className={`${styles.container} ${kind==='materials'?styles.materials:kind==='process'?styles.processLayout:''}`}>
        <div className={styles.sectionIntro}>{section.kicker&&<p className={styles.kicker}>{section.kicker}</p>}<h2>{section.heading}</h2>{section.body&&<p className={styles.sectionBody}>{section.body}</p>}</div>
        {section.image&&<div className={styles.materialImage}><Photo image={media(section.image)} alt={section.imageAlt}/></div>}
        {section.cards&&section.cards.length>0&&<div className={kind==='spaces'?styles.spaces:kind==='process'?styles.process:kind==='faq'?styles.faq:styles.cards}>
          {section.cards.map((card,j)=>{
            const targetId=typeof card.page==='object'?card.page?.id:card.page
            const target=pages.find(p=>p.id===targetId)
            if(kind==='faq')return <details key={card.id||j}><summary>{card.title}<span>+</span></summary><p>{card.body}</p></details>
            return <article className={kind==='spaces'?styles.spaceCard:styles.card} key={card.id||j}>
              {card.image&&<div className={styles.cardImage}><Photo image={media(card.image)} alt={card.imageAlt}/></div>}
              {kind==='process'&&<span className={styles.processNumber}>0{j+1}</span>}
              <div className={styles.cardText}><h3>{card.title}</h3>{card.body&&<p>{card.body}</p>}{target&&<Link className={styles.arrowLink} href={pageURL(target)}>{card.linkLabel||card.title}<span>↗</span></Link>}</div>
            </article>
          })}
        </div>}
      </div></section>
    })}
    <section id="consultation" className={`${styles.section} ${styles.consultation}`}><div className={`${styles.container} ${styles.consultationGrid}`}><div><p className={styles.kicker}>/ Консультация</p><h2>{site.form?.heading}</h2><p className={styles.sectionBody}>{site.form?.intro}</p><address className={styles.contacts}>{site.phone&&<a href={`tel:${site.phone.replace(/[^+\d]/g,'')}`}>{site.phone}</a>}{site.email&&<a href={`mailto:${site.email}`}>{site.email}</a>}{site.address&&<p>{site.address}</p>}{site.geography&&<p>{site.geography}</p>}{site.hours&&<p>{site.hours}</p>}</address></div>
    <InquiryForm labels={site.form} source={page.path} consent={consent?{url:`/documents/${consent.slug}/`,version:consent.version}:null} policy={privacy?`/documents/${privacy.slug}/`:null}/></div></section>
    </main><footer className={styles.footer}><div className={`${styles.container} ${styles.footerInner}`}><Link className={styles.logo} href="/">{site.brand}<small>{site.tagline}</small></Link><nav aria-label="Документы">{documents.map(d=><Link key={d.id} href={`/documents/${d.slug}/`}>{d.title}</Link>)}</nav><p>{site.footerText}</p></div></footer></>
}
