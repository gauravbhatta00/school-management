import { describe, it, expect, vi } from 'vitest'

vi.mock('../config/runtime', () => ({ API_BASE_URL: 'http://127.0.0.1:8765' }))

const { toMediaUrl } = await import('./media')

describe('toMediaUrl', () => {
  it('returns an empty string for falsy input', () => {
    expect(toMediaUrl('')).toBe('')
    expect(toMediaUrl(null)).toBe('')
    expect(toMediaUrl(undefined)).toBe('')
  })

  it('passes absolute http(s) URLs through unchanged', () => {
    expect(toMediaUrl('http://example.com/a.png')).toBe('http://example.com/a.png')
    expect(toMediaUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })

  it('prefixes a leading-slash path with the API base URL', () => {
    expect(toMediaUrl('/media/profile_photos/a.png')).toBe(
      'http://127.0.0.1:8765/media/profile_photos/a.png'
    )
  })

  it('prefixes a bare relative path with the API base URL and a slash', () => {
    expect(toMediaUrl('media/profile_photos/a.png')).toBe(
      'http://127.0.0.1:8765/media/profile_photos/a.png'
    )
  })
})
