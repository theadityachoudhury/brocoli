import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-8xl font-bold text-border mb-6" aria-hidden="true">
        404
      </p>
      <h1 className="text-text-primary text-2xl font-semibold mb-2">
        Page not found
      </h1>
      <p className="text-text-muted text-sm mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hover text-sm transition-colors duration-150"
      >
        ← Back to notes
      </Link>
    </div>
  );
}
