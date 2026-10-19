import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge, Button, Card, EmptyState } from "./ui";
import { EventManagement } from "../events";
import { SurveyManagement } from "../surveys";
import type { ImprovementCycleData } from "./cycle-cards";
import { eventStatusBadge } from "../event-status";
import { BaselineAiPanel } from "./baseline-ai-panel";
import { CriterionBarChart, type CriterionComparisonData } from "./charts";

export function CycleDetailView({
  cycle,
  onBack,
  analyzing,
  onRunAnalysis,
  onOpenSurvey,
  onOpenEvent,
  onCreateNextAction,
  onCreateEvent,
}: {
  cycle: ImprovementCycleData;
  onBack: () => void;
  analyzing: "BASELINE" | "EFFECTIVENESS" | null;
  onRunAnalysis: (stage: "BASELINE" | "EFFECTIVENESS") => void;
  onOpenSurvey: (surveyId?: string | null) => void;
  onOpenEvent: (eventId?: string | null) => void;
  onCreateNextAction?: (title: string, summary: string) => void;
  onCreateEvent?: (title: string, objective: string, baselineSurveyId: string) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"progress" | "surveys" | "event">("progress");

  const baselineRecommendations = cycle.steps.step2.recommendations ?? [];
  const afterChartData: CriterionComparisonData[] = cycle.metrics.afterByCriterion.map((item) => ({ ...item }));

  // Nhãn trạng thái của chu kỳ bám theo thời gian thực của sự kiện.
  const statusConfig = eventStatusBadge(cycle);

  // AI đánh giá hiệu quả chạy được khi cả khảo sát trước và khảo sát sau đều có
  // tối thiểu 1 phản hồi — không phụ thuộc trạng thái sự kiện.
  const canRunEffectiveness = Boolean(cycle.steps.step4.responsesCount);

  return (
    <div className="cycle-detail-page">
      <button className="back-button" type="button" onClick={onBack} style={{ marginBottom: "16px" }}>
        <ArrowLeft size={16} /> Quay lại danh sách chu kỳ
      </button>

      <header className="student-page-hero" style={{ marginBottom: "24px" }}>
        <div className="student-hero-copy">
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
            <span className="student-hero-kicker" style={{ margin: 0 }}>
              <Sparkles size={14} aria-hidden="true" />
              Chi tiết chu kỳ hoạt động · THCS Đông Ngạc
            </span>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
          <h1>{cycle.title}</h1>
          <p>
            Quy trình cải tiến 5 bước kết nối Điểm chính và Phân hiệu: từ khảo sát thực trạng, kích hoạt AI lần 1, tổ chức hoạt động đến khảo sát đánh giá và AI tổng kết.
          </p>
          {onCreateNextAction && cycle.metrics.aiEvaluation.recommendations.length > 0 && (
            <div className="teacher-hero-actions">
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
            </div>
          )}
          <div className="student-hero-proof">
            <span>
              <CalendarDays size={16} />
              {cycle.eventId
                ? `${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(cycle.startAt))} – ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(cycle.endAt))}`
                : "Chưa gắn thời gian"}
            </span>
            <span>
              <FileText size={16} />
              {cycle.steps.step1.responsesCount ?? 0} Phản hồi trước
            </span>
            <span>
              <CheckCircle2 size={16} />
              {cycle.steps.step4.responsesCount ?? 0} Phản hồi sau
            </span>
          </div>
        </div>
        <div className="student-hero-art" aria-hidden="true">
          <div className="student-hero-orbit student-hero-orbit-one" />
          <div className="student-hero-orbit student-hero-orbit-two" />
          <div className="student-hero-core">
            <Sparkles size={36} />
          </div>
          <div className="student-hero-float float-top">
            <CalendarDays size={18} />
            <span>Tiến trình 5 bước</span>
          </div>
          <div className="student-hero-float float-bottom">
            <Users size={18} />
            <span>Đánh giá kết quả</span>
          </div>
          <span className="student-hero-dot dot-one" />
          <span className="student-hero-dot dot-two" />
          <span className="student-hero-dot dot-three" />
        </div>
      </header>

      {/* Sub-tabs inside Cycle Detail */}
      <div className="student-filter-toolbar" style={{ marginBottom: "24px" }}>
        <div className="student-filter-tabs">
          <button
            type="button"
            className={`student-filter-tab ${activeSubTab === "progress" ? "is-active" : ""}`}
            aria-pressed={activeSubTab === "progress"}
            onClick={() => setActiveSubTab("progress")}
          >
            Tiến trình cải thiện
          </button>
          <button
            type="button"
            className={`student-filter-tab ${activeSubTab === "surveys" ? "is-active" : ""}`}
            aria-pressed={activeSubTab === "surveys"}
            onClick={() => setActiveSubTab("surveys")}
          >
            Khảo sát liên kết ({Number(Boolean(cycle.steps.step1.surveyId)) + Number(Boolean(cycle.steps.step4.surveyId))})
          </button>
          <button
            type="button"
            className={`student-filter-tab ${activeSubTab === "event" ? "is-active" : ""}`}
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
            <h3 className="section-title-sm">Tiến độ chu kỳ cải thiện</h3>
            <div className="cycle-detail-stepper">
              <div className={`stepper-node ${cycle.steps.step1.status === "COMPLETED" ? "is-done" : "is-active"}`}>
                <span className="node-num">01</span>
                <div className="node-text">
                  <strong>Khảo sát đầu vào</strong>
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
                  <strong>Tổ chức hoạt động</strong>
                  <span>{cycle.steps.step3.eventTitle || cycle.title}</span>
                  <small>{cycle.steps.step3.participantsCount ?? 0} học sinh xác nhận</small>
                </div>
                <Button size="small" variant="secondary" disabled={!cycle.steps.step3.eventId} onClick={() => onOpenEvent(cycle.steps.step3.eventId ?? undefined)}>
                  Xem sự kiện
                </Button>
                {!cycle.eventId && onCreateEvent && cycle.steps.step2.status === "COMPLETED" && (
                  <Button size="small" icon={<CalendarDays size={14} />} onClick={() => onCreateEvent(
                    cycle.title,
                    [cycle.steps.step2.summary, ...(cycle.steps.step2.recommendations ?? [])].filter(Boolean).join("\n\n"),
                    cycle.steps.step1.surveyId ?? "",
                  )}>Tạo sự kiện</Button>
                )}
              </div>

              <div
                className={`stepper-node ${cycle.steps.step4.status === "COMPLETED" ? "is-done" : cycle.steps.step4.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}
              >
                <span className="node-num">04</span>
                <div className="node-text">
                  <strong>Khảo sát mức độ hài lòng</strong>
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
                  <strong>AI tổng kết và gợi ý lần sau</strong>
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

          <div className="cycle-ai-section">
            <BaselineAiPanel
              summary={cycle.steps.step2.summary ?? null}
              recommendations={baselineRecommendations}
              hasResponses={Boolean(cycle.steps.step1.responsesCount)}
              emptyDescription={
                cycle.steps.step1.responsesCount
                  ? "Khảo sát đã có phản hồi. Chạy AI để tổng hợp mong muốn theo câu hỏi và cơ sở, sau đó nhận đề xuất hướng tổ chức."
                  : "Học sinh cần gửi phản hồi khảo sát ban đầu trước khi chạy phân tích."
              }
              onCreateEvent={
                !cycle.steps.step3.eventId &&
                baselineRecommendations[0] &&
                onCreateEvent
                  ? () =>
                      onCreateEvent(
                        cycle.title,
                        [cycle.steps.step2.summary, ...baselineRecommendations].filter(Boolean).join("\n\n"),
                        cycle.steps.step1.surveyId ?? "",
                      )
                  : undefined
              }
            />
            <Card className="cycle-satisfaction-chart-card">
              <div className="section-heading"><div><h3 className="section-title-sm">Mức độ hài lòng sau hoạt động</h3><p>Điểm trung bình theo từng tiêu chí, tách theo hai cơ sở.</p></div></div>
              {afterChartData.length ? <CriterionBarChart data={afterChartData} showSummaryTable={false} /> : <EmptyState compact title="Chưa có điểm đánh giá" description="Biểu đồ sẽ hiển thị sau khi học sinh gửi khảo sát hài lòng." />}
            </Card>
            <div className="cycle-ai-block evaluation">
              <div className="ai-block-header">
                <Sparkles size={20} className="ai-icon" />
                <div>
                  <h3 className="section-title-sm" style={{ margin: 0 }}>AI đánh giá hiệu quả (lần 2)</h3>
                  <p className="ai-stage-hint">Phân tích điểm hài lòng sau hoạt động theo từng tiêu chí và cơ sở, rồi đề xuất cải tiến cho lần tổ chức tiếp theo.</p>
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
                        ? "Khảo sát sau đã có phản hồi. Chạy AI để đánh giá mức độ hài lòng và nhận đề xuất cho lần tiếp theo."
                        : "Cần tối thiểu 1 phản hồi khảo sát sau sự kiện trước khi chạy AI đánh giá."
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
      {/* Top sub-tabs for Teacher to switch between Cycles, Surveys, and Events */}
      <div className="student-filter-toolbar" style={{ marginBottom: "24px" }}>
        <div className="student-filter-tabs">
          <button
            type="button"
            className={`student-filter-tab ${activeMainTab === "cycles" ? "is-active" : ""}`}
            aria-pressed={activeMainTab === "cycles"}
            onClick={() => setActiveMainTab("cycles")}
          >
            Chu kỳ cải thiện ({cycles.length})
          </button>
          <button
            type="button"
            className={`student-filter-tab ${activeMainTab === "surveys" ? "is-active" : ""}`}
            aria-pressed={activeMainTab === "surveys"}
            onClick={() => setActiveMainTab("surveys")}
          >
            Kho khảo sát
          </button>
          <button
            type="button"
            className={`student-filter-tab ${activeMainTab === "events" ? "is-active" : ""}`}
            aria-pressed={activeMainTab === "events"}
            onClick={() => setActiveMainTab("events")}
          >
            Kho sự kiện
          </button>
        </div>
      </div>

      {activeMainTab === "cycles" && (
        <>
          <header className="student-page-hero" style={{ marginBottom: "24px" }}>
            <div className="student-hero-copy">
              <span className="student-hero-kicker">
                <Sparkles size={15} aria-hidden="true" />
                Quy trình cải tiến 5 bước · THCS Đông Ngạc
              </span>
              <h1>
                Chu kỳ hoạt động &<br />
                <span>Vòng tròn nâng cao chất lượng.</span>
              </h1>
              <p>
                Chu trình chuẩn hóa: Khảo sát thực trạng → Phân tích AI lần 1 → Tổ chức hoạt động → Đánh giá sau sự kiện → AI tổng kết hiệu quả.
              </p>
              <div className="teacher-hero-actions">
                <Button icon={<Plus size={18} />} onClick={onCreateCycle}>
                  Khởi tạo chu kỳ mới
                </Button>
              </div>
              <div className="student-hero-proof">
                <span><Sparkles size={16} /> {cycles.length} Chu kỳ cải thiện</span>
                <span><CheckCircle2 size={16} /> 5 Bước chuẩn hóa</span>
                <span><Users size={16} /> Đồng hành 2 cơ sở</span>
              </div>
            </div>
            <div className="student-hero-art" aria-hidden="true">
              <div className="student-hero-orbit student-hero-orbit-one" />
              <div className="student-hero-orbit student-hero-orbit-two" />
              <div className="student-hero-core">
                <Sparkles size={36} />
              </div>
              <div className="student-hero-float float-top">
                <CalendarDays size={18} />
                <span>Chu trình 5 bước</span>
              </div>
              <div className="student-hero-float float-bottom">
                <Users size={18} />
                <span>Hiệu quả đo lường</span>
              </div>
              <span className="student-hero-dot dot-one" />
              <span className="student-hero-dot dot-two" />
              <span className="student-hero-dot dot-three" />
            </div>
          </header>

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
                        <span className="step-label">Tổ chức hoạt động</span>
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
                        <span className="step-label">Đánh giá hài lòng</span>
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

                  <div className="cycle-card-footer"><span>Phản hồi khảo sát sau: {cycle.steps.step4.responsesCount ?? 0}</span></div>
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
                  <p>Đặt tên chương trình → Khảo sát → AI đề xuất → Tổ chức → Đánh giá hài lòng → AI tổng kết</p>
                </div>
              </button>
            </div>
          )}
        </div>
        </>
      )}

      {/* Embedded Surveys management */}
      {activeMainTab === "surveys" && <SurveyManagement role="teacher" />}

      {/* Embedded Events management */}
      {activeMainTab === "events" && <EventManagement role="teacher" />}
    </section>
  );
}
