'use client'
import Link from 'next/link'
import { useRef } from 'react'
import type { Page, Site } from '@/payload-types'
import { pageURL } from '@/lib/urls'
import styles from './site.module.css'
type Group={title:string,url:string,children:{title:string,url:string}[]}
export function Header({site,pages,cta,anchors}:{site:Site,pages:Page[],cta:string,anchors:string[]}){
  const dialog=useRef<HTMLDialogElement>(null)
  const groups:Group[]=pages.filter(p=>p.type==='overview').map(p=>({title:p.title,url:pageURL(p),children:pages.filter(c=>(typeof c.parent==='object'?c.parent?.id:c.parent)===p.id).map(c=>({title:c.title,url:pageURL(c)}))}))
  const menu=(site.menu||[]).filter(m=>anchors.includes(m.anchor))
  const close=()=>dialog.current?.close()
  const links=<>{groups.length>0&&<div className={styles.menuGroups}>{groups.map(g=><div key={g.url}><details open><summary>{g.title}</summary><Link onClick={close} href={g.url}>Все {g.title.toLowerCase()} <span>↗</span></Link>{g.children.map(c=><Link onClick={close} href={c.url} key={c.url}>{c.title}</Link>)}</details></div>)}</div>}</>
  return <><a className={styles.skip} href="#main">К содержимому</a><header className={styles.header}><div className={`${styles.container} ${styles.headerInner}`}>
    <Link href="/" className={styles.logo} aria-label={`${site.brand} — главная`}>{site.brand}<small>{site.tagline}</small></Link>
    <nav aria-label="Основная навигация" className={styles.desktopNav}>{menu.map(m=>m.anchor==='spaces'?<div className={styles.dropdown} key={m.id}><Link href="/#spaces">{m.label} <span>⌄</span></Link><div className={styles.dropdownPanel}>{links}</div></div>:<a href={`/#${m.anchor}`} key={m.id}>{m.label}</a>)}</nav>
    <a className={`${styles.button} ${styles.headerCTA}`} href="#consultation">{cta}<span aria-hidden="true">↗</span></a>
    <button type="button" className={styles.menuButton} aria-label="Открыть меню" onClick={()=>dialog.current?.showModal()}><span/><span/></button>
  </div></header>
  <dialog ref={dialog} className={styles.mobileMenu} onClick={e=>{if(e.target===e.currentTarget)close()}}><div className={styles.menuTop}><span className={styles.logo}>{site.brand}<small>{site.tagline}</small></span><button autoFocus type="button" onClick={close} className={styles.close} aria-label="Закрыть меню">×</button></div>
    <nav aria-label="Мобильная навигация"><h2>Пространства</h2>{links}{menu.filter(m=>m.anchor!=='spaces').map(m=><a className={styles.mobileLink} href={`/#${m.anchor}`} key={m.id} onClick={close}>{m.label}<span>↗</span></a>)}<a className={styles.button} href="#consultation" onClick={close}>{cta} ↗</a></nav>
  </dialog></>
}
