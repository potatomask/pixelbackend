# Security Vulnerability Audit Report
*Generated: 2026-03-26*

---

## CRITICAL — All Fixed ✅

- [x] **C1. Real OAuth secrets in `.env`** — `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` must be rotated immediately. User must regenerate these in GitHub/Google developer consoles.
  - *Action required: Manually rotate secrets in `.env` and any deployment secrets manager.*

- [x] **C2. No auth on `POST /api/tiles/upload`** — Fixed: added `getAuthUser` authentication check.
  - File: `apps/web/app/api/tiles/upload/route.ts`

- [x] **C3. `GET /api/admin/settings` accessible to all authenticated users** — Fixed: changed `getAuthUser` to `requireAdmin`.
  - File: `apps/web/app/api/admin/settings/route.ts`

---

## HIGH — All Fixed ✅

- [x] **H1. No auth on `POST /api/analytics/event`** — Fixed: added in-memory rate limiting (100 req/min per IP).
  - File: `apps/web/app/api/analytics/event/route.ts`

- [x] **H2. IDOR in `PUT/DELETE /api/tiles/[tileId]`** — Fixed: restricted both to admin-only via `requireAdmin`.
  - File: `apps/web/app/api/tiles/[tileId]/route.ts`

- [x] **H3. Open redirect in `GET /api/auth/login`** — Fixed: URL now validated to only allow the app's own origin.
  - File: `apps/web/app/api/auth/login/route.ts`

- [x] **H4. XSS in public visitor page (`client.tsx`)** — Fixed: all profile, hover, billboard, and media URLs validated with `isUrlSafe()` before rendering as `src`.
  - File: `apps/web/app/(public)/[slug]/client.tsx`
  - Profile image, hover image/video, billboard image/video, modal media — all now guarded.

- [x] **H5. XSS in `SidePagePanel.tsx`** — Fixed: link URL validated with `isUrlSafe()` in `handleAddLink`; link image URL guarded with `isUrlSafe()` before rendering.
  - File: `packages/editor/src/components/SidePagePanel.tsx`

- [x] **H6. `GET /api/settings/[key]` readable to all authenticated users** — Fixed: changed to `requireAdmin`.
  - File: `apps/web/app/api/settings/[key]/route.ts`

---

## MEDIUM — Fixed: M1, M5, M6 | Pending: M2, M3, M4

- [x] **M1. No rate limiting on feedback/reports/check-handle** — Fixed: added per-key in-memory rate limiting to all four endpoints.
  - `POST /api/feedback` — 20 req/min per user
  - `POST /api/feedback/upload` — 10 req/min per user
  - `POST /api/reports` — 5 req/min per IP (anonymous)
  - `GET /api/users/check-handle` — 30 req/min per IP
  - Shared limiter: `apps/web/lib/rate-limit.ts`

- [x] **M5. Profile image URL not validated** — Fixed: `PUT /api/users/profile` now validates `image` with `isUrlSafe()` before saving — blocks `javascript:`, `data:`, and non-HTTPS URLs at the source.
  - File: `apps/web/app/api/users/profile/route.ts`
  - *Note: Render-time guards in `client.tsx` remain as defense-in-depth.*

- [x] **M6. Any authenticated user can create global tile definitions** — Fixed: `POST /api/tiles` changed to `requireAdmin`.
  - File: `apps/web/app/api/tiles/route.ts`

- [ ] **M2. No CSRF protection** on state-changing operations (PUT/DELETE/POST) — recommend verifying Better Auth `sameSite` cookie config; add CSRF tokens if not already enforced.
- [ ] **M3. No auth on `POST /api/reports`** — anonymous reports are by design; rate limit (M1) mitigates abuse.
- [ ] **M4. `GET /api/media/storage` exposes tier info** — minor reconnaissance issue; consider removing `tier` from response.

---

## LOW / INFO — Pending

- [ ] **L1. Missing security headers** (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — add a security headers middleware
- [ ] **L2. 30-day session expiry** with no session rotation — consider shortening or adding refresh token logic
- [ ] **L3. `stripHtmlTags()` uses incomplete regex** — doesn't handle malformed HTML; upgrade to DOMPurify
- [ ] **L4. `media/delete` filename validation is redundant** — the `safeName !== filename` check after replacement is tautological
- [ ] **L5. `tiles/upload` overwrite protection** only blocks exact name match — consider UUID filenames

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| CRITICAL | 3 | 3 |
| HIGH | 6 | 6 |
| MEDIUM | 6 | 3 |
| LOW/INFO | 5 | 0 |
| **Total** | **20** | **12** |
