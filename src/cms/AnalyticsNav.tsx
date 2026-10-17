import Link from 'next/link'
import type { ServerProps } from 'payload'
export default function AnalyticsNav({ user }: ServerProps) {
  return user?.role === 'ADMIN' ? <Link prefetch={false} className="nav__link" href="/admin/analytics">Аналитика</Link> : null
}
