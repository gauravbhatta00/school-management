import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('API_BASE_URL', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('strips a trailing slash from VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:8765/')
    const { API_BASE_URL } = await import('./runtime')
    expect(API_BASE_URL).toBe('http://127.0.0.1:8765')
  })

  it('leaves a URL with no trailing slash unchanged', async () => {
    vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:8000')
    const { API_BASE_URL } = await import('./runtime')
    expect(API_BASE_URL).toBe('http://127.0.0.1:8000')
  })

  it('resolves to an empty string when unset', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { API_BASE_URL } = await import('./runtime')
    expect(API_BASE_URL).toBe('')
  })
})
