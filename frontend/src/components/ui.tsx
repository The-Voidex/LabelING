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
    'border border-accent bg-accent text-white shadow-[0_10px_24px_-16px_rgba(193,79,46,0.8)] hover:bg-accent-hover active:bg-accent-hover',
  secondary:
    'border border-border bg-panel text-ink shadow-[0_1px_2px_rgba(39,35,29,0.04)] hover:border-border-strong hover:bg-panel-2/70',
  ghost: 'border border-transparent text-muted hover:bg-panel-2/80 hover:text-ink',
  danger:
    'border border-danger/25 bg-danger/8 text-danger hover:border-danger/35 hover:bg-danger/12',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-9 gap-2 rounded-[10px] px-4 text-sm',
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
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow] duration-150',
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
        'h-9 w-full rounded-lg border border-border bg-panel px-3 text-sm text-ink shadow-[inset_0_1px_1px_rgba(39,35,29,0.03)]',
        'placeholder:text-faint outline-none transition-[border-color,box-shadow]',
        'focus:border-accent/70 focus:ring-2 focus:ring-accent/12',
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
        'w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-sm leading-relaxed text-ink shadow-[inset_0_1px_1px_rgba(39,35,29,0.03)]',
        'placeholder:text-faint outline-none transition-[border-color,box-shadow]',
        'focus:border-accent/70 focus:ring-2 focus:ring-accent/12',
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
        'h-9 w-full cursor-pointer rounded-lg border border-border bg-panel px-3 text-sm text-ink shadow-[inset_0_1px_1px_rgba(39,35,29,0.03)]',
        'outline-none transition-[border-color,box-shadow] focus:border-accent/70 focus:ring-2 focus:ring-accent/12',
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
      <span className="text-xs font-medium text-ink/85">{label}</span>
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
        className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'dialog-pop relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[20px]',
          'border border-border-strong/80 bg-panel shadow-panel',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/80 px-6 py-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">{description}</p>
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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border/80 bg-panel-2/45 px-6 py-4">
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
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong/80 bg-panel/40 px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-panel text-accent/75 shadow-card">
          {icon}
        </div>
      ) : null}
      <div className="text-sm font-semibold text-ink">{title}</div>
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

export function Kbd({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cx(
        'inline-flex min-w-5 items-center justify-center rounded-[5px] border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted shadow-[0_1px_0_rgba(39,35,29,0.06)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
