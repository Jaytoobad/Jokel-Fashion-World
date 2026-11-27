import { verifyAdmin, sql } from './_auth.js';
import { logAudit } from '../../lib/utils.js';
import { validateCsrfToken, checkBodySize, secureError } from '../../lib/security.js';

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrf = validateCsrfToken(req);
    if (!csrf.ok) return res.status(csrf.status).json({ error: csrf.error });

    const sizeCheck = checkBodySize(req, 100 * 1024);
    if (!sizeCheck.ok) return res.status(sizeCheck.status).json({ error: sizeCheck.error });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const key = pathParts[pathParts.length - 1];

  // GET /api/admin/settings — list all settings
  if (req.method === 'GET' && pathParts.length === 3) {
    try {
      const rows = await sql`select key, value, updated_at from site_settings order by key asc`;
      return res.status(200).json({ settings: rows });
    } catch (e) {
      console.error('Settings list error:', e);
      return secureError(res, 500, 'Failed to load settings');
    }
  }

  // GET /api/admin/settings/:key — get single setting
  if (req.method === 'GET' && pathParts.length === 4) {
    try {
      const result = await sql`select key, value, updated_at from site_settings where key = ${key}`;
      if (!result.length) return res.status(404).json({ error: 'Setting not found' });
      return res.status(200).json({ setting: result[0] });
    } catch (e) {
      console.error('Setting get error:', e);
      return secureError(res, 500, 'Failed to load setting');
    }
  }

  // POST /api/admin/settings — create setting
  if (req.method === 'POST' && pathParts.length === 3) {
    const { key: k, value } = req.body || {};
    if (!k) return res.status(400).json({ error: 'Key required' });
    if (value === undefined) return res.status(400).json({ error: 'Value required' });
    try {
      await sql`
        insert into site_settings (key, value)
        values (${k}, ${JSON.stringify(value)}::jsonb)
        on conflict (key) do update set value = ${JSON.stringify(value)}::jsonb, updated_at = now()
      `;
      await logAudit(auth.adminEmail, 'site_settings', k, 'value', '', JSON.stringify(value));
      return res.status(201).json({ success: true });
    } catch (e) {
      console.error('Setting create error:', e);
      return secureError(res, 500, 'Failed to save setting');
    }
  }

  // PATCH /api/admin/settings/:key — update setting
  if (req.method === 'PATCH' && pathParts.length === 4) {
    const { value } = req.body || {};
    if (value === undefined) return res.status(400).json({ error: 'Value required' });
    const current = await sql`select value from site_settings where key = ${key}`;
    if (!current.length) return res.status(404).json({ error: 'Setting not found' });
    const oldVal = JSON.stringify(current[0].value);
    const newVal = JSON.stringify(value);
    if (oldVal === newVal) {
      return res.status(200).json({ success: true, message: 'No changes' });
    }
    try {
      await sql`
        update site_settings set value = ${newVal}::jsonb, updated_at = now() where key = ${key}
      `;
      await logAudit(auth.adminEmail, 'site_settings', key, 'value', oldVal, newVal);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('Setting update error:', e);
      return secureError(res, 500, 'Failed to update setting');
    }
  }

  // DELETE /api/admin/settings/:key — delete setting
  if (req.method === 'DELETE' && pathParts.length === 4) {
    try {
      await sql`delete from site_settings where key = ${key}`;
      await logAudit(auth.adminEmail, 'site_settings', key, 'deleted', 'exists', '');
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('Setting delete error:', e);
      return secureError(res, 500, 'Failed to delete setting');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
