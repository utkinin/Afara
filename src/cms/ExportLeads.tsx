import Link from 'next/link'
export default function ExportLeads(){return <div style={{marginBottom:'1rem'}}><Link prefetch={false} download className="btn btn--style-secondary" href="/api/export">Экспортировать CSV (до 1000 заявок)</Link></div>}
