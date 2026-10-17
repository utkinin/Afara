'use client'
import { useEffect, useState } from 'react'
import { ANALYTICS_CHOICE_COOKIE, browserAnalyticsChoice, privacySignal, type AnalyticsChoice, type AnalyticsPolicy } from '../lib/analytics-shared'

export function AnalyticsConsent({ policy, path }: { policy: AnalyticsPolicy | null; path: string }) {
  const [choice, setChoice] = useState<AnalyticsChoice | null>(), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocked, setBlocked] = useState(false)
  const announce = (next: AnalyticsChoice | null) => { setChoice(next); window.dispatchEvent(new CustomEvent('afara:analytics-choice', { detail: next })) }
  useEffect(() => {
    const sync = () => {
      const saved = browserAnalyticsChoice(), denied = privacySignal()
      setBlocked(denied)
      const next = saved && (!saved.granted || saved.version === policy?.version) && !denied ? saved : null
      setChoice(next); window.dispatchEvent(new CustomEvent('afara:analytics-choice', { detail: next }))
      if (!next && policy && !denied) setOpen(true)
      if (saved?.granted && (denied || !policy)) void fetch('/api/analytics/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted: false }) }).catch(() => {})
    }
    const invalid = () => {
      document.cookie = `${ANALYTICS_CHOICE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      setChoice(null); window.dispatchEvent(new CustomEvent('afara:analytics-choice', { detail: null }))
      setOpen(true); setError('Условия аналитики изменились или согласие истекло. Обновите страницу.')
    }
    sync(); window.addEventListener('focus', sync); window.addEventListener('afara:analytics-invalid', invalid)
    return () => { window.removeEventListener('focus', sync); window.removeEventListener('afara:analytics-invalid', invalid) }
  }, [policy?.version, policy])
  useEffect(() => {
    if (!choice?.granted || !policy || blocked) return
    let disposed = false, stop: (() => void) | undefined
    void import('../lib/analytics-tracker').then(module => { if (!disposed) stop = module.startAnalytics(path, policy) })
    return () => { disposed = true; stop?.() }
  }, [choice?.granted, choice?.version, path, policy, blocked])
  async function choose(granted: boolean) {
    setBusy(true); setError('')
    if (!granted) {
      const next = { granted: false, version: policy?.version || '' }
      // Remember an explicit refusal even if deleting server history temporarily fails.
      document.cookie = `${ANALYTICS_CHOICE_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; Path=/; SameSite=Lax; Max-Age=7776000${location.protocol === 'https:' ? '; Secure' : ''}`
      announce(next)
    }
    try {
      const response = await fetch('/api/analytics/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted, version: policy?.version }), signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('consent')
      announce(await response.json()); setOpen(false)
    } catch { setError(granted ? 'Не удалось подтвердить сохранение выбора. Обновите страницу и проверьте настройки.' : 'Сбор остановлен в этом браузере. Не удалось подтвердить удаление истории; повторите отказ позже.') }
    finally { setBusy(false) }
  }
  return <div className="afara-consent" data-server-only>
    <button className="afara-consent__settings" type="button" onClick={() => setOpen(true)}>Настройки cookie</button>
    {open && <section className="afara-consent__panel" aria-label="Настройки аналитики">
      <h2>Аналитика сайта</h2>
      <p>{policy ? 'С вашего согласия сохраняем источник перехода, просмотренные страницы и примерное активное время — до 90 дней. Отказ не мешает пользоваться сайтом и отправлять заявки.' : 'Сейчас аналитика отключена. Необязательные cookie для неё не устанавливаются.'}</p>
      {policy && <a href={policy.url} target="_blank" rel="noreferrer">Условия обработки данных аналитики</a>}
      {blocked && <p>В браузере включён запрет отслеживания. Мы его учитываем.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="afara-consent__actions">
        {policy && !blocked && <button type="button" disabled={busy} onClick={() => void choose(true)}>Разрешить аналитику</button>}
        <button type="button" disabled={busy} onClick={() => void choose(false)}>{choice?.granted ? 'Отключить и удалить историю' : 'Без аналитики'}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)}>Закрыть</button>
      </div>
    </section>}
  </div>
}
