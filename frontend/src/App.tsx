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
import {
  CriterionBarChart,
} from "./components/charts";
import {
  CycleSquareCard,
  NewCycleSquareCard,
  CycleDetailModal,
  AllCyclesModal,
  type ImprovementCycleData,
} from "./components/cycle-cards";
import {
  CycleDetailView,
  CyclesHubPage,
} from "./components/cycle-page";
import { EventManagement } from "./events";
import { SurveyManagement } from "./surveys";
import { ArticlesPage } from "./articles";
import { StudentActivities, StudentHome } from "./student";
import "./App.css";

type Role = "teacher" | "student";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
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
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : "Không thể chạy phân tích AI",
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
              <span className="notification-badge-dot" />
            </button>

            {notificationsOpen && (
              <div className="notification-popover" role="region" aria-label="Thông báo">
                <div className="notification-header">
                  <strong>Thông báo</strong>
                  <Badge variant="info">3 mới</Badge>
                </div>
                <div className="notification-item">
                  <strong>Khảo sát thực trạng đang mở</strong>
                  <p>Học sinh cả hai cơ sở đang tham gia khảo sát kết nối học đường.</p>
                </div>
                <div className="notification-item">
                  <strong>Cập nhật phân tích AI</strong>
                  <p>Hệ thống vừa đối chiếu khoảng cách điểm số giữa Điểm chính và Phân hiệu.</p>
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
  const [toastVisible, setToastVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCycleDetail, setSelectedCycleDetail] = useState<ImprovementCycleData | null>(null);
  const [viewSurveyId, setViewSurveyId] = useState<string | null>(null);
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [allCyclesOpen, setAllCyclesOpen] = useState(false);
  const [eventPreset, setEventPreset] = useState<{
    title?: string;
    objective?: string;
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
      .then(setDashboard)
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
    setLoadingAi(true);
    try {
      await runAiAnalysis(
        accessToken,
        new URLSearchParams(),
        dashboard.aiInsight.canRetry ? dashboard.aiInsight.analysisId : null,
      );
      setToastVisible(true);
      loadDashboard();
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Không thể chạy phân tích AI",
      );
    } finally {
      setLoadingAi(false);
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
  const currentPage = navigation.some((item) => item.label === activePage)
    ? activePage
    : navigation[0].label;

  return (
    <div className="app">
      <TopNavigation
        role={role}
        navigation={navigation}
        activePage={currentPage}
        userName={user?.name ?? (role === "teacher" ? "Giáo viên" : "Học sinh")}
        campus={user?.campus ?? null}
        profileOpen={profileOpen}
        mobileMenuOpen={mobileMenuOpen}
        notificationsOpen={notificationsOpen}
        onPageChange={setActivePage}
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
          activePage={currentPage}
          onPageChange={setActivePage}
          onClose={handleMobileClose}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          onLogout={() => void logout()}
        />
      )}

      <main className="page-container">
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="page-header">
            <div>
              <p className="eyebrow">{currentDateLabel}</p>
              <h1>Tổng quan hai cơ sở</h1>
              <p className="page-description">
                Theo dõi khoảng cách giữa điểm chính và phân hiệu theo từng tiêu chí, đánh giá hiệu quả hoạt động giáo dục.
              </p>
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

        {currentPage === "Chu kỳ hoạt động" && role === "teacher" && (
          selectedCycleDetail ? (
            <CycleDetailView
              cycle={selectedCycleDetail}
              onBack={() => setSelectedCycleDetail(null)}
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
                setEventPreset({ title, objective: `Mục tiêu cải thiện chu kỳ mới: ${summary}` });
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
          )
        )}

        {currentPage === "Sự kiện" && (
          <div>
            {role === "teacher" && (
              <button
                className="back-button"
                type="button"
                style={{ marginBottom: 16 }}
                onClick={() => setActivePage("Chu kỳ hoạt động")}
              >
                <ArrowLeft size={16} /> Quay lại Chu kỳ hoạt động
              </button>
            )}
            <EventManagement
              role={role}
              initialCreateData={eventPreset}
              onClearInitialCreateData={() => setEventPreset(null)}
              initialEventId={viewEventId}
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
                onClick={() => setActivePage("Chu kỳ hoạt động")}
              >
                <ArrowLeft size={16} /> Quay lại Chu kỳ hoạt động
              </button>
            )}
            <SurveyManagement role={role} initialSurveyId={viewSurveyId} />
          </div>
        )}

        {currentPage === "Trang chủ" && role === "student" && (
          <StudentHome onNavigate={setActivePage} />
        )}
        {currentPage === "Hoạt động của tôi" && role === "student" && (
          <StudentActivities onNavigate={setActivePage} />
        )}
        {currentPage === "Bài viết" && <ArticlesPage />}

        {currentPage === "Tổng quan" && role === "teacher" && dashboardError && (
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

        {/* Khu vực 2: 4 Thẻ KPI hành động (dùng data thực tế từ DB, click để chuyển tab/modal) */}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="kpi-grid" aria-label="Tổng quan chỉ số hành động">
            <KpiCard
              label="Khảo sát đang mở"
              value={String(dashboard?.kpiStats.openSurveysCount ?? 0).padStart(2, "0")}
              suffix=""
              trend={`Tổng ${dashboard?.kpiStats.totalPublishedSurveysCount ?? 0} đợt đang thu thập`}
              tone="indigo"
              onClick={() => setActivePage("Khảo sát")}
            />
            <KpiCard
              label="Tỷ lệ học sinh tham gia"
              value={String(dashboard?.kpiStats.responseRate ?? 0)}
              suffix="%"
              trend={`${dashboard?.kpiStats.respondedStudentsCount ?? 0}/${dashboard?.kpiStats.totalStudentsCount ?? 0} học sinh toàn trường`}
              tone="teal"
              onClick={() => setActivePage("Khảo sát")}
            />
            <KpiCard
              label="Khuyến nghị AI"
              value={String(dashboard?.kpiStats.pendingAiCount ?? 0).padStart(2, "0")}
              suffix=""
              trend="Đề xuất giải pháp thu hẹp khoảng cách"
              tone="violet"
              onClick={() => {
                if (dashboard?.aiInsight.summary) {
                  setModalOpen(true);
                } else {
                  void handleAiAnalysis();
                }
              }}
            />
            <KpiCard
              label="Sự kiện kết nối sắp tới"
              value={String(dashboard?.kpiStats.upcomingEventsCount ?? 0).padStart(2, "0")}
              suffix=""
              trend="Hoạt động chung hai cơ sở"
              tone="amber"
              onClick={() => setActivePage("Sự kiện")}
            />
          </section>
        )}

        {/* Khu vực 4: Tiến độ chu kỳ cải thiện (CycleProgressStepper - 2 ô vuông |1 2| / |3 4| trên màn hình) */}
        {currentPage === "Tổng quan" && role === "teacher" && (
          <section className="cycle-stepper-section" aria-label="Tiến độ chu kỳ cải thiện">
            <div className="section-header-row">
              <div>
                <h2>Tiến độ chu kỳ cải thiện (CycleProgressStepper)</h2>
                <p>
                  Quy trình 4 bước khép kín: <strong>01. Khảo sát ban đầu</strong> → <strong>02. Phân tích AI</strong> → <strong>03. Tổ chức sự kiện</strong> → <strong>04. Đánh giá sau sự kiện</strong>
                </p>
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
                    <small>Mỗi chu kỳ gắn liền với 1 khảo sát trước, phân tích AI, 1 sự kiện và 1 khảo sát đánh giá sau.</small>
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
                  <p>Trung bình cộng toàn bộ khảo sát thực tế (Điểm chuẩn hóa 0–100 theo 4 tiêu chí)</p>
                </div>
              </div>

              {dashboard?.allSurveysCriterionComparison && dashboard.allSurveysCriterionComparison.length > 0 ? (
                <CriterionBarChart data={dashboard.allSurveysCriterionComparison} />
              ) : dashboard?.criterionComparison && dashboard.criterionComparison.length > 0 ? (
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
                  <h2>Phân tích & Đề xuất AI</h2>
                  <p>{formatUpdatedAt(dashboard?.aiInsight.updatedAt)}</p>
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
                    "Hệ thống sẽ tổng hợp dữ liệu khảo sát ẩn danh và phân tích điểm chênh lệch, đề xuất hoạt động phù hợp cho nhà trường."}
                </p>
                {dashboard?.aiInsight.recommendations.map((recommendation) => (
                  <p className="insight-recommendation" key={recommendation}>
                    • {recommendation}
                  </p>
                ))}
              </div>

              {dashboard?.aiInsight.canRetry && (
                <p className="insight-warning">
                  <RefreshCw size={14} aria-hidden="true" /> Lần gọi AI trước bị gián đoạn; bạn có thể chạy lại.
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
                    : "Phân tích thực trạng bằng AI"}
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
              </div>
            </Card>
          </section>
        )}
      </main>

      {/* Toast Alert */}
      {toastVisible && (
        <Toast
          variant="success"
          title="Phân tích AI đã hoàn tất"
          message="Kết quả phân tích đã được lưu trữ và cập nhật vào biểu đồ."
          onClose={() => setToastVisible(false)}
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
        {dashboard?.aiInsight.recommendations && dashboard.aiInsight.recommendations.length > 0 && (
          <div style={{ margin: "14px 0" }}>
            <strong style={{ fontSize: 14 }}>Các khuyến nghị cụ thể:</strong>
            {dashboard.aiInsight.recommendations.map((recommendation) => (
              <p className="modal-copy" key={recommendation} style={{ margin: "6px 0" }}>
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

      {/* Cycle Detail Modal (Bấm vào ô vuông hiển thị điểm trước/sau của 2 cơ sở, đánh giá & đề xuất AI) */}
      <CycleDetailModal
        cycle={selectedCycleDetail}
        onClose={() => setSelectedCycleDetail(null)}
        onCreateNextAction={(title, summary) => {
          setSelectedCycleDetail(null);
          setEventPreset({ title, objective: `Mục tiêu cải thiện chu kỳ mới: ${summary}` });
          setActivePage("Sự kiện");
        }}
      />

      {/* Modal xem tất cả chu kỳ (Nếu muốn xem toàn bộ tiến trình) */}
      <AllCyclesModal
        open={allCyclesOpen}
        cycles={dashboard?.cycles ?? []}
        onClose={() => setAllCyclesOpen(false)}
        onSelectCycle={(cycle) => {
          setSelectedCycleDetail(cycle);
        }}
        onCreateNewCycle={() => {
          setEventPreset(null);
          setActivePage("Sự kiện");
        }}
      />

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
