# Admin: current status and plan

**Status: not built.** There is no admin page, no login and no stored data yet. The site content lives in `src/content.js` and the files in `public/`.

## Interim way to manage things (once the database exists)

After running `db/schema.sql` in Neon, the Neon Console's Table Editor works as a basic admin: view applications and enquiries, tick `fee_received`, add `admin_notes`, edit programmes, achievements and gallery rows.

## Planned admin area (in the project, at `/admin`)

- Staff login (approach TBD), roles `admin` and `staff`
- Applications: list, search, filter, open, change status, tick fee received (fees are paid in person), notes
- Enquiries inbox
- Programmes: add and edit courses (name, curriculum, duration, level, requirements, fee line), publish or hide
- Gallery and student showcase: upload photos and videos, titles, categories; student names only when approved
- Achievements: add and edit, with a "verified" tick before anything shows publicly
- Site content: contact details, social links, hero image, announcements
- Dashboard counts from real data only, never placeholder numbers

## Security rules to keep

Server-side checks for every admin action, validated inputs, safe file uploads (type and size limits), no secrets in browser code.

## Next phase: staff login and `/admin` area

**Decision needed:** which login approach do you prefer?

1. **Vercel Edge Middleware + HTTP-only cookies** — custom session JWT, simple, no extra service.
2. **Clerk / Auth.js (NextAuth) adapted for Vercel Functions** — managed auth, social providers, MFA.
3. **Neon Auth (if available)** — database-backed sessions.
4. **Simple password gate** — single shared staff password stored as bcrypt hash in `site_settings`, cookie-based session.

Let me know your preference before I start the admin area.