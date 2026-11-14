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

    let nextStatus = cur.status;
    let nextSubject = cur.reply_subject || null;
    let nextBody = cur.reply_body || null;
    let nextRepliedAt = cur.replied_at || null;
    const audits = [];

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      if (cur.status !== status) {
        audits.push(['status', cur.status, status]);
        nextStatus = status;
      }
    }

    if (reply_subject !== undefined || reply_body !== undefined) {
      const subject = reply_subject !== undefined ? String(reply_subject).slice(0, 200) : (cur.reply_subject || '');
      const body = reply_body !== undefined ? String(reply_body).slice(0, 5000) : (cur.reply_body || '');
      if ((cur.reply_subject || '') !== subject) audits.push(['reply_subject', cur.reply_subject || '', subject]);
      if ((cur.reply_body || '') !== body) audits.push(['reply_body', cur.reply_body || '', body]);
      nextSubject = subject || null;
      nextBody = body || null;
      if (subject || body) {
        if (!cur.replied_at) {
          nextRepliedAt = new Date().toISOString();
          audits.push(['replied_at', '', nextRepliedAt]);
        }
        if (status === undefined && cur.status !== 'replied') {
          audits.push(['status', cur.status, 'replied']);
          nextStatus = 'replied';
        }
      }
    }

    const changed = audits.length > 0 || nextStatus !== cur.status || nextSubject !== (cur.reply_subject || null) || nextBody !== (cur.reply_body || null) || nextRepliedAt !== (cur.replied_at || null);
    if (!changed) {
      return res.status(200).json({ success: true, message: 'No changes' });
    }

    try {
      await sql`update enquiries set status = ${nextStatus}, reply_subject = ${nextSubject}, reply_body = ${nextBody}, replied_at = ${nextRepliedAt} where id = ${id}`;
      for (const [field, oldVal, newVal] of audits) {
        await logAudit(auth.adminEmail, 'enquiries', id, field, String(oldVal ?? ''), String(newVal ?? ''));
      }

      let emailSent = false;
      let emailWarning = null;
      const wantsReply = (reply_subject !== undefined || reply_body !== undefined) && nextSubject && nextBody;
      if (wantsReply) {
        const resendKey = process.env.RESEND_API_KEY;
        const from = process.env.REPLY_FROM_EMAIL;
        const to = cur.email;
        if (resendKey && from && to) {
          try {
            const resp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + resendKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from,
                to: [to],
                subject: nextSubject,
                text: nextBody,
              }),
            });
            if (resp.ok) {
              emailSent = true;
            } else {
              const detail = await resp.text().catch(() => '');
              emailWarning = 'Reply saved but email failed to send.';
              console.error('Reply email send failed:', resp.status, detail);
            }
          } catch (mailErr) {
            emailWarning = 'Reply saved but email failed to send.';
            console.error('Reply email send error:', mailErr);
          }
        } else if (!resendKey || !from) {
          emailWarning = 'Reply saved. Email not sent (configure RESEND_API_KEY and REPLY_FROM_EMAIL to enable sending).';
        }
      }

      return res.status(200).json({ success: true, emailSent, ...(emailWarning ? { warning: emailWarning } : {}) });
    } catch (e) {
      console.error('Enquiry update error:', e);
      return res.status(500).json({ error: 'Failed to update enquiry' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
