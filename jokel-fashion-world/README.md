# Jokel Fashion World: website

Fashion house + fashion academy website for Jokel Fashion World (Achiaman, Ghana). Vite + plain JavaScript modules, no framework yet.

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
```
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
| `backend/supabase/migrations/0001_init.sql` | Database and security-rules draft (not yet applied) |
| `docs/` | `CONTENT_CHECKLIST.md` (what is still open), `ADMIN.md` (admin plan) |

## Pages
Home, About, Academy, Programmes (6-month beginner course + curriculum), Admissions, Designs, Students, Achievements, Contact.

## What works now
Everything visual: all nine pages, mobile menu, animations (respecting reduced motion), photo and video galleries with a fullscreen viewer, the curriculum accordion, light and dark colour support. Tested at 360, 390, 768 and 1280 pixels wide with no console errors, broken files or sideways scrolling.

## What does NOT work yet
- **The application and contact forms send nothing.** They validate, then say so on screen. For now applicants phone +233 55 621 3555.
- **There is no admin dashboard and no login.** See `docs/ADMIN.md`.
- **Hash routing** (`#about`) is not search-engine friendly. Real URLs, a sitemap and per-page metadata need a router.
- **No online payments, by the owner's decision.** Fees are discussed by phone and paid in person, so no payment code is needed.

## Next steps, in order
1. Create a Supabase project, review and apply `backend/supabase/migrations/0001_init.sql`, create the first staff profile.
2. Connect the forms: save enquiries and applications to the database, and email the owner when one arrives. Never show a success message unless the save really succeeded.
3. Build the admin area (`docs/ADMIN.md`).
4. Move to React + TypeScript with a real router (content, styles and media carry over).
5. Deploy the static site (Vercel or Netlify) on the owner's domain; add sitemap and robots.

## Content rules
Nothing may claim awards, accreditation, partnerships, testimonials or statistics until the owner verifies them. Student names only with written approval. Get permission for every photo and video, and credit photographers where required.
