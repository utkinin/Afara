export type StudyChoice = { view: string; fullness: number; layers: number }

export function studyQuestion(choice: StudyChoice): string {
  const fullness = [1.5, 1.7, 2].includes(choice.fullness) ? choice.fullness.toFixed(1).replace('.', ',') : '1,7'
  return `Хочу обсудить образцы и текстильное решение. Просмотр: ${choice.view.slice(0, 80)}. Предварительная сборка: ${fullness}; слоёв: ${choice.layers === 1 ? 1 : 2}. Прошу проверить ткань, конструкцию, карниз и нишу для моего объекта.`
}

export function pleatPath(fullness: number): string {
  const count = fullness < 1.6 ? 7 : fullness < 1.9 ? 9 : 12
  const step = 288 / count
  let path = 'M 6 34'
  for (let i = 0; i < count; i++) {
    const x = 6 + i * step
    path += ` C ${x + step / 4} 8, ${x + step / 4} 60, ${x + step / 2} 34 S ${x + step * 3 / 4} 8, ${x + step} 34`
  }
  return path
}

// Used by both the Next.js island and the static preview. No network API, storage or animation library.
export function initMaterialStudy(root: HTMLElement): () => void {
  if (root.dataset.enhanced === 'true') return () => {}
  root.dataset.enhanced = 'true'
  const views = [...root.querySelectorAll<HTMLTemplateElement>('template[data-ms-view]')]
  const frame = root.querySelector<HTMLElement>('[data-ms-frame]')!
  const caption = root.querySelector<HTMLElement>('[data-ms-caption]')!
  const status = root.querySelector<HTMLElement>('[data-ms-status]')!
  const slider = root.querySelector<HTMLInputElement>('[data-ms-fullness]')!
  const output = root.querySelector<HTMLOutputElement>('[data-ms-output]')!
  const wave = root.querySelector<SVGPathElement>('[data-ms-wave]')!
  const layerSelect = root.querySelector<HTMLSelectElement>('[data-ms-layers]')!
  const dialog = root.querySelector<HTMLDialogElement>('[data-ms-dialog]')!
  const zoom = root.querySelector<HTMLButtonElement>('[data-ms-zoom]')!
  const zoomFrame = root.querySelector<HTMLElement>('[data-ms-zoom-frame]')!
  let current = 0, request = 0, disposed = false
  let removePending = () => {}

  const selectButtons = (index: number) => {
    root.querySelectorAll<HTMLButtonElement>('[data-ms-select]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
  }
  const show = (index: number) => {
    if (!views[index] || index === current && frame.getAttribute('aria-busy') !== 'true') return
    const token = ++request
    removePending()
    selectButtons(index)
    const next = views[index].content.firstElementChild?.cloneNode(true) as HTMLElement | undefined
    const img = next?.querySelector<HTMLImageElement>('img')
    if (!next || !img) { selectButtons(current); return }
    img.loading = 'eager'
    img.fetchPriority = 'auto'
    next.dataset.msPending = 'true'
    next.style.opacity = '0'
    frame.setAttribute('aria-busy', 'true')
    let active = true
    const clear = () => { active = false; img.removeEventListener('load', ready); img.removeEventListener('error', failed) }
    const ready = () => {
      if (!active || disposed || token !== request) return
      clear()
      frame.querySelectorAll('picture').forEach(p => { if (p !== next) p.remove() })
      delete next.dataset.msPending
      next.style.opacity = '1'
      current = index
      caption.textContent = views[index].dataset.caption || ''
      frame.setAttribute('aria-busy', 'false')
      status.textContent = views[index].dataset.title || ''
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof next.animate === 'function') {
        next.animate([{ opacity: 0.6, transform: 'translateX(12px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 320, easing: 'cubic-bezier(0.25,1,0.5,1)' })
      }
    }
    const failed = () => {
      if (!active || disposed || token !== request) return
      clear(); next.remove(); frame.setAttribute('aria-busy', 'false'); selectButtons(current)
      status.textContent = 'Не удалось открыть кадр. Попробуйте ещё раз.'
    }
    img.addEventListener('load', ready, { once: true })
    img.addEventListener('error', failed, { once: true })
    removePending = () => { clear(); if (next.dataset.msPending) next.remove() }
    frame.append(next)
    if (img.complete && img.naturalWidth > 0) ready()
  }
  const draw = () => {
    const fullness = [1.5, 1.7, 2][Number(slider.value)] || 1.7
    const label = fullness.toFixed(1).replace('.', ',')
    output.value = label
    slider.setAttribute('aria-valuetext', label)
    wave.setAttribute('d', pleatPath(fullness))
  }
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-ms-select]')
    if (button && root.contains(button)) show(Number(button.dataset.msSelect))
  }
  const open = () => {
    const picture = views[current]?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined
    if (!picture) return
    const img = picture.querySelector('img')
    if (img) { img.sizes = '(max-width: 1232px) calc(100vw - 72px), 1160px'; img.loading = 'eager' }
    zoomFrame.replaceChildren(picture)
    dialog.showModal()
  }
  const close = () => dialog.close()
  const backdrop = (event: MouseEvent) => { if (event.target === dialog) close() }
  const closed = () => { zoomFrame.replaceChildren(); zoom.focus({ preventScroll: true }) }
  const transfer = (event: Event) => {
    event.preventDefault()
    const question = studyQuestion({ view: views[current]?.dataset.title || 'Нейтральный свет', fullness: [1.5, 1.7, 2][Number(slider.value)], layers: Number(layerSelect.value) })
    const form = document.querySelector<HTMLFormElement>('#consultation form')
    const textarea = form?.querySelector<HTMLTextAreaElement>('textarea')
    if (textarea?.value.trim()) status.textContent = 'Ваш текст в форме сохранён. Параметры можно добавить в описание.'
    // Both forms return to the first step and preserve an existing description. Nothing is sent here.
    window.dispatchEvent(new CustomEvent('afara:question', { detail: question }))
    document.getElementById('consultation')?.scrollIntoView({ behavior: 'auto', block: 'start' })
    if (textarea) textarea.focus({ preventScroll: true })
  }
  const cta = root.querySelector<HTMLElement>('[data-ms-transfer]')!
  const closer = root.querySelector<HTMLElement>('[data-ms-close]')!
  root.addEventListener('click', click)
  slider.addEventListener('input', draw)
  zoom.addEventListener('click', open)
  closer.addEventListener('click', close)
  dialog.addEventListener('click', backdrop)
  dialog.addEventListener('close', closed)
  cta.addEventListener('click', transfer)
  draw()
  return () => {
    disposed = true; request++; removePending()
    root.removeEventListener('click', click); slider.removeEventListener('input', draw)
    zoom.removeEventListener('click', open); closer.removeEventListener('click', close)
    dialog.removeEventListener('click', backdrop); dialog.removeEventListener('close', closed)
    cta.removeEventListener('click', transfer)
    if (dialog.open) dialog.close()
    delete root.dataset.enhanced
  }
}
