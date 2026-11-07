import { useQuery } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Loader, Play, TriangleAlert } from 'lucide-react'
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react'
import { webiqStatusOptions } from '@/client/@tanstack/react-query.gen'
import { ApiError, errorMessage } from '@/lib/api'
import { usd, type CallBase } from '@/lib/calls'
import { cn } from '@/lib/utils'

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const copy = () =>
    void navigator.clipboard.writeText(text).then(() => {
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    })
  return (
    <button type="button" className="btn-ghost p-1.5" onClick={copy} title="Copy" aria-label="Copy">
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

export function Json({ value, label }: { value: unknown; label?: string }) {
  const text = JSON.stringify(value, null, 2)
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1 text-xs text-fg-muted">
        {label ?? 'JSON'}
        <CopyButton text={text} />
      </div>
      <pre className="max-h-[70vh] overflow-auto p-3 font-mono text-xs leading-relaxed">{text}</pre>
    </div>
  )
}

function curl(baseUrl: string, endpoint: string, body: unknown) {
  const json = JSON.stringify(body, null, 2).replaceAll("'", "'\\''")
  return [
    `curl -X POST "${baseUrl}/${endpoint}" \\`,
    `  -H "x-apikey: $WEBIQ_API_KEY" \\`,
    `  -H "content-type: application/json" \\`,
    `  -d '${json}'`,
  ].join('\n')
}

function ErrorPanel({ error }: { error: unknown }) {
  const details = error instanceof ApiError ? error.details : {}
  const upstream = details.upstream
  const fields = details.fields as { loc: (string | number)[]; message: string }[] | undefined
  return (
    <div className="space-y-3 rounded-lg border border-danger/40 bg-danger/5 p-4">
      <div className="flex items-start gap-2 text-danger">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-medium">
            {error instanceof ApiError ? error.code : 'Error'}
            {typeof details.upstreamStatus === 'number' && ` · Web IQ HTTP ${details.upstreamStatus}`}
            {error instanceof ApiError && details.upstreamStatus === undefined && ` · HTTP ${error.status}`}
          </div>
          <div className="text-fg">{errorMessage(error)}</div>
        </div>
      </div>
      {fields && (
        <ul className="list-disc pl-5 text-xs">
          {fields.map((f) => (
            <li key={f.loc.join('.')}>
              <code>{f.loc.slice(1).join('.')}</code>: {f.message}
            </li>
          ))}
        </ul>
      )}
      {upstream !== undefined && <Json value={upstream} label="Web IQ error body" />}
    </div>
  )
}

function Meta({ call }: { call: CallBase }) {
  const traceId = (call.response as { traceId?: string } | null)?.traceId
  const item = (k: string, v: ReactNode) => (
    <span>
      <span className="text-fg-muted">{k}</span> <span className="font-medium">{v}</span>
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
      {item('HTTP', <span className={call.status === 200 ? 'text-ok' : 'text-warn'}>{call.status}</span>)}
      {item('latency', `${call.elapsedMs} ms`)}
      {item('cost', usd(call.costUsd))}
      {traceId && item('traceId', <code className="font-mono">{traceId}</code>)}
    </div>
  )
}

const TABS = ['Results', 'Response JSON', 'Request'] as const

export function Explorer<C extends CallBase>({
  title,
  endpoint,
  docs,
  intro,
  form,
  body,
  canRun,
  onRun,
  state,
  results: Results,
}: {
  title: string
  endpoint: string
  docs: string
  intro: ReactNode
  form: ReactNode
  body: unknown
  canRun: boolean
  onRun: () => void
  state: { data?: C; error: unknown; isPending: boolean }
  /** renders the Results tab; onRun repeats the call (Browse uses it to retry a pending crawl) */
  results: ComponentType<{ call: C; onRun: () => void }>
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Results')
  const { data: status } = useQuery(webiqStatusOptions())
  const baseUrl = status?.baseUrl ?? 'https://api.microsoft.ai/v3'
  const price = status?.pricesUsdPer1000Calls[endpoint]
  const sent = state.data?.request
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canRun && !state.isPending) onRun()
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-start">
      <form onSubmit={submit} className="card w-full shrink-0 space-y-4 lg:sticky lg:top-0 lg:w-80">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{title}</h1>
            <a href={docs} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" title="API reference">
              <ExternalLink className="size-4" />
            </a>
          </div>
          <p className="text-xs text-fg-muted">{intro}</p>
          <p className="font-mono text-xs text-fg-muted">
            POST /{endpoint}
            {price !== undefined && ` · ${price ? `$${price} / 1K calls` : 'free (beta)'}`}
          </p>
        </div>
        {form}
        <button type="submit" className="btn-primary w-full justify-center" disabled={!canRun || state.isPending}>
          {state.isPending ? <Loader className="size-4 animate-spin" /> : <Play className="size-4" />}
          {state.isPending ? 'Calling Web IQ…' : 'Send request'}
        </button>
      </form>

      <section className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-border">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm',
                  tab === t ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {state.data && <Meta call={state.data} />}
        </div>

        {tab === 'Request' ? (
          <div className="space-y-3">
            <p className="text-xs text-fg-muted">
              {sent ? 'The body of the last call, as sent to Web IQ.' : 'Preview of the body the form will send.'}
            </p>
            <Json value={sent ?? body} label="Request body" />
            <CurlBlock text={curl(baseUrl, endpoint, sent ?? body)} />
          </div>
        ) : state.error ? (
          <ErrorPanel error={state.error} />
        ) : !state.data ? (
          <p className="py-16 text-center text-fg-muted">
            {state.isPending ? 'Waiting for Web IQ…' : 'Fill in the form and send a request.'}
          </p>
        ) : tab === 'Results' ? (
          <Results call={state.data} onRun={onRun} />
        ) : (
          <Json value={state.data.response} label="Response body" />
        )}
      </section>
    </div>
  )
}

function CurlBlock({ text }: { text: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1 text-xs text-fg-muted">
        curl (export WEBIQ_API_KEY first)
        <CopyButton text={text} />
      </div>
      <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">{text}</pre>
    </div>
  )
}
