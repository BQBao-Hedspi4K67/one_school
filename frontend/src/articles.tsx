import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Clock,
  Edit3,
  ImagePlus,
  Plus,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  Search,
  Users,
} from "lucide-react";
import { useAuth } from "./auth";
import {
  deleteArticle,
  fetchArticle,
  fetchManagedArticles,
  fetchPublishedArticles,
  saveArticle,
  updateArticlePublication,
  uploadArticleImage,
  type Article,
  type ArticleInput,
  type ArticleSummary,
} from "./articles-api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  Toast,
} from "./components/ui";
import articleHero from "./assets/hero.png";
import { resizeImageBeforeUpload } from "./image-utils";
import { API_URL } from "./api-url";

function formatDate(value: string | null) {
  if (!value) return "Bài viết ONE SCHOOL";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(
    new Date(value),
  );
}

function ArticleContent({ content }: { content: string }) {
  return (
    <div className="article-content">
      {content
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph, index) => {
          const heading = paragraph.match(/^#{1,3}\s+(.+)$/);
          if (heading) {
            return <h2 key={index}>{heading[1]}</h2>;
          }
          if (paragraph.startsWith(">")) {
            return (
              <blockquote key={index} className="article-blockquote">
                <p>{paragraph.replace(/^>\s*/, "")}</p>
              </blockquote>
            );
          }
          return <p key={index}>{paragraph}</p>;
        })}
    </div>
  );
}

function ArticleDetailView({
  article,
  relatedArticles,
  onBack,
  onOpenArticle,
  onShare,
}: {
  article: Article;
  relatedArticles: ArticleSummary[];
  onBack: () => void;
  onOpenArticle: (slug: string) => void;
  onShare: () => void;
}) {
  const wordCount = article.content.trim().split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 220));

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="article-detail-container">
      {/* Top action bar */}
      <div className="article-detail-topbar">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Danh sách bài viết
        </button>
        <Button
          size="small"
          variant="secondary"
          icon={<Share2 size={15} />}
          onClick={onShare}
        >
          Chia sẻ
        </Button>
      </div>

      <article className="article-detail-paper">
        {/* Header section */}
        <header className="article-detail-header">
          <div className="article-category-badge">
            <Tag size={13} aria-hidden="true" />
            <span>{article.category}</span>
          </div>

          <h1 className="article-headline">{article.title}</h1>

          {article.description && (
            <p className="article-lead">{article.description}</p>
          )}

          <div className="article-author-bar">
            <div className="article-author-info">
              <span className="article-author-avatar" aria-hidden="true">OS</span>
              <div>
                <strong>Ban Biên tập ONE SCHOOL</strong>
                <span className="article-author-role">Trường THCS Đông Ngạc</span>
              </div>
            </div>

            <div className="article-meta-chips">
              <span className="article-meta-chip">
                <CalendarDays size={14} aria-hidden="true" />
                {formatDate(article.publishedAt)}
              </span>
              <span className="article-meta-chip">
                <Clock size={14} aria-hidden="true" />
                ~{readingTime} phút đọc
              </span>
            </div>
          </div>
        </header>

        {/* Hero image showcase */}
        <figure className="article-hero-figure">
          <img
            className="article-detail-image"
            src={article.coverImageUrl ?? articleHero}
            alt={`Minh họa cho bài viết: ${article.title}`}
          />
          <figcaption className="article-hero-caption">
            Hình ảnh hoạt động và câu chuyện kết nối — Dự án ONE SCHOOL THCS Đông Ngạc
          </figcaption>
        </figure>

        {/* Content body */}
        <div className="article-content-wrapper">
          {(article.imageUrls ?? []).length > 0 && <div className="article-image-gallery">{article.imageUrls.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`Ảnh ${index + 1} trong bài viết`} loading="lazy" />)}</div>}
          <ArticleContent content={article.content} />
        </div>

        {/* ONE SCHOOL mission banner */}
        <div className="article-mission-banner">
          <div className="article-mission-icon" aria-hidden="true">
            <Sparkles size={22} />
          </div>
          <div className="article-mission-content">
            <strong>Dự án ONE SCHOOL — THCS Đông Ngạc</strong>
            <p>
              Mỗi bài viết là nhịp cầu lan tỏa tri thức, chia sẻ câu chuyện giáo dục và thu hẹp khoảng cách giữa Điểm chính và Phân hiệu.
            </p>
          </div>
        </div>

        {/* Bottom navigation actions */}
        <div className="article-bottom-actions">
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={onBack}>
            Quay lại danh sách
          </Button>
          <Button variant="ghost" icon={<ArrowUp size={16} />} onClick={scrollToTop}>
            Lên đầu trang
          </Button>
        </div>
      </article>

      {/* Related articles section */}
      {relatedArticles.length > 0 && (
        <section className="article-related-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Khám phá thêm</p>
              <h3>Bài viết cùng chuyên mục</h3>
            </div>
          </div>
          <div className="article-related-grid">
            {relatedArticles.map((item) => (
              <Card
                key={item.id}
                className="article-related-card"
                onClick={() => onOpenArticle(item.slug)}
              >
                <div className="article-related-thumb">
                  <img
                    src={item.coverImageUrl ?? articleHero}
                    alt={item.title}
                  />
                  <span className="article-related-tag">{item.category}</span>
                </div>
                <div className="article-related-body">
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                  <div className="article-related-footer">
                    <span className="article-related-date">
                      <CalendarDays size={13} aria-hidden="true" />
                      {formatDate(item.publishedAt)}
                    </span>
                    <span className="article-related-more">Đọc tiếp →</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ArticlesPage({
  management = false,
  guestMode = false,
  onOpenManagement,
  onBack,
}: {
  management?: boolean;
  guestMode?: boolean;
  onOpenManagement?: () => void;
  onBack?: () => void;
}) {
  const { accessToken, user } = useAuth();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [managedArticles, setManagedArticles] = useState<Article[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [managedLoading, setManagedLoading] = useState(true);
  const [managedError, setManagedError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReload, setDetailReload] = useState(0);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [form, setForm] = useState<ArticleInput>({
    title: "",
    category: "",
    description: "",
    content: "",
    coverImageUrl: null,
    imageUrls: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const isTeacher = user?.role === "TEACHER";

  const loadArticles = useCallback(() => {
    if (guestMode) {
      setLoading(true);
      setError("");
      fetch(`${API_URL}/api/guest/showcase`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Không thể tải bài viết");
          return (data.articles ?? []).map((article: ArticleSummary & { id: string }) => ({ ...article, slug: article.id }));
        })
        .then((items: ArticleSummary[]) => setArticles(items))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải bài viết"))
        .finally(() => setLoading(false));
      return;
    }
    if (!accessToken) return;
    setLoading(true);
    setError("");
    fetchPublishedArticles(accessToken)
      .then(setArticles)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Không thể tải bài viết",
        ),
      )
      .finally(() => setLoading(false));
  }, [accessToken, guestMode]);

  const loadManagedArticles = useCallback(() => {
    if (guestMode || !accessToken || !isTeacher) {
      setManagedLoading(false);
      return;
    }
    setManagedLoading(true);
    setManagedError("");
    fetchManagedArticles(accessToken)
      .then(setManagedArticles)
      .catch((reason: unknown) =>
        setManagedError(
          reason instanceof Error
            ? reason.message
            : "Không thể tải danh sách quản lý",
        ),
      )
      .finally(() => setManagedLoading(false));
  }, [accessToken, guestMode, isTeacher]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (management) loadManagedArticles();
    else loadArticles();
  }, [loadArticles, loadManagedArticles, management]);

  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => {
    if ((!accessToken && !guestMode) || !selectedSlug) return;
    const articleRequest = guestMode
      ? fetch(`${API_URL}/api/guest/articles/${encodeURIComponent(selectedSlug)}`).then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "Không thể tải bài viết");
          return body as Article;
        })
      : fetchArticle(accessToken!, selectedSlug);
    articleRequest
      .then(setArticle)
      .catch((reason: unknown) =>
        setDetailError(
          reason instanceof Error ? reason.message : "Không thể tải bài viết",
        ),
      )
      .finally(() => setDetailLoading(false));
  }, [accessToken, detailReload, guestMode, selectedSlug]);

  const openArticle = (slug: string) => {
    setArticle(null);
    setDetailLoading(true);
    setDetailError("");
    setSelectedSlug(slug);
  };
  const retryArticle = () => {
    setDetailLoading(true);
    setDetailError("");
    setDetailReload((value) => value + 1);
  };
  const backToList = () => {
    setSelectedSlug(null);
    setArticle(null);
    setDetailError("");
  };

  const openEditor = (item?: Article) => {
    setEditingArticle(item ?? null);
    setForm(
      item
        ? {
            title: item.title,
            category: item.category,
            description: item.description,
            content: item.content,
            coverImageUrl: item.coverImageUrl,
            imageUrls: item.imageUrls ?? [],
          }
        : {
            title: "",
            category: "",
            description: "",
            content: "",
            coverImageUrl: null,
            imageUrls: [],
          },
    );
    setEditorOpen(true);
  };

  const submitArticle = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    const articleInput = {
      ...form,
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
    };
    if (
      !articleInput.title ||
      !articleInput.category ||
      !articleInput.description ||
      !articleInput.content
    ) {
      setToast({
        title: "Thiếu thông tin",
        message: "Vui lòng điền đầy đủ danh mục, tiêu đề, mô tả và nội dung.",
        variant: "error",
      });
      return;
    }
    if (articleInput.title.length < 3) {
      setToast({
        title: "Tiêu đề quá ngắn",
        message: "Tiêu đề bài viết cần có ít nhất 3 ký tự.",
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await saveArticle(accessToken, articleInput, editingArticle?.id);
      setEditorOpen(false);
      setToast({
        title: "Đã lưu và công bố bài viết",
        message: editingArticle
          ? "Nội dung đã được cập nhật và hiển thị với học sinh."
          : "Bài viết đã được đăng và hiển thị với học sinh.",
        variant: "success",
      });
      if (management) {
        loadArticles();
        loadManagedArticles();
      }
    } catch (reason) {
      setToast({
        title: "Không thể lưu bài viết",
        message: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File) => {
    if (!accessToken) return;
    setUploading(true);
    try {
      const resized = await resizeImageBeforeUpload(file, 1200, 0.85);
      const url = await uploadArticleImage(accessToken, resized);
      setForm((current) => ({ ...current, coverImageUrl: url }));
    } catch (reason) {
      setToast({
        title: "Không thể tải ảnh",
        message: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadArticleImages = async (files: FileList | null) => {
    if (!accessToken || !files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 10 - (form.imageUrls?.length ?? 0)));
    if (!selected.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of selected) {
        const resized = await resizeImageBeforeUpload(file, 1200, 0.85);
        urls.push(await uploadArticleImage(accessToken, resized));
      }
      setForm((current) => ({ ...current, imageUrls: [...(current.imageUrls ?? []), ...urls] }));
    } catch (reason) {
      setToast({ title: "Không thể tải ảnh", message: reason instanceof Error ? reason.message : "Vui lòng thử lại.", variant: "error" });
    } finally { setUploading(false); }
  };

  const publishDraft = async (item: Article) => {
    if (!accessToken) return;
    try {
      await updateArticlePublication(accessToken, item.id, true);
      setToast({
        title: "Đã công bố bài viết",
        message: "Học sinh có thể xem bài viết.",
        variant: "success",
      });
      loadArticles();
      loadManagedArticles();
    } catch (reason) {
      setToast({
        title: "Không thể cập nhật trạng thái",
        message: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "error",
      });
    }
  };

  const removeArticle = async (item: Article) => {
    if (
      !accessToken ||
      !window.confirm(`Bạn có chắc muốn xóa bài viết “${item.title}”?`)
    )
      return;
    try {
      await deleteArticle(accessToken, item.id);
      setToast({
        title: "Đã xóa bài viết",
        message: "Bài viết đã được xóa.",
        variant: "success",
      });
      loadArticles();
      loadManagedArticles();
    } catch (reason) {
      setToast({
        title: "Không thể xóa bài viết",
        message: reason instanceof Error ? reason.message : "Vui lòng thử lại.",
        variant: "error",
      });
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setToast({
        title: "Đã sao chép liên kết",
        message: "Liên kết bài viết đã được lưu vào bộ nhớ tạm.",
        variant: "success",
      });
    } else {
      setToast({
        title: "Chia sẻ bài viết",
        message: window.location.href,
        variant: "success",
      });
    }
  };

  if (selectedSlug) {
    const related = (management ? managedArticles : articles)
      .filter((item) => item.slug !== selectedSlug)
      .slice(0, 3);

    return (
      <section className="articles-page">
        {detailLoading && (
          <Card className="article-detail-loading">
            <Skeleton />
            <Skeleton width="70%" />
            <Skeleton />
          </Card>
        )}
        {!detailLoading && detailError && (
          <div>
            <button className="back-button" type="button" onClick={backToList} style={{ marginBottom: 16 }}>
              <ArrowLeft size={16} /> Danh sách bài viết
            </button>
            <ErrorState title={detailError} onRetry={retryArticle} />
          </div>
        )}
        {!detailLoading && article && (
          <ArticleDetailView
            article={article}
            relatedArticles={related}
            onBack={backToList}
            onOpenArticle={openArticle}
            onShare={handleShare}
          />
        )}
        {toast && (
          <Toast
            title={toast.title}
            message={toast.message}
            variant={toast.variant}
            onClose={() => setToast(null)}
          />
        )}
      </section>
    );
  }

  const categories = Array.from(
    new Set(articles.map((a) => a.category).filter(Boolean)),
  );

  const filteredArticles = articles.filter((item) => {
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = item.title.toLowerCase().includes(q);
      const descMatch = (item.description ?? "").toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      return titleMatch || descMatch || catMatch;
    }
    return true;
  });

  return (
    <section className="articles-page">
      {management ? (
        <>
          <button className="back-button" type="button" onClick={onBack} style={{ marginBottom: "16px" }}>
            <ArrowLeft size={16} /> Quay lại trang bài viết học sinh
          </button>
          <header className="student-page-hero">
            <div className="student-hero-copy">
              <span className="student-hero-kicker">
                <BookOpen size={15} aria-hidden="true" />
                Không gian truyền thông giáo dục · THCS Đông Ngạc
              </span>
              <h1>
                Quản lý bài viết &<br />
                <span>Lan tỏa câu chuyện học đường.</span>
              </h1>
              <p>
                Soạn thảo, biên tập và công bố các bài viết giáo dục, cẩm nang kỹ năng và câu chuyện kết nối tới toàn thể học sinh hai cơ sở.
              </p>
              {isTeacher && (
                <div className="teacher-hero-actions">
                  <Button icon={<Plus size={16} />} onClick={() => openEditor()}>
                    Tạo bài viết mới
                  </Button>
                </div>
              )}
              <div className="student-hero-proof">
                <span><BookOpen size={16} /> {managedArticles.length} Bài viết của bạn</span>
                <span><Sparkles size={16} /> {managedArticles.filter((a) => a.published).length} Đã công bố</span>
                <span><Users size={16} /> Kết nối 2 cơ sở</span>
              </div>
            </div>
            <div className="student-hero-art" aria-hidden="true">
              <div className="student-hero-orbit student-hero-orbit-one" />
              <div className="student-hero-orbit student-hero-orbit-two" />
              <div className="student-hero-core">
                <BookOpen size={36} />
              </div>
              <div className="student-hero-float float-top">
                <Sparkles size={18} />
                <span>Biên tập nội dung</span>
              </div>
              <div className="student-hero-float float-bottom">
                <Users size={18} />
                <span>Lan tỏa tri thức</span>
              </div>
              <span className="student-hero-dot dot-one" />
              <span className="student-hero-dot dot-two" />
              <span className="student-hero-dot dot-three" />
            </div>
          </header>

          <section
            className="article-management"
            aria-label="Danh sách bài viết của tôi"
            style={{ marginTop: "24px" }}
          >
            {managedLoading && (
              <div className="article-grid">
                {[1, 2, 3].map((item) => (
                  <Card key={item}>
                    <Skeleton />
                    <Skeleton width="65%" />
                  </Card>
                ))}
              </div>
            )}
            {!managedLoading && managedError && (
              <ErrorState title={managedError} onRetry={loadManagedArticles} />
            )}
            {!managedLoading && !managedError && managedArticles.length === 0 && (
              <EmptyState
                icon={<BookOpen size={24} />}
                title="Bạn chưa có bài viết nào"
                description="Tạo bài viết đầu tiên để chia sẻ tri thức và câu chuyện tới các em học sinh."
              />
            )}
            {!managedLoading && !managedError && managedArticles.length > 0 && (
              <div className="article-grid">
                {managedArticles.map((item) => (
                  <Card className="article-card" key={item.id}>
                    <div style={{ position: "relative", overflow: "hidden" }}>
                      <img
                        src={item.coverImageUrl ?? articleHero}
                        alt={`Ảnh bìa: ${item.title}`}
                      />
                      <span
                        className="article-category"
                        style={{
                          position: "absolute",
                          top: "12px",
                          left: "12px",
                          zIndex: 2,
                          margin: 0,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                      >
                        {item.category}
                      </span>
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          zIndex: 2,
                        }}
                      >
                        <Badge variant={item.published ? "success" : "warning"}>
                          {item.published ? "Đã công bố" : "Bản nháp"}
                        </Badge>
                      </div>
                    </div>
                    <div className="article-card-body">
                      <h2>{item.title}</h2>
                      <p>{item.description}</p>
                      <div
                        className="article-card-footer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <CalendarDays size={13} aria-hidden="true" />
                          {formatDate(item.publishedAt)}
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Button
                            size="small"
                            variant="secondary"
                            icon={<Edit3 size={14} />}
                            onClick={() => openEditor(item)}
                          >
                            Sửa
                          </Button>
                          {!item.published && (
                            <Button
                              size="small"
                              onClick={() => void publishDraft(item)}
                            >
                              Công bố
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="danger"
                            icon={<Trash2 size={14} />}
                            onClick={() => void removeArticle(item)}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <header className="student-page-hero">
            <div className="student-hero-copy">
              <span className="student-hero-kicker">
                <BookOpen size={15} aria-hidden="true" />
                Góc chia sẻ · THCS Đông Ngạc
              </span>
              <h1>
                Câu chuyện &<br />
                <span>Tri thức học đường.</span>
              </h1>
              <p>
                Không gian chia sẻ kinh nghiệm học tập, kỹ năng sống và những câu chuyện truyền cảm hứng kết nối Điểm chính và Phân hiệu.
              </p>
              <div className="student-hero-proof">
                <span><BookOpen size={16} /> {articles.length} Bài viết</span>
                <span><Users size={16} /> Điểm chính × Phân hiệu</span>
                <span><Sparkles size={16} /> Lan tỏa tri thức</span>
              </div>
            </div>
            <div className="student-hero-art" aria-hidden="true">
              <div className="student-hero-orbit student-hero-orbit-one" />
              <div className="student-hero-orbit student-hero-orbit-two" />
              <div className="student-hero-core">
                <BookOpen size={36} />
              </div>
              <div className="student-hero-float float-top">
                <Sparkles size={18} />
                <span>Truyền cảm hứng</span>
              </div>
              <div className="student-hero-float float-bottom">
                <Users size={18} />
                <span>Gắn kết học đường</span>
              </div>
              <span className="student-hero-dot dot-one" />
              <span className="student-hero-dot dot-two" />
              <span className="student-hero-dot dot-three" />
            </div>
          </header>

          {isTeacher && onOpenManagement && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <Button size="small" variant="secondary" icon={<Edit3 size={15} />} onClick={onOpenManagement}>
                Không gian quản lý bài viết
              </Button>
            </div>
          )}

          {articles.length > 0 && (
            <div className="student-filter-toolbar">
              <div className="student-filter-tabs">
                <button
                  type="button"
                  className={`student-filter-tab ${selectedCategory === "ALL" ? "is-active" : ""}`}
                  onClick={() => setSelectedCategory("ALL")}
                >
                  Tất cả ({articles.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`student-filter-tab ${selectedCategory === cat ? "is-active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat} ({articles.filter((a) => a.category === cat).length})
                  </button>
                ))}
              </div>
              <label className="student-search-box">
                <Search size={16} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bài viết..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Tìm bài viết"
                />
              </label>
            </div>
          )}
        </>
      )}
      {management && (
        <Modal
          open={editorOpen}
          title={editingArticle ? "Chỉnh sửa bài viết" : "Tạo bài viết"}
          onClose={() => setEditorOpen(false)}
        >
          <form
            className="article-editor"
            onSubmit={(event) => void submitArticle(event)}
          >
            <Input
              label="Tiêu đề *"
              maxLength={160}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <Input
              label="Danh mục *"
              maxLength={80}
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            />
            <label className="field">
              <span className="field-label">Mô tả ngắn *</span>
              <textarea
                className="input textarea"
                rows={2}
                maxLength={300}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span className="field-label">
                Nội dung *{" "}
                <small>
                  (dùng dòng trống để tách đoạn; tiêu đề có thể bắt đầu bằng #)
                </small>
              </span>
              <textarea
                className="input textarea"
                rows={10}
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
              />
            </label>
            <div className="article-image-upload">
              {form.coverImageUrl && (
                <img src={form.coverImageUrl} alt="Ảnh bìa bài viết" />
              )}
              <label className="upload-control">
                <ImagePlus size={17} />
                {uploading ? "Đang tải ảnh..." : "Chọn ảnh bìa"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                />
              </label>
            </div>
            <div className="article-image-upload">
              <span className="field-label">Ảnh trong bài viết (tối đa 10 ảnh)</span>
              <label className="upload-control">
                <ImagePlus size={17} />
                {uploading ? "Đang tải ảnh..." : "Chọn nhiều ảnh"}
                <input type="file" accept="image/*" multiple disabled={uploading || (form.imageUrls?.length ?? 0) >= 10} onChange={(event) => { void uploadArticleImages(event.target.files); event.currentTarget.value = ""; }} />
              </label>
              {!!form.imageUrls?.length && <div className="article-image-gallery article-image-gallery-editor">{form.imageUrls.map((url, index) => <div key={`${url}-${index}`}><img src={url} alt={`Ảnh ${index + 1}`} /><button type="button" aria-label="Xóa ảnh" onClick={() => setForm((current) => ({ ...current, imageUrls: (current.imageUrls ?? []).filter((_, imageIndex) => imageIndex !== index) }))}>×</button></div>)}</div>}
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving || uploading}>
                Lưu và công bố
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {!management && loading && (
        <div className="article-grid">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <Skeleton />
              <Skeleton width="78%" />
              <Skeleton width="55%" />
            </Card>
          ))}
        </div>
      )}
      {!management && !loading && error && (
        <ErrorState title={error} onRetry={loadArticles} />
      )}
      {!management && !loading && !error && articles.length === 0 && (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Chưa có bài viết"
          description="Bài viết mới sẽ sớm được thầy cô chia sẻ tại đây."
        />
      )}
      {!management && !loading && !error && articles.length > 0 && filteredArticles.length === 0 && (
        <EmptyState
          icon={<Search size={24} />}
          title="Không tìm thấy bài viết phù hợp"
          description="Hãy thử chọn danh mục khác hoặc thay đổi từ khóa tìm kiếm nhé."
        />
      )}
      {!management && !loading && !error && filteredArticles.length > 0 && (
        <div className="article-grid">
          {filteredArticles.map((item) => (
            <Card
              className="article-card"
              key={item.id}
              onClick={() => openArticle(item.slug)}
            >
              <div style={{ position: "relative", overflow: "hidden" }}>
                <img
                  src={item.coverImageUrl ?? articleHero}
                  alt={`Minh họa cho bài viết: ${item.title}`}
                />
                <span
                  className="article-category"
                  style={{
                    position: "absolute",
                    top: "12px",
                    left: "12px",
                    zIndex: 2,
                    margin: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                >
                  {item.category}
                </span>
              </div>
              <div className="article-card-body">
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <div className="article-card-footer">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <CalendarDays size={13} aria-hidden="true" />
                    {formatDate(item.publishedAt)}
                  </span>
                  <Button
                    size="small"
                    variant="ghost"
                    icon={<ArrowRight size={15} />}
                    onClick={() => openArticle(item.slug)}
                  >
                    Đọc bài
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </section>
  );
}
