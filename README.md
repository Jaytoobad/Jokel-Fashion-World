# Jokel Fashion World: website

Fashion house + fashion academy website for Jokel Fashion World (Achiaman, Ghana). Vite + plain JavaScript modules, no framework yet.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (static site only, NO /api)
npm run build      # outputs dist/
```

**To test the forms locally you must run the Vercel dev server** (it serves the site AND the /api functions together):

```bash
npx vercel dev     # http://localhost:3000 (site + /api/enquiry, /api/application)
```

Or use a Vercel Preview Deployment (push to a branch, Vercel gives you a URL).

Plain `npm run dev` (Vite) does NOT run the `/api` functions.

Node 20 or newer. If `vite@^7` is not the latest, run `npm install vite@latest`.

## Where things live

| Path | What |
|---|---|
| `src/content.js` | **All editable text and data**: tagline, contact details, social links, the course and its month-by-month curriculum, designs, student showcase, achievements, image and video paths |
| `public/images/` | Photos and logo. Replace a file (same name) to swap a photo |
| `public/videos/` | Cleaned, silent web videos (TikTok watermark removed). Replace a file (same name) to swap a video |
| `src/main.js` | Page templates, hash routing (`#home`, `#about`, ...), animations, forms, lightbox |
| `src/styles/main.css` | Design tokens (colours and fonts at the top) and all styling |
| `index.html` | Page shell, title, meta tags, fonts |
| `admin/index.html` | Admin area entry (separate Vite build) |
| `db/schema.sql` | Database schema for Neon (plain Postgres) |
| `api/enquiry.js` | Vercel Function: POST `/api/enquiry` |
| `api/application.js` | Vercel Function: POST `/api/application` |
| `api/admin/*.js` | Vercel Functions: admin API (protected) |
| `docs/` | `CONTENT_CHECKLIST.md` (what is still open), `ADMIN.md` (admin plan) |

## Pages

Home, About, Academy, Programmes (6-month beginner course + curriculum), Admissions, Designs, Students, Achievements, Contact.

Admin area at `/admin` (separate page, staff only).

## What works now

Everything visual: all nine pages, mobile menu, animations (respecting reduced motion), photo and video galleries with a fullscreen viewer, the curriculum accordion, light and dark colour support. Tested at 360, 390, 768 and 1280 pixels wide with no console errors, broken files or sideways scrolling.

**Forms now submit to the database** via Vercel Functions (Neon Postgres). The application form returns a reference number (JFW-XXXXXXXX).

## What does NOT work yet

- **Hash routing** (`#about`) is not search-engine friendly. Real URLs, a sitemap and per-page metadata need a router.
- **No online payments, by the owner's decision.** Fees are discussed by phone and paid in person, so no payment code is needed.
- **Email notification** to owner when an application arrives (next step, see `docs/ADMIN.md`).

## How to test a submission

### Local (with vercel dev)

1. Copy `.env.local` to `.env` (or create `.env` with `DATABASE_URL` from Neon, plus `RATE_LIMIT_SALT`, `ADMIN_EMAILS`, Clerk keys).
2. Run `npx vercel dev` → opens `http://localhost:3000`.
3. Go to `#admissions`, fill the application form, submit.
   - Success: "Application submitted successfully! Your reference: JFW-XXXXXXXX"
   - Error: clear message, never a fake success.
4. Go to `#contact`, fill the contact form, submit.
   - Success: "Message sent successfully!"
   - Error: clear message.
5. Test rate limit: submit 6+ enquiries or 4+ applications from the same IP within 60 seconds → 429 "Too many requests."

### Deployed (Vercel Preview or Production)

1. Push to GitHub → Vercel creates a Preview Deployment.
2. Add env vars in Vercel: `DATABASE_URL`, `RATE_LIMIT_SALT`, `ADMIN_EMAILS`, Clerk keys.
3. Test the same flows on the Preview URL.

## Database setup (Neon + Vercel)

1. Create a Neon project (or use the existing one).
2. Open the Neon Console → SQL Editor and run the contents of `db/schema.sql`.
3. In Vercel project settings, add these Environment Variables:
   - `DATABASE_URL` (from Neon's connection string)
   - `RATE_LIMIT_SALT` (random string, e.g. `openssl rand -hex 32`)
   - `ADMIN_EMAILS` (comma-separated staff emails, e.g. `joanna@example.com,staff@example.com`)
   - Clerk keys (see `docs/ADMIN.md`)
4. Redeploy. The functions at `/api/enquiry`, `/api/application`, and `/api/admin/*` will now work.

## Content rules

Nothing may claim awards, accreditation, partnerships, testimonials or statistics until the owner verifies them. Student names only with written approval. Get permission for every photo and video, and credit photographers where required.