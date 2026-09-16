'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}

interface SidePanelProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: string
}

function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onClose])
}

// Keeps the element mounted for `duration`ms after `open` goes false so the
// exit transition can finish before React removes it from the DOM.
function useDelayedUnmount(open: boolean, duration = 200) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setMounted(true)
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      requestAnimationFrame(() => setVisible(false))
      timer.current = setTimeout(() => setMounted(false), duration)
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [open, duration])

  return { mounted, visible }
}

/*
  Centered dialog. Rendered in a portal on <body> so `position: fixed` always
  means the whole viewport — inside the app shell, the page-enter animation's
  transform would otherwise make the content area the containing block and the
  backdrop would stop at the sidebar / top bar.
*/
export function Modal({ open, onClose, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEscapeKey(open, onClose)
  const { mounted, visible } = useDelayedUnmount(open, 180)

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.62 : 0})`,
        backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
        WebkitBackdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
        transition: 'background-color 180ms ease, backdrop-filter 180ms ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidth} bg-card border border-border-strong rounded-xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
          transition: 'opacity 180ms ease, transform 180ms ease',
          boxShadow: 'var(--shadow-modal)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Slides in from the right edge of the nearest positioned ancestor (the calendar
// body) — intentionally not a portal, it belongs to that area. On phones it
// covers most of the width but leaves a strip on the left to tap to close.
export function SidePanel({ open, onClose, children, width = 'w-[85%] max-w-sm sm:w-80' }: SidePanelProps) {
  useEscapeKey(open, onClose)
  const { mounted, visible } = useDelayedUnmount(open, 200)

  if (!mounted) return null

  return (
    <>
      <div
        className="absolute inset-0 z-30"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        className={`absolute right-0 top-0 bottom-0 ${width} z-40 bg-card border-l border-border-strong flex flex-col`}
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {children}
      </div>
    </>
  )
}
