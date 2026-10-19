import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, LogIn, ShieldAlert, Eye as GuestEye } from 'lucide-react'
import { Button, Input } from './components/ui'
import logo from './assets/logo.png'
import { API_URL } from './api-url'

export type UserRole = 'TEACHER' | 'STUDENT'
export type Campus = 'MAIN' | 'BRANCH'
export type User = { id: string; name: string; username: string; email: string; role: UserRole; campus: Campus | null; avatarUrl: string | null }

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (input: { name: string; username: string; email: string; password: string; campus: Campus }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function request<T>(path: string, options: RequestInit = {}, accessToken?: string | null): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
    })
  } catch {
    // Mất mạng / backend chưa bật: báo lỗi rõ ràng thay vì "Failed to fetch".
    throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : Array.isArray(body.message) ? body.message[0] : 'Có lỗi xảy ra. Vui lòng thử lại.')
  return body as T
}

/** Chỉ điều hướng nội bộ cùng origin, tránh open-redirect qua `?next=`/state. */
function safeInternalPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    request<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
      .then((result) => { if (!active) return; setUser(result.user); setAccessToken(result.accessToken) })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    loading,
    async login(username, password) {
      const result = await request<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setUser(result.user)
      setAccessToken(result.accessToken)
    },
    async register(input) {
      const result = await request<{ user: User; accessToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
      setUser(result.user)
      setAccessToken(result.accessToken)
    },
    async logout() {
      // Luôn xóa phiên ở client kể cả khi API logout lỗi (token hết hạn, mất mạng).
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
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <img className="auth-brand-logo" src={logo} alt="ONE SCHOOL Đông Ngạc" />
          <span className="auth-brand-copy"><strong>ONE SCHOOL</strong><small>Hệ sinh thái kết nối hai cơ sở · Đông Ngạc</small></span>
        </div>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
      <p className="auth-page-note">Mọi dữ liệu khảo sát được tổng hợp ẩn danh theo cơ sở và tiêu chí.</p>
    </main>
  )
}

/** Thông báo lỗi dùng chung cho form đăng nhập/đăng ký. */
function AuthError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className="auth-error" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

/** Ô mật khẩu có nút hiện/ẩn để giảm nhập sai. */
function PasswordInput({ label, value, onChange, autoComplete, error, hint }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; error?: string; hint?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-password">
      <Input
        label={label}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        hint={hint}
      />
      <button
        type="button"
        className="auth-password-toggle"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  )
}

function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Quay lại đúng trang mà ProtectedRoute đã chuyển hướng tới (nếu hợp lệ).
  const redirectTo = safeInternalPath((location.state as { from?: unknown } | null)?.from)
  const homePath = user?.role === 'TEACHER' ? '/teacher/dashboard' : '/student/home'
  if (user) return <Navigate to={redirectTo ?? homePath} replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setFieldError('')
    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setFieldError('Vui lòng nhập đầy đủ username và mật khẩu.')
      return
    }
    setSubmitting(true)
    try {
      await login(trimmedUsername, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập')
      setSubmitting(false)
    }
  }
  return (
    <AuthLayout title="Đăng nhập" description="Đăng nhập để tiếp tục với ONE SCHOOL.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthError message={error} />
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          placeholder="ten.dang.nhap"
          value={username}
          onChange={(event) => { setUsername(event.target.value); setFieldError('') }}
          error={fieldError || undefined}
        />
        <PasswordInput
          label="Mật khẩu"
          autoComplete="current-password"
          value={password}
          onChange={(value) => { setPassword(value); setFieldError('') }}
        />
        <div className="auth-form-footer">
          <Button type="submit" variant="primary" icon={<LogIn size={16} />} loading={submitting} fullWidth>Đăng nhập</Button>
        </div>
      </form>
      <Button type="button" variant="secondary" icon={<GuestEye size={16} />} fullWidth onClick={() => navigate('/guest')}>Xem thử với tư cách khách</Button>
      <p className="auth-switch">Chưa có tài khoản? <button type="button" onClick={() => navigate('/register')}>Đăng ký học sinh</button></p>
    </AuthLayout>
  )
}

function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '', campus: 'MAIN' as Campus })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; username?: string; email?: string; confirmPassword?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  if (user) return <Navigate to={user.role === 'TEACHER' ? '/teacher/dashboard' : '/student/home'} replace />
  const update = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const nextErrors: { name?: string; username?: string; email?: string; confirmPassword?: string } = {}
    if (form.name.trim().length < 2) nextErrors.name = 'Vui lòng nhập họ và tên.'
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(form.username.trim())) nextErrors.username = 'Username dài 3–32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.'
    if (!form.email.trim()) nextErrors.email = 'Vui lòng nhập email.'
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    try {
      await register({ name: form.name.trim(), username: form.username.trim().toLowerCase(), email: form.email.trim(), password: form.password, campus: form.campus })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng ký')
      setSubmitting(false)
    }
  }
  return (
    <AuthLayout title="Đăng ký học sinh" description="Tạo tài khoản học sinh và chọn cơ sở của bạn.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthError message={error} />
        <Input
          label="Họ và tên"
          name="name"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          value={form.name}
          onChange={(event) => { update('name', event.target.value); setFieldErrors((current) => ({ ...current, name: undefined })) }}
          error={fieldErrors.name}
        />
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          minLength={3}
          maxLength={32}
          placeholder="ten.dang.nhap"
          value={form.username}
          onChange={(event) => { update('username', event.target.value); setFieldErrors((current) => ({ ...current, username: undefined })) }}
          error={fieldErrors.username}
          hint="Dùng username này để đăng nhập."
        />
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="ten@school.edu.vn"
          value={form.email}
          onChange={(event) => { update('email', event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })) }}
          error={fieldErrors.email}
        />
        <label className="field">
          <span className="field-label">Cơ sở</span>
          <select className="input" value={form.campus} onChange={(event) => update('campus', event.target.value)}>
            <option value="MAIN">Điểm chính</option>
            <option value="BRANCH">Phân hiệu</option>
          </select>
          <span className="field-message">Khảo sát và sự kiện sẽ được lọc theo cơ sở bạn chọn.</span>
        </label>
        <PasswordInput
          label="Mật khẩu"
          autoComplete="new-password"
          value={form.password}
          onChange={(value) => update('password', value)}
          hint="Tối thiểu 8 ký tự, gồm chữ cái và chữ số"
        />
        <PasswordInput
          label="Xác nhận mật khẩu"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(value) => { update('confirmPassword', value); setFieldErrors((current) => ({ ...current, confirmPassword: undefined })) }}
          error={fieldErrors.confirmPassword}
        />
        <div className="auth-form-footer">
          <Button type="submit" loading={submitting} fullWidth>Tạo tài khoản</Button>
        </div>
      </form>
      <p className="auth-switch">Đã có tài khoản? <button type="button" onClick={() => navigate('/login')}>Đăng nhập</button></p>
    </AuthLayout>
  )
}

function UnauthorizedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <AuthLayout title="Bạn không có quyền truy cập" description="Trang này không thuộc phạm vi tài khoản hiện tại.">
      <p className="auth-error" role="alert">
        <ShieldAlert size={16} aria-hidden="true" />
        <span>Tài khoản của bạn không được cấp quyền cho khu vực này.</span>
      </p>
      <Button fullWidth onClick={() => navigate(user?.role === 'TEACHER' ? '/teacher/dashboard' : '/student/home')}>Về trang chính</Button>
    </AuthLayout>
  )
}

function AuthLoading() {
  return (
    <main className="auth-page">
      <section className="auth-card auth-card-loading">
        <div className="auth-brand">
          <img className="auth-brand-logo" src={logo} alt="ONE SCHOOL Đông Ngạc" />
          <span className="auth-brand-copy"><strong>ONE SCHOOL</strong><small>Hệ sinh thái kết nối hai cơ sở · Đông Ngạc</small></span>
        </div>
        <p className="auth-loading" role="status">Đang kiểm tra phiên đăng nhập...</p>
      </section>
    </main>
  )
}

export function ProtectedRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role !== role) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

export function AuthRoutes({ dashboard, guest }: { dashboard: ReactNode; guest: ReactNode }) {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/guest" element={guest} /><Route path="/register" element={<RegisterPage />} /><Route path="/unauthorized" element={<UnauthorizedPage />} /><Route path="/teacher/*" element={<ProtectedRoute role="TEACHER">{dashboard}</ProtectedRoute>} /><Route path="/student/*" element={<ProtectedRoute role="STUDENT">{dashboard}</ProtectedRoute>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
}
