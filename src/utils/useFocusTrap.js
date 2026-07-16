import { useRef, useEffect } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prev = document.activeElement
    // Move focus into the dialog if not already inside
    if (!el.contains(document.activeElement)) {
      const first = el.querySelector(FOCUSABLE)
      first ? first.focus() : el.focus()
    }
    function onKey(e) {
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first || !el.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last || !el.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      try {
        if (prev?.isConnected) prev.focus()
        else (document.querySelector('[data-focusreturn]') ?? document.body)?.focus()
      } catch (_) {}
    }
  }, [])
  return ref
}
