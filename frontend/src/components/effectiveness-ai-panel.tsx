import { RefreshCw, Sparkles } from "lucide-react";
import { Button, EmptyState } from "./ui";

export function EffectivenessAiPanel({
  summary,
  recommendations,
  hasResponses,
  analyzing = false,
  canRetry = false,
  error,
  emptyDescription,
  onRunAnalysis,
}: {
  summary: string | null;
  recommendations: string[];
  hasResponses: boolean;
  analyzing?: boolean;
  canRetry?: boolean;
  error?: string;
  emptyDescription?: string;
  onRunAnalysis?: () => void;
}) {
  return (
    <div className="cycle-ai-block evaluation">
      <div className="ai-block-header">
        <Sparkles size={20} className="ai-icon" />
        <div>
          <h3 className="section-title-sm" style={{ margin: 0 }}>
            AI đánh giá hiệu quả (lần 2)
          </h3>
          <p className="ai-stage-hint">
            So sánh kết quả trước – sau, tính mức hài lòng và đề xuất chu kỳ cải
            thiện tiếp theo. Chạy được khi cả hai khảo sát đều có phản hồi.
          </p>
        </div>
      </div>
      <div className="ai-evaluation-box">
        {summary ? (
          <p className="ai-summary">{summary}</p>
        ) : (
          <EmptyState
            title="Chưa có đánh giá AI cho chu kỳ này"
            description={
              emptyDescription ??
              (hasResponses
                ? "Cả hai khảo sát đều đã có phản hồi. Chạy AI để đánh giá hiệu quả và nhận đề xuất cho chu kỳ tiếp theo."
                : "Cần tối thiểu 1 phản hồi cho khảo sát trước và 1 phản hồi cho khảo sát sau sự kiện trước khi chạy AI đánh giá.")
            }
            compact
          />
        )}
        {recommendations.length > 0 && (
          <div className="ai-recs-list">
            <span className="recs-title">
              Khuyến nghị cho chu kỳ cải thiện tiếp theo:
            </span>
            <ul>
              {recommendations.map((recommendation, index) => (
                <li key={`${index}-${recommendation}`}>{recommendation}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p className="insight-warning" role="alert">
            {error}
          </p>
        )}
        <div className="page-header-actions">
          {onRunAnalysis && (
            <Button
              icon={<RefreshCw size={15} />}
              loading={analyzing}
              disabled={!hasResponses || analyzing}
              onClick={onRunAnalysis}
            >
              {canRetry || summary
                ? "Chạy lại đánh giá AI"
                : "Đánh giá hiệu quả bằng AI"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
