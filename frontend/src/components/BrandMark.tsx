import { cx } from '../lib/cx.ts'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cx('shrink-0', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="15" fill="#27241E" />
      <path
        d="M14 9h27l9 9v33a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z"
        fill="#F8F2E5"
      />
      <path d="M41 9l9 9h-6a3 3 0 0 1-3-3V9Z" fill="#E8DAC2" />
      <circle cx="30" cy="37" r="13" fill="none" stroke="#2A2721" strokeWidth="4.4" />
      <path d="M40.86 20.76 53.81 7.81l5.38 5.38-12.95 12.95Z" fill="#E8A33C" />
      <path d="M40.86 20.76 53.81 7.81l2.69 2.69-12.95 12.95Z" fill="#F2B95B" />
      <path d="M40.58 26.42 39.8 25.64 37.9 29.1l2.68-2.68Z" fill="#2A2721" />
      <path d="M40.58 26.42 43.55 23.45 40.86 20.76 39.8 25.64Z" fill="#EBC58E" />
      <path d="M53.81 7.81 59.19 13.19 57.05 15.33 51.67 9.95Z" fill="#D97757" />
    </svg>
  )
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-3', className)}>
      <BrandMark className="h-10 w-10 drop-shadow-[0_8px_18px_rgba(39,35,29,0.2)]" />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-semibold tracking-[-0.035em] text-ink">
          LabelING<span className="text-accent">.</span>
        </span>
        <span className="mt-1 text-[10px] tracking-[0.16em] text-faint">本地图像标注</span>
      </span>
    </span>
  )
}
