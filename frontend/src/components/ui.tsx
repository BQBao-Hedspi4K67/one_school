import { type ReactNode, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({ children, variant = 'primary', size = 'medium', loading = false, disabled = false, fullWidth = false, icon, onClick, type = 'button' }: {
  children: ReactNode
  variant?: ButtonVariant
  size?: 'small' | 'medium'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  icon?: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}) {
  return (
    <button className={`button button-${variant} button-${size} ${fullWidth ? 'button-full' : ''}`} type={type} aria-busy={loading} disabled={disabled || loading} onClick={onClick}>
      {loading && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
      {!loading && icon}
      {loading ? 'Đang xử lý...' : children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' }) {
  return <span className={`badge badge-${variant}`}><span className="badge-dot" />{children}</span>
}

export function Input({ label, hint, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className={`input ${error ? 'input-error' : ''}`} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="field-message field-error"><AlertCircle size={14} aria-hidden="true" />{error}</span> : hint ? <span className="field-message">{hint}</span> : null}
    </label>
  )
}

export function Skeleton({ width = '100%' }: { width?: string }) {
  return <span className="skeleton" style={{ width }} aria-hidden="true" />
}

export function EmptyState({ title, description, icon, compact = false }: { title: string; description: string; icon?: ReactNode; compact?: boolean }) {
  return <div className={`state state-empty ${compact ? 'state-compact' : ''}`}><span className="state-icon">{icon ?? <Info size={20} aria-hidden="true" />}</span><strong>{title}</strong><p>{description}</p></div>
}

export function ErrorState({ title, compact = false, onRetry }: { title: string; compact?: boolean; onRetry?: () => void }) {
  return <div className={`state state-error ${compact ? 'state-compact' : ''}`}><span className="state-icon"><AlertCircle size={20} aria-hidden="true" /></span><strong>{title}</strong>{onRetry && <button type="button" className="text-button" onClick={onRetry}>Thử lại</button>}</div>
}

export function Toast({ title, message, variant = 'success', onClose }: { title: string; message: string; variant?: 'success' | 'error' | 'info'; onClose: () => void }) {
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertCircle : Info
  return <div className={`toast toast-${variant}`} role="status"><Icon size={19} aria-hidden="true" /><div><strong>{title}</strong><p>{message}</p></div><button type="button" aria-label="Đóng thông báo" onClick={onClose}><X size={17} aria-hidden="true" /></button></div>
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = closeButtonRef.current?.closest('[role="dialog"]')
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return <div className="modal-layer" role="presentation"><button className="modal-backdrop" type="button" aria-label="Đóng hộp thoại" onClick={onClose} /><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{title}</h2><button ref={closeButtonRef} className="icon-button" type="button" aria-label="Đóng" onClick={onClose}><X size={19} aria-hidden="true" /></button></div>{children}</section></div>
}
