import { Clerk } from '@clerk/clerk-js';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  console.error('VITE_CLERK_PUBLISHABLE_KEY not set');
  document.body.innerHTML = '<p style="padding:2rem;color:red">Clerk publishable key not configured.</p>';
  throw new Error('Missing Clerk key');
}

const clerkDomain = atob(CLERK_PUBLISHABLE_KEY.split('_')[2]).slice(0, -1);

await new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'https://' + clerkDomain + '/npm/@clerk/ui@1/dist/ui.browser.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.onload = resolve;
  script.onerror = () => reject(new Error('Failed to load @clerk/ui bundle'));
  document.head.appendChild(script);
});

const clerk = new Clerk(CLERK_PUBLISHABLE_KEY);
await clerk.load({
  ui: { ClerkUI: window.__internal_ClerkUICtor },
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function apiFetch(path, options = {}) {
  const token = await clerk.session?.getToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('HTTP ' + res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast ' + (isError ? 'error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// --- Tabs ---
let currentTab = 'dashboard';

function switchTab(name) {
  currentTab = name;
  $$('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  ['dashboard', 'applications', 'enquiries', 'content', 'audit'].forEach(t => {
    const el = $('#tab-' + t);
    if (el) el.hidden = t !== name;
  });
  if (name === 'dashboard') loadStats();
  if (name === 'applications') loadApplications();
  if (name === 'enquiries') loadEnquiries();
  if (name === 'content') loadContent();
  if (name === 'audit') loadAudit();
}

$$('.admin-nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// --- Stats ---
async function loadStats() {
  try {
    const data = await apiFetch('/api/admin/stats');
    const s = data.stats || {};
    $('#stats').innerHTML =
      statCard(s.totalApplications, 'Total Applications') +
      statCard(s.submitted, 'Submitted') +
      statCard(s.underReview, 'Under Review') +
      statCard(s.accepted, 'Accepted') +
      statCard(s.rejected, 'Rejected') +
      statCard(s.feeReceived, 'Fees Received') +
      statCard(s.totalEnquiries, 'Total Enquiries') +
      statCard(s.newEnquiries, 'New Enquiries');
  } catch (e) {
    showToast('Failed to load stats: ' + e.message, true);
  }
}

function statCard(val, label) {
  return '<div class="stat"><span class="stat-val">' + escapeHtml(val ?? 0) + '</span><span class="stat-label">' + escapeHtml(label) + '</span></div>';
}

// --- Applications ---
let allApplications = [];
let selectedApps = new Set();

async function loadApplications() {
  try {
    const data = await apiFetch('/api/admin/applications');
    allApplications = data.applications || [];
    selectedApps.clear();
    renderApplications();
  } catch (e) {
    showToast('Failed to load applications: ' + e.message, true);
  }
}

function renderApplications() {
  const search = ($('#app-search')?.value || '').toLowerCase();
  const statusFilter = $('#app-status-filter')?.value || '';
  const filtered = allApplications.filter(a => {
    const matchSearch = !search || (a.reference || '').toLowerCase().includes(search) || (a.full_name || '').toLowerCase().includes(search) || (a.email || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const tbody = $('#applications-table tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(a => {
    const sel = selectedApps.has(a.id) ? 'checked' : '';
    return '<tr>' +
      '<td><input type="checkbox" class="app-sel" data-id="' + escapeHtml(a.id) + '" ' + sel + '></td>' +
      '<td><code>' + escapeHtml(a.reference) + '</code></td>' +
      '<td>' + escapeHtml(a.full_name) + '</td>' +
      '<td>' + escapeHtml(a.email) + '</td>' +
      '<td>' + escapeHtml(a.programme_name) + '</td>' +
      '<td><span class="badge ' + escapeHtml(a.status) + '">' + escapeHtml((a.status || '').replace('_', ' ')) + '</span></td>' +
      '<td>' + (a.fee_received ? '<span class="badge paid">Paid</span>' : '<span class="badge unpaid">Unpaid</span>') + '</td>' +
      '<td>' + escapeHtml(fmtDate(a.created_at)) + '</td>' +
      '<td><button class="btn view-app" data-id="' + escapeHtml(a.id) + '">View</button></td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--mut)">No applications</td></tr>';

  $$('.app-sel').forEach(cb => {
    cb.onchange = () => {
      if (cb.checked) selectedApps.add(cb.dataset.id);
      else selectedApps.delete(cb.dataset.id);
      updateBulkBar();
    };
  });
  $$('.view-app').forEach(btn => btn.onclick = () => openApplicationDialog(btn.dataset.id));
  updateBulkBar();
}

function updateBulkBar() {
  const bar = $('#app-bulk');
  const count = $('#app-bulk-count');
  if (!bar || !count) return;
  if (selectedApps.size > 0) {
    bar.hidden = false;
    count.textContent = selectedApps.size + ' selected';
  } else {
    bar.hidden = true;
  }
}

function openApplicationDialog(id) {
  const app = allApplications.find(a => a.id === id);
  if (!app) return;
  const dialog = $('#detail-dialog');
  $('#dialog-content').innerHTML =
    '<h2>Application</h2>' +
    '<dl class="detail-grid">' +
      detailRow('Reference', '<code>' + escapeHtml(app.reference) + '</code>', true) +
      detailRow('Name', app.full_name) +
      detailRow('Email', '<a href="mailto:' + escapeHtml(app.email) + '">' + escapeHtml(app.email) + '</a>', true) +
      detailRow('Phone', app.phone) +
      detailRow('Programme', app.programme_name) +
      detailRow('Date of birth', app.date_of_birth || '-') +
      detailRow('Address', app.address || '-') +
      detailRow('Education', app.education_background || '-') +
      detailRow('Additional info', app.additional_info || '-') +
      '<dt>Status</dt><dd><select id="app-status">' +
        ['submitted','under_review','accepted','rejected'].map(s => '<option value="' + s + '"' + (app.status === s ? ' selected' : '') + '>' + s.replace('_',' ') + '</option>').join('') +
      '</select></dd>' +
      '<dt>Fee received</dt><dd><label class="check"><input type="checkbox" id="app-fee"' + (app.fee_received ? ' checked' : '') + '> Mark as paid</label></dd>' +
      '<dt>Admin notes</dt><dd><textarea id="app-notes" rows="4">' + escapeHtml(app.admin_notes || '') + '</textarea></dd>' +
      detailRow('Submitted', fmtDate(app.created_at)) +
    '</dl>' +
    '<div class="dialog-actions">' +
      '<button type="button" class="btn" id="save-app">Save changes</button>' +
      '<button type="button" class="btn" value="cancel" id="close-app">Close</button>' +
    '</div>';
  $('#close-app').onclick = () => dialog.close();
  $('#save-app').onclick = async () => {
    const status = $('#app-status').value;
    const fee_received = $('#app-fee').checked;
    const admin_notes = $('#app-notes').value;
    try {
      await apiFetch('/api/admin/applications/' + app.id, { method: 'PATCH', body: JSON.stringify({ status, fee_received, admin_notes }) });
      showToast('Application updated');
      dialog.close();
      await Promise.all([loadApplications(), loadStats()]);
    } catch (e) {
      showToast(e.message, true);
    }
  };
  dialog.showModal();
}

function detailRow(label, value, isHtml = false) {
  return '<dt>' + escapeHtml(label) + '</dt><dd>' + (isHtml ? value : escapeHtml(value ?? '-')) + '</dd>';
}

// --- Enquiries ---
let allEnquiries = [];

async function loadEnquiries() {
  try {
    const data = await apiFetch('/api/admin/enquiries');
    allEnquiries = data.enquiries || [];
    renderEnquiries();
  } catch (e) {
    showToast('Failed to load enquiries: ' + e.message, true);
  }
}

function renderEnquiries() {
  const search = ($('#enq-search')?.value || '').toLowerCase();
  const statusFilter = $('#enq-status-filter')?.value || '';
  const filtered = allEnquiries.filter(e => {
    const matchSearch = !search || (e.name || '').toLowerCase().includes(search) || (e.email || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const tbody = $('#enquiries-table tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(e =>
    '<tr>' +
      '<td>' + escapeHtml(e.name) + '</td>' +
      '<td>' + escapeHtml(e.email) + '</td>' +
      '<td>' + escapeHtml((e.enquiry_type || '').replace('_', ' ')) + '</td>' +
      '<td><span class="badge ' + escapeHtml(e.status) + '">' + escapeHtml(e.status) + '</span></td>' +
      '<td>' + escapeHtml(fmtDate(e.created_at)) + '</td>' +
      '<td><button class="btn view-enq" data-id="' + e.id + '">View</button></td>' +
    '</tr>'
  ).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--mut)">No enquiries</td></tr>';

  $$('.view-enq').forEach(btn => btn.onclick = () => openEnquiryDialog(String(btn.dataset.id)));
}

function openEnquiryDialog(id) {
  const enq = allEnquiries.find(e => String(e.id) === String(id));
  if (!enq) return;
  const dialog = $('#detail-dialog');
  $('#dialog-content').innerHTML =
    '<h2>Enquiry</h2>' +
    '<dl class="detail-grid">' +
      detailRow('Name', enq.name) +
      detailRow('Email', '<a href="mailto:' + escapeHtml(enq.email) + '">' + escapeHtml(enq.email) + '</a>', true) +
      detailRow('Type', (enq.enquiry_type || '').replace('_', ' ')) +
      detailRow('Message', enq.message) +
      '<dt>Status</dt><dd><select id="enq-status">' +
        ['new','read','replied'].map(s => '<option value="' + s + '"' + (enq.status === s ? ' selected' : '') + '>' + s + '</option>').join('') +
      '</select></dd>' +
      '<dt>Reply subject</dt><dd><input type="text" id="enq-reply-subject" placeholder="Subject" value="' + escapeHtml(enq.reply_subject || '') + '"></dd>' +
      '<dt>Reply body</dt><dd><textarea id="enq-reply-body" rows="5" placeholder="Reply text (saved for record)">' + escapeHtml(enq.reply_body || '') + '</textarea></dd>' +
      detailRow('Received', fmtDate(enq.created_at)) +
      (enq.replied_at ? detailRow('Replied at', fmtDate(enq.replied_at)) : '') +
    '</dl>' +
    '<div class="dialog-actions">' +
      '<button type="button" class="btn" id="save-enq">Save status</button>' +
      '<button type="button" class="btn" id="save-reply">Save reply</button>' +
      '<button type="button" class="btn" value="cancel" id="close-enq">Close</button>' +
    '</div>';

  $('#close-enq').onclick = () => dialog.close();
  $('#save-enq').onclick = async () => {
    const status = $('#enq-status').value;
    try {
      await apiFetch('/api/admin/enquiries/' + enq.id, { method: 'PATCH', body: JSON.stringify({ status }) });
      showToast('Enquiry updated');
      dialog.close();
      await Promise.all([loadEnquiries(), loadStats()]);
    } catch (e) { showToast(e.message, true); }
  };
  $('#save-reply').onclick = async () => {
    const reply_subject = $('#enq-reply-subject').value.trim();
    const reply_body = $('#enq-reply-body').value.trim();
    if (!reply_subject || !reply_body) { showToast('Enter subject and reply', true); return; }
    try {
      const res = await apiFetch('/api/admin/enquiries/' + enq.id, { method: 'PATCH', body: JSON.stringify({ status: 'replied', reply_subject, reply_body }) });
      if (res && res.emailSent) showToast('Reply saved and email sent');
      else if (res && res.warning) showToast(res.warning, false);
      else showToast('Reply saved');
      dialog.close();
      await Promise.all([loadEnquiries(), loadStats()]);
    } catch (e) { showToast(e.message, true); }
  };
  dialog.showModal();
}

// --- Content management ---
let contentType = 'programmes';
let contentItems = [];

const CONTENT_CONFIG = {
  programmes: {
    label: 'Programmes',
    fields: [
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'duration', label: 'Duration', type: 'text' },
      { key: 'level', label: 'Level', type: 'text' },
      { key: 'requirements', label: 'Requirements', type: 'textarea' },
      { key: 'fee_ghs', label: 'Fee (GHS)', type: 'number' },
      { key: 'image_path', label: 'Image path', type: 'text' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'published', label: 'Published', type: 'checkbox' },
    ],
  },
  gallery_items: {
    label: 'Gallery items',
    fields: [
      { key: 'collection', label: 'Collection (design/student)', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'student_name', label: 'Student name', type: 'text' },
      { key: 'student_name_approved', label: 'Student name approved', type: 'checkbox' },
      { key: 'image_path', label: 'Image path', type: 'text' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'published', label: 'Published', type: 'checkbox' },
    ],
  },
  achievements: {
    label: 'Achievements',
    fields: [
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'image_path', label: 'Image path', type: 'text' },
      { key: 'verified', label: 'Verified', type: 'checkbox' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'published', label: 'Published', type: 'checkbox' },
    ],
  },
};

async function loadContent() {
  const panel = $('#content-panel');
  if (!panel) return;
  panel.innerHTML = '<p style="color:var(--mut)">Loading...</p>';
  try {
    const data = await apiFetch('/api/admin/content/' + contentType);
    contentItems = data.items || [];
    renderContent();
  } catch (e) {
    panel.innerHTML = '<p style="color:#dc3c3c">Failed to load: ' + escapeHtml(e.message) + '</p>';
  }
}

function renderContent() {
  const cfg = CONTENT_CONFIG[contentType];
  const panel = $('#content-panel');
  const rows = contentItems.map(item => {
    const name = escapeHtml(item.name || item.title || item.slug || ('#' + item.id));
    const published = item.published ? '<span class="badge accepted">Published</span>' : '<span class="badge rejected">Draft</span>';
    const extra = item.verified !== undefined ? (item.verified ? ' <span class="badge paid">Verified</span>' : '') : '';
    return '<tr>' +
      '<td>' + escapeHtml(item.id) + '</td>' +
      '<td>' + name + '</td>' +
      '<td>' + published + extra + '</td>' +
      '<td>' + escapeHtml(item.sort_order ?? '') + '</td>' +
      '<td><button class="btn edit-content" data-id="' + escapeHtml(item.id) + '">Edit</button> <button class="btn del-content" data-id="' + escapeHtml(item.id) + '">Delete</button></td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--mut)">No items</td></tr>';

  panel.innerHTML =
    '<div class="content-head"><h3>' + escapeHtml(cfg.label) + '</h3><button class="btn g" id="add-content">Add new</button></div>' +
    '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name/Title</th><th>Status</th><th>Order</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';

  $('#add-content').onclick = () => openContentDialog(null);
  $$('.edit-content').forEach(b => b.onclick = () => openContentDialog(b.dataset.id));
  $$('.del-content').forEach(b => b.onclick = () => deleteContent(b.dataset.id));
}

function openContentDialog(id) {
  const cfg = CONTENT_CONFIG[contentType];
  const item = id ? contentItems.find(i => String(i.id) === String(id)) : null;
  const dialog = $('#content-dialog');
  const fieldsHtml = cfg.fields.map(f => {
    const val = item ? item[f.key] : (f.type === 'checkbox' ? false : (f.type === 'number' ? 0 : ''));
    if (f.type === 'checkbox') {
      return '<label class="field"><span>' + escapeHtml(f.label) + '</span><input type="checkbox" name="' + f.key + '"' + (val ? ' checked' : '') + '></label>';
    }
    if (f.type === 'textarea') {
      return '<label class="field field-full"><span>' + escapeHtml(f.label) + '</span><textarea name="' + f.key + '" rows="3">' + escapeHtml(val ?? '') + '</textarea></label>';
    }
    return '<label class="field"><span>' + escapeHtml(f.label) + '</span><input type="' + f.type + '" name="' + f.key + '" value="' + escapeHtml(val ?? '') + '"' + (f.type === 'number' ? ' step="any"' : '') + '></label>';
  }).join('');

  $('#content-dialog-content').innerHTML =
    '<h2>' + (item ? 'Edit' : 'New') + ' ' + escapeHtml(cfg.label.slice(0, -1)) + '</h2>' +
    '<form id="content-form" class="content-form">' + fieldsHtml + '</form>' +
    '<div class="dialog-actions">' +
      '<button type="button" class="btn g" id="save-content">Save</button>' +
      '<button type="button" class="btn" id="cancel-content">Cancel</button>' +
    '</div>';

  $('#cancel-content').onclick = () => dialog.close();
  $('#save-content').onclick = async () => {
    const form = $('#content-form');
    const body = {};
    cfg.fields.forEach(f => {
      const el = form.querySelector('[name="' + f.key + '"]');
      if (!el) return;
      if (f.type === 'checkbox') body[f.key] = el.checked;
      else body[f.key] = el.value;
    });
    try {
      if (item) {
        await apiFetch('/api/admin/content/' + contentType + '/' + item.id, { method: 'PATCH', body: JSON.stringify(body) });
        showToast('Item updated');
      } else {
        await apiFetch('/api/admin/content/' + contentType, { method: 'POST', body: JSON.stringify(body) });
        showToast('Item created');
      }
      dialog.close();
      await loadContent();
    } catch (e) { showToast(e.message, true); }
  };
  dialog.showModal();
}

async function deleteContent(id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await apiFetch('/api/admin/content/' + contentType + '/' + id, { method: 'DELETE' });
    showToast('Item deleted');
    await loadContent();
  } catch (e) { showToast(e.message, true); }
}

$$('.content-tab').forEach(b => b.addEventListener('click', () => {
  contentType = b.dataset.content;
  $$('.content-tab').forEach(x => x.classList.toggle('active', x === b));
  loadContent();
}));

// --- Audit ---
async function loadAudit() {
  const tbody = $('#audit-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--mut)">Loading...</td></tr>';
  try {
    const table = $('#audit-table-filter')?.value || '';
    const q = table ? ('?table=' + encodeURIComponent(table)) : '';
    const data = await apiFetch('/api/admin/audit' + q);
    const logs = data.logs || [];
    tbody.innerHTML = logs.map(l =>
      '<tr>' +
        '<td>' + escapeHtml(l.admin_email) + '</td>' +
        '<td>' + escapeHtml(l.target_table) + '</td>' +
        '<td><code>' + escapeHtml(String(l.target_id)) + '</code></td>' +
        '<td>' + escapeHtml(l.field_changed) + '</td>' +
        '<td class="muted-cell" title="' + escapeHtml(l.old_value ?? '') + '">' + escapeHtml(l.old_value ?? '') + '</td>' +
        '<td class="muted-cell" title="' + escapeHtml(l.new_value ?? '') + '">' + escapeHtml(l.new_value ?? '') + '</td>' +
        '<td>' + escapeHtml(fmtDate(l.changed_at)) + '</td>' +
      '</tr>'
    ).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--mut)">No audit entries</td></tr>';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#dc3c3c">Failed to load: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

// --- Event wiring ---
function wireEvents() {
  $('#app-search')?.addEventListener('input', renderApplications);
  $('#app-status-filter')?.addEventListener('change', renderApplications);
  $('#enq-search')?.addEventListener('input', renderEnquiries);
  $('#enq-status-filter')?.addEventListener('change', renderEnquiries);
  $('#audit-table-filter')?.addEventListener('change', loadAudit);

  const selectAll = $('#app-select-all');
  if (selectAll) selectAll.onchange = (e) => {
    const checked = e.target.checked;
    $$('.app-sel').forEach(cb => { cb.checked = checked; });
    const search = ($('#app-search')?.value || '').toLowerCase();
    const statusFilter = $('#app-status-filter')?.value || '';
    const filtered = allApplications.filter(a => {
      const matchSearch = !search || (a.reference || '').toLowerCase().includes(search) || (a.full_name || '').toLowerCase().includes(search) || (a.email || '').toLowerCase().includes(search);
      const matchStatus = !statusFilter || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
    if (checked) filtered.forEach(a => selectedApps.add(a.id));
    else filtered.forEach(a => selectedApps.delete(a.id));
    updateBulkBar();
  };

  $('#app-bulk-apply')?.addEventListener('click', async () => {
    const status = $('#app-bulk-status').value;
    if (!status) { showToast('Select a status', true); return; }
    if (!confirm('Set status to ' + status.replace('_',' ') + ' for ' + selectedApps.size + ' applications?')) return;
    try {
      for (const id of selectedApps) {
        await apiFetch('/api/admin/applications/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
      }
      showToast('Updated ' + selectedApps.size + ' applications');
      selectedApps.clear();
      if (selectAll) selectAll.checked = false;
      await Promise.all([loadApplications(), loadStats()]);
    } catch (e) { showToast(e.message, true); }
  });

  $('#app-bulk-clear')?.addEventListener('click', () => {
    selectedApps.clear();
    if (selectAll) selectAll.checked = false;
    updateBulkBar();
    renderApplications();
  });

  $('#app-export')?.addEventListener('click', () => {
    if (!allApplications.length) { showToast('No applications to export', true); return; }
    const rows = allApplications.map(a => ({
      reference: a.reference, full_name: a.full_name, email: a.email, phone: a.phone || '',
      programme_name: a.programme_name, status: a.status, fee_received: a.fee_received ? 'Yes' : 'No',
      created_at: a.created_at || ''
    }));
    const header = Object.keys(rows[0]).join(',');
    const csv = [header].concat(rows.map(r => Object.values(r).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'applications-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported');
  });

  $('#sign-out')?.addEventListener('click', async () => {
    await clerk.signOut();
    window.location.reload();
  });
}

async function init() {
  wireEvents();
  const signInEl = $('#sign-in-container');
  if (signInEl) signInEl.remove();
  if (!clerk.user) {
    $('#admin-app').hidden = true;
    $('#user-info').hidden = true;
    $('#sign-out').hidden = true;
    const container = document.createElement('div');
    container.id = 'sign-in-container';
    container.style.maxWidth = '420px';
    container.style.margin = '60px auto';
    document.body.appendChild(container);
    clerk.mountSignIn(container, { afterSignInUrl: '/admin/', afterSignUpUrl: '/admin/' });
    return;
  }
  const email = clerk.user.primaryEmailAddress?.emailAddress || clerk.user.username || 'Admin';
  $('#user-info').hidden = false;
  $('#user-info').textContent = email;
  $('#sign-out').hidden = false;
  $('#admin-app').hidden = false;
  try {
    await apiFetch('/api/admin/stats');
  } catch (e) {
    const msg = e && e.status === 403
      ? 'Access denied: your account is not in ADMIN_EMAILS.'
      : e && e.status === 401
        ? 'Session/auth failed. Sign out and sign in again, and ensure the deployment uses matching Clerk keys and the latest code.'
        : ('Access denied: ' + (e && e.message ? e.message : 'Unknown error'));
    $('#admin-app').innerHTML = '<div class="w" style="padding:40px 0"><p style="color:#dc3c3c">' + escapeHtml(msg) + '</p><p style="color:var(--mut)">If this persists, verify Vercel env vars (CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, ADMIN_EMAILS, DATABASE_URL, RATE_LIMIT_SALT) and redeploy.</p></div>';
    $('#admin-app').hidden = false;
    return;
  }
  switchTab('dashboard');
}

init();
