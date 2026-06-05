'use client'

import { useEffect, useRef, useState } from 'react'

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

export function Modal({ open, onClose, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEscapeKey(open, onClose)
  const { mounted, visible } = useDelayedUnmount(open, 180)

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.5 : 0})`,
        backdropFilter: 'blur(4px)',
        transition: 'background-color 180ms ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`w-full ${maxWidth} bg-card border border-border rounded-lg shadow-2xl flex flex-col max-h-[90vh]`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
          transition: 'opacity 180ms ease, transform 180ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function SidePanel({ open, onClose, children, width = 'w-80' }: SidePanelProps) {
  useEscapeKey(open, onClose)
  const { mounted, visible } = useDelayedUnmount(open, 200)

  if (!mounted) return null

  return (
    <>
      <div
        className="fixed inset-0 z-30"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 bottom-0 ${width} z-40 bg-card border-l border-border flex flex-col shadow-2xl`}
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}
      >
        {children}
      </div>
    </>
  )
}
