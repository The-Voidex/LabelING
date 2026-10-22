import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { cx } from '../lib/cx.ts'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-[#6e9aff] active:bg-[#4f7ee6] border border-[#6e9aff]/40 shadow-[0_4px_16px_rgba(91,140,255,0.18)]',
  secondary:
    'bg-panel-2 text-ink hover:bg-panel-3 border border-border hover:border-border-strong',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-panel-2 border border-transparent',
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-9.5 w-full rounded-lg border border-border bg-panel px-3 text-sm text-ink',
        'placeholder:text-faint outline-none transition-colors',
        'focus:border-accent/70 focus:ring-2 focus:ring-accent/15',
        className,
      )}
      {...rest}
    />
  )
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-ink',
        'placeholder:text-faint outline-none transition-colors resize-y',
        'focus:border-accent/70 focus:ring-2 focus:ring-accent/15',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'h-9.5 w-full rounded-lg border border-border bg-panel px-3 text-sm text-ink',
        'outline-none transition-colors focus:border-accent/70 focus:ring-2 focus:ring-accent/15',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-relaxed text-faint">{hint}</span> : null}
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </label>
  )
}

interface DialogProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'dialog-pop relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl',
          'border border-border-strong bg-panel shadow-panel',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border bg-panel/60 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{cancelText}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{message}</div>
    </Dialog>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-accent" />
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? <div className="text-faint">{icon}</div> : null}
      <div className="text-sm font-medium text-ink">{title}</div>
      {description ? (
        <div className="max-w-md text-xs leading-relaxed text-muted">{description}</div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
        checked
          ? 'border-accent/50 bg-accent'
          : 'border-border-strong bg-panel-3',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}
