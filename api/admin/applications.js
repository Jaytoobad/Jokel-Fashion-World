import { verifyAdmin, sql } from './_auth.js';
import { logAudit } from '../../lib/utils.js';

const ALLOWED_STATUSES = ['submitted', 'under_review', 'accepted', 'rejected'];

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1];

  if (req.method === 'GET' && !id.match(/^[0-9a-f-]{36}$/i)) {
    try {
      const applications = await sql`
        select id, reference, programme_name, full_name, email, phone, date_of_birth, address, education_background, additional_info, status, fee_received, admin_notes, created_at
        from applications
        order by created_at desc
      `;
      return res.status(200).json({ applications });
    } catch (e) {
      console.error('Applications list error:', e);
      return res.status(500).json({ error: 'Failed to load applications' });
    }
  }

  if (req.method === 'PATCH' && id.match(/^[0-9a-f-]{36}$/i)) {
    const { status, fee_received, admin_notes } = req.body || {};

    const updates = [];
    const oldValues = {};
    const newValues = {};

    const current = await sql`select status, fee_received, admin_notes from applications where id = ${id}`;
    if (!current.length) return res.status(404).json({ error: 'Application not found' });

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      if (current[0].status !== status) {
        updates.push(sql`status = ${status}`);
        oldValues.status = current[0].status;
        newValues.status = status;
      }
    }
    if (fee_received !== undefined) {
      const val = Boolean(fee_received);
      if (current[0].fee_received !== val) {
        updates.push(sql`fee_received = ${val}`);
        oldValues.fee_received = String(current[0].fee_received);
        newValues.fee_received = String(val);
      }
    }
    if (admin_notes !== undefined) {
      const trimmed = String(admin_notes).slice(0, 5000);
      if (current[0].admin_notes !== trimmed) {
        updates.push(sql`admin_notes = ${trimmed}`);
        oldValues.admin_notes = current[0].admin_notes || '';
        newValues.admin_notes = trimmed;
      }
    }

    if (updates.length === 0) {
      return res.status(200).json({ success: true, message: 'No changes' });
    }

    try {
      await sql`update applications set ${sql.join(updates, sql`, `)}, updated_at = now() where id = ${id}`;

      for (const field of Object.keys(oldValues)) {
        await logAudit(auth.adminEmail, 'applications', id, field, oldValues[field], newValues[field]);
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('Application update error:', e);
      return res.status(500).json({ error: 'Failed to update application' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}