export const SITE_NAME = import.meta.env.VITE_SITE_NAME ?? 'Notes';
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');
export const SITE_DESCRIPTION = import.meta.env.VITE_SITE_DESCRIPTION ?? 'Personal notes and articles.';
export const AUTHOR_NAME = import.meta.env.VITE_AUTHOR_NAME ?? '';
