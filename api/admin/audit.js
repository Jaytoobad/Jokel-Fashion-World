import { verifyAdmin, sql } from './_auth.js';

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const table = url.searchParams.get('table') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

  try {
    const rows = table
      ? await sql`select * from audit_log where target_table = ${table} order by changed_at desc limit ${limit}`
      : await sql`select * from audit_log order by changed_at desc limit ${limit}`;
    return res.status(200).json({ logs: rows });
  } catch (e) {
    console.error('Audit log error:', e);
    return res.status(500).json({ error: 'Failed to load audit log' });
  }
}