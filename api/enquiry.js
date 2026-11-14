import { neon } from '@neondatabase/serverless';
import { checkRateLimit, getClientIp, validateEmail, trimAndLimit } from '../lib/utils.js';

const sql = neon(process.env.DATABASE_URL);

const ALLOWED_ENQUIRY_TYPES = ['admissions', 'custom_design', 'business', 'general'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rateLimitResult = await checkRateLimit(ip, 'enquiry');
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { name, email, enquiry_type, message, website } = req.body || {};

  if (website && website.trim()) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  const vName = trimAndLimit(name, 200);
  const vEmail = trimAndLimit(email, 254).toLowerCase();
  const vType = trimAndLimit(enquiry_type, 50);
  const vMessage = trimAndLimit(message, 4000);

  if (!vName || !vEmail || !vType || !vMessage) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!validateEmail(vEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!ALLOWED_ENQUIRY_TYPES.includes(vType)) {
    return res.status(400).json({ error: 'Invalid enquiry type' });
  }

  try {
    await sql`
      insert into enquiries (name, email, enquiry_type, message)
      values (${vName}, ${vEmail}, ${vType}, ${vMessage})
    `;
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('Enquiry insert error:', e);
    return res.status(500).json({ error: 'Failed to save enquiry' });
  }
}