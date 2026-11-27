import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';
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

let _resend;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    _resend = new Resend(key);
  }
  return _resend;
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
      const resend = getResend();
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
      const fromEmail = process.env.REPLY_FROM_EMAIL || 'noreply@jokel-fashion-world-sigma.vercel.app';
      if (resend && adminEmails.length > 0) {
        await resend.emails.send({
          from: `Jokel Fashion World <${fromEmail}>`,
          to: adminEmails,
          subject: `New Application: ${vFullName} (${row.reference})`,
          text: `A new application has been submitted.

Reference: ${row.reference}
Name: ${vFullName}
Email: ${vEmail}
Phone: ${vPhone}
Date of Birth: ${vDob || '—'}
Address: ${vAddress || '—'}
Programme: ${vProgramme}
Education Background: ${vEducation}
Additional Info: ${vAdditional || '—'}

View and manage this application in the admin dashboard at /admin`,
        });
      }
    } catch (emailErr) {
      console.error('Application email notification failed:', emailErr.message);
    }

    return res.status(201).json({ success: true, reference: row.reference });
  } catch (e) {
    console.error('Application error:', e);
    return secureError(res, 500, 'Failed to save application');
  }
}
