import { client } from '@/client/client.gen'

/** Every failed call, as the server describes it: {"error": {"code", "message", ...}}. `details` is that whole
 * object: for Web IQ errors it carries `upstreamStatus` and `upstream` (Web IQ's own error body). */
export class ApiError extends Error {
  code: string
  status: number
  details: Record<string, unknown>
  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

/** Called once at startup: the generated client (src/client) throws an ApiError for every failure. */
export function setupApiClient() {
  client.interceptors.error.use((error, response) => {
    const body = error as { error?: { code?: string; message?: string } & Record<string, unknown> } | undefined
    return new ApiError(
      body?.error?.code ?? 'http_error',
      body?.error?.message ?? response?.statusText ?? 'Network error',
      response?.status ?? 0,
      body?.error ?? {},
    )
  })
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))
