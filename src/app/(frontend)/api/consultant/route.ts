import { z } from 'zod'
import { cms } from '@/lib/payload'
import { answerQuestion } from '@/lib/consultant'

const schema = z.object({ question: z.string().trim().min(3).max(500) }).strict()
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } })
export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(process.env.APP_URL || 'http://localhost:3000').origin) return reply({ error: 'Недоступно' }, 403)
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'Неверный формат' }, 415)
  try {
    const reader = req.body?.getReader(); if (!reader) return reply({ error: 'Нужен вопрос' }, 400)
    const chunks: Uint8Array[] = []; let size = 0
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 3000) { await reader.cancel(); return reply({ error: 'Слишком длинный вопрос' }, 413) } chunks.push(value) }
    let input: unknown
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return reply({ error: 'Неверный формат' }, 400) }
    const parsed = schema.safeParse(input); if (!parsed.success) return reply({ error: 'Введите вопрос до 500 символов' }, 400)
    const p = await cms()
    const site = await p.findGlobal({ slug: 'site', draft: false, depth: 0 })
    if (site._status !== 'published' || !site.assistant?.enabled) return reply({ error: 'Консультант пока недоступен' }, 503)
    // Persistent shared budget; no trust in unverified IP headers, no question/contact logging.
    const bucket = `consultant:${Math.floor(Date.now() / 60000)}`
    const counter = await p.db.pool.query(`INSERT INTO rate_limits (key,count,expires_at,created_at,updated_at)
      VALUES ($1,1,NOW()+INTERVAL '2 minutes',NOW(),NOW()) ON CONFLICT (key)
      DO UPDATE SET count=rate_limits.count+1,updated_at=NOW() RETURNING count`, [bucket])
    if (counter.rows[0].count > 20) return reply({ error: 'Слишком много вопросов. Попробуйте через минуту.' }, 429)
    const dailyLimit = Math.min(1000, Math.max(1, Number(process.env.AFARA_AI_DAILY_LIMIT) || 100))
    const daily = await p.db.pool.query(`INSERT INTO rate_limits (key,count,expires_at,created_at,updated_at)
      VALUES ($1,1,NOW()+INTERVAL '2 days',NOW(),NOW()) ON CONFLICT (key)
      DO UPDATE SET count=rate_limits.count+1,updated_at=NOW() RETURNING count`, [`consultant-day:${Math.floor(Date.now() / 86400000)}`])
    if (daily.rows[0].count > dailyLimit) return reply({ error: 'Сегодня консультант достиг лимита. Обратитесь к специалисту через форму.' }, 429)
    await p.db.pool.query("DELETE FROM rate_limits WHERE key LIKE 'consultant%' AND expires_at<NOW()")
    return reply(await answerQuestion(parsed.data.question))
  } catch { return reply({ error: 'Не удалось получить ответ. Повторите позже или обратитесь к специалисту.' }, 503) }
}
