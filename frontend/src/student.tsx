import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Compass,
  Eye,
  GraduationCap,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuth, type Campus } from './auth'
import { fetchPublishedArticles, type ArticleSummary } from './articles-api'
import { deriveEventStatus, eventStatusBadge, type EventStatus } from './event-status'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from './components/ui'
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
    REQUESTED: { label: 'Đã tham gia', variant: 'success' as const },
    CONFIRMED: { label: 'Đã tham gia', variant: 'success' as const },
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
export function StudentHome({ onNavigate, guestMode = false }: { onNavigate: (page: string) => void; guestMode?: boolean }) {
  const { user, accessToken } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [surveys, setSurveys] = useState<StudentSurvey[]>([])
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSurveys, setLoadingSurveys] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    setLoadingSurveys(true); setLoadingEvents(true); setLoadingArticles(true)
    setError('')
    if (guestMode) {
      fetch(`${API_URL}/api/guest/catalog`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Không thể tải trang chủ')
          return {
            events: (data.events ?? []).map((event: { id: string; title: string; status: EventStatus; startAt: string; endAt: string }) => ({
              ...event, description: '', coverImageUrl: null, location: '', deliveryMode: null, targetGrades: [], targetCampuses: ['MAIN', 'BRANCH'] as Campus[], currentRegistration: null,
            })),
            surveys: (data.surveys ?? []).map((survey: StudentSurvey) => ({ ...survey, description: null, hasResponded: false, eventId: null })),
            articles: (data.articles ?? []).slice(0, 3),
          }
        })
        .then(({ events: eventItems, surveys: surveyItems, articles: articleItems }) => {
          setEvents(eventItems.filter((event: EventItem) => deriveEventStatus(event) !== 'COMPLETED'))
          setSurveys(surveyItems)
          setArticles(articleItems)
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải trang chủ'))
        .finally(() => { setLoading(false); setLoadingSurveys(false); setLoadingEvents(false); setLoadingArticles(false) })
      return
    }
    if (!accessToken) return
    const reportError = (reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu')
    const eventLoad = getJson<EventItem[]>('/events', accessToken)
      .then((items) => setEvents(items.filter((event) => deriveEventStatus(event) !== 'COMPLETED')))
      .catch(reportError).finally(() => setLoadingEvents(false))
    const surveyLoad = getJson<StudentSurvey[]>('/surveys', accessToken)
      .then(setSurveys).catch(reportError).finally(() => setLoadingSurveys(false))
    const articleLoad = fetchPublishedArticles(accessToken)
      .then((items) => setArticles(items.slice(0, 3))).catch(reportError).finally(() => setLoadingArticles(false))
    Promise.allSettled([eventLoad, surveyLoad, articleLoad]).finally(() => setLoading(false))
  }, [accessToken, guestMode])
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])

  const pendingSurveys = surveys.filter((survey) => !survey.hasResponded)
  return (
    <section className="student-home">
      <header className="student-page-hero">
        <div className="student-hero-copy">
          <span className="student-hero-kicker">
            <Sparkles size={15} aria-hidden="true" />
            Cộng đồng ONE SCHOOL · THCS Đông Ngạc
          </span>
          <h1>
            {guestMode ? 'Khách đang xem' : `Xin chào, ${user?.name ?? 'bạn'}!`}<br />
            <span>Cùng kết nối và sẻ chia.</span>
          </h1>
          <p className="platform-introduction">
            ONE SCHOOL là nền tảng hỗ trợ tổ chức hoạt động giáo dục và kết nối học sinh giữa điểm trường chính và phân hiệu, thông qua khảo sát nhu cầu, không gian giao lưu số và phân tích AI, nhằm tăng mức độ tham gia, tương tác và cảm giác thuộc về cùng một mái trường – trường THCS Đông Ngạc – phường Đông Ngạc – thành phố Hà Nội.
          </p>
          <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button icon={<CalendarDays size={17} />} onClick={() => onNavigate('Sự kiện')}>
              Khám phá sự kiện
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate('Khảo sát')}
            >
              Xem khảo sát ({loading ? '…' : pendingSurveys.length})
            </Button>
          </div>
          <div className="student-hero-proof">
            <span><CalendarDays size={16} /> {loading ? '…' : events.length} Sự kiện sắp tới</span>
            <span><CheckCircle2 size={16} /> {loading ? '…' : pendingSurveys.length} Khảo sát cần làm</span>
            <span><GraduationCap size={16} /> {campusName(user?.campus ?? null)}</span>
          </div>
        </div>
        <div className="student-hero-art" aria-hidden="true">
          <div className="student-hero-orbit student-hero-orbit-one" />
          <div className="student-hero-orbit student-hero-orbit-two" />
          <div className="student-hero-core">
            <Sparkles size={36} />
          </div>
          <div className="student-hero-float float-top">
            <Users size={18} />
            <span>Gắn kết 2 cơ sở</span>
          </div>
          <div className="student-hero-float float-bottom">
            <GraduationCap size={18} />
            <span>Học sinh Đông Ngạc</span>
          </div>
          <span className="student-hero-dot dot-one" />
          <span className="student-hero-dot dot-two" />
          <span className="student-hero-dot dot-three" />
        </div>
      </header>

      {error && <ErrorState title={error} onRetry={load} />}
      <div className="student-home-grid">
        <Card className="student-home-section">
          <div className="section-heading">
            <div><p className="eyebrow">Chia sẻ tiếng nói</p><h2>Khảo sát dành cho bạn</h2></div>
            <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Khảo sát')}>Xem tất cả</Button>
          </div>
          {loadingSurveys ? <LoadingState compact label="Đang tải khảo sát..." /> : pendingSurveys.length > 0 ? (
            <div className="student-prompt" style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
              <span className="student-prompt-icon"><Check size={20} aria-hidden="true" /></span>
              <div style={{ flex: 1 }}>
                <strong>{pendingSurveys[0].title}</strong>
                <p>{pendingSurveys[0].description ?? 'Chia sẻ trải nghiệm của bạn để nhà trường có thêm góc nhìn.'}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Button size="small" variant={guestMode ? 'secondary' : 'primary'} onClick={() => onNavigate('Khảo sát')}>{guestMode ? 'Xem khảo sát' : 'Bắt đầu'}</Button>
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
          {loadingEvents ? <LoadingState compact label="Đang tải hoạt động..." /> : events.length > 0 ? (
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
        {loadingArticles ? <LoadingState label="Đang tải bài viết..." /> : articles.length > 0 ? (
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

function StudentEventCard({ activity, onNavigate }: { activity: StudentActivity; onNavigate: (page: string) => void }) {
  const { event } = activity
  const badge = statusLabel(activity.status)
  return (
    <article className="student-event-card-modern">
      <div className="student-event-thumb">
        {event.coverImageUrl ? (
          <img src={event.coverImageUrl} alt={`Minh họa ${event.title}`} />
        ) : (
          <div className="student-event-thumb-fallback">
            <CalendarDays size={36} aria-hidden="true" />
            <span>Sự kiện ONE SCHOOL</span>
          </div>
        )}
        <div className="student-event-badge-overlay">
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>
      <div className="student-event-card-content">
        <div className="event-detail-tags" style={{ marginBottom: 0 }}>
          <span className="event-tag-pill" style={{ padding: '3px 9px', fontSize: '11px' }}>
            <Building2 size={12} aria-hidden="true" />
            {event.targetCampuses.map((campus) => (campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu')).join(' × ')}
          </span>
          {event.deliveryMode && (
            <span className="event-tag-pill" style={{ padding: '3px 9px', fontSize: '11px' }}>
              <Compass size={12} aria-hidden="true" />
              {event.deliveryMode === 'ONLINE' ? 'Trực tuyến' : event.deliveryMode === 'HYBRID' ? 'Kết hợp' : 'Trực tiếp'}
            </span>
          )}
        </div>
        <h3>{event.title}</h3>
        <p className="student-event-desc">{event.description}</p>
        <div className="student-event-meta-list">
          <span className="student-event-meta-item">
            <CalendarDays size={14} aria-hidden="true" />
            {formatDate(event.startAt)}
          </span>
          <span className="student-event-meta-item">
            <MapPin size={14} aria-hidden="true" />
            {event.location}
          </span>
          <span className="student-event-meta-item">
            <Users size={14} aria-hidden="true" />
            {event.targetGrades.map((grade) => `Khối ${grade}`).join(', ')}
          </span>
        </div>
        <div className="student-event-card-actions">
          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
            Đăng ký: {formatDate(activity.joinedAt)}
          </span>
          <Button size="small" variant="secondary" icon={<ArrowRight size={14} />} onClick={() => onNavigate('Sự kiện')}>
            Xem sự kiện
          </Button>
        </div>
      </div>
    </article>
  )
}

function StudentSurveyCard({ survey, onNavigate }: { survey: StudentSurvey; onNavigate: (page: string) => void }) {
  return (
    <div className="student-survey-card-modern">
      <div className="student-survey-card-header">
        <div className="student-survey-icon-pill">
          {survey.hasResponded ? <CheckCircle2 size={22} /> : <ClipboardList size={22} />}
        </div>
        <Badge variant={survey.hasResponded ? 'success' : 'warning'}>
          {survey.hasResponded ? 'Đã hoàn thành' : 'Cần hoàn thành'}
        </Badge>
      </div>
      <div>
        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-primary-600)',
            marginBottom: '6px',
          }}
        >
          {survey.type === 'BASELINE' ? 'Khảo sát thực trạng' : 'Khảo sát sau sự kiện'}
        </span>
        <h3>{survey.title}</h3>
      </div>
      <p className="student-survey-desc">
        {survey.description || 'Khảo sát đóng góp ý kiến xây dựng hoạt động học đường.'}
      </p>
      <div className="student-survey-card-footer">
        <span className="student-survey-info-meta">
          <Clock size={13} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
          Bảo mật & Khách quan
        </span>
        <Button
          size="small"
          variant={survey.hasResponded ? 'secondary' : 'primary'}
          icon={survey.hasResponded ? <Check size={14} /> : <ArrowRight size={14} />}
          onClick={() => onNavigate('Khảo sát')}
        >
          {survey.hasResponded ? 'Xem lại' : 'Làm khảo sát'}
        </Button>
      </div>
    </div>
  )
}

export function StudentActivities({ onNavigate, guestMode = false }: { onNavigate: (page: string) => void; guestMode?: boolean }) {
  const { user, accessToken } = useAuth()
  const [activities, setActivities] = useState<StudentActivity[]>([])
  const [surveys, setSurveys] = useState<StudentSurvey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'EVENTS' | 'SURVEYS'>('ALL')
  const [guestSummary, setGuestSummary] = useState<{ main: number; branch: number; surveys: number } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    if (guestMode) {
      fetch(`${API_URL}/api/guest/catalog`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Không thể tải hoạt động')
          setGuestSummary({ main: data.aggregates.mainEventParticipations, branch: data.aggregates.branchEventParticipations, surveys: data.aggregates.publishedSurveys })
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải hoạt động'))
        .finally(() => setLoading(false))
      return
    }
    if (!accessToken) return
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
  }, [accessToken, guestMode])

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])

  const completedSurveys = surveys.filter((s) => s.hasResponded)
  const campusDisplay = user?.campus === 'BRANCH' ? 'Phân hiệu' : 'Điểm chính'

  if (guestMode) {
    return (
      <section className="student-activities">
        <header className="student-page-hero">
          <div className="student-hero-copy">
            <span className="student-hero-kicker"><Sparkles size={15} aria-hidden="true" /> Dấu ấn học sinh · THCS Đông Ngạc</span>
            <h1>Hoạt động &<br /><span>Hành trình học sinh.</span></h1>
            <p>Khách có thể xem thống kê tổng hợp về mức độ tham gia, không xem lịch sử hoặc thông tin của từng học sinh.</p>
            <div className="student-hero-proof"><span><CalendarDays size={16} /> {guestSummary ? guestSummary.main + guestSummary.branch : 0} lượt tham gia toàn trường</span><span><CheckCircle2 size={16} /> {guestSummary?.surveys ?? 0} khảo sát đã công bố</span><span><Eye size={16} /> Dữ liệu tổng hợp, ẩn danh</span></div>
          </div>
          <div className="student-hero-art" aria-hidden="true"><div className="student-hero-orbit student-hero-orbit-one" /><div className="student-hero-orbit student-hero-orbit-two" /><div className="student-hero-core"><GraduationCap size={36} /></div><div className="student-hero-float float-top"><CheckCircle2 size={18} /><span>Ghi nhận tham gia</span></div><div className="student-hero-float float-bottom"><Users size={18} /><span>Gắn kết 2 cơ sở</span></div></div>
        </header>
        {error && <ErrorState title={error} onRetry={load} />}
        <div className="student-activity-stats-strip">
          <div className="student-activity-stat-card"><div className="student-activity-stat-icon"><CalendarDays size={20} /></div><div className="student-activity-stat-copy"><small>Lượt tham gia · Điểm chính</small><strong>{guestSummary?.main ?? 0}</strong></div></div>
          <div className="student-activity-stat-card"><div className="student-activity-stat-icon"><CalendarDays size={20} /></div><div className="student-activity-stat-copy"><small>Lượt tham gia · Phân hiệu</small><strong>{guestSummary?.branch ?? 0}</strong></div></div>
          <div className="student-activity-stat-card"><div className="student-activity-stat-icon"><ClipboardList size={20} /></div><div className="student-activity-stat-copy"><small>Khảo sát đã công bố</small><strong>{guestSummary?.surveys ?? 0}</strong></div></div>
        </div>
        {loading && <LoadingState compact label="Đang tải thống kê..." />}
        {!loading && !error && <EmptyState title="Không có lịch sử cá nhân ở chế độ khách" description="Thống kê trên chỉ phản ánh dữ liệu tổng hợp của toàn trường." compact />}
      </section>
    )
  }

  return (
    <section className="student-activities">
      <header className="student-page-hero">
        <div className="student-hero-copy">
          <span className="student-hero-kicker">
            <Sparkles size={15} aria-hidden="true" />
            Dấu ấn học sinh · THCS Đông Ngạc
          </span>
          <h1>
            Hoạt động &<br />
            <span>Hành trình của tôi.</span>
          </h1>
          <p>
            Theo dõi tất cả sự kiện bạn đã đăng ký tham gia và tiến độ khảo sát đóng góp tiếng nói để cùng xây dựng mái trường ONE SCHOOL ngày một gắn kết.
          </p>
          <div className="student-hero-proof">
            <span><CalendarDays size={16} /> {activities.length} Sự kiện tham gia</span>
            <span><CheckCircle2 size={16} /> {completedSurveys.length} Khảo sát hoàn thành</span>
            <span><GraduationCap size={16} /> {campusDisplay}</span>
          </div>
        </div>
        <div className="student-hero-art" aria-hidden="true">
          <div className="student-hero-orbit student-hero-orbit-one" />
          <div className="student-hero-orbit student-hero-orbit-two" />
          <div className="student-hero-core">
            <GraduationCap size={36} />
          </div>
          <div className="student-hero-float float-top">
            <CheckCircle2 size={18} />
            <span>Ghi nhận tham gia</span>
          </div>
          <div className="student-hero-float float-bottom">
            <Users size={18} />
            <span>Gắn kết 2 cơ sở</span>
          </div>
          <span className="student-hero-dot dot-one" />
          <span className="student-hero-dot dot-two" />
          <span className="student-hero-dot dot-three" />
        </div>
      </header>

      {/* Quick Stats Strip */}
      <div className="student-activity-stats-strip">
        <div className="student-activity-stat-card">
          <div className="student-activity-stat-icon">
            <CalendarDays size={20} />
          </div>
          <div className="student-activity-stat-copy">
            <small>Sự kiện đã đăng ký</small>
            <strong>{activities.length} sự kiện</strong>
          </div>
        </div>

        <div className="student-activity-stat-card">
          <div className="student-activity-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <ClipboardList size={20} />
          </div>
          <div className="student-activity-stat-copy">
            <small>Khảo sát đã gửi</small>
            <strong>{completedSurveys.length} / {surveys.length}</strong>
          </div>
        </div>

        <div className="student-activity-stat-card">
          <div className="student-activity-stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <GraduationCap size={20} />
          </div>
          <div className="student-activity-stat-copy">
            <small>Cơ sở học tập</small>
            <strong>{campusDisplay}</strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="student-filter-toolbar">
        <div className="student-filter-tabs">
          <button
            type="button"
            className={`student-filter-tab ${activeTab === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            Tất cả hoạt động
          </button>
          <button
            type="button"
            className={`student-filter-tab ${activeTab === 'EVENTS' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('EVENTS')}
          >
            Sự kiện ({activities.length})
          </button>
          <button
            type="button"
            className={`student-filter-tab ${activeTab === 'SURVEYS' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('SURVEYS')}
          >
            Khảo sát ({surveys.length})
          </button>
        </div>
      </div>

      {error && <ErrorState title={error} onRetry={load} />}

      {loading ? (
        <LoadingState label="Đang tải hoạt động của bạn..." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          {/* Events Section */}
          {(activeTab === 'ALL' || activeTab === 'EVENTS') && (
            <div className="student-activity-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Sự kiện</p>
                  <h2>Sự kiện bạn đã đăng ký ({activities.length})</h2>
                </div>
                <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Sự kiện')}>
                  Khám phá thêm sự kiện
                </Button>
              </div>

              {activities.length > 0 ? (
                <div className="event-grid">
                  {activities.map((activity) => (
                    <StudentEventCard key={activity.eventId} activity={activity} onNavigate={onNavigate} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <EmptyState
                    icon={<CalendarDays size={22} />}
                    title="Bạn chưa đăng ký sự kiện nào"
                    description="Hãy khám phá các sự kiện giao lưu, câu lạc bộ đang mở để đăng ký tham gia nhé."
                  />
                  <Button size="small" variant="primary" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Sự kiện')}>
                    Khám phá sự kiện
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Surveys Section */}
          {(activeTab === 'ALL' || activeTab === 'SURVEYS') && (
            <div className="student-activity-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Khảo sát</p>
                  <h2>Khảo sát & Tiến độ đóng góp ({surveys.length})</h2>
                </div>
                <Button size="small" variant="ghost" icon={<ArrowRight size={15} />} onClick={() => onNavigate('Khảo sát')}>
                  Xem tất cả khảo sát
                </Button>
              </div>

              {surveys.length > 0 ? (
                <div className="student-survey-grid">
                  {surveys.map((survey) => (
                    <StudentSurveyCard key={survey.id} survey={survey} onNavigate={onNavigate} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<ClipboardList size={22} />}
                  title="Chưa có khảo sát nào"
                  description="Khảo sát được công bố sẽ xuất hiện tại đây để bạn chia sẻ ý kiến."
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
