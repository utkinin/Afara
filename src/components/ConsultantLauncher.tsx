'use client'
import { useRef, useState, type ComponentType } from 'react'
import type { Site } from '@/payload-types'
import styles from './site.module.css'

export type ConsultantLabels = NonNullable<Site['assistant']>
export default function ConsultantLauncher({ labels, telegram, questions = [] }: { labels: ConsultantLabels; telegram?: string | null; questions?: string[] }) {
  const [Panel, setPanel] = useState<ComponentType<{ labels: ConsultantLabels; onClose: () => void; telegram?: string | null; questions: string[] }> | null>(null)
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return <aside className={styles.consultantLauncher} aria-label={labels.title || 'Задать вопрос'} data-server-only="consultant">
    <button ref={button} className={styles.button} type="button" aria-expanded={open} disabled={loading} onClick={async () => {
      setError(false)
      if (!Panel) {
        setLoading(true)
        try { const panelImport = await import('./ConsultantPanel'); setPanel(() => panelImport.default) }
        catch { setError(true); return }
        finally { setLoading(false) }
      }
      setOpen(true)
    }}>{loading ? 'Загружаем…' : labels.title || 'Задать вопрос'}</button>
    {error && <p role="alert">Не удалось открыть консультанта. Повторите позже.</p>}
    {telegram && <a className={styles.launcherTelegram} href={telegram} target="_blank" rel="noopener noreferrer" aria-label="Написать специалисту в Telegram">Telegram ↗</a>}
    {open && Panel && <Panel labels={labels} telegram={telegram} questions={questions} onClose={() => { setOpen(false); button.current?.focus() }} />}
  </aside>
}
