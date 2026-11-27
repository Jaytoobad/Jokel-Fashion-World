import { verifyAdmin, sql, hashPassword } from './_auth.js';
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
  const id = pathParts[pathParts.length - 1];

  // GET /api/admin/users — list all admin users
  if (req.method === 'GET' && !id) {
    try {
      const users = await sql`
        select id, email, name, is_active, last_login_at, created_at, updated_at
        from admin_users
        order by created_at desc
      `;
      return res.status(200).json({ users });
    } catch (e) {
      console.error('Users list error:', e);
      return secureError(res, 500, 'Failed to load users');
    }
  }

  // GET /api/admin/users/:id — get single user
  if (req.method === 'GET' && id.match(/^\d+$/)) {
    try {
      const result = await sql`
        select id, email, name, is_active, last_login_at, created_at, updated_at
        from admin_users
        where id = ${id}
      `;
      if (!result.length) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user: result[0] });
    } catch (e) {
      console.error('User get error:', e);
      return secureError(res, 500, 'Failed to load user');
    }
  }

  // POST /api/admin/users — create new admin user
  if (req.method === 'POST' && !id) {
    const { email, name, password, is_active } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    try {
      const passwordHash = await hashPassword(password);
      const result = await sql`
        insert into admin_users (email, password_hash, name, is_active)
        values (${email.toLowerCase()}, ${passwordHash}, ${name || null}, ${is_active !== false})
        returning id, email, name, is_active, created_at
      `;
      await logAudit(auth.adminEmail, 'admin_users', String(result[0].id), 'created', '', email);
      return res.status(201).json({ user: result[0] });
    } catch (e) {
      console.error('User create error:', e);
      if (e.code === '23505') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return secureError(res, 500, 'Failed to create user');
    }
  }

  // PATCH /api/admin/users/:id — update user
  if (req.method === 'PATCH' && id.match(/^\d+$/)) {
    const { name, is_active } = req.body || {};
    const current = await sql`select id, email, name, is_active from admin_users where id = ${id}`;
    if (!current.length) return res.status(404).json({ error: 'User not found' });
    const cur = current[0];
    const updates = [];
    const audits = [];
    if (name !== undefined && String(name) !== cur.name) {
      updates.push(['name', String(name)]);
      audits.push(['name', cur.name || '', String(name)]);
    }
    if (is_active !== undefined && Boolean(is_active) !== cur.is_active) {
      updates.push(['is_active', Boolean(is_active)]);
      audits.push(['is_active', String(cur.is_active), String(Boolean(is_active))]);
    }
    if (updates.length === 0) {
      return res.status(200).json({ success: true, message: 'No changes' });
    }
    try {
      const setClause = updates.map(([f], i) => `"${f}" = $${i + 1}`).join(', ');
      const params = updates.map(([, v]) => v);
      params.push(id);
      await sql(`update admin_users set ${setClause}, updated_at = now() where id = $${params.length}`, params);
      for (const [field, oldVal, newVal] of audits) {
        await logAudit(auth.adminEmail, 'admin_users', String(id), field, String(oldVal), String(newVal));
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('User update error:', e);
      return secureError(res, 500, 'Failed to update user');
    }
  }

  // DELETE /api/admin/users/:id — deactivate (soft delete) user
  if (req.method === 'DELETE' && id.match(/^\d+$/)) {
    // Prevent self-deletion
    if (String(auth.adminId) === id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    try {
      await sql`update admin_users set is_active = false, updated_at = now() where id = ${id}`;
      await logAudit(auth.adminEmail, 'admin_users', String(id), 'deactivated', 'active', 'inactive');
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('User delete error:', e);
      return secureError(res, 500, 'Failed to deactivate user');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
