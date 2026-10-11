import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Button, Input } from './components/ui'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type UserRole = 'TEACHER' | 'STUDENT'
export type Campus = 'MAIN' | 'BRANCH'
export type User = { id: string; name: string; email: string; role: UserRole; campus: Campus | null; avatarUrl: string | null }

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { name: string; email: string; password: string; campus: Campus }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function request<T>(path: string, options: RequestInit = {}, accessToken?: string | null): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : Array.isArray(body.message) ? body.message[0] : 'Có lỗi xảy ra. Vui lòng thử lại.')
  return body as T
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    request<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
      .then((result) => { setUser(result.user); setAccessToken(result.accessToken) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    loading,
    async login(email, password) {
      const result = await request<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setUser(result.user)
      setAccessToken(result.accessToken)
    },
    async register(input) {
      const result = await request<{ user: User; accessToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
      setUser(result.user)
      setAccessToken(result.accessToken)
    },
    async logout() {
      if (accessToken) await request('/auth/logout', { method: 'POST' }, accessToken).catch(() => undefined)
      setUser(null)
      setAccessToken(null)
    },
  }), [accessToken, loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth phải được dùng trong AuthProvider')
  return context
}

function AuthLayout({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><strong>ONE SCHOOL</strong><small>Đông Ngạc</small></div><h1>{title}</h1><p className="auth-description">{description}</p>{children}</section></main>
}

function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (user) return <Navigate to={user.role === 'TEACHER' ? '/teacher/dashboard' : '/student/home'} replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try { await login(email, password) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập') } finally { setSubmitting(false) }
  }
  return <AuthLayout title="Đăng nhập" description="Đăng nhập để tiếp tục với ONE SCHOOL."><form className="auth-form" onSubmit={submit}><Input label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Input label="Mật khẩu" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required error={error} /><Button type="submit" loading={submitting} fullWidth>Đăng nhập</Button></form><p className="auth-switch">Chưa có tài khoản? <button type="button" onClick={() => navigate('/register')}>Đăng ký học sinh</button></p></AuthLayout>
}

function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', campus: 'MAIN' as Campus })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (user) return <Navigate to={user.role === 'TEACHER' ? '/teacher/dashboard' : '/student/home'} replace />
  const update = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.password !== form.confirmPassword) { setError('Mật khẩu xác nhận không khớp'); return }
    setError('')
    setSubmitting(true)
    try { await register({ name: form.name, email: form.email, password: form.password, campus: form.campus }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể đăng ký') } finally { setSubmitting(false) }
  }
  return <AuthLayout title="Đăng ký học sinh" description="Tạo tài khoản học sinh và chọn cơ sở của bạn."><form className="auth-form" onSubmit={submit}><Input label="Họ và tên" value={form.name} onChange={(event) => update('name', event.target.value)} required /><Input label="Email" type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /><label className="field"><span className="field-label">Cơ sở</span><select className="input" value={form.campus} onChange={(event) => update('campus', event.target.value)}><option value="MAIN">Điểm chính</option><option value="BRANCH">Phân hiệu</option></select></label><Input label="Mật khẩu" type="password" autoComplete="new-password" hint="Tối thiểu 8 ký tự, gồm chữ cái và chữ số" value={form.password} onChange={(event) => update('password', event.target.value)} required /><Input label="Xác nhận mật khẩu" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} required error={error} /><Button type="submit" loading={submitting} fullWidth>Tạo tài khoản</Button></form><p className="auth-switch">Đã có tài khoản? <button type="button" onClick={() => navigate('/login')}>Đăng nhập</button></p></AuthLayout>
}

function UnauthorizedPage() {
  const { user } = useAuth()
  return <AuthLayout title="Bạn không có quyền truy cập" description="Trang này không thuộc phạm vi tài khoản hiện tại."><Button fullWidth onClick={() => window.location.assign(user?.role === 'TEACHER' ? '/teacher/dashboard' : '/student/home')}>Về trang chính</Button></AuthLayout>
}

export function ProtectedRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="auth-page"><p>Đang kiểm tra phiên đăng nhập...</p></main>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role !== role) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

export function AuthRoutes({ dashboard }: { dashboard: ReactNode }) {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/unauthorized" element={<UnauthorizedPage />} /><Route path="/teacher/*" element={<ProtectedRoute role="TEACHER">{dashboard}</ProtectedRoute>} /><Route path="/student/*" element={<ProtectedRoute role="STUDENT">{dashboard}</ProtectedRoute>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
}
