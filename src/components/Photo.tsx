import type { Media } from '@/payload-types'
import styles from './site.module.css'
export function Photo({image,priority=false,position=65,mobile,hero=false,alt}:{image:Media|null,priority?:boolean,position?:number,mobile?:Media|null,hero?:boolean,alt?:string|null}){
  if(!image?.url)return <div className={styles.fabric} aria-hidden="true"/>
  // A tall mobile cover uses much more of the source height than a normal card.
  const sizes=hero?'100vw':'(max-width:767px) calc(100vw - 40px), (max-width:1023px) 48vw, 45vw'
  // The sanitized master is a valid last candidate when a smaller source has no 1600px derivative.
  const candidates=[image.sizes?.thumb,image.sizes?.tablet,image.sizes?.wide,{url:image.url,width:image.width}].filter(s=>s?.url&&s.width)
  const srcSet=[...new Map(candidates.map(s=>[s!.width!,s!.url!])).entries()].sort(([a],[b])=>a-b).map(([width,url])=>`${url} ${width}w`).join(', ')
  const mobileCandidates=mobile?[mobile.sizes?.thumb,mobile.sizes?.tablet,{url:mobile.url,width:mobile.width}].filter(s=>s?.url&&s.width):[]
  const mobileSet=[...new Map(mobileCandidates.map(s=>[s!.width!,s!.url!])).entries()].sort(([a],[b])=>a-b).map(([width,url])=>`${url} ${width}w`).join(', ')
  return <picture>{mobile?.url&&<source media="(max-width: 767px)" srcSet={mobileSet||mobile.url} sizes="100vw"/>}
    {/* The CMS generates sanitized WebP sizes once; serving them avoids a second optimizer. */}
    <img src={image.sizes?.wide?.url||image.url} srcSet={srcSet||undefined} sizes={sizes} width={image.width||1600} height={image.height||1067} alt={alt||image.alt} decoding="async" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} style={{objectPosition:`${position}% center`}}/>
  </picture>
}
