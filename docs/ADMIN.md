# Admin: current status and plan

**Status: built.** Admin area at `/admin` with Clerk authentication.

## Staff login (Clerk)

- **Frontend**: `@clerk/clerk-js` (vanilla JS, loaded via CDN in `admin/index.html`)
- **Backend**: `@clerk/backend` (Node SDK for token verification in Vercel Functions)
- **Auth flow**: Clerk hosted sign-in pages. User signs in on Clerk's domain, gets a session JWT. Admin page sends token in `Authorization: Bearer <token>` header to `/api/admin/*` endpoints.
- **Access control**: Only emails listed in `ADMIN_EMAILS` (comma-separated) can access admin. Verified server-side on every request.
- **No cookies, no CSRF risk**: Token sent in header, not cookies.

### Clerk setup steps

1. Create a Clerk application at https://dashboard.clerk.com
2. In Clerk Dashboard → **Configure** → **Authentication**:
   - Enable **Email** (and optionally Password, Social providers)
   - Disable **Multi-factor authentication** if not needed (or enable for extra security)
3. In **User & Authentication** → **Email, Phone, Username**:
   - Set "Email address" as required
4. In **Sessions** → **Session settings**:
   - Set session lifetime (e.g., 30 days)
5. Copy the **Publishable Key** and **Secret Key** from **API Keys**
6. In Vercel project settings, add these Environment Variables:
   - `CLERK_PUBLISHABLE_KEY` (pk_test_... or pk_live_)
   - `CLERK_SECRET_KEY` (sk_test_... or sk_live_)
   - `ADMIN_EMAILS` (comma-separated, e.g. `joanna@example.com,staff@example.com`)
   - `DATABASE_URL`, `RATE_LIMIT_SALT` (see README)
7. In Clerk Dashboard → **Domains**, add your Vercel preview/production domains
8. Redeploy. Visit `/admin` → redirects to Clerk sign-in → on success, shows admin dashboard.

### Adding/removing staff

- **Add**: Add email to `ADMIN_EMAILS` in Vercel env vars → redeploy (or wait for next deploy). User signs in with that email.
- **Remove**: Remove email from `ADMIN_EMAILS` → redeploy. Existing sessions work until token expires (max session lifetime).

## Admin screens

All in the site's black and gold style, mobile-friendly:

- **Dashboard** (top): real counts — total applications, per status (submitted/under review/accepted/rejected), fees received, total enquiries, new enquiries. Shows 0 when empty.
- **Applications**: searchable, filterable by status. Click "View" to open modal with all details. Can change status, toggle fee_received, edit admin_notes. Reference number shown.
- **Enquiries**: searchable, filterable by status. Click "View" to open modal. Can mark as read/replied.
- **Audit trail**: every status/fee change recorded in `audit_log` table (who, what, when).

## API routes (protected)

- `GET /api/admin/stats` — dashboard counts
- `GET /api/admin/applications` — list all
- `PATCH /api/admin/applications/:id` — update status, fee_received, admin_notes (validated)
- `GET /api/admin/enquiries` — list all
- `PATCH /api/admin/enquiries/:id` — update status (validated)

All use parameterized queries, allow-listed values, length limits.

## Next step: email notification

**Not yet implemented.** When an application arrives, send an email to the owner. Options:
- Resend / SendGrid / Postmark via Vercel Function
- Clerk webhook on user creation (not applicable here)
- Direct SMTP from `/api/application` after successful insert

Add this in a future phase.

## Security rules kept

- Server-side checks for every admin action
- Validated inputs against allow-lists
- Length limits on all text fields
- No secrets in browser code
- Rate limiting on public forms (DB-backed, hashed IP)
- Audit trail for sensitive changes
- `X-Robots-Tag: noindex` on `/admin/*` via `vercel.json`
- `Disallow: /admin` in `robots.txt`