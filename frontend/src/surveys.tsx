import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
  Users,
  ClipboardList,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
} from 'lucide-react'
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

async function fetchGuestSurveys(): Promise<Survey[]> {
  const response = await fetch(`${API_URL}/api/guest/showcase`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Không thể tải khảo sát')
  return Promise.all((data.surveys ?? []).map(async (summary: { id: string }) => {
    const detailResponse = await fetch(`${API_URL}/api/guest/student/surveys/${summary.id}`)
    const detail = await detailResponse.json().catch(() => ({}))
    if (!detailResponse.ok) throw new Error(typeof detail.message === 'string' ? detail.message : 'Không thể tải nội dung khảo sát')
    const criteria = new Map<string, Criterion>()
    const questions: Question[] = (detail.questions ?? []).map((question: { id: string; prompt: string; type: QuestionType; options: unknown; criterion?: Criterion }) => {
      const criterion = question.criterion ?? { id: 'public', name: 'Khảo sát' }
      criteria.set(criterion.id, criterion)
      return { ...question, required: false, criterionId: criterion.id, criterion }
    })
    return {
      ...detail,
      published: true,
      closedAt: null,
      closed: false,
      criteria: [...criteria.values()],
      questions,
      responseCount: 0,
      hasResponded: false,
    } satisfies Survey
  }))
}

function toDateTimeInput(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
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

function QuestionCard({ question, criteria, locked, onUpdate, onDelete, onMove, showCriterion = true }: { question: Question; criteria: Criterion[]; locked: boolean; onUpdate: (patch: Partial<Question>) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void; showCriterion?: boolean }) {
  const options = Array.isArray(question.options) ? question.options.map(String) : []
  return <Card className="question-card"><div className="question-card-header"><strong>Câu hỏi</strong><div className="question-card-actions"><button type="button" aria-label="Di chuyển lên" disabled={locked} onClick={() => onMove(-1)}><ChevronUp size={16} /></button><button type="button" aria-label="Di chuyển xuống" disabled={locked} onClick={() => onMove(1)}><ChevronDown size={16} /></button><button type="button" aria-label="Xóa câu hỏi" disabled={locked} onClick={onDelete}><Trash2 size={16} /></button></div></div><Input label="Nội dung câu hỏi" value={question.prompt} disabled={locked} onChange={(event) => onUpdate({ prompt: event.target.value })} />{showCriterion && <label className="field"><span className="field-label">Tiêu chí câu hỏi</span><select className="input" value={question.criterionId} onChange={(event) => onUpdate({ criterionId: event.target.value })}>{criteria.slice(0, 4).map((criterion) => <option value={criterion.id} key={criterion.id}>{criterion.name}</option>)}</select>{locked && <p className="field-hint">Bạn vẫn có thể đổi tiêu chí của câu hỏi kể cả khi khảo sát đã có phản hồi.</p>}</label>}<label className="field"><span className="field-label">Loại câu hỏi</span><select className="input" disabled={locked} value={question.type} onChange={(event) => onUpdate({ type: event.target.value as QuestionType, options: defaultOptions[event.target.value as QuestionType] })}>{Object.entries(questionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{question.type !== 'OPEN_TEXT' && <OptionEditor type={question.type} options={options.length ? options : defaultOptions[question.type]} locked={locked} onChange={(next) => onUpdate({ options: next })} />}<label className="checkbox-field"><input type="checkbox" checked={question.required} disabled={locked} onChange={(event) => onUpdate({ required: event.target.checked })} /> Bắt buộc trả lời</label></Card>
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
      const question = await request<Question>(`/surveys/${survey.id}/questions`, accessToken, { method: 'POST', body: JSON.stringify({ prompt: 'Câu hỏi mới', type: survey.type === 'BASELINE' ? 'SINGLE_CHOICE' : 'RATING', criterionId: survey.criteria[0].id, required: true, options: survey.type === 'BASELINE' ? defaultOptions.SINGLE_CHOICE : defaultOptions.RATING }) })
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
  return <section className="survey-editor">{!hideBackButton && <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Danh sách khảo sát</button>}<div className="page-header"><div><p className="eyebrow">{typeLabels[survey.type]}</p><h1>{survey.published ? 'Chỉnh sửa khảo sát' : 'Tạo khảo sát'}</h1></div><div className="page-header-actions"><Button variant="secondary" loading={saving} onClick={() => void saveSurvey()}>{survey.published ? 'Lưu thay đổi' : 'Lưu nháp'}</Button>{!survey.published && <Button onClick={() => void publish()}>Công bố</Button>}</div></div>{error && <ErrorState title={error} />}{toast && <Toast {...toast} onClose={() => setToast(null)} />}<Card className="survey-meta-card"><Input label="Tên khảo sát" value={survey.title} onChange={(event) => setSurvey((current) => ({ ...current, title: event.target.value }))} /><label className="field"><span className="field-label">Mô tả</span><textarea className="input textarea" rows={3} value={survey.description ?? ''} onChange={(event) => setSurvey((current) => ({ ...current, description: event.target.value }))} /></label></Card>{survey.published && <Card className="survey-lifecycle-card"><div className="section-heading"><div><h2>Thời gian kết thúc</h2><p>{survey.closed ? (survey.closedAt ? `Đã kết thúc lúc ${formatDateTime(survey.closedAt)}` : 'Đã kết thúc') : survey.closedAt ? `Tự động kết thúc lúc ${formatDateTime(survey.closedAt)}` : 'Khảo sát đang mở, học sinh có thể gửi phản hồi.'}</p></div><Badge variant={survey.closed ? 'error' : survey.closedAt ? 'warning' : 'success'}>{survey.closed ? 'Đã kết thúc' : survey.closedAt ? 'Đã lên lịch' : 'Đang mở'}</Badge></div><div className="lifecycle-actions">{survey.closed ? <Button variant="secondary" icon={<Undo2 size={16} />} loading={lifecycleBusy} onClick={() => void reopenSurvey()}>Mở lại khảo sát</Button> : <><Button variant="danger" icon={<Lock size={16} />} loading={lifecycleBusy} onClick={() => void closeSurvey()}>Kết thúc ngay</Button><label className="field lifecycle-schedule"><span className="field-label">Lên lịch kết thúc</span><input className="input" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label><Button variant="secondary" icon={<CalendarClock size={16} />} disabled={!closesAt} loading={lifecycleBusy} onClick={() => void scheduleClose()}>Lên lịch</Button>{survey.closedAt && <Button variant="ghost" loading={lifecycleBusy} onClick={() => void reopenSurvey()}>Hủy lịch</Button>}</>}</div></Card>}<div className="survey-builder-grid"><div><div className="section-heading"><div><h2>Câu hỏi</h2><p>Mỗi câu hỏi có thể dùng một hình thức khác nhau; khảo sát trước và sau đều có thể phối hợp nhiều dạng.</p></div>{!structureLocked && <Button size="small" variant="secondary" icon={<Plus size={15} />} onClick={() => void addQuestion()}>Thêm câu hỏi</Button>}</div>{survey.questions.map((question, index) => <QuestionCard key={question.id} question={question} criteria={survey.criteria} locked={structureLocked} showCriterion={survey.type !== 'BASELINE'} onUpdate={(patch) => void updateQuestion(question, patch)} onDelete={async () => { if (!accessToken) return; await request(`/questions/${question.id}`, accessToken, { method: 'DELETE' }); setSurvey((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) })) }} onMove={(direction) => void moveQuestion(index, direction)} />)}{!survey.questions.length && <EmptyState title="Chưa có câu hỏi" description="Thêm câu hỏi đầu tiên để bắt đầu." compact />}</div></div></section>
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
                  const title = survey.title.replace(/^Khảo sát đầu vào:\s*/i, '')
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
        {survey.type === 'POST_EVENT' ? (
          <>
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
          </>
        ) : (
          <div className="results-layout baseline-results-layout">
            <Card className="results-kpi-card baseline-response-summary"><div className="kpi-mark mark-indigo" /><p>Tổng phản hồi mong muốn</p><div className="kpi-value">{results.summary.totalResponses}<span>lượt</span></div><span className="kpi-trend"><ListChecks size={14} aria-hidden="true" /> {results.survey.questionCount} câu hỏi</span></Card>
            <Card className="results-side-card">
              <div className="section-heading"><div><h2>Tỷ lệ tham gia khảo sát</h2><p>Số học sinh đã phản hồi trên tổng số học sinh của mỗi cơ sở.</p></div></div>
              <div className="participation-donuts-grid"><CampusCompletionDonut label="Điểm chính" percentage={results.summary.completion.main} count={results.summary.responseCount.MAIN} tone="indigo" /><CampusCompletionDonut label="Phân hiệu" percentage={results.summary.completion.branch} count={results.summary.responseCount.BRANCH} tone="teal" /></div>
            </Card>
          </div>
        )}
        <Card className="results-questions-card">
          <div className="section-heading"><div><h2>Thống kê từng câu hỏi</h2><p>Phân phối câu trả lời của học sinh, tách theo điểm chính và phân hiệu.</p></div><Badge variant="neutral">{results.questionBreakdown.length} câu hỏi</Badge></div>
          <div className="question-breakdown-list">{results.questionBreakdown.map((question) => <div className="question-result-block" key={question.questionId}>{question.type === 'OPEN_TEXT' ? <div className="question-chart-card"><div className="question-chart-header"><h4 className="question-chart-title"><MessageSquare size={15} aria-hidden="true" /> {question.questionText}</h4>{survey.type === 'POST_EVENT' && <span className="question-chart-criterion">{question.criterionName}</span>}</div><OpenTextAnswers answers={question.textAnswers} total={results.summary.totalResponses} /></div> : <QuestionDistributionChart question={{ questionId: question.questionId, questionText: question.questionText, criterionName: survey.type === 'BASELINE' ? '' : question.criterionName, mainDistribution: question.mainDistribution, branchDistribution: question.branchDistribution } as QuestionBreakdownData} />}</div>)}</div>
        </Card>
      </>}
    </section>
  )
}



function TeacherSurveys({ initialSurveyId, hideBackButton, onCreateEvent, guestMode = false }: { initialSurveyId?: string | null; hideBackButton: boolean; onCreateEvent?: (title: string, objective: string, baselineSurveyId: string) => void; guestMode?: boolean }) {
  const { accessToken } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selected, setSelected] = useState<Survey | null>(null)
  const initialSurveyOpened = useRef(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teacherTab, setTeacherTab] = useState<'ALL' | 'BASELINE' | 'POST_EVENT' | 'OPEN' | 'CLOSED'>('ALL')
  const [teacherSearch, setTeacherSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const surveysRequest = guestMode ? fetchGuestSurveys() : accessToken ? request<Survey[]>('/surveys', accessToken) : Promise.resolve([])
    surveysRequest
      .then((data) => {
        setSurveys(data)
        setSelected((current) => current ? (data.find((s) => s.id === current.id) ?? current) : current)
        if (initialSurveyId && !initialSurveyOpened.current) {
          const match = data.find((s) => s.id === initialSurveyId)
          if (match) {
            initialSurveyOpened.current = true
            setSelected(match)
            setEditing(false)
          }
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải khảo sát'))
      .finally(() => setLoading(false))
  }, [accessToken, guestMode, initialSurveyId])

  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (guestMode || !accessToken) return
    try {
      const survey = await request<Survey>('/surveys', accessToken, {
        method: 'POST',
        body: JSON.stringify({ type: 'BASELINE', title: 'Khảo sát thực trạng mới', description: '' }),
      })
      setSelected(survey)
      setEditing(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo khảo sát')
    }
  }

  const totalResponses = surveys.reduce((sum, s) => sum + (s.responseCount ?? 0), 0)
  const baselineCount = surveys.filter((s) => s.type === 'BASELINE').length
  const postEventCount = surveys.filter((s) => s.type === 'POST_EVENT').length
  const openCount = surveys.filter((s) => s.published && !s.closed).length
  const closedCount = surveys.filter((s) => s.closed).length

  const filteredTeacherSurveys = surveys.filter((s) => {
    if (teacherTab === 'BASELINE' && s.type !== 'BASELINE') return false
    if (teacherTab === 'POST_EVENT' && s.type !== 'POST_EVENT') return false
    if (teacherTab === 'OPEN' && (!s.published || s.closed)) return false
    if (teacherTab === 'CLOSED' && !s.closed) return false
    if (teacherSearch.trim()) {
      const q = teacherSearch.toLowerCase().trim()
      const matchTitle = s.title.toLowerCase().includes(q)
      const matchDesc = (s.description ?? '').toLowerCase().includes(q)
      return matchTitle || matchDesc
    }
    return true
  })

  if (selected && guestMode) return <ReadOnlySurveyView survey={selected} onBack={() => setSelected(null)} hideBackButton={hideBackButton} />
  if (selected && editing) return <SurveyEditor initial={selected} onBack={() => { setEditing(false); load() }} onSaved={load} hideBackButton={hideBackButton} />
  if (selected) return <SurveyResultsView survey={selected} onBack={() => { setSelected(null); setEditing(false); load() }} onEdit={() => setEditing(true)} hideBackButton={hideBackButton} onCreateEvent={onCreateEvent} />

  return (
    <section className="surveys-page">
      <header className="student-page-hero">
        <div className="student-hero-copy">
          <span className="student-hero-kicker">
            <ClipboardList size={14} aria-hidden="true" /> Dữ liệu ý kiến & Tiêu chí · THCS Đông Ngạc
          </span>
          <h1>
            Khảo sát ý kiến &<br />
            <span>Thước đo trải nghiệm học đường.</span>
          </h1>
          <p>
            Thiết lập câu hỏi theo 4 tiêu chí chuẩn hóa, thu thập phản hồi của học sinh và kích hoạt phân tích AI nhằm thu hẹp khoảng cách Điểm chính và Phân hiệu.
          </p>
          {!guestMode && <div className="teacher-hero-actions">
            <Button icon={<Plus size={18} />} onClick={() => void create()}>
              Tạo khảo sát thực trạng
            </Button>
          </div>}
          <div className="student-hero-proof">
            <span><ClipboardList size={16} /> {surveys.length} Khảo sát trong hệ thống</span>
            <span><Users size={16} /> {totalResponses} Phản hồi thu thập</span>
            <span><Sparkles size={16} /> Phân tích AI 2 bước</span>
          </div>
        </div>
        <div className="student-hero-art" aria-hidden="true">
          <div className="student-hero-orbit student-hero-orbit-one" />
          <div className="student-hero-orbit student-hero-orbit-two" />
          <div className="student-hero-core">
            <ClipboardList size={36} />
          </div>
          <div className="student-hero-float float-top">
            <Sparkles size={18} />
            <span>Phân tích AI thực trạng</span>
          </div>
          <div className="student-hero-float float-bottom">
            <ShieldCheck size={18} />
            <span>Đánh giá hiệu quả</span>
          </div>
          <span className="student-hero-dot dot-one" />
          <span className="student-hero-dot dot-two" />
          <span className="student-hero-dot dot-three" />
        </div>
      </header>

      {surveys.length > 0 && (
        <div className="student-filter-toolbar">
          <div className="student-filter-tabs">
            <button
              type="button"
              className={`student-filter-tab ${teacherTab === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setTeacherTab('ALL')}
            >
              Tất cả ({surveys.length})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${teacherTab === 'BASELINE' ? 'is-active' : ''}`}
              onClick={() => setTeacherTab('BASELINE')}
            >
              Thực trạng ({baselineCount})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${teacherTab === 'POST_EVENT' ? 'is-active' : ''}`}
              onClick={() => setTeacherTab('POST_EVENT')}
            >
              Sau sự kiện ({postEventCount})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${teacherTab === 'OPEN' ? 'is-active' : ''}`}
              onClick={() => setTeacherTab('OPEN')}
            >
              Đang mở ({openCount})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${teacherTab === 'CLOSED' ? 'is-active' : ''}`}
              onClick={() => setTeacherTab('CLOSED')}
            >
              Đã kết thúc ({closedCount})
            </button>
          </div>
          <label className="student-search-box">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Tìm khảo sát theo tên..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              aria-label="Tìm khảo sát"
            />
          </label>
        </div>
      )}

      {loading && (
        <div className="student-survey-grid">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton />
              <Skeleton width="80%" />
              <Skeleton width="60%" />
            </Card>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState title={error} onRetry={load} />}

      {!loading && !error && surveys.length === 0 && (
        <EmptyState
          title="Chưa có khảo sát"
          description="Tạo khảo sát thực trạng đầu tiên để bắt đầu thu thập ý kiến học sinh."
          icon={<FileText size={24} />}
        />
      )}

      {!loading && !error && surveys.length > 0 && filteredTeacherSurveys.length === 0 && (
        <EmptyState
          title="Không tìm thấy khảo sát phù hợp"
          description="Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm nhé."
          icon={<Search size={22} />}
        />
      )}

      {!loading && !error && filteredTeacherSurveys.length > 0 && (
        <div className="student-survey-grid">
          {filteredTeacherSurveys.map((survey) => {
            const responses = survey.responseCount ?? 0
            const teacherBadge = !survey.published
              ? { variant: 'neutral' as const, label: 'Bản nháp' }
              : survey.closed
              ? { variant: 'error' as const, label: 'Đã kết thúc' }
              : { variant: 'success' as const, label: 'Đã công bố' }

            return (
              <div key={survey.id} className="student-survey-card-modern">
                <div className="student-survey-card-header">
                  <div className="student-survey-icon-pill">
                    <FileText size={22} />
                  </div>
                  <Badge variant={teacherBadge.variant}>{teacherBadge.label}</Badge>
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
                    {typeLabels[survey.type]}
                  </span>
                  <h3>{survey.title}</h3>
                </div>

                <p className="student-survey-desc">
                  {survey.description || 'Khảo sát thu thập ý kiến để phân tích chỉ số hài lòng học sinh.'}
                </p>

                <div className="student-survey-card-footer">
                  <span className="student-survey-info-meta">
                    <Clock size={13} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                    {survey.questions.length} câu hỏi · {responses} phản hồi
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {guestMode && <Button size="small" variant="secondary" onClick={() => { setSelected(survey); setEditing(false); }}>Xem khảo sát</Button>}
                    {responses > 0 ? (
                      <>
                        {!guestMode && <Button
                          size="small"
                          variant="primary"
                          onClick={() => {
                            setSelected(survey)
                            setEditing(false)
                          }}
                        >
                          Xem kết quả
                        </Button>}
                        {!guestMode && <Button
                          size="small"
                          variant="secondary"
                          icon={<Pencil size={14} />}
                          onClick={() => {
                            setSelected(survey)
                            setEditing(true)
                          }}
                        >
                          Sửa
                        </Button>}
                      </>
                    ) : (
                      !guestMode && <Button
                        size="small"
                        variant="primary"
                        icon={<Pencil size={14} />}
                        onClick={() => {
                          setSelected(survey)
                          setEditing(true)
                        }}
                      >
                        Thiết lập câu hỏi
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function AnswerControl({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const options = Array.isArray(question.options) ? question.options.map(String) : []
  if (question.type === 'OPEN_TEXT') return <textarea className="input textarea" rows={5} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />
  if (question.type === 'RATING') return <div className="rating-options">{options.map((option) => <button type="button" className={value === Number(option) ? 'rating-option is-selected' : 'rating-option'} key={option} onClick={() => onChange(Number(option))}>{option}</button>)}</div>
  if (question.type === 'MULTIPLE_CHOICE') { const selected = Array.isArray(value) ? value : []; return <div className="answer-options">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}</div> }
  return <div className="answer-options">{options.map((option) => <label key={option}><input type="radio" name={question.id} checked={value === option} onChange={() => onChange(option)} />{option}</label>)}</div>
}

function ReadOnlySurveyView({ survey, onBack, hideBackButton }: { survey: Survey; onBack: () => void; hideBackButton: boolean }) {
  return (
    <section className="survey-results">
      {!hideBackButton && <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Danh sách khảo sát</button>}
      <div className="page-header">
        <div><p className="eyebrow">{typeLabels[survey.type]}</p><h1>{survey.title}</h1><p className="page-description">{survey.description || 'Nội dung khảo sát đã công bố.'}</p></div>
        <Badge variant={survey.closed ? 'error' : 'success'}>{survey.closed ? 'Đã kết thúc' : 'Đã công bố'}</Badge>
      </div>
      <div className="student-survey-grid">
        {survey.questions.map((question, index) => (
          <Card key={question.id} className="question-card">
            <p className="eyebrow">Câu {index + 1} · {questionLabels[question.type]}</p>
            <h2>{question.prompt}</h2>
            {Array.isArray(question.options) && <ul className="answer-options">{question.options.map((option, optionIndex) => <li key={`${question.id}-${optionIndex}`}>{String(option)}</li>)}</ul>}
          </Card>
        ))}
      </div>
      <p className="guest-boundary">Chỉ xem nội dung khảo sát. Khách không thể gửi phản hồi; câu trả lời và thông tin người tham gia không được hiển thị.</p>
    </section>
  )
}

export function StudentSurveys({ initialSurveyId, guestMode = false }: { initialSurveyId?: string | null; guestMode?: boolean }) {
  const { accessToken } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selected, setSelected] = useState<Survey | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'PENDING' | 'COMPLETED' | 'ALL'>('PENDING')
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(() => {
    const surveysRequest = guestMode ? fetchGuestSurveys() : accessToken ? request<Survey[]>('/surveys', accessToken) : Promise.resolve([])
    surveysRequest
      .then((items) => {
        setSurveys(items)
        const initial = initialSurveyId
          ? items.find((item) => item.id === initialSurveyId)
          : null
        if (initial) {
          setSelected(initial)
          setAnswers({})
          setStep(0)
          setError('')
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải khảo sát'))
      .finally(() => setLoading(false))
  }, [accessToken, guestMode, initialSurveyId])

  const retryLoad = () => {
    setLoading(true)
    setError('')
    load()
  }

  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { load() }, [load])

  const pendingSurveys = surveys.filter((s) => !s.hasResponded && !s.closed)
  const completedSurveys = surveys.filter((s) => s.hasResponded)

  const filteredSurveys = surveys.filter((s) => {
    if (tab === 'PENDING' && (s.hasResponded || s.closed)) return false
    if (tab === 'COMPLETED' && !s.hasResponded) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchesTitle = s.title.toLowerCase().includes(q)
      const matchesDesc = (s.description ?? '').toLowerCase().includes(q)
      return matchesTitle || matchesDesc
    }
    return true
  })

  const current = selected?.questions[step]

  const submit = async () => {
    if (guestMode || !accessToken || !selected) return
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

  if (submitted) {
    return (
      <section className="survey-completion" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 10px 28px rgba(16, 185, 129, 0.35)',
          }}
        >
          <CheckCircle2 size={44} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginBottom: '10px', color: 'var(--color-text)' }}>
          Cảm ơn bạn đã đóng góp tiếng nói!
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>
          Ý kiến của bạn đã được ghi nhận an toàn và bảo mật. Phản hồi này sẽ giúp thầy cô và nhà trường tiếp tục cải thiện các hoạt động kết nối Điểm chính và Phân hiệu.
        </p>
        <Button onClick={() => { setSelected(null); setSubmitted(false); setStep(0) }}>
          Quay về danh sách khảo sát
        </Button>
      </section>
    )
  }

  if (selected && guestMode) return <ReadOnlySurveyView survey={selected} onBack={() => setSelected(null)} hideBackButton={false} />
  if (selected && current) {
    const hasAnswer = answers[current.id] !== undefined && answers[current.id] !== ''
    const progressPercent = Math.round(((step + 1) / selected.questions.length) * 100)

    return (
      <section className="survey-player">
        <button className="back-button" type="button" onClick={() => setSelected(null)}>
          <ArrowLeft size={16} /> Danh sách khảo sát
        </button>
        {error && <ErrorState title={error} onRetry={() => void submit()} />}
        <Card className="survey-player-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
            <Badge variant="neutral">{typeLabels[selected.type]}</Badge>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary-600)' }}>
              Câu hỏi {step + 1} / {selected.questions.length} ({progressPercent}%)
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', marginBottom: '16px' }}>
            {selected.title}
          </h1>

          <div
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '99px',
              background: 'var(--color-border)',
              overflow: 'hidden',
              marginBottom: '28px',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--color-primary-600) 0%, #6655b8 100%)',
                borderRadius: '99px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div className="player-question">
            <h2 style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.5, marginBottom: '18px' }}>
              {current.prompt}
              {current.required && <span style={{ color: 'var(--color-danger, #ef4444)', marginLeft: '4px' }}>*</span>}
            </h2>
            <AnswerControl
              question={current}
              value={answers[current.id]}
              onChange={(value) => setAnswers((old) => ({ ...old, [current.id]: value }))}
            />
          </div>

          <div className="player-actions" style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
              Quay lại
            </Button>
            {step < selected.questions.length - 1 ? (
              <Button disabled={current.required && !hasAnswer} onClick={() => setStep((value) => value + 1)}>
                Tiếp tục
              </Button>
            ) : (
              <Button icon={<Send size={16} />} disabled={current.required && !hasAnswer} onClick={() => void submit()}>
                Gửi khảo sát
              </Button>
            )}
          </div>
        </Card>
      </section>
    )
  }

  return (
    <section className="surveys-page">
      <header className="student-page-hero">
        <div className="student-hero-copy">
          <span className="student-hero-kicker">
            <ClipboardList size={15} aria-hidden="true" />
            Tiếng nói học sinh · THCS Đông Ngạc
          </span>
          <h1>
            Khảo sát ý kiến,<br />
            <span>xây dựng trường học hạnh phúc.</span>
          </h1>
          <p>
            Mỗi chia sẻ chân thành của bạn giúp thầy cô và nhà trường hiểu rõ hơn nhu cầu thực tế, từ đó tạo ra những hoạt động kết nối ý nghĩa giữa hai cơ sở.
          </p>
          <div className="student-hero-proof">
            <span><ClipboardList size={16} /> {surveys.length} khảo sát khả dụng</span>
            <span><ShieldCheck size={16} /> 100% Khách quan & Bảo mật</span>
            <span><Users size={16} /> Kết nối 2 cơ sở</span>
          </div>
        </div>
        <div className="student-hero-art" aria-hidden="true">
          <div className="student-hero-orbit student-hero-orbit-one" />
          <div className="student-hero-orbit student-hero-orbit-two" />
          <div className="student-hero-core">
            <ClipboardList size={36} />
          </div>
          <div className="student-hero-float float-top">
            <MessageSquare size={18} />
            <span>Lắng nghe học sinh</span>
          </div>
          <div className="student-hero-float float-bottom">
            <Sparkles size={18} />
            <span>Khảo sát nhanh 2-3 phút</span>
          </div>
          <span className="student-hero-dot dot-one" />
          <span className="student-hero-dot dot-two" />
          <span className="student-hero-dot dot-three" />
        </div>
      </header>

      {surveys.length > 0 && (
        <div className="student-filter-toolbar">
          <div className="student-filter-tabs">
            <button
              type="button"
              className={`student-filter-tab ${tab === 'PENDING' ? 'is-active' : ''}`}
              onClick={() => setTab('PENDING')}
            >
              Cần làm ({pendingSurveys.length})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${tab === 'COMPLETED' ? 'is-active' : ''}`}
              onClick={() => setTab('COMPLETED')}
            >
              Đã hoàn thành ({completedSurveys.length})
            </button>
            <button
              type="button"
              className={`student-filter-tab ${tab === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setTab('ALL')}
            >
              Tất cả ({surveys.length})
            </button>
          </div>
          <label className="student-search-box">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Tìm kiếm khảo sát..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm khảo sát"
            />
          </label>
        </div>
      )}

      {loading && (
        <div className="student-survey-grid">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton />
              <Skeleton width="80%" />
              <Skeleton width="55%" />
            </Card>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState title={error} onRetry={retryLoad} />}

      {!loading && !error && surveys.length === 0 && (
        <EmptyState
          title="Chưa có khảo sát cần làm"
          description="Các khảo sát mới sẽ xuất hiện tại đây khi được nhà trường công bố."
          icon={<ClipboardList size={24} />}
        />
      )}

      {!loading && !error && surveys.length > 0 && filteredSurveys.length === 0 && (
        <EmptyState
          title="Không tìm thấy khảo sát phù hợp"
          description="Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm nhé."
          icon={<Search size={22} />}
        />
      )}

      {!loading && !error && filteredSurveys.length > 0 && (
        <div className="student-survey-grid">
          {filteredSurveys.map((survey) => (
            <div key={survey.id} className="student-survey-card-modern">
              <div className="student-survey-card-header">
                <div className="student-survey-icon-pill">
                  {survey.hasResponded ? <CheckCircle2 size={22} /> : <ClipboardList size={22} />}
                </div>
                <Badge variant={survey.hasResponded ? 'success' : survey.closed ? 'neutral' : 'info'}>
                  {survey.hasResponded ? 'Đã hoàn thành' : survey.closed ? 'Đã kết thúc' : 'Cần làm'}
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
                  {typeLabels[survey.type]}
                </span>
                <h3>{survey.title}</h3>
              </div>

              <p className="student-survey-desc">
                {survey.description || 'Khảo sát thu thập ý kiến học sinh để hỗ trợ xây dựng môi trường học đường tích cực.'}
              </p>

              <div className="student-survey-card-footer">
                <span className="student-survey-info-meta">
                  <Clock size={13} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                  {survey.questions.length} câu hỏi · ~2-3 phút
                </span>
                {guestMode ? (
                  <Button size="small" variant="secondary" onClick={() => { setSelected(survey); setAnswers({}); setStep(0); }}>
                    Xem khảo sát
                  </Button>
                ) : survey.hasResponded ? (
                  <Button size="small" variant="secondary" disabled>
                    <Check size={14} /> Đã hoàn thành
                  </Button>
                ) : survey.closed ? (
                  <Button size="small" variant="ghost" disabled>
                    Đã đóng
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="primary"
                    icon={<ArrowRight size={15} />}
                    onClick={() => {
                      setSelected(survey)
                      setAnswers({})
                      setStep(0)
                      setError('')
                    }}
                  >
                    Bắt đầu
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function SurveyManagement({
  role,
  guestMode = false,
  initialSurveyId,
  hideBackButton = false,
  onCreateEvent,
}: {
  role: 'teacher' | 'student';
  guestMode?: boolean;
  initialSurveyId?: string | null;
  hideBackButton?: boolean;
  onCreateEvent?: (title: string, objective: string, baselineSurveyId: string) => void;
}) {
  return role === 'teacher' ? (
    <TeacherSurveys initialSurveyId={initialSurveyId} hideBackButton={hideBackButton} onCreateEvent={onCreateEvent} guestMode={guestMode} />
  ) : (
    <StudentSurveys initialSurveyId={initialSurveyId} guestMode={guestMode} />
  );
}
