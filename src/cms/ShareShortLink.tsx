'use client'
import { Button, useFormFields } from '@payloadcms/ui'
import { useState } from 'react'

export default function ShareShortLink() {
  const slug = useFormFields(([fields]) => fields.slug?.value) as string | undefined
  const [message, setMessage] = useState('')
  const url = () => `${window.location.origin}/s/${slug}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(url()); setMessage('Ссылка скопирована. Убедитесь, что запись сохранена и включена.') }
    catch { setMessage(`Скопируйте ссылку: ${url()}`) }
  }
  return <div className="afara-share-controls" style={{ marginBlock: '1rem' }}>
    <p>После сохранения: /s/{slug || 'имя'}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      <Button type="button" buttonStyle="secondary" size="medium" margin={false} disabled={!slug} onClick={copy}>Скопировать</Button>
      <Button type="button" buttonStyle="secondary" size="medium" margin={false} disabled={!slug} onClick={async () => {
        if (navigator.share) { try { await navigator.share({ title: 'AFARA', url: url() }) } catch { setMessage('Отправка отменена. Ссылку можно скопировать.') } }
        else await copy()
      }}>Поделиться</Button>
    </div><p role="status">{message}</p>
  </div>
}
