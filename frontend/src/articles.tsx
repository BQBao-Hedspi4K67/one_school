import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays } from 'lucide-react'
import { useAuth } from './auth'
import { fetchArticle, fetchPublishedArticles, type Article, type ArticleSummary } from './articles-api'
import { Button, Card, EmptyState, ErrorState, Skeleton } from './components/ui'
import articleHero from './assets/hero.png'

function formatDate(value: string | null) {
  if (!value) return 'Bài viết ONE SCHOOL'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value))
}

function ArticleContent({ content }: { content: string }) {
  return (
    <div className="article-content">
      {content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => {
        const heading = paragraph.match(/^#{1,3}\s+(.+)$/)
        return heading
          ? <h2 key={index}>{heading[1]}</h2>
          : <p key={index}>{paragraph}</p>
      })}
    </div>
  )
}

export function ArticlesPage() {
  const { accessToken } = useAuth()
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailReload, setDetailReload] = useState(0)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')

  const loadArticles = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    fetchPublishedArticles(accessToken)
      .then(setArticles)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải bài viết'),
      )
      .finally(() => setLoading(false))
  }, [accessToken])

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { loadArticles() }, [loadArticles])

  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => {
    if (!accessToken || !selectedSlug) return
    fetchArticle(accessToken, selectedSlug)
      .then(setArticle)
      .catch((reason: unknown) =>
        setDetailError(reason instanceof Error ? reason.message : 'Không thể tải bài viết'),
      )
      .finally(() => setDetailLoading(false))
  }, [accessToken, detailReload, selectedSlug])

  const openArticle = (slug: string) => {
    setArticle(null)
    setDetailLoading(true)
    setDetailError('')
    setSelectedSlug(slug)
  }
  const retryArticle = () => {
    setDetailLoading(true)
    setDetailError('')
    setDetailReload((value) => value + 1)
  }
  const backToList = () => {
    setSelectedSlug(null)
    setArticle(null)
    setDetailError('')
  }

  if (selectedSlug) {
    return (
      <section className="articles-page">
        <button className="back-button" type="button" onClick={backToList}>
          <ArrowLeft size={16} /> Danh sách bài viết
        </button>
        {detailLoading && <Card className="article-detail-loading"><Skeleton /><Skeleton width="70%" /><Skeleton /></Card>}
        {!detailLoading && detailError && <ErrorState title={detailError} onRetry={retryArticle} />}
        {!detailLoading && article && (
          <article className="article-detail">
            <p className="eyebrow">{article.category}</p>
            <h1>{article.title}</h1>
            <p className="article-lead">{article.description}</p>
            <p className="article-date"><CalendarDays size={15} />{formatDate(article.publishedAt)}</p>
            <img
              className="article-detail-image"
              src={article.coverImageUrl ?? articleHero}
              alt={`Minh họa cho bài viết: ${article.title}`}
            />
            <ArticleContent content={article.content} />
          </article>
        )}
      </section>
    )
  }

  return (
    <section className="articles-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Góc chia sẻ ONE SCHOOL</p>
          <h1>Bài viết</h1>
          <p className="page-description">Cùng khám phá những câu chuyện và ý tưởng giúp cộng đồng học đường thêm gắn kết.</p>
        </div>
      </div>
      {loading && <div className="article-grid">{[1, 2, 3].map((item) => <Card key={item}><Skeleton /><Skeleton width="78%" /><Skeleton width="55%" /></Card>)}</div>}
      {!loading && error && <ErrorState title={error} onRetry={loadArticles} />}
      {!loading && !error && articles.length === 0 && (
        <EmptyState icon={<BookOpen size={22} />} title="Chưa có bài viết" description="Bài viết mới sẽ sớm được chia sẻ tại đây." />
      )}
      {!loading && !error && articles.length > 0 && (
        <div className="article-grid">
          {articles.map((item) => (
            <Card className="article-card" key={item.id}>
              <img src={item.coverImageUrl ?? articleHero} alt={`Minh họa cho bài viết: ${item.title}`} />
              <div className="article-card-body">
                <span className="article-category">{item.category}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <div className="article-card-footer">
                  <span>{formatDate(item.publishedAt)}</span>
                  <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => openArticle(item.slug)}>Đọc bài</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
