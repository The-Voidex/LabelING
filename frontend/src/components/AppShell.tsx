import { NavLink, Outlet } from 'react-router-dom'
import { Cpu, FolderKanban } from 'lucide-react'
import { BrandLockup, BrandMark } from './BrandMark.tsx'
import { ServiceStatusButton } from './ServiceDialog.tsx'
import { cx } from '../lib/cx.ts'

const NAV_ITEMS = [
  { to: '/', label: '项目', hint: '数据集与标注', icon: FolderKanban, end: true },
  { to: '/models', label: '模型设置', hint: '预标注服务', icon: Cpu, end: false },
]

export function AppShell() {
  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-border/80 bg-panel/55 px-4 py-5 backdrop-blur-xl md:flex">
        <NavLink to="/" className="px-1.5">
          <BrandLockup />
        </NavLink>

        <nav className="mt-9 flex flex-col gap-1">
          <div className="px-3 pb-2 text-[10px] font-medium tracking-[0.14em] text-faint">
            工作区
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                    isActive
                      ? 'border-border/90 bg-panel text-ink shadow-card'
                      : 'border-transparent text-muted hover:bg-panel/65 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-accent-soft text-accent'
                          : 'bg-panel-2/70 text-muted group-hover:text-ink',
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] text-faint">{item.hint}</span>
                    </span>
                    {isActive ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    ) : null}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <div className="rounded-xl border border-border/70 bg-panel/45 px-3.5 py-3">
            <div className="text-[10px] font-medium text-muted">数据留在本机</div>
            <p className="mt-1 text-[10px] leading-relaxed text-faint">
              图片、密钥与标注均保存在 data 目录，建议定期整目录备份。
            </p>
          </div>
          <ServiceStatusButton />
          <p className="px-1 text-[10px] text-faint">LabelING · 本地版 1.1</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/80 bg-bg/85 px-5 backdrop-blur-xl md:hidden">
          <NavLink to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8" />
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-ink">
              LabelING<span className="text-accent">.</span>
            </span>
          </NavLink>
          <nav className="ml-auto flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-panel text-ink shadow-card'
                        : 'text-muted hover:bg-panel/70 hover:text-ink',
                    )
                  }
                >
                  <Icon size={14} />
                  {item.label}
                </NavLink>
              )
            })}
            <ServiceStatusButton compact />
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1560px] flex-1 px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
