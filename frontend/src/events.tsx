import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, Check, ClipboardList, Edit3, FileText, ImagePlus, MapPin, Plus, Trash2, Users, X, GraduationCap } from 'lucide-react'
import { useAuth } from './auth'
import { eventStatusBadge, type EventStatus } from './event-status'
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Skeleton, Toast } from './components/ui'
import { API_URL } from './api-url'
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
  const registrationLabel = event.currentRegistration === 'CONFIRMED' ? 'Đã xác nhận' : event.currentRegistration === 'REQUESTED' ? 'Đã gửi yêu cầu' : event.currentRegistration === 'DECLINED' ? 'Yêu cầu chưa được xác nhận' : 'Đăng ký tham gia'
  return (
    <Card className="event-card">
      <div className="event-cover">{event.coverImageUrl ? <img src={event.coverImageUrl} alt={`Minh họa sự kiện ${event.title}`} /> : <CalendarDays size={34} aria-hidden="true" />}</div>
      <div className="event-card-body">
        <div className="event-card-title"><h3>{event.title}</h3><Badge variant={statusBadge(event).variant}>{statusBadge(event).label}</Badge></div>
        <p className="event-excerpt">{event.description}</p>
        <div className="event-meta"><span><CalendarDays size={15} />{formatDate(event.startAt)}</span><span><MapPin size={15} />{event.location}</span></div>
        {isTeacher ? (
          <div className="event-card-footer"><span><Users size={15} />{event.participantCount ?? 0} người tham gia</span>{event.satisfaction != null && <strong>{event.satisfaction}/100</strong>}</div>
        ) : (
          <div className="event-meta">
            <span>
              <GraduationCap size={15} />
              {event.targetCampuses.map((campus) => campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu').join(' · ')}
            </span>
            <span>
              <Users size={15} />
              {event.targetGrades.map((grade) => `Khối ${grade}`).join(', ')}
            </span>
          </div>
        )}
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
    try { update('coverImageUrl', await onUpload(file)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải ảnh lên') } finally { setUploading(false) }
  }
  return (
    <form className="event-form" onSubmit={submit}>
      <div className="form-section"><div><h3>Thông tin cơ bản</h3></div><Input label="Tên sự kiện *" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ví dụ: Hoạt động kết nối hai cơ sở" /><label className="field"><span className="field-label">Mô tả *</span><textarea className="input textarea" rows={4} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Mô tả ngắn gọn nội dung hoạt động" /></label><label className="field"><span className="field-label">Mục tiêu / tiêu chí cần cải thiện</span><textarea className="input textarea" rows={3} value={form.objective} onChange={(event) => update('objective', event.target.value)} placeholder="Ví dụ: Cải thiện cơ hội giao lưu giữa hai cơ sở" /></label><label className="field"><span className="field-label">Khảo sát thực trạng *</span><select className="input" value={form.baselineSurveyId} onChange={(event) => update('baselineSurveyId', event.target.value)}><option value="">Chọn khảo sát đã công bố</option>{baselineSurveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title}</option>)}</select></label></div>
      <div className="form-section"><div><h3>Thời gian & địa điểm</h3></div><div className="form-grid"><Input label="Bắt đầu *" type="datetime-local" value={form.startAt} onChange={(event) => update('startAt', event.target.value)} /><Input label="Kết thúc *" type="datetime-local" value={form.endAt} onChange={(event) => update('endAt', event.target.value)} /></div><Input label="Địa điểm / đường dẫn *" value={form.location} onChange={(event) => update('location', event.target.value)} /><label className="field"><span className="field-label">Hình thức</span><select className="input" value={form.deliveryMode} onChange={(event) => update('deliveryMode', event.target.value as EventForm['deliveryMode'])}><option value="OFFLINE">Trực tiếp</option><option value="ONLINE">Trực tuyến</option><option value="HYBRID">Kết hợp</option></select></label></div>
      <div className="form-section"><div><h3>Đối tượng tham gia</h3></div><Input label="Khối/lớp *" hint="Phân cách bằng dấu phẩy, ví dụ: 6, 7, 8" value={form.targetGrades} onChange={(event) => update('targetGrades', event.target.value)} /><div className="checkbox-group"><span className="field-label">Cơ sở được mời *</span>{(['MAIN', 'BRANCH'] as Campus[]).map((campus) => <label key={campus}><input type="checkbox" checked={form.targetCampuses.includes(campus)} onChange={(event) => update('targetCampuses', event.target.checked ? [...form.targetCampuses, campus] : form.targetCampuses.filter((item) => item !== campus))} />{campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'}</label>)}</div></div>
      <div className="form-section"><div><h3>Hình ảnh</h3></div>{form.coverImageUrl && <img className="event-image-preview" src={form.coverImageUrl} alt="Ảnh bìa sự kiện" />}<label className="upload-control"><ImagePlus size={17} />{uploading ? 'Đang tải ảnh...' : 'Chọn ảnh bìa'}<input type="file" accept="image/*" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} /></label></div>
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
    const body = new FormData(); body.append('file', file)
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
  const isTeacher = role === 'teacher'
  return (
    <section className="events-page">
      {selected ? <EventDetailView selected={selected} isTeacher={isTeacher} onBack={() => setSelected(null)} hideBackButton={hideDetailBackButton} onEdit={() => { setEditing(selected); setSelected(null); setFormOpen(true) }} onDelete={() => setConfirmDelete(true)} onPublish={() => void publish()} onUpdate={(studentId, registrationStatus) => void updateRegistration(studentId, registrationStatus)} creatingSurvey={creatingSurvey} onCreatePostSurvey={() => void createPostEventSurvey()} onOpenSurvey={onOpenSurvey ?? (() => {})} /> : (
      <>
      <div className="page-header"><div><p className="eyebrow">{isTeacher ? 'Hoạt động cải thiện' : 'Kết nối cộng đồng'}</p><h1>{isTeacher ? 'Sự kiện' : 'Khám phá sự kiện'}</h1></div>{isTeacher && <Button icon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true) }}>Tạo sự kiện</Button>}</div>
      {loading && <div className="event-grid">{[1, 2, 3].map((item) => <Card key={item}><Skeleton /><Skeleton width="75%" /><Skeleton width="55%" /></Card>)}</div>}
      {!loading && error && <ErrorState title={error} onRetry={load} />}
      {!loading && !error && events.length === 0 && <EmptyState title={isTeacher ? 'Chưa có sự kiện' : 'Chưa có hoạt động phù hợp'} description={isTeacher ? 'Tạo sự kiện đầu tiên để bắt đầu vòng cải thiện.' : 'Các hoạt động đã công bố sẽ xuất hiện tại đây.'} icon={<CalendarDays size={22} />} />}
      {!loading && !error && events.length > 0 && <div className="event-grid">{events.map((event) => <EventCard key={event.id} event={event} isTeacher={isTeacher} onOpen={() => void openDetail(event.id)} onJoin={!isTeacher && !event.currentRegistration ? () => { if (!accessToken) return; request(`/events/${event.id}/join`, accessToken, { method: 'POST' }).then(() => { setToast({ title: 'Đã gửi yêu cầu', message: 'Giáo viên sẽ xác nhận đăng ký của bạn.', variant: 'success' }); load() }).catch((reason) => setToast({ title: 'Không thể đăng ký', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' })) } : undefined} />)}</div>}
      </>
      )}
      <Modal open={formOpen} title={editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện'} onClose={() => { setFormOpen(false); setEditing(null) }}><EventFormView initial={initialForm} baselineSurveys={baselineSurveys.filter((survey) => !events.some((event) => event.id !== editing?.id && event.baselineSurveyId === survey.id))} submitting={submitting} onSubmit={submitForm} onCancel={() => { setFormOpen(false); setEditing(null) }} onUpload={uploadImage} /></Modal>
      <Modal open={confirmDelete} title="Xóa bản nháp sự kiện?" onClose={() => setConfirmDelete(false)}><p>Thao tác này không thể hoàn tác. Bạn có chắc muốn xóa sự kiện này không?</p><div className="form-actions"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Hủy</Button><Button variant="danger" onClick={() => void remove()}>Xóa bản nháp</Button></div></Modal>
      {toast && <Toast title={toast.title} message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </section>
  )
}

function EventDetailView({ selected, isTeacher, onBack, hideBackButton, onEdit, onDelete, onPublish, onUpdate, creatingSurvey, onCreatePostSurvey, onOpenSurvey }: { selected: EventDetail; isTeacher: boolean; onBack: () => void; hideBackButton: boolean; onEdit: () => void; onDelete: () => void; onPublish: () => void; onUpdate: (studentId: string, status: 'CONFIRMED' | 'DECLINED') => void; creatingSurvey: boolean; onCreatePostSurvey: () => void; onOpenSurvey: (surveyId: string) => void }) {
  return (
    <section className="event-detail-page">
      {!hideBackButton && (
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Danh sách sự kiện
        </button>
      )}

      <header className="event-detail-hero">
        <div className="event-detail-cover">
          {selected.coverImageUrl
            ? <img src={selected.coverImageUrl} alt={`Minh họa sự kiện ${selected.title}`} />
            : <CalendarDays size={48} aria-hidden="true" />}
        </div>
        <div className="event-detail-header-copy">
          <p className="eyebrow">Chi tiết sự kiện</p>
          <div className="event-detail-title-row">
            <h1>{selected.title}</h1>
            <Badge variant={statusBadge(selected).variant}>{statusBadge(selected).label}</Badge>
          </div>
          <div className="event-detail-meta">
            <span><CalendarDays size={16} />{formatDate(selected.startAt)} – {formatDate(selected.endAt)}</span>
            <span><MapPin size={16} />{selected.location}</span>
            {isTeacher && <span><Users size={16} />{selected.participantCount ?? 0} người đã xác nhận</span>}
          </div>
          {isTeacher && selected.status === 'DRAFT' && (
            <div className="page-header-actions event-detail-actions">
              <Button variant="secondary" icon={<Edit3 size={16} />} onClick={onEdit}>Sửa</Button>
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={onDelete}>Xóa</Button>
              <Button onClick={onPublish}>Công bố</Button>
            </div>
          )}
        </div>
      </header>

      <div className="event-detail-body">
        <Card className="event-detail-card">
          <h2 className="section-title-sm">Giới thiệu hoạt động</h2>
          <p className="event-detail-description">{selected.description}</p>
          {selected.objective && (
            <div className="event-objective">
              <strong>Mục tiêu cải thiện</strong>
              <p>{selected.objective}</p>
            </div>
          )}
        </Card>

        {isTeacher ? (
          <>
            <SurveyPairSection selected={selected} creatingSurvey={creatingSurvey} onCreatePostSurvey={onCreatePostSurvey} onOpenSurvey={onOpenSurvey} />
            <ParticipantList selected={selected} onUpdate={onUpdate} />
          </>
        ) : selected.currentRegistration ? (
          <div className="registration-status">
            <Check size={17} />Trạng thái đăng ký: {selected.currentRegistration === 'CONFIRMED' ? 'Đã xác nhận' : selected.currentRegistration === 'REQUESTED' ? 'Đang chờ xác nhận' : 'Yêu cầu chưa được xác nhận'}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SurveyPairSection({ selected, creatingSurvey, onCreatePostSurvey, onOpenSurvey }: { selected: EventDetail; creatingSurvey: boolean; onCreatePostSurvey: () => void; onOpenSurvey: (surveyId: string) => void }) {
  const postSurvey = selected.surveys.find((survey) => survey.type === 'POST_EVENT') ?? null
  const baseline = selected.baselineSurvey
  type PairSurvey = { id: string; title: string; published: boolean; responseCount: number }
  const rows: Array<{ key: string; label: string; hint: string; survey: PairSurvey | null }> = [
    { key: 'BASELINE', label: 'Khảo sát trước', hint: 'Đo thực trạng trước khi tổ chức sự kiện.', survey: baseline },
    { key: 'POST_EVENT', label: 'Khảo sát sau', hint: 'Đánh giá hiệu quả sau khi sự kiện kết thúc.', survey: postSurvey },
  ]
  return <div className="survey-pair-section"><div className="section-heading"><div><h3>Cặp khảo sát trước – sau</h3></div>{!postSurvey && <Button size="small" icon={<ClipboardList size={15} />} loading={creatingSurvey} onClick={onCreatePostSurvey}>Tạo khảo sát sau</Button>}</div>{!baseline && <p className="muted-copy">Sự kiện chưa gắn khảo sát trước. Hãy tạo và công bố khảo sát thực trạng trước khi tạo khảo sát sau.</p>}<div className="survey-pair-grid">{rows.map((row) => { const survey = row.survey; return <div className="survey-pair-card" key={row.key}><div className="survey-pair-head"><Badge variant={row.key === 'POST_EVENT' ? 'info' : 'neutral'}>{row.label}</Badge>{survey && <Badge variant={survey.published ? 'success' : 'warning'}>{survey.published ? 'Đã công bố' : 'Bản nháp'}</Badge>}</div><strong>{survey?.title ?? 'Chưa có khảo sát'}</strong><p>{survey ? `${survey.responseCount} phản hồi` : row.hint}</p>{survey && <Button size="small" variant="secondary" icon={<FileText size={15} />} onClick={() => onOpenSurvey(survey.id)}>Xem kết quả</Button>}</div> })}</div></div>
}

function ParticipantList({ selected, onUpdate }: { selected: EventDetail; onUpdate: (studentId: string, status: 'CONFIRMED' | 'DECLINED') => void }) {
  const participants = selected.participants ?? []
  const statusLabels: Record<RegistrationStatus, string> = {
    REQUESTED: 'Chờ duyệt',
    CONFIRMED: 'Đã xác nhận',
    DECLINED: 'Đã từ chối',
  }
  return (
    <div className="participants-section">
      <div className="section-heading">
        <div>
          <h3>Người đăng ký</h3>
          <p>{selected.campusCounts?.MAIN ?? 0} điểm chính · {selected.campusCounts?.BRANCH ?? 0} phân hiệu đã xác nhận</p>
        </div>
        <Badge variant="neutral">{participants.length} học sinh</Badge>
      </div>
      {participants.length === 0 ? (
        <p className="muted-copy">Chưa có yêu cầu tham gia.</p>
      ) : (
        <div className="participant-list">
          {participants.map((participant) => {
            const name = participant.student.name.trim()
            const initials = name.split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN')
            const campusLabel = participant.student.campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'
            return (
              <div className="participant-row" key={participant.studentId}>
                <div className="participant-person">
                  <span className="participant-avatar" aria-hidden="true">{initials}</span>
                  <div className="participant-identity">
                    <strong>{participant.student.name}</strong>
                    <span className="participant-email">{participant.student.email}</span>
                  </div>
                </div>
                <span className={`participant-campus ${participant.student.campus === 'MAIN' ? 'is-main' : 'is-branch'}`}>{campusLabel}</span>
                <Badge variant={participant.status === 'CONFIRMED' ? 'success' : participant.status === 'DECLINED' ? 'error' : 'warning'}>{statusLabels[participant.status]}</Badge>
                {participant.status === 'REQUESTED' && (
                  <div className="participant-actions">
                    <Button size="small" onClick={() => onUpdate(participant.studentId, 'CONFIRMED')}><Check size={14} />Duyệt</Button>
                    <Button size="small" variant="danger" onClick={() => onUpdate(participant.studentId, 'DECLINED')}><X size={14} />Từ chối</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
