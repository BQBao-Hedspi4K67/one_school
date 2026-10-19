import { useState } from 'react';

export type CriterionComparisonData = {
  criterionId?: string;
  criterionName: string;
  mainScore: number | null;
  branchScore: number | null;
  gap: number | null;
  responseCount: { MAIN: number; BRANCH: number };
};

export type QuestionBreakdownData = {
  questionId: string;
  questionText: string;
  criterionName: string;
  mainDistribution: Array<{ label: string; count: number }>;
  branchDistribution: Array<{ label: string; count: number }>;
};

export type EffectivenessData = {
  available: boolean;
  before: { main: number | null; branch: number | null; gap: number | null };
  after: { main: number | null; branch: number | null; gap: number | null };
  changeByCampus: {
    main: number | null;
    branch: number | null;
    gap: number | null;
  };
  byCriterion: Array<{
    criterionName: string;
    before: { main: number | null; branch: number | null; gap: number | null };
    after: { main: number | null; branch: number | null; gap: number | null };
    changeByCampus: {
      main: number | null;
      branch: number | null;
      gap: number | null;
    };
  }>;
};

/**
 * Biểu đồ cột nhóm (Grouped Bar Chart) so sánh điểm số theo tiêu chí giữa Điểm chính và Phân hiệu
 * Có hệ trục tọa độ 0 - 100, vạch chia lưới, hiển thị giá trị và chênh lệch (gap)
 */
export function CriterionBarChart({
  data,
  showSummaryTable = true,
}: {
  data: CriterionComparisonData[];
  showSummaryTable?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const chartHeight = 260;
  const topPadding = 35;
  const plotBottom = chartHeight - 20;
  const plotHeight = plotBottom - topPadding;
  const chartWidth = Math.max(600, data.length * 190);
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="criterion-chart-container">
      <div className="criterion-chart-legend">
        <div className="legend-item">
          <span className="legend-color legend-indigo" />
          <span className="legend-label">Điểm chính (MAIN)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color legend-teal" />
          <span className="legend-label">Phân hiệu (BRANCH)</span>
        </div>
      </div>

      <div
        className="svg-chart-wrapper"
        style={{ height: chartHeight + 60, minWidth: 0 }}
      >
        <svg
          className="svg-grouped-bar-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight + 60}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Biểu đồ cột so sánh điểm hài lòng theo từng tiêu chí giữa Điểm chính (MAIN) và Phân hiệu (BRANCH), thang điểm 0 đến 100"
          style={{ minWidth: chartWidth }}
        >
          {/* Y-axis gridlines & labels */}
          {yTicks.map((tick) => {
            const y = plotBottom - (tick / 100) * plotHeight;
            return (
              <g key={tick} className="grid-line-group">
                <line
                  x1="45"
                  y1={y}
                  x2={chartWidth - 15}
                  y2={y}
                  className="chart-grid-line"
                />
                <text x="35" y={y + 4} textAnchor="end" className="chart-y-axis-label">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Grouped Bars per Criterion */}
          {data.map((item, idx) => {
            const totalWidth = chartWidth - 60;
            const groupWidth = totalWidth / data.length;
            const groupX = 50 + idx * groupWidth;
            const barWidth = Math.min(38, groupWidth * 0.28);
            const gapBetweenBars = 8;
            const centerX = groupX + groupWidth / 2;

            const mainScore = item.mainScore ?? 0;
            const branchScore = item.branchScore ?? 0;

            const mainBarHeight = item.mainScore !== null ? (mainScore / 100) * plotHeight : 0;
            const branchBarHeight = item.branchScore !== null ? (branchScore / 100) * plotHeight : 0;

            const mainBarY = plotBottom - mainBarHeight;
            const branchBarY = plotBottom - branchBarHeight;

            const mainBarX = centerX - barWidth - gapBetweenBars / 2;
            const branchBarX = centerX + gapBetweenBars / 2;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.criterionId}
                className={`chart-bar-group ${isHovered ? 'is-active' : ''}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Background column highlight on hover */}
                {isHovered && (
                  <rect
                    x={groupX + 6}
                    y={topPadding - 12}
                    width={groupWidth - 12}
                    height={plotHeight + 24}
                    className="chart-group-hover-bg"
                    rx={8}
                  />
                )}

                {/* Main campus bar */}
                {item.mainScore !== null && (
                  <>
                    <rect
                      x={mainBarX}
                      y={mainBarY}
                      width={barWidth}
                      height={mainBarHeight}
                      className="bar-rect bar-rect-indigo"
                      rx={5}
                    />
                    <text
                      x={mainBarX + barWidth / 2}
                      y={mainBarY - 6}
                      textAnchor="middle"
                      className="bar-value-label"
                    >
                      {item.mainScore}
                    </text>
                  </>
                )}

                {/* Branch campus bar */}
                {item.branchScore !== null && (
                  <>
                    <rect
                      x={branchBarX}
                      y={branchBarY}
                      width={barWidth}
                      height={branchBarHeight}
                      className="bar-rect bar-rect-teal"
                      rx={5}
                    />
                    <text
                      x={branchBarX + barWidth / 2}
                      y={branchBarY - 6}
                      textAnchor="middle"
                      className="bar-value-label"
                    >
                      {item.branchScore}
                    </text>
                  </>
                )}

                {/* Criterion name on X-axis */}
                <text
                  x={centerX}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="chart-x-axis-label"
                >
                  {item.criterionName.length > 20
                    ? `${item.criterionName.slice(0, 18)}...`
                    : item.criterionName}
                </text>

                {/* Gap Pill Badge */}
                {item.gap !== null && (
                  <g transform={`translate(${centerX}, ${chartHeight + 36})`}>
                    <rect
                      x="-38"
                      y="-12"
                      width="76"
                      height="20"
                      rx="10"
                      className={`gap-badge-bg ${
                        Math.abs(item.gap) > 10 ? 'gap-high' : 'gap-normal'
                      }`}
                    />
                    <text
                      x="0"
                      y="2"
                      textAnchor="middle"
                      className="gap-badge-text"
                    >
                      {item.gap >= 0 ? `+${item.gap}` : item.gap} điểm
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Summary table below chart for clarity */}
      {showSummaryTable && (
        <div className="criterion-summary-table">
        {data.map((item) => (
          <div key={item.criterionId} className="criterion-summary-row">
            <span className="criterion-name">{item.criterionName}</span>
            <div className="criterion-scores">
              <span className="score-item score-indigo">
                Điểm chính: <strong>{item.mainScore !== null ? `${item.mainScore}/100` : '—'}</strong>
              </span>
              <span className="score-divider">·</span>
              <span className="score-item score-teal">
                Phân hiệu: <strong>{item.branchScore !== null ? `${item.branchScore}/100` : '—'}</strong>
              </span>
              {item.gap !== null && (
                <span className={`gap-indicator ${Math.abs(item.gap) >= 10 ? 'gap-warning' : ''}`}>
                  Chênh lệch: {item.gap >= 0 ? `+${item.gap}` : item.gap} điểm
                </span>
              )}
            </div>
            <span className="criterion-counts">
              ({item.responseCount.MAIN} HS chính / {item.responseCount.BRANCH} HS phân hiệu)
            </span>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

/**
 * Biểu đồ phân phối câu trả lời theo từng cơ sở (Question Distribution Chart)
 */
export function QuestionDistributionChart({
  question,
}: {
  question: QuestionBreakdownData;
}) {
  const allLabels = [
    ...new Set([
      ...question.mainDistribution.map((item) => item.label),
      ...question.branchDistribution.map((item) => item.label),
    ]),
  ];

  const totalMain = question.mainDistribution.reduce((sum, item) => sum + item.count, 0) || 1;
  const totalBranch = question.branchDistribution.reduce((sum, item) => sum + item.count, 0) || 1;

  const countFor = (items: Array<{ label: string; count: number }>, label: string) =>
    items.find((item) => item.label === label)?.count ?? 0;

  return (
    <div className="question-chart-card">
      <div className="question-chart-header">
        <h4 className="question-chart-title">{question.questionText}</h4>
        {question.criterionName && <span className="question-chart-criterion">{question.criterionName}</span>}
      </div>

      <div className="question-options-chart">
        {allLabels.map((label) => {
          const mainCount = countFor(question.mainDistribution, label);
          const branchCount = countFor(question.branchDistribution, label);

          const mainPercent = Math.round((mainCount / totalMain) * 100);
          const branchPercent = Math.round((branchCount / totalBranch) * 100);

          return (
            <div key={label} className="question-option-row">
              <div className="option-label-wrap">
                <span className="option-label">{label}</span>
              </div>
              <div className="option-bars-wrap">
                {/* Main campus bar */}
                <div className="option-bar-row">
                  <span className="campus-indicator-tag tag-indigo">Điểm chính</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill fill-indigo"
                      style={{ width: `${mainPercent}%` }}
                    />
                  </div>
                  <span className="option-stat-text">
                    {mainCount} ({mainPercent}%)
                  </span>
                </div>

                {/* Branch campus bar */}
                <div className="option-bar-row">
                  <span className="campus-indicator-tag tag-teal">Phân hiệu</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill fill-teal"
                      style={{ width: `${branchPercent}%` }}
                    />
                  </div>
                  <span className="option-stat-text">
                    {branchCount} ({branchPercent}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Biểu đồ so sánh Trước – Sau (Before and After Effectiveness Chart)
 */
export function EffectivenessComparisonChart({
  effectiveness,
}: {
  effectiveness: EffectivenessData;
}) {
  if (!effectiveness.available) {
    return null;
  }

  const { before, after, changeByCampus, byCriterion } = effectiveness;

  return (
    <div className="effectiveness-viz-container">
      {/* 3 Overview KPI Blocks */}
      <div className="effectiveness-kpi-row">
        <div className="eff-kpi-card eff-kpi-main">
          <span className="eff-kpi-title">Điểm chính (MAIN)</span>
          <div className="eff-kpi-values">
            <span className="eff-score-before">{before.main ?? '—'}</span>
            <span className="eff-arrow">→</span>
            <span className="eff-score-after">{after.main ?? '—'}</span>
            <span className="eff-max">/100</span>
          </div>
          {changeByCampus.main !== null && (
            <div
              className={`eff-change-badge ${
                changeByCampus.main >= 0 ? 'badge-gain' : 'badge-loss'
              }`}
            >
              {changeByCampus.main >= 0 ? `▲ Tăng +${changeByCampus.main}` : `▼ Giảm ${changeByCampus.main}`} điểm
            </div>
          )}
        </div>

        <div className="eff-kpi-card eff-kpi-branch">
          <span className="eff-kpi-title">Phân hiệu (BRANCH)</span>
          <div className="eff-kpi-values">
            <span className="eff-score-before">{before.branch ?? '—'}</span>
            <span className="eff-arrow">→</span>
            <span className="eff-score-after">{after.branch ?? '—'}</span>
            <span className="eff-max">/100</span>
          </div>
          {changeByCampus.branch !== null && (
            <div
              className={`eff-change-badge ${
                changeByCampus.branch >= 0 ? 'badge-gain' : 'badge-loss'
              }`}
            >
              {changeByCampus.branch >= 0 ? `▲ Tăng +${changeByCampus.branch}` : `▼ Giảm ${changeByCampus.branch}`} điểm
            </div>
          )}
        </div>

        <div className="eff-kpi-card eff-kpi-gap">
          <span className="eff-kpi-title">Khoảng cách chênh lệch</span>
          <div className="eff-kpi-values">
            <span className="eff-score-before">{before.gap !== null ? `${before.gap}đ` : '—'}</span>
            <span className="eff-arrow">→</span>
            <span className="eff-score-after">{after.gap !== null ? `${after.gap}đ` : '—'}</span>
          </div>
          {changeByCampus.gap !== null && (
            <div
              className={`eff-change-badge ${
                changeByCampus.gap <= 0 ? 'badge-gain' : 'badge-loss'
              }`}
            >
              {changeByCampus.gap <= 0
                ? `✓ Thu hẹp ${Math.abs(changeByCampus.gap)} điểm`
                : `! Tăng chênh lệch ${changeByCampus.gap} điểm`}
            </div>
          )}
        </div>
      </div>

      {/* Criterion-level Before vs After visual bars */}
      <div className="effectiveness-criteria-breakdown">
        <h4 className="eff-breakdown-heading">Chi tiết thay đổi theo từng tiêu chí</h4>
        <div className="eff-criteria-grid">
          {byCriterion.map((item) => {
            const mainChange = item.changeByCampus.main ?? 0;
            const branchChange = item.changeByCampus.branch ?? 0;
            const gapChange = item.changeByCampus.gap ?? 0;

            return (
              <div key={item.criterionName} className="eff-criterion-card">
                <div className="eff-criterion-header">
                  <strong>{item.criterionName}</strong>
                  <span className={`gap-status ${gapChange <= 0 ? 'is-reduced' : 'is-expanded'}`}>
                    {gapChange <= 0 ? `Thu hẹp ${Math.abs(gapChange)}đ` : `Tăng chênh lệch ${gapChange}đ`}
                  </span>
                </div>

                <div className="eff-criterion-bars">
                  {/* Main campus before -> after */}
                  <div className="eff-bar-group">
                    <div className="eff-bar-meta">
                      <span className="campus-dot dot-indigo" />
                      <span>Điểm chính</span>
                      <strong className="eff-values-text">
                        {item.before.main ?? '—'} → {item.after.main ?? '—'}
                      </strong>
                      <span className={`eff-tag ${mainChange >= 0 ? 'tag-gain' : 'tag-loss'}`}>
                        {mainChange >= 0 ? `+${mainChange}` : mainChange}
                      </span>
                    </div>
                    <div className="eff-dual-track">
                      <div
                        className="eff-track-before fill-indigo-dim"
                        style={{ width: `${item.before.main ?? 0}%` }}
                        title={`Trước: ${item.before.main}`}
                      />
                      <div
                        className="eff-track-after fill-indigo"
                        style={{ width: `${item.after.main ?? 0}%` }}
                        title={`Sau: ${item.after.main}`}
                      />
                    </div>
                  </div>

                  {/* Branch campus before -> after */}
                  <div className="eff-bar-group">
                    <div className="eff-bar-meta">
                      <span className="campus-dot dot-teal" />
                      <span>Phân hiệu</span>
                      <strong className="eff-values-text">
                        {item.before.branch ?? '—'} → {item.after.branch ?? '—'}
                      </strong>
                      <span className={`eff-tag ${branchChange >= 0 ? 'tag-gain' : 'tag-loss'}`}>
                        {branchChange >= 0 ? `+${branchChange}` : branchChange}
                      </span>
                    </div>
                    <div className="eff-dual-track">
                      <div
                        className="eff-track-before fill-teal-dim"
                        style={{ width: `${item.before.branch ?? 0}%` }}
                        title={`Trước: ${item.before.branch}`}
                      />
                      <div
                        className="eff-track-after fill-teal"
                        style={{ width: `${item.after.branch ?? 0}%` }}
                        title={`Sau: ${item.after.branch}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Biểu đồ tròn tiến độ hoàn thành (Circular Progress / Donut)
 */
export function CampusCompletionDonut({
  label,
  percentage,
  count,
  tone,
}: {
  label: string;
  percentage: number | null;
  count: number;
  tone: 'indigo' | 'teal';
}) {
  const size = 110;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = percentage !== null ? Math.min(100, Math.max(0, percentage)) : 0;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  const colorClass = tone === 'indigo' ? 'stroke-indigo' : 'stroke-teal';

  return (
    <div className={`campus-donut-card donut-${tone}`} role="img" aria-label={`${label}: ${percentage !== null ? `${percentage}%` : 'chưa có dữ liệu'}, ${count} học sinh phản hồi`}>
      <div className="donut-svg-wrap" aria-hidden="true">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="donut-bg-circle"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          {percentage !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className={`donut-progress-circle ${colorClass}`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <div className="donut-center-text">
          <strong className="donut-number">
            {percentage !== null ? `${percentage}%` : '—'}
          </strong>
        </div>
      </div>

      <div className="donut-info">
        <h4 className="donut-campus-name">{label}</h4>
        <p className="donut-count">{count} học sinh phản hồi</p>
        <span className="donut-rate-tag">
          {percentage !== null && percentage >= 70
            ? 'Đạt chỉ tiêu phản hồi'
            : 'Đang tiếp tục thu thập'}
        </span>
      </div>
    </div>
  );
}
