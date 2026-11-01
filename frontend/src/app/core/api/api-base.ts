/** Shared API origin: local backend in dev, same-origin `/api` in production. */
export function apiBase(): string {
  return typeof location !== 'undefined' && location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';
}
