import { sql } from '../admin/_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await sql`select key, value from site_settings order by key asc`;
    const settings = {};
    for (const r of rows) {
      try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
    }
    return res.status(200).json({ settings });
  } catch (e) {
    console.error('Public settings error:', e);
    return res.status(500).json({ error: 'Failed to load settings' });
  }
}
