import { useState, type ReactNode } from 'react'
import type {
  AutoResult,
  AutoResponse,
  BrowseResponse,
  ImagesResponse,
  NewsResponse,
  VideosResponse,
  WebResponse,
  VideoResult,
} from '@/client/types.gen'
import { Json } from '@/components/Explorer'
import { cn } from '@/lib/utils'

const host = (url?: string | null) => {
  try {
    return url ? new URL(url).host : ''
  } catch {
    return url ?? ''
  }
}

const date = (s?: string | null) => (s ? s.slice(0, 16).replace('T', ' ') : undefined)

function Badge({ children, tone }: { children: ReactNode; tone?: 'warn' | 'accent' }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[11px]',
        tone === 'warn' ? 'bg-warn/15 text-warn' : tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-muted',
      )}
    >
      {children}
    </span>
  )
}

/** Small "label value" pairs; empty values are left out. */
function Facts({ items }: { items: [string, ReactNode][] }) {
  const shown = items.filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!shown.length) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted">
      {shown.map(([k, v]) => (
        <span key={k}>
          {k}: <span className="text-fg">{v}</span>
        </span>
      ))}
    </div>
  )
}

/** Grounding content: long passages fold, so a page of results stays scannable. */
function Passage({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  const long = text.length > 400
  return (
    <div className="space-y-1">
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
        {open || !long ? text : `${text.slice(0, 400)}…`}
      </p>
      <div className="flex gap-3 text-xs text-fg-muted">
        <span>{text.length.toLocaleString()} chars</span>
        {long && (
          <button type="button" className="text-accent hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Show less' : 'Show all'}
          </button>
        )}
      </div>
    </div>
  )
}

function Title({ title, url }: { title?: string | null; url?: string | null }) {
  return (
    <div className="min-w-0">
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
        {title || url || '(untitled)'}
      </a>
      {url && <div className="truncate text-xs text-fg-muted">{url}</div>}
    </div>
  )
}

function Count({ n, what, extra }: { n: number; what: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span>
        {n} {what}
        {n === 1 ? '' : 's'}
      </span>
      {extra}
    </div>
  )
}

export function WebResults({ call }: { call: { response: WebResponse } }) {
  const { webResults = [], riskLevel, querySignals } = call.response
  return (
    <div className="@container space-y-3">
      <Count
        n={webResults.length}
        what="result"
        extra={
          <>
            {riskLevel && <Badge tone={riskLevel === 'low' ? undefined : 'warn'}>riskLevel: {riskLevel}</Badge>}
            {querySignals?.freshness !== undefined && (
              <Badge tone={querySignals.freshness ? 'accent' : undefined}>
                freshness signal: {String(querySignals.freshness)}
              </Badge>
            )}
          </>
        }
      />
      {webResults.map((r, i) => (
        <article key={`${r.url}-${i}`} className="card space-y-2">
          <div className="flex items-start justify-between gap-3">
            <Title title={r.title} url={r.url} />
            <div className="flex shrink-0 gap-1">
              {r.contentTier && <Badge tone={r.contentTier === 'premium' ? 'warn' : undefined}>{r.contentTier}</Badge>}
              {r.isAdult && <Badge tone="warn">adult</Badge>}
            </div>
          </div>
          <Facts
            items={[
              ['updated', date(r.lastUpdatedAt)],
              ['crawled', date(r.crawledAt)],
              ['language', r.language],
            ]}
          />
          <Passage text={r.content} />
        </article>
      ))}
    </div>
  )
}

export function NewsResults({ call }: { call: { response: NewsResponse } }) {
  const { newsResults = [] } = call.response
  return (
    <div className="@container space-y-3">
      <Count n={newsResults.length} what="article" />
      {newsResults.map((r, i) => (
        <article key={`${r.url}-${i}`} className="card flex gap-4">
          {r.thumbnail?.url && (
            <img
              src={r.thumbnail.url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-24 shrink-0 rounded-md object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <Title title={r.title} url={r.url} />
            <Facts
              items={[
                ['source', r.source],
                ['updated', date(r.lastUpdatedAt)],
                ['crawled', date(r.crawledAt)],
                ['language', r.language],
              ]}
            />
            <Passage text={r.content} />
          </div>
        </article>
      ))}
    </div>
  )
}

export function ImageResults({ call }: { call: { response: ImagesResponse } }) {
  const { imageResults = [] } = call.response
  return (
    <div className="@container space-y-3">
      <Count n={imageResults.length} what="image" />
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4">
        {imageResults.map((r, i) => (
          <figure key={`${r.url}-${i}`} className="card space-y-2 p-2">
            <a href={r.url ?? undefined} target="_blank" rel="noreferrer">
              <img
                src={r.thumbnailUrl ?? r.url ?? undefined}
                alt={r.caption ?? r.title ?? ''}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-square w-full rounded bg-muted object-cover"
              />
            </a>
            <figcaption className="space-y-0.5 text-xs">
              <div className="line-clamp-2 font-medium">{r.title}</div>
              {r.caption && <div className="line-clamp-2 text-fg-muted">{r.caption}</div>}
              <div className="text-fg-muted">
                {r.width}×{r.height} ·{' '}
                <a href={r.hostPageUrl ?? undefined} target="_blank" rel="noreferrer" className="hover:underline">
                  {host(r.hostPageUrl)}
                </a>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function Video({ v }: { v: VideoResult }) {
  const [moments, setMoments] = useState(false)
  const count = v.moments?.length ?? 0
  return (
    <article className="card flex flex-col gap-4 @xl:flex-row">
      {v.thumbnailUrl && (
        <a href={v.url ?? undefined} target="_blank" rel="noreferrer" className="relative shrink-0">
          <img
            src={v.thumbnailUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-video w-full rounded-md object-cover @xl:w-56"
          />
          {v.length && (
            <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1 text-[11px] text-white">
              {v.length}
            </span>
          )}
        </a>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <Title title={v.title} url={v.url} />
        <Facts
          items={[
            ['by', v.publishedBy],
            ['views', v.viewCount?.toLocaleString()],
            ['size', v.width && v.height ? `${v.width}×${v.height}` : undefined],
            ['updated', date(v.lastUpdatedAt)],
            ['embeddable', v.embeddingUrl ? 'yes' : undefined],
          ]}
        />
        {v.summary && (
          <p className="text-[13px]">
            <Badge tone="accent">AI summary</Badge> {v.summary}
          </p>
        )}
        {v.description && v.description !== v.summary && <Passage text={v.description} />}
        {count > 0 && (
          <div className="text-xs">
            <button type="button" className="text-accent hover:underline" onClick={() => setMoments(!moments)}>
              {moments ? 'Hide' : 'Show'} {count} moment{count === 1 ? '' : 's'}
            </button>
            {moments && (
              <ol className="mt-2 space-y-1.5">
                {v.moments?.map((m, i) => (
                  <li
                    key={i}
                    className={cn('rounded border border-border p-2', i === v.bestMomentIndex && 'border-accent')}
                  >
                    <a
                      href={m.momentUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {m.startTime}–{m.endTime} {m.title}
                    </a>
                    {i === v.bestMomentIndex && <Badge tone="accent">best moment</Badge>}
                    {m.description && <div className="text-fg-muted">{m.description}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export function VideoResults({ call }: { call: { response: VideosResponse } }) {
  const { videoResults = [], playlists = [] } = call.response
  return (
    <div className="@container space-y-3">
      <Count
        n={videoResults.length}
        what="video"
        extra={playlists.length > 0 && <Badge>{playlists.length} playlists</Badge>}
      />
      {videoResults.map((v, i) => (
        <Video key={`${v.url}-${i}`} v={v} />
      ))}
      {playlists.map((p, i) => (
        <article key={i} className="card space-y-2">
          <div className="font-medium">
            <Badge>playlist</Badge> {p.title}
          </div>
          {p.description && <p className="text-xs text-fg-muted">{p.description}</p>}
          <ol className="list-decimal space-y-0.5 pl-5 text-xs">
            {p.videos?.map((v, j) => (
              <li key={j}>
                <a href={v.url ?? undefined} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {v.title}
                </a>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  )
}

export function BrowseResult({
  call,
  onRun,
}: {
  call: { response: BrowseResponse; status?: number }
  onRun?: () => void
}) {
  const r = call.response
  if (call.status === 202) {
    return (
      <div className="card space-y-2 border-warn/40">
        <div className="font-medium text-warn">202 Accepted: a live crawl is running</div>
        <p className="text-xs">
          Web IQ did not have this URL indexed and started a crawl. Retry after{' '}
          <code className="font-mono">{r.retryAfter ?? 'a little while'}</code>
          {r.url && (
            <>
              {' '}
              for <code className="font-mono">{r.url}</code>
            </>
          )}
          . A 202 is not billed.
        </p>
        {onRun && (
          <button type="button" className="btn-primary" onClick={onRun}>
            Retry now
          </button>
        )}
      </div>
    )
  }
  return (
    <article className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Title title={r.title} url={r.url} />
        {r.isAdult && <Badge tone="warn">adult</Badge>}
      </div>
      <Facts
        items={[
          ['updated', date(r.lastUpdatedAt)],
          ['crawled', date(r.crawledAt)],
          ['chars', r.content?.length.toLocaleString()],
        ]}
      />
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{r.content}</p>
    </article>
  )
}

function Evidence({ result }: { result: AutoResult }) {
  const { evidence, citations = [] } = result
  const content = evidence.content as Record<string, unknown> | string | null | undefined
  const media = typeof content === 'object' && content ? content : {}
  const thumb = (media.thumbnailUrl ?? media.url) as string | undefined
  return (
    <article className="card space-y-3">
      <Badge tone="accent">{evidence.type}</Badge>
      {evidence.type === 'text' && typeof content === 'string' ? (
        <div className="flex gap-4">
          {evidence.thumbnail?.url && (
            <img
              src={evidence.thumbnail.url}
              alt=""
              referrerPolicy="no-referrer"
              className="size-20 shrink-0 rounded object-cover"
            />
          )}
          <Passage text={content} />
        </div>
      ) : evidence.type.startsWith('media/') && thumb ? (
        <div className="flex gap-4">
          <img src={thumb} alt="" referrerPolicy="no-referrer" className="h-28 rounded object-cover" />
          <div className="min-w-0 text-xs">
            <Title title={media.title as string} url={(media.hostPageUrl ?? media.url) as string} />
          </div>
        </div>
      ) : (
        <Json value={content} label={evidence.type} />
      )}
      {citations.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2 text-xs">
          {citations.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2">
              {c.contentSource && <Badge>{c.contentSource}</Badge>}
              <a
                href={c.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="truncate text-accent hover:underline"
              >
                {c.title || c.url}
              </a>
              {c.lastUpdatedAt && <span className="shrink-0 text-fg-muted">{date(c.lastUpdatedAt)}</span>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function AutoResults({ call }: { call: { response: AutoResponse } }) {
  const { results = [] } = call.response
  return (
    <div className="@container space-y-3">
      <Count n={results.length} what="evidence item" />
      {results.map((r, i) => (
        <Evidence key={i} result={r} />
      ))}
    </div>
  )
}
