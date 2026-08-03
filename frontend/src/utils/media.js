import { API_BASE_URL } from '../config/runtime'

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
