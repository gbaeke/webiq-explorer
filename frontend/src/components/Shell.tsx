import { LayoutDashboard, Monitor, Moon, Sun } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { healthOptions, webiqStatusOptions } from '@/client/@tanstack/react-query.gen'
import { Assistant } from '@/components/Assistant'
import { usd, useCallLog } from '@/lib/calls'
import { endpoints } from '@/lib/endpoints'
import { useTheme } from '@/lib/theme-context'
import { cn } from '@/lib/utils'

const nav = [{ to: '/', label: 'Overview', icon: LayoutDashboard }, ...endpoints]

function ApiStatus() {
  const { data, isError } = useQuery({ ...healthOptions(), refetchInterval: 30_000 })
  const ok = data?.status === 'ok'
  return (
    <span className="flex items-center gap-2 text-xs text-fg-muted">
      <span className={cn('size-2 rounded-full', ok ? 'bg-ok' : isError ? 'bg-danger' : 'bg-fg-muted')} />
      {ok ? 'API connected' : isError ? 'API offline' : 'Connecting'}
    </span>
  )
}

function KeyStatus() {
  const { data } = useQuery(webiqStatusOptions())
  if (!data) return null
  return (
    <span className={cn('text-xs', data.configured ? 'text-fg-muted' : 'font-medium text-warn')}>
      {data.configured ? 'API key set' : 'WEBIQ_API_KEY missing'}
    </span>
  )
}

/** Calls made from this tab and their list price: every search costs real money. */
function SessionCost() {
  const log = useCallLog()
  if (!log.length) return null
  const total = log.reduce((sum, c) => sum + c.costUsd, 0)
  return (
    <span className="text-xs text-fg-muted" title="list price of the calls made from this tab">
      {log.length} call{log.length === 1 ? '' : 's'} · {usd(total)}
    </span>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = { system: 'light', light: 'dark', dark: 'system' } as const
  const Icon = { system: Monitor, light: Sun, dark: Moon }[theme]
  return (
    <button
      className="btn-ghost p-1.5"
      onClick={() => setTheme(next[theme])}
      title={`Theme: ${theme}`}
      aria-label={`Theme: ${theme}`}
    >
      <Icon className="size-4" />
    </button>
  )
}

export function Shell() {
  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center border-b border-border px-4 font-semibold">Web IQ Explorer</div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-1.5',
                  isActive ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-muted hover:text-fg',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border bg-surface px-6">
          <SessionCost />
          <KeyStatus />
          <ApiStatus />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
        <Assistant />
      </div>
    </div>
  )
}
