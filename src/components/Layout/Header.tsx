import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header
      className="sticky top-0 z-10 border-b border-border backdrop-blur-sm"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
    >
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          to="/"
          className="font-semibold text-text-primary hover:text-accent transition-colors duration-150"
        >
          notes
        </Link>
      </div>
    </header>
  );
}
