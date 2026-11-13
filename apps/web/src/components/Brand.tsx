export function Mark({ size = 28 }: { size?: number }) {
  // Tiga chevron bertumpuk, merah di atas kotak hitam. Logo asli, bukan lambang resmi.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#202020" />
      <g
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 13l9-5 9 5" stroke="#ffffff" />
        <path d="M7 19l9-5 9 5" stroke="#ff5a60" />
        <path d="M7 25l9-5 9 5" stroke="#d71920" />
      </g>
    </svg>
  );
}

export function Wordmark({
  light = false,
  tagline = false,
}: {
  light?: boolean;
  tagline?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark />
      <div className="leading-none">
        <div
          className={`text-[15px] font-bold tracking-tight ${
            light ? "text-white" : "text-army-900"
          }`}
        >
          SIMPONI <span className="text-gold-500">TP</span>
        </div>
        {tagline && (
          <div
            className={`mt-1 text-xs ${
              light ? "text-white/70" : "text-army-500"
            }`}
          >
            Pertanian presisi berbasis UAV
          </div>
        )}
      </div>
    </div>
  );
}

export function Flag({ width = 30 }: { width?: number }) {
  // Bendera merah putih, dibuat sedikit melengkung seperti berkibar.
  const h = Math.round((width * 2) / 3);
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 30 20"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_1px_1.5px_rgba(32,32,32,0.25)]"
    >
      <defs>
        <clipPath id="flag-clip">
          <path d="M1 3c4-2.2 8-2.2 12 0s8 2.2 12 0l4-1.5v15l-4 1.5c-4 2.2-8 2.2-12 0s-8-2.2-12 0z" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-clip)">
        <rect width="30" height="10" fill="#d71920" />
        <rect y="10" width="30" height="10" fill="#ffffff" />
        <rect
          width="30"
          height="20"
          fill="none"
          stroke="#d9d9d9"
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}
