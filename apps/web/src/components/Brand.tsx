export function Mark({ size = 36 }: { size?: number }) {
  // Three stacked chevrons, like rank insignia. Original mark, not an official emblem.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#121a0f" />
      <g fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 13l9-5 9 5" stroke="#e8cf74" />
        <path d="M7 19l9-5 9 5" stroke="#c9a227" />
        <path d="M7 25l9-5 9 5" stroke="#a8841b" />
      </g>
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Mark />
      <div className="leading-none">
        <div className={`font-display text-2xl font-bold tracking-wide ${light ? "text-khaki-100" : "text-army-900"}`}>
          SIMPONI <span className="text-gold-500">TP</span>
        </div>
        <div className={`mt-1 text-xs ${light ? "text-army-300" : "text-army-600"}`}>Pertanian presisi berbasis UAV</div>
      </div>
    </div>
  );
}
