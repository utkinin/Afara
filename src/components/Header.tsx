'use client'
import Link from 'next/link'
import { useRef } from 'react'
import type { Page, Site } from '@/payload-types'
import { pageURL } from '@/lib/urls'
import styles from './site.module.css'
import { ArrowIcon } from './ArrowIcon'
type Group={title:string,url:string,children:{title:string,url:string}[]}
export type NavigationPage=Pick<Page,'id'|'title'|'path'|'type'|'parent'|'navOrder'>
type HeaderSite=Pick<Site,'brand'|'tagline'|'menu'|'contactsLabel'>
export function Header({site,pages,cta,anchors}:{site:HeaderSite,pages:NavigationPage[],cta:string,anchors:string[]}){
  const dialog=useRef<HTMLDialogElement>(null)
  const groups:Group[]=pages.filter(p=>p.type==='overview').map(p=>({title:p.title,url:pageURL(p),children:pages.filter(c=>(typeof c.parent==='object'?c.parent?.id:c.parent)===p.id).map(c=>({title:c.title,url:pageURL(c)}))}))
  const menu=(site.menu||[]).filter(m=>anchors.includes(m.anchor))
  const standalone=pages.filter(p=>p.type==='direction'&&!p.parent)
  const contacts=pages.find(p=>p.type==='contacts')
  const close=()=>dialog.current?.close()
  const links=<><div className={styles.menuGroups}>{groups.map(g=><div key={g.url}><details open><summary>{g.title}</summary><Link prefetch={false} onClick={close} href={g.url}>Все {g.title.toLowerCase()} <span><ArrowIcon/></span></Link>{g.children.map(c=><Link prefetch={false} onClick={close} href={c.url} key={c.url}>{c.title}</Link>)}</details></div>)}</div>{standalone.map(p=><Link prefetch={false} className={styles.mobileLink} onClick={close} key={p.id} href={pageURL(p)}>{p.title} <ArrowIcon/></Link>)}</>
  return <><a className={styles.skip} href="#main">К содержимому</a><header className={styles.header}><div className={`${styles.container} ${styles.headerInner}`}>
    <Link href="/" className={styles.logo} aria-label={`${site.brand} — главная`}>{site.brand}<small>{site.tagline}</small></Link>
    <nav aria-label="Основная навигация" className={styles.desktopNav}>{menu.map(m=>m.anchor==='spaces'?<div className={styles.dropdown} key={m.id}><Link prefetch={false} href="/#spaces">{m.label} <span>⌄</span></Link><div className={styles.dropdownPanel}>{links}</div></div>:<a href={`/#${m.anchor}`} key={m.id}>{m.label}</a>)}{contacts&&<Link prefetch={false} href={pageURL(contacts)}>{site.contactsLabel||contacts.title}</Link>}</nav>
    <a className={`${styles.button} ${styles.headerCTA}`} href="#consultation">{cta}<span aria-hidden="true"><ArrowIcon/></span></a>
    <button type="button" className={styles.menuButton} aria-label="Открыть меню" onClick={()=>dialog.current?.showModal()}><span/><span/></button>
  </div></header>
  <dialog ref={dialog} className={styles.mobileMenu} onClick={e=>{if(e.target===e.currentTarget)close()}}><div className={styles.menuTop}><span className={styles.logo}>{site.brand}<small>{site.tagline}</small></span><button autoFocus type="button" onClick={close} className={styles.close} aria-label="Закрыть меню">×</button></div>
    <nav aria-label="Мобильная навигация"><h2>Пространства</h2>{links}{menu.filter(m=>m.anchor!=='spaces').map(m=><a className={styles.mobileLink} href={`/#${m.anchor}`} key={m.id} onClick={close}>{m.label}<span><ArrowIcon/></span></a>)}{contacts&&<Link prefetch={false} className={styles.mobileLink} href={pageURL(contacts)} onClick={close}>{site.contactsLabel||contacts.title} <ArrowIcon/></Link>}<a className={styles.button} href="#consultation" onClick={close}>{cta} <ArrowIcon/></a></nav>
  </dialog></>
}
