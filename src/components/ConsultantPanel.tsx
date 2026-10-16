'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ConsultantLabels } from './ConsultantLauncher'
import type { ConsultantAnswer } from '@/lib/consultant'
import styles from './site.module.css'
import { ArrowIcon } from './ArrowIcon'

export default function ConsultantPanel({ labels, onClose }: { labels: ConsultantLabels; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [question, setQuestion] = useState(''), [answer, setAnswer] = useState<ConsultantAnswer | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
    return () => controller.current?.abort()
  }, [])
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
  return <dialog ref={dialog} className={styles.consultantDialog} aria-labelledby="consultant-title" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}>
    <button type="button" className={styles.close} aria-label="Закрыть консультанта" onClick={close}>×</button>
    <h2 id="consultant-title">{labels.title || 'Задать вопрос'}</h2><p>{labels.intro}</p>
    <form className={styles.form} onSubmit={submit}>
      <label>Ваш вопрос<textarea autoFocus value={question} onChange={e => setQuestion(e.target.value)} required minLength={3} maxLength={500} rows={3} placeholder={labels.placeholder || ''} /></label>
      <button className={styles.button} type="submit" disabled={busy}>{busy ? 'Ищем в материалах…' : 'Найти ответ'}</button>
    </form>
    <div aria-live="polite" aria-busy={busy}>
      {error && <p role="alert">{error}</p>}
      {answer && <><p className={styles.answer}>{answer.answer}</p>{answer.mode === 'sources' && <p className={styles.formNote}>Найдено в опубликованных материалах. Генерация ИИ не подключена.</p>}
        {answer.sources.length > 0 && <nav aria-label="Источники ответа"><p>Источники AFARA</p><ul>{answer.sources.map(source => <li key={source.url}><a href={source.url} onClick={close}>{source.title}</a></li>)}</ul></nav>}
      </>}
    </div>
    <a href="#consultation" className={styles.arrowLink} onClick={() => { window.dispatchEvent(new CustomEvent('afara:question', { detail: question })); close() }}>Передать вопрос специалисту <ArrowIcon/></a>
    <p className={styles.formNote}>Если описание задачи ещё не заполнено, вопрос появится в форме. Заявка создаётся только после её явной отправки. Консультант не обучается на вашей переписке.</p>
    <p className={styles.formNote}>Контактные данные отправляются только через форму заявки после вашего подтверждения.</p>
  </dialog>
}
