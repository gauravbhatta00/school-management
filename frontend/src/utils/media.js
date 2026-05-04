const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function toMediaUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }
  if (pathOrUrl.startsWith('/')) {
    return `${API_BASE_URL}${pathOrUrl}`
  }
  return `${API_BASE_URL}/${pathOrUrl}`
}
