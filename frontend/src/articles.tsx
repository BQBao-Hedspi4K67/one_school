import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Edit3,
  ImagePlus,
  Plus,
  Trash2,
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
          return heading ? (
            <h2 key={index}>{heading[1]}</h2>
          ) : (
            <p key={index}>{paragraph}</p>
          );
        })}
    </div>
  );
}

export function ArticlesPage({
  management = false,
  onOpenManagement,
  onBack,
}: {
  management?: boolean;
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
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const isTeacher = user?.role === "TEACHER";

  const loadArticles = useCallback(() => {
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
  }, [accessToken]);

  const loadManagedArticles = useCallback(() => {
    if (!accessToken || !isTeacher) {
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
  }, [accessToken, isTeacher]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (management) loadManagedArticles();
    else loadArticles();
  }, [loadArticles, loadManagedArticles, management]);

  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => {
    if (!accessToken || !selectedSlug) return;
    fetchArticle(accessToken, selectedSlug)
      .then(setArticle)
      .catch((reason: unknown) =>
        setDetailError(
          reason instanceof Error ? reason.message : "Không thể tải bài viết",
        ),
      )
      .finally(() => setDetailLoading(false));
  }, [accessToken, detailReload, selectedSlug]);

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
          }
        : {
            title: "",
            category: "",
            description: "",
            content: "",
            coverImageUrl: null,
          },
    );
    setEditorOpen(true);
  };

  const submitArticle = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    if (
      !form.title.trim() ||
      !form.category.trim() ||
      !form.description.trim() ||
      !form.content.trim()
    ) {
      setToast({
        title: "Thiếu thông tin",
        message: "Vui lòng điền đầy đủ danh mục, tiêu đề, mô tả và nội dung.",
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await saveArticle(accessToken, form, editingArticle?.id);
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
      const url = await uploadArticleImage(accessToken, file);
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

  if (selectedSlug) {
    return (
      <section className="articles-page">
        <button className="back-button" type="button" onClick={backToList}>
          <ArrowLeft size={16} /> Danh sách bài viết
        </button>
        {detailLoading && (
          <Card className="article-detail-loading">
            <Skeleton />
            <Skeleton width="70%" />
            <Skeleton />
          </Card>
        )}
        {!detailLoading && detailError && (
          <ErrorState title={detailError} onRetry={retryArticle} />
        )}
        {!detailLoading && article && (
          <article className="article-detail">
            <p className="eyebrow">{article.category}</p>
            <h1>{article.title}</h1>
            <p className="article-lead">{article.description}</p>
            <p className="article-date">
              <CalendarDays size={15} />
              {formatDate(article.publishedAt)}
            </p>
            <img
              className="article-detail-image"
              src={article.coverImageUrl ?? articleHero}
              alt={`Minh họa cho bài viết: ${article.title}`}
            />
            <ArticleContent content={article.content} />
          </article>
        )}
      </section>
    );
  }

  return (
    <section className="articles-page">
      {management && (
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại bài viết
        </button>
      )}
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {management ? "Không gian giáo viên" : "Góc chia sẻ ONE SCHOOL"}
          </p>
          <h1>{management ? "Quản lý bài viết" : "Bài viết"}</h1>
          {management && (
            <p className="article-lead">
              Bài viết được công bố ngay khi bạn lưu.
            </p>
          )}
        </div>
        {management && isTeacher ? (
          <Button icon={<Plus size={16} />} onClick={() => openEditor()}>
            Tạo bài viết
          </Button>
        ) : isTeacher && onOpenManagement ? (
          <Button icon={<Edit3 size={16} />} onClick={onOpenManagement}>
            Quản lý bài viết
          </Button>
        ) : null}
      </div>
      {management && (
        <section
          className="article-management"
          aria-label="Danh sách bài viết của tôi"
        >
          {managedLoading && (
            <Card>
              <Skeleton />
              <Skeleton width="65%" />
            </Card>
          )}
          {!managedLoading && managedError && (
            <ErrorState title={managedError} onRetry={loadManagedArticles} />
          )}
          {!managedLoading && !managedError && managedArticles.length === 0 && (
            <EmptyState
              icon={<BookOpen size={22} />}
              title="Bạn chưa có bài viết"
              description="Tạo bài viết đầu tiên để chia sẻ với học sinh."
            />
          )}
          {!managedLoading && !managedError && managedArticles.length > 0 && (
            <div className="article-management-list">
              {managedArticles.map((item) => (
                <Card className="article-management-item" key={item.id}>
                  {item.coverImageUrl && (
                    <img
                      className="article-management-thumbnail"
                      src={item.coverImageUrl}
                      alt=""
                    />
                  )}
                  <div className="article-management-copy">
                    <span className="article-category">{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <Badge variant={item.published ? "success" : "warning"}>
                      {item.published ? "Đã công bố" : "Bản nháp cũ"}
                    </Badge>
                  </div>
                  <div className="article-management-actions">
                    <Button
                      size="small"
                      variant="secondary"
                      icon={<Edit3 size={15} />}
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
                      icon={<Trash2 size={15} />}
                      onClick={() => void removeArticle(item)}
                    >
                      Xóa
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
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
          icon={<BookOpen size={22} />}
          title="Chưa có bài viết"
          description="Bài viết mới sẽ sớm được chia sẻ tại đây."
        />
      )}
      {!management && !loading && !error && articles.length > 0 && (
        <div className="article-grid">
          {articles.map((item) => (
            <Card className="article-card" key={item.id}>
              <img
                src={item.coverImageUrl ?? articleHero}
                alt={`Minh họa cho bài viết: ${item.title}`}
              />
              <div className="article-card-body">
                <span className="article-category">{item.category}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <div className="article-card-footer">
                  <span>{formatDate(item.publishedAt)}</span>
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
