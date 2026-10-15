# Безопасность AFARA: реализация и границы

Среда проверок — изолированная облачная машина, синтетические данные. Это не независимый аудит и не production-пентест. Окончательные результаты команд и скриншоты — QA_REPORT.md.

| Мера | Реализация / проверка | Ограничения до запуска |
|---|---|---|
| Доступ | Payload session + роли ADMIN/EDITOR, закрытые заявки/аудит/получатели; прямые ACL тесты | Production MFA/IdP ещё не подключён |
| Первый владелец | Приватная CLI с TTY/скрытым паролем; first-register/init заблокированы | Реального владельца создаёт оператор, тестовые пользователи удаляются |
| MFA gateway | RS256 JWKS, issuer/audience/expiry/email; production fail-closed, включая preview и медиа | Нужен реальный Cloudflare Access, MFA policy/recovery, тест прямого origin |
| Сессии | Payload useSessions, HttpOnly, Secure в production, SameSite=Lax; роль сбрасывает sessions | Полный сценарий recovery/logout/revocation ещё не принят на целевом сервисе |
| Черновики | Штатные Payload drafts/versions; public queries только published; preview требует сессию | Полная приёмка восстановления версий и параллельных правок остаётся |
| Медиа | ACL на файл/производные, Sharp decode/re-encode, EXIF/GPS удаляются, лимиты; плохой файл и приватный URL проверены | HEIC не поддержан; удаление физического файла консервативно запрещено |
| Заявка | Zod strict, лимит тела 16KB, один контакт, актуальное опубликованное согласие; узкий серверный create | Юридические документы не утверждены, реальная форма выключена |
| Идемпотентность | Уникальный ключ PostgreSQL + hash валидированного тела; повтор и конфликт проверены | Иные обращения не блокируются по одному контакту |
| Уведомление | Outbox в строке leads, atomic SKIP LOCKED/lease, backoff/5 попыток/видимая ошибка | Внешняя почта/доставляемость пока не подключены, exactly-once SMTP не обещается |
| CSRF | Payload CSRF allowlist; inquiry строго сверяет Origin; cookies Lax | Proxy Host/Origin/TLS проверить на целевом размещении |
| Лимиты | Persisted Payload login lockout и общий limiter заявок в PostgreSQL, honeypot, fail-closed | Нужны WAF/source/account лимиты у выбранного MFA gateway; CAPTCHA не добавлена |
| XSS/инъекции | React text renderer, нет HTML/JS полей и URL fetch; параметризованный SQL; CSV formula neutralization | При добавлении редактора/импорта повторить review |
| Заголовки | CSP nonce на ответ, no unsafe-eval в production, nosniff/referrer/permissions; приватный no-store | style-src unsafe-inline нужен штатным стилям CMS; HTTPS/HSTS ещё не включены на домене |
| Кеш | Динамический HTML с новым nonce, опубликованные обработанные файлы immutable; приватный no-store | CDN/ISR не включены и не выдаются за проверенные |
| Секреты | Только ignored .env.local; пример пустой; пароли QA случайные, значения не выводятся | Production secret store, ротация, проверка истории при первом push |
| Аудит | Вход и изменения основных коллекций, экспорт; только actor/action/object/version, без текста заявки | Настройка получателей, удаления и внешние события требуют расширения аудита |
| Зависимости | Поддерживаемая совместимая пара Payload/Next; обновлены Sharp/Nodemailer/Undici/DOMPurify/Sass, lockfile | Оставшиеся Moderate касаются esbuild tooling (drizzle-kit), serve API не используется; пересматривать при обновлении |
| БД/файлы | Postgres, постоянные Docker volumes, runtime timeout/pool caps | Минимальные production-права, сетевые правила, шифрованные удалённые копии и восстановление ещё нужны |
| Инциденты | Порядок ограничить доступ/сохранить свидетельства/отозвать/восстановить описан в DEPLOYMENT | Назначить ответственного, канал уведомлений и RPO/RTO |

Нет открытой регистрации, публичного чтения заявок, GraphQL, API-ключей, импорта произвольных URL, оплаты, внешней аналитики и неработающих AI-кнопок. Публичное размещение возможно только после устранения оставшихся блокеров, а не по факту прохождения локальной сборки.
