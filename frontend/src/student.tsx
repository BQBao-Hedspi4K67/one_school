import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Check, MapPin, Sparkles } from 'lucide-react'
import { useAuth, type Campus } from './auth'
import { fetchPublishedArticles, type ArticleSummary } from './articles-api'
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from './components/ui'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
type EventStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED'
type RegistrationStatus = 'REQUESTED' | 'CONFIRMED' | 'DECLINED'
type EventItem = {
  id: string
  title: string
  description: string
  coverImageUrl: string | null
  startAt: string
  endAt: string
  location: string
  deliveryMode: string | null
  targetGrades: string[]
  targetCampuses: Campus[]
  status: EventStatus
  currentRegistration: RegistrationStatus | null
}
type StudentActivity = {
  eventId: string
  status: RegistrationStatus
  joinedAt: string
  event: Omit<EventItem, 'currentRegistration'> & {
    surveys: Array<{ id: string; type: string; title: string }>
  }
}
type StudentEventSummary = Omit<EventItem, 'currentRegistration'> & {
  currentRegistration?: RegistrationStatus | null
}
type StudentSurvey = {
  id: string
  title: string
  description: string | null
  type: 'BASELINE' | 'POST_EVENT'
  eventId: string | null
  hasResponded: boolean
}

async function getJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Không thể tải dữ liệu'
    throw new Error(message)
  }
  return body as T
}

function campusName(campus: Campus | null) {
  return campus === 'BRANCH' ? 'Phân hiệu' : 'Điểm chính'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusLabel(status: RegistrationStatus) {
  return {
    REQUESTED: { label: 'Chờ giáo viên xác nhận', variant: 'warning' as const },
    CONFIRMED: { label: 'Đã xác nhận tham gia', variant: 'success' as const },
    DECLINED: { label: 'Chưa được xác nhận', variant: 'neutral' as const },
  }[status]
}

function EventSummary({ event, registrationStatus }: { event: StudentEventSummary; registrationStatus?: RegistrationStatus | null }) {
  const badge = registrationStatus ? statusLabel(registrationStatus) : null
  return (
    <div className="student-event-summary">
      {event.coverImageUrl && <img src={event.coverImageUrl} alt={`Minh họa sự kiện ${event.title}`} />}
      <div className="student-event-copy">
        <div className="student-event-title">
          <h3>{event.title}</h3>
          <Badge variant={badge?.variant ?? (event.status === 'LIVE' ? 'success' : 'info')}>
            {badge?.label ?? (event.status === 'LIVE' ? 'Đang diễn ra' : 'Sắp diễn ra')}
          </Badge>
        </div>
        <p>{event.description}</p>
        <div className="student-event-meta">
          <span><CalendarDays size={14} aria-hidden="true" />{formatDate(event.startAt)}</span>
          <span><MapPin size={14} aria-hidden="true" />{event.location}</span>
        </div>
        <small>{event.targetGrades.map((grade) => `Khối ${grade}`).join(' · ')}</small>
      </div>
    </div>
  )
}

export function StudentHome({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user, accessToken } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [surveys, setSurveys] = useState<StudentSurvey[]>([])
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    Promise.all([
      getJson<EventItem[]>('/events', accessToken),
      getJson<StudentSurvey[]>('/surveys', accessToken),
      fetchPublishedArticles(accessToken),
    ])
      .then(([eventItems, surveyItems, articleItems]) => {
        setEvents(eventItems.filter((event) => event.status === 'UPCOMING' || event.status === 'LIVE'))
        setSurveys(surveyItems)
        setArticles(articleItems.slice(0, 3))
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải trang chủ'),
      )
      .finally(() => setLoading(false))
  }, [accessToken])
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])

  const pendingSurveys = surveys.filter((survey) => !survey.hasResponded)
  return (
    <section className="student-home">
      <div className="student-hero">
        <div className="student-hero-copy">
          <span className="student-hero-kicker"><Sparkles size={15} aria-hidden="true" />Cộng đồng ONE SCHOOL</span>
          <h1>Xin chào, {user?.name ?? 'bạn'}!</h1>
          <p>Mỗi ý kiến và hoạt động chung giúp học sinh ở hai cơ sở hiểu nhau hơn, cùng xây dựng một môi trường học tập tích cực.</p>
          <div className="student-hero-actions">
            <Button icon={<CalendarDays size={17} />} onClick={() => onNavigate('Sự kiện')}>Khám phá sự kiện</Button>
            <span>{campusName(user?.campus ?? null)}</span>
          </div>
        </div>
        <div className="student-hero-mark" aria-hidden="true"><span>ONE</span><strong>SCHOOL</strong></div>
      </div>

      {error && <ErrorState title={error} onRetry={load} />}
      <div className="student-home-grid">
        <Card className="student-home-section">
          <div className="section-heading">
            <div><p className="eyebrow">Chia sẻ tiếng nói</p><h2>Khảo sát dành cho bạn</h2></div>
            <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Khảo sát')}>Xem tất cả</Button>
          </div>
          {loading ? <><Skeleton /><Skeleton width="70%" /></> : pendingSurveys.length > 0 ? (
            <div className="student-prompt">
              <span className="student-prompt-icon"><Check size={20} aria-hidden="true" /></span>
              <div><strong>{pendingSurveys[0].title}</strong><p>{pendingSurveys[0].description ?? 'Chia sẻ trải nghiệm của bạn để nhà trường có thêm góc nhìn.'}</p></div>
              <Button size="small" onClick={() => onNavigate('Khảo sát')}>Bắt đầu</Button>
            </div>
          ) : !error ? (
            <EmptyState title="Bạn đã hoàn thành các khảo sát" description="Cảm ơn bạn đã góp tiếng nói cho cộng đồng." compact />
          ) : null}
        </Card>

        <Card className="student-home-section">
          <div className="section-heading">
            <div><p className="eyebrow">Cùng tham gia</p><h2>Sự kiện sắp tới</h2></div>
            <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Sự kiện')}>Khám phá</Button>
          </div>
          {loading ? <><Skeleton /><Skeleton width="80%" /></> : events.length > 0 ? (
            <div className="student-event-list">{events.slice(0, 3).map((event) => <EventSummary key={event.id} event={event} />)}</div>
          ) : !error ? (
            <EmptyState icon={<CalendarDays size={19} />} title="Chưa có sự kiện sắp tới" description="Các hoạt động phù hợp với cơ sở của bạn sẽ xuất hiện tại đây." compact />
          ) : null}
        </Card>
      </div>

      <Card className="student-home-section student-featured-articles">
        <div className="section-heading">
          <div><p className="eyebrow">Góc chia sẻ</p><h2>Câu chuyện học đường</h2></div>
          <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Bài viết')}>Đọc thêm</Button>
        </div>
        {loading ? <div className="article-grid">{[1, 2, 3].map((item) => <Card key={item}><Skeleton /><Skeleton width="75%" /></Card>)}</div> : articles.length > 0 ? (
          <div className="student-featured-list">{articles.map((article) => <button key={article.id} type="button" onClick={() => onNavigate('Bài viết')}><BookOpen size={17} aria-hidden="true" /><span><strong>{article.title}</strong><small>{article.category}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div>
        ) : !error ? <EmptyState title="Chưa có bài viết" description="Nội dung mới sẽ sớm được chia sẻ." compact /> : null}
      </Card>
    </section>
  )
}

export function StudentActivities({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { accessToken } = useAuth()
  const [activities, setActivities] = useState<StudentActivity[]>([])
  const [surveys, setSurveys] = useState<StudentSurvey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    Promise.all([
      getJson<StudentActivity[]>('/events/mine', accessToken),
      getJson<StudentSurvey[]>('/surveys', accessToken),
    ])
      .then(([eventItems, surveyItems]) => {
        setActivities(eventItems)
        setSurveys(surveyItems)
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải hoạt động'),
      )
      .finally(() => setLoading(false))
  }, [accessToken])
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])

  return (
    <section className="student-activities">
      <div className="page-header"><div><p className="eyebrow">Theo dõi hành trình</p><h1>Hoạt động của tôi</h1><p className="page-description">Xem trạng thái đăng ký và những khảo sát bạn cần hoàn thành.</p></div></div>
      {error && <ErrorState title={error} onRetry={load} />}
      {loading ? <Card><Skeleton /><Skeleton width="75%" /><Skeleton width="55%" /></Card> : (
        <>
          <Card className="student-activity-panel">
            <div className="section-heading"><div><p className="eyebrow">Sự kiện</p><h2>Đăng ký của bạn</h2></div></div>
            {activities.length > 0 ? <div className="student-event-list">{activities.map((activity) => <EventSummary key={activity.eventId} event={activity.event} registrationStatus={activity.status} />)}</div> : <div><EmptyState icon={<CalendarDays size={19} />} title="Bạn chưa đăng ký sự kiện nào" description="Khám phá hoạt động phù hợp với cơ sở của bạn." compact /><Button size="small" variant="secondary" onClick={() => onNavigate('Sự kiện')}>Xem sự kiện</Button></div>}
          </Card>
          <Card className="student-activity-panel">
            <div className="section-heading"><div><p className="eyebrow">Khảo sát</p><h2>Tiến độ của bạn</h2></div><Button size="small" variant="ghost" onClick={() => onNavigate('Khảo sát')}>Mở khảo sát</Button></div>
            {surveys.length > 0 ? <div className="student-survey-list">{surveys.map((survey) => <div key={survey.id} className="student-survey-row"><div><strong>{survey.title}</strong><small>{survey.type === 'BASELINE' ? 'Khảo sát thực trạng' : 'Khảo sát sau sự kiện'}</small></div><Badge variant={survey.hasResponded ? 'success' : 'warning'}>{survey.hasResponded ? 'Đã hoàn thành' : 'Cần hoàn thành'}</Badge></div>)}</div> : <EmptyState icon={<Check size={19} />} title="Chưa có khảo sát" description="Khảo sát đã công bố sẽ xuất hiện tại đây." compact />}
          </Card>
        </>
      )}
    </section>
  )
}
