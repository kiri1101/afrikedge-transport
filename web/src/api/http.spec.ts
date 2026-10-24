import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, http } from './http'

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>()
  if (response instanceof Error) fetchMock.mockRejectedValue(response)
  else fetchMock.mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('http', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends X-User-Id and If-Match', async () => {
    const fetchMock = stubFetch(new Response('{}', { headers: { 'content-type': 'application/json' } }))

    await http('/transport-orders/TO-0003/validate', { method: 'POST', ifMatch: '00000000000007D3' })

    const headers = new Headers(fetchMock.mock.calls[0]![1]!.headers)
    expect(headers.get('X-User-Id')).toBe('diane')
    expect(headers.get('If-Match')).toBe('"00000000000007D3"')
  })

  it('returns the ETag', async () => {
    stubFetch(new Response('{}', { headers: { 'content-type': 'application/json', etag: '"ABC"' } }))

    const result = await http('/transport-orders/TO-0003')

    expect(result.etag).toBe('"ABC"')
  })

  it('turns problem+json into ApiError', async () => {
    const problem = { status: 409, code: 'CAPACITY_EXCEEDED', title: 'Capacité', detail: 'Trop', params: { excessKg: 695.5 } }
    stubFetch(new Response(JSON.stringify(problem), { status: 409, headers: { 'content-type': 'application/problem+json' } }))

    const error = await http('/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'CAPACITY_EXCEEDED', params: { excessKg: 695.5 } })
  })

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(new TypeError('Failed to fetch'))

    const error = await http('/x').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })
})
