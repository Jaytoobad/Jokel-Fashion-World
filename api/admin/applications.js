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

    const current = await sql`select status, fee_received, admin_notes from applications where id = ${id}`;
    if (!current.length) return res.status(404).json({ error: 'Application not found' });

    const updates = [];
    const audits = [];

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      if (current[0].status !== status) {
        updates.push(['status', status]);
        audits.push(['status', current[0].status, status]);
      }
    }
    if (fee_received !== undefined) {
      const val = Boolean(fee_received);
      if (current[0].fee_received !== val) {
        updates.push(['fee_received', val]);
        audits.push(['fee_received', String(current[0].fee_received), String(val)]);
      }
    }
    if (admin_notes !== undefined) {
      const trimmed = String(admin_notes).slice(0, 5000);
      if ((current[0].admin_notes || '') !== trimmed) {
        updates.push(['admin_notes', trimmed || null]);
        audits.push(['admin_notes', current[0].admin_notes || '', trimmed]);
      }
    }

    if (updates.length === 0) {
      return res.status(200).json({ success: true, message: 'No changes' });
    }

    try {
      const statusVal = updates.find(u => u[0] === 'status')?.[1];
      const feeVal = updates.find(u => u[0] === 'fee_received')?.[1];
      const notesVal = updates.find(u => u[0] === 'admin_notes')?.[1];

      if (updates.length === 1 && statusVal !== undefined) {
        await sql`update applications set status = ${statusVal}, updated_at = now() where id = ${id}`;
      } else if (updates.length === 1 && feeVal !== undefined) {
        await sql`update applications set fee_received = ${feeVal}, updated_at = now() where id = ${id}`;
      } else if (updates.length === 1 && notesVal !== undefined) {
        await sql`update applications set admin_notes = ${notesVal}, updated_at = now() where id = ${id}`;
      } else {
        const nextStatus = statusVal !== undefined ? statusVal : current[0].status;
        const nextFee = feeVal !== undefined ? feeVal : current[0].fee_received;
        const nextNotes = notesVal !== undefined ? notesVal : (current[0].admin_notes || null);
        await sql`update applications set status = ${nextStatus}, fee_received = ${nextFee}, admin_notes = ${nextNotes}, updated_at = now() where id = ${id}`;
      }

      for (const [field, oldVal, newVal] of audits) {
        await logAudit(auth.adminEmail, 'applications', id, field, oldVal, newVal);
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('Application update error:', e);
      return res.status(500).json({ error: 'Failed to update application' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
