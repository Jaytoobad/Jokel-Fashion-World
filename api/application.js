import { neon } from '@neondatabase/serverless';
import { checkRateLimit, getClientIp, validateEmail, trimAndLimit } from '../lib/utils.js';
import { checkBodySize, secureError } from '../lib/security.js';

let _sql;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL env var is required');
    _sql = neon(url);
  }
  return _sql;
}

function normalizePhone(phone) {
  let p = String(phone || '').replace(/[\s\-+()]/g, '');
  if (p.startsWith('0')) p = '233' + p.slice(1);
  else if (!p.startsWith('233')) p = '233' + p;
  return p;
}

async function sendSasusyncSms(message) {
  const apiKey = process.env.SASUSYNC_API_KEY;
  const adminPhones = (process.env.ADMIN_PHONES || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!apiKey || adminPhones.length === 0) return;

  const recipients = adminPhones.map(normalizePhone);
  const url = process.env.SASUSYNC_SANDBOX === 'true'
    ? 'https://sms.sasusync.com/smssandbox/v1/send'
    : 'https://sms.sasusync.com/api/v1/send';

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: 'Jokel',
        recipients,
        message
      })
    });
  } catch (e) {
    console.error('Sasustync SMS failed:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sizeCheck = checkBodySize(req, 50 * 1024);
  if (!sizeCheck.ok) return res.status(sizeCheck.status).json({ error: sizeCheck.error });

  try {
    const ip = getClientIp(req);
    const rateLimitResult = await checkRateLimit(ip, 'application');
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    const { n, e, p, d, a, g, b, x, website } = req.body || {};

    if (website && String(website).trim()) {
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

    const sql = getSql();
    const [row] = await sql`
      insert into applications (programme_name, full_name, email, phone, date_of_birth, address, education_background, additional_info)
      values (${vProgramme}, ${vFullName}, ${vEmail}, ${vPhone}, ${vDob}, ${vAddress || null}, ${vEducation}, ${vAdditional || null})
      returning reference
    `;

    try {
      await sendSasusyncSms(`New application ${row.reference}: ${vFullName} (${vPhone}) applied for ${vProgramme}. View at /admin`);
    } catch (e) {
      console.error('Sasustync SMS notification failed:', e.message);
    }

    return res.status(201).json({ success: true, reference: row.reference });
  } catch (e) {
    console.error('Application error:', e);
    return secureError(res, 500, 'Failed to save application');
  }
}
