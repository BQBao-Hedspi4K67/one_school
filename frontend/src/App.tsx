import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { AuthProvider, AuthRoutes, useAuth, type Campus } from "./auth";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  Home,
  Eye,
  Menu,
  Plus,
  RefreshCw,
  Sparkles,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import logo from "./assets/logo.png";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Toast,
} from "./components/ui";
import { CriterionBarChart } from "./components/charts";
import {
  CycleSquareCard,
  NewCycleSquareCard,
  type ImprovementCycleData,
} from "./components/cycle-cards";
import { CycleDetailView, CyclesHubPage } from "./components/cycle-page";
import { EventManagement } from "./events";
import { SurveyManagement } from "./surveys";
import { ArticlesPage } from "./articles";
import { StudentActivities, StudentHome } from "./student";
import { ConnectPage } from "./connect";
import { API_URL } from "./api-url";
import "./App.css";

type Role = "teacher" | "student";

type DashboardData = {
  kpiStats: {
    openSurveysCount: number;
    totalPublishedSurveysCount: number;
    totalStudentsCount: number;
    respondedStudentsCount: number;
    responseRate: number;
    pendingAiCount: number;
    completedEventsCount: number;
    liveEventsCount: number;
    upcomingEventsCount: number;
  };
  allSurveysCriterionComparison: Array<{
    criterionName: string;
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    responseCount: { MAIN: number; BRANCH: number };
  }>;
  cycles: ImprovementCycleData[];
  filters: {
    surveys: Array<{
      id: string;
      title: string;
      type: "BASELINE" | "POST_EVENT";
      eventId: string | null;
      eventTitle: string | null;
    }>;
    events: Array<{ id: string; title: string }>;
    selected: {
      surveyId?: string;
      eventId?: string;
      surveyType?: "BASELINE" | "POST_EVENT";
    };
  };
  summary: {
    mainScore: number | null;
    branchScore: number | null;
    completionRate: number | null;
    eventCount: number;
    mainParticipants: number;
    branchParticipants: number;
  };
  criterionComparison: Array<{
    criterionId: string;
    criterionName: string;
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    responseCount: { MAIN: number; BRANCH: number };
  }>;
  questionBreakdown: Array<{
    questionId: string;
    questionText: string;
    criterionName: string;
    mainDistribution: Array<{ label: string; count: number }>;
    branchDistribution: Array<{ label: string; count: number }>;
  }>;
  participation: {
    main: number;
    branch: number;
    completion: { main: number | null; branch: number | null };
  };
  aiInsight: {
    analysisId: string | null;
    status: string | null;
    /** OVERVIEW: tổng quan dashboard; BASELINE/EFFECTIVENESS: phân tích theo chu trình */
    kind: string | null;
    title: string | null;
    summary: string | null;
    recommendations: string[];
    updatedAt: string | null;
    canRetry: boolean;
  };
  effectiveness: {
    available: boolean;
    before: { main: number | null; branch: number | null; gap: number | null };
    after: { main: number | null; branch: number | null; gap: number | null };
    changeByCampus: {
      main: number | null;
      branch: number | null;
      gap: number | null;
    };
    byCriterion: Array<{
      criterionName: string;
      before: {
        main: number | null;
        branch: number | null;
        gap: number | null;
      };
      after: { main: number | null; branch: number | null; gap: number | null };
      changeByCampus: {
        main: number | null;
        branch: number | null;
        gap: number | null;
      };
    }>;
  };
};

class DashboardRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchDashboard(accessToken: string, params: URLSearchParams, endpoint = "dashboard", timeoutMs = 60000) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}/api/analytics/${endpoint}?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.ok) {
        const data = body as unknown as Partial<DashboardData>;
        if (data.kpiStats && data.summary && Array.isArray(data.cycles) && data.filters && Array.isArray(data.criterionComparison)) return data as DashboardData;
        throw new DashboardRequestError("Máy chủ trả về dữ liệu tổng quan chưa đầy đủ. Đang thử tải lại.", 502);
      }
      const message = typeof body.message === "string" ? body.message : `Máy chủ trả về lỗi ${response.status}`;
      throw new DashboardRequestError(message, response.status);
    } catch (error) {
      if (error instanceof DashboardRequestError && (error.status < 500 || error.status === 429)) throw error;
      lastError = error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) break;
      if (error instanceof Error && !['TimeoutError', 'AbortError', 'TypeError'].includes(error.name) && !(error instanceof DashboardRequestError)) {
        throw error;
      }
    }
    if (attempt < 1) await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  if (lastError instanceof Error && (lastError.name === "TimeoutError" || lastError.name === "AbortError")) {
    throw new Error(`Máy chủ đang phản hồi chậm, yêu cầu đã chờ tối đa ${Math.round(timeoutMs / 1000)} giây.`);
  }
  throw new Error(lastError instanceof Error ? lastError.message : "Kết nối máy chủ không ổn định. Vui lòng thử lại.");
}

type AiStage = "BASELINE" | "EFFECTIVENESS";
type DashboardAiKind = AiStage | "OVERVIEW";

const aiStageLabels: Record<DashboardAiKind, string> = {
  OVERVIEW: "AI tổng quan theo tiêu chí",
  BASELINE: "AI sau khảo sát trước",
  EFFECTIVENESS: "AI sau toàn bộ chu trình",
};

async function runAiAnalysis(
  accessToken: string,
  params: URLSearchParams,
  analysisId?: string | null,
) {
  const path = analysisId
    ? `/analytics/analysis/${analysisId}/retry`
    : `/analytics/analysis?${params.toString()}`;
  const response = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.message;
    throw new Error(
      typeof message === "string"
        ? message
        : Array.isArray(message) &&
            message.every((item) => typeof item === "string")
          ? message.join("; ")
          : `Không thể chạy phân tích AI (HTTP ${response.status})`,
    );
  }
  return body;
}

const teacherNavigation = [
  { label: "Tổng quan", icon: BarChart3 },
  { label: "Chu kỳ hoạt động", icon: CalendarDays },
  { label: "Bài viết", icon: BookOpen },
  { label: "CONNECT", icon: Users },
];

const studentNavigation = [
  { label: "Trang chủ", icon: Home },
  { label: "Sự kiện", icon: CalendarDays },
  { label: "Khảo sát", icon: FileText },
  { label: "Hoạt động của tôi", icon: Check },
  { label: "Bài viết", icon: BookOpen },
  { label: "CONNECT", icon: Users },
];

type NavigationItem = (typeof teacherNavigation)[number];

function TopNavigation({
  role,
  navigation,
  activePage,
  profileOpen,
  mobileMenuOpen,
  notificationsOpen,
  onPageChange,
  onProfileToggle,
  onMobileMenuOpen,
  onNotificationsToggle,
  onOpenAccountModal,
  onLogout,
  userName,
  campus,
  guest = false,
}: {
  role: Role;
  navigation: NavigationItem[];
  activePage: string;
  profileOpen: boolean;
  mobileMenuOpen: boolean;
  notificationsOpen: boolean;
  onPageChange: (page: string) => void;
  onProfileToggle: () => void;
  onMobileMenuOpen: () => void;
  onNotificationsToggle: () => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
  userName: string;
  campus: Campus | null;
  guest?: boolean;
}) {
  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi-VN");

  return (
    <header className="top-nav">
      <div className="nav-inner">
        <a className="brand" href="#" aria-label="ONE SCHOOL - Trang chủ">
          <img src={logo} alt="" className="brand-logo" />
          <span className="brand-copy">
            <strong>ONE SCHOOL</strong>
            <small>Đông Ngạc</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-link ${activePage === item.label ? "is-active" : ""}`}
                key={item.label}
                type="button"
                aria-current={activePage === item.label ? "page" : undefined}
                onClick={() => onPageChange(item.label)}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="nav-actions">
          {guest ? <div className="guest-nav-label"><span className="avatar">K</span><span><strong>Khách</strong><small>Chỉ xem</small></span><button type="button" onClick={onLogout}>Thoát</button></div> : <>
          {/* Notifications button with popover */}
          <div className="notification-wrap">
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Thông báo hệ thống"
              aria-expanded={notificationsOpen}
              onClick={onNotificationsToggle}
            >
              <Bell size={20} aria-hidden="true" />
              <span className="notification-badge-dot" aria-hidden="true" />
              <span className="sr-only">3 thông báo mới</span>
            </button>

            {notificationsOpen && (
              <div
                className="notification-popover"
                role="region"
                aria-label="Thông báo"
              >
                <div className="notification-header">
                  <strong>Thông báo</strong>
                  <Badge variant="info">3 mới</Badge>
                </div>
                <div className="notification-item">
                  <strong>Khảo sát thực trạng đang mở</strong>
                  <p>
                    Học sinh cả hai cơ sở đang tham gia khảo sát kết nối học
                    đường.
                  </p>
                </div>
                <div className="notification-item">
                  <strong>Cập nhật phân tích AI</strong>
                  <p>
                    Hệ thống vừa đối chiếu khoảng cách điểm số giữa Điểm chính
                    và Phân hiệu.
                  </p>
                </div>
                <div className="notification-item">
                  <strong>Hoạt động kết nối mới</strong>
                  <p>Đã ghi nhận yêu cầu tham gia mới từ học sinh phân hiệu.</p>
                </div>
              </div>
            )}
          </div>

          {/* Profile trigger */}
          <div className="profile-wrap">
            <button
              className="profile-trigger"
              type="button"
              aria-label={`Tài khoản ${userName}`}
              aria-expanded={profileOpen}
              onClick={onProfileToggle}
            >
              <span className="avatar">{initials || "OS"}</span>
              <span className="profile-text">
                <strong>{userName}</strong>
                <small>
                  {role === "teacher"
                    ? "Giáo viên · Quản trị"
                    : campus === "BRANCH"
                      ? "Học sinh · Phân hiệu"
                      : "Học sinh · Điểm chính"}
                </small>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <button
                  type="button"
                  onClick={() => {
                    onProfileToggle();
                    onOpenAccountModal();
                  }}
                >
                  <UserIcon size={16} aria-hidden="true" /> Tài khoản
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  className="menu-danger"
                  onClick={onLogout}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
          </>}

          <button
            className="mobile-menu-button icon-button"
            type="button"
            aria-label="Mở menu"
            aria-expanded={mobileMenuOpen}
            onClick={onMobileMenuOpen}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({
  navigation,
  activePage,
  onPageChange,
  onClose,
  onOpenAccountModal,
  onLogout,
  guest = false,
}: {
  navigation: NavigationItem[];
  activePage: string;
  onPageChange: (page: string) => void;
  onClose: () => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
  guest?: boolean;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const menu = closeButtonRef.current?.closest(".mobile-menu");
      if (!menu) return;
      const focusable = menu.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="mobile-menu-layer">
      <button
        className="mobile-menu-backdrop"
        type="button"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <aside className="mobile-menu" aria-label="Menu di động">
        <div className="mobile-menu-header">
          <span className="brand-copy">
            <strong>ONE SCHOOL</strong>
            <small>Đông Ngạc</small>
          </span>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            aria-label="Đóng menu"
            onClick={onClose}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        <nav className="mobile-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activePage === item.label ? "is-active" : ""}
                key={item.label}
                type="button"
                aria-current={activePage === item.label ? "page" : undefined}
                onClick={() => {
                  onPageChange(item.label);
                  onClose();
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mobile-menu-footer">
          {guest ? <button type="button" className="menu-danger" onClick={onLogout}>Thoát chế độ khách</button> : <>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAccountModal();
            }}
          >
            <UserIcon size={17} aria-hidden="true" /> Tài khoản
          </button>
          <button type="button" className="menu-danger" onClick={onLogout}>
            Đăng xuất
          </button>
          </>}
        </div>
      </aside>
    </div>
  );
}

function DashboardPage({ guestMode = false }: { guestMode?: boolean }) {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [guestRole, setGuestRole] = useState<Role>("student");
  const role: Role = guestMode ? guestRole : user?.role === "STUDENT" ? "student" : "teacher";
  const [activePage, setActivePage] = useState(
    role === "teacher" ? "Tổng quan" : "Trang chủ",
  );
  const [navigationResetKey, setNavigationResetKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);
  const [analyzingCycleAi, setAnalyzingCycleAi] = useState<AiStage | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [cycleCreateOpen, setCycleCreateOpen] = useState(false);
  const [cycleTitle, setCycleTitle] = useState("");
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [selectedCycleDetail, setSelectedCycleDetail] =
    useState<ImprovementCycleData | null>(null);
  const [viewSurveyId, setViewSurveyId] = useState<string | null>(null);
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [eventPreset, setEventPreset] = useState<{
    title?: string;
    objective?: string;
    baselineSurveyId?: string;
  } | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardDetailsError, setDashboardDetailsError] = useState("");
  const [loadingDashboard, setLoadingDashboard] = useState(!guestMode);
  const [loadingDashboardDetails, setLoadingDashboardDetails] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [guestData, setGuestData] = useState<PublicReadOnlyData | null>(null);
  const [guestError, setGuestError] = useState("");
  const [loadingGuest, setLoadingGuest] = useState(guestMode);
  const [guestAnalyticsLoaded, setGuestAnalyticsLoaded] = useState(false);

  const handleMobileClose = useCallback(() => setMobileMenuOpen(false), []);

  const loadDashboardDetails = useCallback(() => {
    if (guestMode || role !== "teacher" || !accessToken) return;
    setLoadingDashboardDetails(true);
    setDashboardDetailsError("");
    void fetchDashboard(accessToken, new URLSearchParams(), "dashboard/details", 90000)
      .then((data) => {
        setDashboard((current) => current ? {
          ...current,
          allSurveysCriterionComparison: data.allSurveysCriterionComparison,
          cycles: data.cycles,
          summary: data.summary,
          criterionComparison: data.criterionComparison,
          questionBreakdown: data.questionBreakdown,
          participation: data.participation,
          effectiveness: data.effectiveness,
        } : data);
        setSelectedCycleDetail((current) => current
          ? (data.cycles.find((cycle) => cycle.id === current.id) ?? null)
          : null);
      })
      .catch((error: unknown) => setDashboardDetailsError(
        error instanceof Error ? error.message : "Không thể tải phần phân tích chi tiết.",
      ))
      .finally(() => setLoadingDashboardDetails(false));
  }, [accessToken, guestMode, role]);

  const loadDashboard = useCallback(() => {
    if (guestMode || role !== "teacher" || !accessToken) return;
    setLoadingDashboard(true);
    setDashboardError("");
    return fetchDashboard(accessToken, new URLSearchParams())
      .then((data) => {
        setDashboard(data);
        setSelectedCycleDetail(null);
        loadDashboardDetails();
      })
      .catch((error: unknown) =>
        setDashboardError(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu tổng quan",
        ),
      )
      .finally(() => setLoadingDashboard(false));
  }, [accessToken, guestMode, loadDashboardDetails, role]);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!guestMode) return;
    let active = true;
    fetch(`${API_URL}/api/guest/catalog`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Chưa thể tải nội dung giới thiệu.");
        return response.json() as Promise<PublicReadOnlyData>;
      })
      .then((result) => { if (active) setGuestData({ ...result, cycles: [], aiInsight: null, criterionComparison: [] }); })
      .catch((reason: unknown) => { if (active) setGuestError(reason instanceof Error ? reason.message : "Đã xảy ra lỗi."); })
      .finally(() => { if (active) setLoadingGuest(false); });
    return () => { active = false; };
  }, [guestMode]);

  useEffect(() => {
    if (!guestMode || role !== "teacher") return;
    let active = true;
    fetch(`${API_URL}/api/guest/showcase/analytics`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "Không thể tải phân tích công khai.");
        return body as Pick<PublicReadOnlyData, "cycles" | "aiInsight" | "criterionComparison">;
      })
      .then((analytics) => { if (active) setGuestData((current) => current ? { ...current, ...analytics } : current); })
      .catch((reason: unknown) => { if (active) setGuestError(reason instanceof Error ? reason.message : "Không thể tải phân tích công khai."); })
      .finally(() => { if (active) setGuestAnalyticsLoaded(true); });
    return () => { active = false; };
  }, [guestMode, role]);

  const handleAiAnalysis = async () => {
    if (guestMode || !accessToken || !dashboard) return;
    const hasComparableScores = dashboard.allSurveysCriterionComparison.some(
      (criterion) =>
        criterion.mainScore !== null || criterion.branchScore !== null,
    );
    if (!hasComparableScores) {
      setToast({
        variant: "error",
        title: "Chưa đủ dữ liệu để phân tích AI",
        message:
          "Cần có phản hồi với câu hỏi thang điểm trong khảo sát đã công bố để so sánh theo tiêu chí giữa hai cơ sở.",
      });
      return;
    }
    setLoadingAi(true);
    try {
      await runAiAnalysis(
        accessToken,
        new URLSearchParams({ kind: "OVERVIEW" }),
        dashboard.aiInsight.canRetry ? dashboard.aiInsight.analysisId : null,
      );
      setToast({
        variant: "success",
        title: "Đã chạy phân tích AI tổng quan",
        message:
          "Phân tích so sánh các tiêu chí giữa Điểm chính và Phân hiệu đã được cập nhật.",
      });
      await loadDashboard();
    } catch (error) {
      setToast({
        variant: "error",
        title: "Không thể chạy phân tích AI",
        message: error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setLoadingAi(false);
    }
  };

  // Chạy AI trực tiếp từ màn hình chi tiết chu kỳ:
  // BASELINE = sau khảo sát trước (bước 02) · EFFECTIVENESS = sau toàn bộ chu trình (bước 05)
  const handleRunCycleAnalysis = async (cycle: ImprovementCycleData, stage: AiStage) => {
    if (guestMode || !accessToken) return;
    if (stage === "EFFECTIVENESS" && !cycle.eventId) return;
    setAnalyzingCycleAi(stage);
    try {
      const params = stage === "BASELINE" && !cycle.eventId
        ? new URLSearchParams({ surveyId: cycle.steps.step1.surveyId ?? "", kind: stage })
        : new URLSearchParams({ eventId: cycle.eventId ?? cycle.id, kind: stage });
      await runAiAnalysis(
        accessToken,
        params,
      );
      setToast({
        variant: "success",
        title: "Đã chạy phân tích AI",
        message:
          stage === "BASELINE"
            ? "Đã cập nhật phân tích thực trạng (AI lần 1) của chu trình."
            : "Đã cập nhật đánh giá hiệu quả và đề xuất chu kỳ tiếp theo (AI lần 2).",
      });
      await loadDashboard();
    } catch (error) {
      setToast({
        variant: "error",
        title: "Không thể chạy phân tích AI",
        message: error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setAnalyzingCycleAi(null);
    }
  };

  const handleCreateCycle = async () => {
    if (guestMode || !accessToken || cycleTitle.trim().length < 3) return;
    setCreatingCycle(true);
    try {
      const response = await fetch(`${API_URL}/api/cycles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: cycleTitle.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "Không thể tạo chu kỳ");
      setSelectedCycleDetail(null);
      setCycleCreateOpen(false);
      setCycleTitle("");
      setViewSurveyId(body.baselineSurvey?.id ?? null);
      setActivePage("Khảo sát");
      setToast({ variant: "success", title: "Đã tạo chu kỳ", message: "Khảo sát đầu vào đã được công bố cho học sinh." });
      loadDashboard();
    } catch (error) {
      setToast({ variant: "error", title: "Không thể tạo chu kỳ", message: error instanceof Error ? error.message : "Vui lòng thử lại" });
    } finally {
      setCreatingCycle(false);
    }
  };

  const handleCreateEventFromAi = () => {
    if (guestMode || !dashboard?.aiInsight) return;
    const title = dashboard.aiInsight.title
      ? `Hoạt động: ${dashboard.aiInsight.title}`
      : "Hoạt động kết nối theo đề xuất AI";
    const objective = dashboard.aiInsight.summary
      ? `Mục tiêu giải pháp: ${dashboard.aiInsight.summary}`
      : "Cải thiện tiêu chí và thu hẹp khoảng cách giữa hai cơ sở theo khuyến nghị AI";
    setEventPreset({ title, objective });
    setModalOpen(false);
    setActivePage("Sự kiện");
  };

  const navigation = role === "teacher" ? teacherNavigation : studentNavigation;
  const guestDataLoading = guestMode && loadingGuest && !guestData;
  const guestAnalyticsLoading = guestMode && role === "teacher" && !guestAnalyticsLoaded;
  const overviewCycles = guestMode
    ? (guestData?.cycles ?? []).map(createGuestCycleSummary)
    : dashboard?.cycles ?? [];
  const openPublicCycle = async (cycleId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/guest/teacher/cycles/${cycleId}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.message === "string" ? body.message : "Không thể tải chi tiết chu kỳ.");
      }
      setSelectedCycleDetail(createGuestCycleDetail(body as PublicCycleDetail));
      setActivePage("Chu kỳ hoạt động");
    } catch (error) {
      setToast({
        variant: "error",
        title: "Không thể mở chu kỳ",
        message: error instanceof Error ? error.message : "Vui lòng thử lại.",
      });
    }
  };
  const isTeacherInternalPage =
    role === "teacher" &&
    (activePage === "Khảo sát" ||
      activePage === "Sự kiện" ||
      activePage === "Quản lý bài viết");
  const currentPage =
    isTeacherInternalPage ||
    navigation.some((item) => item.label === activePage)
      ? activePage
      : navigation[0].label;
  const navActivePage =
    currentPage === "Quản lý bài viết" ? "Bài viết" : currentPage;
  const handleNavigation = (page: string) => {
    setNavigationResetKey((key) => key + 1);
    setViewEventId(null);
    setViewSurveyId(null);
    if (page === "Sự kiện") setEventPreset(null);
    if (page === "Chu kỳ hoạt động") {
      setSelectedCycleDetail(null);
      setCycleCreateOpen(false);
    }
    setActivePage(page);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Bỏ qua tới nội dung chính
      </a>
      <TopNavigation
        role={role}
        navigation={navigation}
        activePage={navActivePage}
        userName={user?.name ?? (role === "teacher" ? "Giáo viên" : "Học sinh")}
        campus={user?.campus ?? null}
        profileOpen={profileOpen}
        mobileMenuOpen={mobileMenuOpen}
        notificationsOpen={notificationsOpen}
        onPageChange={handleNavigation}
        onProfileToggle={() => {
          setProfileOpen((open) => !open);
          setNotificationsOpen(false);
        }}
        onNotificationsToggle={() => {
          setNotificationsOpen((open) => !open);
          setProfileOpen(false);
        }}
        onOpenAccountModal={() => setAccountModalOpen(true)}
        onMobileMenuOpen={() => setMobileMenuOpen(true)}
        onLogout={() => guestMode ? navigate("/login") : void logout()}
        guest={guestMode}
      />

      {mobileMenuOpen && (
        <MobileMenu
          navigation={navigation}
          activePage={navActivePage}
          onPageChange={handleNavigation}
          onClose={handleMobileClose}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          onLogout={() => guestMode ? navigate("/login") : void logout()}
          guest={guestMode}
        />
      )}

      <main className="page-container" id="main-content" tabIndex={-1}>
        {guestMode && (
          <section className="guest-mode-bar" aria-label="Chế độ xem khách">
            <div className="guest-view-switch" aria-label="Chọn góc nhìn">
              <button type="button" aria-pressed={role === "student"} onClick={() => { setGuestRole("student"); setActivePage("Trang chủ"); }}>Góc nhìn học sinh</button>
              <button type="button" aria-pressed={role === "teacher"} onClick={() => { setGuestRole("teacher"); setActivePage("Tổng quan"); }}>Góc nhìn giáo viên</button>
            </div>
            <span className="guest-privacy-note"><Eye size={16} /> Khách · Chỉ xem</span>
          </section>
        )}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <header className="student-page-hero" style={{ marginBottom: "28px" }}>
            <div className="student-hero-copy">
              <p className="platform-introduction">
                ONE SCHOOL là nền tảng hỗ trợ tổ chức hoạt động giáo dục và kết nối học sinh giữa điểm trường chính và phân hiệu, thông qua khảo sát nhu cầu, không gian giao lưu số và phân tích AI, nhằm tăng mức độ tham gia, tương tác và cảm giác thuộc về cùng một mái trường – trường THCS Đông Ngạc – phường Đông Ngạc – thành phố Hà Nội.
              </p>
              {!guestMode && <div className="teacher-hero-actions">
                <Button
                  icon={<Plus size={18} aria-hidden="true" />}
                  onClick={() => {
                    setEventPreset(null);
                    setActivePage("Chu kỳ hoạt động");
                  }}
                >
                  Khởi tạo chu kỳ mới
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setActivePage("Chu kỳ hoạt động")}
                >
                  Xem danh sách chu kỳ
                </Button>
              </div>}
              <div className="student-hero-proof">
                <span>
                  <FileText size={16} />{" "}
                  {guestDataLoading ? "" : guestMode ? guestData?.aggregates.publishedSurveys ?? 0 : dashboard?.kpiStats.openSurveysCount ?? 0} Khảo sát đã công bố
                </span>
                <span>
                  <Check size={16} />{" "}
                  {guestDataLoading
                    ? ""
                    : guestMode
                    ? `${(guestData?.aggregates.mainStudents ?? 0) + (guestData?.aggregates.branchStudents ?? 0)} Học sinh hai cơ sở`
                    : `${dashboard?.kpiStats.responseRate ?? 0}% Học sinh phản hồi`}
                </span>
                <span>
                  <CalendarDays size={16} />{" "}
                  {guestDataLoading || guestAnalyticsLoading ? "…" : guestMode ? guestData?.cycles.length ?? 0 : dashboard?.cycles.length ?? 0} Chu kỳ hoạt động
                </span>
              </div>
            </div>
            <div className="student-hero-art" aria-hidden="true">
              <div className="student-hero-orbit student-hero-orbit-one" />
              <div className="student-hero-orbit student-hero-orbit-two" />
              <div className="student-hero-core">
                <BarChart3 size={36} />
              </div>
              <div className="student-hero-float float-top">
                <Sparkles size={18} />
                <span>Phân tích AI 2 bước</span>
              </div>
              <div className="student-hero-float float-bottom">
                <Users size={18} />
                <span>Điểm chính × Phân hiệu</span>
              </div>
              <span className="student-hero-dot dot-one" />
              <span className="student-hero-dot dot-two" />
              <span className="student-hero-dot dot-three" />
            </div>
          </header>
        )}

        {guestMode && role === "teacher" && guestError && <ErrorState title={guestError} onRetry={() => window.location.reload()} />}
        {guestDataLoading && (
          <div className="card guest-loading-card" style={{ marginBottom: 20 }}>
            <LoadingState label="Đang tải dữ liệu giới thiệu..." />
          </div>
        )}
        {currentPage === "Chu kỳ hoạt động" &&
          role === "teacher" &&
          (selectedCycleDetail ? (
            <CycleDetailView
              cycle={selectedCycleDetail}
              readOnly={guestMode}
              onBack={() => setSelectedCycleDetail(null)}
              analyzing={analyzingCycleAi}
              onRunAnalysis={(stage) =>
                void handleRunCycleAnalysis(selectedCycleDetail, stage)
              }
              onOpenSurvey={(surveyId) => {
                setViewSurveyId(surveyId ?? null);
                setActivePage("Khảo sát");
              }}
              onOpenEvent={(eventId) => {
                setViewEventId(eventId ?? null);
                setActivePage("Sự kiện");
              }}
              onCreateNextAction={(title, summary) => {
                setSelectedCycleDetail(null);
                setCycleTitle(title);
                setCycleCreateOpen(true);
                setToast({ variant: "info", title: "Đề xuất chu kỳ tiếp theo", message: summary });
              }}
              onCreateEvent={(title, objective, baselineSurveyId) => {
                setEventPreset({ title, objective, baselineSurveyId });
                setActivePage("Sự kiện");
              }}
            />
          ) : guestDataLoading || guestAnalyticsLoading ? <LoadingState label="Đang tải chu kỳ hoạt động..." /> : (
            <CyclesHubPage
              cycles={overviewCycles}
              readOnly={guestMode}
              onSelectCycle={(cycle) => {
                if (guestMode) void openPublicCycle(cycle.id);
                else setSelectedCycleDetail(cycle);
              }}
              onCreateCycle={() => {
                setSelectedCycleDetail(null);
                setCycleTitle("");
                setCycleCreateOpen(true);
              }}
            />
          ))}

        {currentPage === "Sự kiện" && (
          <div>
            {role === "teacher" && (
              <button
                className="back-button"
                type="button"
                style={{ marginBottom: 16 }}
                onClick={() => {
                  setViewEventId(null);
                  setActivePage("Chu kỳ hoạt động");
                }}
              >
                <ArrowLeft size={16} /> Quay lại Chu kỳ hoạt động
              </button>
            )}
            <EventManagement
              key={`events-${navigationResetKey}`}
              role={role}
              guestMode={guestMode}
              initialCreateData={eventPreset}
              onClearInitialCreateData={() => setEventPreset(null)}
              initialEventId={viewEventId}
              hideDetailBackButton={Boolean(viewEventId)}
              onOpenSurvey={(surveyId) => {
                setViewSurveyId(surveyId);
                setActivePage("Khảo sát");
              }}
            />
          </div>
        )}

        {currentPage === "Khảo sát" && (
          <div>
            {role === "teacher" && (
              <button
                className="back-button"
                type="button"
                style={{ marginBottom: 16 }}
                onClick={() => {
                  setViewSurveyId(null);
                  setActivePage("Chu kỳ hoạt động");
                }}
              >
                <ArrowLeft size={16} /> Quay lại Chu kỳ hoạt động
              </button>
            )}
            <SurveyManagement
              key={`surveys-${navigationResetKey}`}
              role={role}
              guestMode={guestMode}
              initialSurveyId={viewSurveyId}
              hideBackButton={Boolean(viewSurveyId)}
              onCreateEvent={(title, objective, baselineSurveyId) => {
                setEventPreset({ title, objective, baselineSurveyId });
                setActivePage("Sự kiện");
              }}
            />
          </div>
        )}

        {currentPage === "Trang chủ" && role === "student" && (
          <StudentHome guestMode={guestMode} onNavigate={setActivePage} />
        )}
        {currentPage === "Hoạt động của tôi" && role === "student" && (
          <StudentActivities key={navigationResetKey} guestMode={guestMode} onNavigate={setActivePage} />
        )}
        {currentPage === "CONNECT" && <ConnectPage key={navigationResetKey} guestMode={guestMode} role={role} />}
        {currentPage === "Bài viết" && (
          <ArticlesPage
            key={`published-articles-${navigationResetKey}`}
            guestMode={guestMode}
            onOpenManagement={() => setActivePage("Quản lý bài viết")}
          />
        )}
        {currentPage === "Quản lý bài viết" && role === "teacher" && !guestMode && (
          <ArticlesPage
            key={`manage-articles-${navigationResetKey}`}
            management
            onBack={() => setActivePage("Bài viết")}
          />
        )}

        {currentPage === "Tổng quan" &&
          role === "teacher" &&
          dashboardError && !dashboard && (
            <ErrorState title={dashboardError} onRetry={loadDashboard} />
          )}
        {currentPage === "Tổng quan" && role === "teacher" && dashboardError && dashboard && (
          <div className="dashboard-refresh-warning" role="status">
            Chưa làm mới được dữ liệu; đang giữ bản tổng quan đã tải trước đó.
            <Button size="small" variant="secondary" onClick={() => void loadDashboard()}>Thử tải lại</Button>
          </div>
        )}
        {currentPage === "Tổng quan" && role === "teacher" && dashboardDetailsError && (
          <div className="dashboard-refresh-warning" role="status">
            Không tải được phần phân tích chi tiết: {dashboardDetailsError}
            <Button size="small" variant="secondary" onClick={loadDashboardDetails}>Thử tải lại phần chi tiết</Button>
          </div>
        )}

        {currentPage === "Tổng quan" &&
          role === "teacher" &&
          loadingDashboard && (
            <div className="card" style={{ marginBottom: 20 }}>
              <LoadingState label="Đang tải dữ liệu tổng quan..." />
            </div>
          )}

        {/* Khu vực 2: Trạng thái khảo sát và hoạt động */}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="kpi-grid" aria-label="Trạng thái khảo sát và hoạt động">
            <KpiCard
              label="Khảo sát đang mở"
              value={guestDataLoading ? "…" : String(guestMode ? guestData?.surveys.length ?? 0 : dashboard?.kpiStats.openSurveysCount ?? 0).padStart(2, "0")}
              suffix=""
              trend={guestDataLoading ? "Đang tải dữ liệu..." : `${guestMode ? guestData?.aggregates.publishedSurveys ?? 0 : dashboard?.kpiStats.totalPublishedSurveysCount ?? 0} khảo sát đã công bố`}
              tone="indigo"
              onClick={() => setActivePage("Khảo sát")}
            />
            <KpiCard
              label="Hoạt động đã tổ chức"
              value={guestDataLoading ? "…" : String(
                guestMode
                  ? guestData?.events.filter((event) => event.status === "COMPLETED").length ?? 0
                  : dashboard?.kpiStats.completedEventsCount ?? 0,
              ).padStart(2, "0")}
              suffix=""
              trend="Đã kết thúc"
              tone="teal"
              onClick={() => setActivePage("Sự kiện")}
            />
            <KpiCard
              label="Hoạt động đang diễn ra"
              value={guestDataLoading ? "…" : String(guestMode ? guestData?.events.filter((event) => event.status === "LIVE").length ?? 0 : dashboard?.kpiStats.liveEventsCount ?? 0).padStart(2, "0")}
              suffix=""
              trend="Đang diễn ra"
              tone="violet"
              onClick={() => setActivePage("Sự kiện")}
            />
            <KpiCard
              label="Hoạt động sắp diễn ra"
              value={guestDataLoading ? "…" : String(
                guestMode
                  ? guestData?.events.filter((event) => event.status === "UPCOMING").length ?? 0
                  : dashboard?.kpiStats.upcomingEventsCount ?? 0,
              ).padStart(2, "0")}
              suffix=""
              trend="Chưa bắt đầu"
              tone="amber"
              onClick={() => setActivePage("Sự kiện")}
            />
          </section>
        )}

        {/* Khu vực 4: Tiến độ chu kỳ cải thiện (CycleProgressStepper - 2 ô vuông |1 2| / |3 4| trên màn hình) */}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section
            className="cycle-stepper-section"
            aria-label="Tiến độ chu kỳ cải thiện"
          >
            <div className="section-header-row">
              <div>
                <h2>Tiến độ chu kỳ cải thiện </h2>
              </div>
              {overviewCycles.length > 0 && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setSelectedCycleDetail(null);
                    setActivePage("Chu kỳ hoạt động");
                  }}
                >
                  Xem tất cả chu kỳ ({overviewCycles.length})
                </Button>
              )}
            </div>

            <div className="cycle-display-row">
              {guestDataLoading ? (
                <LoadingState compact label="Đang tải chu kỳ..." />
              ) : !guestMode && loadingDashboardDetails ? (
                <LoadingState compact label="Đang tải chi tiết chu kỳ và kết quả khảo sát…" />
              ) : overviewCycles.length > 0 ? (
                <>
                  {/* Ô vuông thứ 1: Chu kỳ mới nhất */}
                  <CycleSquareCard
                    cycle={overviewCycles[0]}
                    onClick={() => {
                      if (guestMode) void openPublicCycle(overviewCycles[0].id);
                      else {
                        setSelectedCycleDetail(overviewCycles[0]);
                        setActivePage("Chu kỳ hoạt động");
                      }
                    }}
                  />

                  {/* Ô vuông thứ 2: Chu kỳ tiếp theo hoặc nút + Thêm hoạt động cải thiện */}
                  {overviewCycles.length > 1 ? (
                    <CycleSquareCard
                      cycle={overviewCycles[1]}
                      onClick={() => {
                        if (guestMode) void openPublicCycle(overviewCycles[1].id);
                        else {
                          setSelectedCycleDetail(overviewCycles[1]);
                          setActivePage("Chu kỳ hoạt động");
                        }
                      }}
                    />
                  ) : guestMode ? null : (
                    <NewCycleSquareCard
                      onClick={() => {
                        setEventPreset(null);
                        setActivePage("Chu kỳ hoạt động");
                      }}
                    />
                  )}
                </>
              ) : (
                guestMode ? (
                  <div className="cycle-empty-placeholder">
                    <p>Chưa có chu kỳ cải thiện nào được công bố.</p>
                    <small>Các chu kỳ đã công bố sẽ xuất hiện tại đây.</small>
                  </div>
                ) : <>
                  <NewCycleSquareCard
                    onClick={() => {
                      setEventPreset(null);
                      setActivePage("Chu kỳ hoạt động");
                    }}
                  />
                  <div className="cycle-empty-placeholder">
                    <p>Chưa có chu kỳ cải thiện nào được khởi tạo.</p>
                    <small>
                      Mỗi chu kỳ gắn liền với 1 khảo sát trước, phân tích AI, 1
                      sự kiện và 1 khảo sát đánh giá sau.
                    </small>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Khu vực 3: So sánh theo tiêu chí giữa hai cơ sở (Trung bình cộng toàn bộ khảo sát) & Phân tích AI */}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="content-grid">
            <Card className="comparison-card">
              <div className="section-heading">
                <div>
                  <h2>So sánh theo tiêu chí giữa hai cơ sở</h2>
                  <p>
                    Trung bình cộng toàn bộ khảo sát thực tế (Điểm chuẩn hóa
                    0–100 theo 4 tiêu chí)
                  </p>
                </div>
              </div>

              {!guestMode && loadingDashboardDetails ? (
                <LoadingState compact label="Đang tính kết quả từ phản hồi khảo sát…" />
              ) : guestMode && guestData?.criterionComparison.length ? (
                <CriterionBarChart
                  data={guestData.criterionComparison.map((item, index) => ({
                    criterionId: String(index),
                    criterionName: item.criterionName,
                    mainScore: item.mainScore,
                    branchScore: item.branchScore,
                    gap: item.gap,
                    responseCount: item.responseCount,
                  }))}
                />
              ) : dashboard?.allSurveysCriterionComparison &&
              dashboard.allSurveysCriterionComparison.length > 0 ? (
                <CriterionBarChart
                  data={dashboard.allSurveysCriterionComparison}
                />
              ) : dashboard?.criterionComparison &&
                dashboard.criterionComparison.length > 0 ? (
                <CriterionBarChart data={dashboard.criterionComparison} />
              ) : guestAnalyticsLoading ? <LoadingState compact label="Đang tải phân tích tiêu chí..." /> : (
                !loadingDashboard && !guestDataLoading && (
                  <EmptyState
                    title="Chưa có dữ liệu so sánh tiêu chí"
                    description="Cần có phản hồi khảo sát thực tế từ học sinh hai cơ sở để tính trung bình."
                    compact
                  />
                )
              )}
              <div className="overview-criterion-notes" aria-label="Ý nghĩa các tiêu chí so sánh">
                <div><strong>Mức độ tham gia</strong><span>Học sinh có thực sự được tham gia, đóng góp và thể hiện vai trò trong hoạt động hay không.</span></div>
                <div><strong>Mức độ kết nối</strong><span>Hoạt động có giúp học sinh điểm chính và phân hiệu giao lưu, làm quen và hợp tác với nhau không.</span></div>
                <div><strong>Cảm giác thuộc về</strong><span>Học sinh có cảm nhận mình là thành viên của một trường chung, không phân biệt điểm chính/phân hiệu.</span></div>
                <div><strong>Công bằng và hài lòng</strong><span>Học sinh có cảm thấy cơ hội tham gia giữa hai điểm trường là công bằng và hoạt động đáp ứng mong đợi không.</span></div>
              </div>
            </Card>

            <Card className="insight-card">
              <div className="insight-heading">
                <span className="ai-icon">
                  <Sparkles size={22} aria-hidden="true" />
                </span>
                <div>
                  <h2>Phân tích tổng thể theo tiêu chí</h2>
                  <p>
                    {guestMode
                      ? guestDataLoading || guestAnalyticsLoading
                        ? "Đang tải kết quả công khai..."
                        : guestData?.aiInsight?.updatedAt
                        ? `${formatUpdatedAt(guestData.aiInsight.updatedAt)} · Chỉ xem`
                        : "Kết quả công khai · Chỉ xem"
                      : dashboard?.aiInsight.kind &&
                    dashboard.aiInsight.kind in aiStageLabels
                      ? `${aiStageLabels[dashboard.aiInsight.kind as DashboardAiKind]} · `
                      : formatUpdatedAt(dashboard?.aiInsight.updatedAt)}
                  </p>
                </div>
                <Badge variant={guestMode ? (guestData?.aiInsight?.summary ? "success" : "info") : aiBadgeVariant(dashboard?.aiInsight.status)}>
                  {guestMode
                    ? guestDataLoading || guestAnalyticsLoading ? "Chỉ xem" : guestData?.aiInsight?.summary ? "Đã phân tích" : "Chưa có phân tích"
                    : formatAiStatus(dashboard?.aiInsight.status)}
                </Badge>
              </div>

              <div className="insight-body">
                <h3>
                  {guestMode
                    ? guestDataLoading || guestAnalyticsLoading ? "Phân tích tổng thể" : guestData?.aiInsight?.title ?? "Chưa có bản phân tích AI tổng thể"
                    : dashboard?.aiInsight.title ?? "Chưa có bản phân tích AI"}
                </h3>
                {guestMode && (guestDataLoading || guestAnalyticsLoading) ? <LoadingState compact label="Đang tải phân tích..." /> : <p>
                  {guestMode
                    ? guestData?.aiInsight?.summary ?? "Hệ thống chưa có kết quả phân tích AI tổng thể đã hoàn tất. Khách chỉ xem được kết quả đã công khai."
                    : dashboard?.aiInsight.summary ??
                    "AI sẽ phân tích dữ liệu từ các khảo sát đã công bố, tập trung vào chênh lệch theo từng tiêu chí giữa Điểm chính và Phân hiệu để đề xuất ưu tiên cải thiện cấp trường."}
                </p>}
                {(guestMode
                  ? guestData?.aiInsight?.recommendations ?? []
                  : dashboard?.aiInsight.recommendations ?? []
                ).map((recommendation) => (
                  <p className="insight-recommendation" key={recommendation}>
                    • {recommendation}
                  </p>
                ))}
                {guestMode && (
                  <p className="guest-read-only-note">
                    Khách chỉ xem kết quả đã lưu, không thể chạy hoặc thay đổi phân tích AI.
                  </p>
                )}
              </div>

              {!guestMode && dashboard?.aiInsight.canRetry && (
                <p className="insight-warning">
                  <RefreshCw size={14} aria-hidden="true" /> Lần gọi AI trước bị
                  gián đoạn; bạn có thể chạy lại.
                </p>
              )}

              {!guestMode && <div className="insight-actions">
                <Button
                  variant="primary"
                  fullWidth
                  loading={loadingAi}
                  onClick={() => void handleAiAnalysis()}
                >
                  {dashboard?.aiInsight.canRetry
                    ? "Chạy lại phân tích AI"
                    : "Phân tích tổng thể bằng AI"}
                </Button>
                {dashboard?.aiInsight.summary && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setModalOpen(true)}
                  >
                    Xem chi tiết & Áp dụng đề xuất
                  </Button>
                )}
                {dashboard?.aiInsight.kind === "OVERVIEW" &&
                  dashboard.aiInsight.analysisId &&
                  dashboard.aiInsight.recommendations.length > 0 && (
                    <Button
                      variant="secondary"
                      fullWidth
                      icon={<Plus size={16} />}
                      onClick={handleCreateEventFromAi}
                    >
                      Tạo hoạt động theo đề xuất AI
                    </Button>
                  )}
              </div>}
            </Card>
          </section>
        )}
      </main>

      {/* Toast Alert */}
      {toast && (
        <Toast
          variant={toast.variant}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* AI Recommendation Modal with Direct Event Creation Flow */}
      <Modal
        open={modalOpen}
        title="Đề xuất giải pháp từ AI"
        onClose={() => setModalOpen(false)}
      >
        {dashboard?.aiInsight.title && <h3>{dashboard.aiInsight.title}</h3>}
        {dashboard?.aiInsight.summary && (
          <p className="modal-copy">{dashboard.aiInsight.summary}</p>
        )}
        {dashboard?.aiInsight.recommendations &&
          dashboard.aiInsight.recommendations.length > 0 && (
            <div style={{ margin: "14px 0" }}>
              <strong style={{ fontSize: 14 }}>Các khuyến nghị cụ thể:</strong>
              {dashboard.aiInsight.recommendations.map((recommendation) => (
                <p
                  className="modal-copy"
                  key={recommendation}
                  style={{ margin: "6px 0" }}
                >
                  • {recommendation}
                </p>
              ))}
            </div>
          )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Đóng
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={handleCreateEventFromAi}
          >
            Tạo sự kiện theo đề xuất này
          </Button>
        </div>
      </Modal>

      <Modal open={cycleCreateOpen} title="Đặt tên chương trình" onClose={() => setCycleCreateOpen(false)}>
        <label className="field">
          <span className="field-label">Tên chương trình *</span>
          <input className="input" value={cycleTitle} onChange={(event) => setCycleTitle(event.target.value)} placeholder="Ví dụ: Ngày hội kết nối hai cơ sở" autoFocus />
        </label>
        <p className="modal-copy">Sau khi tạo, khảo sát đầu vào sẽ được gửi tới học sinh. AI phân tích phản hồi để giáo viên tham khảo trước khi tổ chức.</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setCycleCreateOpen(false)}>Hủy</Button>
          <Button loading={creatingCycle} disabled={cycleTitle.trim().length < 3} onClick={() => void handleCreateCycle()}>Tạo khảo sát</Button>
        </div>
      </Modal>

      {/* Chi tiết chu kỳ hiển thị như màn hình riêng (CycleDetailView), không dùng modal */}

      {/* User Account Info Modal */}
      <Modal
        open={accountModalOpen}
        title="Thông tin tài khoản"
        onClose={() => setAccountModalOpen(false)}
      >
        <div className="account-modal-body">
          <div className="account-info-row">
            <span>Họ và tên:</span>
            <strong>{user?.name ?? "—"}</strong>
          </div>
          <div className="account-info-row">
            <span>Username đăng nhập:</span>
            <strong>{user?.username ?? "—"}</strong>
          </div>
          <div className="account-info-row">
            <span>Vai trò:</span>
            <Badge variant="info">
              {user?.role === "TEACHER" ? "Giáo viên quản trị" : "Học sinh"}
            </Badge>
          </div>
          <div className="account-info-row">
            <span>Cơ sở trực thuộc:</span>
            <strong>
              {user?.role === "TEACHER"
                ? "Toàn trường (THCS Đông Ngạc)"
                : user?.campus === "BRANCH"
                  ? "Phân hiệu (BRANCH)"
                  : "Điểm chính (MAIN)"}
            </strong>
          </div>
          <div className="account-info-row">
            <span>Trạng thái bảo mật:</span>
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
              Đã xác thực (JWT Token)
            </span>
          </div>
        </div>
        <div className="modal-actions">
          <Button onClick={() => setAccountModalOpen(false)}>Đóng</Button>
        </div>
      </Modal>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthRoutes dashboard={<DashboardPage />} guest={<DashboardPage guestMode />} />
      </AuthProvider>
    </BrowserRouter>
  );
}

type PublicReadOnlyData = {
  aggregates: { mainStudents: number; branchStudents: number; publishedEvents: number; publishedSurveys: number; communities: number; mainEventParticipations: number; branchEventParticipations: number };
  groups: Array<{ id: string; name: string; description: string | null; memberCount: number; approvedPostCount: number }>;
  events: Array<{ id: string; title: string; status: string; startAt: string; endAt: string }>;
  surveys: Array<{ id: string; title: string; type: string }>;
  articles: Array<{ id: string; title: string; category: string; description: string; coverImageUrl: string | null; publishedAt: string | null }>;
  aiInsight: {
    title: string | null;
    summary: string | null;
    recommendations: string[];
    updatedAt: string;
  } | null;
  cycles: Array<{
    id: string;
    title: string;
    createdAt: string;
    baselineResponseCount: number;
    event: {
      id: string;
      title: string;
      status: "UPCOMING" | "LIVE" | "COMPLETED";
      startAt: string;
      endAt: string;
      coverImageUrl: string | null;
      participantsCount: number;
    } | null;
  }>;
  criterionComparison: Array<{ criterionName: string; mainScore: number | null; branchScore: number | null; gap: number | null; responseCount: { MAIN: number; BRANCH: number } }>;
};

type PublicCycleStage = {
  responseCount?: number;
  available?: boolean;
  surveyId?: string | null;
  surveyTitle?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  participantsCount?: number;
  analysis?: {
    status: string;
    title: string | null;
    summary: string | null;
    recommendations: string[];
    createdAt: string;
  } | null;
};

type PublicCycleDetail = {
  id: string;
  title: string;
  createdAt: string;
  baselineSurvey: { id: string; title: string } | null;
  event: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    coverImageUrl: string | null;
    participantsCount: number;
  } | null;
  afterByCriterion: Array<{
    criterionId: string;
    criterionName: string;
    mainScore: number | null;
    branchScore: number | null;
    gap: number | null;
    responseCount: { MAIN: number; BRANCH: number };
  }>;
  stages: PublicCycleStage[];
};

function createGuestCycleSummary(cycle: PublicReadOnlyData["cycles"][number]): ImprovementCycleData {
  const startAt = cycle.event?.startAt ?? cycle.createdAt;
  const endAt = cycle.event?.endAt ?? cycle.createdAt;
  const waiting = { name: "", status: "WAITING" as const };
  const baselineStatus = cycle.baselineResponseCount > 0 ? "COMPLETED" as const : "IN_PROGRESS" as const;
  const eventStepStatus = cycle.event?.status === "COMPLETED"
    ? "COMPLETED" as const
    : cycle.event ? "IN_PROGRESS" as const : "WAITING" as const;
  return {
    id: cycle.id,
    title: cycle.title,
    eventId: cycle.event?.id ?? null,
    status: cycle.event?.status ?? "DRAFT",
    startAt,
    endAt,
    currentStep: cycle.event ? 3 : cycle.baselineResponseCount > 0 ? 2 : 1,
    steps: {
      step1: {
        name: "Khảo sát đầu vào",
        status: baselineStatus,
        responsesCount: cycle.baselineResponseCount,
      },
      step2: { ...waiting, name: "Phân tích AI" },
      step3: {
        ...waiting,
        name: "Tổ chức hoạt động",
        status: eventStepStatus,
        eventId: cycle.event?.id ?? null,
        eventTitle: cycle.event?.title ?? null,
        coverImageUrl: cycle.event?.coverImageUrl ?? null,
        participantsCount: cycle.event?.participantsCount ?? 0,
      },
      step4: { ...waiting, name: "Đánh giá hài lòng" },
      step5: { ...waiting, name: "AI đánh giá" },
    },
    metrics: {
      beforeScore: { main: null, branch: null, gap: null },
      afterScore: { main: null, branch: null, gap: null },
      afterByCriterion: [],
      gapChange: null,
      aiEvaluation: { summary: null, recommendations: [] },
    },
  };
}

function createGuestCycleDetail(cycle: PublicCycleDetail): ImprovementCycleData {
  const [baseline, baselineAnalysis, event, postSurvey, evaluation] = cycle.stages;
  const baselineAnalysisData = baselineAnalysis?.analysis;
  const evaluationData = evaluation?.analysis;
  const baselineResponses = baseline?.responseCount ?? 0;
  const postResponses = postSurvey?.responseCount ?? 0;
  const analysisStep = (
    name: string,
    analysis: PublicCycleStage["analysis"],
    active: boolean,
  ) => ({
    name,
    status: analysis?.status === "COMPLETED"
      ? "COMPLETED" as const
      : active ? "IN_PROGRESS" as const : "WAITING" as const,
    summary: analysis?.summary ?? null,
    recommendations: analysis?.recommendations ?? [],
    recommendationsCount: analysis?.recommendations.length ?? 0,
    analysisId: null,
    updatedAt: analysis?.createdAt ?? null,
  });
  const createdAt = new Date(cycle.createdAt).toISOString();
  const startAt = cycle.event?.startAt ?? createdAt;
  const endAt = cycle.event?.endAt ?? createdAt;

  return {
    id: cycle.id,
    title: cycle.title,
    eventId: cycle.event?.id ?? null,
    baselineSurveyId: cycle.baselineSurvey?.id,
    status: "UPCOMING",
    startAt,
    endAt,
    currentStep: postResponses > 0 ? 5 : event?.available ? 3 : baselineResponses > 0 ? 2 : 1,
    steps: {
      step1: {
        name: "Khảo sát đầu vào",
        status: baselineResponses > 0 ? "COMPLETED" : "IN_PROGRESS",
        responsesCount: baselineResponses,
        surveyId: baseline?.surveyId ?? cycle.baselineSurvey?.id,
        surveyTitle: baseline?.surveyTitle ?? cycle.baselineSurvey?.title,
      },
      step2: analysisStep("Phân tích AI thực trạng", baselineAnalysisData, baselineResponses > 0),
      step3: {
        name: "Tổ chức hoạt động",
        status: event?.available ? "COMPLETED" : "WAITING",
        eventId: event?.eventId ?? cycle.event?.id,
        eventTitle: event?.eventTitle ?? cycle.event?.title,
        coverImageUrl: cycle.event?.coverImageUrl ?? null,
        participantsCount: event?.participantsCount ?? cycle.event?.participantsCount ?? 0,
      },
      step4: {
        name: "Khảo sát sau hoạt động",
        status: postResponses > 0 ? "COMPLETED" : event?.available ? "IN_PROGRESS" : "WAITING",
        responsesCount: postResponses,
        surveyId: postSurvey?.surveyId,
        surveyTitle: postSurvey?.surveyTitle,
      },
      step5: analysisStep("AI đánh giá hiệu quả", evaluationData, postResponses > 0),
    },
    metrics: {
      beforeScore: { main: null, branch: null, gap: null },
      afterScore: { main: null, branch: null, gap: null },
      afterByCriterion: cycle.afterByCriterion,
      gapChange: null,
      aiEvaluation: {
        analysisId: null,
        status: evaluationData?.status ?? null,
        updatedAt: evaluationData?.createdAt ?? null,
        summary: evaluationData?.summary ?? null,
        recommendations: evaluationData?.recommendations ?? [],
      },
    },
  };
}

function KpiCard({
  label,
  value,
  suffix,
  trend,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  suffix: string;
  trend: string;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`kpi-card ${onClick ? "kpi-card-clickable" : ""}`}
      {...(onClick
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <div className={`kpi-mark mark-${tone}`} />
      <p>{label}</p>
      <div className="kpi-value">
        {value}
        <span>{suffix}</span>
      </div>
      <span className="kpi-trend">
        <ArrowRight size={14} aria-hidden="true" /> {trend}
      </span>
    </Card>
  );
}

function formatUpdatedAt(value: string | null | undefined) {
  return value
    ? `Cập nhật ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))}`
    : "Chưa có bản phân tích";
}

function formatAiStatus(status: string | null | undefined) {
  if (status === "COMPLETED") return "Đã phân tích";
  if (status === "FAILED") return "Phân tích lỗi";
  if (status === "PENDING") return "Đang xử lý";
  return "Chưa có dữ liệu";
}

function aiBadgeVariant(
  status: string | null | undefined,
): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "error";
  if (status === "PENDING") return "warning";
  return "neutral";
}

export default App;
