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
  ShieldAlert,
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
  Modal,
  Skeleton,
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

async function fetchDashboard(accessToken: string, params: URLSearchParams) {
  const response = await fetch(`${API_URL}/api/analytics/dashboard?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "Không thể tải dữ liệu tổng quan",
    );
  }
  return body as DashboardData;
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
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [guestData, setGuestData] = useState<PublicReadOnlyData | null>(null);
  const [guestError, setGuestError] = useState("");

  const handleMobileClose = useCallback(() => setMobileMenuOpen(false), []);

  const loadDashboard = useCallback(() => {
    if (guestMode || role !== "teacher" || !accessToken) return;
    setLoadingDashboard(true);
    setDashboardError("");
    fetchDashboard(accessToken, new URLSearchParams())
      .then((data) => {
        setDashboard(data);
        setSelectedCycleDetail((current) =>
          current
            ? (data.cycles.find((cycle) => cycle.id === current.id) ?? null)
            : null,
        );
      })
      .catch((error: unknown) =>
        setDashboardError(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu tổng quan",
        ),
      )
      .finally(() => setLoadingDashboard(false));
  }, [accessToken, guestMode, role]);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!guestMode) return;
    let active = true;
    fetch(`${API_URL}/api/guest/showcase`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Chưa thể tải nội dung giới thiệu.");
        return response.json() as Promise<PublicReadOnlyData>;
      })
      .then((result) => { if (active) setGuestData(result); })
      .catch((reason: unknown) => { if (active) setGuestError(reason instanceof Error ? reason.message : "Đã xảy ra lỗi."); });
    return () => { active = false; };
  }, [guestMode]);

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
      loadDashboard();
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
      loadDashboard();
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
    <div className={`app${guestMode ? " guest-app" : ""}`}>
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
        {guestMode ? (
          <GuestReadOnlyContent
            key={`${role}-${currentPage}`}
            view={role}
            screen={currentPage}
            data={guestData}
            error={guestError}
            onNavigate={handleNavigation}
          />
        ) : (
        <>
        {currentPage === "Tổng quan" && role === "teacher" && (
          <header className="student-page-hero" style={{ marginBottom: "28px" }}>
            <div className="student-hero-copy">
              <p className="platform-introduction">
                ONE SCHOOL là nền tảng hỗ trợ tổ chức hoạt động giáo dục và kết nối học sinh giữa điểm trường chính và phân hiệu, thông qua khảo sát nhu cầu, không gian giao lưu số và phân tích AI, nhằm tăng mức độ tham gia, tương tác và cảm giác thuộc về cùng một mái trường – trường THCS Đông Ngạc – phường Đông Ngạc – thành phố Hà Nội.
              </p>
              <div className="teacher-hero-actions">
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
              </div>
              <div className="student-hero-proof">
                <span>
                  <FileText size={16} />{" "}
                  {dashboard?.kpiStats.openSurveysCount ?? 0} Khảo sát đang mở
                </span>
                <span>
                  <Check size={16} />{" "}
                  {dashboard?.kpiStats.responseRate ?? 0}% Tỷ lệ phản hồi
                </span>
                <span>
                  <CalendarDays size={16} />{" "}
                  {dashboard?.cycles.length ?? 0} Chu kỳ hoạt động
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

        {currentPage === "Chu kỳ hoạt động" &&
          role === "teacher" &&
          (selectedCycleDetail ? (
            <CycleDetailView
              cycle={selectedCycleDetail}
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
          ) : (
            <CyclesHubPage
              cycles={dashboard?.cycles ?? []}
              onSelectCycle={(cycle) => setSelectedCycleDetail(cycle)}
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
          <StudentHome onNavigate={setActivePage} />
        )}
        {currentPage === "Hoạt động của tôi" && role === "student" && (
          <StudentActivities key={navigationResetKey} onNavigate={setActivePage} />
        )}
        {currentPage === "CONNECT" && <ConnectPage key={navigationResetKey} />}
        {currentPage === "Bài viết" && (
          <ArticlesPage
            key={`published-articles-${navigationResetKey}`}
            onOpenManagement={() => setActivePage("Quản lý bài viết")}
          />
        )}
        {currentPage === "Quản lý bài viết" && role === "teacher" && (
          <ArticlesPage
            key={`manage-articles-${navigationResetKey}`}
            management
            onBack={() => setActivePage("Bài viết")}
          />
        )}

        {currentPage === "Tổng quan" &&
          role === "teacher" &&
          dashboardError && (
            <ErrorState title={dashboardError} onRetry={loadDashboard} />
          )}

        {currentPage === "Tổng quan" &&
          role === "teacher" &&
          loadingDashboard && (
            <div className="card" style={{ marginBottom: 20 }}>
              <Skeleton />
              <Skeleton width="82%" />
              <Skeleton width="65%" />
            </div>
          )}

        {/* Khu vực 2: Trạng thái khảo sát và hoạt động */}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="kpi-grid" aria-label="Trạng thái khảo sát và hoạt động">
            <KpiCard
              label="Khảo sát đang mở"
              value={String(dashboard?.kpiStats.openSurveysCount ?? 0).padStart(
                2,
                "0",
              )}
              suffix=""
              trend={`${dashboard?.kpiStats.totalPublishedSurveysCount ?? 0} khảo sát đã công bố`}
              tone="indigo"
              onClick={() => setActivePage("Khảo sát")}
            />
            <KpiCard
              label="Hoạt động đã tổ chức"
              value={String(
                dashboard?.kpiStats.completedEventsCount ?? 0,
              ).padStart(2, "0")}
              suffix=""
              trend="Đã kết thúc"
              tone="teal"
              onClick={() => setActivePage("Sự kiện")}
            />
            <KpiCard
              label="Hoạt động đang diễn ra"
              value={String(dashboard?.kpiStats.liveEventsCount ?? 0).padStart(2, "0")}
              suffix=""
              trend="Đang diễn ra"
              tone="violet"
              onClick={() => setActivePage("Sự kiện")}
            />
            <KpiCard
              label="Hoạt động sắp diễn ra"
              value={String(
                dashboard?.kpiStats.upcomingEventsCount ?? 0,
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
              {dashboard?.cycles && dashboard.cycles.length > 0 && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setSelectedCycleDetail(null);
                    setActivePage("Chu kỳ hoạt động");
                  }}
                >
                  Xem tất cả chu kỳ ({dashboard.cycles.length})
                </Button>
              )}
            </div>

            <div className="cycle-display-row">
              {dashboard?.cycles && dashboard.cycles.length > 0 ? (
                <>
                  {/* Ô vuông thứ 1: Chu kỳ mới nhất */}
                  <CycleSquareCard
                    cycle={dashboard.cycles[0]}
                    onClick={() => {
                      setSelectedCycleDetail(dashboard.cycles[0]);
                      setActivePage("Chu kỳ hoạt động");
                    }}
                  />

                  {/* Ô vuông thứ 2: Chu kỳ tiếp theo hoặc nút + Thêm hoạt động cải thiện */}
                  {dashboard.cycles.length > 1 ? (
                    <CycleSquareCard
                      cycle={dashboard.cycles[1]}
                      onClick={() => {
                        setSelectedCycleDetail(dashboard.cycles[1]);
                        setActivePage("Chu kỳ hoạt động");
                      }}
                    />
                  ) : (
                    <NewCycleSquareCard
                      onClick={() => {
                        setEventPreset(null);
                        setActivePage("Chu kỳ hoạt động");
                      }}
                    />
                  )}
                </>
              ) : (
                <>
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

              {dashboard?.allSurveysCriterionComparison &&
              dashboard.allSurveysCriterionComparison.length > 0 ? (
                <CriterionBarChart
                  data={dashboard.allSurveysCriterionComparison}
                />
              ) : dashboard?.criterionComparison &&
                dashboard.criterionComparison.length > 0 ? (
                <CriterionBarChart data={dashboard.criterionComparison} />
              ) : (
                !loadingDashboard && (
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
                    {dashboard?.aiInsight.kind &&
                    dashboard.aiInsight.kind in aiStageLabels
                      ? `${aiStageLabels[dashboard.aiInsight.kind as DashboardAiKind]} · `
                      : ""}
                    {formatUpdatedAt(dashboard?.aiInsight.updatedAt)}
                  </p>
                </div>
                <Badge variant={aiBadgeVariant(dashboard?.aiInsight.status)}>
                  {formatAiStatus(dashboard?.aiInsight.status)}
                </Badge>
              </div>

              <div className="insight-body">
                <h3>
                  {dashboard?.aiInsight.title ?? "Chưa có bản phân tích AI"}
                </h3>
                <p>
                  {dashboard?.aiInsight.summary ??
                    "AI sẽ phân tích dữ liệu từ các khảo sát đã công bố, tập trung vào chênh lệch theo từng tiêu chí giữa Điểm chính và Phân hiệu để đề xuất ưu tiên cải thiện cấp trường."}
                </p>
                {dashboard?.aiInsight.recommendations.map((recommendation) => (
                  <p className="insight-recommendation" key={recommendation}>
                    • {recommendation}
                  </p>
                ))}
              </div>

              {dashboard?.aiInsight.canRetry && (
                <p className="insight-warning">
                  <RefreshCw size={14} aria-hidden="true" /> Lần gọi AI trước bị
                  gián đoạn; bạn có thể chạy lại.
                </p>
              )}

              <div className="insight-actions">
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
              </div>
            </Card>
          </section>
        )}
        </>
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
  articles: Array<{ id: string; title: string; category: string; description: string; publishedAt: string | null }>;
  cycles: Array<{ id: string; title: string; createdAt: string; hasEvent: boolean }>;
  criterionComparison: Array<{ criterionName: string; mainScore: number | null; branchScore: number | null; gap: number | null; responseCount: { MAIN: number; BRANCH: number } }>;
};
type GuestDetail =
  | { kind: "cycle"; data: { id: string; title: string; createdAt: string; stages: Array<{ label: string; responseCount?: number; available?: boolean; analysis?: { kind: string; status: string; title: string | null; summary: string | null; recommendations: string[]; createdAt: string } | null }> } }
  | { kind: "event"; data: { title: string; description: string; objective: string | null; coverImageUrl: string | null; startAt: string; endAt: string; location: string; deliveryMode: string | null } }
  | { kind: "survey"; data: { title: string; description: string | null; type: string; questions: Array<{ id: string; prompt: string; type: string; options: unknown }> } }
  | { kind: "article"; data: { title: string; category: string; description: string; content: string; coverImageUrl: string | null; imageUrls?: string[]; publishedAt: string | null } };
type GuestGroupContent = { id: string; name: string; description: string | null; posts: Array<{ body: string; hasImage: boolean; createdAt: string; reactionCount: number; authorLabel: string; comments: Array<{ body: string; createdAt: string; authorLabel: string }> }> };

/** Public content for the shared dashboard is restricted to anonymized, read-only data. */
function GuestReadOnlyContent({
  view,
  screen,
  data,
  error,
  onNavigate,
}: {
  view: Role;
  screen: string;
  data: PublicReadOnlyData | null;
  error: string;
  onNavigate: (page: string) => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [groupContent, setGroupContent] = useState<GuestGroupContent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const a = data?.aggregates;
  const chosenGroup = data?.groups.find((group) => group.id === selectedGroupId);
  const openDetail = async (kind: GuestDetail["kind"], id: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const path = kind === "cycle" ? `/guest/teacher/cycles/${id}` : kind === "event" ? `/guest/student/events/${id}` : kind === "survey" ? `/guest/student/surveys/${id}` : `/guest/articles/${id}`;
      const response = await fetch(`${API_URL}/api${path}`);
      if (!response.ok) throw new Error("Không thể tải nội dung này.");
      const body = await response.json();
      setDetail({ kind, data: body } as GuestDetail);
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Không thể tải nội dung này.");
    } finally { setDetailLoading(false); }
  };
  const openGroup = async (id: string) => {
    setSelectedGroupId(id);
    setGroupContent(null);
    setDetailError("");
    try {
      const response = await fetch(`${API_URL}/api/guest/groups/${id}`);
      if (!response.ok) throw new Error("Không thể tải nội dung nhóm.");
      setGroupContent(await response.json() as GuestGroupContent);
    } catch (reason) { setDetailError(reason instanceof Error ? reason.message : "Không thể tải nội dung nhóm."); }
  };

  const sectionTitle = chosenGroup?.name ?? screen;
  const showHero = !chosenGroup && !detail && (screen === "Trang chủ" || screen === "Tổng quan");
  return (
    <>
      {showHero && <section className="student-page-hero" style={{ marginBottom: "28px" }}>
        <div className="student-hero-copy">
          <span className="student-hero-kicker"><Sparkles size={15} /> {view === "student" ? "Cộng đồng ONE SCHOOL · THCS Đông Ngạc" : "TỔNG QUAN · ONE SCHOOL"}</span>
          <h1>{view === "student" ? <>Cùng kết nối và<br /><span>sẻ chia.</span></> : <>Một mái trường,<br /><span>hai điểm kết nối.</span></>}</h1>
          <p>ONE SCHOOL hỗ trợ tổ chức hoạt động giáo dục và kết nối học sinh giữa điểm trường chính và phân hiệu thông qua khảo sát nhu cầu, không gian giao lưu số và phân tích AI.</p>
          <div className="student-hero-proof"><span><Eye size={16} /> Chế độ chỉ xem</span><span><Users size={16} /> {a?.communities ?? 0} cộng đồng CONNECT</span><span><CalendarDays size={16} /> {a?.publishedEvents ?? 0} sự kiện đã công bố</span></div>
        </div>
        <div className="student-hero-art" aria-hidden="true"><div className="student-hero-orbit student-hero-orbit-one" /><div className="student-hero-orbit student-hero-orbit-two" /><div className="student-hero-core"><BarChart3 size={36} /></div><div className="student-hero-float float-top"><Sparkles size={18} /><span>Giáo dục kết nối</span></div><div className="student-hero-float float-bottom"><Users size={18} /><span>Điểm chính × Phân hiệu</span></div><span className="student-hero-dot dot-one" /><span className="student-hero-dot dot-two" /><span className="student-hero-dot dot-three" /></div>
      </section>}
      <section className="guest-content">
        <div className="guest-section-heading"><div><span>{view === "student" ? "KHÁM PHÁ ONE SCHOOL" : "KHÔNG GIAN GIÁO VIÊN"}</span><h2>{sectionTitle}</h2></div><span className="guest-privacy-note"><ShieldAlert size={15} /> Dữ liệu học sinh được ẩn danh</span></div>
        {error ? <div className="guest-state" role="status">{error}</div> : !data ? <div className="guest-state" role="status">Đang tải phần giới thiệu…</div> : <>
          {detailError && <div className="guest-state" role="alert">{detailError}</div>}
          {detailLoading ? <div className="guest-state" role="status">Đang tải nội dung…</div> : detail ? <>
            <button type="button" className="guest-back" onClick={() => setDetail(null)}>← Quay lại danh sách</button>
            {detail.kind === "cycle" && <Card className="guest-detail-card guest-cycle-detail"><span className="guest-detail-kicker">CHU KỲ HOẠT ĐỘNG · GÓC NHÌN GIÁO VIÊN</span><h2>{detail.data.title}</h2><p className="guest-boundary">Thông tin chi tiết sự kiện, câu hỏi khảo sát và dữ liệu học sinh được ẩn trong chế độ khách.</p><div className="guest-cycle-stages">{detail.data.stages.map((stage, index) => <article key={`${stage.label}-${index}`}><span className="guest-cycle-number">{index + 1}</span><div><strong>{stage.label}</strong>{stage.responseCount !== undefined && <p>{stage.responseCount.toLocaleString("vi-VN")} phản hồi tổng hợp</p>}{stage.available !== undefined && <p>{stage.available ? "Đã tổ chức hoạt động trong chu kỳ" : "Chưa gắn hoạt động"}</p>}{(index === 1 || index === 4) && !stage.analysis && <p>Chưa có báo cáo AI đã lưu cho bước này.</p>}{stage.analysis && <div className="guest-cycle-ai"><span><Sparkles size={15} /> {stage.analysis.title || (stage.analysis.kind === "EFFECTIVENESS" ? "AI đánh giá hiệu quả" : "AI phân tích thực trạng")}</span><p>{stage.analysis.summary || (stage.analysis.status === "COMPLETED" ? "Báo cáo đã hoàn tất." : "Báo cáo chưa có nội dung hoàn tất.")}</p>{stage.analysis.recommendations.length > 0 && <ul>{stage.analysis.recommendations.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>}</div>}</div></article>)}</div></Card>}
            {detail.kind === "event" && <Card className="guest-detail-card">{detail.data.coverImageUrl && <img className="guest-detail-cover" src={detail.data.coverImageUrl} alt="" />}<span className="guest-detail-kicker">SỰ KIỆN · CHỈ XEM</span><h2>{detail.data.title}</h2><p>{detail.data.description}</p>{detail.data.objective && <p><strong>Mục tiêu:</strong> {detail.data.objective}</p>}<div className="guest-detail-meta">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(new Date(detail.data.startAt))} · {detail.data.location}{detail.data.deliveryMode ? ` · ${detail.data.deliveryMode}` : ""}</div></Card>}
            {detail.kind === "survey" && <Card className="guest-detail-card"><span className="guest-detail-kicker">KHẢO SÁT · CHỈ XEM</span><h2>{detail.data.title}</h2>{detail.data.description && <p>{detail.data.description}</p>}<div className="guest-question-list">{detail.data.questions.map((question,index) => <article key={question.id}><strong>Câu {index+1}. {question.prompt}</strong>{Array.isArray(question.options) && <ul>{question.options.map((option,index) => <li key={index}>{String(option)}</li>)}</ul>}</article>)}</div><p className="guest-boundary">Không thể gửi phản hồi ở chế độ khách. Phản hồi hiện có và danh tính người trả lời không được hiển thị.</p></Card>}
            {detail.kind === "article" && <Card className="guest-detail-card guest-article-detail">{detail.data.coverImageUrl && <img className="guest-detail-cover" src={detail.data.coverImageUrl} alt="" />}<span className="guest-detail-kicker">{detail.data.category}</span><h2>{detail.data.title}</h2><p className="guest-article-description">{detail.data.description}</p>{!!detail.data.imageUrls?.length && <div className="article-image-gallery">{detail.data.imageUrls.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`Ảnh ${index + 1} trong bài viết`} loading="lazy" />)}</div>}<div className="guest-article-content">{detail.data.content}</div></Card>}
          </> : chosenGroup ? <>
            <button type="button" className="guest-back" onClick={() => setSelectedGroupId(null)}>← Tất cả cộng đồng</button>
            <div className="guest-group-detail"><span className="guest-group-icon"><Users size={21} /></span><p>{chosenGroup.description || "Không gian giao lưu và học hỏi cùng bạn bè ở cả hai cơ sở."}</p><div className="guest-stats"><article><span>Thành viên</span><strong>{chosenGroup.memberCount.toLocaleString("vi-VN")}</strong></article><article><span>Bài viết đã duyệt</span><strong>{chosenGroup.approvedPostCount.toLocaleString("vi-VN")}</strong></article></div><div className="guest-boundary">Bài viết và bình luận được ẩn danh; tên, tài khoản và hình ảnh học sinh không hiển thị.</div></div>
            {!groupContent ? <div className="guest-state" role="status">Đang tải bài viết đã ẩn danh…</div> : groupContent.posts.length ? <div className="connect-feed guest-connect-feed">{groupContent.posts.map((post,index) => <Card className="connect-post" key={`${post.createdAt}-${index}`}><header><div className="connect-avatar">H</div><div><strong>{post.authorLabel}</strong><small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.createdAt))}</small></div></header><div className="connect-post-body"><p>{post.body}</p>{post.hasImage && <span className="guest-image-hidden">Ảnh đính kèm đã được ẩn trong chế độ khách</span>}</div><div className="connect-post-actions"><span><Users size={16} /> {post.reactionCount} lượt cảm xúc</span><span>{post.comments.length} bình luận</span></div>{post.comments.length > 0 && <div className="connect-comments">{post.comments.map((comment,commentIndex) => <div className="connect-comment" key={`${comment.createdAt}-${commentIndex}`}><p><strong>{comment.authorLabel}</strong> {comment.body}</p></div>)}</div>}</Card>)}</div> : <EmptyState title="Chưa có bài viết đã duyệt" description="Bài viết phù hợp sẽ xuất hiện tại đây." compact />}
          </> : screen === "Trang chủ" || screen === "Tổng quan" ? <>
            <section className="kpi-grid" aria-label="Tổng quan nền tảng">
              <KpiCard label="Học sinh điểm chính" value={String(a?.mainStudents ?? 0)} suffix="" trend="Tổng số học sinh" tone="indigo" />
              <KpiCard label="Học sinh phân hiệu" value={String(a?.branchStudents ?? 0)} suffix="" trend="Tổng số học sinh" tone="teal" />
              <KpiCard label="Cộng đồng CONNECT" value={String(a?.communities ?? 0)} suffix="" trend="Đang mở" tone="violet" onClick={() => onNavigate("CONNECT")} />
              <KpiCard label="Sự kiện đã công bố" value={String(a?.publishedEvents ?? 0)} suffix="" trend="Có thể xem chi tiết" tone="amber" onClick={() => onNavigate("Sự kiện")} />
              <KpiCard label="Khảo sát đã công bố" value={String(a?.publishedSurveys ?? 0)} suffix="" trend="Chỉ xem nội dung" tone="indigo" onClick={() => onNavigate("Khảo sát")} />
            </section>
            {view === "student" ? <>
              <div className="student-home-grid">
                <Card className="student-home-section">
                  <div className="section-heading"><div><p className="eyebrow">Cùng tham gia</p><h2>Sự kiện đã công bố</h2></div><Button size="small" variant="ghost" onClick={() => onNavigate("Sự kiện")}>Xem tất cả</Button></div>
                  {data.events.length ? <GuestList items={data.events.slice(0, 2).map((event) => ({ id: event.id, title: event.title, detail: `${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(event.startAt))} · ${event.status === "COMPLETED" ? "Đã diễn ra" : event.status === "LIVE" ? "Đang diễn ra" : "Sắp diễn ra"}` }))} onOpen={(id) => void openDetail("event", id)} empty="Chưa có sự kiện được công bố." /> : <EmptyState title="Chưa có sự kiện sắp tới" description="Sự kiện được công bố sẽ xuất hiện tại đây." compact />}
                </Card>
                <Card className="student-home-section">
                  <div className="section-heading"><div><p className="eyebrow">Chia sẻ tiếng nói</p><h2>Khảo sát đã công bố</h2></div><Button size="small" variant="ghost" onClick={() => onNavigate("Khảo sát")}>Xem tất cả</Button></div>
                  {data.surveys.length ? <GuestList items={data.surveys.slice(0, 2).map((survey) => ({ id: survey.id, title: survey.title, detail: survey.type === "BASELINE" ? "Khảo sát trước hoạt động" : "Khảo sát sau hoạt động" }))} onOpen={(id) => void openDetail("survey", id)} empty="Chưa có khảo sát được công bố." /> : <EmptyState title="Chưa có khảo sát" description="Khảo sát được công bố sẽ xuất hiện tại đây." compact />}
                </Card>
              </div>
              <Card className="student-home-section student-featured-articles">
                <div className="section-heading"><div><p className="eyebrow">Góc chia sẻ</p><h2>Câu chuyện học đường</h2></div><Button size="small" variant="ghost" onClick={() => onNavigate("Bài viết")}>Đọc thêm</Button></div>
                <GuestList items={data.articles.slice(0, 3).map((article) => ({ id: article.id, title: article.title, detail: `${article.category} · ${article.description}` }))} onOpen={(id) => void openDetail("article", id)} empty="Chưa có bài viết được công bố." />
              </Card>
              <div className="guest-section-heading guest-groups-heading"><div><span>CONNECT</span><h2>Những cộng đồng đang mở</h2></div><p>Học sinh ở cả hai cơ sở cùng tham gia và chia sẻ.</p></div>
              <GuestGroups groups={data.groups} onOpen={(id) => void openGroup(id)} />
            </> : <>
              <section className="cycle-stepper-section" aria-label="Tiến độ chu kỳ cải thiện">
                <div className="section-header-row"><div><h2>Tiến độ chu kỳ cải thiện</h2></div><Button variant="secondary" size="small" onClick={() => onNavigate("Chu kỳ hoạt động")}>Xem tất cả chu kỳ ({data.cycles.length})</Button></div>
                <GuestList items={data.cycles.slice(0, 2).map((cycle) => ({ id: cycle.id, title: cycle.title, detail: cycle.hasEvent ? "Có hoạt động trong chu kỳ" : "Đang chuẩn bị khảo sát ban đầu" }))} onOpen={(id) => void openDetail("cycle", id)} empty="Chưa có chu kỳ hoạt động." />
              </section>
              <section className="content-grid guest-dashboard-extras">
                <Card className="comparison-card"><div className="section-heading"><div><h2>So sánh theo tiêu chí giữa hai cơ sở</h2><p>Điểm tổng hợp từ các khảo sát sau hoạt động (0–100)</p></div></div>{data.criterionComparison.length ? <CriterionBarChart data={data.criterionComparison} /> : <EmptyState title="Chưa có dữ liệu thang điểm" description="Chưa có khảo sát sau hoạt động với câu trả lời thang điểm." compact />}</Card>
                <Card className="insight-card"><div className="insight-heading"><span className="ai-icon"><Sparkles size={22} /></span><div><h2>Phân tích AI</h2><p>Hỗ trợ giáo viên đọc xu hướng tổng hợp</p></div></div><div className="insight-body"><p>ONE SCHOOL tổng hợp câu trả lời theo bốn tiêu chí và đối chiếu giữa hai cơ sở để hỗ trợ đánh giá hoạt động.</p><p className="insight-recommendation">Chế độ khách chỉ xem kết quả tổng hợp đã có; không thể chạy hoặc thay đổi phân tích.</p></div></Card>
              </section>
            </>}
          </> : screen === "Sự kiện" ? <GuestList items={data.events.map((event) => ({ id: event.id, title: event.title, detail: `${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(event.startAt))} · ${event.status === "COMPLETED" ? "Đã diễn ra" : event.status === "LIVE" ? "Đang diễn ra" : "Sắp diễn ra"}` }))} onOpen={(id) => void openDetail("event",id)} empty="Chưa có sự kiện được công bố." />
          : screen === "Khảo sát" ? <><GuestList items={data.surveys.map((survey) => ({ id: survey.id, title: survey.title, detail: survey.type === "BASELINE" ? "Khảo sát trước hoạt động" : "Khảo sát sau hoạt động" }))} onOpen={(id) => void openDetail("survey",id)} empty="Chưa có khảo sát được công bố." /><p className="guest-boundary">Khách có thể xem nội dung khảo sát nhưng không gửi phản hồi. Câu trả lời và dữ liệu cá nhân không được cung cấp.</p></>
          : screen === "Hoạt động của tôi" ? <div className="guest-stats"><article><span>Lượt tham gia ở điểm chính</span><strong>{a?.mainEventParticipations.toLocaleString("vi-VN")}</strong></article><article><span>Lượt tham gia ở phân hiệu</span><strong>{a?.branchEventParticipations.toLocaleString("vi-VN")}</strong></article><p className="guest-boundary">Đây là số liệu tổng hợp toàn trường; chế độ khách không hiển thị lịch sử của từng học sinh.</p></div>
          : screen === "Chu kỳ hoạt động" ? <GuestList items={data.cycles.map((cycle) => ({ id: cycle.id, title: cycle.title, detail: cycle.hasEvent ? "Có hoạt động trong chu kỳ" : "Đang chuẩn bị khảo sát ban đầu" }))} onOpen={(id) => void openDetail("cycle", id)} empty="Chưa có chu kỳ hoạt động." />
          : screen === "Bài viết" ? <GuestList items={data.articles.map((article) => ({ id: article.id, title: article.title, detail: `${article.category} · ${article.description}` }))} onOpen={(id) => void openDetail("article",id)} empty="Chưa có bài viết được công bố." />
          : <><p className="guest-boundary">Danh sách cộng đồng và thống kê chỉ đọc. Chọn một nhóm để xem các bài viết và thảo luận đã ẩn danh.</p><GuestGroups groups={data.groups} onOpen={(id) => void openGroup(id)} /></>}
          {view === "teacher" && <p className="guest-boundary">Góc nhìn giáo viên của khách không mở chi tiết khảo sát hoặc sự kiện. Không có dữ liệu định danh hay câu trả lời của học sinh.</p>}
        </>}
      </section>
    </>
  );
}

function GuestGroups({ groups, onOpen }: { groups: PublicReadOnlyData["groups"]; onOpen: (id: string) => void }) {
  return <div className="connect-explore-grid">{groups.map((group) => <article className="connect-explore-card guest-connect-card" key={group.id}><button type="button" className="connect-explore-main" onClick={() => onOpen(group.id)}><span className="connect-explore-icon tone-indigo"><Users size={22} /></span><span className="connect-explore-category">CỘNG ĐỒNG HỌC SINH</span><strong>{group.name}</strong><span className="connect-explore-description">{group.description || "Không gian giao lưu và học hỏi cùng bạn bè."}</span><span className="connect-campus-counts"><span><i className="campus-dot main-dot" />Cộng đồng mở</span><span><i className="campus-dot branch-dot" />Hai cơ sở</span></span></button><footer className="connect-explore-footer"><span>{group.memberCount.toLocaleString("vi-VN")} thành viên · {group.approvedPostCount.toLocaleString("vi-VN")} bài viết</span><button type="button" onClick={() => onOpen(group.id)}>Xem nhóm</button></footer></article>)}</div>;
}

function GuestList({ items, empty, onOpen }: { items: Array<{ id: string; title: string; detail: string }>; empty: string; onOpen?: (id: string) => void }) {
  if (!items.length) return <div className="guest-state">{empty}</div>;
  return <div className="guest-list">{items.map((item) => <article key={item.id}><span><FileText size={18} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div>{onOpen && <button type="button" onClick={() => onOpen(item.id)}>Xem nội dung</button>}</article>)}</div>;
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
