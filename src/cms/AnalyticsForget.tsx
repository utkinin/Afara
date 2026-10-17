'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export function AnalyticsForget({ visitorKey }: { visitorKey: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), router = useRouter()
  return <div><button type="button" disabled={busy} onClick={async () => {
    if (!confirm('Удалить всю историю этого браузера и связи с заявками? Сами заявки и контакты сохранятся.')) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/analytics/erase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorKey }) })
      if (!response.ok) throw new Error('erase')
      router.refresh()
    } catch { setError('Не удалось удалить историю. Повторите позже.') } finally { setBusy(false) }
  }}>Удалить историю браузера</button>{error && <p role="alert">{error}</p>}</div>
}
