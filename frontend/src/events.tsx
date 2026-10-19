import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  Edit3,
  FileText,
  ImagePlus,
  MapPin,
  Plus,
  Send,
  Trash2,
  Users,
  X,
  GraduationCap,
  Building2,
  Clock,
  Compass,
  Target,
  Sparkles,
  CheckCircle2,
  Share2,
  Award,
  Info,
  Search,
} from 'lucide-react'
import { useAuth } from './auth'
import { eventStatusBadge, type EventStatus } from './event-status'
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Skeleton, Toast } from './components/ui'
import { API_URL } from './api-url'
import { resizeImageBeforeUpload } from './image-utils'

type RegistrationStatus = 'REQUESTED' | 'CONFIRMED' | 'DECLINED'
type Campus = 'MAIN' | 'BRANCH'
type EventItem = {
  id: string; title: string; description: string; objective: string | null; coverImageUrl: string | null
  startAt: string; endAt: string; location: string; deliveryMode: string | null; targetGrades: string[]
  targetCampuses: Campus[]; status: EventStatus; participantCount?: number
  campusCounts?: { MAIN: number; BRANCH: number }; currentRegistration: RegistrationStatus | null; satisfaction?: number | null; baselineSurveyId?: string
}
type EventDetail = EventItem & {
  participants?: Array<{ studentId: string; status: RegistrationStatus; student: { id: string; name: string; email: string; campus: Campus | null } }>
  surveys: Array<{ id: string; type: string; title: string; published: boolean; responseCount: number }>
  baselineSurvey: { id: string; title: string; type: string; published: boolean; responseCount: number } | null
}
type EventForm = {
  title: string; description: string; objective: string; startAt: string; endAt: string; location: string
  deliveryMode: 'OFFLINE' | 'ONLINE' | 'HYBRID'; targetGrades: string; targetCampuses: Campus[]; coverImageUrl: string; baselineSurveyId: string
}
type BaselineSurvey = { id: string; title: string; type: 'BASELINE'; published: boolean }

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options, credentials: 'include',
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${token}`, ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : Array.isArray(body.message) ? body.message[0] : 'Không thể thực hiện thao tác')
  return body as T
}

const emptyForm: EventForm = { title: '', description: '', objective: '', startAt: '', endAt: '', location: '', deliveryMode: 'OFFLINE', targetGrades: '6, 7, 8, 9', targetCampuses: ['MAIN', 'BRANCH'], coverImageUrl: '', baselineSurveyId: '' }
/** Nhãn + màu của tag trạng thái, luôn bám theo thời gian thực của sự kiện. */
function statusBadge(event: Pick<EventItem, 'status' | 'startAt' | 'endAt'>) {
  return eventStatusBadge(event)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatDateFull(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function deliveryModeLabel(mode: string | null) {
  if (mode === 'ONLINE') return 'Trực tuyến'
  if (mode === 'HYBRID') return 'Kết hợp'
  return 'Trực tiếp'
}

function campusesLabel(campuses: Campus[]) {
  if (campuses.includes('MAIN') && campuses.includes('BRANCH')) {
    return 'Cả hai cơ sở (Điểm chính & Phân hiệu)'
  }
  if (campuses.includes('MAIN')) return 'Điểm chính'
  if (campuses.includes('BRANCH')) return 'Phân hiệu'
  return 'Toàn trường'
}

function toDateInput(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function eventPayload(form: EventForm) {
  return {
    title: form.title, description: form.description, objective: form.objective || undefined,
    startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(),
    location: form.location, deliveryMode: form.deliveryMode,
    targetGrades: form.targetGrades.split(',').map((grade) => grade.trim()).filter(Boolean),
    targetCampuses: form.targetCampuses, baselineSurveyId: form.baselineSurveyId, ...(form.coverImageUrl ? { coverImageUrl: form.coverImageUrl } : {}),
  }
}

function EventCard({ event, onOpen, onJoin, isTeacher }: { event: EventItem; onOpen: () => void; onJoin?: () => void; isTeacher: boolean }) {
  const badge = statusBadge(event)
  const isJoined = event.currentRegistration === 'CONFIRMED' || event.currentRegistration === 'REQUESTED'
  const isPending = event.currentRegistration === 'REQUESTED'

  if (!isTeacher) {
    return (
      <article className="student-event-card-modern">
        <div className="student-event-thumb">
          {event.coverImageUrl ? (
            <img src={event.coverImageUrl} alt={`Minh họa sự kiện ${event.title}`} />
          ) : (
            <div className="student-event-thumb-fallback">
              <CalendarDays size={38} aria-hidden="true" />
              <span>Sự kiện</span>
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
              {campusesLabel(event.targetCampuses)}
            </span>
            <span className="event-tag-pill" style={{ padding: '3px 9px', fontSize: '11px' }}>
              <Compass size={12} aria-hidden="true" />
              {deliveryModeLabel(event.deliveryMode)}
            </span>
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
            <Button size="small" variant="secondary" onClick={onOpen}>
              Xem chi tiết
            </Button>
            {onJoin && (
              <Button
                size="small"
                variant={isJoined ? 'secondary' : 'primary'}
                onClick={onJoin}
                disabled={Boolean(event.currentRegistration)}
              >
                {isPending
                  ? 'Chờ duyệt'
                  : isJoined
                    ? 'Đã tham gia'
                    : event.currentRegistration === 'DECLINED'
                      ? 'Chưa duyệt'
                      : 'Tham gia'}
              </Button>
            )}
          </div>
        </div>
      </article>
    )
  }

  const registrationLabel = isJoined ? 'Đã tham gia' : event.currentRegistration === 'DECLINED' ? 'Yêu cầu chưa được xác nhận' : 'Tham gia sự kiện'
  return (
    <Card className="event-card">
      <div className="event-cover">{event.coverImageUrl ? <img src={event.coverImageUrl} alt={`Minh họa sự kiện ${event.title}`} /> : <CalendarDays size={34} aria-hidden="true" />}</div>
      <div className="event-card-body">
        <div className="event-card-title"><h3>{event.title}</h3><Badge variant={badge.variant}>{badge.label}</Badge></div>
        <p className="event-excerpt">{event.description}</p>
        <div className="event-meta"><span><CalendarDays size={15} />{formatDate(event.startAt)}</span><span><MapPin size={15} />{event.location}</span></div>
        <div className="event-card-footer"><span><Users size={15} />{event.participantCount ?? 0} người tham gia</span>{event.satisfaction != null && <strong>{event.satisfaction}/100</strong>}</div>
        <div className="event-actions"><Button size="small" variant="secondary" onClick={onOpen}>Xem chi tiết</Button>{onJoin && <Button size="small" onClick={onJoin} disabled={Boolean(event.currentRegistration)}>{registrationLabel}</Button>}</div>
      </div>
    </Card>
  )
}

function EventFormView({ initial, submitting, baselineSurveys, onSubmit, onCancel, onUpload }: { initial: EventForm; submitting: boolean; baselineSurveys: BaselineSurvey[]; onSubmit: (form: EventForm) => void; onCancel: () => void; onUpload: (file: File) => Promise<string> }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const update = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (form.title.trim().length < 3) { setError('Tên sự kiện phải có ít nhất 3 ký tự'); return }
    if (!form.description.trim() || !form.location.trim() || !form.startAt || !form.endAt) { setError('Vui lòng điền đầy đủ thông tin bắt buộc'); return }
    if (new Date(form.endAt) <= new Date(form.startAt)) { setError('Thời gian kết thúc phải sau thời gian bắt đầu'); return }
    if (!form.targetGrades.split(',').some((grade) => grade.trim())) { setError('Cần chọn ít nhất một khối/lớp'); return }
    if (!form.targetCampuses.length) { setError('Cần chọn ít nhất một cơ sở'); return }
    if (!form.baselineSurveyId) { setError('Cần chọn khảo sát thực trạng trước khi tạo sự kiện'); return }
    onSubmit(form)
  }
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const resized = await resizeImageBeforeUpload(file, 1200, 0.85)
      update('coverImageUrl', await onUpload(resized))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải ảnh lên')
    } finally {
      setUploading(false)
    }
  }
  return (
    <form className="event-form" onSubmit={submit}>
      <div className="form-section"><div><h3>Thông tin cơ bản</h3></div><Input label="Tên sự kiện *" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ví dụ: Hoạt động kết nối hai cơ sở" /><label className="field"><span className="field-label">Mô tả *</span><textarea className="input textarea" rows={4} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Mô tả ngắn gọn nội dung hoạt động" /></label><label className="field"><span className="field-label">Mục tiêu / tiêu chí cần cải thiện</span><textarea className="input textarea" rows={3} value={form.objective} onChange={(event) => update('objective', event.target.value)} placeholder="Ví dụ: Cải thiện cơ hội giao lưu giữa hai cơ sở" /></label><label className="field"><span className="field-label">Khảo sát thực trạng *</span><select className="input" value={form.baselineSurveyId} onChange={(event) => update('baselineSurveyId', event.target.value)}><option value="">Chọn khảo sát đã công bố</option>{baselineSurveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title}</option>)}</select></label></div>
      <div className="form-section"><div><h3>Thời gian & địa điểm</h3></div><div className="form-grid"><Input label="Bắt đầu *" type="datetime-local" value={form.startAt} onChange={(event) => update('startAt', event.target.value)} /><Input label="Kết thúc *" type="datetime-local" value={form.endAt} onChange={(event) => update('endAt', event.target.value)} /></div><Input label="Địa điểm / đường dẫn *" value={form.location} onChange={(event) => update('location', event.target.value)} /><label className="field"><span className="field-label">Hình thức</span><select className="input" value={form.deliveryMode} onChange={(event) => update('deliveryMode', event.target.value as EventForm['deliveryMode'])}><option value="OFFLINE">Trực tiếp</option><option value="ONLINE">Trực tuyến</option><option value="HYBRID">Kết hợp</option></select></label></div>
      <div className="form-section"><div><h3>Đối tượng tham gia</h3></div><Input label="Khối/lớp *" hint="Phân cách bằng dấu phẩy, ví dụ: 6, 7, 8" value={form.targetGrades} onChange={(event) => update('targetGrades', event.target.value)} /><div className="checkbox-group"><span className="field-label">Cơ sở được mời *</span>{(['MAIN', 'BRANCH'] as Campus[]).map((campus) => <label key={campus}><input type="checkbox" checked={form.targetCampuses.includes(campus)} onChange={(event) => update('targetCampuses', event.target.checked ? [...form.targetCampuses, campus] : form.targetCampuses.filter((item) => item !== campus))} />{campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'}</label>)}</div></div>
      <div className="form-section">
        <div>
          <h3>Hình ảnh bìa sự kiện</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
            Ảnh tự động thu nhỏ tối ưu dung lượng và hiển thị trọn vẹn nội dung (không bị cắt xén).
          </p>
        </div>
        {form.coverImageUrl && (
          <div className="image-preview-card">
            <div className="image-preview-frame">
              <img className="event-image-preview" src={form.coverImageUrl} alt="Ảnh bìa sự kiện" />
            </div>
            <button
              type="button"
              className="image-preview-remove-btn"
              onClick={() => update('coverImageUrl', '')}
              title="Xóa ảnh bìa"
            >
              <Trash2 size={13} /> Xóa ảnh
            </button>
          </div>
        )}
        <label className="upload-control">
          <ImagePlus size={17} />
          {uploading ? 'Đang xử lý & tải ảnh...' : form.coverImageUrl ? 'Đổi ảnh bìa khác' : 'Chọn ảnh bìa'}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
              event.target.value = ''
            }}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>Hủy</Button><Button type="submit" loading={submitting || uploading}>Lưu bản nháp</Button></div>
    </form>
  )
}

export function EventManagement({
  role,
  initialCreateData,
  onClearInitialCreateData,
  initialEventId,
  onOpenSurvey,
  hideDetailBackButton = false,
}: {
  role: 'teacher' | 'student'
  initialCreateData?: { title?: string; objective?: string; baselineSurveyId?: string } | null
  onClearInitialCreateData?: () => void
  initialEventId?: string | null
  onOpenSurvey?: (surveyId: string) => void
  hideDetailBackButton?: boolean
}) {
  const { accessToken } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [creatingSurvey, setCreatingSurvey] = useState(false)
  const [publishingSurvey, setPublishingSurvey] = useState(false)
  const [baselineSurveys, setBaselineSurveys] = useState<BaselineSurvey[]>([])
  const [aiPreset, setAiPreset] = useState<{ title?: string; objective?: string; baselineSurveyId?: string } | null>(null)

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (initialCreateData) {
      setAiPreset(initialCreateData)
      setEditing(null)
      setFormOpen(true)
      onClearInitialCreateData?.()
    }
  }, [initialCreateData, onClearInitialCreateData])

  const openDetail = useCallback(async (id: string) => {
    if (!accessToken) return
    try {
      setSelected(await request<EventDetail>(`/events/${id}`, accessToken))
    } catch (reason) {
      setToast({
        title: 'Không thể tải chi tiết',
        message: reason instanceof Error ? reason.message : 'Vui lòng thử lại',
        variant: 'error',
      })
    }
  }, [accessToken])

  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true); setError('')
    request<EventItem[]>('/events', accessToken)
      .then((items) => {
        setEvents(items)
        if (initialEventId) {
          void openDetail(initialEventId)
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải sự kiện'))
      .finally(() => setLoading(false))
  }, [accessToken, initialEventId, openDetail])
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!accessToken || role !== 'teacher') return
    request<BaselineSurvey[]>('/surveys', accessToken).then((items) => setBaselineSurveys(items.filter((item) => item.type === 'BASELINE' && item.published))).catch(() => setBaselineSurveys([]))
  }, [accessToken, role])
  const submitForm = async (form: EventForm) => {
    if (!accessToken) return
    setSubmitting(true)
    try {
      const payload = eventPayload(form)
      const result = await request<EventItem>(editing ? `/events/${editing.id}` : '/events', accessToken, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setFormOpen(false); setEditing(null); setToast({ title: 'Đã lưu sự kiện', message: 'Sự kiện đã được lưu ở trạng thái bản nháp.', variant: 'success' }); await load(); setSelected(null); void openDetail(result.id)
    } catch (reason) { setToast({ title: 'Không thể lưu', message: reason instanceof Error ? reason.message : 'Vui lòng kiểm tra lại thông tin', variant: 'error' }) } finally { setSubmitting(false) }
  }
  const uploadImage = async (file: File) => {
    if (!accessToken) throw new Error('Phiên đăng nhập đã hết hạn')
    const resized = await resizeImageBeforeUpload(file, 1200, 0.85)
    const body = new FormData(); body.append('file', resized)
    const result = await request<{ url: string }>('/uploads/image', accessToken, { method: 'POST', body })
    return result.url
  }
  const publish = async () => {
    if (!accessToken || !selected) return
    try { await request(`/events/${selected.id}/publish`, accessToken, { method: 'POST' }); setToast({ title: 'Đã công bố', message: 'Học sinh có thể xem và gửi yêu cầu tham gia.', variant: 'success' }); setSelected(null); await load() } catch (reason) { setToast({ title: 'Không thể công bố', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' }) }
  }
  const remove = async () => {
    if (!accessToken || !selected) return
    try { await request(`/events/${selected.id}`, accessToken, { method: 'DELETE' }); setConfirmDelete(false); setSelected(null); setToast({ title: 'Đã xóa bản nháp', message: 'Sự kiện đã được xóa.', variant: 'success' }); await load() } catch (reason) { setToast({ title: 'Không thể xóa', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' }) }
  }
  const createPostEventSurvey = async () => {
    if (!accessToken || !selected) return
    setCreatingSurvey(true)
    try {
      await request(`/events/${selected.id}/surveys`, accessToken, { method: 'POST' })
      setSelected(await request<EventDetail>(`/events/${selected.id}`, accessToken))
      setToast({ title: 'Đã tạo khảo sát sau', message: 'Khảo sát sau sự kiện đã được thêm vào chu kỳ cải thiện.', variant: 'success' })
      await load()
    } catch (reason) {
      setToast({ title: 'Không thể tạo khảo sát sau', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' })
    } finally { setCreatingSurvey(false) }
  }
  const publishPostEventSurvey = async () => {
    if (!accessToken || !selected) return
    const survey = selected.surveys.find((item) => item.type === 'POST_EVENT')
    if (!survey) return
    setPublishingSurvey(true)
    try {
      await request(`/surveys/${survey.id}/publish`, accessToken, { method: 'POST' })
      setSelected(await request<EventDetail>(`/events/${selected.id}`, accessToken))
      setToast({ title: 'Đã công bố khảo sát sau', message: 'Học sinh đủ điều kiện có thể trả lời sau khi sự kiện kết thúc.', variant: 'success' })
      await load()
    } catch (reason) {
      setToast({ title: 'Không thể công bố khảo sát', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' })
    } finally { setPublishingSurvey(false) }
  }
  const updateRegistration = async (studentId: string, registrationStatus: 'CONFIRMED' | 'DECLINED') => {
    if (!accessToken || !selected) return
    try { await request(`/events/${selected.id}/participants/${studentId}`, accessToken, { method: 'PATCH', body: JSON.stringify({ status: registrationStatus }) }); setSelected(await request<EventDetail>(`/events/${selected.id}`, accessToken)); setToast({ title: 'Đã cập nhật đăng ký', message: registrationStatus === 'CONFIRMED' ? 'Học sinh đã được xác nhận tham gia.' : 'Yêu cầu đã được từ chối.', variant: 'success' }) } catch (reason) { setToast({ title: 'Không thể cập nhật', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' }) }
  }
  const initialForm = useMemo<EventForm>(
    () =>
      editing
        ? {
            title: editing.title,
            description: editing.description,
            objective: editing.objective ?? '',
            startAt: toDateInput(editing.startAt),
            endAt: toDateInput(editing.endAt),
            location: editing.location,
            deliveryMode: (editing.deliveryMode as EventForm['deliveryMode']) || 'OFFLINE',
            targetGrades: editing.targetGrades.join(', '),
            targetCampuses: editing.targetCampuses,
            coverImageUrl: editing.coverImageUrl ?? '',
            baselineSurveyId: editing.baselineSurveyId ?? '',
          }
        : aiPreset
          ? {
              ...emptyForm,
              title: aiPreset.title ?? '',
              objective: aiPreset.objective ?? '',
              baselineSurveyId: aiPreset.baselineSurveyId ?? '',
            }
          : emptyForm,
    [editing, aiPreset],
  )
  const handleJoin = async () => {
    if (!accessToken || !selected) return
    try {
      await request(`/events/${selected.id}/join`, accessToken, { method: 'POST' })
      setToast({ title: 'Đã tham gia sự kiện', message: 'Bạn đã được ghi nhận tham gia hoạt động.', variant: 'success' })
      await load()
      void openDetail(selected.id)
    } catch (reason) {
      setToast({ title: 'Không thể tham gia', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' })
    }
  }

  const [eventFilter, setEventFilter] = useState<'ALL' | 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'JOINED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const isTeacher = role === 'teacher'

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const badge = statusBadge(ev)
      if (eventFilter === 'UPCOMING' && badge.label !== 'Sắp diễn ra') return false
      if (eventFilter === 'LIVE' && badge.label !== 'Đang diễn ra') return false
      if (eventFilter === 'COMPLETED' && badge.label !== 'Đã kết thúc') return false
      if (eventFilter === 'JOINED' && !ev.currentRegistration) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = ev.title.toLowerCase().includes(q)
        const matchLoc = ev.location.toLowerCase().includes(q)
        const matchDesc = ev.description.toLowerCase().includes(q)
        if (!matchTitle && !matchLoc && !matchDesc) return false
      }
      return true
    })
  }, [events, eventFilter, searchQuery])

  return (
    <section className="events-page">
      {selected ? (
        <EventDetailView
          selected={selected}
          isTeacher={isTeacher}
          onBack={() => setSelected(null)}
          hideBackButton={hideDetailBackButton}
          onEdit={() => { setEditing(selected); setSelected(null); setFormOpen(true) }}
          onDelete={() => setConfirmDelete(true)}
          onPublish={() => void publish()}
          onUpdate={(studentId, registrationStatus) => void updateRegistration(studentId, registrationStatus)}
          creatingSurvey={creatingSurvey}
          publishingSurvey={publishingSurvey}
          onCreatePostSurvey={() => void createPostEventSurvey()}
          onPublishPostSurvey={() => void publishPostEventSurvey()}
          onOpenSurvey={onOpenSurvey ?? (() => {})}
          onJoin={!isTeacher && !selected.currentRegistration ? () => void handleJoin() : undefined}
          onShare={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(window.location.href)
              setToast({ title: 'Đã sao chép liên kết', message: 'Liên kết sự kiện đã được lưu vào bộ nhớ tạm.', variant: 'success' })
            } else {
              setToast({ title: 'Chia sẻ sự kiện', message: window.location.href, variant: 'success' })
            }
          }}
        />
      ) : (
      <>
        {isTeacher ? (
          <header className="student-page-hero">
            <div className="student-hero-copy">
              <span className="student-hero-kicker">
                <CalendarDays size={14} aria-hidden="true" /> Kế hoạch hoạt động · Quản trị THCS Đông Ngạc
              </span>
              <h1>
                Quản lý sự kiện &<br />
                <span>Hoạt động kết nối hai cơ sở.</span>
              </h1>
              <p>
                Tổ chức các hoạt động trải nghiệm, sinh hoạt chuyên đề và giao lưu nhằm thu hẹp khoảng cách giữa Điểm chính và Phân hiệu.
              </p>
              <div className="teacher-hero-actions">
                <Button icon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true) }}>
                  Tạo sự kiện mới
                </Button>
              </div>
              <div className="student-hero-proof">
                <span><CalendarDays size={16} /> {events.length} sự kiện trong hệ thống</span>
                <span><Compass size={16} /> Điểm chính × Phân hiệu</span>
                <span><Users size={16} /> Giám sát & Đánh giá</span>
              </div>
            </div>
            <div className="student-hero-art" aria-hidden="true">
              <div className="student-hero-orbit student-hero-orbit-one" />
              <div className="student-hero-orbit student-hero-orbit-two" />
              <div className="student-hero-core">
                <CalendarDays size={36} />
              </div>
              <div className="student-hero-float float-top">
                <Sparkles size={18} />
                <span>Kế hoạch hoạt động</span>
              </div>
              <div className="student-hero-float float-bottom">
                <Users size={18} />
                <span>Gắn kết học sinh</span>
              </div>
              <span className="student-hero-dot dot-one" />
              <span className="student-hero-dot dot-two" />
              <span className="student-hero-dot dot-three" />
            </div>
          </header>
        ) : (
          <header className="student-page-hero">
            <div className="student-hero-copy">
              <span className="student-hero-kicker">
                <Sparkles size={14} aria-hidden="true" /> KẾT NỐI HAI CƠ SỞ · HOẠT ĐỘNG THCS ĐÔNG NGẠC
              </span>
              <h1>
                Trải nghiệm học tập,<br />
                <span>gắn kết cùng bạn bè.</span>
              </h1>
              <p>
                Khám phá các hoạt động ngoại khóa, câu lạc bộ và phong trào rèn luyện kỹ năng kết nối học sinh Điểm chính và Phân hiệu.
              </p>
              <div className="student-hero-proof">
                <span><CalendarDays size={16} /> {events.length} sự kiện đang mở</span>
                <span><Compass size={16} /> Điểm chính × Phân hiệu</span>
                <span><Users size={16} /> Giao lưu & Học hỏi</span>
              </div>
            </div>
            <div className="student-hero-art" aria-hidden="true">
              <div className="student-hero-orbit student-hero-orbit-one" />
              <div className="student-hero-orbit student-hero-orbit-two" />
              <div className="student-hero-core">
                <CalendarDays size={36} />
              </div>
              <div className="student-hero-float float-top">
                <Compass size={18} />
                <span>Giao lưu bạn mới</span>
              </div>
              <div className="student-hero-float float-bottom">
                <GraduationCap size={18} />
                <span>Cùng nhau tiến bộ</span>
              </div>
              <span className="student-hero-dot dot-one" />
              <span className="student-hero-dot dot-two" />
              <span className="student-hero-dot dot-three" />
            </div>
          </header>
        )}

        {events.length > 0 && (
          <div className="student-filter-toolbar">
            <div className="student-filter-tabs">
              <button
                type="button"
                className={`student-filter-tab ${eventFilter === 'ALL' ? 'is-active' : ''}`}
                onClick={() => setEventFilter('ALL')}
              >
                Tất cả ({events.length})
              </button>
              <button
                type="button"
                className={`student-filter-tab ${eventFilter === 'UPCOMING' ? 'is-active' : ''}`}
                onClick={() => setEventFilter('UPCOMING')}
              >
                Sắp diễn ra ({events.filter((e) => statusBadge(e).label === 'Sắp diễn ra').length})
              </button>
              <button
                type="button"
                className={`student-filter-tab ${eventFilter === 'LIVE' ? 'is-active' : ''}`}
                onClick={() => setEventFilter('LIVE')}
              >
                Đang diễn ra ({events.filter((e) => statusBadge(e).label === 'Đang diễn ra').length})
              </button>
              {isTeacher ? (
                <button
                  type="button"
                  className={`student-filter-tab ${eventFilter === 'COMPLETED' ? 'is-active' : ''}`}
                  onClick={() => setEventFilter('COMPLETED')}
                >
                  Đã kết thúc ({events.filter((e) => statusBadge(e).label === 'Đã kết thúc').length})
                </button>
              ) : (
                <button
                  type="button"
                  className={`student-filter-tab ${eventFilter === 'JOINED' ? 'is-active' : ''}`}
                  onClick={() => setEventFilter('JOINED')}
                >
                  Đã đăng ký ({events.filter((e) => Boolean(e.currentRegistration)).length})
                </button>
              )}
            </div>
            <label className="student-search-box">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                placeholder="Tìm sự kiện theo tên, địa điểm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm sự kiện"
              />
            </label>
          </div>
        )}

        {loading && <div className="event-grid">{[1, 2, 3].map((item) => <Card key={item}><Skeleton /><Skeleton width="75%" /><Skeleton width="55%" /></Card>)}</div>}
        {!loading && error && <ErrorState title={error} onRetry={load} />}
        {!loading && !error && events.length === 0 && (
          <EmptyState
            title={isTeacher ? 'Chưa có sự kiện' : 'Chưa có hoạt động phù hợp'}
            description={isTeacher ? 'Tạo sự kiện đầu tiên để bắt đầu vòng cải thiện.' : 'Các hoạt động đã công bố sẽ xuất hiện tại đây.'}
            icon={<CalendarDays size={22} />}
          />
        )}
        {!loading && !error && events.length > 0 && filteredEvents.length === 0 && (
          <EmptyState
            title="Không tìm thấy sự kiện phù hợp"
            description="Hãy thử từ khóa tìm kiếm hoặc bộ lọc khác xem sao nhé."
            icon={<Search size={22} />}
          />
        )}
        {!loading && !error && filteredEvents.length > 0 && (
          <div className="event-grid">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isTeacher={isTeacher}
                onOpen={() => void openDetail(event.id)}
                onJoin={
                  !isTeacher && !event.currentRegistration
                    ? () => {
                        if (!accessToken) return
                        request(`/events/${event.id}/join`, accessToken, { method: 'POST' })
                          .then(() => {
                            setToast({ title: 'Đã tham gia sự kiện', message: 'Bạn đã được ghi nhận tham gia hoạt động.', variant: 'success' })
                            load()
                          })
                          .catch((reason) =>
                            setToast({
                              title: 'Không thể tham gia',
                              message: reason instanceof Error ? reason.message : 'Vui lòng thử lại',
                              variant: 'error',
                            })
                          )
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </>
      )}
      <Modal open={formOpen} title={editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện'} onClose={() => { setFormOpen(false); setEditing(null) }}><EventFormView initial={initialForm} baselineSurveys={baselineSurveys.filter((survey) => !events.some((event) => event.id !== editing?.id && event.baselineSurveyId === survey.id))} submitting={submitting} onSubmit={submitForm} onCancel={() => { setFormOpen(false); setEditing(null) }} onUpload={uploadImage} /></Modal>
      <Modal open={confirmDelete} title="Xóa bản nháp sự kiện?" onClose={() => setConfirmDelete(false)}><p>Thao tác này không thể hoàn tác. Bạn có chắc muốn xóa sự kiện này không?</p><div className="form-actions"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Hủy</Button><Button variant="danger" onClick={() => void remove()}>Xóa bản nháp</Button></div></Modal>
      {toast && <Toast title={toast.title} message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </section>
  )
}

function EventDetailView({
  selected,
  isTeacher,
  onBack,
  hideBackButton,
  onEdit,
  onDelete,
  onPublish,
  onUpdate,
  creatingSurvey,
  publishingSurvey,
  onCreatePostSurvey,
  onPublishPostSurvey,
  onOpenSurvey,
  onJoin,
  onShare,
}: {
  selected: EventDetail
  isTeacher: boolean
  onBack: () => void
  hideBackButton: boolean
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
  onUpdate: (studentId: string, status: 'CONFIRMED' | 'DECLINED') => void
  creatingSurvey: boolean
  publishingSurvey: boolean
  onCreatePostSurvey: () => void
  onPublishPostSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
  onJoin?: () => void
  onShare?: () => void
}) {
  const badge = statusBadge(selected)
  const isDraft = isTeacher && selected.status === 'DRAFT'

  return (
    <div className="event-detail-page">
      {/* Top navigation & action bar */}
      <div className="event-detail-topbar">
        {!hideBackButton && (
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={16} /> Danh sách sự kiện
          </button>
        )}
        <div className="event-detail-topbar-actions">
          {onShare && (
            <Button size="small" variant="secondary" icon={<Share2 size={15} />} onClick={onShare}>
              Chia sẻ
            </Button>
          )}
          {isDraft && (
            <>
              <Button size="small" variant="secondary" icon={<Edit3 size={15} />} onClick={onEdit}>
                Sửa
              </Button>
              <Button size="small" variant="danger" icon={<Trash2 size={15} />} onClick={onDelete}>
                Xóa
              </Button>
              <Button size="small" onClick={onPublish}>
                Công bố
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hero Showcase Card */}
      <section className="event-detail-hero-showcase">
        <div className="event-detail-cover-showcase">
          {selected.coverImageUrl ? (
            <img src={selected.coverImageUrl} alt={`Minh họa sự kiện ${selected.title}`} />
          ) : (
            <div className="event-detail-cover-fallback">
              <CalendarDays size={56} aria-hidden="true" />
              <span>Sự kiện ONE SCHOOL</span>
            </div>
          )}
          <div className="event-cover-badge-overlay">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </div>

        <div className="event-detail-hero-content">
          <p className="eyebrow">Hoạt động kết nối ONE SCHOOL — THCS Đông Ngạc</p>
          <h1 className="event-detail-title">{selected.title}</h1>

          {/* Badges strip */}
          <div className="event-detail-tags">
            <span className="event-tag-pill">
              <Building2 size={14} aria-hidden="true" />
              {campusesLabel(selected.targetCampuses)}
            </span>
            <span className="event-tag-pill">
              <GraduationCap size={14} aria-hidden="true" />
              {selected.targetGrades.map((g) => `Khối ${g}`).join(', ')}
            </span>
            <span className="event-tag-pill">
              <Compass size={14} aria-hidden="true" />
              {deliveryModeLabel(selected.deliveryMode)}
            </span>
          </div>
        </div>
      </section>

      {/* 4 Stat Highlights */}
      <section className="event-highlights-strip" aria-label="Thông số hoạt động">
        <div className="event-highlight-card">
          <div className="event-highlight-icon">
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <div className="event-highlight-copy">
            <small>Thời gian bắt đầu</small>
            <strong>{formatDateFull(selected.startAt)}</strong>
            <span className="event-highlight-sub">Kết thúc: {formatDateFull(selected.endAt)}</span>
          </div>
        </div>

        <div className="event-highlight-card">
          <div className="event-highlight-icon">
            <MapPin size={20} aria-hidden="true" />
          </div>
          <div className="event-highlight-copy">
            <small>Địa điểm tổ chức</small>
            <strong>{selected.location}</strong>
            <span className="event-highlight-sub">{deliveryModeLabel(selected.deliveryMode)}</span>
          </div>
        </div>

        <div className="event-highlight-card">
          <div className="event-highlight-icon">
            <Building2 size={20} aria-hidden="true" />
          </div>
          <div className="event-highlight-copy">
            <small>Cơ sở tham gia</small>
            <strong>{campusesLabel(selected.targetCampuses)}</strong>
            <span className="event-highlight-sub">{selected.targetGrades.map((g) => `Khối ${g}`).join(', ')}</span>
          </div>
        </div>

        <div className="event-highlight-card">
          <div className="event-highlight-icon">
            <Users size={20} aria-hidden="true" />
          </div>
          <div className="event-highlight-copy">
            <small>{isTeacher ? 'Người tham gia' : 'Trạng thái tham gia'}</small>
            {isTeacher ? (
              <>
                <strong>{selected.participantCount ?? 0} học sinh xác nhận</strong>
                <span className="event-highlight-sub">
                  {selected.campusCounts?.MAIN ?? 0} Điểm chính · {selected.campusCounts?.BRANCH ?? 0} Phân hiệu
                </span>
              </>
            ) : (
              <>
                <strong>
                  {selected.currentRegistration === 'CONFIRMED'
                    ? 'Đã xác nhận tham gia'
                    : selected.currentRegistration === 'REQUESTED'
                      ? 'Đang chờ duyệt'
                      : 'Chưa đăng ký'}
                </strong>
                <span className="event-highlight-sub">
                  {selected.currentRegistration === 'CONFIRMED'
                    ? 'Bạn đã sẵn sàng tham gia hoạt động'
                    : 'Nhấn đăng ký ở khung bên phải'}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="event-detail-layout">
        {/* Main Column */}
        <div className="event-detail-main">
          {/* Detailed description */}
          <Card className="event-section-card">
            <div className="event-section-header">
              <Info size={18} className="event-section-icon" aria-hidden="true" />
              <h2>Giới thiệu hoạt động</h2>
            </div>
            <p className="event-detail-description">{selected.description}</p>

            {selected.objective && (
              <div className="event-objective-box">
                <div className="event-objective-header">
                  <Target size={18} aria-hidden="true" />
                  <strong>Mục tiêu cải thiện & Kết nối hai cơ sở</strong>
                </div>
                <p>{selected.objective}</p>
              </div>
            )}
          </Card>

          {/* Guidelines box */}
          <Card className="event-section-card event-guidelines-card">
            <div className="event-section-header">
              <Sparkles size={18} className="event-section-icon" aria-hidden="true" />
              <h2>Lưu ý & Tinh thần tham gia</h2>
            </div>
            <div className="event-guidelines-list">
              <div className="event-guideline-item">
                <CheckCircle2 size={16} className="guideline-check" aria-hidden="true" />
                <div>
                  <strong>Đúng giờ & chuẩn bị chu đáo</strong>
                  <p>Học sinh có mặt trước giờ bắt đầu 10 phút, kiểm tra thiết bị nếu tham gia trực tuyến.</p>
                </div>
              </div>
              <div className="event-guideline-item">
                <CheckCircle2 size={16} className="guideline-check" aria-hidden="true" />
                <div>
                  <strong>Chủ động giao lưu giữa hai cơ sở</strong>
                  <p>Tích cực trao đổi, chia sẻ và kết bạn giữa học sinh Điểm chính và Phân hiệu.</p>
                </div>
              </div>
              <div className="event-guideline-item">
                <CheckCircle2 size={16} className="guideline-check" aria-hidden="true" />
                <div>
                  <strong>Tham gia khảo sát sau sự kiện</strong>
                  <p>Mỗi ý kiến đóng góp giúp nhà trường đo lường hiệu quả và nâng cao chất lượng hoạt động sau.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Teacher sections: Survey pair & Participants */}
          {isTeacher ? (
            <>
              <SurveyPairSection
                selected={selected}
                creatingSurvey={creatingSurvey}
                publishingSurvey={publishingSurvey}
                onCreatePostSurvey={onCreatePostSurvey}
                onPublishPostSurvey={onPublishPostSurvey}
                onOpenSurvey={onOpenSurvey}
              />
              <ParticipantList selected={selected} onUpdate={onUpdate} />
            </>
          ) : (
            <StudentPostSurvey selected={selected} onOpenSurvey={onOpenSurvey} />
          )}
        </div>

        {/* Sidebar Column */}
        <aside className="event-detail-sidebar">
          {/* Action Card for Student */}
          {!isTeacher && (
            <Card className="event-sidebar-widget event-action-widget">
              <div className="event-action-widget-header">
                <h3>Tham gia sự kiện</h3>
                <p>Cùng các bạn học sinh hai cơ sở gắn kết và học hỏi trải nghiệm mới.</p>
              </div>

              {selected.currentRegistration === 'CONFIRMED' ? (
                <div className="event-reg-confirmed">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  <div>
                    <strong>Đã xác nhận tham gia!</strong>
                    <p>Hãy lưu lại lịch và sẵn sàng tham gia cùng bạn bè nhé.</p>
                  </div>
                </div>
              ) : selected.currentRegistration === 'REQUESTED' ? (
                <div className="event-reg-pending">
                  <Clock size={24} aria-hidden="true" />
                  <div>
                    <strong>Đã gửi yêu cầu tham gia</strong>
                    <p>Giáo viên phụ trách đang xác nhận danh sách tham gia.</p>
                  </div>
                </div>
              ) : onJoin ? (
                <Button className="event-join-button" onClick={onJoin}>
                  Đăng ký tham gia ngay
                </Button>
              ) : (
                <Button className="event-join-button" disabled>
                  Chưa mở đăng ký
                </Button>
              )}
            </Card>
          )}

          {/* Satisfaction score badge if teacher */}
          {isTeacher && selected.satisfaction != null && (
            <Card className="event-sidebar-widget event-satisfaction-widget">
              <div className="satisfaction-widget-head">
                <Award size={22} aria-hidden="true" />
                <span>Điểm hài lòng sự kiện</span>
              </div>
              <div className="satisfaction-widget-score">
                <strong>{selected.satisfaction}</strong>
                <span>/ 100</span>
              </div>
              <p>Đo lường từ kết quả khảo sát sau sự kiện của cả hai cơ sở.</p>
            </Card>
          )}

          {/* Organizer Card */}
          <Card className="event-sidebar-widget">
            <div className="event-organizer-head">
              <div className="organizer-avatar">OS</div>
              <div>
                <strong>Trường THCS Đông Ngạc</strong>
                <span className="organizer-sub">Dự án ONE SCHOOL</span>
              </div>
            </div>
            <p className="organizer-desc">
              Chương trình phối hợp chuyên môn và phong trào nhằm thu hẹp khoảng cách, tạo sự kết nối bền vững giữa Điểm chính và Phân hiệu.
            </p>
          </Card>

          {/* Quick Support Card */}
          <Card className="event-sidebar-widget event-support-card">
            <h4>Cần hỗ trợ thông tin?</h4>
            <p>Liên hệ Ban tổ chức hoặc giáo viên chủ nhiệm nếu bạn có thắc mắc về phương tiện di chuyển hoặc lịch trình.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SurveyPairSection({
  selected,
  creatingSurvey,
  publishingSurvey,
  onCreatePostSurvey,
  onPublishPostSurvey,
  onOpenSurvey,
}: {
  selected: EventDetail
  creatingSurvey: boolean
  publishingSurvey: boolean
  onCreatePostSurvey: () => void
  onPublishPostSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
}) {
  const postSurvey = selected.surveys.find((survey) => survey.type === 'POST_EVENT') ?? null
  const baseline = selected.baselineSurvey

  return (
    <Card className="event-section-card survey-pair-panel">
      <div className="section-heading">
        <div>
          <div className="section-title-with-badge">
            <ClipboardList size={18} className="event-section-icon" aria-hidden="true" />
            <h2>Cặp khảo sát trước – sau chu kỳ</h2>
          </div>
          <p className="section-subtitle">
            Khảo sát thực trạng đo mức độ kết nối ban đầu; khảo sát sau sự kiện đo lường mức độ cải thiện và điểm hài lòng.
          </p>
        </div>
        {!postSurvey && (
          <Button size="small" icon={<Plus size={15} />} loading={creatingSurvey} onClick={onCreatePostSurvey}>
            Tạo khảo sát sau
          </Button>
        )}
      </div>

      {!baseline && (
        <div className="survey-warning-notice">
          <Info size={16} aria-hidden="true" />
          <span>Sự kiện chưa gắn khảo sát thực trạng. Hãy tạo và công bố khảo sát thực trạng để hoàn thành cặp đo lường.</span>
        </div>
      )}

      <div className="survey-cycle-grid">
        {/* Step 1: Baseline */}
        <div className="survey-cycle-step">
          <div className="survey-cycle-step-badge">
            <span>Bước 1</span>
            <strong>Khảo sát thực trạng</strong>
          </div>
          <div className="survey-cycle-card">
            <div className="survey-cycle-head">
              <Badge variant={baseline ? (baseline.published ? 'success' : 'warning') : 'neutral'}>
                {baseline ? (baseline.published ? 'Đã công bố' : 'Bản nháp') : 'Chưa gắn'}
              </Badge>
              {baseline && <span className="response-count-pill">{baseline.responseCount} phản hồi</span>}
            </div>
            <strong className="survey-cycle-title">
              {baseline?.title ?? 'Chưa có khảo sát thực trạng'}
            </strong>
            <p className="survey-cycle-hint">
              Đo lường mức độ kết nối và thực trạng học sinh trước khi tổ chức hoạt động.
            </p>
            {baseline && (
              <div className="survey-cycle-action">
                <Button
                  size="small"
                  variant="secondary"
                  icon={<FileText size={14} />}
                  onClick={() => onOpenSurvey(baseline.id)}
                >
                  {baseline.published ? 'Xem kết quả' : 'Chỉnh sửa'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Post Event */}
        <div className="survey-cycle-step">
          <div className="survey-cycle-step-badge">
            <span>Bước 2</span>
            <strong>Khảo sát sau sự kiện</strong>
          </div>
          <div className="survey-cycle-card">
            <div className="survey-cycle-head">
              <Badge variant={postSurvey ? (postSurvey.published ? 'success' : 'warning') : 'neutral'}>
                {postSurvey ? (postSurvey.published ? 'Đã công bố' : 'Bản nháp') : 'Chưa tạo'}
              </Badge>
              {postSurvey && <span className="response-count-pill">{postSurvey.responseCount} phản hồi</span>}
            </div>
            <strong className="survey-cycle-title">
              {postSurvey?.title ?? 'Khảo sát sau sự kiện'}
            </strong>
            <p className="survey-cycle-hint">
              Đánh giá hiệu quả hoạt động, đo lường độ hài lòng và mức độ thu hẹp khoảng cách.
            </p>
            {postSurvey ? (
              <div className="survey-cycle-actions-row">
                <Button
                  size="small"
                  variant="secondary"
                  icon={<FileText size={14} />}
                  onClick={() => onOpenSurvey(postSurvey.id)}
                >
                  {postSurvey.published ? 'Xem kết quả' : 'Chỉnh sửa'}
                </Button>
                {!postSurvey.published && (
                  <Button
                    size="small"
                    icon={<Send size={14} />}
                    loading={publishingSurvey}
                    onClick={onPublishPostSurvey}
                  >
                    Công bố
                  </Button>
                )}
              </div>
            ) : (
              <div className="survey-cycle-action">
                <Button
                  size="small"
                  variant="secondary"
                  icon={<Plus size={14} />}
                  loading={creatingSurvey}
                  onClick={onCreatePostSurvey}
                >
                  Tạo khảo sát sau
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function StudentPostSurvey({ selected, onOpenSurvey }: { selected: EventDetail; onOpenSurvey: (surveyId: string) => void }) {
  const survey = selected.surveys.find((item) => item.type === 'POST_EVENT' && item.published)
  return (
    <Card className="event-section-card student-survey-banner-card">
      <div className="student-survey-banner-inner">
        <div className="student-survey-banner-icon" aria-hidden="true">
          <ClipboardList size={28} />
        </div>
        <div className="student-survey-banner-copy">
          <h3>Khảo sát đánh giá sau sự kiện</h3>
          <p>
            {survey
              ? 'Chia sẻ cảm nhận và mức độ hài lòng của bạn sau khi tham gia hoạt động để nhà trường cải thiện các chương trình tiếp theo.'
              : 'Khảo sát đánh giá sau sự kiện sẽ được giáo viên mở sau khi hoạt động kết thúc. Hãy đón chờ nhé!'}
          </p>
        </div>
        {survey && (
          <Button icon={<ClipboardList size={16} />} onClick={() => onOpenSurvey(survey.id)}>
            Làm khảo sát ngay
          </Button>
        )}
      </div>
    </Card>
  )
}

function ParticipantList({
  selected,
  onUpdate,
}: {
  selected: EventDetail
  onUpdate: (studentId: string, status: 'CONFIRMED' | 'DECLINED') => void
}) {
  const [filterTab, setFilterTab] = useState<'ALL' | 'REQUESTED' | 'MAIN' | 'BRANCH'>('ALL')
  const participants = selected.participants ?? []

  const statusLabels: Record<RegistrationStatus, string> = {
    REQUESTED: 'Chờ duyệt',
    CONFIRMED: 'Đã xác nhận',
    DECLINED: 'Đã từ chối',
  }

  const mainCount = selected.campusCounts?.MAIN ?? 0
  const branchCount = selected.campusCounts?.BRANCH ?? 0
  const totalConfirmed = mainCount + branchCount
  const requestedCount = participants.filter((p) => p.status === 'REQUESTED').length

  const filtered = participants.filter((p) => {
    if (filterTab === 'REQUESTED') return p.status === 'REQUESTED'
    if (filterTab === 'MAIN') return p.student.campus === 'MAIN'
    if (filterTab === 'BRANCH') return p.student.campus === 'BRANCH'
    return true
  })

  return (
    <Card className="event-section-card participants-section-new">
      <div className="section-heading">
        <div>
          <div className="section-title-with-badge">
            <Users size={18} className="event-section-icon" aria-hidden="true" />
            <h2>Danh sách học sinh đăng ký</h2>
          </div>
          <p className="section-subtitle">
            {totalConfirmed} học sinh đã xác nhận ({mainCount} Điểm chính · {branchCount} Phân hiệu)
          </p>
        </div>
        <Badge variant="neutral">{participants.length} tổng số yêu cầu</Badge>
      </div>

      {/* Campus Distribution Progress Bar */}
      {totalConfirmed > 0 && (
        <div className="campus-distribution-bar">
          <div className="campus-bar-label">
            <span>Điểm chính: {mainCount} ({Math.round((mainCount / totalConfirmed) * 100)}%)</span>
            <span>Phân hiệu: {branchCount} ({Math.round((branchCount / totalConfirmed) * 100)}%)</span>
          </div>
          <div className="campus-bar-track">
            <div
              className="campus-bar-fill-main"
              style={{ width: `${(mainCount / totalConfirmed) * 100}%` }}
              title={`Điểm chính: ${mainCount}`}
            />
            <div
              className="campus-bar-fill-branch"
              style={{ width: `${(branchCount / totalConfirmed) * 100}%` }}
              title={`Phân hiệu: ${branchCount}`}
            />
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="participant-tabs">
        <button
          type="button"
          className={`participant-tab-btn ${filterTab === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('ALL')}
        >
          Tất cả ({participants.length})
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${filterTab === 'REQUESTED' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('REQUESTED')}
        >
          Chờ duyệt ({requestedCount})
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${filterTab === 'MAIN' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('MAIN')}
        >
          Điểm chính ({participants.filter((p) => p.student.campus === 'MAIN').length})
        </button>
        <button
          type="button"
          className={`participant-tab-btn ${filterTab === 'BRANCH' ? 'is-active' : ''}`}
          onClick={() => setFilterTab('BRANCH')}
        >
          Phân hiệu ({participants.filter((p) => p.student.campus === 'BRANCH').length})
        </button>
      </div>

      {/* Participants List */}
      {filtered.length === 0 ? (
        <div className="participants-empty">
          <p className="muted-copy">Không có học sinh trong danh mục này.</p>
        </div>
      ) : (
        <div className="participant-list-grid">
          {filtered.map((participant) => {
            const name = participant.student.name.trim()
            const initials = name
              .split(/\s+/)
              .slice(-2)
              .map((part) => part[0])
              .join('')
              .toLocaleUpperCase('vi-VN')
            const campusLabel = participant.student.campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'

            return (
              <div className="participant-card-item" key={participant.studentId}>
                <div className="participant-person-info">
                  <span
                    className={`participant-avatar-badge ${participant.student.campus === 'MAIN' ? 'is-main' : 'is-branch'}`}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                  <div className="participant-identity">
                    <strong>{participant.student.name}</strong>
                    <span className="participant-email">{participant.student.email}</span>
                  </div>
                </div>

                <div className="participant-meta-row">
                  <span className={`participant-campus-pill ${participant.student.campus === 'MAIN' ? 'is-main' : 'is-branch'}`}>
                    <Building2 size={12} aria-hidden="true" />
                    {campusLabel}
                  </span>

                  <Badge
                    variant={
                      participant.status === 'CONFIRMED'
                        ? 'success'
                        : participant.status === 'DECLINED'
                          ? 'error'
                          : 'warning'
                    }
                  >
                    {statusLabels[participant.status]}
                  </Badge>
                </div>

                {participant.status === 'REQUESTED' && (
                  <div className="participant-actions-group">
                    <Button
                      size="small"
                      icon={<Check size={14} />}
                      onClick={() => onUpdate(participant.studentId, 'CONFIRMED')}
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="small"
                      variant="danger"
                      icon={<X size={14} />}
                      onClick={() => onUpdate(participant.studentId, 'DECLINED')}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
