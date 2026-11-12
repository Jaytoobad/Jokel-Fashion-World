import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const ipHits = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const hits = ipHits.get(ip) || [];
  const recent = hits.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  ipHits.set(ip, recent);
  return true;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function trimAndLimit(str, max) {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { n, e, p, d, a, g, b, x, website } = req.body || {};

  if (website && website.trim()) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  const vFullName = trimAndLimit(n, 200);
  const vEmail = trimAndLimit(e, 254).toLowerCase();
  const vPhone = trimAndLimit(p, 50);
  const vDob = d ? trimAndLimit(d, 10) : null;
  const vAddress = trimAndLimit(a, 500);
  const vProgramme = trimAndLimit(g, 200);
  const vEducation = trimAndLimit(b, 500);
  const vAdditional = trimAndLimit(x, 2000);

  if (!vFullName || !vEmail || !vPhone || !vProgramme || !vEducation) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }
  if (!validateEmail(vEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const [row] = await sql`
      insert into applications (programme_name, full_name, email, phone, date_of_birth, address, education_background, additional_info)
      values (${vProgramme}, ${vFullName}, ${vEmail}, ${vPhone}, ${vDob}, ${vAddress}, ${vEducation}, ${vAdditional})
      returning reference
    `;
    return res.status(201).json({ success: true, reference: row.reference });
  } catch (e) {
    console.error('Application insert error:', e);
    return res.status(500).json({ error: 'Failed to save application' });
  }
}