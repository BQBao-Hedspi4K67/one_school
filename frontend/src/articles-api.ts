const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type Article = {
  id: string
  category: string
  title: string
  slug: string
  description: string
  content: string
  coverImageUrl: string | null
  publishedAt: string | null
}

export type ArticleSummary = Omit<Article, 'content'>

async function articleRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/articles${path}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Không thể tải bài viết'
    throw new Error(message)
  }
  return body as T
}

export function fetchPublishedArticles(accessToken: string) {
  return articleRequest<ArticleSummary[]>('', accessToken)
}

export function fetchArticle(accessToken: string, slug: string) {
  return articleRequest<Article>(`/${encodeURIComponent(slug)}`, accessToken)
}
