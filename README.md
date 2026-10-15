# AFARA

Текстильный дизайн и инженерная студия. Переносимое Next.js-приложение с Payload CMS и PostgreSQL. Подтверждённое позиционирование: комплектация сложных частных резиденций и HoReCa; второй свет, высота 4,5–6 м и выше, эркеры, многослойность, Wave, blackout, моторизация. География — весь мир, российское отделение в Санкт-Петербурге.

## Локальный запуск

Node.js 24, npm 11, Docker с Compose. В облачной среде:

```bash
cd /workspace/Afara
bash scripts/cloud-install.sh
npm run dev
```

На другом компьютере: `npm ci`; скопировать `.env.example` в `.env.local`, сгенерировать уникальный `PAYLOAD_SECRET` (`openssl rand -hex 32`), заполнить локальные параметры SMTP из примера, затем `docker compose up -d --wait`, `npm run seed:dev`, `npm run dev`. В development почта доставляется только в локальный Mailpit, не внешнему получателю. База доступна только через loopback и не предназначена для production.

Первый владелец создаётся **приватно в терминале**: `npm run create:admin`. Команда запрашивает email и скрытый пароль, отказывается создавать второго владельца. Общего логина/пароля нет. После этого открыть маршрут `/admin` своего запущенного приложения. Публичный first-register заблокирован.

Основной сайт — `/`; семь development-страниц. При отсутствии юридических документов форма честно блокирует реальную отправку. Контакты по просьбе владельца пусты. Изображения — подписанные ИИ-концепции, временные до загрузки исходников владельца. Seed повторяемый и не перезаписывает уже существующее наполнение; в production запрещён.

Worker запускается отдельным процессом: `npm run worker`. Заявка и задание уведомления хранятся одной строкой в PostgreSQL; отсутствие worker не теряет данные. В облаке Mailpit API используется тестами по loopback, публичного почтового сервиса ещё нет.

## Проверки

```bash
npm run typecheck
npm run lint
npm run build
npm run start
# В другом терминале, при работающем приложении, PostgreSQL и Mailpit:
npm test
npm run test:e2e
```

Интеграционные тесты допускаются только с `AFARA_STAGE=development` и на **изолированной базе разработки без реальных заявок**: временно создают синтетические документы, пользователей и обращение, затем удаляют их. Не направлять тесты на рабочую среду. Chromium в облачной машине: `/usr/bin/chromium`; на другом компьютере изменить `PLAYWRIGHT_CHROMIUM_EXECUTABLE` либо установить браузер Playwright. Скриншоты в `docs/screenshots`. Не запускать build и dev одновременно в одной `.next` и перезапускать сервер после изменения зависимостей.

## Структура

- `src/app/(frontend)` — серверные страницы, форма, узкие API заявок/экспорта/readiness.
- `src/app/(payload)` — штатные маршруты Payload, одна админка.
- `src/payload.config.ts`, `src/cms` — коллекции, роли, версии, загрузки.
- `src/lib/notifications.ts`, `scripts/worker.ts` — постоянная очередь SMTP с атомарным lease.
- `src/migrations` — сгенерированная и проверенная начальная миграция.
- `compose.yaml` — только development; `compose.production.yaml`, `Dockerfile` — переносимое размещение.

Детали и границы готовности: [QA_REPORT.md](QA_REPORT.md), [DEPLOYMENT.md](DEPLOYMENT.md), [CONTENT_REQUIRED.md](CONTENT_REQUIRED.md), [ADMIN_GUIDE.md](ADMIN_GUIDE.md).
