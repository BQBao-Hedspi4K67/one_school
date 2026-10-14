import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom";
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
  Menu,
  Plus,
  RefreshCw,
  Sparkles,
  User as UserIcon,
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
import { API_URL } from "./api-url";
import "./App.css";

type Role = "teacher" | "student";
const currentDateLabel = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "full",
}).format(new Date());

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
];

const studentNavigation = [
  { label: "Trang chủ", icon: Home },
  { label: "Sự kiện", icon: CalendarDays },
  { label: "Khảo sát", icon: FileText },
  { label: "Hoạt động của tôi", icon: Check },
  { label: "Bài viết", icon: BookOpen },
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
}: {
  navigation: NavigationItem[];
  activePage: string;
  onPageChange: (page: string) => void;
  onClose: () => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
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
        </div>
      </aside>
    </div>
  );
}

function DashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const role: Role = user?.role === "STUDENT" ? "student" : "teacher";
  const [activePage, setActivePage] = useState(
    role === "teacher" ? "Tổng quan" : "Trang chủ",
  );
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

  const handleMobileClose = useCallback(() => setMobileMenuOpen(false), []);

  const loadDashboard = useCallback(() => {
    if (role !== "teacher" || !accessToken) return;
    setLoadingDashboard(true);
    setDashboardError("");
    fetchDashboard(accessToken, new URLSearchParams())
      .then((data) => {
        setDashboard(data);
        setSelectedCycleDetail((current) =>
          current
            ? (data.cycles.find((cycle) => cycle.id === current.id) ?? current)
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
  }, [accessToken, role]);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAiAnalysis = async () => {
    if (!accessToken || !dashboard) return;
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
  const handleRunCycleAnalysis = async (cycleId: string, stage: AiStage) => {
    if (!accessToken) return;
    setAnalyzingCycleAi(stage);
    try {
      await runAiAnalysis(
        accessToken,
        new URLSearchParams({ eventId: cycleId, kind: stage }),
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

  const handleCreateEventFromAi = () => {
    if (!dashboard?.aiInsight) return;
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
        onPageChange={(page) => {
          if (page !== "Sự kiện") setViewEventId(null);
          if (page !== "Khảo sát") setViewSurveyId(null);
          setActivePage(page);
        }}
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
        onLogout={() => void logout()}
      />

      {mobileMenuOpen && (
        <MobileMenu
          navigation={navigation}
          activePage={navActivePage}
          onPageChange={(page) => {
            if (page !== "Sự kiện") setViewEventId(null);
            if (page !== "Khảo sát") setViewSurveyId(null);
            setActivePage(page);
          }}
          onClose={handleMobileClose}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          onLogout={() => void logout()}
        />
      )}

      <main className="page-container" id="main-content" tabIndex={-1}>
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="page-header">
            <div>
              <p className="eyebrow">{currentDateLabel}</p>
              <h1>Tổng quan</h1>
            </div>
            <Button
              icon={<Plus size={18} aria-hidden="true" />}
              onClick={() => {
                setEventPreset(null);
                setActivePage("Chu kỳ hoạt động");
              }}
            >
              Khởi tạo chu kỳ mới
            </Button>
          </section>
        )}

        {currentPage === "Chu kỳ hoạt động" &&
          role === "teacher" &&
          (selectedCycleDetail ? (
            <CycleDetailView
              cycle={selectedCycleDetail}
              onBack={() => setSelectedCycleDetail(null)}
              analyzing={analyzingCycleAi}
              onRunAnalysis={(stage) =>
                void handleRunCycleAnalysis(selectedCycleDetail.id, stage)
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
                setEventPreset({
                  title,
                  objective: `Mục tiêu cải thiện chu kỳ mới: ${summary}`,
                });
                setActivePage("Sự kiện");
              }}
            />
          ) : (
            <CyclesHubPage
              cycles={dashboard?.cycles ?? []}
              onSelectCycle={(cycle) => setSelectedCycleDetail(cycle)}
              onCreateCycle={() => {
                setEventPreset(null);
                setActivePage("Sự kiện");
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
          <StudentActivities onNavigate={setActivePage} />
        )}
        {currentPage === "Bài viết" && (
          <ArticlesPage
            key="published-articles"
            onOpenManagement={() => setActivePage("Quản lý bài viết")}
          />
        )}
        {currentPage === "Quản lý bài viết" && role === "teacher" && (
          <ArticlesPage
            key="manage-articles"
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
            <span>Email đăng nhập:</span>
            <strong>{user?.email ?? "—"}</strong>
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
        <AuthRoutes dashboard={<DashboardPage />} />
      </AuthProvider>
    </BrowserRouter>
  );
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
