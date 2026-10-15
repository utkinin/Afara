import { buildConfig, APIError, type CollectionConfig, type GlobalConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { ru } from '@payloadcms/translations/languages/ru'
import sharp from 'sharp'
import nodemailer from 'nodemailer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { admin, staff, published, publicationGuard, globalGuard } from './cms/access'
import { sections, seo } from './cms/fields'

const drafts = { drafts: true, maxPerDoc: 30 } as const
const preview = (data: Record<string, unknown>) => `${process.env.APP_URL || 'http://localhost:3000'}/preview?page=${data.id}`
const auditHook: NonNullable<CollectionConfig['hooks']>['afterChange'] = [async ({ req, doc, collection, operation }) => {
  if (!req.user || req.context.skipAudit) return
  await req.payload.create({ collection: 'audit', req, context: {skipAudit:true}, data: {
    actor: String(req.user.id), action: operation, object: `${collection.slug}:${doc.id}`, version: doc.updatedAt,
  } })
}]
const Users: CollectionConfig = {
  slug: 'users', labels:{singular:'Пользователь',plural:'Пользователи'},
  auth: { maxLoginAttempts: 5, lockTime: 15 * 60 * 1000, tokenExpiration: 60 * 60 * 4, useSessions: true, cookies:{secure:process.env.AFARA_STAGE==='production',sameSite:'Lax'} },
  admin: { useAsTitle:'email', group:'Доступ' },
  access: { create: admin, read: admin, update: admin, delete: admin, admin: staff },
  fields:[{name:'role',label:'Роль',type:'select',required:true,defaultValue:'EDITOR',options:['ADMIN','EDITOR'],access:{create:admin,update:admin}},
    {name:'name',label:'Имя',type:'text'}],
  hooks: {
    beforeLogin:[async ({req,user})=> {
      if (process.env.AFARA_STAGE === 'production') {
        const { verifyAccess } = await import('./lib/gateway')
        const identity = await verifyAccess(req.headers)
        if (!identity || identity.email !== user.email) throw new APIError('Вход недоступен',403)
      }
      return user
    }],
    afterLogin:[async ({req,user})=>{await req.payload.create({collection:'audit', data:{actor:String(user.id),action:'login',object:'session'}})}],
    beforeChange:[({data,originalDoc,req})=>{if(req.user&&originalDoc&&data.role&&data.role!==originalDoc.role)data.sessions=[];return data}],
    afterChange: auditHook,
  },
}
const Media: CollectionConfig = {
  slug:'media', labels:{singular:'Изображение',plural:'Медиабиблиотека'}, admin:{useAsTitle:'alt',group:'Контент'},
  access:{create:staff,read:published,update:({req})=>req.user?.role==='ADMIN'?true:req.user?{_status:{not_equals:'published'}}:false,delete:admin},
  versions:drafts,
  upload:{staticDir:path.resolve(process.env.MEDIA_DIR||'media'), mimeTypes:['image/jpeg','image/png','image/webp'],
    adminThumbnail:'thumb', imageSizes:[{name:'thumb',width:480,formatOptions:{format:'webp',options:{quality:76}}}, {name:'tablet',width:960,formatOptions:{format:'webp',options:{quality:80}}}, {name:'wide',width:1600,formatOptions:{format:'webp',options:{quality:82}}}],
    formatOptions:{format:'webp',options:{quality:84}}, resizeOptions:{width:2000,withoutEnlargement:true},
  },
  fields:[{name:'alt',label:'Описание изображения',type:'text',required:true}, {name:'caption',label:'Подпись',type:'text'},
    {name:'origin',label:'Происхождение',type:'select',required:true,options:[{label:'Работа AFARA',value:'work'},{label:'Концепция',value:'concept'},{label:'ИИ-визуализация',value:'ai'}]},
    {name:'source',label:'Источник и основание прав',type:'textarea',required:true,access:{read:staff}},
    {name:'rightsConfirmed',label:'Права на публикацию подтверждены',type:'checkbox',required:true,defaultValue:false},
  ],
  hooks:{beforeOperation:[async ({args,operation})=>{
    if ((operation==='create'||operation==='update') && args.req.file) {
      const file=args.req.file
      if (file.size>20*1024*1024) throw new APIError('Файл превышает 20 МБ',400)
      try {
        const image=sharp(file.data,{limitInputPixels:50_000_000,failOn:'error',animated:false})
        const meta=await image.metadata()
        if (!['jpeg','png','webp'].includes(meta.format||'') || (meta.pages||1)>1) throw new Error('format')
        const data=await image.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer()
        args.req.file={...file,data,size:data.length,mimetype:'image/webp',name:`${randomUUID()}.webp`}
      } catch { throw new APIError('Не удалось прочитать изображение. Используйте JPEG, PNG или WebP до 50 мегапикселей.',400) }
    }
    return args
  }],beforeChange:[publicationGuard,({data})=>{
    if(data._status==='published'&&!data.rightsConfirmed) throw new APIError('Подтвердите права на изображение',400)
    return data
  }],beforeDelete:[async ({req,id})=>{
    const used=await req.payload.find({collection:'pages',where:{or:[{hero:{equals:id}},{'sections.image':{equals:id}},{'sections.cards.image':{equals:id}}]},limit:1,req})
    if(used.totalDocs) throw new APIError('Изображение связано со страницей. Сначала удалите ссылки и проверьте историю версий.',409)
    // Retained versions can also reference old media; deletion is deliberately conservative.
    throw new APIError('Физическое удаление медиа отключено: архивируйте запись. Очистка требует проверки сохранённых версий.',409)
  }],afterChange:auditHook},
}
const Pages: CollectionConfig = {
  slug:'pages',labels:{singular:'Страница',plural:'Страницы'},admin:{useAsTitle:'title',group:'Контент',preview},versions:drafts,
  access:{create:staff,read:published,update:staff,delete:admin},
  fields:[
    {name:'title',label:'Название в меню',type:'text',required:true},
    {name:'path',label:'Путь (home для главной)',type:'text',required:true,unique:true,index:true,validate:(v: string | null | undefined)=>Boolean(v && /^(home|[a-z0-9-]+(?:\/[a-z0-9-]+)*)$/.test(v))||'Латинские буквы, цифры, дефис; без начального /'},
    {name:'type',label:'Шаблон',type:'select',required:true,options:['home','overview','direction']},
    {name:'parent',label:'Родительская страница',type:'relationship',relationTo:'pages'},
    {name:'h1',label:'Основной заголовок',type:'text',required:true},
    {name:'intro',label:'Вводный текст',type:'textarea'},
    {name:'hero',label:'Первый экран',type:'upload',relationTo:'media'},
    {name:'heroMobile',label:'Отдельный мобильный кадр (необязательно)',type:'upload',relationTo:'media'},
    {name:'heroAlt',label:'Описание hero на этой странице',type:'text'},
    {name:'heroPosition',label:'Фокус изображения (%)',type:'number',min:0,max:100,defaultValue:65},
    {name:'cta',label:'Основная кнопка',type:'text',required:true,defaultValue:'Обсудить проект'},
    {name:'detailsLabel',label:'Ссылка к деталям',type:'text',defaultValue:'Рассмотреть детали'},
    {name:'conceptLabel',label:'Статус иллюстрации',type:'text'},sections,seo,
  ],
  hooks:{beforeChange:[publicationGuard,async ({data,req,originalDoc})=>{
    if(data.path&&data.path!=='home'&&/^(admin|api|preview|documents|robots\.txt|sitemap\.xml)(\/|$)/.test(data.path))throw new APIError('Этот путь зарезервирован приложением',400)
    if(data.path&&data.path!==originalDoc?.path){const alias=await req.payload.find({collection:'redirects',where:{from:{equals:data.path}},req,depth:0,limit:1});if(alias.docs.length&&alias.docs[0].target!==originalDoc?.id)throw new APIError('Этот адрес уже принадлежит другой странице',409)}
    if(data._status==='published') {
      const ids=new Set<number>()
      const add=(value:unknown)=>{if(typeof value==='number')ids.add(value);else if(value&&typeof value==='object'&&'id' in value)ids.add(Number(value.id))}
      add(data.hero);add(data.heroMobile)
      for(const s of data.sections||[]){add(s.image);for(const c of s.cards||[])add(c.image)}
      for(const id of ids){const m=await req.payload.findByID({collection:'media',id,req,depth:0});if(m._status!=='published'||!m.rightsConfirmed)throw new APIError('Сначала опубликуйте изображения с подтверждёнными правами',400)}
    }
    return data
  }],afterChange:[async({doc,previousDoc,req})=>{
    if(doc._status==='published'&&previousDoc?.path&&doc.path!==previousDoc.path){
      const alias=await req.payload.find({collection:'redirects',where:{from:{equals:previousDoc.path}},req,depth:0,limit:1})
      if(!alias.docs.length)await req.payload.create({collection:'redirects',req,data:{from:previousDoc.path,target:doc.id}})
    }
  },...(auditHook||[])],beforeDelete:[async({req,id})=>{const aliases=await req.payload.count({collection:'redirects',where:{target:{equals:id}},req});if(aliases.totalDocs)throw new APIError('Сначала удалите перенаправления на эту страницу',409)}]},
}
const Redirects:CollectionConfig={slug:'redirects',labels:{singular:'Перенаправление',plural:'Перенаправления'},admin:{group:'Контент'},access:{create:()=>false,read:admin,update:()=>false,delete:admin},fields:[{name:'from',label:'Прежний адрес',type:'text',required:true,unique:true},{name:'target',label:'Страница',type:'relationship',relationTo:'pages',required:true}]}
const Documents: CollectionConfig = {
  slug:'documents',labels:{singular:'Документ',plural:'Документы'},admin:{useAsTitle:'title',group:'Контент'},versions:drafts,
  access:{create:admin,read:published,update:admin,delete:admin},
  fields:[{name:'slug',label:'Адрес',type:'text',unique:true,required:true},{name:'title',label:'Заголовок',type:'text',required:true},
    {name:'body',label:'Текст (абзацы)',type:'textarea',required:true},{name:'version',label:'Версия документа',type:'text',required:true},
    {name:'kind',label:'Тип',type:'select',required:true,options:['privacy','consent']},
  ],hooks:{beforeChange:[publicationGuard,({data,originalDoc})=>{
    if(originalDoc?._status==='published' && data._status==='published' && data.body!==originalDoc.body && data.version===originalDoc.version) throw new APIError('При изменении текста обновите версию документа',400)
    return data
  }],afterChange:auditHook},
}
const Leads: CollectionConfig = {
  slug:'leads', labels:{singular:'Заявка',plural:'Заявки'},admin:{useAsTitle:'name',group:'Заявки',components:{beforeList:['/src/cms/ExportLeads#default']},defaultColumns:['createdAt','name','space','city','status','deliveryStatus']},
  access:{create:()=>false,read:admin,update:admin,delete:admin},
  fields:[
    ...['name','contact','channel','space','city','description','budget','source','consentVersion','consentText','idempotencyKey'].map(name=>({name,label:({name:'Имя',contact:'Контакт',channel:'Способ связи',space:'Объект',city:'Город',description:'Задача',budget:'Бюджет',source:'Источник',consentVersion:'Версия согласия',consentText:'Текст согласия',idempotencyKey:'Ключ отправки'} as Record<string,string>)[name],type:'text' as const,required:!['budget'].includes(name),unique:name==='idempotencyKey',index:name==='idempotencyKey',access:{update:()=>false}})),
    {name:'requestHash',type:'text',required:true,admin:{hidden:true},access:{read:()=>false,update:()=>false}},
    {name:'status',label:'Статус',type:'select',defaultValue:'new',options:[{label:'Новая',value:'new'},{label:'В работе',value:'active'},{label:'Закрыта',value:'closed'},{label:'Спам',value:'spam'}]},
    {name:'archived',label:'Архивировать заявку',type:'checkbox',defaultValue:false,index:true},
    {name:'notes',label:'Внутренние заметки',type:'textarea'},
    {name:'deliveryStatus',label:'Уведомление',type:'select',defaultValue:'pending',options:['pending','processing','sent','failed'],access:{update:()=>false}},
    {name:'attempts',label:'Попытки',type:'number',defaultValue:0,access:{update:()=>false}},
    {name:'retryAt',label:'Следующая попытка',type:'date',access:{update:()=>false}},
    {name:'leaseUntil',label:'Задача занята до',type:'date',access:{update:()=>false}},
    {name:'leaseToken',type:'text',admin:{hidden:true},access:{read:()=>false,update:()=>false}},
    {name:'deliveryError',label:'Ошибка уведомления',type:'text',access:{update:()=>false}},
  ],hooks:{afterChange:auditHook},
}
const Audit: CollectionConfig = {slug:'audit',labels:{singular:'Событие',plural:'Аудит'},admin:{group:'Доступ'},
  access:{create:()=>false,read:admin,update:()=>false,delete:()=>false},fields:[
    {name:'actor',label:'Пользователь (ID)',type:'text'}, {name:'action',label:'Действие',type:'text',required:true}, {name:'object',label:'Объект',type:'text'}, {name:'version',label:'Версия',type:'text'},
  ]}
const RateLimits: CollectionConfig = {slug:'rate-limits',admin:{hidden:true},access:{create:()=>false,read:()=>false,update:()=>false,delete:()=>false},fields:[
  {name:'key',type:'text',unique:true,required:true},{name:'count',type:'number',defaultValue:1},{name:'expiresAt',type:'date',required:true},
]}
const Site: GlobalConfig = {
  slug:'site',label:'Сайт и контакты',versions:{drafts:true,max:30},access:{read:staff,update:staff},hooks:{beforeChange:[globalGuard],afterChange:[async({req,doc})=>{if(req.user)await req.payload.create({collection:'audit',req,data:{actor:String(req.user.id),action:'update-global',object:'site',version:doc.updatedAt}})}]},
  fields:[{name:'brand',label:'Название',type:'text',required:true,defaultValue:'AFARA'}, {name:'tagline',label:'Подпись бренда',type:'text',defaultValue:'BESPOKE ATELIER'},
    {name:'phone',label:'Публичный телефон',type:'text'}, {name:'email',label:'Публичная почта',type:'email'}, {name:'address',label:'Адрес',type:'textarea'},
    {name:'geography',label:'География работы',type:'text'}, {name:'hours',label:'Режим работы',type:'text'},
    {name:'menu',label:'Якорное меню',type:'array',fields:[{name:'label',label:'Подпись',type:'text',required:true},{name:'anchor',label:'Якорь',type:'text',required:true,validate:(v: string | null | undefined)=>Boolean(v&&/^[a-z][a-z0-9-]*$/.test(v))||'Латиница и дефис'}]},
    {name:'form',label:'Форма',type:'group',fields:[
      ...['heading','intro','stepOne','stepTwo','space','city','description','budget','name','channel','phone','email','next','back','submit','success','again','consentLabel','error'].map(name=>({name,label:name,type:'text' as const,required:true})),
      {name:'spaces',label:'Варианты пространства',type:'array',fields:[{name:'label',label:'Название',type:'text',required:true}]},
    ]},
    {name:'footerText',label:'Подпись в подвале',type:'text'},
  ],
}
const Notifications: GlobalConfig = {slug:'notifications',label:'Получатели заявок',access:{read:admin,update:admin},fields:[
  {name:'recipient',label:'Получатель уведомлений',type:'email',required:true},
]}
export default buildConfig({
  secret:process.env.PAYLOAD_SECRET||'', serverURL:process.env.APP_URL||'http://localhost:3000',
  admin:{user:'users',avatar:'default',importMap:{baseDir:path.resolve('.')},meta:{titleSuffix:' — AFARA'}, livePreview:{breakpoints:[{label:'Телефон',name:'mobile',width:390,height:844},{label:'Планшет',name:'tablet',width:768,height:1024},{label:'Компьютер',name:'desktop',width:1440,height:900}]}},
  i18n:{supportedLanguages:{ru},fallbackLanguage:'ru'},
  collections:[Users,Media,Pages,Redirects,Documents,Leads,Audit,RateLimits], globals:[Site,Notifications],
  db:postgresAdapter({pool:{connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000,query_timeout:10000,max:10},push:process.env.AFARA_STAGE==='development',migrationDir:path.resolve('src/migrations')}),
  typescript:{outputFile:path.resolve('src/payload-types.ts')},
  email:nodemailerAdapter({defaultFromAddress:process.env.SMTP_FROM||'afara@example.test',defaultFromName:'AFARA',skipVerify:process.env.AFARA_STAGE==='build',transport:nodemailer.createTransport({host:process.env.SMTP_HOST||'127.0.0.1',port:Number(process.env.SMTP_PORT||1025),secure:process.env.SMTP_PORT==='465',requireTLS:process.env.AFARA_STAGE==='production',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined})}),
  sharp, graphQL:{disable:true}, cors:[],csrf:[process.env.APP_URL||'http://localhost:3000'],
  upload:{limits:{fileSize:20*1024*1024}},
})
