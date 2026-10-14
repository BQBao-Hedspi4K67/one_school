import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button, EmptyState } from "./ui";

export function BaselineAiPanel({
  summary,
  recommendations,
  hasResponses,
  analyzing = false,
  canRetry = false,
  error,
  emptyDescription,
  onRunAnalysis,
  onCreateEvent,
}: {
  summary: string | null;
  recommendations: string[];
  hasResponses: boolean;
  analyzing?: boolean;
  canRetry?: boolean;
  error?: string;
  emptyDescription?: string;
  onRunAnalysis?: () => void;
  onCreateEvent?: () => void;
}) {
  return (
    <div className="cycle-ai-block">
      <div className="ai-block-header">
        <Sparkles size={20} className="ai-icon" />
        <div>
          <h3 className="section-title-sm" style={{ margin: 0 }}>
            Phân tích AI thực trạng (lần 1)
          </h3>
          <p className="ai-stage-hint">
            Phân tích vấn đề theo tiêu chí và cơ sở, kèm đề xuất hoạt động khả
            thi.
          </p>
        </div>
      </div>
      <div className="ai-evaluation-box">
        {summary ? (
          <p className="ai-summary">{summary}</p>
        ) : (
          <EmptyState
            title="Chưa có phân tích AI thực trạng"
            description={
              emptyDescription ??
              (hasResponses
                ? "Khảo sát đã có phản hồi. Chạy AI để xem các vấn đề nổi bật và đề xuất hoạt động."
                : "Học sinh cần gửi phản hồi khảo sát trước khi chạy phân tích.")
            }
            compact
          />
        )}
        {recommendations.length > 0 && (
          <div className="ai-recs-list">
            <span className="recs-title">Đề xuất hoạt động:</span>
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
                ? "Chạy lại phân tích AI"
                : "Phân tích thực trạng bằng AI"}
            </Button>
          )}
          {onCreateEvent && recommendations.length > 0 && (
            <Button
              variant="secondary"
              icon={<Plus size={15} />}
              onClick={onCreateEvent}
            >
              Tạo sự kiện theo đề xuất
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
