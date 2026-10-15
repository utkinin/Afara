import type { Field } from 'payload'
export const picture: Field = { name: 'image', label: 'Изображение', type: 'upload', relationTo: 'media' }
export const sections: Field = {
  name: 'sections', label: 'Содержательные блоки (порядок отображения)', type: 'array', fields: [
    { name: 'kind', label: 'Шаблон', type: 'select', required: true, options: [
      {label:'Пространства',value:'spaces'}, {label:'Композиции',value:'compositions'}, {label:'Разбор решения',value:'details'},
      {label:'Материалы',value:'materials'}, {label:'Процесс',value:'process'}, {label:'Условия',value:'conditions'}, {label:'Вопросы и ответы',value:'faq'},
    ] },
    { name: 'visible', label: 'Показывать блок', type: 'checkbox', defaultValue: true },
    { name: 'anchor', label: 'Якорь (латиница)', type: 'text', validate: (v: string | null | undefined) => !v || /^[a-z][a-z0-9-]*$/.test(v) || 'Используйте латиницу и дефис' },
    { name: 'kicker', label: 'Рубрика', type: 'text' },
    { name: 'heading', label: 'Заголовок', type: 'text', required: true },
    { name: 'body', label: 'Текст', type: 'textarea' }, picture,
    {name:'imageAlt',label:'Описание изображения в этом блоке',type:'text'},
    { name: 'cards', label: 'Карточки / этапы / вопросы', type: 'array', fields: [
      {name:'title',label:'Заголовок',type:'text',required:true}, {name:'body',label:'Текст',type:'textarea'}, picture,
      {name:'imageAlt',label:'Описание изображения в этой карточке',type:'text'},
      {name:'page',label:'Ссылка на страницу',type:'relationship',relationTo:'pages'},
      {name:'linkLabel',label:'Подпись ссылки',type:'text'},
    ] },
  ],
}
export const seo: Field = { name: 'seo', label: 'Поиск и социальные сети', type: 'group', fields: [
  {name:'title',label:'Заголовок страницы',type:'text'}, {name:'description',label:'Описание',type:'textarea'},
] }
