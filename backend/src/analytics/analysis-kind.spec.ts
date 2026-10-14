import {
  ANALYSIS_KINDS,
  analysisSystemPrompt,
  isAnalysisKind,
  resolveAnalysisKind,
} from './analysis-kind';

describe('analysis kind (dashboard overview and cycle stages are distinct)', () => {
  it('exposes separate overview and cycle analysis stages', () => {
    expect(ANALYSIS_KINDS).toEqual(['BASELINE', 'EFFECTIVENESS', 'OVERVIEW']);
    expect(isAnalysisKind('BASELINE')).toBe(true);
    expect(isAnalysisKind('EFFECTIVENESS')).toBe(true);
    expect(isAnalysisKind('OVERVIEW')).toBe(true);
    expect(isAnalysisKind('SUMMARY')).toBe(false);
    expect(isAnalysisKind(undefined)).toBe(false);
  });

  it('defaults to BASELINE without eventId and EFFECTIVENESS with eventId', () => {
    expect(resolveAnalysisKind(undefined, false)).toBe('BASELINE');
    expect(resolveAnalysisKind(undefined, true)).toBe('EFFECTIVENESS');
  });

  it('keeps the explicitly requested stage', () => {
    expect(resolveAnalysisKind('BASELINE', true)).toBe('BASELINE');
    expect(resolveAnalysisKind('EFFECTIVENESS', false)).toBe('EFFECTIVENESS');
  });

  it('prompts for problems & activities after the baseline survey', () => {
    const prompt = analysisSystemPrompt('BASELINE');
    expect(prompt).toContain('khảo sát ban đầu');
    expect(prompt).toContain('recommendations');
    expect(prompt).toContain('không suy đoán danh tính');
  });

  it('prompts for before/after effectiveness and next cycle after the full cycle', () => {
    const prompt = analysisSystemPrompt('EFFECTIVENESS');
    expect(prompt).toContain('trước và sau sự kiện');
    expect(prompt).toContain('chu kỳ mới');
    expect(prompt).toContain('recommendations');
  });

  it('prompts for a school-wide comparison without conflating event effectiveness', () => {
    const prompt = analysisSystemPrompt('OVERVIEW');
    expect(prompt).toContain('tổng quan toàn trường');
    expect(prompt).toContain('tất cả khảo sát đã công bố');
    expect(prompt).toContain('Không đánh giá hiệu quả một sự kiện cụ thể');
  });

  it('gives different instructions for all three analysis contexts', () => {
    expect(analysisSystemPrompt('BASELINE')).not.toBe(
      analysisSystemPrompt('EFFECTIVENESS'),
    );
    expect(analysisSystemPrompt('BASELINE')).not.toBe(
      analysisSystemPrompt('OVERVIEW'),
    );
    expect(analysisSystemPrompt('OVERVIEW')).not.toBe(
      analysisSystemPrompt('EFFECTIVENESS'),
    );
  });
});
