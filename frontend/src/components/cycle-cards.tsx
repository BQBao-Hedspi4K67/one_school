import { Check, Clock, Plus, ArrowRight, Sparkles, ChevronRight, X } from "lucide-react";
import { Badge, Button } from "./ui";

export type ImprovementCycleStep = {
  name: string;
  status: "COMPLETED" | "IN_PROGRESS" | "WAITING";
  responsesCount?: number;
  participantsCount?: number;
  recommendationsCount?: number;
  summary?: string | null;
  surveyId?: string | null;
  surveyTitle?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
};

export type ImprovementCycleData = {
  id: string;
  title: string;
  status: "DRAFT" | "UPCOMING" | "LIVE" | "COMPLETED";
  startAt: string;
  endAt: string;
  currentStep: number;
  steps: {
    step1: ImprovementCycleStep;
    step2: ImprovementCycleStep;
    step3: ImprovementCycleStep;
    step4: ImprovementCycleStep;
  };
  metrics: {
    beforeScore: { main: number | null; branch: number | null; gap: number | null };
    afterScore: { main: number | null; branch: number | null; gap: number | null };
    gapChange: number | null;
    aiEvaluation: {
      summary: string | null;
      recommendations: string[];
    };
  };
};

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "--";
  return Number(score).toFixed(1);
}

function StepBox({
  stepNumber,
  title,
  status,
  detail,
}: {
  stepNumber: number;
  title: string;
  status: "COMPLETED" | "IN_PROGRESS" | "WAITING";
  detail: string;
}) {
  const isDone = status === "COMPLETED";
  const isInProgress = status === "IN_PROGRESS";

  return (
    <div className={`cycle-quadrant ${isDone ? "is-done" : isInProgress ? "is-active" : "is-waiting"}`}>
      <div className="quadrant-header">
        <span className="step-num">{stepNumber}</span>
        {isDone ? (
          <span className="step-badge done" title="Đã hoàn thành">
            <Check size={13} strokeWidth={3} />
          </span>
        ) : isInProgress ? (
          <span className="step-badge active" title="Đang diễn ra">
            <Clock size={13} strokeWidth={2.5} />
          </span>
        ) : (
          <span className="step-badge wait" title="Chờ thực hiện">
            ·
          </span>
        )}
      </div>
      <div className="quadrant-content">
        <span className="step-label">{title}</span>
        <span className="step-detail">{detail}</span>
      </div>
    </div>
  );
}

export function CycleSquareCard({
  cycle,
  onClick,
}: {
  cycle: ImprovementCycleData;
  onClick: () => void;
}) {
  const statusLabels: Record<string, { label: string; variant: "neutral" | "info" | "success" | "warning" }> = {
    DRAFT: { label: "Nháp", variant: "neutral" },
    UPCOMING: { label: "Sắp diễn ra", variant: "info" },
    LIVE: { label: "Đang diễn ra", variant: "success" },
    COMPLETED: { label: "Đã hoàn thành", variant: "warning" },
  };

  const statusConfig = statusLabels[cycle.status] ?? { label: cycle.status, variant: "neutral" };

  return (
    <div
      className="cycle-square-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="cycle-card-top">
        <div className="cycle-card-heading">
          <h3 className="cycle-title" title={cycle.title}>{cycle.title}</h3>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
        <div className="cycle-meta">
          <span>Chu kỳ 4 bước khép kín</span>
          <span className="cycle-view-hint">
            Chi tiết <ChevronRight size={14} />
          </span>
        </div>
      </div>

      {/* 2x2 Quadrant Grid: | 1 2 | / | 3 4 | */}
      <div className="cycle-quadrant-grid">
        <StepBox
          stepNumber={1}
          title="Khảo sát đầu"
          status={cycle.steps.step1.status}
          detail={`${cycle.steps.step1.responsesCount ?? 0} phản hồi`}
        />
        <StepBox
          stepNumber={2}
          title="Phân tích AI"
          status={cycle.steps.step2.status}
          detail={cycle.steps.step2.status === "COMPLETED" ? `${cycle.steps.step2.recommendationsCount ?? 0} đề xuất` : "Đang chờ"}
        />
        <StepBox
          stepNumber={3}
          title="Tổ chức SK"
          status={cycle.steps.step3.status}
          detail={`${cycle.steps.step3.participantsCount ?? 0} tham gia`}
        />
        <StepBox
          stepNumber={4}
          title="Đánh giá sau"
          status={cycle.steps.step4.status}
          detail={`${cycle.steps.step4.responsesCount ?? 0} phản hồi`}
        />
      </div>

      <div className="cycle-card-footer">
        <div className="cycle-score-snippet">
          <span>Trước: Điểm chính <strong>{formatScore(cycle.metrics.beforeScore.main)}</strong> / Phân hiệu <strong>{formatScore(cycle.metrics.beforeScore.branch)}</strong></span>
        </div>
        {cycle.metrics.gapChange !== null && (
          <div className="cycle-gap-badge">
            Thu hẹp: <strong>{cycle.metrics.gapChange > 0 ? `+${cycle.metrics.gapChange}` : cycle.metrics.gapChange}đ</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewCycleSquareCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="cycle-square-card is-create-placeholder"
      onClick={onClick}
    >
      <div className="create-placeholder-body">
        <div className="create-icon-bubble">
          <Plus size={28} />
        </div>
        <h4>Thêm hoạt động cải thiện</h4>
        <p>Bắt đầu chu kỳ 4 bước mới: Khảo sát → AI Phân tích → Sự kiện → Đánh giá sau</p>
      </div>
    </button>
  );
}

export function CycleDetailModal({
  cycle,
  onClose,
  onCreateNextAction,
}: {
  cycle: ImprovementCycleData | null;
  onClose: () => void;
  onCreateNextAction?: (title: string, summary: string) => void;
}) {
  if (!cycle) return null;

  const beforeMain = cycle.metrics.beforeScore.main;
  const beforeBranch = cycle.metrics.beforeScore.branch;
  const beforeGap = cycle.metrics.beforeScore.gap;

  const afterMain = cycle.metrics.afterScore.main;
  const afterBranch = cycle.metrics.afterScore.branch;
  const afterGap = cycle.metrics.afterScore.gap;

  const gapReduced =
    beforeGap !== null && afterGap !== null ? Math.round((beforeGap - afterGap) * 10) / 10 : null;

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" type="button" aria-label="Đóng hộp thoại" onClick={onClose} />
      <section className="modal cycle-modal-wide" role="dialog" aria-modal="true" aria-labelledby="cycle-modal-title">
        <div className="modal-header">
          <div>
            <h2 id="cycle-modal-title">Chi tiết chu kỳ: {cycle.title}</h2>
            <p className="modal-subtitle">Tiến trình 4 bước khép kín, đo lường điểm hài lòng trước & sau, cùng đánh giá và đề xuất tiếp theo từ AI</p>
          </div>
          <button className="icon-button" type="button" aria-label="Đóng" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="cycle-detail-body">
          {/* Visual 4-step Stepper */}
          <div className="cycle-detail-stepper">
            <div className={`stepper-node ${cycle.steps.step1.status === "COMPLETED" ? "is-done" : "is-active"}`}>
              <span className="node-num">01</span>
              <div className="node-text">
                <strong>Khảo sát ban đầu</strong>
                <span>{cycle.steps.step1.surveyTitle || "Khảo sát thực trạng"}</span>
                <small>{cycle.steps.step1.responsesCount ?? 0} lượt phản hồi</small>
              </div>
            </div>
            <ArrowRight className="stepper-arrow" size={18} />

            <div className={`stepper-node ${cycle.steps.step2.status === "COMPLETED" ? "is-done" : cycle.steps.step2.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
              <span className="node-num">02</span>
              <div className="node-text">
                <strong>Phân tích AI</strong>
                <span>{cycle.steps.step2.summary ? "Đã có báo cáo" : "Chờ phân tích"}</span>
                <small>{cycle.steps.step2.recommendationsCount ?? 0} đề xuất giải pháp</small>
              </div>
            </div>
            <ArrowRight className="stepper-arrow" size={18} />

            <div className={`stepper-node ${cycle.steps.step3.status === "COMPLETED" ? "is-done" : cycle.steps.step3.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
              <span className="node-num">03</span>
              <div className="node-text">
                <strong>Tổ chức sự kiện</strong>
                <span>{cycle.title}</span>
                <small>{cycle.steps.step3.participantsCount ?? 0} học sinh xác nhận</small>
              </div>
            </div>
            <ArrowRight className="stepper-arrow" size={18} />

            <div className={`stepper-node ${cycle.steps.step4.status === "COMPLETED" ? "is-done" : cycle.steps.step4.status === "IN_PROGRESS" ? "is-active" : "is-waiting"}`}>
              <span className="node-num">04</span>
              <div className="node-text">
                <strong>Đánh giá sau sự kiện</strong>
                <span>{cycle.steps.step4.surveyTitle || "Khảo sát sau"}</span>
                <small>{cycle.steps.step4.responsesCount ?? 0} lượt phản hồi</small>
              </div>
            </div>
          </div>

          {/* Before & After Comparison Table / Cards */}
          <div className="cycle-comparison-block">
            <h4 className="detail-section-title">
              Điểm hài lòng hai cơ sở: Trước và Sau khi tham gia
            </h4>
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
                  <span>Chênh lệch cơ sở:</span>
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
                  <span>Chênh lệch còn:</span>
                  <strong>{afterGap !== null ? `${afterGap} điểm` : "--"}</strong>
                </div>
              </div>
            </div>

            {gapReduced !== null && (
              <div className={`gap-reduction-banner ${gapReduced > 0 ? "positive" : "neutral"}`}>
                {gapReduced > 0 ? (
                  <span>
                    🎉 Sự kiện đã giúp <strong>thu hẹp {gapReduced} điểm</strong> khoảng cách giữa Phân hiệu và Điểm chính!
                  </span>
                ) : (
                  <span>
                    Khoảng cách giữa hai cơ sở có sự thay đổi {gapReduced} điểm sau khi tổ chức sự kiện.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* AI Evaluation & Next Recommendations */}
          <div className="cycle-ai-block">
            <div className="ai-block-header">
              <Sparkles size={18} className="ai-icon" />
              <h4 className="detail-section-title" style={{ margin: 0 }}>
                Đánh giá và Đề xuất từ AI sau khi kết thúc
              </h4>
            </div>

            <div className="ai-evaluation-box">
              {cycle.metrics.aiEvaluation.summary ? (
                <p className="ai-summary">{cycle.metrics.aiEvaluation.summary}</p>
              ) : (
                <p className="ai-summary" style={{ fontStyle: "italic", color: "var(--color-muted)" }}>
                  Chưa có phân tích AI cho chu kỳ này.
                </p>
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

          {/* Footer Actions */}
          <div className="cycle-detail-actions">
            {onCreateNextAction && cycle.metrics.aiEvaluation.recommendations.length > 0 && (
              <Button
                icon={<Sparkles size={16} />}
                onClick={() => {
                  onCreateNextAction(
                    `Cải thiện tiếp nối: ${cycle.title}`,
                    cycle.metrics.aiEvaluation.recommendations[0],
                  );
                }}
              >
                Mở chu kỳ mới từ đề xuất AI
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AllCyclesModal({
  open,
  cycles,
  onClose,
  onSelectCycle,
  onCreateNewCycle,
}: {
  open: boolean;
  cycles: ImprovementCycleData[];
  onClose: () => void;
  onSelectCycle: (cycle: ImprovementCycleData) => void;
  onCreateNewCycle: () => void;
}) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" type="button" aria-label="Đóng hộp thoại" onClick={onClose} />
      <section className="modal cycle-modal-wide" role="dialog" aria-modal="true" aria-labelledby="all-cycles-title">
        <div className="modal-header">
          <div>
            <h2 id="all-cycles-title">Tất cả các chu kỳ cải thiện (Tiến trình 4 bước)</h2>
            <p className="modal-subtitle">Lịch sử toàn bộ các hoạt động kết nối và cải thiện chất lượng giáo dục giữa Điểm chính và Phân hiệu</p>
          </div>
          <button className="icon-button" type="button" aria-label="Đóng" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="all-cycles-container">
          <div className="all-cycles-header-row">
            <p className="cycles-count-label">
              Tổng cộng <strong>{cycles.length}</strong> chu kỳ hoạt động
            </p>
            <Button
              size="small"
              icon={<Plus size={16} />}
              onClick={() => {
                onClose();
                onCreateNewCycle();
              }}
            >
              Tạo hoạt động mới
            </Button>
          </div>

          <div className="all-cycles-grid">
            {cycles.map((c) => (
              <CycleSquareCard
                key={c.id}
                cycle={c}
                onClick={() => {
                  onClose();
                  onSelectCycle(c);
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
