import { useUserStore } from '@/stores/user'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/** A refused or failed call. `code` is the API's stable error code (or NETWORK_ERROR / HTTP_ERROR). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    readonly detail: string,
    readonly params: Record<string, unknown> = {},
  ) {
    super(detail || title || code)
    this.name = 'ApiError'
  }
}

type Query = Record<string, string | number | null | undefined>

export type HttpOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  query?: Query
  body?: unknown
  /** The order version to send in If-Match. */
  ifMatch?: string
}

function parse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

/** Calls the API as the current user; throws ApiError on any refusal or network failure. */
export async function http<T>(
  path: string,
  options: HttpOptions = {},
): Promise<{ data: T; etag: string | null }> {
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }

  const headers: Record<string, string> = { Accept: 'application/json', 'X-User-Id': useUserStore().userId }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.ifMatch) headers['If-Match'] = `"${options.ifMatch}"`

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error', '')
  }

  const payload = parse(await response.text())
  if (!response.ok) {
    const problem = (payload ?? {}) as Partial<{ code: string; title: string; detail: string; params: Record<string, unknown> }>
    throw new ApiError(
      response.status,
      problem.code ?? 'HTTP_ERROR',
      problem.title ?? response.statusText,
      problem.detail ?? '',
      problem.params ?? {},
    )
  }
  return { data: payload as T, etag: response.headers.get('etag') }
}
