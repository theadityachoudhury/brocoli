interface ViewCountProps {
  count: number | null;
}

export function ViewCount({ count }: ViewCountProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted text-sm">
      <EyeIcon />
      {count === null ? (
        <span className="w-8 h-4 bg-surface-raised rounded animate-pulse" />
      ) : (
        <span>{count.toLocaleString()}</span>
      )}
    </span>
  );
}

function EyeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
