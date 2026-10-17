'use client'
import { useEffect } from 'react'

export function MaterialStudyEnhancer({ id }: { id: string }) {
  useEffect(() => {
    const root = document.getElementById(id)
    if (!root) return
    let disposed = false, stop: (() => void) | undefined
    const start = async () => {
      observer?.disconnect()
      const { initMaterialStudy } = await import('../lib/material-study-controls')
      if (!disposed) stop = initMaterialStudy(root)
    }
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) void start() }, { rootMargin: '500px' }) : null
    if (observer) observer.observe(root)
    else void start()
    return () => { disposed = true; observer?.disconnect(); stop?.() }
  }, [id])
  return null
}
