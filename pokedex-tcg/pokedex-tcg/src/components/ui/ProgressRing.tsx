interface Props { value: number; size?: number; stroke?: number; label?: string }

export function ProgressRing({ value, size = 132, stroke = 12, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(value, 100) / 100) * c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-ink-500" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          className="fill-none stroke-flame transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-2xl font-bold">{value.toFixed(1)}%</div>
        {label && <div className="text-[11px] text-mist">{label}</div>}
      </div>
    </div>
  );
}
