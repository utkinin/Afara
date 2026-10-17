'use client'
import { useEffect, useRef, useState } from 'react'
import type { Site } from '@/payload-types'
import styles from './site.module.css'
import { ArrowIcon } from './ArrowIcon'
import { ANALYTICS_LINK_TEXT, browserAnalyticsChoice, type AnalyticsChoice, type AnalyticsPolicy } from '../lib/analytics-shared'
type Labels=Site['form']
export function InquiryForm({labels,source,consent,policy,analyticsPolicy}:{labels:Labels,source:string,consent:{url:string,version:string}|null,policy:string|null,analyticsPolicy?:AnalyticsPolicy|null}){
  const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[failure,setFailure]=useState('')
  const [values,setValues]=useState({space:'',city:'',description:'',budget:'',name:'',channel:'phone',contact:'',consent:false,website:''})
  const key=useRef<string|null>(null), form=useRef<HTMLFormElement>(null)
  const [analyticsAllowed,setAnalyticsAllowed]=useState(false),[analyticsOptIn,setAnalyticsOptIn]=useState(false)
  useEffect(()=>{
    const apply=(choice:AnalyticsChoice|null)=>{const allowed=Boolean(analyticsPolicy&&choice?.granted&&choice.version===analyticsPolicy.version);setAnalyticsAllowed(allowed);if(!allowed)setAnalyticsOptIn(false)}
    const receive=(event:Event)=>apply((event as CustomEvent<AnalyticsChoice|null>).detail)
    apply(browserAnalyticsChoice());window.addEventListener('afara:analytics-choice',receive)
    return()=>window.removeEventListener('afara:analytics-choice',receive)
  },[analyticsPolicy])
  useEffect(()=>{
    const receive=(event:Event)=>{
      const question=(event as CustomEvent<unknown>).detail
      if(typeof question!=='string'||!question.trim()||question.length>500)return
      setValues(v=>({...v,description:v.description.trim()?v.description:question}));setStep(1)
      requestAnimationFrame(()=>form.current?.querySelector('textarea')?.focus())
    }
    window.addEventListener('afara:question',receive)
    return()=>window.removeEventListener('afara:question',receive)
  },[])
  if(!labels)return null
  const update=(name:string,value:string|boolean)=>{setValues(v=>({...v,[name]:value}));setFailure('')}
  const disabled=!consent||!policy
  async function send(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!form.current?.reportValidity())return
    if(step===1){setStep(2);requestAnimationFrame(()=>document.getElementById('inquiry-name')?.focus());return}
    setBusy(true);setFailure('');key.current ||= crypto.randomUUID()
    try{
      const context=analyticsOptIn&&analyticsAllowed?(await import('../lib/analytics-tracker')).currentAnalyticsContext():null
      const attribution=context?{analyticsOptIn:true,analyticsView:context.viewId,analyticsVersion:context.version}:{analyticsOptIn:false}
      const res=await fetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key.current},body:JSON.stringify({...values,...attribution,source,consentVersion:consent?.version})})
      if(!res.ok)throw new Error('send')
      setDone(true)
    }catch{setFailure(labels?.error||'Не удалось отправить. Попробуйте ещё раз.')}finally{setBusy(false)}
  }
  if(done)return <div className={styles.formSuccess} role="status"><span className={styles.successMark}>✓</span><h3>{labels.success}</h3><button className={styles.textButton} type="button" onClick={()=>{setDone(false);setStep(1);setValues({space:'',city:'',description:'',budget:'',name:'',channel:'phone',contact:'',consent:false,website:''});key.current=null;setAnalyticsOptIn(false)}}>{labels.again} <ArrowIcon/></button></div>
  return <form ref={form} className={styles.form} onSubmit={send} onInvalid={e=>{(e.target as HTMLElement).focus()}}>
    <div className={styles.formStep}><span>0{step} / 02</span><span>{step===1?labels.stepOne:labels.stepTwo}</span><div className={styles.stepTrack}><i style={{width:step===1?'50%':'100%'}}/></div></div>
    {step===1?<div className={styles.formGrid}>
      <label>{labels.space}<select required value={values.space} onChange={e=>update('space',e.target.value)}><option value="">Выберите пространство</option>{labels.spaces?.map(s=><option key={s.id} value={s.label}>{s.label}</option>)}</select></label>
      <label>{labels.city}<input required autoComplete="address-level2" maxLength={120} value={values.city} onChange={e=>update('city',e.target.value)}/></label>
      <label className={styles.full}>{labels.description}<textarea required minLength={10} maxLength={3000} rows={3} value={values.description} onChange={e=>update('description',e.target.value)}/></label>
    </div>:<div className={styles.formGrid}>
      <label className={styles.full}>{labels.name}<input id="inquiry-name" required autoComplete="name" minLength={2} maxLength={100} value={values.name} onChange={e=>update('name',e.target.value)}/></label>
      <label>{labels.channel}<select value={values.channel} onChange={e=>{update('channel',e.target.value);update('contact','')}}><option value="phone">{labels.phone}</option><option value="email">{labels.email}</option></select></label>
      <label>{values.channel==='phone'?labels.phone:labels.email}<input required autoComplete={values.channel==='phone'?'tel':'email'} type={values.channel==='phone'?'tel':'email'} minLength={values.channel==='phone'?7:5} maxLength={200} value={values.contact} onChange={e=>update('contact',e.target.value)}/></label>
      <label className={styles.full}>{labels.budget}<input maxLength={120} value={values.budget} onChange={e=>update('budget',e.target.value)} placeholder="Пока не определён"/></label>
      <label className={`${styles.full} ${styles.consent}`}><input required type="checkbox" checked={values.consent} onChange={e=>update('consent',e.target.checked)}/><span>{labels.consentLabel} {consent&&<a href={consent.url} target="_blank" rel="noreferrer">Согласие</a>}{policy&&<> и <a href={policy} target="_blank" rel="noreferrer">политика обработки данных</a></>}.</span></label>
      {analyticsAllowed&&analyticsPolicy&&<label data-server-only className={`${styles.full} ${styles.consent}`}><input type="checkbox" checked={analyticsOptIn} onChange={e=>setAnalyticsOptIn(e.target.checked)}/><span>{ANALYTICS_LINK_TEXT} <a href={analyticsPolicy.url} target="_blank" rel="noreferrer">Условия аналитики</a>.</span></label>}
    </div>}
    <div className={styles.honeypot} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={values.website} onChange={e=>update('website',e.target.value)}/></label></div>
    {failure&&<p className={styles.formError} role="alert">{failure}</p>}
    {disabled&&<p className={styles.formNote}>Приём заявок включится после публикации документов об обработке данных.</p>}
    <div className={styles.formActions}>{step===2&&<button type="button" className={styles.textButton} onClick={()=>setStep(1)} disabled={busy}>← {labels.back}</button>}<button className={styles.button} disabled={busy||(step===2&&disabled)} type="submit">{busy?'Отправляем…':step===1?labels.next:labels.submit}<span aria-hidden="true"><ArrowIcon/></span></button></div>
  </form>
}
