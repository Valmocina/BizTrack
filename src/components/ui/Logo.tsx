// BizTrack logo mark (simple cube) drawn with the current text color.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 3 4 9.5v13L16 29l12-6.5v-13Z" />
      <path d="M4 9.5 16 16l12-6.5M16 16v13" />
    </svg>
  );
}
