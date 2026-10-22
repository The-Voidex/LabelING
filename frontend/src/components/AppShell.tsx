import { NavLink, Outlet } from 'react-router-dom'
import { Cpu, FolderKanban } from 'lucide-react'
import { cx } from '../lib/cx.ts'

const NAV_ITEMS = [
  { to: '/', label: '项目', icon: FolderKanban, end: true },
  { to: '/models', label: '模型设置', icon: Cpu, end: false },
]

export function AppShell() {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-6 px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#8b5cf6] text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(91,140,255,0.3)]">
              L
            </span>
            <span className="text-[15px] font-semibold tracking-wide text-ink">
              LabelING
            </span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-panel-2 text-ink'
                        : 'text-muted hover:bg-panel-2/70 hover:text-ink',
                    )
                  }
                >
                  <Icon size={14} />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            本地服务运行中
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-7">
        <Outlet />
      </main>
    </div>
  )
}
