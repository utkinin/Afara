import type { Media } from '@/payload-types'
import styles from './site.module.css'
export function Photo({image,priority=false,position=65,mobile,hero=false,alt}:{image:Media|null,priority?:boolean,position?:number,mobile?:Media|null,hero?:boolean,alt?:string|null}){
  if(!image?.url)return <div className={styles.fabric} aria-hidden="true"/>
  const sizes=hero?'100vw':'(max-width:767px) calc(100vw - 40px), (max-width:1023px) 48vw, 45vw'
  const srcSet=[image.sizes?.thumb,image.sizes?.tablet,image.sizes?.wide].filter(s=>s?.url&&s.width).map(s=>`${s!.url} ${s!.width}w`).join(', ')
  return <picture>{mobile?.url&&<source media="(max-width: 767px)" srcSet={mobile.sizes?.tablet?.url||mobile.url}/>}
    {/* The CMS generates sanitized WebP sizes once; serving them avoids a second optimizer. */}
    <img src={image.sizes?.wide?.url||image.url} srcSet={mobile?.url?undefined:srcSet||undefined} sizes={sizes} width={image.width||1600} height={image.height||1067} alt={alt||image.alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} style={{objectPosition:`${position}% center`}}/>
  </picture>
}
