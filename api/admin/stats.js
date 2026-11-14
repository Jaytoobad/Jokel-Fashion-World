import { verifyAdmin, sql } from './_auth.js';

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const [apps, enquiries] = await Promise.all([
      sql`select status, fee_received from applications`,
      sql`select status from enquiries`,
    ]);

    const stats = {
      totalApplications: apps.length,
      submitted: apps.filter(a => a.status === 'submitted').length,
      underReview: apps.filter(a => a.status === 'under_review').length,
      accepted: apps.filter(a => a.status === 'accepted').length,
      rejected: apps.filter(a => a.status === 'rejected').length,
      feeReceived: apps.filter(a => a.fee_received).length,
      totalEnquiries: enquiries.length,
      newEnquiries: enquiries.filter(e => e.status === 'new').length,
    };

    return res.status(200).json({ stats });
  } catch (e) {
    console.error('Stats error:', e);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
}