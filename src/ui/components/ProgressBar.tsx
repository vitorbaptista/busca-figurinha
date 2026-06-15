interface ProgressBarProps {
  /** 0..1 */
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div class="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div class="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
