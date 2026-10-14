/**
 * AI có ba ngữ cảnh độc lập:
 *  - BASELINE: ngay sau khi kết thúc khảo sát trước (bước 02) — nêu vấn đề theo
 *    tiêu chí/cơ sở và đề xuất hoạt động.
 *  - EFFECTIVENESS: sau khi toàn bộ chu trình kết thúc (bước 05) — so sánh trước
 *    – sau, đánh giá hiệu quả và đề xuất bước cải thiện tiếp theo.
 *  - OVERVIEW: dashboard tổng quan theo bảng so sánh tiêu chí giữa hai cơ sở.
 */
export const ANALYSIS_KINDS = [
  'BASELINE',
  'EFFECTIVENESS',
  'OVERVIEW',
] as const;

export type AnalysisKind = (typeof ANALYSIS_KINDS)[number];

export function isAnalysisKind(value: unknown): value is AnalysisKind {
  return (
    typeof value === 'string' &&
    (ANALYSIS_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Không truyền kind → suy luận theo ngữ cảnh:
 * có eventId (đang đứng ở một chu kỳ) → EFFECTIVENESS, còn lại → BASELINE.
 */
export function resolveAnalysisKind(
  requested: AnalysisKind | undefined,
  hasEventId: boolean,
): AnalysisKind {
  if (requested && isAnalysisKind(requested)) return requested;
  return hasEventId ? 'EFFECTIVENESS' : 'BASELINE';
}

export function analysisSystemPrompt(kind: AnalysisKind): string {
  const common =
    'Bạn là trợ lý phân tích khảo sát giáo dục của trường THCS có hai cơ sở (Điểm chính và Phân hiệu). ' +
    'Chỉ dùng dữ liệu aggregate được cung cấp, không suy đoán danh tính hay thông tin cá nhân. ' +
    'Trả về JSON gồm title (chuỗi), summary (chuỗi) và recommendations (mảng 3-5 chuỗi khuyến nghị cụ thể, khả thi).';

  if (kind === 'EFFECTIVENESS') {
    return (
      `${common} Bạn đang ở bước đánh giá hiệu quả sau khi toàn bộ chu trình kết thúc: ` +
      'so sánh điểm hài lòng trước và sau sự kiện theo từng cơ sở và theo từng tiêu chí, ' +
      'nhận xét khoảng cách giữa hai cơ sở đã thu hẹp hay chưa, đánh giá mức độ hiệu quả của hoạt động, ' +
      'và đề xuất bước cải thiện tiếp theo để mở ra chu kỳ mới.'
    );
  }

  if (kind === 'OVERVIEW') {
    return (
      `${common} Bạn đang phân tích tổng quan toàn trường dựa trên bảng so sánh ` +
      'điểm theo từng tiêu chí giữa Điểm chính và Phân hiệu từ tất cả khảo sát đã công bố. ' +
      'Tập trung giải thích tiêu chí có chênh lệch đáng chú ý, nhận định điểm mạnh/yếu của mỗi cơ sở, ' +
      'và đề xuất ưu tiên cải thiện ở cấp trường. Không đánh giá hiệu quả một sự kiện cụ thể hay đề xuất chu kỳ tiếp theo.'
    );
  }

  return (
    `${common} Bạn đang ở bước phân tích ngay sau khi khảo sát ban đầu (khảo sát thực trạng) kết thúc: ` +
    'chỉ ra vấn đề nổi bật theo từng tiêu chí, nêu rõ chênh lệch giữa Điểm chính và Phân hiệu, ' +
    'và đề xuất hoạt động/sự kiện cụ thể để thu hẹp khoảng cách.'
  );
}
