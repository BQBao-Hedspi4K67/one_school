import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, EmptyState } from "./ui";
import { EventManagement } from "../events";
import { SurveyManagement } from "../surveys";
import type { ImprovementCycleData } from "./cycle-cards";

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "--";
  return Number(score).toFixed(1);
}

export function CycleDetailView({
  cycle,
  onBack,
  onOpenSurvey,
  onOpenEvent,
  onCreateNextAction,
}: {
  cycle: ImprovementCycleData;
  onBack: () => void;
  onOpenSurvey: (surveyId?: string | null) => void;
  onOpenEvent: (eventId?: string | null) => void;
  onCreateNextAction?: (title: string, summary: string) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"progress" | "surveys" | "event">("progress");

  const beforeMain = cycle.metrics.beforeScore.main;
  const beforeBranch = cycle.metrics.beforeScore.branch;
  const beforeGap = cycle.metrics.beforeScore.gap;

  const afterMain = cycle.metrics.afterScore.main;
  const afterBranch = cycle.metrics.afterScore.branch;
  const afterGap = cycle.metrics.afterScore.gap;

  const gapReduced =
    beforeGap !== null && afterGap !== null ? Math.round((beforeGap - afterGap) * 10) / 10 : null;

  const statusLabels: Record<string, { label: string; variant: "neutral" | "info" | "success" | "warning" }> = {
    DRAFT: { label: "Bản nháp", variant: "neutral" },
    UPCOMING: { label: "Sắp diễn ra", variant: "info" },
    LIVE: { label: "Đang diễn ra", variant: "success" },
    COMPLETED: { label: "Đã hoàn thành", variant: "warning" },
  };

  const statusConfig = statusLabels[cycle.status] ?? { label: cycle.status, variant: "neutral" };

  return (
    <div className="cycle-detail-page">
      <div className="cycle-page-top-bar">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại danh sách chu kỳ
        </button>

        <div className="cycle-page-header">
          <div className="cycle-header-main">
            <div className="cycle-header-badges">
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              <span className="cycle-date-badge">
                Chu kỳ: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(cycle.startAt))} –{" "}
                {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(cycle.endAt))}
              </span>
            </div>
            <h1>{cycle.title}</h1>
            <p className="page-description">
              Quy trình cải thiện chất lượng giáo dục 4 bước khép kín giữa Điểm chính và Phân hiệu.
            </p>
          </div>

          <div className="cycle-header-actions">
            {onCreateNextAction && cycle.metrics.aiEvaluation.recommendations.length > 0 && (
              <Button
                icon={<Sparkles size={16} />}
                onClick={() =>
                  onCreateNextAction(
                    `Chu kỳ tiếp nối: ${cycle.title}`,
                    cycle.metrics.aiEvaluation.recommendations[0],
                  )
                }
              >
                Mở chu kỳ mới theo AI
              </Button>
            )}
          </div>
        </div>

        {/* Sub-tabs inside Cycle Detail */}
        <div className="cycle-sub-tabs">
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === "progress" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("progress")}
          >
            Tiến trình & Đánh giá 4 bước
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === "surveys" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("surveys")}
          >
            Khảo sát liên kết ({cycle.steps.step1.surveyId ? (cycle.steps.step4.surveyId ? 2 : 1) : 0})
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === "event" ? "is-active" : ""}`}
            onClick={() => setActiveSubTab("event")}
          >
            Hoạt động sự kiện ({cycle.steps.step3.participantsCount ?? 0} HS)
          </button>
        </div>
      </div>

      {/* Tab 1: Progress & 4-step Stepper */}
      {activeSubTab === "progress" && (
        <div className="cycle-detail-content">
          {/* Stepper Card */}
          <Card className="cycle-stepper-fullcard">
            <h3 className="section-title-sm">Tiến độ 4 bước khép kín</h3>
            <div className="cycle-detail-stepper">
              <div
                className={`stepper-node ${cycle.steps.step1.status === "COMPLETED" ? "is-done" : "is-active"}`}
                onClick={() => cycle.steps.step1.surveyId && onOpenSurvey(cycle.steps.step1.surveyId)}
                style={{ cursor: "pointer" }}
              >
                <span className="node-num">01</span>
                <div className="node-text">
                  <strong>Khảo sát ban đầu</strong>
                  <span>{cycle.steps.step1.surveyTitle || "Khảo sát thực trạng"}</span>
                  <small>{cycle.steps.step1.responsesCount ?? 0} lượt phản hồi · Xem</small>
                </div>
              </div>

              <span className="stepper-arrow">→</span>

              <div className={`stepper-node ${cycle.steps.step2.status === "COMPLETED" ? "is-done" : cycle.steps.step2.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                <span className="node-num">02</span>
                <div className="node-text">
                  <strong>Phân tích AI</strong>
                  <span>{cycle.steps.step2.summary ? "Đã có nhận định" : "Chờ phân tích"}</span>
                  <small>
                    {cycle.steps.step2.recommendationsCount ? `${cycle.steps.step2.recommendationsCount} đề xuất giải pháp` : "Chưa có đề xuất"}
                  </small>
                </div>
              </div>

              <span className="stepper-arrow">→</span>

              <div
                className={`stepper-node ${cycle.steps.step3.status === "COMPLETED" ? "is-done" : cycle.steps.step3.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}
                onClick={() => onOpenEvent(cycle.id)}
                style={{ cursor: "pointer" }}
              >
                <span className="node-num">03</span>
                <div className="node-text">
                  <strong>Tổ chức sự kiện</strong>
                  <span>{cycle.title}</span>
                  <small>{cycle.steps.step3.participantsCount ?? 0} học sinh xác nhận · Xem</small>
                </div>
              </div>

              <span className="stepper-arrow">→</span>

              <div
                className={`stepper-node ${cycle.steps.step4.status === "COMPLETED" ? "is-done" : cycle.steps.step4.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}
                onClick={() => cycle.steps.step4.surveyId && onOpenSurvey(cycle.steps.step4.surveyId)}
                style={{ cursor: cycle.steps.step4.surveyId ? "pointer" : "default" }}
              >
                <span className="node-num">04</span>
                <div className="node-text">
                  <strong>Đánh giá sau sự kiện</strong>
                  <span>{cycle.steps.step4.surveyTitle || "Khảo sát sau"}</span>
                  <small>
                    {cycle.steps.step4.responsesCount ? `${cycle.steps.step4.responsesCount} lượt phản hồi` : "Đang chờ thu thập"}
                  </small>
                </div>
              </div>
            </div>
          </Card>

          {/* Before & After Comparison Grid */}
          <div className="cycle-comparison-block">
            <Card>
              <h3 className="section-title-sm">
                Điểm hài lòng hai cơ sở: Trước và Sau khi tham gia sự kiện
              </h3>
              <div className="before-after-grid">
                <div className="ba-card before">
                  <div className="ba-card-badge">Trước sự kiện (Khảo sát 01)</div>
                  <div className="ba-stat-row">
                    <span className="ba-campus-tag main">Điểm chính</span>
                    <span className="ba-val">{formatScore(beforeMain)}/100</span>
                  </div>
                  <div className="ba-stat-row">
                    <span className="ba-campus-tag branch">Phân hiệu</span>
                    <span className="ba-val">{formatScore(beforeBranch)}/100</span>
                  </div>
                  <div className="ba-gap-row">
                    <span>Khoảng cách cơ sở:</span>
                    <strong>{beforeGap !== null ? `${beforeGap} điểm` : "--"}</strong>
                  </div>
                </div>

                <div className="ba-card after">
                  <div className="ba-card-badge">Sau sự kiện (Khảo sát 04)</div>
                  <div className="ba-stat-row">
                    <span className="ba-campus-tag main">Điểm chính</span>
                    <span className="ba-val highlight">{formatScore(afterMain)}/100</span>
                  </div>
                  <div className="ba-stat-row">
                    <span className="ba-campus-tag branch">Phân hiệu</span>
                    <span className="ba-val highlight">{formatScore(afterBranch)}/100</span>
                  </div>
                  <div className="ba-gap-row">
                    <span>Khoảng cách còn lại:</span>
                    <strong>{afterGap !== null ? `${afterGap} điểm` : "--"}</strong>
                  </div>
                </div>
              </div>

              {gapReduced !== null && (
                <div className={`gap-reduction-banner ${gapReduced > 0 ? "positive" : "neutral"}`}>
                  {gapReduced > 0 ? (
                    <span>
                      🎉 Hoạt động đã góp phần <strong>thu hẹp {gapReduced} điểm</strong> khoảng cách chất lượng giáo dục giữa Điểm chính và Phân hiệu!
                    </span>
                  ) : (
                    <span>
                      Khoảng cách giữa hai cơ sở thay đổi {gapReduced} điểm sau khi tổ chức sự kiện.
                    </span>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* AI Evaluation Block */}
          <div className="cycle-ai-block">
            <div className="ai-block-header">
              <Sparkles size={20} className="ai-icon" />
              <h3 className="section-title-sm" style={{ margin: 0 }}>
                Đánh giá và Đề xuất từ AI sau khi kết thúc chu kỳ
              </h3>
            </div>

            <div className="ai-evaluation-box">
              {cycle.metrics.aiEvaluation.summary ? (
                <p className="ai-summary">{cycle.metrics.aiEvaluation.summary}</p>
              ) : (
                <EmptyState
                  title="Chưa có phân tích AI cho chu kỳ này"
                  description="Sau khi hoàn thành khảo sát và sự kiện, hãy chạy phân tích AI để nhận báo cáo và đề xuất giải pháp."
                  compact
                />
              )}

              {cycle.metrics.aiEvaluation.recommendations.length > 0 && (
                <div className="ai-recs-list" style={{ marginTop: 14 }}>
                  <span className="recs-title">Khuyến nghị cho chu kỳ cải thiện tiếp theo:</span>
                  <ul>
                    {cycle.metrics.aiEvaluation.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Associated Surveys */}
      {activeSubTab === "surveys" && (
        <div className="cycle-surveys-tab">
          <Card>
            <div className="section-heading">
              <div>
                <h2>Các khảo sát thuộc chu kỳ này</h2>
                <p>Khảo sát ban đầu đo lường thực trạng và khảo sát sau sự kiện đánh giá hiệu quả.</p>
              </div>
            </div>

            <div className="cycle-surveys-list">
              <div className="cycle-survey-item">
                <div className="survey-item-info">
                  <span className="item-badge">Bước 01</span>
                  <div>
                    <h4>{cycle.steps.step1.surveyTitle || "Khảo sát thực trạng ban đầu"}</h4>
                    <p>{cycle.steps.step1.responsesCount ?? 0} lượt phản hồi từ học sinh 2 cơ sở</p>
                  </div>
                </div>
                <Button
                  size="small"
                  variant="secondary"
                  icon={<FileText size={15} />}
                  onClick={() => onOpenSurvey(cycle.steps.step1.surveyId)}
                >
                  Xem chi tiết khảo sát
                </Button>
              </div>

              <div className="cycle-survey-item">
                <div className="survey-item-info">
                  <span className="item-badge">Bước 04</span>
                  <div>
                    <h4>{cycle.steps.step4.surveyTitle || "Khảo sát đánh giá sau sự kiện"}</h4>
                    <p>
                      {cycle.steps.step4.surveyId
                        ? `${cycle.steps.step4.responsesCount ?? 0} lượt phản hồi ghi nhận thay đổi`
                        : "Chưa gắn khảo sát sau sự kiện"}
                    </p>
                  </div>
                </div>
                <Button
                  size="small"
                  variant="secondary"
                  icon={<FileText size={15} />}
                  disabled={!cycle.steps.step4.surveyId}
                  onClick={() => onOpenSurvey(cycle.steps.step4.surveyId)}
                >
                  {cycle.steps.step4.surveyId ? "Xem chi tiết khảo sát" : "Chưa tạo"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Associated Event */}
      {activeSubTab === "event" && (
        <div className="cycle-event-tab">
          <Card>
            <div className="section-heading">
              <div>
                <h2>Hoạt động sự kiện kết nối</h2>
                <p>Sự kiện gắn liền với chu kỳ: {cycle.title}</p>
              </div>
              <Button
                size="small"
                variant="primary"
                icon={<CalendarDays size={15} />}
                onClick={() => onOpenEvent(cycle.id)}
              >
                Mở trang quản lý sự kiện này
              </Button>
            </div>

            <div className="event-summary-box">
              <div className="event-summary-stat">
                <span>Trạng thái:</span>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
              <div className="event-summary-stat">
                <span>Số học sinh tham gia xác nhận:</span>
                <strong>{cycle.steps.step3.participantsCount ?? 0} học sinh</strong>
              </div>
              <div className="event-summary-stat">
                <span>Thời gian:</span>
                <span>
                  {new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "short" }).format(
                    new Date(cycle.startAt),
                  )}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function CyclesHubPage({
  cycles,
  onSelectCycle,
  onCreateCycle,
}: {
  cycles: ImprovementCycleData[];
  onSelectCycle: (cycle: ImprovementCycleData) => void;
  onCreateCycle: () => void;
}) {
  const [activeMainTab, setActiveMainTab] = useState<"cycles" | "surveys" | "events">("cycles");

  return (
    <section className="cycles-hub-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Quy trình kết nối khép kín</p>
          <h1>Chu kỳ hoạt động</h1>
          <p className="page-description">
            Quản lý các chu kỳ cải thiện 4 bước: <strong>01. Khảo sát ban đầu</strong> → <strong>02. Phân tích AI</strong> → <strong>03. Tổ chức sự kiện</strong> → <strong>04. Đánh giá sau sự kiện</strong>.
          </p>
        </div>

        {activeMainTab === "cycles" && (
          <Button icon={<Plus size={18} />} onClick={onCreateCycle}>
            Khởi tạo chu kỳ mới
          </Button>
        )}
      </div>

      {/* Top sub-tabs for Teacher to switch between Cycles, Surveys, and Events */}
      <div className="hub-nav-tabs">
        <button
          type="button"
          className={`hub-tab-button ${activeMainTab === "cycles" ? "is-active" : ""}`}
          onClick={() => setActiveMainTab("cycles")}
        >
          Chu kỳ cải thiện ({cycles.length})
        </button>
        <button
          type="button"
          className={`hub-tab-button ${activeMainTab === "surveys" ? "is-active" : ""}`}
          onClick={() => setActiveMainTab("surveys")}
        >
          Kho khảo sát
        </button>
        <button
          type="button"
          className={`hub-tab-button ${activeMainTab === "events" ? "is-active" : ""}`}
          onClick={() => setActiveMainTab("events")}
        >
          Kho sự kiện
        </button>
      </div>

      {activeMainTab === "cycles" && (
        <div className="cycles-grid-container">
          {cycles.length === 0 ? (
            <Card className="empty-cycles-card">
              <EmptyState
                title="Chưa có chu kỳ hoạt động nào"
                description="Hãy khởi tạo chu kỳ cải thiện đầu tiên. Mỗi chu kỳ sẽ gắn kết 1 khảo sát thực trạng, phân tích AI, 1 sự kiện và 1 khảo sát đánh giá sau."
                icon={<Sparkles size={28} />}
              />
              <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
                <Button icon={<Plus size={16} />} onClick={onCreateCycle}>
                  Tạo chu kỳ cải thiện đầu tiên
                </Button>
              </div>
            </Card>
          ) : (
            <div className="cycles-square-list">
              {cycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="cycle-square-card"
                  onClick={() => onSelectCycle(cycle)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectCycle(cycle);
                    }
                  }}
                >
                  <div className="cycle-card-top">
                    <div className="cycle-card-heading">
                      <h3 className="cycle-title" title={cycle.title}>{cycle.title}</h3>
                      <Badge variant={cycle.status === "COMPLETED" ? "warning" : cycle.status === "LIVE" ? "success" : "info"}>
                        {cycle.status === "COMPLETED" ? "Đã kết thúc" : cycle.status === "LIVE" ? "Đang diễn ra" : "Sắp tới"}
                      </Badge>
                    </div>
                    <div className="cycle-meta">
                      <span>Tiến trình 4 bước</span>
                      <span className="cycle-view-hint">
                        Xem chi tiết <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>

                  {/* 2x2 Quadrant Grid */}
                  <div className="cycle-quadrant-grid">
                    <div className={`cycle-quadrant ${cycle.steps.step1.status === "COMPLETED" ? "is-done" : "is-active"}`}>
                      <div className="quadrant-header">
                        <span className="step-num">1</span>
                        <span className={`step-badge ${cycle.steps.step1.status === "COMPLETED" ? "done" : "active"}`}>
                          {cycle.steps.step1.status === "COMPLETED" ? "✓" : "·"}
                        </span>
                      </div>
                      <div className="quadrant-content">
                        <span className="step-label">Khảo sát đầu</span>
                        <span className="step-detail">{cycle.steps.step1.responsesCount ?? 0} phản hồi</span>
                      </div>
                    </div>

                    <div className={`cycle-quadrant ${cycle.steps.step2.status === "COMPLETED" ? "is-done" : cycle.steps.step2.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                      <div className="quadrant-header">
                        <span className="step-num">2</span>
                        <span className={`step-badge ${cycle.steps.step2.status === "COMPLETED" ? "done" : "wait"}`}>
                          {cycle.steps.step2.status === "COMPLETED" ? "✓" : "·"}
                        </span>
                      </div>
                      <div className="quadrant-content">
                        <span className="step-label">Phân tích AI</span>
                        <span className="step-detail">
                          {cycle.steps.step2.recommendationsCount ? `${cycle.steps.step2.recommendationsCount} đề xuất` : "Chờ phân tích"}
                        </span>
                      </div>
                    </div>

                    <div className={`cycle-quadrant ${cycle.steps.step3.status === "COMPLETED" ? "is-done" : cycle.steps.step3.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                      <div className="quadrant-header">
                        <span className="step-num">3</span>
                        <span className={`step-badge ${cycle.steps.step3.status === "COMPLETED" ? "done" : "active"}`}>
                          {cycle.steps.step3.status === "COMPLETED" ? "✓" : "·"}
                        </span>
                      </div>
                      <div className="quadrant-content">
                        <span className="step-label">Tổ chức SK</span>
                        <span className="step-detail">{cycle.steps.step3.participantsCount ?? 0} tham gia</span>
                      </div>
                    </div>

                    <div className={`cycle-quadrant ${cycle.steps.step4.status === "COMPLETED" ? "is-done" : cycle.steps.step4.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                      <div className="quadrant-header">
                        <span className="step-num">4</span>
                        <span className={`step-badge ${cycle.steps.step4.status === "COMPLETED" ? "done" : "wait"}`}>
                          {cycle.steps.step4.status === "COMPLETED" ? "✓" : "·"}
                        </span>
                      </div>
                      <div className="quadrant-content">
                        <span className="step-label">Đánh giá sau</span>
                        <span className="step-detail">{cycle.steps.step4.responsesCount ?? 0} phản hồi</span>
                      </div>
                    </div>
                  </div>

                  <div className="cycle-card-footer">
                    <div className="cycle-score-snippet">
                      <span>Điểm trước: <strong>{formatScore(cycle.metrics.beforeScore.main)}</strong> / <strong>{formatScore(cycle.metrics.beforeScore.branch)}</strong></span>
                    </div>
                    {cycle.metrics.gapChange !== null && (
                      <div className="cycle-gap-badge">
                        Thu hẹp: <strong>{cycle.metrics.gapChange > 0 ? `+${cycle.metrics.gapChange}` : cycle.metrics.gapChange}đ</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="cycle-square-card is-create-placeholder"
                onClick={onCreateCycle}
              >
                <div className="create-placeholder-body">
                  <div className="create-icon-bubble">
                    <Plus size={28} />
                  </div>
                  <h4>Thêm chu kỳ cải thiện mới</h4>
                  <p>Khảo sát ban đầu → AI Phân tích → Tổ chức sự kiện → Đánh giá sau sự kiện</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Embedded Surveys management */}
      {activeMainTab === "surveys" && <SurveyManagement role="teacher" />}

      {/* Embedded Events management */}
      {activeMainTab === "events" && <EventManagement role="teacher" />}
    </section>
  );
}
