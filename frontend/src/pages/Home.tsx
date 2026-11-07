import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { webiqStatusOptions } from '@/client/@tanstack/react-query.gen'
import { endpoints } from '@/lib/endpoints'

export function Home() {
  const { data: status } = useQuery(webiqStatusOptions())
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Web IQ Explorer</h1>
        <p className="text-fg-muted">
          Try every Microsoft Web IQ endpoint with all of its parameters. Each page shows the rendered results, the raw
          JSON response, and the exact request with a curl command. Your API key stays on the server.
        </p>
      </div>

      {status && !status.configured && (
        <div className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <div>
            <code>WEBIQ_API_KEY</code> is not set. Add it to <code>.env</code> (from the Web IQ portal, Profile
            Management, API Keys) and restart the app.
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {endpoints.map(({ to, label, icon: Icon, path, summary }) => {
          const price = status?.pricesUsdPer1000Calls[path]
          return (
            <Link key={to} to={to} className="card space-y-1.5 transition-colors hover:border-accent">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="size-4 text-accent" />
                  {label}
                </span>
                {price !== undefined && (
                  <span className="text-xs text-fg-muted">{price ? `$${price} / 1K` : 'free (beta)'}</span>
                )}
              </div>
              <p className="text-xs text-fg-muted">{summary}</p>
              <p className="font-mono text-[11px] text-fg-muted">POST /{path}</p>
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-fg-muted">
        The terms of use require citations next to any answer you show users, at most 200 characters from one source,
        and no storing of results. This explorer stores nothing: results live in the page until you reload it.
      </p>
    </div>
  )
}
