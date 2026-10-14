import { Check, Clock, Plus, ChevronRight } from "lucide-react";
import { Badge } from "./ui";
import { eventStatusBadge } from "../event-status";

export type ImprovementCycleStep = {
  name: string;
  status: "COMPLETED" | "IN_PROGRESS" | "WAITING";
  responsesCount?: number;
  participantsCount?: number;
  recommendationsCount?: number;
  summary?: string | null;
  recommendations?: string[];
  surveyId?: string | null;
  surveyTitle?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  coverImageUrl?: string | null;
  analysisId?: string | null;
  updatedAt?: string | null;
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
    /** Bước 05: AI đánh giá hiệu quả sau khi toàn bộ chu trình kết thúc */
    step5: ImprovementCycleStep;
  };
  metrics: {
    beforeScore: { main: number | null; branch: number | null; gap: number | null };
    afterScore: { main: number | null; branch: number | null; gap: number | null };
    gapChange: number | null;
    aiEvaluation: {
      analysisId?: string | null;
      status?: string | null;
      updatedAt?: string | null;
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
  // Nhãn trạng thái bám theo thời gian thực của sự kiện.
  const statusConfig = eventStatusBadge(cycle);

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
          <span>Chu kỳ 5 bước khép kín</span>
          <span className="cycle-view-hint">
            Chi tiết <ChevronRight size={14} />
          </span>
        </div>
      </div>

      {/* Five steps are shown in equal-sized cells in a two-column grid. */}
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
          title="Khảo sát sau"
          status={cycle.steps.step4.status}
          detail={`${cycle.steps.step4.responsesCount ?? 0} phản hồi`}
        />
        {/* AI áp dụng lần 2: sau khi toàn bộ chu trình kết thúc */}
        <StepBox
          stepNumber={5}
          title="AI đánh giá"
          status={cycle.steps.step5?.status ?? "WAITING"}
          detail={
            (cycle.steps.step5?.status ?? "WAITING") === "COMPLETED"
              ? `${cycle.steps.step5?.recommendationsCount ?? 0} đề xuất cho chu kỳ tiếp theo`
              : (cycle.steps.step5?.status ?? "WAITING") === "IN_PROGRESS"
                ? "Đang phân tích hiệu quả"
                : "Chờ khảo sát sau sự kiện"
          }
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
        <p>Bắt đầu chu kỳ 5 bước mới: Khảo sát → AI phân tích → Sự kiện → Khảo sát sau → AI đánh giá</p>
      </div>
    </button>
  );
}
