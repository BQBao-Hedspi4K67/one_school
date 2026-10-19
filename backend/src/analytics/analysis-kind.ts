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
    'Thống kê câu hỏi chỉ gồm câu chọn một, chọn nhiều và thang điểm; câu tự luận cùng câu trả lời tự luận đã được loại khỏi dữ liệu. ' +
    'Mỗi count là số lượt chọn phương án tại cơ sở tương ứng; với câu chọn nhiều, một học sinh có thể chọn nhiều phương án nên tổng lượt chọn có thể lớn hơn số phản hồi. ' +
    'Trả về JSON gồm title (chuỗi), summary (chuỗi) và recommendations (mảng 3-5 chuỗi khuyến nghị cụ thể, khả thi).';

  if (kind === 'EFFECTIVENESS') {
    return (
      `${common} Bạn đang phân tích khảo sát sau một hoạt động giáo dục. ` +
      'Dựa trên thống kê câu trả lời và điểm hài lòng sau sự kiện theo từng tiêu chí có tên cụ thể, ' +
      'nhận xét sự khác biệt giữa Điểm chính và Phân hiệu, nêu điểm mạnh và vấn đề cần cải thiện. ' +
      'Đề xuất 3-5 điều chỉnh cụ thể cho lần tổ chức tiếp theo. Không so sánh với điểm khảo sát trước sự kiện; khảo sát trước chỉ ghi nhận mong muốn.'
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
    `${common} Bạn đang đề xuất hướng tổ chức cho chương trình có tên trong dữ liệu. ` +
    'Dựa trên thống kê lựa chọn của học sinh cho từng câu hỏi, phân tích mong muốn nổi bật và khác biệt giữa Điểm chính, Phân hiệu. ' +
    'Đề xuất loại hoạt động, hình thức, thời lượng và nội dung phù hợp. Không gọi câu hỏi là tiêu chí và không suy diễn thành điểm hài lòng.'
  );
}
