# Admin: current status and plan

**Status: built.** Admin area at `/admin` with DB-backed bcrypt/JWT authentication.

## Staff login (DB-backed bcrypt + JWT)

- **Frontend**: Custom admin SPA at `admin/index.html` with `admin/main.js`
- **Backend**: `api/admin/_auth.js` with bcryptjs (12 rounds) + jose HS256 JWT (8h expiry)
- **Auth flow**: POST `/api/admin/login` with email/password → returns JWT → stored in localStorage → sent as `Authorization: Bearer <token>` on all admin API requests
- **Access control**: Only users in `admin_users` table with `is_active = true` can access admin. Verified server-side on every request.
- **CSRF protection**: Double-submit cookie pattern. Login sets `csrf_token` cookie (Secure, SameSite=Strict). State-changing requests (POST/PATCH/DELETE) must include `X-CSRF-Token` header matching the cookie value.
- **Rate limiting**: Max 5 failed login attempts per 15-minute window per IP and per email. 30-minute lockout after threshold. Fail-open on database errors.
- **No cookies for session**: JWT sent in header, not cookies (except CSRF token cookie).

### Admin setup steps

1. Database migrations must be applied in Neon SQL Editor:
   - `db/schema.sql` - initial schema (admin_users, applications, enquiries, content tables, rate_limits, audit_log)
   - `db/migration_admin_users.sql` - admin_users table
   - `db/migration_admin_enhancements.sql` - updated_at, reply tracking, audit log extensions
   - `db/migration_security.sql` - login_attempts and login_lockouts tables

2. Seed admin users:
   - `scripts/seed_admin_users.js` - seeds users from `ADMIN_EMAILS` env var with `DEFAULT_ADMIN_PASSWORD`

3. In Vercel project settings, add these Environment Variables:
   - `DATABASE_URL` - Neon connection string
   - `JWT_SECRET` - secret for signing JWT tokens
   - `RATE_LIMIT_SALT` - salt for hashing IP addresses in rate limiting
   - `ADMIN_EMAILS` (comma-separated, e.g. `joanna@example.com,staff@example.com`)
   - `DEFAULT_ADMIN_PASSWORD` (optional, defaults to `ChangeMe123!`)
   - `RESEND_API_KEY` (optional, for enquiry reply emails)
   - `REPLY_FROM_EMAIL` (optional, for enquiry reply emails)

4. Redeploy. Visit `/admin` → sign in with seeded credentials → shows admin dashboard.

### Default credentials (change on first login)

- `jasonasare211@gmail.com` / `ChangeMe123!`
- `joannylove44@gmail.com` / `ChangeMe123!`

## Admin screens

All in the site's black and gold style, mobile-friendly with collapsible left sidebar:

- **Dashboard** (top): real counts — total applications, per status (submitted/under review/accepted/rejected), fees received, total enquiries, new enquiries, programmes, gallery items, achievements. Shows 0 when empty.
- **Applications**: searchable, filterable by status. Click to open modal with all details. Can change status, toggle fee_received, edit admin_notes. Reference number shown.
- **Enquiries**: searchable, filterable by status. Click to open modal. Can mark as read/replied, send reply email (if Resend configured).
- **Content**: Manage programmes, gallery_items, and achievements. Create, edit, delete content items.
- **Audit trail**: every status/fee change recorded in `audit_log` table (who, what, when).

## API routes (protected)

All require `Authorization: Bearer <JWT>` header and CSRF token for state-changing methods:

- `POST /api/admin/login` — authenticate, returns JWT + sets CSRF cookie
- `GET /api/admin/stats` — dashboard counts
- `GET /api/admin/applications` — list all
- `PATCH /api/admin/applications/:id` — update status, fee_received, admin_notes (validated)
- `GET /api/admin/enquiries` — list all
- `PATCH /api/admin/enquiries/:id` — update status, reply_subject, reply_body (validated)
- `GET /api/admin/content/:table` — list content (programmes, gallery_items, achievements)
- `POST /api/admin/content/:table` — create content item
- `PATCH /api/admin/content/:table/:id` — update content item
- `DELETE /api/admin/content/:table/:id` — delete content item
- `GET /api/admin/audit` — audit log entries

All use parameterized queries, allow-listed values, length limits, and request body size limits.

## Security rules kept

- Server-side checks for every admin action
- Validated inputs against allow-lists
- Length limits on all text fields
- No secrets in browser code
- Rate limiting on public forms and admin login (DB-backed, hashed IP)
- CSRF double-submit cookie protection on state-changing admin requests
- XSS sanitization on all user-submitted content rendered in admin panel
- Audit trail for sensitive changes
- `X-Robots-Tag: noindex` on `/admin/*` via `vercel.json`
- `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy` headers
