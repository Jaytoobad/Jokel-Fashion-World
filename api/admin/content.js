import { verifyAdmin } from './_auth.js';
import { neon } from '@neondatabase/serverless';
import { logAudit } from '../../lib/utils.js';
import { validateCsrfToken, checkBodySize, secureError } from '../../lib/security.js';

let _raw;
function getRaw() {
  if (!_raw) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL env var is required');
    _raw = neon(url);
  }
  return _raw;
}

const TABLES = {
  programmes: { fields: ['slug', 'name', 'summary', 'duration', 'level', 'requirements', 'fee_ghs', 'image_path', 'published', 'sort_order'] },
  gallery_items: { fields: ['collection', 'title', 'description', 'category', 'student_name', 'student_name_approved', 'image_path', 'published', 'sort_order'] },
  achievements: { fields: ['year', 'title', 'description', 'category', 'image_path', 'verified', 'published', 'sort_order'] },
};

const BOOL_FIELDS = new Set(['published', 'student_name_approved', 'verified']);

function coerce(field, value) {
  if (value === undefined || value === null || value === '') return null;
  if (BOOL_FIELDS.has(field)) return Boolean(value === true || value === 'true' || value === 'on' || value === 1 || value === '1');
  if (field === 'fee_ghs') return parseFloat(value) || 0;
  if (field === 'sort_order') return parseInt(value, 10) || 0;
  return String(value).slice(0, 5000);
}

function col(field) { return `"${field.replace(/"/g, '""')}"`; }

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // CSRF protection for state-changing methods
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrf = validateCsrfToken(req);
    if (!csrf.ok) return res.status(csrf.status).json({ error: csrf.error });

    const sizeCheck = checkBodySize(req, 100 * 1024);
    if (!sizeCheck.ok) return res.status(sizeCheck.status).json({ error: sizeCheck.error });
  }

  try {
    const raw = getRaw();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/').filter(Boolean);
    // /api/admin/content/:table/:id?
    const table = parts[3];
    const id = parts[4];

    if (!TABLES[table]) {
      return res.status(400).json({ error: 'Invalid table. Use: programmes, gallery_items, achievements' });
    }

    const fields = TABLES[table].fields;

    if (req.method === 'GET' && id) {
      const result = await raw.query(
        `select id, ${fields.map(col).join(', ')} from "${table}" where id = $1`,
        [id]
      );
      const rows = result.rows || result;
      if (!rows.length) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json({ item: rows[0] });
    }

    if (req.method === 'GET') {
      const result = await raw.query(
        `select id, ${fields.map(col).join(', ')} from "${table}" order by sort_order asc, id asc`
      );
      return res.status(200).json({ items: result.rows || result });
    }

if (req.method === 'POST') {
      const body = req.body || {};
      const values = fields.map(f => coerce(f, body[f]));
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      const cols = fields.map(col).join(', ');
      const result = await raw.query(
        `insert into "${table}" (${cols}) values (${placeholders}) returning id`,
        values
      );
      const rows = result.rows || result;
      await logAudit(auth.adminEmail, table, String(rows[0]?.id || rows[0]), 'created', '', 'created');
      return res.status(201).json({ id: rows[0]?.id || rows[0] });
    }

    if (req.method === 'PATCH' && id) {
      const body = req.body || {};
      const currentResult = await raw.query(
        `select ${fields.map(col).join(', ')} from "${table}" where id = $1`,
        [id]
      );
      const currentRows = currentResult.rows || currentResult;
      if (!currentRows.length) return res.status(404).json({ error: 'Item not found' });
      const current = currentRows[0];

      const updates = [];
      const params = [];
      const audits = [];

      for (const field of fields) {
        if (body[field] === undefined) continue;
        const newVal = coerce(field, body[field]);
        const oldVal = coerce(field, current[field]);
        const same = JSON.stringify(oldVal ?? null) === JSON.stringify(newVal ?? null);
        if (!same) {
          params.push(newVal);
          updates.push(`${col(field)} = $${params.length}`);
          audits.push([field, oldVal, newVal]);
        }
      }

      if (updates.length === 0) {
        return res.status(200).json({ success: true, message: 'No changes' });
      }

      params.push(id);
      await raw.query(
        `update "${table}" set ${updates.join(', ')} where id = $${params.length}`,
        params
      );
      for (const [field, oldVal, newVal] of audits) {
        await logAudit(auth.adminEmail, table, String(id), field, String(oldVal ?? ''), String(newVal ?? ''));
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && id) {
      await raw.query(`delete from "${table}" where id = $1`, [id]);
      await logAudit(auth.adminEmail, table, String(id), 'deleted', 'exists', '');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Content error:', e);
    return secureError(res, 500, 'Failed to process content request');
  }
}
