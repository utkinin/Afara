'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ConsultantLabels } from './ConsultantLauncher'
import type { ConsultantAnswer } from '@/lib/consultant'
import styles from './site.module.css'
import { ArrowIcon } from './ArrowIcon'

export default function ConsultantPanel({ labels, onClose, telegram, questions }: { labels: ConsultantLabels; onClose: () => void; telegram?: string | null; questions: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [question, setQuestion] = useState(''), [answer, setAnswer] = useState<ConsultantAnswer | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    // Desktop remains usable while the reader asks a question. No timed opening or notification sounds.
    if (!dialog.current?.open) {
      if (window.matchMedia('(max-width: 767px)').matches) dialog.current?.showModal()
      else dialog.current?.show()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault(); dialog.current?.close(); onClose()
    }
    document.addEventListener('keydown', escape)
    return () => { controller.current?.abort(); document.removeEventListener('keydown', escape) }
  }, [onClose])
  function close() { dialog.current?.close(); onClose() }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(''); setAnswer(null)
    controller.current = new AbortController()
    try {
      const response = await fetch('/api/consultant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }), signal: controller.current.signal })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Ответ временно недоступен'); return }
      setAnswer(data)
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError('Не удалось получить ответ. Ваш вопрос остался на экране.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className={styles.consultantDialog} aria-labelledby="consultant-title" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); close() } }} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}>
    <button type="button" className={styles.close} aria-label="Закрыть консультанта" onClick={close}>×</button>
    <h2 id="consultant-title">{labels.title || 'Задать вопрос'}</h2><p>{labels.intro}</p>
    {!!questions.length && <div className={styles.quickQuestions} aria-label="Популярные вопросы">{questions.slice(0, 3).map(text => <button type="button" key={text} onClick={() => { setQuestion(text); dialog.current?.querySelector('textarea')?.focus() }}>{text}</button>)}</div>}
    <form className={styles.form} onSubmit={submit}>
      <label>Ваш вопрос<textarea autoFocus value={question} onChange={e => setQuestion(e.target.value)} required minLength={3} maxLength={500} rows={3} placeholder={labels.placeholder || ''} /></label>
      <button className={styles.button} type="submit" disabled={busy}>{busy ? 'Ищем в материалах…' : 'Найти ответ'}</button>
    </form>
    <div aria-live="polite" aria-busy={busy}>
      {error && <p role="alert">{error}</p>}
      {answer && <><p className={styles.answer}>{answer.answer}</p>{answer.mode === 'sources' && <p className={styles.formNote}>Ответ найден в опубликованных материалах AFARA.</p>}
        {answer.sources.length > 0 && <nav aria-label="Источники ответа"><p>Источники AFARA</p><ul>{answer.sources.map(source => <li key={source.url}><a href={source.url} onClick={close}>{source.title}</a></li>)}</ul></nav>}
      </>}
    </div>
    <a href={telegram || '#consultation'} target={telegram ? '_blank' : undefined} rel={telegram ? 'noopener noreferrer' : undefined} className={styles.arrowLink} onClick={() => {
      if (!telegram && question.trim()) window.dispatchEvent(new CustomEvent('afara:question', { detail: question.trim() }))
      close()
    }}>{telegram ? 'Написать специалисту в Telegram' : 'Передать вопрос специалисту'} <ArrowIcon/></a>
    <p className={styles.formNote}>Контактные данные отправляются только через форму заявки после вашего подтверждения.</p>
  </dialog>
}
