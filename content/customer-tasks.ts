import type { Page } from '../src/payload-types'

export const customerTasksAnchor = 'your-task'
export const customerTasks = [
  { id: 'finish', title: 'Завершить интерьер после ремонта', body: 'Подобрать текстиль для повседневной жизни: приватность, дневной свет и ощущение завершённого пространства. Начать с задачи комнаты, а не с бесконечного выбора тканей.', linkLabel: 'Обсудить мою задачу' },
  { id: 'fit', title: 'Разобраться с нишей и сложным окном', body: 'Проверить исходные данные для карниза, нескольких слоёв или высокого остекления. Согласовать конструкцию до изготовления, без универсального размера для любого окна.', linkLabel: 'Обсудить конструкцию' },
  { id: 'light', title: 'Управлять светом в спальне', body: 'Обсудить затемнение, дневной свет и просветы у краёв окна. Выбрать сочетание ткани и системы под нужный сценарий, не полагаясь только на слово blackout.', linkLabel: 'Обсудить затемнение' },
  { id: 'look', title: 'Согласовать оттенок и фактуру', body: 'Связать текстиль с отделкой и мебелью. Рассмотреть матовость, пластичность и сочетание слоёв; окончательный выбор подтвердить по образцу при реальном освещении.', linkLabel: 'Обсудить образцы' },
] as const

export function customerTasksSection(): NonNullable<Page['sections']>[number] {
  return { kind: 'details', anchor: customerTasksAnchor, visible: true, kicker: '/ Ваша задача', heading: 'С чего начнём ваш проект?', body: 'Выберите то, что важно сейчас. Задача перейдёт в форму, где её можно дополнить своими словами. Если описание уже заполнено, оно сохранится.', cards: customerTasks.map(({ title, body, linkLabel }) => ({ title, body, linkLabel })) }
}
export function customerTaskBrief(title: string, body?: string | null): string { return `Хочу обсудить: ${title}. ${body || ''}`.trim().slice(0, 500) }
