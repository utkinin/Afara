'use client'
import { useState } from 'react'
import styles from './site.module.css'

export function SaveIdea({ anchor }: { anchor: string }) {
  const [status, setStatus] = useState(''), [fallback, setFallback] = useState('')
  return <div className={styles.saveIdea} data-save-idea={anchor}>
    <button className={styles.textButton} type="button" onClick={async () => {
      const url = new URL(window.location.href); url.search = ''; url.hash = anchor
      try { await navigator.clipboard.writeText(url.href); setFallback(''); setStatus('Ссылка скопирована') }
      catch { setFallback(url.href); setStatus('Скопируйте ссылку из поля') }
    }}>Сохранить идею</button>
    <span role="status">{status}</span>
    {fallback && <label>Ссылка на идею<input readOnly value={fallback} onFocus={e => e.target.select()} /></label>}
  </div>
}
