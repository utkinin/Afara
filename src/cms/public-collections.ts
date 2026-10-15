import { APIError, type CollectionConfig, type Where } from 'payload'
import { admin, staff, published, publicationGuard } from './access'
import { publicContactText } from './contact-knowledge'

const drafts = { drafts: true, maxPerDoc: 30 } as const

export const Knowledge: CollectionConfig = {
  slug: 'knowledge', labels: { singular: 'Материал знаний', plural: 'Публичная база знаний' },
  admin: { useAsTitle: 'question', group: 'Контент', description: 'Только проверенные публичные ответы. Они показываются на связанной странице и доступны консультанту после одобрения и публикации ADMIN.' },
  versions: drafts,
  access: { create: staff, read: async args => {
    const allowed = await published(args)
    const filter: Where = { and: [{ _status: { equals: 'published' } }, { approved: { equals: true } }, { 'page._status': { equals: 'published' } }] }
    return allowed === true ? true : filter
  }, update: staff, delete: admin },
  fields: [
    { name: 'question', label: 'Вопрос / название', type: 'text', required: true },
    { name: 'answer', label: 'Публичный ответ', type: 'textarea', required: true, maxLength: 2400, admin: { description: 'Служебная тема contacts обновляется из опубликованных настроек «Сайт и контакты»; не дублируйте контакты в других ответах.' } },
    { name: 'topic', label: 'Ключ темы', type: 'text', required: true, index: true, admin: { description: 'Например cost или bedroom-darkness. Разные ответы с одним ключом считаются противоречием: консультант попросит уточнить.' }, validate: (v: string | null | undefined) => Boolean(v && /^[a-z0-9-]{2,80}$/.test(v)) || 'Латиница, цифры и дефисы, 2–80 символов' },
    { name: 'keywords', label: 'Поисковые синонимы', type: 'text', maxLength: 500 },
    { name: 'page', label: 'Публичная страница-источник', type: 'relationship', relationTo: 'pages', required: true, filterOptions: { _status: { equals: 'published' } } },
    { name: 'approved', label: 'Проверено для публичной базы консультанта', type: 'checkbox', defaultValue: false, access: { create: admin, update: admin } },
  ],
  hooks: { beforeChange: [publicationGuard, async ({ data, originalDoc, req }) => {
    // Editing an approved answer requires a new explicit review, even for ADMIN.
    const changed = ['question', 'answer', 'topic', 'keywords', 'page'].some(key => key in data && data[key] !== originalDoc?.[key])
    if (changed && originalDoc && data.approved !== true) data.approved = false
    if (data._status === 'published') {
      if (!(data.approved ?? originalDoc?.approved)) throw new APIError('Сначала проверьте и одобрите публичный ответ', 400)
      if ((data.topic ?? originalDoc?.topic) === 'contacts') {
        const site = await req.payload.findGlobal({ slug: 'site', draft: false, depth: 0, req })
        if (site._status !== 'published' || (data.answer ?? originalDoc?.answer) !== publicContactText(site)) throw new APIError('Контакты изменяются в разделе «Сайт и контакты». Ответ должен совпадать с опубликованными сведениями.', 400)
      }
      const source = await req.payload.findByID({ collection: 'pages', id: data.page ?? originalDoc?.page, depth: 0, overrideAccess: false, req })
      if (source._status !== 'published' && (originalDoc?._status !== 'published' || data.page !== undefined && data.page !== originalDoc?.page)) throw new APIError('Источник должен быть опубликован', 400)
    }
    return data
  }] },
}

export const ShortLinks: CollectionConfig = {
  slug: 'short-links', labels: { singular: 'Короткая ссылка', plural: 'Короткие ссылки' },
  admin: { useAsTitle: 'slug', group: 'Контент', description: 'Управляемые ссылки /s/имя. Только внутренние опубликованные страницы; временное перенаправление 302.' },
  access: { create: admin, read: admin, update: admin, delete: admin },
  fields: [
    { name: 'slug', label: 'Короткое имя', type: 'text', required: true, unique: true, index: true, validate: (v: string | null | undefined) => Boolean(v && /^[a-z0-9][a-z0-9-]{0,47}$/.test(v)) || '1–48 символов: латиница, цифры и дефис' },
    { name: 'target', label: 'Опубликованная страница', type: 'relationship', relationTo: 'pages', filterOptions: { _status: { equals: 'published' } }, admin: { description: 'Обязательна для включённой ссылки. После удаления страницы ссылка перестаёт перенаправлять, и назначение можно выбрать заново.' } },
    { name: 'enabled', label: 'Ссылка включена', type: 'checkbox', defaultValue: true },
    { name: 'share', type: 'ui', admin: { components: { Field: '/src/cms/ShareShortLink#default' } } },
  ],
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    if (data.enabled ?? originalDoc?.enabled ?? true) {
      const targetId = data.target !== undefined ? data.target : originalDoc?.target
      if (!targetId) throw new APIError('Выберите опубликованную страницу', 400)
      const target = await req.payload.findByID({ collection: 'pages', id: targetId, depth: 0, overrideAccess: false, req })
      if (target._status !== 'published') throw new APIError('Можно выбрать только опубликованную страницу', 400)
    }
    return data
  }] },
}

export const Works: CollectionConfig = {
  slug: 'works', labels: { singular: 'Реальная работа', plural: 'Реальные работы' },
  admin: { useAsTitle: 'title', group: 'Контент', description: 'Подтверждённые выполненные работы AFARA. Концепции остаются в блоках страниц и не становятся кейсами.' },
  versions: drafts, access: { create: staff, read: published, update: staff, delete: admin },
  fields: [
    { name: 'title', label: 'Название', type: 'text', required: true },
    { name: 'task', label: 'Задача заказчика', type: 'textarea', required: true },
    { name: 'space', label: 'Особенности пространства', type: 'textarea', required: true },
    { name: 'solution', label: 'Принятое решение и результат', type: 'textarea', required: true },
    { name: 'photos', label: 'Фотографии результата', type: 'array', minRows: 1, required: true, fields: [{ name: 'image', label: 'Реальная работа', type: 'upload', relationTo: 'media', required: true, filterOptions: { and: [{ origin: { equals: 'work' } }, { _status: { equals: 'published' } }] } }] },
    { name: 'verified', label: 'Сведения о работе и разрешение клиента проверены', type: 'checkbox', defaultValue: false, access: { create: admin, update: admin } },
  ],
  hooks: { beforeChange: [publicationGuard, async ({ data, originalDoc, req }) => {
    if (data._status === 'published') {
      if (!(data.verified ?? originalDoc?.verified)) throw new APIError('Подтвердите сведения и разрешение на публикацию', 400)
      for (const photo of data.photos ?? originalDoc?.photos ?? []) {
        const m = await req.payload.findByID({ collection: 'media', id: photo.image, depth: 0, req, overrideAccess: false })
        if (m.origin !== 'work' || m._status !== 'published' || !m.rightsConfirmed) throw new APIError('Кейс должен содержать опубликованные фотографии реальной работы с подтверждёнными правами', 400)
      }
    }
    return data
  }] },
}
