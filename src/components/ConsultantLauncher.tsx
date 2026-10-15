'use client'
import { useRef, useState, type ComponentType } from 'react'
import type { Site } from '@/payload-types'
import styles from './site.module.css'

export type ConsultantLabels = NonNullable<Site['assistant']>
export default function ConsultantLauncher({ labels }: { labels: ConsultantLabels }) {
  const [Panel, setPanel] = useState<ComponentType<{ labels: ConsultantLabels; onClose: () => void }> | null>(null)
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
    {open && Panel && <Panel labels={labels} onClose={() => { setOpen(false); button.current?.focus() }} />}
  </aside>
}
