import Link from 'next/link'
import styles from '@/components/site.module.css'
export default function NotFound(){return <main className={styles.empty}><p>404</p><h1>Страница не найдена</h1><Link href="/">Вернуться в AFARA ↗</Link></main>}
