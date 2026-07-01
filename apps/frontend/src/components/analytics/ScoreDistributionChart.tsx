import { useId } from "react";
import type { DistributionBand } from "../../types/analytics";

type ScoreDistributionChartProps = {
  distribution: DistributionBand[];
  /** Mean score as a percentage of the max — centers the bell curve. */
  meanPercentage: number;
  /** Standard deviation, expressed in percentage points. */
  stdDevPercentage: number;
  /** Number of submitted attempts (curve is scaled to this sample). */
  sampleCount: number;
};

const WIDTH = 520;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 40, left: 32 };
const PLOT_W = WIDTH - PADDING.left - PADDING.right;
const PLOT_H = HEIGHT - PADDING.top - PADDING.bottom;
const BAND_WIDTH = 20; // each distribution band spans 20 percentage points

/** Normal probability density at x for the given mean/std dev. */
function normalPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

export function ScoreDistributionChart({
  distribution,
  meanPercentage,
  stdDevPercentage,
  sampleCount,
}: ScoreDistributionChartProps) {
  const gradientId = useId();
  const maxCount = Math.max(1, ...distribution.map((b) => b.count));

  // Sample the (scaled) normal curve. Expected count in a band of width 20 is
  // n * 20 * pdf(x), so we plot that same quantity to overlay on the histogram.
  const showCurve = sampleCount >= 2 && stdDevPercentage > 0;
  const curvePoints: Array<{ x: number; y: number }> = [];
  if (showCurve) {
    for (let pct = 0; pct <= 100; pct += 2) {
      const expected = sampleCount * BAND_WIDTH * normalPdf(pct, meanPercentage, stdDevPercentage);
      curvePoints.push({ x: pct, y: expected });
    }
  }
  const curveMax = curvePoints.reduce((m, p) => Math.max(m, p.y), 0);
  const yMax = Math.max(maxCount, curveMax);

  const xForPct = (pct: number) => PADDING.left + (pct / 100) * PLOT_W;
  const yForVal = (val: number) => PADDING.top + PLOT_H - (val / yMax) * PLOT_H;

  const curvePath = curvePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xForPct(p.x).toFixed(1)} ${yForVal(p.y).toFixed(1)}`)
    .join(" ");

  const barGap = 8;
  const barWidth = PLOT_W / distribution.length - barGap;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Score distribution histogram with a normal-distribution curve overlay"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + PLOT_H}
          x2={PADDING.left + PLOT_W}
          y2={PADDING.top + PLOT_H}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth={1}
        />

        {/* Histogram bars */}
        {distribution.map((band, i) => {
          const x = PADDING.left + i * (PLOT_W / distribution.length) + barGap / 2;
          const h = (band.count / yMax) * PLOT_H;
          const y = PADDING.top + PLOT_H - h;
          return (
            <g key={band.label}>
              {band.count > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  rx={4}
                  fill={`url(#${gradientId})`}
                />
              )}
              {band.count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px] font-semibold dark:fill-slate-300"
                >
                  {band.count}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={PADDING.top + PLOT_H + 18}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] dark:fill-slate-400"
              >
                {band.label}%
              </text>
            </g>
          );
        })}

        {/* Normal-distribution curve + mean marker */}
        {showCurve && (
          <>
            <path
              d={curvePath}
              fill="none"
              className="stroke-amber-500"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1={xForPct(meanPercentage)}
              y1={PADDING.top}
              x2={xForPct(meanPercentage)}
              y2={PADDING.top + PLOT_H}
              className="stroke-amber-500/50"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          </>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Students per score band
        </span>
        {showCurve && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-amber-500" />
            Normal distribution (mean {meanPercentage.toFixed(0)}%)
          </span>
        )}
      </figcaption>
    </figure>
  );
}
