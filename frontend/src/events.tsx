import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Edit3, ImagePlus, MapPin, Plus, Trash2, Users, X } from 'lucide-react'
import { useAuth } from './auth'
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Skeleton, Toast } from './components/ui'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
type EventStatus = 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED'
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
  surveys: Array<{ id: string; type: string; title: string; published: boolean }>
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
const statusLabels: Record<EventStatus, string> = { DRAFT: 'Bản nháp', UPCOMING: 'Sắp diễn ra', LIVE: 'Đang diễn ra', COMPLETED: 'Đã kết thúc' }
const statusVariants: Record<EventStatus, 'neutral' | 'info' | 'success' | 'warning'> = { DRAFT: 'neutral', UPCOMING: 'info', LIVE: 'success', COMPLETED: 'warning' }

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
        <div className="event-card-title"><h3>{event.title}</h3><Badge variant={statusVariants[event.status]}>{statusLabels[event.status]}</Badge></div>
        <p className="event-excerpt">{event.description}</p>
        <div className="event-meta"><span><CalendarDays size={15} />{formatDate(event.startAt)}</span><span><MapPin size={15} />{event.location}</span></div>
        {isTeacher ? (
          <div className="event-card-footer"><span><Users size={15} />{event.participantCount ?? 0} người tham gia</span>{event.satisfaction != null && <strong>{event.satisfaction}/100</strong>}</div>
        ) : (
          <div className="event-student-audience">
            <span>{event.targetCampuses.map((campus) => campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu').join(' · ')}</span>
            <span>{event.targetGrades.map((grade) => `Khối ${grade}`).join(', ')}</span>
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
      <div className="form-section"><div><h3>Thông tin cơ bản</h3><p>Giúp học sinh hiểu hoạt động này mang lại điều gì.</p></div><Input label="Tên sự kiện *" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ví dụ: Hoạt động kết nối hai cơ sở" /><label className="field"><span className="field-label">Mô tả *</span><textarea className="input textarea" rows={4} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Mô tả ngắn gọn nội dung hoạt động" /></label><label className="field"><span className="field-label">Mục tiêu / tiêu chí cần cải thiện</span><textarea className="input textarea" rows={3} value={form.objective} onChange={(event) => update('objective', event.target.value)} placeholder="Ví dụ: Cải thiện cơ hội giao lưu giữa hai cơ sở" /></label><label className="field"><span className="field-label">Khảo sát thực trạng *</span><select className="input" value={form.baselineSurveyId} onChange={(event) => update('baselineSurveyId', event.target.value)}><option value="">Chọn khảo sát đã công bố</option>{baselineSurveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title}</option>)}</select></label></div>
      <div className="form-section"><div><h3>Thời gian & địa điểm</h3><p>Chọn lịch và hình thức tổ chức rõ ràng.</p></div><div className="form-grid"><Input label="Bắt đầu *" type="datetime-local" value={form.startAt} onChange={(event) => update('startAt', event.target.value)} /><Input label="Kết thúc *" type="datetime-local" value={form.endAt} onChange={(event) => update('endAt', event.target.value)} /></div><Input label="Địa điểm / đường dẫn *" value={form.location} onChange={(event) => update('location', event.target.value)} /><label className="field"><span className="field-label">Hình thức</span><select className="input" value={form.deliveryMode} onChange={(event) => update('deliveryMode', event.target.value as EventForm['deliveryMode'])}><option value="OFFLINE">Trực tiếp</option><option value="ONLINE">Trực tuyến</option><option value="HYBRID">Kết hợp</option></select></label></div>
      <div className="form-section"><div><h3>Đối tượng tham gia</h3><p>Khối/lớp đang dùng danh sách string theo cấu hình MVP.</p></div><Input label="Khối/lớp *" hint="Phân cách bằng dấu phẩy, ví dụ: 6, 7, 8" value={form.targetGrades} onChange={(event) => update('targetGrades', event.target.value)} /><div className="checkbox-group"><span className="field-label">Cơ sở được mời *</span>{(['MAIN', 'BRANCH'] as Campus[]).map((campus) => <label key={campus}><input type="checkbox" checked={form.targetCampuses.includes(campus)} onChange={(event) => update('targetCampuses', event.target.checked ? [...form.targetCampuses, campus] : form.targetCampuses.filter((item) => item !== campus))} />{campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'}</label>)}</div></div>
      <div className="form-section"><div><h3>Hình ảnh</h3><p>Ảnh được upload qua backend lên Cloudinary.</p></div>{form.coverImageUrl && <img className="event-image-preview" src={form.coverImageUrl} alt="Ảnh bìa sự kiện" />}<label className="upload-control"><ImagePlus size={17} />{uploading ? 'Đang tải ảnh...' : 'Chọn ảnh bìa'}<input type="file" accept="image/*" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} /></label></div>
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
}: {
  role: 'teacher' | 'student'
  initialCreateData?: { title?: string; objective?: string } | null
  onClearInitialCreateData?: () => void
  initialEventId?: string | null
}) {
  const { accessToken } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventDetail | null>(null)
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [baselineSurveys, setBaselineSurveys] = useState<BaselineSurvey[]>([])
  const [aiPreset, setAiPreset] = useState<{ title?: string; objective?: string } | null>(null)

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
    request<EventItem[]>(`/events${status ? `?status=${status}` : ''}`, accessToken)
      .then((items) => {
        setEvents(items)
        if (initialEventId) {
          void openDetail(initialEventId)
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải sự kiện'))
      .finally(() => setLoading(false))
  }, [accessToken, status, initialEventId, openDetail])
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
            }
          : emptyForm,
    [editing, aiPreset],
  )
  const isTeacher = role === 'teacher'
  return (
    <section className="events-page">
      <div className="page-header"><div><p className="eyebrow">{isTeacher ? 'Quản lý hoạt động' : 'Kết nối cộng đồng'}</p><h1>{isTeacher ? 'Sự kiện' : 'Khám phá sự kiện'}</h1><p className="page-description">{isTeacher ? 'Tạo hoạt động cải thiện dựa trên dữ liệu và theo dõi người tham gia.' : 'Xem các hoạt động đang được tổ chức tại ONE SCHOOL.'}</p></div>{isTeacher && <Button icon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true) }}>Tạo sự kiện</Button>}</div>
      {isTeacher && <div className="event-filters"><label className="field"><span className="field-label">Trạng thái</span><select className="input" value={status} onChange={(event) => setStatus(event.target.value as EventStatus | '')}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>}
      {loading && <div className="event-grid">{[1, 2, 3].map((item) => <Card key={item}><Skeleton /><Skeleton width="75%" /><Skeleton width="55%" /></Card>)}</div>}
      {!loading && error && <ErrorState title={error} onRetry={load} />}
      {!loading && !error && events.length === 0 && <EmptyState title={isTeacher ? 'Chưa có sự kiện' : 'Chưa có hoạt động phù hợp'} description={isTeacher ? 'Tạo sự kiện đầu tiên để bắt đầu vòng cải thiện.' : 'Các hoạt động đã công bố sẽ xuất hiện tại đây.'} icon={<CalendarDays size={22} />} />}
      {!loading && !error && events.length > 0 && <div className="event-grid">{events.map((event) => <EventCard key={event.id} event={event} isTeacher={isTeacher} onOpen={() => void openDetail(event.id)} onJoin={!isTeacher && !event.currentRegistration ? () => { if (!accessToken) return; request(`/events/${event.id}/join`, accessToken, { method: 'POST' }).then(() => { setToast({ title: 'Đã gửi yêu cầu', message: 'Giáo viên sẽ xác nhận đăng ký của bạn.', variant: 'success' }); load() }).catch((reason) => setToast({ title: 'Không thể đăng ký', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại', variant: 'error' })) } : undefined} />)}</div>}

      <Modal open={formOpen} title={editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện'} onClose={() => { setFormOpen(false); setEditing(null) }}><EventFormView initial={initialForm} baselineSurveys={baselineSurveys} submitting={submitting} onSubmit={submitForm} onCancel={() => { setFormOpen(false); setEditing(null) }} onUpload={uploadImage} /></Modal>
      <Modal open={Boolean(selected)} title={selected?.title ?? 'Chi tiết sự kiện'} onClose={() => setSelected(null)}>
        {selected && <div className="event-detail"><div className="event-detail-cover">{selected.coverImageUrl ? <img src={selected.coverImageUrl} alt={`Minh họa sự kiện ${selected.title}`} /> : <CalendarDays size={42} />}</div><div className="event-detail-heading"><div><Badge variant={statusVariants[selected.status]}>{statusLabels[selected.status]}</Badge><h2>{selected.title}</h2></div>{isTeacher && <div className="event-detail-actions">{selected.status === 'DRAFT' && <><Button size="small" variant="secondary" icon={<Edit3 size={15} />} onClick={() => { setEditing(selected); setSelected(null); setFormOpen(true) }}>Sửa</Button><Button size="small" variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>Xóa</Button><Button size="small" onClick={() => void publish()}>Công bố</Button></>}</div>}</div><div className="event-detail-meta"><span><CalendarDays size={16} />{formatDate(selected.startAt)} – {formatDate(selected.endAt)}</span><span><MapPin size={16} />{selected.location}</span>{isTeacher && <span><Users size={16} />{selected.participantCount ?? 0} người đã xác nhận</span>}</div><p>{selected.description}</p>{selected.objective && <div className="event-objective"><strong>Mục tiêu cải thiện</strong><p>{selected.objective}</p></div>}<div className="event-detail-grid"><div><h3>Đối tượng</h3><p>Khối/lớp: {selected.targetGrades.join(', ')}</p><p>Cơ sở: {selected.targetCampuses.map((campus) => campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu').join(', ')}</p></div><div><h3>Khảo sát</h3><p>{selected.surveys.length ? selected.surveys.map((survey) => survey.title).join(', ') : 'Chưa có khảo sát. Có thể cấu hình ở Phase 6.'}</p></div></div>{isTeacher ? <ParticipantList selected={selected} onUpdate={updateRegistration} /> : selected.currentRegistration && <div className="registration-status"><Check size={17} />Trạng thái đăng ký: {selected.currentRegistration === 'CONFIRMED' ? 'Đã xác nhận' : selected.currentRegistration === 'REQUESTED' ? 'Đang chờ xác nhận' : 'Yêu cầu chưa được xác nhận'}</div>}</div>}
      </Modal>
      <Modal open={confirmDelete} title="Xóa bản nháp sự kiện?" onClose={() => setConfirmDelete(false)}><p>Thao tác này không thể hoàn tác. Bạn có chắc muốn xóa sự kiện này không?</p><div className="form-actions"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Hủy</Button><Button variant="danger" onClick={() => void remove()}>Xóa bản nháp</Button></div></Modal>
      {toast && <Toast title={toast.title} message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </section>
  )
}

function ParticipantList({ selected, onUpdate }: { selected: EventDetail; onUpdate: (studentId: string, status: 'CONFIRMED' | 'DECLINED') => void }) {
  const participants = selected.participants ?? []
  return <div className="participants-section"><div className="section-heading"><div><h3>Người đăng ký</h3><p>{selected.campusCounts?.MAIN ?? 0} điểm chính · {selected.campusCounts?.BRANCH ?? 0} phân hiệu đã xác nhận</p></div></div>{participants.length === 0 ? <p className="muted-copy">Chưa có yêu cầu tham gia.</p> : <div className="participant-list">{participants.map((participant) => <div className="participant-row" key={participant.studentId}><div><strong>{participant.student.name}</strong><small>{participant.student.campus === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'} · {participant.student.email}</small></div><Badge variant={participant.status === 'CONFIRMED' ? 'success' : participant.status === 'DECLINED' ? 'error' : 'warning'}>{participant.status}</Badge>{participant.status === 'REQUESTED' && <div className="participant-actions"><Button size="small" onClick={() => onUpdate(participant.studentId, 'CONFIRMED')}><Check size={14} />Duyệt</Button><Button size="small" variant="danger" onClick={() => onUpdate(participant.studentId, 'DECLINED')}><X size={14} />Từ chối</Button></div>}</div>)}</div>}</div>
}
