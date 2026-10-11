import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronUp, FileText, Plus, Send, Trash2 } from 'lucide-react'
import { useAuth } from './auth'
import { Badge, Button, Card, EmptyState, ErrorState, Input, Skeleton, Toast } from './components/ui'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
type SurveyType = 'BASELINE' | 'POST_EVENT'
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'OPEN_TEXT'
type Criterion = { id: string; name: string }
type Question = { id: string; prompt: string; type: QuestionType; required: boolean; options: unknown; criterionId: string; criterion: Criterion }
export type Survey = { id: string; eventId: string | null; type: SurveyType; title: string; description: string | null; published: boolean; criteria: Criterion[]; questions: Question[]; responseCount?: number; hasResponded?: boolean }

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}/api${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : Array.isArray(body.message) ? body.message[0] : 'Không thể thực hiện thao tác')
  return body as T
}

const typeLabels: Record<SurveyType, string> = { BASELINE: 'Khảo sát thực trạng', POST_EVENT: 'Khảo sát sau sự kiện' }
const questionLabels: Record<QuestionType, string> = { SINGLE_CHOICE: 'Chọn một', MULTIPLE_CHOICE: 'Chọn nhiều', RATING: 'Thang điểm', OPEN_TEXT: 'Tự luận' }
const defaultOptions: Record<QuestionType, string[]> = { SINGLE_CHOICE: ['Lựa chọn 1', 'Lựa chọn 2'], MULTIPLE_CHOICE: ['Lựa chọn 1', 'Lựa chọn 2'], RATING: ['1', '2', '3', '4', '5'], OPEN_TEXT: [] }

function SurveyCard({ survey, onOpen }: { survey: Survey; onOpen: () => void }) {
  return <Card className="survey-list-card"><div className="survey-list-icon"><FileText size={22} /></div><div className="survey-list-copy"><div className="survey-list-title"><h3>{survey.title}</h3><Badge variant={survey.hasResponded ? 'success' : survey.published ? 'success' : 'neutral'}>{survey.hasResponded ? 'Đã hoàn thành' : survey.published ? 'Đã công bố' : 'Bản nháp'}</Badge></div><p>{typeLabels[survey.type]} · {survey.questions.length} câu hỏi{survey.responseCount !== undefined ? ` · ${survey.responseCount} phản hồi` : ''}</p></div><Button size="small" variant="secondary" disabled={survey.hasResponded} onClick={onOpen}>{survey.hasResponded ? 'Đã hoàn thành' : 'Mở khảo sát'}</Button></Card>
}

function QuestionCard({ question, criteria, locked, onUpdate, onDelete, onMove }: { question: Question; criteria: Criterion[]; locked: boolean; onUpdate: (patch: Partial<Question>) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  const options = Array.isArray(question.options) ? question.options.map(String) : []
  return <Card className="question-card"><div className="question-card-header"><strong>Câu hỏi</strong><div className="question-card-actions"><button type="button" aria-label="Di chuyển lên" disabled={locked} onClick={() => onMove(-1)}><ChevronUp size={16} /></button><button type="button" aria-label="Di chuyển xuống" disabled={locked} onClick={() => onMove(1)}><ChevronDown size={16} /></button><button type="button" aria-label="Xóa câu hỏi" disabled={locked} onClick={onDelete}><Trash2 size={16} /></button></div></div><Input label="Nội dung câu hỏi" value={question.prompt} disabled={locked} onChange={(event) => onUpdate({ prompt: event.target.value })} /><label className="field"><span className="field-label">Tiêu chí câu hỏi</span><select className="input" disabled={locked} value={question.criterionId} onChange={(event) => onUpdate({ criterionId: event.target.value })}>{criteria.slice(0, 4).map((criterion, index) => <option value={criterion.id} key={criterion.id}>{`Tiêu chí ${index + 1}`}</option>)}</select></label><label className="field"><span className="field-label">Loại câu hỏi</span><select className="input" disabled={locked} value={question.type} onChange={(event) => onUpdate({ type: event.target.value as QuestionType, options: defaultOptions[event.target.value as QuestionType] })}>{Object.entries(questionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{question.type !== 'OPEN_TEXT' && <label className="field"><span className="field-label">Các lựa chọn, mỗi dòng một đáp án</span><textarea className="input textarea" rows={3} disabled={locked} value={options.join('\n')} onChange={(event) => onUpdate({ options: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>}<label className="checkbox-field"><input type="checkbox" checked={question.required} disabled={locked} onChange={(event) => onUpdate({ required: event.target.checked })} /> Bắt buộc trả lời</label></Card>
}

function SurveyEditor({ initial, onBack, onSaved }: { initial: Survey; onBack: () => void; onSaved: () => void }) {
  const { accessToken } = useAuth()
  const [survey, setSurvey] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null)
  const locked = (survey.responseCount ?? 0) > 0
  const saveSurvey = async () => {
    if (!accessToken) return
    setSaving(true); setError('')
    try {
      await request(`/surveys/${survey.id}`, accessToken, { method: 'PATCH', body: JSON.stringify({ title: survey.title, description: survey.description }) })
      setToast({ title: 'Đã lưu khảo sát', message: 'Thông tin khảo sát đã được cập nhật.', variant: 'success' })
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu khảo sát') } finally { setSaving(false) }
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
    if (!accessToken || locked) return
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
  return <section className="survey-editor"><button className="back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Danh sách khảo sát</button><div className="page-header"><div><p className="eyebrow">{typeLabels[survey.type]}</p><h1>Tạo khảo sát</h1><p className="page-description">Xây dựng bộ câu hỏi rõ ràng để thu thập dữ liệu có ý nghĩa.</p></div><div className="page-header-actions">{!locked && <Button variant="secondary" loading={saving} onClick={() => void saveSurvey()}>Lưu nháp</Button>}{!survey.published && <Button onClick={() => void publish()}>Công bố</Button>}</div></div>{error && <ErrorState title={error} />}{toast && <Toast {...toast} onClose={() => setToast(null)} />}<Card className="survey-meta-card"><Input label="Tên khảo sát" disabled={locked} value={survey.title} onChange={(event) => setSurvey((current) => ({ ...current, title: event.target.value }))} /><label className="field"><span className="field-label">Mô tả</span><textarea className="input textarea" rows={3} disabled={locked} value={survey.description ?? ''} onChange={(event) => setSurvey((current) => ({ ...current, description: event.target.value }))} /></label></Card><div className="survey-builder-grid"><div><div className="section-heading"><div><h2>Câu hỏi</h2><p>Chọn một trong 4 tiêu chí cho từng câu hỏi.</p></div>{!locked && <Button size="small" variant="secondary" icon={<Plus size={15} />} onClick={() => void addQuestion()}>Thêm câu hỏi</Button>}</div>{survey.questions.map((question, index) => <QuestionCard key={question.id} question={question} criteria={survey.criteria} locked={locked} onUpdate={(patch) => void updateQuestion(question, patch)} onDelete={async () => { if (!accessToken) return; await request(`/questions/${question.id}`, accessToken, { method: 'DELETE' }); setSurvey((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) })) }} onMove={(direction) => void moveQuestion(index, direction)} />)}{!survey.questions.length && <EmptyState title="Chưa có câu hỏi" description="Thêm câu hỏi đầu tiên để bắt đầu." compact />}</div></div></section>
}

function TeacherSurveys({ initialSurveyId }: { initialSurveyId?: string | null }) {
  const { accessToken } = useAuth()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selected, setSelected] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    request<Survey[]>('/surveys', accessToken)
      .then((data) => {
        setSurveys(data)
        if (initialSurveyId) {
          const match = data.find((s) => s.id === initialSurveyId)
          if (match) setSelected(match)
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể tải khảo sát'))
      .finally(() => setLoading(false))
  }, [accessToken, initialSurveyId])
  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => { load() }, [load])
  const create = async () => { if (!accessToken) return; try { const survey = await request<Survey>('/surveys', accessToken, { method: 'POST', body: JSON.stringify({ type: 'BASELINE', title: 'Khảo sát thực trạng mới', description: '' }) }); setSelected(survey) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo khảo sát') } }
  if (selected) return <SurveyEditor initial={selected} onBack={() => { setSelected(null); load() }} onSaved={load} />
  return <section className="surveys-page"><div className="page-header"><div><p className="eyebrow">Dữ liệu khảo sát</p><h1>Khảo sát</h1><p className="page-description">Tạo khảo sát thực trạng và chuẩn bị khảo sát sau sự kiện.</p></div><Button icon={<Plus size={18} />} onClick={() => void create()}>Tạo khảo sát thực trạng</Button></div>{loading && <><Skeleton /><Skeleton width="75%" /></>}{!loading && error && <ErrorState title={error} onRetry={load} />}{!loading && !error && !surveys.length && <EmptyState title="Chưa có khảo sát" description="Tạo khảo sát thực trạng đầu tiên để bắt đầu." icon={<FileText size={22} />} />}{!loading && surveys.map((survey) => <SurveyCard key={survey.id} survey={survey} onOpen={() => setSelected(survey)} />)}</section>
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
      <div className="page-header"><div><p className="eyebrow">Chia sẻ tiếng nói của bạn</p><h1>Khảo sát</h1><p className="page-description">Mỗi phản hồi giúp nhà trường cải thiện hoạt động cho cả hai cơ sở.</p></div></div>
      {loading && <><Skeleton /><Skeleton width="75%" /></>}
      {!loading && error && <ErrorState title={error} onRetry={retryLoad} />}
      {!loading && !error && surveys.map((survey) => <SurveyCard key={survey.id} survey={survey} onOpen={() => { setSelected(survey); setAnswers({}); setStep(0); setError('') }} />)}
      {!loading && !surveys.length && !error && <EmptyState title="Chưa có khảo sát cần làm" description="Các khảo sát được công bố sẽ xuất hiện tại đây." />}
    </section>
  )
}

export function SurveyManagement({
  role,
  initialSurveyId,
}: {
  role: 'teacher' | 'student';
  initialSurveyId?: string | null;
}) {
  return role === 'teacher' ? (
    <TeacherSurveys initialSurveyId={initialSurveyId} />
  ) : (
    <StudentSurveys />
  );
}
