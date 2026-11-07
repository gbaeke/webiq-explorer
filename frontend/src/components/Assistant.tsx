import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Loader,
  Maximize2,
  Minimize2,
  SendHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useState, type ComponentProps, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import {
  askAgentMutation,
  clearThreadMutation,
  getThreadOptions,
  getThreadQueryKey,
} from '@/client/@tanstack/react-query.gen'
import type { Thread, ToolStep, Turn } from '@/client/types.gen'
import { Json } from '@/components/Explorer'
import { BrowseResult, ImageResults, NewsResults, VideoResults, WebResults } from '@/components/results'
import { errorMessage } from '@/lib/api'
import { recordCalls, usd } from '@/lib/calls'
import { endpoints } from '@/lib/endpoints'
import { currentThreadId, newThreadId } from '@/lib/thread'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  'Find a video about Azure Container Apps',
  'Find news about Ghent',
  'Find an image of the Atomium',
  'Summarize https://learn.microsoft.com/web-iq/overview',
]

function Link({ href, children }: ComponentProps<'a'>) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  )
}

const markdownComponents = { a: Link }

const scrollIntoView = (el: HTMLElement | null) => el?.scrollIntoView({ block: 'end' })

/** The cards for one tool call: the same components the explorer pages use. */
function StepResults({ step }: { step: ToolStep }) {
  if (step.web) return <WebResults call={{ response: step.web }} />
  if (step.news) return <NewsResults call={{ response: step.news }} />
  if (step.images) return <ImageResults call={{ response: step.images }} />
  if (step.videos) return <VideoResults call={{ response: step.videos }} />
  if (step.browse) return <BrowseResult call={{ response: step.browse }} />
  return <Json value={step.auto ?? step.other ?? null} label={step.tool} />
}

function Step({ step }: { step: ToolStep }) {
  // images and videos are what the user asked to see; text results stay folded behind the answer
  const [open, setOpen] = useState(!!(step.images || step.videos))
  const Icon = endpoints.find((e) => e.path.endsWith(step.tool))?.icon ?? Bot
  const query = (step.args.query ?? step.args.url) as string | undefined
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted"
      >
        {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        <Icon className="size-3.5 shrink-0 text-accent" />
        <span className="font-mono font-medium">{step.tool}</span>
        <span className="min-w-0 flex-1 truncate text-fg-muted">{query}</span>
        {step.error ? (
          <span className="text-danger">failed</span>
        ) : (
          <span className="text-fg-muted">{usd(step.costUsd)}</span>
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-2">
          <Json value={step.args} label="MCP tool arguments" />
          {step.error ? <p className="text-xs text-danger">{step.error}</p> : <StepResults step={step} />}
        </div>
      )}
    </div>
  )
}

function Answer({ turn }: { turn: Turn }) {
  return (
    <div className="space-y-2">
      {turn.steps.map((s, i) => (
        <Step key={i} step={s} />
      ))}
      <div className="prose-answer text-[13px] leading-relaxed">
        <Markdown components={markdownComponents}>{turn.answer || '_(no answer)_'}</Markdown>
      </div>
      <div className="text-[11px] text-fg-muted">
        {turn.inputTokens.toLocaleString()} in / {turn.outputTokens.toLocaleString()} out tokens
        {turn.elapsedMs != null && ` · ${(turn.elapsedMs / 1000).toFixed(1)} s`}
      </div>
    </div>
  )
}

function Question({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-[13px] whitespace-pre-wrap text-accent-fg">
      {text}
    </div>
  )
}

function Panel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [threadId, setThreadId] = useState(currentThreadId)
  const [text, setText] = useState('')
  const [wide, setWide] = useState(false)
  const path = { thread_id: threadId }
  const thread = useQuery({ ...getThreadOptions({ path }), staleTime: Infinity })
  const ask = useMutation({
    ...askAgentMutation(),
    onSuccess: (turn) => {
      qc.setQueryData(getThreadQueryKey({ path }), (old: Thread | undefined) =>
        old ? { ...old, turns: [...old.turns, turn] } : old,
      )
      recordCalls(turn.steps.filter((s) => !s.error).map((s) => ({ endpoint: `mcp/${s.tool}`, costUsd: s.costUsd })))
    },
  })
  const clear = useMutation({
    ...clearThreadMutation(),
    onSuccess: () => {
      ask.reset()
      setThreadId(newThreadId())
    },
  })

  const send = (question: string) => {
    if (!question.trim() || ask.isPending) return
    ask.mutate({ body: { threadId, question } })
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(text)
    }
  }

  const turns = thread.data?.turns ?? []
  return (
    <div
      className={cn(
        'fixed right-4 bottom-4 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl',
        'h-[min(760px,calc(100vh-2rem))]',
        wide ? 'w-[min(960px,calc(100vw-2rem))]' : 'w-[min(480px,calc(100vw-2rem))]',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bot className="size-4 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Web IQ assistant</div>
          <div className="truncate text-[11px] text-fg-muted">
            Web IQ over MCP · {thread.data?.model ?? 'model via agentgateway'}
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost p-1.5"
          title="New conversation"
          aria-label="New conversation"
          disabled={!turns.length || clear.isPending}
          onClick={() => clear.mutate({ path })}
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          className="btn-ghost p-1.5"
          title={wide ? 'Narrow' : 'Wide'}
          aria-label={wide ? 'Narrow' : 'Wide'}
          onClick={() => setWide(!wide)}
        >
          {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button type="button" className="btn-ghost p-1.5" title="Close" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {thread.isError && <p className="text-xs text-danger">{errorMessage(thread.error)}</p>}
        {!turns.length && !ask.isPending && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-fg-muted">
              Ask for videos, news, images, a page, or anything on the web. The agent picks the Web IQ tool.
            </p>
            <div className="flex flex-col items-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:border-accent hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <Question text={t.question} />
            <Answer turn={t} />
          </div>
        ))}
        {ask.isPending && ask.variables && (
          <div className="space-y-2">
            <Question text={ask.variables.body.question} />
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <Loader className="size-3.5 animate-spin" /> Picking a tool and searching Web IQ…
            </div>
          </div>
        )}
        {ask.isError && (
          <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-xs">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="flex-1">{errorMessage(ask.error)}</span>
            {ask.variables && (
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => send(ask.variables.body.question)}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div key={turns.length + (ask.isPending ? 0.5 : 0)} ref={scrollIntoView} />
      </div>

      <div className="flex items-end gap-2 border-t border-border p-2">
        <textarea
          rows={2}
          className="input resize-none"
          placeholder="Find a video about…  (Enter sends, Shift+Enter: new line)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />
        <button
          type="button"
          className="btn-primary p-2"
          aria-label="Send"
          disabled={!text.trim() || ask.isPending}
          onClick={() => send(text)}
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function Assistant() {
  const [open, setOpen] = useState(false)
  if (open) return <Panel onClose={() => setOpen(false)} />
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 font-medium text-accent-fg shadow-lg hover:opacity-90"
    >
      <Bot className="size-4" /> Ask the assistant
    </button>
  )
}
