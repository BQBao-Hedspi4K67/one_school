import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Check, FileText, GraduationCap, MapPin, Sparkles, Users } from 'lucide-react'
import { useAuth, type Campus } from './auth'
import { fetchPublishedArticles, type ArticleSummary } from './articles-api'
import { deriveEventStatus, eventStatusBadge, type EventStatus } from './event-status'
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from './components/ui'
import { API_URL } from './api-url'
import articleHero from './assets/hero.png'
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

function formatPublishedDate(value: string | null) {
  if (!value) return 'Bài viết ONE SCHOOL'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value))
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
  const timeBadge = eventStatusBadge(event)
  return (
    <div className="student-event-summary">
      {event.coverImageUrl && <img src={event.coverImageUrl} alt={`Minh họa sự kiện ${event.title}`} />}
      <div className="student-event-copy">
        <div className="student-event-title">
          <h3>{event.title}</h3>
          <Badge variant={badge?.variant ?? timeBadge.variant}>
            {badge?.label ?? timeBadge.label}
          </Badge>
        </div>
        <p>{event.description}</p>
        <div className="student-event-meta">
          <span><CalendarDays size={14} aria-hidden="true" />{formatDate(event.startAt)}</span>
          <span><MapPin size={14} aria-hidden="true" />{event.location}</span>
        </div>
        <div className="student-event-meta">
          <span>
            <Users size={14} aria-hidden="true" />
            {event.targetGrades.map((grade) => `Khối ${grade}`).join(', ')}
          </span>
        </div>
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
        setEvents(eventItems.filter((event) => deriveEventStatus(event) !== 'COMPLETED'))
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
            <div className="student-prompt" style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
              <span className="student-prompt-icon"><Check size={20} aria-hidden="true" /></span>
              <div style={{ flex: 1 }}>
                <strong>{pendingSurveys[0].title}</strong>
                <p>{pendingSurveys[0].description ?? 'Chia sẻ trải nghiệm của bạn để nhà trường có thêm góc nhìn.'}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Button size="small" onClick={() => onNavigate('Khảo sát')}>Bắt đầu</Button>
              </div>
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
            <div className="student-event-list">{events.slice(0, 1).map((event) => <EventSummary key={event.id} event={event} />)}</div>
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
          <div className="article-grid">{articles.map((article) => (
            <Card className="article-card" key={article.id}>
              <img src={article.coverImageUrl ?? articleHero} alt={`Minh họa cho bài viết: ${article.title}`} />
              <div className="article-card-body">
                <span className="article-category">{article.category}</span>
                <h2>{article.title}</h2>
                <p>{article.description}</p>
                <div className="article-card-footer">
                  <span>{formatPublishedDate(article.publishedAt)}</span>
                  <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Bài viết')}>Đọc bài</Button>
                </div>
              </div>
            </Card>
          ))}</div>
        ) : !error ? <EmptyState title="Chưa có bài viết" description="Nội dung mới sẽ sớm được chia sẻ." compact /> : null}
      </Card>
    </section>
  )
}

function StudentEventCard({ activity }: { activity: StudentActivity }) {
  const { event } = activity
  const badge = statusLabel(activity.status)
  return (
    <Card className="event-card">
      <div className="event-cover">{event.coverImageUrl ? <img src={event.coverImageUrl} alt={`Minh họa sự kiện ${event.title}`} /> : <CalendarDays size={34} aria-hidden="true" />}</div>
      <div className="event-card-body">
        <div className="event-card-title"><h3>{event.title}</h3><Badge variant={badge.variant}>{badge.label}</Badge></div>
        <p className="event-excerpt">{event.description}</p>
        <div className="event-meta"><span><CalendarDays size={15} aria-hidden="true" />{formatDate(event.startAt)}</span><span><MapPin size={15} aria-hidden="true" />{event.location}</span></div>
        <div className="event-meta">
          <span><GraduationCap size={15} aria-hidden="true" />{event.targetCampuses.map((campus) => campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu').join(' · ')}</span>
          <span><Users size={15} aria-hidden="true" />{event.targetGrades.map((grade) => `Khối ${grade}`).join(', ')}</span>
        </div>
      </div>
    </Card>
  )
}

function StudentSurveyCard({ survey, onNavigate }: { survey: StudentSurvey; onNavigate: (page: string) => void }) {
  return (
    <Card className="survey-list-card">
      <div className="survey-list-icon"><FileText size={22} aria-hidden="true" /></div>
      <div className="survey-list-copy">
        <div className="survey-list-title"><h3>{survey.title}</h3><Badge variant={survey.hasResponded ? 'success' : 'warning'}>{survey.hasResponded ? 'Đã hoàn thành' : 'Cần hoàn thành'}</Badge></div>
        <p>{survey.type === 'BASELINE' ? 'Khảo sát thực trạng' : 'Khảo sát sau sự kiện'}</p>
      </div>
      <Button size="small" variant="primary" disabled={survey.hasResponded} onClick={() => onNavigate('Khảo sát')}>{survey.hasResponded ? 'Đã hoàn thành' : 'Mở khảo sát'}</Button>
    </Card>
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
      <div className="page-header"><div><p className="eyebrow">Theo dõi hành trình</p><h1>Hoạt động của tôi</h1></div></div>
      {error && <ErrorState title={error} onRetry={load} />}
      {loading ? <Card><Skeleton /><Skeleton width="75%" /><Skeleton width="55%" /></Card> : (
        <>
          <div className="student-activity-panel">
            <div className="section-heading"><div><p className="eyebrow">Sự kiện</p><h2>Đăng ký của bạn</h2></div><Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Sự kiện')}>Khám phá</Button></div>
            {activities.length > 0 ? <div className="event-grid">{activities.map((activity) => <StudentEventCard key={activity.eventId} activity={activity} />)}</div> : <div><EmptyState icon={<CalendarDays size={19} />} title="Bạn chưa đăng ký sự kiện nào" description="Khám phá hoạt động phù hợp với cơ sở của bạn." compact /><Button size="small" variant="secondary" onClick={() => onNavigate('Sự kiện')}>Xem sự kiện</Button></div>}
          </div>
          <div className="student-activity-panel">
            <div className="section-heading"><div><p className="eyebrow">Khảo sát</p><h2>Tiến độ của bạn</h2></div><Button size="small" variant="ghost" onClick={() => onNavigate('Khảo sát')}>Mở khảo sát</Button></div>
            {surveys.length > 0 ? <div className="student-survey-list">{surveys.map((survey) => <StudentSurveyCard key={survey.id} survey={survey} onNavigate={onNavigate} />)}</div> : <EmptyState icon={<FileText size={19} />} title="Chưa có khảo sát" description="Khảo sát đã công bố sẽ xuất hiện tại đây." compact />}
          </div>
        </>
      )}
    </section>
  )
}
