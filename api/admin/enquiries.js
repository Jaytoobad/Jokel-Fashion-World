import { verifyAdmin, sql } from './_auth.js';
import { logAudit } from '../../lib/utils.js';

const ALLOWED_STATUSES = ['new', 'read', 'replied'];

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1];

  if (req.method === 'GET' && !id.match(/^\d+$/)) {
    try {
      const enquiries = await sql`
        select id, name, email, enquiry_type, message, status, reply_subject, reply_body, replied_at, created_at
        from enquiries
        order by created_at desc
      `;
      return res.status(200).json({ enquiries });
    } catch (e) {
      console.error('Enquiries list error:', e);
      return res.status(500).json({ error: 'Failed to load enquiries' });
    }
  }

  if (req.method === 'PATCH' && id.match(/^\d+$/)) {
    const { status, reply_subject, reply_body } = req.body || {};

    const current = await sql`select status, reply_subject, reply_body, replied_at from enquiries where id = ${id}`;
    if (!current.length) return res.status(404).json({ error: 'Enquiry not found' });
    const cur = current[0];

    const updates = {};
    const audits = [];

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      if (cur.status !== status) {
        audits.push(['status', cur.status, status]);
        updates.status = status;
      }
    }

    if (reply_subject !== undefined || reply_body !== undefined) {
      const subject = reply_subject !== undefined ? String(reply_subject).slice(0, 200) : (cur.reply_subject || '');
      const body = reply_body !== undefined ? String(reply_body).slice(0, 5000) : (cur.reply_body || '');
      if ((cur.reply_subject || '') !== subject) audits.push(['reply_subject', cur.reply_subject || '', subject]);
      if ((cur.reply_body || '') !== body) audits.push(['reply_body', cur.reply_body || '', body]);
      updates.reply_subject = subject || null;
      updates.reply_body = body || null;
      if (subject || body) {
        updates.replied_at = new Date().toISOString();
        if (!cur.replied_at) audits.push(['replied_at', '', updates.replied_at]);
        if (updates.status === undefined && cur.status !== 'replied') {
          audits.push(['status', cur.status, 'replied']);
          updates.status = 'replied';
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ success: true, message: 'No changes' });
    }

    try {
      const sets = [];
      if (updates.status !== undefined) sets.push(sql`status = ${updates.status}`);
      if ('reply_subject' in updates) sets.push(sql`reply_subject = ${updates.reply_subject}`);
      if ('reply_body' in updates) sets.push(sql`reply_body = ${updates.reply_body}`);
      if ('replied_at' in updates) sets.push(sql`replied_at = ${updates.replied_at}`);

      await sql`update enquiries set ${sql.join(sets, sql`, `)} where id = ${id}`;
      for (const [field, oldVal, newVal] of audits) {
        await logAudit(auth.adminEmail, 'enquiries', id, field, String(oldVal ?? ''), String(newVal ?? ''));
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('Enquiry update error:', e);
      return res.status(500).json({ error: 'Failed to update enquiry' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
