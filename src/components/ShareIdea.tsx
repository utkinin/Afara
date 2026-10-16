'use client'
import { useState } from 'react'
import styles from './site.module.css'

export function ShareIdea({ anchor, title }: { anchor: string; title: string }) {
  const [message, setMessage] = useState('')
  const [fallback, setFallback] = useState('')
  return <div className={styles.shareIdea} data-server-only="share-idea">
    <button className={styles.textButton} type="button" aria-label={`Скопировать ссылку: ${title}`} onClick={async () => {
      const url = new URL(window.location.href); url.hash = anchor; url.search = ''
      try { await navigator.clipboard.writeText(url.href); setMessage('Ссылка скопирована'); setFallback('') }
      catch { setFallback(url.href); setMessage('Скопируйте ссылку из поля') }
    }}>Сохранить идею ↗</button>
    <span role="status">{message}</span>
    {fallback && <input aria-label="Ссылка на идею" readOnly value={fallback} onFocus={e => e.currentTarget.select()} />}
  </div>
}
