# Карта редактирования AFARA

| Публичные данные | Источник Payload |
|---|---|
| Название, подпись бренда | Сайт и контакты: `brand`, `tagline` |
| Телефон/email/адрес/география/часы | `site.phone/email/address/geography/hours` (единый источник для всех страниц) |
| Якорное меню | `site.menu[].label/anchor`; скрытые блоки исключаются из меню главной |
| Группы «Пространства» и дочерние ссылки | Опубликованные `pages` с `type=overview` и `parent` |
| H1, вводный текст, название меню | `pages.h1/intro/title` |
| URL и шаблон | `pages.path/type/parent`; название не меняет URL, при публикации нового пути создаётся постоянный HTTP 308 через связь на ID |
| Hero и мобильный кадр | `pages.hero/heroMobile/heroPosition` |
| Статус иллюстрации и CTA | `pages.conceptLabel/cta/detailsLabel` |
| Рубрики, заголовки и тексты секций | `pages.sections[].kicker/heading/body` |
| Порядок/видимость/якоря | Порядок `sections`, `visible`, `anchor` |
| Карточки/этапы/условия/FAQ | `sections[].cards[].title/body/image/page/linkLabel` |
| Материалы | Секция `kind=materials`, поля `heading/body/image` |
| Alt и подпись медиа | Контекстный alt: `pages.heroAlt`, `sections.imageAlt`, `sections.cards.imageAlt`; fallback `media.alt/caption`; происхождение `media.origin`, закрытый источник `source`, подтверждение `rightsConfirmed` |
| Заголовок и пояснение формы, этапы, поля, кнопки, ошибка и успех | `site.form`; объектные варианты `site.form.spaces` |
| Правовые документы | `documents.title/slug/body/kind/version`, версии/черновики |
| Footer | `site.footerText`; ссылки строятся по опубликованным документам |
| Title/description | `pages.seo`, fallback на `h1/intro` |
| Получатель уведомлений | Закрытые настройки `notifications.recipient`, только ADMIN |

Автоматически вычисляются: крошки, ссылки на родителя, canonical/sitemap, номер этапа, размеры изображений, `tel:`/`mailto:`, идентификатор и время заявки, версия опубликованного согласия. Неподтверждённые направления не выводятся.

Технические строки интерфейса пока в коде: skip-link, кнопки открытия/закрытия меню, «Согласие», «политика обработки данных», placeholder выбора объекта/бюджета, состояния загрузки/404/неопубликованной формы, метка предпросмотра. Обычный редакционный контент находится в CMS. Перевод этих служебных надписей и брендированные favicon/логотип — отдельный пункт доводки после предоставления исходников.
