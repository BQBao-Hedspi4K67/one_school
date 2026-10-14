import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BarChart3, CalendarClock, Check, ChevronDown, ChevronUp, FileText, ListChecks, Lock, MessageSquare, Pencil, Plus, RefreshCw, Send, Trash2, Undo2, Users } from 'lucide-react'
import { useAuth } from './auth'
import { Badge, Button, Card, EmptyState, ErrorState, Input, Skeleton, Toast } from './components/ui'
import { CampusCompletionDonut, CriterionBarChart, QuestionDistributionChart, type CriterionComparisonData, type QuestionBreakdownData } from './components/charts'
import { BaselineAiPanel } from './components/baseline-ai-panel'
import { EffectivenessAiPanel } from './components/effectiveness-ai-panel'
import { API_URL } from './api-url'
type SurveyType = 'BASELINE' | 'POST_EVENT'
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'OPEN_TEXT'
type Criterion = { id: string; name: string }
type Question = { id: string; prompt: string; type: QuestionType; required: boolean; options: unknown; criterionId: string; criterion: Criterion }
export type Survey = { id: string; eventId: string | null; type: SurveyType; title: string; description: string | null; published: boolean; closedAt: string | null; closed: boolean; criteria: Criterion[]; questions: Question[]; responseCount?: number; hasResponded?: boolean }
type SurveyResults = {
  survey: { id: string; title: string; type: SurveyType; description: string | null; published: boolean; createdAt: string; responseCount: number; questionCount: number }
  summary: { mainScore: number | null; branchScore: number | null; gap: number | null; completion: { main: number | null; branch: number | null }; responseCount: { MAIN: number; BRANCH: number }; studentCount: { MAIN: number; BRANCH: number }; totalResponses: number }
  criterionComparison: Array<{ criterionId: string; criterionName: string; description: string | null; mainScore: number | null; branchScore: number | null; gap: number | null; responseCount: { MAIN: number; BRANCH: number } }>
  questionBreakdown: Array<{ questionId: string; questionText: string; type: QuestionType; criterionId: string; criterionName: string; options: string[]; mainDistribution: Array<{ label: string; count: number }>; branchDistribution: Array<{ label: string; count: number }>; textAnswers: { MAIN: string[]; BRANCH: string[] } }>
}
type SurveyAnalysis = {
  analysisId: string | null
  status: string | null
  title: string | null
  summary: string | null
  recommendations: string[]
  updatedAt: string | null
  canRetry: boolean
  alreadyLinkedToEvent: boolean
}

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}/api${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : Array.isArray(body.message) ? body.message[0] : 'Không thể thực hiện thao tác')
  return body as T
}

const typeLabels: Record<SurveyType, string> = { BASELINE: 'Khảo sát thực trạng', POST_EVENT: 'Khảo sát sau sự kiện' }
const questionLabels: Record<QuestionType, string> = { SINGLE_CHOICE: 'Chọn một', MULTIPLE_CHOICE: 'Chọn nhiều', RATING: 'Thang điểm', OPEN_TEXT: 'Tự luận' }
const defaultOptions: Record<QuestionType, string[]> = { SINGLE_CHOICE: ['Lựa chọn 1', 'Lựa chọn 2'], MULTIPLE_CHOICE: ['Lựa chọn 1', 'Lựa chọn 2'], RATING: ['1', '2', '3', '4', '5'], OPEN_TEXT: [] }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function toDateTimeInput(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function SurveyCard({ survey, role, onOpen }: { survey: Survey; role: 'teacher' | 'student'; onOpen: () => void }) {
  const teacher = role === 'teacher'
  const responses = survey.responseCount ?? 0
  const teacherBadge = !survey.published ? { variant: 'neutral' as const, label: 'Bản nháp' } : survey.closed ? { variant: 'error' as const, label: 'Đã kết thúc' } : { variant: 'success' as const, label: 'Đã công bố' }
  const studentBadge = survey.hasResponded ? { variant: 'success' as const, label: 'Đã hoàn thành' } : survey.closed ? { variant: 'error' as const, label: 'Đã kết thúc' } : { variant: 'info' as const, label: 'Đang mở' }
  return <Card className="survey-list-card"><div className="survey-list-icon"><FileText size={22} /></div><div className="survey-list-copy"><div className="survey-list-title"><h3>{survey.title}</h3><Badge variant={teacher ? teacherBadge.variant : studentBadge.variant}>{teacher ? teacherBadge.label : studentBadge.label}</Badge></div><p>{typeLabels[survey.type]} · {survey.questions.length} câu hỏi{teacher ? ` · ${responses} phản hồi` : ''}{teacher && survey.closedAt && !survey.closed ? ` · Kết thúc ${formatDateTime(survey.closedAt)}` : ''}</p></div><Button size="small" variant={teacher ? 'secondary' : 'primary'} disabled={!teacher && (survey.hasResponded || survey.closed)} onClick={onOpen}>{teacher ? (responses > 0 ? 'Xem kết quả' : 'Thiết lập câu hỏi') : survey.hasResponded ? 'Đã hoàn thành' : survey.closed ? 'Đã kết thúc' : 'Mở khảo sát'}</Button></Card>
}

function OptionEditor({ type, options, locked, onChange }: { type: QuestionType; options: string[]; locked: boolean; onChange: (options: string[]) => void }) {
  const multiple = type === 'MULTIPLE_CHOICE'
  const update = (index: number, value: string) => onChange(options.map((option, position) => position === index ? value : option))
  const remove = (index: number) => onChange(options.filter((_, position) => position !== index))
  const add = () => onChange([...options, `Lựa chọn ${options.length + 1}`])
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= options.length) return
    const next = [...options]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return <div className="field"><span className="field-label">Các lựa chọn</span><p className="field-hint">Mỗi đáp án là một dòng riêng, học sinh sẽ chọn {multiple ? 'một hoặc nhiều đáp án' : 'một đáp án'}.</p><ul className="option-editor">{options.map((option, index) => <li className="option-editor-row" key={index}><span className={multiple ? 'option-glyph option-glyph-multiple' : 'option-glyph'} aria-hidden="true">{multiple ? <Check size={12} /> : <span className="option-glyph-dot" />}</span><span className="option-editor-index">{index + 1}</span><input className="input option-editor-input" value={option} disabled={locked} aria-label={`Đáp án ${index + 1}`} onChange={(event) => update(index, event.target.value)} /><div className="option-editor-actions"><button type="button" aria-label={`Di chuyển đáp án ${index + 1} lên`} disabled={locked || index === 0} onClick={() => move(index, -1)}><ChevronUp size={15} /></button><button type="button" aria-label={`Di chuyển đáp án ${index + 1} xuống`} disabled={locked || index === options.length - 1} onClick={() => move(index, 1)}><ChevronDown size={15} /></button><button type="button" aria-label={`Xóa đáp án ${index + 1}`} disabled={locked || options.length <= 2} onClick={() => remove(index)}><Trash2 size={15} /></button></div></li>)}</ul>{!locked && <button type="button" className="option-add-button" onClick={add}><Plus size={15} aria-hidden="true" /> Thêm lựa chọn</button>}</div>
}

function QuestionCard({ question, criteria, locked, onUpdate, onDelete, onMove }: { question: Question; criteria: Criterion[]; locked: boolean; onUpdate: (patch: Partial<Question>) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  const options = Array.isArray(question.options) ? question.options.map(String) : []
  return <Card className="question-card"><div className="question-card-header"><strong>Câu hỏi</strong><div className="question-card-actions"><button type="button" aria-label="Di chuyển lên" disabled={locked} onClick={() => onMove(-1)}><ChevronUp size={16} /></button><button type="button" aria-label="Di chuyển xuống" disabled={locked} onClick={() => onMove(1)}><ChevronDown size={16} /></button><button type="button" aria-label="Xóa câu hỏi" disabled={locked} onClick={onDelete}><Trash2 size={16} /></button></div></div><Input label="Nội dung câu hỏi" value={question.prompt} disabled={locked} onChange={(event) => onUpdate({ prompt: event.target.value })} /><label className="field"><span className="field-label">Tiêu chí câu hỏi</span><select className="input" value={question.criterionId} onChange={(event) => onUpdate({ criterionId: event.target.value })}>{criteria.slice(0, 4).map((criterion, index) => <option value={criterion.id} key={criterion.id}>{`Tiêu chí ${index + 1}`}</option>)}</select>{locked && <p className="field-hint">Bạn vẫn có thể đổi tiêu chí của câu hỏi kể cả khi khảo sát đã có phản hồi.</p>}</label><label className="field"><span className="field-label">Loại câu hỏi</span><select className="input" disabled={locked} value={question.type} onChange={(event) => onUpdate({ type: event.target.value as QuestionType, options: defaultOptions[event.target.value as QuestionType] })}>{Object.entries(questionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{question.type !== 'OPEN_TEXT' && <OptionEditor type={question.type} options={options.length ? options : defaultOptions[question.type]} locked={locked} onChange={(next) => onUpdate({ options: next })} />}<label className="checkbox-field"><input type="checkbox" checked={question.required} disabled={locked} onChange={(event) => onUpdate({ required: event.target.checked })} /> Bắt buộc trả lời</label></Card>
}

function SurveyEditor({ initial, onBack, onSaved, hideBackButton }: { initial: Survey; onBack: () => void; onSaved: () => void; hideBackButton: boolean }) {
  const { accessToken } = useAuth()
  const [survey, setSurvey] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null)
  const [closesAt, setClosesAt] = useState(() => survey.closedAt && !survey.closed ? toDateTimeInput(survey.closedAt) : '')
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  // Cấu trúc câu hỏi bị khóa khi đã có phản hồi để giữ toàn vẹn dữ liệu phân tích,
  // nhưng tiêu chí của câu hỏi, thông tin khảo sát và trạng thái kết thúc vẫn chỉnh sửa được.
  const structureLocked = (survey.responseCount ?? 0) > 0
  const saveSurvey = async () => {
    if (!accessToken) return
    setSaving(true); setError('')
    try {
      const result = await request<Survey>(`/surveys/${survey.id}`, accessToken, { method: 'PATCH', body: JSON.stringify({ title: survey.title, description: survey.description }) })
      setSurvey(result)
      setToast({ title: 'Đã lưu khảo sát', message: 'Thông tin khảo sát đã được cập nhật.', variant: 'success' })
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu khảo sát') } finally { setSaving(false) }
  }
  const closeSurvey = async (payload?: { closesAt: string }) => {
    if (!accessToken) return
    setLifecycleBusy(true); setError('')
    try {
      const result = await request<Survey>(`/surveys/${survey.id}/close`, accessToken, { method: 'POST', body: JSON.stringify(payload ?? {}) })
      setSurvey(result)
      setClosesAt('')
      setToast({ title: payload?.closesAt ? 'Đã lên lịch kết thúc' : 'Đã kết thúc khảo sát', message: payload?.closesAt ? 'Khảo sát sẽ tự động đóng vào thời điểm đã chọn.' : 'Khảo sát không còn nhận phản hồi mới.', variant: 'success' })
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết thúc khảo sát') } finally { setLifecycleBusy(false) }
  }
  const scheduleClose = async () => {
    if (!accessToken || !closesAt) return
    await closeSurvey({ closesAt: new Date(closesAt).toISOString() })
  }
  const reopenSurvey = async () => {
    if (!accessToken) return
    setLifecycleBusy(true); setError('')
    try {
      const result = await request<Survey>(`/surveys/${survey.id}/reopen`, accessToken, { method: 'POST' })
      setSurvey(result)
      setClosesAt('')
      setToast({ title: 'Đã mở lại khảo sát', message: 'Khảo sát tiếp tục nhận phản hồi.', variant: 'success' })
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể mở lại khảo sát') } finally { setLifecycleBusy(false) }
  }
  const addQuestion = async () => {
    if (!accessToken) return
    if (!survey.criteria.length) { setError('Khảo sát chưa có tiêu chí để gán câu hỏi'); return }
    try {
      const question = await request<Question>(`/surveys/${survey.id}/questions`, accessToken, { method: 'POST', body: JSON.stringify({ prompt: 'Câu hỏi mới', type: 'RATING', criterionId: survey.criteria[0].id, required: true, options: defaultOptions.RATING }) })
      setSurvey((current) => ({ ...current, questions: [...current.questions, question] }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể thêm câu hỏi') }
  }
  const updateQuestion = async (question: Question, patch: Partial<Question>) => {
    if (!accessToken) return
    const next = { ...question, ...patch }
    setSurvey((current) => ({ ...current, questions: current.questions.map((item) => item.id === question.id ? next : item) }))
    try { await request(`/questions/${question.id}`, accessToken, { method: 'PATCH', body: JSON.stringify({ prompt: next.prompt, type: next.type, criterionId: next.criterionId, required: next.required, options: next.type === 'OPEN_TEXT' ? [] : next.options }) }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật câu hỏi') }
  }
  const publish = async () => {
    if (!accessToken) return
    try { const result = await request<Survey>(`/surveys/${survey.id}/publish`, accessToken, { method: 'POST' }); setSurvey(result); setToast({ title: 'Đã công bố khảo sát', message: 'Học sinh có thể bắt đầu trả lời.', variant: 'success' }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể công bố khảo sát') }
  }
  const moveQuestion = async (index: number, direction: -1 | 1) => {
    if (!accessToken || structureLocked) return
    const target = index + direction
    if (target < 0 || target >= survey.questions.length) return
    const questions = [...survey.questions]
    ;[questions[index], questions[target]] = [questions[target], questions[index]]
    setSurvey((current) => ({ ...current, questions }))
    try {
      const result = await request<Survey>(`/surveys/${survey.id}/questions/reorder`, accessToken, { method: 'POST', body: JSON.stringify({ questionIds: questions.map((question) => question.id) }) })
      setSurvey(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể sắp xếp câu hỏi') }
  }
  return <section className="survey-editor">{!hideBackButton && <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Danh sách khảo sát</button>}<div className="page-header"><div><p className="eyebrow">{typeLabels[survey.type]}</p><h1>{survey.published ? 'Chỉnh sửa khảo sát' : 'Tạo khảo sát'}</h1></div><div className="page-header-actions"><Button variant="secondary" loading={saving} onClick={() => void saveSurvey()}>{survey.published ? 'Lưu thay đổi' : 'Lưu nháp'}</Button>{!survey.published && <Button onClick={() => void publish()}>Công bố</Button>}</div></div>{error && <ErrorState title={error} />}{toast && <Toast {...toast} onClose={() => setToast(null)} />}<Card className="survey-meta-card"><Input label="Tên khảo sát" value={survey.title} onChange={(event) => setSurvey((current) => ({ ...current, title: event.target.value }))} /><label className="field"><span className="field-label">Mô tả</span><textarea className="input textarea" rows={3} value={survey.description ?? ''} onChange={(event) => setSurvey((current) => ({ ...current, description: event.target.value }))} /></label></Card>{survey.published && <Card className="survey-lifecycle-card"><div className="section-heading"><div><h2>Thời gian kết thúc</h2><p>{survey.closed ? (survey.closedAt ? `Đã kết thúc lúc ${formatDateTime(survey.closedAt)}` : 'Đã kết thúc') : survey.closedAt ? `Tự động kết thúc lúc ${formatDateTime(survey.closedAt)}` : 'Khảo sát đang mở, học sinh có thể gửi phản hồi.'}</p></div><Badge variant={survey.closed ? 'error' : survey.closedAt ? 'warning' : 'success'}>{survey.closed ? 'Đã kết thúc' : survey.closedAt ? 'Đã lên lịch' : 'Đang mở'}</Badge></div><div className="lifecycle-actions">{survey.closed ? <Button variant="secondary" icon={<Undo2 size={16} />} loading={lifecycleBusy} onClick={() => void reopenSurvey()}>Mở lại khảo sát</Button> : <><Button variant="danger" icon={<Lock size={16} />} loading={lifecycleBusy} onClick={() => void closeSurvey()}>Kết thúc ngay</Button><label className="field lifecycle-schedule"><span className="field-label">Lên lịch kết thúc</span><input className="input" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label><Button variant="secondary" icon={<CalendarClock size={16} />} disabled={!closesAt} loading={lifecycleBusy} onClick={() => void scheduleClose()}>Lên lịch</Button>{survey.closedAt && <Button variant="ghost" loading={lifecycleBusy} onClick={() => void reopenSurvey()}>Hủy lịch</Button>}</>}</div></Card>}<div className="survey-builder-grid"><div><div className="section-heading"><div><h2>Câu hỏi</h2><p>Chọn một trong 4 tiêu chí cho từng câu hỏi.</p></div>{!structureLocked && <Button size="small" variant="secondary" icon={<Plus size={15} />} onClick={() => void addQuestion()}>Thêm câu hỏi</Button>}</div>{survey.questions.map((question, index) => <QuestionCard key={question.id} question={question} criteria={survey.criteria} locked={structureLocked} onUpdate={(patch) => void updateQuestion(question, patch)} onDelete={async () => { if (!accessToken) return; await request(`/questions/${question.id}`, accessToken, { method: 'DELETE' }); setSurvey((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) })) }} onMove={(direction) => void moveQuestion(index, direction)} />)}{!survey.questions.length && <EmptyState title="Chưa có câu hỏi" description="Thêm câu hỏi đầu tiên để bắt đầu." compact />}</div></div></section>
}

function CriterionStatsTable({ data }: { data: SurveyResults['criterionComparison'] }) {
  return <div className="stats-table" role="table" aria-label="Thống kê điểm hài lòng theo tiêu chí và cơ sở"><div className="stats-table-head" role="row"><span role="columnheader">Tiêu chí</span><span role="columnheader">Điểm chính</span><span role="columnheader">Phân hiệu</span><span role="columnheader">Chênh lệch</span><span role="columnheader">Số phản hồi</span></div>{data.map((item) => <div className="stats-table-row" role="row" key={item.criterionId}><span className="stats-criterion" role="cell">{item.criterionName}</span><span className="stats-score score-indigo" role="cell">{item.mainScore !== null ? `${item.mainScore}/100` : '—'}</span><span className="stats-score score-teal" role="cell">{item.branchScore !== null ? `${item.branchScore}/100` : '—'}</span><span className={`stats-gap ${item.gap !== null && Math.abs(item.gap) >= 10 ? 'gap-warning' : ''}`} role="cell">{item.gap !== null ? `${item.gap >= 0 ? '+' : ''}${item.gap} điểm` : '—'}</span><span className="stats-count" role="cell">{item.responseCount.MAIN} chính / {item.responseCount.BRANCH} phân hiệu</span></div>)}</div>
}

function OpenTextAnswers({ answers, total }: { answers: { MAIN: string[]; BRANCH: string[] }; total: number }) {
  const [tab, setTab] = useState<'MAIN' | 'BRANCH'>('MAIN')
  const items = answers[tab]
  const campusLabel = tab === 'MAIN' ? 'Điểm chính' : 'Phân hiệu'
  return <div className="text-answers"><div className="text-answers-tabs" role="tablist" aria-label="Câu trả lời theo cơ sở"><button type="button" role="tab" aria-selected={tab === 'MAIN'} className={tab === 'MAIN' ? 'is-active' : ''} onClick={() => setTab('MAIN')}><span className="campus-dot dot-indigo" />Điểm chính ({answers.MAIN.length})</button><button type="button" role="tab" aria-selected={tab === 'BRANCH'} className={tab === 'BRANCH' ? 'is-active' : ''} onClick={() => setTab('BRANCH')}><span className="campus-dot dot-teal" />Phân hiệu ({answers.BRANCH.length})</button></div>{items.length ? <ul className="text-answers-list">{items.map((answer, index) => <li key={`${tab}-${index}`}><span className="text-answers-campus">{campusLabel}</span><p>{answer}</p></li>)}</ul> : <p className="text-answers-empty">Chưa có câu trả lời tự luận từ cơ sở này ({total} phản hồi).</p>}</div>
}

function SurveyResultsView({ survey, onBack, onEdit, hideBackButton, onCreateEvent }: { survey: Survey; onBack: () => void; onEdit: () => void; hideBackButton: boolean; onCreateEvent?: (title: string, objective: string, baselineSurveyId: string) => void }) {
  const { accessToken } = useAuth()
  const [results, setResults] = useState<SurveyResults | null>(null)
  const [analysis, setAnalysis] = useState<SurveyAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  // Gắn với chu kỳ sự kiện → dùng đúng logic 2 điểm AI của trang chu kỳ:
  // khảo sát trước = "Phân tích AI thực trạng (lần 1)" · khảo sát sau = "AI đánh giá hiệu quả (lần 2)".
  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true); setError('')
    const analysisRequest = survey.type === 'BASELINE' || survey.eventId
      ? request<SurveyAnalysis>(`/analytics/analysis?${survey.eventId ? `eventId=${encodeURIComponent(survey.eventId)}&kind=${survey.type === 'POST_EVENT' ? 'EFFECTIVENESS' : 'BASELINE'}` : `surveyId=${encodeURIComponent(survey.id)}&kind=BASELINE`}`, accessToken)
      : Promise.resolve(null)
    Promise.all([
      request<SurveyResults>(`/surveys/${survey.id}/results`, accessToken),
      analysisRequest,
    ])
      .then(([surveyResults, surveyAnalysis]) => {
        setResults(surveyResults)
        setAnalysis(surveyAnalysis)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải kết quả khảo sát'))
      .finally(() => setLoading(false))
  }, [accessToken, survey.id, survey.type, survey.eventId])
  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { load() }, [load])
  const runAnalysis = async () => {
    if (!accessToken) return
    setAnalyzing(true)
    setAnalysisError('')
    const analysisPath = survey.eventId
      ? `eventId=${encodeURIComponent(survey.eventId)}&kind=${survey.type === 'POST_EVENT' ? 'EFFECTIVENESS' : 'BASELINE'}`
      : `surveyId=${encodeURIComponent(survey.id)}&kind=BASELINE`
    const path = analysis?.canRetry && analysis.analysisId
      ? `/analytics/analysis/${analysis.analysisId}/retry`
      : `/analytics/analysis?${analysisPath}`
    try {
      await request(path, accessToken, { method: 'POST' })
      setAnalysis(await request<SurveyAnalysis>(`/analytics/analysis?${analysisPath}`, accessToken))
    } catch (reason) {
      setAnalysisError(reason instanceof Error ? reason.message : 'Không thể chạy phân tích AI')
    } finally {
      setAnalyzing(false)
    }
  }
  if (loading) return <section className="survey-results"><Skeleton /><Skeleton width="80%" /><Skeleton width="60%" /></section>
  if (error || !results) return <section className="survey-results"><ErrorState title={error || 'Không có dữ liệu kết quả'} onRetry={load} /></section>
  const hasResponses = results.summary.totalResponses > 0
  const gapWarning = results.summary.gap !== null && Math.abs(results.summary.gap) >= 10
  const eventId = survey.eventId
  const criterionChartData: CriterionComparisonData[] = results.criterionComparison.map((item) => ({ criterionId: item.criterionId, criterionName: item.criterionName, mainScore: item.mainScore, branchScore: item.branchScore, gap: item.gap, responseCount: item.responseCount }))
  return (
    <section className="survey-results">
      {!hideBackButton && <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Danh sách khảo sát</button>}
      <div className="page-header"><div><p className="eyebrow">{typeLabels[results.survey.type]}</p><h1>{results.survey.title}</h1><p className="page-description">{results.survey.description || 'Thống kê phản hồi học sinh theo từng câu hỏi, tiêu chí và cơ sở.'}</p></div><div className="page-header-actions">{survey.closed ? <Badge variant="error"><Lock size={13} /> Đã kết thúc</Badge> : survey.closedAt ? <Badge variant="warning"><CalendarClock size={13} /> Kết thúc {formatDateTime(survey.closedAt)}</Badge> : null}<Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>Làm mới</Button><Button variant="secondary" icon={<Pencil size={16} />} onClick={onEdit}>Chỉnh sửa</Button></div></div>
      {survey.type === 'BASELINE' && (
        <BaselineAiPanel
          summary={analysis?.summary ?? null}
          recommendations={analysis?.recommendations ?? []}
          hasResponses={hasResponses}
          analyzing={analyzing}
          canRetry={analysis?.canRetry}
          error={analysisError}
          onRunAnalysis={() => void runAnalysis()}
          onCreateEvent={
            analysis?.summary &&
            !analysis.alreadyLinkedToEvent &&
            !survey.eventId &&
            onCreateEvent
              ? () => {
                  const title = analysis.title
                    ? `Hoạt động: ${analysis.title}`
                    : `Hoạt động cải thiện: ${survey.title}`
                  const objective = `${analysis.summary}\n\nĐề xuất:\n${analysis.recommendations
                    .map((recommendation, index) => `${index + 1}. ${recommendation}`)
                    .join('\n')}`
                  onCreateEvent(title, objective, survey.id)
                }
              : undefined
          }
        />
      )}
      {survey.type === 'POST_EVENT' && eventId && (
        <EffectivenessAiPanel
          summary={analysis?.summary ?? null}
          recommendations={analysis?.recommendations ?? []}
          hasResponses={hasResponses}
          analyzing={analyzing}
          canRetry={analysis?.canRetry}
          error={analysisError}
          onRunAnalysis={() => void runAnalysis()}
        />
      )}
      {!hasResponses && <Card><EmptyState compact title="Chưa có phản hồi" description="Khảo sát chưa có học sinh nào trả lời. Hãy công bố và chia sẻ khảo sát để bắt đầu thu thập dữ liệu." icon={<FileText size={22} />} /></Card>}
      {hasResponses && <>
        <div className="results-kpi-grid">
          <Card className="results-kpi-card"><div className="kpi-mark mark-indigo" /><p>Điểm hài lòng điểm chính</p><div className="kpi-value">{results.summary.mainScore !== null ? results.summary.mainScore : '—'}<span>/100</span></div><span className="kpi-trend"><Users size={14} aria-hidden="true" /> {results.summary.responseCount.MAIN} học sinh phản hồi</span></Card>
          <Card className="results-kpi-card"><div className="kpi-mark mark-teal" /><p>Điểm hài lòng phân hiệu</p><div className="kpi-value">{results.summary.branchScore !== null ? results.summary.branchScore : '—'}<span>/100</span></div><span className="kpi-trend"><Users size={14} aria-hidden="true" /> {results.summary.responseCount.BRANCH} học sinh phản hồi</span></Card>
          <Card className="results-kpi-card"><div className={`kpi-mark ${gapWarning ? 'mark-amber' : 'mark-violet'}`} /><p>Khoảng cách hai cơ sở</p><div className="kpi-value">{results.summary.gap !== null ? `${results.summary.gap >= 0 ? '+' : ''}${results.summary.gap}` : '—'}<span>điểm</span></div><span className="kpi-trend">{gapWarning ? 'Chênh lệch đáng chú ý' : 'Hai cơ sở tương đồng'}</span></Card>
          <Card className="results-kpi-card"><div className="kpi-mark mark-violet" /><p>Tổng phản hồi</p><div className="kpi-value">{results.summary.totalResponses}<span>lượt</span></div><span className="kpi-trend"><ListChecks size={14} aria-hidden="true" /> {results.survey.questionCount} câu hỏi</span></Card>
        </div>
        <div className="results-layout">
          <Card className="results-main-card">
            <div className="section-heading"><div><h2>Biểu đồ so sánh hai cơ sở</h2><p>Điểm số trung bình của từng tiêu chí tại điểm chính và phân hiệu.</p></div><Badge variant="info"><BarChart3 size={13} /> {results.criterionComparison.length} tiêu chí</Badge></div>
            <CriterionBarChart data={criterionChartData} showSummaryTable={false} />
          </Card>
          <Card className="results-side-card">
            <div className="section-heading"><div><h2>Tỷ lệ hoàn thành</h2><p>Số học sinh đã trả lời trên tổng số học sinh của cơ sở.</p></div></div>
            <div className="participation-donuts-grid"><CampusCompletionDonut label="Điểm chính" percentage={results.summary.completion.main} count={results.summary.responseCount.MAIN} tone="indigo" /><CampusCompletionDonut label="Phân hiệu" percentage={results.summary.completion.branch} count={results.summary.responseCount.BRANCH} tone="teal" /></div>
          </Card>
        </div>
        <Card className="results-questions-card">
          <div className="section-heading"><div><h2>Thống kê điểm hài lòng theo tiêu chí</h2><p>Điểm số và khoảng cách giữa hai cơ sở cho từng tiêu chí của khảo sát.</p></div><Badge variant="info">{results.criterionComparison.length} tiêu chí</Badge></div>
          <CriterionStatsTable data={results.criterionComparison} />
        </Card>
        <Card className="results-questions-card">
          <div className="section-heading"><div><h2>Thống kê từng câu hỏi</h2><p>Phân phối câu trả lời của học sinh, tách theo điểm chính và phân hiệu.</p></div><Badge variant="neutral">{results.questionBreakdown.length} câu hỏi</Badge></div>
          <div className="question-breakdown-list">{results.questionBreakdown.map((question) => <div className="question-result-block" key={question.questionId}>{question.type === 'OPEN_TEXT' ? <div className="question-chart-card"><div className="question-chart-header"><h4 className="question-chart-title"><MessageSquare size={15} aria-hidden="true" /> {question.questionText}</h4><span className="question-chart-criterion">{question.criterionName}</span></div><OpenTextAnswers answers={question.textAnswers} total={results.summary.totalResponses} /></div> : <QuestionDistributionChart question={{ questionId: question.questionId, questionText: question.questionText, criterionName: question.criterionName, mainDistribution: question.mainDistribution, branchDistribution: question.branchDistribution } as QuestionBreakdownData} />}</div>)}</div>
        </Card>
      </>}
    </section>
  )
}



function TeacherSurveys({ initialSurveyId, hideBackButton, onCreateEvent }: { initialSurveyId?: string | null; hideBackButton: boolean; onCreateEvent?: (title: string, objective: string, baselineSurveyId: string) => void }) {
  const { accessToken } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selected, setSelected] = useState<Survey | null>(null)
  const initialSurveyOpened = useRef(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    request<Survey[]>('/surveys', accessToken)
      .then((data) => {
        setSurveys(data)
        setSelected((current) => current ? (data.find((s) => s.id === current.id) ?? current) : current)
        if (initialSurveyId && !initialSurveyOpened.current) {
          const match = data.find((s) => s.id === initialSurveyId)
          if (match) {
            initialSurveyOpened.current = true
            setSelected(match)
            setEditing((match.responseCount ?? 0) === 0)
          }
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải khảo sát'))
      .finally(() => setLoading(false))
  }, [accessToken, initialSurveyId])
  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { load() }, [load])
  const create = async () => { if (!accessToken) return; try { const survey = await request<Survey>('/surveys', accessToken, { method: 'POST', body: JSON.stringify({ type: 'BASELINE', title: 'Khảo sát thực trạng mới', description: '' }) }); setSelected(survey) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo khảo sát') } }
  if (selected && editing) return <SurveyEditor initial={selected} onBack={() => { setEditing(false); load() }} onSaved={load} hideBackButton={hideBackButton} />
  if (selected) return <SurveyResultsView survey={selected} onBack={() => { setSelected(null); setEditing(false); load() }} onEdit={() => setEditing(true)} hideBackButton={hideBackButton} onCreateEvent={onCreateEvent} />
  return <section className="surveys-page"><div className="page-header"><div><p className="eyebrow">Dữ liệu khảo sát</p><h1>Khảo sát</h1></div><Button icon={<Plus size={18} />} onClick={() => void create()}>Tạo khảo sát thực trạng</Button></div>{loading && <><Skeleton /><Skeleton width="75%" /></>}{!loading && error && <ErrorState title={error} onRetry={load} />}{!loading && !error && !surveys.length && <EmptyState title="Chưa có khảo sát" description="Tạo khảo sát thực trạng đầu tiên để bắt đầu." icon={<FileText size={22} />} />}{!loading && surveys.map((survey) => <SurveyCard key={survey.id} survey={survey} role="teacher" onOpen={() => { setSelected(survey); setEditing((survey.responseCount ?? 0) === 0) }} />)}</section>
}

function AnswerControl({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const options = Array.isArray(question.options) ? question.options.map(String) : []
  if (question.type === 'OPEN_TEXT') return <textarea className="input textarea" rows={5} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />
  if (question.type === 'RATING') return <div className="rating-options">{options.map((option) => <button type="button" className={value === Number(option) ? 'rating-option is-selected' : 'rating-option'} key={option} onClick={() => onChange(Number(option))}>{option}</button>)}</div>
  if (question.type === 'MULTIPLE_CHOICE') { const selected = Array.isArray(value) ? value : []; return <div className="answer-options">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}</div> }
  return <div className="answer-options">{options.map((option) => <label key={option}><input type="radio" name={question.id} checked={value === option} onChange={() => onChange(option)} />{option}</label>)}</div>
}

export function StudentSurveys() {
  const { accessToken } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selected, setSelected] = useState<Survey | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    if (!accessToken) return
    request<Survey[]>('/surveys', accessToken)
      .then(setSurveys)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải khảo sát'))
      .finally(() => setLoading(false))
  }, [accessToken])
  const retryLoad = () => {
    setLoading(true)
    setError('')
    load()
  }
  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { load() }, [load])
  const current = selected?.questions[step]
  const submit = async () => {
    if (!accessToken || !selected) return
    setError('')
    try {
      await request(`/surveys/${selected.id}/responses`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })) }),
      })
      setSurveys((items) => items.map((item) => item.id === selected.id ? { ...item, hasResponded: true } : item))
      setSubmitted(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể gửi khảo sát')
    }
  }
  if (submitted) return <section className="survey-completion"><Check size={40} /><h1>Đã hoàn thành khảo sát</h1><p>Cảm ơn bạn đã chia sẻ ý kiến. Phản hồi của bạn đã được ghi nhận.</p><Button onClick={() => { setSelected(null); setSubmitted(false); setStep(0) }}>Về danh sách khảo sát</Button></section>
  if (selected && current) {
    const hasAnswer = answers[current.id] !== undefined && answers[current.id] !== ''
    return (
      <section className="survey-player">
        <button className="back-button" type="button" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Danh sách khảo sát</button>
        {error && <ErrorState title={error} onRetry={() => void submit()} />}
        <Card>
          <p className="eyebrow">{typeLabels[selected.type]}</p>
          <h1>{selected.title}</h1>
          <p>Câu hỏi {step + 1} / {selected.questions.length}</p>
          <progress value={step + 1} max={selected.questions.length} />
          <div className="player-question">
            <h2>{current.prompt}</h2>
            <AnswerControl question={current} value={answers[current.id]} onChange={(value) => setAnswers((old) => ({ ...old, [current.id]: value }))} />
          </div>
          <div className="player-actions">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Quay lại</Button>
            {step < selected.questions.length - 1
              ? <Button disabled={current.required && !hasAnswer} onClick={() => setStep((value) => value + 1)}>Tiếp tục</Button>
              : <Button icon={<Send size={16} />} disabled={current.required && !hasAnswer} onClick={() => void submit()}>Gửi khảo sát</Button>}
          </div>
        </Card>
      </section>
    )
  }
  return (
    <section className="surveys-page">
      <div className="page-header"><div><p className="eyebrow">Chia sẻ tiếng nói của bạn</p><h1>Khảo sát</h1></div></div>
      {loading && <><Skeleton /><Skeleton width="75%" /></>}
      {!loading && error && <ErrorState title={error} onRetry={retryLoad} />}
      {!loading && !error && surveys.map((survey) => <SurveyCard key={survey.id} survey={survey} role="student" onOpen={() => { setSelected(survey); setAnswers({}); setStep(0); setError('') }} />)}
      {!loading && !surveys.length && !error && <EmptyState title="Chưa có khảo sát cần làm" description="Các khảo sát được công bố sẽ xuất hiện tại đây." />}
    </section>
  )
}

export function SurveyManagement({
  role,
  initialSurveyId,
  hideBackButton = false,
  onCreateEvent,
}: {
  role: 'teacher' | 'student';
  initialSurveyId?: string | null;
  hideBackButton?: boolean;
  onCreateEvent?: (title: string, objective: string, baselineSurveyId: string) => void;
}) {
  return role === 'teacher' ? (
    <TeacherSurveys initialSurveyId={initialSurveyId} hideBackButton={hideBackButton} onCreateEvent={onCreateEvent} />
  ) : (
    <StudentSurveys />
  );
}
