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
import { eventStatusBadge } from "../event-status";
import { BaselineAiPanel } from "./baseline-ai-panel";

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "--";
  return Number(score).toFixed(1);
}

export function CycleDetailView({
  cycle,
  onBack,
  analyzing,
  onRunAnalysis,
  onOpenSurvey,
  onOpenEvent,
  onCreateNextAction,
}: {
  cycle: ImprovementCycleData;
  onBack: () => void;
  analyzing: "BASELINE" | "EFFECTIVENESS" | null;
  onRunAnalysis: (stage: "BASELINE" | "EFFECTIVENESS") => void;
  onOpenSurvey: (surveyId?: string | null) => void;
  onOpenEvent: (eventId?: string | null) => void;
  onCreateNextAction?: (title: string, summary: string) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"progress" | "surveys" | "event">("progress");

  const beforeMain = cycle.metrics.beforeScore.main;
  const beforeBranch = cycle.metrics.beforeScore.branch;
  const beforeGap = cycle.metrics.beforeScore.gap;
  const baselineRecommendations = cycle.steps.step2.recommendations ?? [];

  const afterMain = cycle.metrics.afterScore.main;
  const afterBranch = cycle.metrics.afterScore.branch;
  const afterGap = cycle.metrics.afterScore.gap;

  const gapReduced =
    beforeGap !== null && afterGap !== null ? Math.round((beforeGap - afterGap) * 10) / 10 : null;

  // Nhãn trạng thái của chu kỳ bám theo thời gian thực của sự kiện.
  const statusConfig = eventStatusBadge(cycle);

  // AI đánh giá hiệu quả chạy được khi cả khảo sát trước và khảo sát sau đều có
  // tối thiểu 1 phản hồi — không phụ thuộc trạng thái sự kiện.
  const canRunEffectiveness =
    Boolean(cycle.steps.step1.responsesCount) &&
    Boolean(cycle.steps.step4.responsesCount);

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
            aria-pressed={activeSubTab === "progress"}
            onClick={() => setActiveSubTab("progress")}
          >
            Tiến trình 5 bước
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === "surveys" ? "is-active" : ""}`}
            aria-pressed={activeSubTab === "surveys"}
            onClick={() => setActiveSubTab("surveys")}
          >
            Khảo sát liên kết ({Number(Boolean(cycle.steps.step1.surveyId)) + Number(Boolean(cycle.steps.step4.surveyId))})
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === "event" ? "is-active" : ""}`}
            aria-pressed={activeSubTab === "event"}
            onClick={() => setActiveSubTab("event")}
          >
            Hoạt động sự kiện ({cycle.steps.step3.participantsCount ?? 0} HS)
          </button>
        </div>
      </div>

      {/* Tab 1: Progress & 5-step Stepper */}
      {activeSubTab === "progress" && (
        <div className="cycle-detail-content">
          {/* Stepper Card */}
          <Card className="cycle-stepper-fullcard">
            <h3 className="section-title-sm">Tiến độ 5 bước khép kín</h3>
            <div className="cycle-detail-stepper">
              <div className={`stepper-node ${cycle.steps.step1.status === "COMPLETED" ? "is-done" : "is-active"}`}>
                <span className="node-num">01</span>
                <div className="node-text">
                  <strong>Khảo sát ban đầu</strong>
                  <span>{cycle.steps.step1.surveyTitle || "Khảo sát thực trạng"}</span>
                  <small>{cycle.steps.step1.responsesCount ?? 0} lượt phản hồi</small>
                </div>
                <Button size="small" variant="secondary" disabled={!cycle.steps.step1.surveyId} onClick={() => onOpenSurvey(cycle.steps.step1.surveyId)}>
                  Xem khảo sát
                </Button>
              </div>

              <div className={`stepper-node ${cycle.steps.step2.status === "COMPLETED" ? "is-done" : cycle.steps.step2.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                <span className="node-num">02</span>
                <div className="node-text">
                  <strong>AI phân tích thực trạng</strong>
                  <span>{cycle.steps.step2.summary ? "Đã có nhận định" : "Chạy sau khi kết thúc khảo sát trước"}</span>
                  <small>
                    {cycle.steps.step2.recommendationsCount ? `${cycle.steps.step2.recommendationsCount} đề xuất giải pháp` : "Chưa có đề xuất"}
                  </small>
                </div>
                <Button
                  size="small"
                  icon={<Sparkles size={14} />}
                  loading={analyzing === "BASELINE"}
                  disabled={!cycle.steps.step1.responsesCount || analyzing !== null}
                  onClick={() => onRunAnalysis("BASELINE")}
                >
                  {cycle.steps.step2.analysisId ? "Phân tích lại" : "Phân tích AI"}
                </Button>
              </div>

              <div
                className={`stepper-node ${cycle.steps.step3.status === "COMPLETED" ? "is-done" : cycle.steps.step3.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}
              >
                <span className="node-num">03</span>
                <div className="node-text">
                  <strong>Tổ chức sự kiện</strong>
                  <span>{cycle.steps.step3.eventTitle || cycle.title}</span>
                  <small>{cycle.steps.step3.participantsCount ?? 0} học sinh xác nhận</small>
                </div>
                <Button size="small" variant="secondary" disabled={!cycle.steps.step3.eventId} onClick={() => onOpenEvent(cycle.steps.step3.eventId)}>
                  Xem sự kiện
                </Button>
              </div>

              <div
                className={`stepper-node ${cycle.steps.step4.status === "COMPLETED" ? "is-done" : cycle.steps.step4.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}
              >
                <span className="node-num">04</span>
                <div className="node-text">
                  <strong>Khảo sát sau sự kiện</strong>
                  <span>{cycle.steps.step4.surveyTitle || "Chưa tạo khảo sát sau"}</span>
                  <small>
                    {cycle.steps.step4.responsesCount ? `${cycle.steps.step4.responsesCount} lượt phản hồi` : "Đang chờ thu thập"}
                  </small>
                </div>
                <Button size="small" variant="secondary" disabled={!cycle.steps.step4.surveyId} onClick={() => onOpenSurvey(cycle.steps.step4.surveyId)}>
                  Xem khảo sát
                </Button>
              </div>

              <div className={`stepper-node ${cycle.steps.step5?.status === "COMPLETED" ? "is-done" : cycle.steps.step5?.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                <span className="node-num">05</span>
                <div className="node-text">
                  <strong>AI đánh giá hiệu quả</strong>
                  <span>{cycle.steps.step5?.summary ? "Đã có đánh giá" : "Chạy khi cả hai khảo sát đều có phản hồi"}</span>
                  <small>{cycle.steps.step5?.recommendationsCount ?? 0} đề xuất tiếp theo</small>
                </div>
                <Button
                  size="small"
                  icon={<Sparkles size={14} />}
                  loading={analyzing === "EFFECTIVENESS"}
                  disabled={!canRunEffectiveness || analyzing !== null}
                  onClick={() => onRunAnalysis("EFFECTIVENESS")}
                >
                  {cycle.steps.step5?.analysisId ? "Đánh giá lại" : "Phân tích AI"}
                </Button>
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

          <div className="cycle-ai-section">
            <BaselineAiPanel
              summary={cycle.steps.step2.summary ?? null}
              recommendations={baselineRecommendations}
              hasResponses={Boolean(cycle.steps.step1.responsesCount)}
              emptyDescription={
                cycle.steps.step1.responsesCount
                  ? "Khảo sát đã có phản hồi. Chạy AI để xem vấn đề theo tiêu chí và cơ sở cùng các đề xuất hoạt động."
                  : "Học sinh cần gửi phản hồi khảo sát ban đầu trước khi chạy phân tích."
              }
              onCreateEvent={
                !cycle.steps.step3.eventId &&
                baselineRecommendations[0] &&
                onCreateNextAction
                  ? () =>
                      onCreateNextAction(
                        "Hoạt động theo đề xuất AI",
                        baselineRecommendations[0],
                      )
                  : undefined
              }
            />
            <div className="cycle-ai-block evaluation">
              <div className="ai-block-header">
                <Sparkles size={20} className="ai-icon" />
                <div>
                  <h3 className="section-title-sm" style={{ margin: 0 }}>AI đánh giá hiệu quả (lần 2)</h3>
                  <p className="ai-stage-hint">So sánh kết quả trước – sau, tính mức hài lòng và đề xuất chu kỳ cải thiện tiếp theo. Chạy được ngay khi cả hai khảo sát đều có phản hồi.</p>
                </div>
              </div>
              <div className="ai-evaluation-box">
                {cycle.metrics.aiEvaluation.summary ? (
                  <p className="ai-summary">{cycle.metrics.aiEvaluation.summary}</p>
                ) : (
                  <EmptyState
                    title="Chưa có đánh giá AI cho chu kỳ này"
                    description={
                      canRunEffectiveness
                        ? "Cả hai khảo sát đều đã có phản hồi. Chạy AI để đánh giá hiệu quả và nhận đề xuất cho chu kỳ tiếp theo."
                        : "Cần tối thiểu 1 phản hồi cho khảo sát trước và 1 phản hồi cho khảo sát sau sự kiện trước khi chạy AI đánh giá."
                    }
                    compact
                  />
                )}
                {cycle.metrics.aiEvaluation.recommendations.length > 0 && (
                  <div className="ai-recs-list">
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
        </div>
      )}

      {/* Tab 2: Associated Surveys */}
      {activeSubTab === "surveys" && (
        <div className="cycle-surveys-tab">
          <Card>
            <div className="section-heading">
              <div>
                <h2>Các khảo sát thuộc chu kỳ này</h2>
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
                  disabled={!cycle.steps.step1.surveyId}
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
                <p style={{ paddingBottom: '5px' }}>Sự kiện gắn liền với chu kỳ: {cycle.steps.step3.eventTitle || cycle.title}</p>
              </div>
              <Button
                size="small"
                variant="primary"
                icon={<CalendarDays size={15} />}
                disabled={!cycle.steps.step3.eventId}
                onClick={() => onOpenEvent(cycle.steps.step3.eventId)}
              >
                Mở trang quản lý sự kiện này
              </Button>
            </div>

            <div className="event-summary-box">
              <div className="event-summary-preview">
                <div className="event-summary-thumbnail">
                  {cycle.steps.step3.coverImageUrl ? (
                    <img src={cycle.steps.step3.coverImageUrl} alt="" />
                  ) : (
                    <CalendarDays size={22} aria-hidden="true" />
                  )}
                </div>
                <div>
                  <span className="eyebrow">Sự kiện của chu kỳ</span>
                  <strong>{cycle.steps.step3.eventTitle || cycle.title}</strong>
                </div>
              </div>
              <div className="event-summary-details">
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
                  <strong>
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "short" }).format(
                      new Date(cycle.startAt),
                    )}
                  </strong>
                </div>
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
          <p className="eyebrow">Quy trình sự kiện</p>
          <h1>Chu kỳ hoạt động</h1>
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
          aria-pressed={activeMainTab === "cycles"}
          onClick={() => setActiveMainTab("cycles")}
        >
          Chu kỳ cải thiện ({cycles.length})
        </button>
        <button
          type="button"
          className={`hub-tab-button ${activeMainTab === "surveys" ? "is-active" : ""}`}
          aria-pressed={activeMainTab === "surveys"}
          onClick={() => setActiveMainTab("surveys")}
        >
          Kho khảo sát
        </button>
        <button
          type="button"
          className={`hub-tab-button ${activeMainTab === "events" ? "is-active" : ""}`}
          aria-pressed={activeMainTab === "events"}
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
                description="Khởi tạo chu kỳ gồm khảo sát thực trạng, phân tích AI, sự kiện, khảo sát sau sự kiện và AI đánh giá hiệu quả."
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
                      <Badge variant={eventStatusBadge(cycle).variant}>
                        {eventStatusBadge(cycle).label}
                      </Badge>
                    </div>
                    <div className="cycle-meta">
                      <span>Tiến trình 5 bước</span>
                      <span className="cycle-view-hint">
                        Xem chi tiết <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>

                  {/* Five equally sized cycle stages */}
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
                        <span className="step-label">AI thực trạng</span>
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
                        <span className="step-label">Khảo sát sau</span>
                        <span className="step-detail">{cycle.steps.step4.responsesCount ?? 0} phản hồi</span>
                      </div>
                    </div>
                    <div className={`cycle-quadrant ${cycle.steps.step5?.status === "COMPLETED" ? "is-done" : cycle.steps.step5?.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
                      <div className="quadrant-header">
                        <span className="step-num">5</span>
                        <span className={`step-badge ${cycle.steps.step5?.status === "COMPLETED" ? "done" : cycle.steps.step5?.status === "IN_PROGRESS" ? "active" : "wait"}`}>
                          {cycle.steps.step5?.status === "COMPLETED" ? "✓" : "·"}
                        </span>
                      </div>
                      <div className="quadrant-content">
                        <span className="step-label">AI đánh giá</span>
                        <span className="step-detail">
                          {cycle.steps.step5?.status === "COMPLETED"
                            ? `${cycle.steps.step5.recommendationsCount ?? 0} đề xuất tiếp theo`
                            : "Chờ khảo sát sau"}
                        </span>
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
                  <p>Khảo sát → AI phân tích → Sự kiện → Khảo sát sau → AI đánh giá</p>
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
