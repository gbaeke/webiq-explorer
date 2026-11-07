import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'

/** What every explorer route returns (the generated Call* types all have this shape). */
export type CallBase = {
  endpoint: string
  status: number
  elapsedMs: number
  costUsd: number
  request: Record<string, unknown>
  response: unknown
}

type Logged = { endpoint: string; costUsd: number }

// the calls made in this browser tab, for the running total in the header; gone on reload, by design
let log: Logged[] = []
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useCallLog = () => useSyncExternalStore(subscribe, () => log)

/** Add Web IQ calls to the session log (the explorer pages, and the assistant's MCP tool calls). */
export function recordCalls(calls: Logged[]) {
  if (!calls.length) return
  log = [...log, ...calls]
  listeners.forEach((fn) => fn())
}

/** A generated `...Mutation()` that also adds each successful call to the session log. */
export function useWebIQCall<TData extends CallBase, TError, TVars>(options: UseMutationOptions<TData, TError, TVars>) {
  return useMutation({
    ...options,
    onSuccess: (data) => recordCalls([{ endpoint: data.endpoint, costUsd: data.costUsd }]),
  })
}

/** Form state typed as the endpoint's request body, with a setter per field. */
export function useForm<T extends object>(initial: T) {
  const [values, setValues] = useState(initial)
  const set =
    <K extends keyof T>(key: K) =>
    (value: T[K]) =>
      setValues((v) => ({ ...v, [key]: value }))
  return [values, set] as const
}

export const usd = (n: number) => `$${n.toFixed(n > 0 && n < 0.01 ? 3 : 2)}`
