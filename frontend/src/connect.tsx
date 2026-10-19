import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, MessageCircle, Heart, Users, Plus, Pencil, Trash2, Check, Search, ArrowUpRight, ArrowLeft, Compass, Hash, BookOpen, Calculator, FlaskConical, Trophy, Music2, Languages, Sparkles, Lightbulb, Activity, RefreshCw, type LucideIcon } from 'lucide-react'
import { useAuth } from './auth'
import { API_URL } from './api-url'
import { resizeImageBeforeUpload } from './image-utils'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Toast } from './components/ui'
import './connect.css'

type Campus = 'MAIN' | 'BRANCH'
type Person = { id: string; name: string; campus: Campus | null; avatarUrl?: string | null }
type Comment = { id: string; parentId: string | null; body: string; createdAt: string; author: Person }
type Post = { id: string; body: string; imageUrl: string | null; imageUrls?: string[]; status: 'PENDING' | 'APPROVED'; createdAt: string; author: Person; comments: Comment[]; reacted: boolean; reactionCount: number }
type Group = { id: string; name: string; description: string | null; joined: boolean; stats: { mainMembers: number; branchMembers: number; approvedPosts: number; comments: number; crossCampusPosts: number; crossCampusPercent: number; pendingPosts?: number; memberCount?: number } }
type GroupDetail = Group & { posts: Post[]; members: Array<Person & { joinedAt: string }> }
type ConnectInsight = { analysisId: string | null; status: string | null; title: string | null; summary: string | null; recommendations: string[]; createdAt: string | null; updatedAt: string | null; canRetry: boolean; error: string | null }

export function ConnectPage({ guestMode = false, role }: { guestMode?: boolean; role?: 'teacher' | 'student' }) {
  const { accessToken, user } = useAuth()
  const teacher = role ? role === 'teacher' : user?.role === 'TEACHER'
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [body, setBody] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [groupForm, setGroupForm] = useState<{ id?: string; name: string; description: string } | null>(null)
  const [toast, setToast] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [studentGroupOpen, setStudentGroupOpen] = useState(false)
  const [connectInsight, setConnectInsight] = useState<ConnectInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightBusy, setInsightBusy] = useState(false)
  const [groupInsight, setGroupInsight] = useState<ConnectInsight | null>(null)
  const [groupInsightLoading, setGroupInsightLoading] = useState(false)
  const [groupInsightBusy, setGroupInsightBusy] = useState(false)

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API_URL}/api/connect${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
      credentials: 'include',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Không thể hoàn thành thao tác')
    return data as T
  }, [accessToken])

  const loadGroups = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = guestMode
        ? await fetch(`${API_URL}/api/guest/showcase`).then(async (response) => {
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Không thể tải danh sách nhóm')
            return ((data.groups ?? []) as Array<{ id: string; name: string; description: string | null; memberCount: number; approvedPostCount: number }>).map((group) => ({
              id: group.id,
              name: group.name,
              description: group.description,
              joined: false,
              stats: { mainMembers: 0, branchMembers: 0, approvedPosts: group.approvedPostCount, comments: 0, crossCampusPosts: 0, crossCampusPercent: 0, memberCount: group.memberCount },
            } satisfies Group))
          })
        : await request<Group[]>('/groups')
      setGroups(result)
      setSelected((current) => current && result.some((group) => group.id === current) ? current : result[0]?.id ?? null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể tải danh sách nhóm') }
    finally { setLoading(false) }
  }, [guestMode, request])

  useEffect(() => { void loadGroups() }, [loadGroups, refresh])
  useEffect(() => {
    if (guestMode || !teacher) return
    let active = true
    setInsightLoading(true)
    request<ConnectInsight>('/insights').then((result) => { if (active) setConnectInsight(result) }).catch((reason: unknown) => {
      if (active) setToast({ title: 'Không thể tải phân tích CONNECT', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại.', variant: 'error' })
    }).finally(() => { if (active) setInsightLoading(false) })
    return () => { active = false }
  }, [guestMode, request, teacher])
  useEffect(() => {
    if (guestMode || !teacher || !selected) { setGroupInsight(null); return }
    let active = true
    setGroupInsight(null)
    setGroupInsightLoading(true)
    request<ConnectInsight>(`/groups/${selected}/insights`).then((result) => {
      if (active) setGroupInsight(result)
    }).catch((reason: unknown) => {
      if (active) setToast({ title: 'Không thể tải phân tích nhóm', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại.', variant: 'error' })
    }).finally(() => { if (active) setGroupInsightLoading(false) })
    return () => { active = false }
  }, [guestMode, request, selected, teacher])
  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let active = true
    const loadDetail = guestMode
      ? fetch(`${API_URL}/api/guest/groups/${selected}`).then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Không thể tải nhóm')
          const group = groups.find((item) => item.id === selected)
          return {
            ...group,
            joined: false,
            stats: group?.stats ?? { mainMembers: 0, branchMembers: 0, approvedPosts: 0, comments: 0, crossCampusPosts: 0, crossCampusPercent: 0 },
            posts: (data.posts ?? []).map((post: { body: string; hasImage: boolean; createdAt: string; reactionCount: number; authorLabel: string; comments: Array<{ body: string; createdAt: string; authorLabel: string }> }, index: number) => ({
              id: `${selected}-guest-post-${index}`,
              body: post.body,
              imageUrl: null,
              imageUrls: [],
              status: 'APPROVED' as const,
              createdAt: post.createdAt,
              author: { id: `guest-${index}`, name: post.authorLabel, campus: null },
              comments: post.comments.map((comment, commentIndex) => ({ id: `${selected}-guest-comment-${index}-${commentIndex}`, parentId: null, ...comment, author: { id: `guest-comment-${index}-${commentIndex}`, name: comment.authorLabel, campus: null } })),
              reacted: false,
              reactionCount: post.reactionCount,
            })),
            members: [],
          } as GroupDetail
        })
      : request<GroupDetail>(`/groups/${selected}`)
    loadDetail.then((result) => { if (active) setDetail(result) }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Không thể tải nhóm') })
    return () => { active = false }
  }, [groups, guestMode, request, selected, refresh])

  async function perform(action: () => Promise<unknown>, message: string) {
    if (guestMode) return
    setBusy(true); setError('')
    try {
      await action()
      const copy = connectToastCopy(message)
      setToast({ ...copy, variant: 'success' })
      setRefresh((value) => value + 1)
    }
    catch (err) { setToast({ title: 'Không thể hoàn thành thao tác', message: err instanceof Error ? err.message : 'Đã xảy ra lỗi. Em thử lại nhé.', variant: 'error' }) }
    finally { setBusy(false) }
  }

  async function upload(files?: FileList | null) {
    if (guestMode) return
    if (!files?.length) return
    const selectedFiles = Array.from(files).slice(0, Math.max(0, 10 - imageUrls.length))
    if (!selectedFiles.length) return
    setBusy(true); setError('')
    try {
      const uploaded: string[] = []
      for (const file of selectedFiles) {
        const resized = await resizeImageBeforeUpload(file, 1200, 0.82)
        const form = new FormData(); form.append('file', resized)
        const response = await fetch(`${API_URL}/api/uploads/connect-image`, { method: 'POST', body: form, credentials: 'include', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Không tải được ảnh')
        uploaded.push(result.url as string)
      }
      setImageUrls((current) => [...current, ...uploaded]); setToast({ title: 'Đã tải ảnh lên', message: 'Ảnh đã sẵn sàng để đính kèm vào bài viết.', variant: 'success' })
    } catch (err) { setToast({ title: 'Không tải được ảnh', message: err instanceof Error ? err.message : 'Em thử lại nhé.', variant: 'error' }) }
    finally { setBusy(false) }
  }

  async function submitPost(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    await perform(() => request(`/groups/${selected}/posts`, { method: 'POST', body: JSON.stringify({ body: body || ' ', imageUrls }) }), teacher ? 'Đã đăng bài' : 'Bài viết đã gửi và đang chờ giáo viên duyệt')
    setBody(''); setImageUrls([])
  }

  async function submitComment(event: FormEvent, postId: string, parentId?: string) {
    event.preventDefault()
    const draft = parentId ? replyDrafts[parentId]?.trim() : commentDrafts[postId]?.trim()
    if (!draft) return
    await perform(() => request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: draft, ...(parentId ? { parentId } : {}) }) }), parentId ? 'Đã gửi trả lời' : 'Đã đăng bình luận')
    if (parentId) {
      setReplyDrafts((items) => ({ ...items, [parentId]: '' }))
      setReplyTarget(null)
    } else setCommentDrafts((items) => ({ ...items, [postId]: '' }))
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault()
    if (!groupForm) return
    const method = groupForm.id ? 'PATCH' : 'POST'
    const path = groupForm.id ? `/groups/${groupForm.id}` : '/groups'
    await perform(() => request(path, { method, body: JSON.stringify({ name: groupForm.name, description: groupForm.description }) }), groupForm.id ? 'Đã cập nhật nhóm' : 'Đã tạo nhóm')
    setGroupForm(null)
  }

  function openStudentGroup(groupId: string) {
    if (groupId !== selected) setDetail(null)
    setSelected(groupId)
    setMembersOpen(false)
    setStudentGroupOpen(true)
  }

  async function runConnectAnalysis() {
    if (guestMode) return
    setInsightBusy(true)
    try {
      const result = await request<ConnectInsight>('/insights', { method: 'POST' })
      setConnectInsight(result)
      setToast({ title: 'Đã phân tích hoạt động CONNECT', message: 'Nhận xét và gợi ý mới đã sẵn sàng.', variant: 'success' })
    } catch (reason) {
      setToast({ title: 'Chưa thể phân tích CONNECT', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại.', variant: 'error' })
    } finally { setInsightBusy(false) }
  }

  async function runGroupAnalysis() {
    if (guestMode) return
    if (!selected) return
    setGroupInsightBusy(true)
    try {
      const result = await request<ConnectInsight>(`/groups/${selected}/insights`, { method: 'POST' })
      setGroupInsight(result)
      setToast({ title: 'Đã phân tích hoạt động nhóm', message: 'Nhận xét và gợi ý riêng cho nhóm đã sẵn sàng.', variant: 'success' })
    } catch (reason) {
      setToast({ title: 'Chưa thể phân tích nhóm', message: reason instanceof Error ? reason.message : 'Vui lòng thử lại.', variant: 'error' })
    } finally { setGroupInsightBusy(false) }
  }

  if (loading && groups.length === 0) return <div className="connect-page"><LoadingState label="Đang tải các nhóm CONNECT..." /></div>
  const visibleGroups = groups.filter((group) => `${group.name} ${group.description ?? ''}`.toLocaleLowerCase('vi').includes(groupSearch.toLocaleLowerCase('vi')))
  const joinedCount = groups.filter((group) => group.joined).length
  return (
    <div className="connect-page">
      {!studentGroupOpen && <header className="page-header connect-heading connect-student-hero">
        <div className="connect-hero-copy"><span className="connect-hero-kicker"><Sparkles size={14} /> {teacher ? 'CONNECT · KHÔNG GIAN CỘNG ĐỒNG' : 'CÙNG HỌC · CÙNG CHIA SẺ · CÙNG LỚN LÊN'}</span><h1>{teacher ? <>Cộng đồng kết nối<br /><span>mọi ý tưởng.</span></> : <>Nơi em thuộc về<br /><span>đang ở đây.</span></>}</h1><p>{teacher ? 'Khám phá, quản lý và nuôi dưỡng những cộng đồng học sinh ở cả hai cơ sở.' : 'Chọn điều em yêu thích, gặp những người bạn cùng chung đam mê ở cả hai cơ sở.'}</p>{teacher && !guestMode && <Button icon={<Plus size={17} />} onClick={() => setGroupForm({ name: '', description: '' })}>Tạo nhóm mới</Button>}<div className="connect-hero-proof"><span><Users size={16} /> {groups.length} cộng đồng đang mở</span><span><Compass size={16} /> Điểm chính × Phân hiệu</span></div></div>
        <div className="connect-hero-art" aria-hidden="true"><div className="connect-orbit connect-orbit-one" /><div className="connect-orbit connect-orbit-two" /><div className="connect-hero-core"><Sparkles size={34} /></div><div className="connect-float connect-float-top"><BookOpen size={19} /><span>{teacher ? 'Không gian sẻ chia' : 'Chia sẻ điều hay'}</span></div><div className="connect-float connect-float-bottom"><Users size={19} /><span>{teacher ? `${groups.length} nhóm đang kết nối` : joinedCount ? `${joinedCount} nhóm của em` : 'Bạn mới đang chờ em'}</span></div><span className="connect-hero-dot dot-one" /><span className="connect-hero-dot dot-two" /><span className="connect-hero-dot dot-three" /></div>
      </header>}
      {error && <ErrorState title={error} onRetry={() => { setError(''); setRefresh((n) => n + 1) }} />}
      {!guestMode && groupForm && <Card className="connect-group-editor"><form onSubmit={(event) => void saveGroup(event)}><h2>{groupForm.id ? 'Chỉnh sửa nhóm' : 'Tạo nhóm mới'}</h2><div className="connect-form-grid"><Input label="Tên nhóm" value={groupForm.name} maxLength={80} required onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} /><Input label="Mô tả" value={groupForm.description} maxLength={500} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} /></div><div className="connect-actions"><Button type="submit" loading={busy}>Lưu nhóm</Button><Button variant="ghost" onClick={() => setGroupForm(null)}>Hủy</Button></div></form></Card>}
      {teacher && !guestMode && !studentGroupOpen && <ConnectInsights title="AI · PHÂN TÍCH HÀNH VI CONNECT" description="Phân tích xu hướng tham gia và tương tác giữa học sinh hai cơ sở." emptyTitle="Chưa có phân tích AI hoạt động CONNECT" emptyDescription="Chạy phân tích để xem mức tham gia giữa hai cơ sở, nhóm hoạt động nổi bật và gợi ý kết nối." insight={connectInsight} loading={insightLoading} busy={insightBusy} onAnalyze={() => void runConnectAnalysis()} />}
      {groups.length === 0 ? <EmptyState title="Chưa có nhóm cộng đồng" description="Giáo viên có thể tạo nhóm để học sinh cùng tham gia." /> : (
        <div className="connect-layout connect-layout-student">
          {!studentGroupOpen && <section className="connect-explorer" aria-labelledby="connect-explorer-title"><div className="connect-explorer-heading"><div><span className="connect-section-eyebrow">{teacher ? 'QUẢN LÝ CỘNG ĐỒNG' : 'TÌM HỘI BẠN MÌNH'}</span><h2 id="connect-explorer-title">{teacher ? 'Khám phá các nhóm' : 'Khám phá cộng đồng'}</h2><p>{teacher ? 'Chọn một nhóm để xem hoạt động và quản lý nội dung.' : 'Mỗi nhóm là một nơi mới để em thử sức và kết nối.'}</p></div><label className="connect-search"><Search size={17} /><input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Tìm nhóm theo sở thích..." aria-label="Tìm nhóm theo sở thích" /></label></div>
            {visibleGroups.length ? <div className="connect-explore-grid">{visibleGroups.map((group) => { const theme = getGroupTheme(group.name); const Icon = theme.icon; return <article className={`connect-explore-card ${selected === group.id ? 'is-selected' : ''}`} key={group.id}>
              <button type="button" className="connect-explore-main" onClick={() => openStudentGroup(group.id)} aria-label={`Mở nhóm ${group.name}`}><span className={`connect-explore-icon ${theme.tone}`}><Icon size={23} /></span><span className="connect-explore-arrow"><ArrowUpRight size={17} /></span><span className="connect-explore-category">{theme.category}</span><strong>{group.name}</strong><span className="connect-explore-description">{group.description || 'Cùng học hỏi, sáng tạo và chia sẻ với bạn bè.'}</span><span className="connect-campus-counts"><span><i className="campus-dot main-dot" />{group.stats.mainMembers} điểm chính</span><span><i className="campus-dot branch-dot" />{group.stats.branchMembers} phân hiệu</span></span></button>
              <div className="connect-explore-footer"><span><Users size={15} /> {group.stats.memberCount ?? group.stats.mainMembers + group.stats.branchMembers} thành viên{!guestMode && teacher && group.stats.pendingPosts ? <Badge variant="warning">{group.stats.pendingPosts} chờ duyệt</Badge> : null}</span><button type="button" className={group.joined ? 'is-joined' : ''} onClick={() => openStudentGroup(group.id)}>{teacher ? guestMode ? 'Xem nhóm' : 'Quản lý nhóm' : group.joined ? 'Vào nhóm' : 'Khám phá'}<ArrowUpRight size={15} /></button></div>
            </article> })}</div> : <div className="connect-search-empty"><Search size={22} /><strong>Chưa tìm thấy nhóm phù hợp</strong><span>Thử một từ khóa khác để khám phá thêm nhé.</span></div>}
          </section>}
          {studentGroupOpen && <section className="connect-main connect-detail-screen" aria-live="polite">
            {!detail ? <LoadingState label="Đang tải nội dung nhóm..." /> : <>
              <button type="button" className="connect-detail-back" onClick={() => { setStudentGroupOpen(false); setMembersOpen(false) }}><ArrowLeft size={17} /> Tất cả cộng đồng</button>
              {!teacher && !guestMode ? <StudentGroupHeader group={detail} joined={detail.joined} busy={busy} onJoin={() => void perform(() => request(`/groups/${detail.id}/join`, { method: detail.joined ? 'DELETE' : 'POST' }), detail.joined ? 'Em đã rời nhóm' : 'Em đã tham gia nhóm')} onMembers={() => setMembersOpen(!membersOpen)} /> : <Card className="connect-group-summary"><div><p className="eyebrow">NHÓM CỘNG ĐỒNG</p><h2>{detail.name}</h2><p>{detail.description}</p></div><div className="connect-actions">
                {teacher && !guestMode && <><Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setGroupForm({ id: detail.id, name: detail.name, description: detail.description ?? '' })}>Sửa nhóm</Button><Button variant="danger" icon={<Trash2 size={16} />} onClick={() => { if (window.confirm('Xóa nhóm cùng toàn bộ bài viết, bình luận và thành viên?')) void perform(() => request(`/groups/${detail.id}`, { method: 'DELETE' }), 'Đã xóa nhóm') }}>Xóa</Button></>}
                <Button variant="ghost" icon={<Users size={16} />} onClick={() => setMembersOpen(!membersOpen)}>Thành viên ({detail.members.length})</Button>
              </div></Card>}
              {teacher && <div className="connect-stats"><Card><strong>{detail.stats.mainMembers}</strong><span>Điểm chính</span></Card><Card><strong>{detail.stats.branchMembers}</strong><span>Phân hiệu</span></Card><Card><strong>{detail.stats.approvedPosts}</strong><span>Bài đăng</span></Card><Card><strong>{detail.stats.comments}</strong><span>Bình luận</span></Card><Card><strong>{detail.stats.crossCampusPercent}%</strong><span>Bài tương tác chéo</span></Card></div>}
              {teacher && <ConnectInsights title={`AI · PHÂN TÍCH HOẠT ĐỘNG NHÓM ${detail.name.toLocaleUpperCase('vi')}`} description="Nhận xét riêng về mức tham gia, bài viết và tương tác liên cơ sở của nhóm." emptyTitle="Chưa có phân tích AI cho nhóm này" emptyDescription="Chạy phân tích để xem hoạt động của riêng nhóm và nhận gợi ý phù hợp." insight={groupInsight} loading={groupInsightLoading} busy={groupInsightBusy} onAnalyze={() => void runGroupAnalysis()} />}
              {membersOpen && <Card className="connect-members"><h3>Thành viên nhóm</h3>{detail.members.length ? detail.members.map((member) => <span key={member.id} className="connect-member">{member.name}<Badge variant={member.campus === 'BRANCH' ? 'info' : 'neutral'}>{member.campus === 'BRANCH' ? 'Phân hiệu' : 'Điểm chính'}</Badge></span>) : <p>Chưa có thành viên.</p>}</Card>}
              {!guestMode && (teacher || detail.joined) && <Card className="connect-compose"><form onSubmit={(event) => void submitPost(event)}><label htmlFor="connect-post"><strong>{teacher ? 'Giáo viên chia sẻ với nhóm' : 'Chia sẻ với nhóm'}</strong></label><textarea id="connect-post" value={body} maxLength={3000} placeholder={teacher ? 'Chia sẻ thông tin hoặc hoạt động với nhóm...' : 'Bạn đang nghĩ gì?'} onChange={(event) => setBody(event.target.value)} /><div className="connect-compose-footer"><label className="connect-image-button"><ImagePlus size={17} />{imageUrls.length ? `Thêm ảnh (${imageUrls.length}/10)` : 'Thêm ảnh'}<input type="file" accept="image/*" multiple disabled={busy || imageUrls.length >= 10} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = '' }} /></label>{imageUrls.map((url, index) => <span className="connect-upload-preview-wrap" key={`${url}-${index}`}><img className="connect-upload-preview" src={url} alt={`Ảnh đính kèm ${index + 1}`} /><button type="button" aria-label="Xóa ảnh" onClick={() => setImageUrls((current) => current.filter((_, imageIndex) => index !== imageIndex))}>×</button></span>)}<Button type="submit" loading={busy} disabled={!body.trim() && !imageUrls.length}>Đăng bài</Button></div></form></Card>}
              {!guestMode && !teacher && !detail.joined && <Card className="connect-join-hint"><p>Tham gia nhóm để đăng bài, bình luận và cùng trao đổi với các bạn.</p></Card>}
              {teacher && !guestMode && <TeacherPending posts={detail.posts.filter((post) => post.status === 'PENDING')} onApprove={(id) => void perform(() => request(`/posts/${id}/approve`, { method: 'PATCH' }), 'Đã duyệt bài viết')} onDelete={(id) => void perform(() => request(`/posts/${id}`, { method: 'DELETE' }), 'Đã xóa bài viết')} />}
              {detail.posts.filter((post) => post.status === 'APPROVED' || (!teacher && post.status === 'PENDING')).length === 0 && !(teacher && detail.posts.some((post) => post.status === 'PENDING')) ? <EmptyState title="Chưa có bài viết" description={detail.joined ? 'Hãy bắt đầu cuộc trò chuyện đầu tiên trong nhóm.' : 'Các bài được duyệt sẽ xuất hiện tại đây.'} icon={<MessageCircle size={20} />} /> : null}
              <div className="connect-feed">{detail.posts.filter((post) => post.status === 'APPROVED' || (!guestMode && !teacher && post.status === 'PENDING')).map((post) => <PostCard key={post.id} post={post} teacher={teacher && !guestMode} joined={guestMode ? false : detail.joined} canComment={!guestMode && (teacher || detail.joined)} busy={busy} onReact={() => void perform(() => request(`/posts/${post.id}/reaction`, { method: 'POST' }), post.reacted ? 'Đã bỏ cảm xúc' : 'Đã thả cảm xúc')} onComment={(event) => void submitComment(event, post.id)} comment={commentDrafts[post.id] ?? ''} setComment={(value) => setCommentDrafts((items) => ({ ...items, [post.id]: value }))} replyTarget={replyTarget} onReply={setReplyTarget} replyDrafts={replyDrafts} setReplyDraft={(id, value) => setReplyDrafts((items) => ({ ...items, [id]: value }))} onSubmitReply={(event, parentId) => void submitComment(event, post.id, parentId)} onDeleteComment={(id) => void perform(() => request(`/comments/${id}`, { method: 'DELETE' }), 'Đã xóa bình luận')} onDeletePost={() => void perform(() => request(`/posts/${post.id}`, { method: 'DELETE' }), 'Đã xóa bài viết')} />)}</div>
            </>}
          </section>}
        </div>
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )

  function TeacherPending({ posts, onApprove, onDelete }: { posts: Post[]; onApprove: (id: string) => void; onDelete: (id: string) => void }) {
    if (!teacher || posts.length === 0) return null
    return <Card className="connect-pending"><h3>Bài viết chờ duyệt <Badge variant="warning">{posts.length}</Badge></h3>{posts.map((post) => <div className="connect-pending-row" key={post.id}><div><strong>{post.author.name}</strong><p>{post.body || 'Đính kèm hình ảnh'}</p></div><Button size="small" icon={<Check size={15} />} onClick={() => onApprove(post.id)}>Duyệt</Button><Button size="small" variant="danger" icon={<Trash2 size={15} />} onClick={() => onDelete(post.id)}>Xóa</Button></div>)}</Card>
  }
}

function connectToastCopy(action: string) {
  if (action.includes('tham gia nhóm')) return { title: 'Đã tham gia nhóm', message: 'Chào mừng em đến với cộng đồng này.' }
  if (action.includes('rời nhóm')) return { title: 'Đã rời nhóm', message: 'Em có thể tham gia lại bất cứ lúc nào.' }
  if (action.includes('thả cảm xúc')) return { title: 'Đã thả cảm xúc', message: 'Cảm xúc của em đã được ghi nhận.' }
  if (action.includes('bỏ cảm xúc')) return { title: 'Đã bỏ cảm xúc', message: 'Cảm xúc trên bài viết đã được cập nhật.' }
  if (action.includes('trả lời')) return { title: 'Đã gửi trả lời', message: 'Phản hồi đã được nối vào cuộc thảo luận.' }
  if (action.includes('bình luận')) return { title: 'Đã đăng bình luận', message: 'Bình luận đã được chia sẻ với nhóm.' }
  if (action.includes('đang chờ giáo viên duyệt')) return { title: 'Đã gửi bài viết', message: 'Bài viết đang chờ giáo viên duyệt trước khi hiển thị.' }
  return { title: action, message: 'Thay đổi đã được cập nhật thành công.' }
}

function ConnectInsights({ title, description, emptyTitle, emptyDescription, insight, loading, busy, onAnalyze }: { title: string; description: string; emptyTitle: string; emptyDescription: string; insight: ConnectInsight | null; loading: boolean; busy: boolean; onAnalyze: () => void }) {
  return <section className="cycle-ai-block connect-ai-section">
    <div className="ai-block-header"><Sparkles size={20} className="ai-icon" /><div><h3 className="section-title-sm">{title}</h3><p className="ai-stage-hint">{description}</p></div></div>
    <div className="ai-evaluation-box">
      {insight?.summary ? <><div className="connect-ai-result-heading"><strong>{insight.title ?? 'Nhận xét từ dữ liệu hoạt động'}</strong>{insight.updatedAt && <small>Cập nhật {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(insight.updatedAt))}</small>}</div><p className="ai-summary">{insight.summary}</p></> : loading ? <LoadingState compact label="Đang tải phân tích..." /> : <EmptyState title={emptyTitle} description={emptyDescription} compact />}
      {insight?.recommendations.length ? <div className="ai-recs-list"><span className="recs-title"><Lightbulb size={15} /> Gợi ý hành động:</span><ul>{insight.recommendations.map((recommendation, index) => <li key={`${index}-${recommendation}`}>{recommendation}</li>)}</ul></div> : null}
      {insight?.error && <p className="insight-warning" role="alert">{insight.error}</p>}
      <div className="page-header-actions"><Button icon={insight?.analysisId ? <RefreshCw size={15} /> : <Activity size={15} />} loading={busy || loading} disabled={busy || loading} onClick={onAnalyze}>{insight?.analysisId ? 'Chạy lại phân tích AI' : 'Phân tích hoạt động bằng AI'}</Button></div>
      
    </div>
  </section>
}

function getGroupTheme(name: string): { category: string; icon: LucideIcon; tone: string } {
  const value = name.toLocaleLowerCase('vi')
  if (value.includes('số học đường')) return { category: 'Công nghệ & AI', icon: Lightbulb, tone: 'tone-indigo' }
  if (value.includes('english')) return { category: 'Ngôn ngữ', icon: Languages, tone: 'tone-blue' }
  if (value.includes('stem')) return { category: 'Khám phá', icon: FlaskConical, tone: 'tone-teal' }
  if (value.includes('thể thao')) return { category: 'Năng động', icon: Trophy, tone: 'tone-orange' }
  if (value.includes('âm nhạc') || value.includes('nghệ thuật')) return { category: 'Sáng tạo', icon: Music2, tone: 'tone-pink' }
  if (value.includes('văn học')) return { category: 'Văn học', icon: BookOpen, tone: 'tone-violet' }
  if (value.includes('toán')) return { category: 'Tư duy', icon: Calculator, tone: 'tone-amber' }
  return { category: 'Cộng đồng học tập', icon: Hash, tone: 'tone-indigo' }
}

function StudentGroupHeader({ group, joined, busy, onJoin, onMembers }: { group: GroupDetail; joined: boolean; busy: boolean; onJoin: () => void; onMembers: () => void }) {
  const theme = getGroupTheme(group.name)
  const Icon = theme.icon
  return <section className={`connect-student-group connect-group-${theme.tone.replace('tone-', '')}`}>
    <div className="connect-student-group-top"><span className={`connect-student-group-icon ${theme.tone}`}><Icon size={25} /></span><div className="connect-student-group-copy"><span>{theme.category} · CỘNG ĐỒNG HỌC SINH</span><h2>{group.name}</h2><p>{group.description || 'Cùng học hỏi, sáng tạo và chia sẻ với bạn bè.'}</p></div><div className="connect-student-group-actions"><Button variant={joined ? 'secondary' : 'primary'} loading={busy} onClick={onJoin}>{joined ? 'Đã tham gia' : 'Tham gia nhóm'}</Button><button type="button" className="connect-member-link" onClick={onMembers}><Users size={16} /> {group.members.length} thành viên</button></div></div>
    <div className="connect-student-group-bottom"><span><i className="campus-dot main-dot" />{group.stats.mainMembers} học sinh điểm chính</span><span><i className="campus-dot branch-dot" />{group.stats.branchMembers} học sinh phân hiệu</span><span className="connect-cross-campus-note"><Sparkles size={15} /> Một nhóm chung, hai cơ sở cùng kết nối</span></div>
  </section>
}

function PostCard({ post, teacher, joined, canComment, busy, onReact, onComment, comment, setComment, replyTarget, onReply, replyDrafts, setReplyDraft, onSubmitReply, onDeleteComment, onDeletePost }: { post: Post; teacher: boolean; joined: boolean; canComment: boolean; busy: boolean; onReact: () => void; onComment: (event: FormEvent) => void; comment: string; setComment: (value: string) => void; replyTarget: string | null; onReply: (id: string | null) => void; replyDrafts: Record<string, string>; setReplyDraft: (id: string, value: string) => void; onSubmitReply: (event: FormEvent, parentId: string) => void; onDeleteComment: (id: string) => void; onDeletePost: () => void }) {
  return <Card className="connect-post"><header><div className="connect-avatar">{post.author.name.slice(0, 1)}</div><div><strong>{post.author.name}</strong><small>{post.author.campus === 'BRANCH' ? 'Phân hiệu' : 'Điểm chính'} · {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.createdAt))}</small></div>{post.status === 'PENDING' && <Badge variant="warning">Chờ duyệt</Badge>}{teacher && <Button variant="ghost" size="small" icon={<Trash2 size={15} />} onClick={onDeletePost}>Xóa bài</Button>}</header>
    {post.body && <p className="connect-post-body">{post.body}</p>}{[...new Set([...(post.imageUrls ?? []), ...(post.imageUrl ? [post.imageUrl] : [])])].map((url, index) => <img key={`${url}-${index}`} className="connect-post-image" src={url} alt={`Ảnh ${index + 1} trong bài viết`} />)}
    {post.status === 'APPROVED' && <><div className="connect-post-actions"><button type="button" disabled={!joined || busy} className={post.reacted ? 'reacted' : ''} onClick={onReact}><Heart size={17} fill={post.reacted ? 'currentColor' : 'none'} /> {post.reactionCount}</button><span><MessageCircle size={16} /> {post.comments.length}</span></div><div className="connect-comments">{post.comments.filter((item) => !item.parentId).map((item) => <div className="connect-comment-thread" key={item.id}><div className="connect-comment"><p><strong>{item.author.name}</strong> {item.body}</p>{teacher && <button type="button" aria-label="Xóa bình luận" onClick={() => onDeleteComment(item.id)}><Trash2 size={14} /></button>}</div>{post.comments.filter((reply) => reply.parentId === item.id).map((reply) => <div className="connect-comment connect-comment-reply" key={reply.id}><p><strong>{reply.author.name}</strong> {reply.body}</p>{teacher && <button type="button" aria-label="Xóa trả lời" onClick={() => onDeleteComment(reply.id)}><Trash2 size={14} /></button>}</div>)}{canComment && <button type="button" className="connect-reply-button" onClick={() => onReply(replyTarget === item.id ? null : item.id)}>Trả lời</button>}{replyTarget === item.id && canComment && <form className="connect-comment-form connect-reply-form" onSubmit={(event) => onSubmitReply(event, item.id)}><input aria-label="Trả lời bình luận" value={replyDrafts[item.id] ?? ''} maxLength={1000} placeholder={`Trả lời ${item.author.name}...`} onChange={(event) => setReplyDraft(item.id, event.target.value)} /><button type="submit" disabled={!(replyDrafts[item.id] ?? '').trim() || busy}>Gửi</button></form>}</div>)}</div>{canComment && <form className="connect-comment-form" onSubmit={onComment}><input aria-label="Viết bình luận" value={comment} maxLength={1000} placeholder="Viết bình luận..." onChange={(event) => setComment(event.target.value)} /><button type="submit" disabled={!comment.trim() || busy}>Gửi</button></form>}</>}
  </Card>
}
