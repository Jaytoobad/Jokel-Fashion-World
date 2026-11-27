const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const AUTH_KEY = 'admin_auth_token';
const AUTH_USER = 'admin_user';

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
    .replace(/'/g, '&#x27;');
}

function getToken() {
  return localStorage.getItem(AUTH_KEY);
}

function setToken(token, user) {
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(AUTH_USER, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_USER);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER) || 'null');
  } catch {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('Not signed in');

  const isStateChanging = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(
    (options.method || 'GET').toUpperCase()
  );
  let csrfToken = '';
  if (isStateChanging) {
    const match = document.cookie.match('(?:^|; )csrf_token=([^;]*)');
    csrfToken = match ? match[1] : '';
  }

  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        clearAuth();
        showToast('Session expired. Please sign in again.', true);
        setTimeout(() => location.reload(), 1500);
        throw new Error('Session expired');
      }
      const err = new Error(data.error || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.message === 'Session expired') throw e;
    if (e instanceof TypeError || (e.message && e.message.includes('fetch'))) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw e;
  }
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast ' + (isError ? 'error' : '');
  t.setAttribute('role', isError ? 'alert' : 'status');
  t.textContent = msg;
  ($('#toasts') || document.body).appendChild(t);
  setTimeout(() => t.remove(), isError ? 6000 : 3500);
}

// --- Tabs ---
const TABS = ['dashboard', 'applications', 'enquiries', 'content', 'audit'];
let currentTab = 'dashboard';

function switchTab(name, opts = {}) {
  if (!TABS.includes(name)) name = 'dashboard';
  currentTab = name;
  $$('.adm-link').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  $$('.adm-sec').forEach(p => {
    p.hidden = p.dataset.tab !== name;
  });
  if (!opts.skipLoad) loadTab(name);
}

async function loadTab(name) {
  try {
    if (name === 'dashboard') await loadDashboard();
    else if (name === 'applications') await loadApplications();
    else if (name === 'enquiries') await loadEnquiries();
    else if (name === 'content') await loadContent();
    else if (name === 'audit') await loadAudit();
  } catch (e) {
    showToast('Failed to load ' + name + ': ' + e.message, true);
  }
}

// --- Dashboard ---
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/admin/stats');
    const s = data.stats || data;
    const grid = $('#stats');
    grid.innerHTML = `
      <div class="stat"><div class="stat-val">${s.totalApplications ?? 0}</div><div class="stat-label">Total Applications</div></div>
      <div class="stat"><div class="stat-val">${s.submitted ?? 0}</div><div class="stat-label">New Applications</div></div>
      <div class="stat"><div class="stat-val">${s.totalEnquiries ?? 0}</div><div class="stat-label">Total Enquiries</div></div>
      <div class="stat"><div class="stat-val">${s.newEnquiries ?? 0}</div><div class="stat-label">New Enquiries</div></div>
      <div class="stat"><div class="stat-val">${s.programmes ?? 0}</div><div class="stat-label">Programmes</div></div>
      <div class="stat"><div class="stat-val">${s.gallery_items ?? 0}</div><div class="stat-label">Gallery Items</div></div>
      <div class="stat"><div class="stat-val">${s.achievements ?? 0}</div><div class="stat-label">Achievements</div></div>
    `;
  } catch (e) {
    showToast('Failed to load dashboard: ' + e.message, true);
  }
}

// --- Applications ---
let appsCache = [];
let appsPage = 1;
const APPS_PER_PAGE = 25;

async function loadApplications() {
  try {
    const data = await apiFetch('/api/admin/applications');
    appsCache = data.applications || [];
    appsPage = 1;
    renderApplications();
  } catch (e) {
    showToast('Failed to load applications: ' + e.message, true);
  }
}

function renderApplications() {
  const start = (appsPage - 1) * APPS_PER_PAGE;
  const pageItems = appsCache.slice(start, start + APPS_PER_PAGE);
  const tbody = $('#apps-tbody');
  tbody.innerHTML = pageItems.map(a => `
    <tr data-id="${a.id}">
      <td>${escapeHtml(a.reference)}</td>
      <td>${escapeHtml(a.programme_name)}</td>
      <td>${escapeHtml(a.full_name)}</td>
      <td>${escapeHtml(a.email)}</td>
      <td>${escapeHtml(a.phone)}</td>
      <td><span class="badge ${a.status}">${escapeHtml(a.status)}</span></td>
      <td>${fmtDate(a.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--mut)">No applications</td></tr>';
  $('#apps-pagination').innerHTML = renderPagination(appsCache.length, appsPage, APPS_PER_PAGE, 'apps');
  attachRowClicks('apps');
}

function renderPagination(total, page, perPage, prefix) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return '';
  let html = '<div class="pagination">';
  if (page > 1) html += `<button data-page="${page - 1}">Prev</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) {
      html += `<button data-page="${i}" ${i === page ? 'class="active"' : ''}>${i}</button>`;
    } else if (i === page - 2 || i === page + 2) {
      html += '<span>…</span>';
    }
  }
  if (page < pages) html += `<button data-page="${page + 1}">Next</button>`;
  html += '</div>';
  return html;
}

function attachRowClicks(prefix) {
  $$(`#${prefix}-tbody tr[data-id]`).forEach(tr => {
    tr.addEventListener('click', () => {
      if (prefix === 'apps') openApplicationDialog(tr.dataset.id);
      else if (prefix === 'enqs') openEnquiryDialog(tr.dataset.id);
    });
  });
  $$(`#${prefix}-pagination button[data-page]`).forEach(btn => {
    btn.addEventListener('click', () => {
      if (prefix === 'apps') { appsPage = +btn.dataset.page; renderApplications(); }
      else if (prefix === 'enqs') { enqsPage = +btn.dataset.page; renderEnquiries(); }
    });
  });
}

// --- Applications Detail ---
async function openApplicationDialog(id) {
  try {
    const data = await apiFetch('/api/admin/applications/' + id);
    const a = data.application;
    const dialog = $('#app-dialog');
    dialog.innerHTML = `
      <h2>Application ${escapeHtml(a.reference)}</h2>
      <button class="dialog-close" aria-label="Close">&times;</button>
      <div class="detail-grid">
        <dt>Reference</dt><dd>${escapeHtml(a.reference)}</dd>
        <dt>Programme</dt><dd>${escapeHtml(a.programme_name)}</dd>
        <dt>Full Name</dt><dd>${escapeHtml(a.full_name)}</dd>
        <dt>Email</dt><dd>${escapeHtml(a.email)}</dd>
        <dt>Phone</dt><dd>${escapeHtml(a.phone)}</dd>
        <dt>Date of Birth</dt><dd>${a.date_of_birth ? fmtDate(a.date_of_birth) : ''}</dd>
        <dt>Address</dt><dd>${escapeHtml(a.address || '')}</dd>
        <dt>Education</dt><dd>${escapeHtml(a.education_background || '')}</dd>
        <dt>Additional Info</dt><dd>${escapeHtml(a.additional_info || '')}</dd>
        <dt>Status</dt><dd>
          <select id="app-status">
            <option value="submitted" ${a.status === 'submitted' ? 'selected' : ''}>Submitted</option>
            <option value="under_review" ${a.status === 'under_review' ? 'selected' : ''}>Under Review</option>
            <option value="accepted" ${a.status === 'accepted' ? 'selected' : ''}>Accepted</option>
            <option value="rejected" ${a.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </dd>
        <dt>Fee Received</dt><dd>
          <label class="check"><input type="checkbox" id="app-fee" ${a.fee_received ? 'checked' : ''}> Yes</label>
        </dd>
        <dt>Admin Notes</dt><dd><textarea id="app-notes">${escapeHtml(a.admin_notes || '')}</textarea></dd>
      </div>
      <div class="dialog-actions">
        <button class="btn" id="app-save">Save Changes</button>
      </div>
    `;
    dialog.showModal();
    $('#app-dialog .dialog-close').onclick = () => dialog.close();
    $('#app-save').onclick = async () => {
      const status = $('#app-status').value;
      const fee_received = $('#app-fee').checked;
      const admin_notes = $('#app-notes').value;
      try {
        await apiFetch('/api/admin/applications/' + id, {
          method: 'PATCH',
          body: JSON.stringify({ status, fee_received, admin_notes })
        });
        showToast('Application updated');
        dialog.close();
        await loadApplications();
      } catch (e) { showToast('Save failed: ' + e.message, true); }
    };
  } catch (e) { showToast('Failed to load application: ' + e.message, true); }
}

// --- Enquiries ---
let enqsCache = [];
let enqsPage = 1;
const ENQS_PER_PAGE = 25;

async function loadEnquiries() {
  try {
    const data = await apiFetch('/api/admin/enquiries');
    enqsCache = data.enquiries || [];
    enqsPage = 1;
    renderEnquiries();
  } catch (e) {
    showToast('Failed to load enquiries: ' + e.message, true);
  }
}

function renderEnquiries() {
  const start = (enqsPage - 1) * ENQS_PER_PAGE;
  const pageItems = enqsCache.slice(start, start + ENQS_PER_PAGE);
  const tbody = $('#enqs-tbody');
  tbody.innerHTML = pageItems.map(e => `
    <tr data-id="${e.id}">
      <td>${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.email)}</td>
      <td>${escapeHtml(e.enquiry_type)}</td>
      <td><span class="badge ${e.status}">${escapeHtml(e.status)}</span></td>
      <td>${fmtDate(e.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--mut)">No enquiries</td></tr>';
  $('#enqs-pagination').innerHTML = renderPagination(enqsCache.length, enqsPage, ENQS_PER_PAGE, 'enqs');
  attachRowClicks('enqs');
}

async function openEnquiryDialog(id) {
  try {
    const data = await apiFetch('/api/admin/enquiries/' + id);
    const e = data.enquiry;
    const dialog = $('#enq-dialog');
    dialog.innerHTML = `
      <h2>Enquiry from ${escapeHtml(e.name)}</h2>
      <button class="dialog-close" aria-label="Close">&times;</button>
      <div class="detail-grid">
        <dt>Name</dt><dd>${escapeHtml(e.name)}</dd>
        <dt>Email</dt><dd>${escapeHtml(e.email)}</dd>
        <dt>Type</dt><dd>${escapeHtml(e.enquiry_type)}</dd>
        <dt>Message</dt><dd>${escapeHtml(e.message)}</dd>
        <dt>Status</dt><dd>
          <select id="enq-status">
            <option value="new" ${e.status === 'new' ? 'selected' : ''}>New</option>
            <option value="read" ${e.status === 'read' ? 'selected' : ''}>Read</option>
            <option value="replied" ${e.status === 'replied' ? 'selected' : ''}>Replied</option>
          </select>
        </dd>
        <dt>Reply Subject</dt><dd><input type="text" id="enq-reply-subject" placeholder="Subject"></dd>
        <dt>Reply Body</dt><dd><textarea id="enq-reply-body" rows="6" placeholder="Your reply..."></textarea></dd>
      </div>
      <div class="dialog-actions">
        <button class="btn" id="enq-save-reply">Save Reply & Mark Replied</button>
        <button class="btn" id="enq-save-status">Save Status Only</button>
      </div>
    `;
    dialog.showModal();
    $('#enq-dialog .dialog-close').onclick = () => dialog.close();
    $('#enq-save-reply').onclick = async () => {
      const reply_subject = $('#enq-reply-subject').value.trim();
      const reply_body = $('#enq-reply-body').value.trim();
      if (!reply_subject || !reply_body) { showToast('Enter subject and reply', true); return; }
      try {
        const res = await apiFetch('/api/admin/enquiries/' + e.id, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'replied', reply_subject, reply_body })
        });
        if (res && res.emailSent) showToast('Reply saved and email sent');
        else if (res && res.warning) showToast(res.warning, false);
        else showToast('Reply saved');
        dialog.close();
        await loadEnquiries();
      } catch (err) { showToast('Save failed: ' + err.message, true); }
    };
    $('#enq-save-status').onclick = async () => {
      const status = $('#enq-status').value;
      try {
        await apiFetch('/api/admin/enquiries/' + e.id, { method: 'PATCH', body: JSON.stringify({ status }) });
        showToast('Status updated');
        dialog.close();
        await loadEnquiries();
      } catch (err) { showToast('Save failed: ' + err.message, true); }
    };
  } catch (err) { showToast('Failed to load enquiry: ' + err.message, true); }
}

// --- Content ---
const CONTENT_TABLES = ['programmes', 'gallery_items', 'achievements'];
let currentContentTable = 'programmes';
let contentCache = [];

async function loadContent() {
  currentContentTable = 'programmes';
  $('#content-tabs').innerHTML = CONTENT_TABLES.map(t => `
    <button class="content-tab ${t === currentContentTable ? 'active' : ''}" data-table="${t}">${t.replace('_', ' ')}</button>
  `).join('');
  $$('.content-tab').forEach(b => b.onclick = () => switchContentTable(b.dataset.table));
  await loadContentTable(currentContentTable);
}

async function switchContentTable(table) {
  currentContentTable = table;
  $$('.content-tab').forEach(b => b.classList.toggle('active', b.dataset.table === table));
  await loadContentTable(table);
}

async function loadContentTable(table) {
  try {
    const data = await apiFetch('/api/admin/content/' + table);
    contentCache = data.items || [];
    renderContentTable(table);
  } catch (e) { showToast('Failed to load ' + table + ': ' + e.message, true); }
}

function renderContentTable(table) {
  const tbody = $('#content-tbody');
  const isGallery = table === 'gallery_items';
  tbody.innerHTML = contentCache.map(item => `
    <tr data-id="${item.id}">
      <td>${escapeHtml(item.name || item.title || item.id)}</td>
      <td>${isGallery ? escapeHtml(item.collection) : escapeHtml(item.slug || '')}</td>
      <td>${item.published !== undefined ? (item.published ? 'Yes' : 'No') : ''}</td>
      <td>${fmtDate(item.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--mut)">No items</td></tr>';
  attachContentRowClicks(table);
}

function attachContentRowClicks(table) {
  $$('#content-tbody tr[data-id]').forEach(tr => {
    tr.addEventListener('click', () => openContentDialog(table, tr.dataset.id));
  });
}

async function openContentDialog(table, id) {
  try {
    const data = await apiFetch('/api/admin/content/' + table + '/' + id);
    const item = data.item;
    const dialog = $('#content-dialog');
    let fieldsHtml = '';
    for (const [key, val] of Object.entries(item)) {
      if (key === 'id') continue;
      const isBool = typeof val === 'boolean';
      const isText = typeof val === 'string' && val.length > 100;
      if (isBool) {
        fieldsHtml += `<dt>${escapeHtml(key)}</dt><dd><label class="check"><input type="checkbox" name="${key}" ${val ? 'checked' : ''}> Yes</label></dd>`;
      } else if (isText) {
        fieldsHtml += `<dt>${escapeHtml(key)}</dt><dd class="field-full"><textarea name="${key}">${escapeHtml(val)}</textarea></dd>`;
      } else {
        fieldsHtml += `<dt>${escapeHtml(key)}</dt><dd><input type="text" name="${key}" value="${escapeHtml(String(val ?? ''))}"></dd>`;
      }
    }
    dialog.innerHTML = `
      <h2>${table.replace('_', ' ')} - ${escapeHtml(item.name || item.title || id)}</h2>
      <button class="dialog-close" aria-label="Close">&times;</button>
      <div class="detail-grid">${fieldsHtml}</div>
      <div class="dialog-actions">
        <button class="btn" id="content-save">Save</button>
        <button class="btn" id="content-delete" style="background:transparent;color:#dc3c3c;border-color:#dc3c3c">Delete</button>
      </div>
    `;
    dialog.showModal();
    $('#content-dialog .dialog-close').onclick = () => dialog.close();
    $('#content-save').onclick = async () => {
      const updates = {};
      $$('#content-dialog [name]').forEach(el => {
        if (el.type === 'checkbox') updates[el.name] = el.checked;
        else updates[el.name] = el.value;
      });
      try {
        await apiFetch('/api/admin/content/' + table + '/' + id, { method: 'PATCH', body: JSON.stringify(updates) });
        showToast('Saved');
        dialog.close();
        await loadContentTable(table);
      } catch (e) { showToast('Save failed: ' + e.message, true); }
    };
    $('#content-delete').onclick = async () => {
      if (!confirm('Delete this item?')) return;
      try {
        await apiFetch('/api/admin/content/' + table + '/' + id, { method: 'DELETE' });
        showToast('Deleted');
        dialog.close();
        await loadContentTable(table);
      } catch (e) { showToast('Delete failed: ' + e.message, true); }
    };
  } catch (e) { showToast('Failed to load item: ' + e.message, true); }
}

// --- Audit ---
async function loadAudit() {
  try {
    const data = await apiFetch('/api/admin/audit');
    const tbody = $('#audit-tbody');
    tbody.innerHTML = (data.logs || []).map(l => `
      <tr>
        <td>${fmtDate(l.created_at)}</td>
        <td>${escapeHtml(l.admin_email)}</td>
        <td>${escapeHtml(l.target_table)}</td>
        <td>${escapeHtml(l.target_id)}</td>
        <td>${escapeHtml(l.field)}</td>
        <td>${escapeHtml(l.old_value)}</td>
        <td>${escapeHtml(l.new_value)}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--mut)">No audit logs</td></tr>';
  } catch (e) { showToast('Failed to load audit: ' + e.message, true); }
}

// --- Auth ---
async function doLogin(email, password) {
  const btn = $('#login-btn');
  const msg = $('#login-msg');
  btn.disabled = true; btn.textContent = 'Signing in...';
  msg.hidden = true; msg.textContent = ''; msg.className = 'note f';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setToken(data.token, { email: data.email, name: data.name, id: data.id });
    showToast('Signed in as ' + data.email);
    initApp();
  } catch (e) {
    msg.hidden = false; msg.textContent = e.message; msg.className = 'note f error';
  } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
}

async function doLogout() {
  clearAuth();
  window.location.reload();
}

function showLoginForm() {
  $('#admin-app').hidden = true;
  $('#user-info').hidden = true;
  $('#sign-out').hidden = true;
  const loginHtml = `
    <div id="login-container" style="max-width:400px;margin:60px auto;padding:0">
      <div class="login-card">
        <div class="login-header">
          <img src="/images/logo.png" alt="" width="40" height="40">
          <div>
            <h2 style="margin:0 0 4px 0">Jokel Admin</h2>
            <p style="margin:0;color:var(--mut);font-size:.85rem">Sign in to manage your fashion house</p>
          </div>
        </div>
        <form id="login-form">
          <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--mut);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Email</label>
          <input type="email" name="email" required autocomplete="email" class="login-input" placeholder="you@studio.com">
          <div class="login-pw-wrap" style="position:relative;margin-top:16px">
            <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--mut);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">Password</label>
            <input type="password" name="password" required autocomplete="current-password" class="login-input" placeholder="••••••••" style="padding-right:44px">
            <button type="button" id="login-toggle-pw" class="login-pw-toggle" aria-label="Toggle password visibility">&#128065;</button>
          </div>
          <div class="note f error" id="login-msg" hidden></div>
          <button class="btn g" type="submit" id="login-btn" style="width:100%;margin-top:24px">Sign In</button>
        </form>
        <div class="login-footer" style="margin-top:20px">
          <a href="/" class="login-back" style="text-decoration:none;color:var(--mut);font-size:.8rem">← Back to site</a>
        </div>
      </div>
    </div>
  `;
  let container = $('#login-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'login-container';
    document.body.appendChild(container);
  }
  container.innerHTML = loginHtml;
  container.hidden = false;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await doLogin(fd.get('email'), fd.get('password'));
  };
  $('#login-toggle-pw')?.addEventListener('click', () => {
    const inp = $('input[name="password"]');
    if (!inp) return;
    if (inp.type === 'password') {
      inp.type = 'text';
      $('#login-toggle-pw').textContent = '&#128064;';
    } else {
      inp.type = 'password';
      $('#login-toggle-pw').textContent = '&#128065;';
    }
  });
}

function initApp() {
  const user = getUser();
  if (!user) { showLoginForm(); return; }
  $('#login-container')?.remove();
  $('#user-info').hidden = false;
  $('#user-info').textContent = user.name || user.email;
  $('#sign-out').hidden = false;
  $('#admin-app').hidden = false;
  const start = location.hash.slice(1);
  switchTab(TABS.includes(start) ? start : 'dashboard');
  initMobileSidebar();
  loadRecentDashboard();
}

function initMobileSidebar() {
  const toggle = $('#adm-toggle');
  const backdrop = $('#adm-backdrop');
  const sidebar = $('#adm-nav')?.closest('.adm-side');
  if (!toggle || !backdrop || !sidebar) return;

  function open() {
    sidebar.classList.remove('adm-side-closed');
    sidebar.classList.add('adm-side-open');
    backdrop.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    sidebar.classList.remove('adm-side-open');
    sidebar.classList.add('adm-side-closed');
    backdrop.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  function toggleSidebar() {
    sidebar.classList.contains('adm-side-open') ? close() : open();
  }

  toggle.onclick = (e) => { e.stopPropagation(); toggleSidebar(); };
  backdrop.onclick = close;
  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('adm-side-open')) close();
  });
  // Close when clicking a nav link
  $$('.adm-link').forEach(b => b.addEventListener('click', close));
}

// --- Init ---
async function loadRecentDashboard() {
  try {
    const [appsRes, enqsRes] = await Promise.all([
      apiFetch('/api/admin/applications'),
      apiFetch('/api/admin/enquiries'),
    ]);
    const recentApps = (appsRes.applications || []).slice(0, 3);
    const recentEnqs = (enqsRes.enquiries || []).slice(0, 3);
    const appsEl = $('#recent-apps');
    const enqsEl = $('#recent-enqs');
    if (appsEl) {
      appsEl.innerHTML = recentApps.map(a => `
        <div class="adm-item" data-tab="applications">
          <span>${escapeHtml(a.full_name)}</span>
          <time>${fmtDate(a.created_at)}</time>
        </div>
      `).join('') || '<div class="adm-empty">No applications</div>';
    }
    if (enqsEl) {
      enqsEl.innerHTML = recentEnqs.map(e => `
        <div class="adm-item" data-tab="enquiries">
          <span>${escapeHtml(e.name)}</span>
          <time>${fmtDate(e.created_at)}</time>
        </div>
      `).join('') || '<div class="adm-empty">No enquiries</div>';
    }
  } catch (e) {
    // silent - dashboard recent items are non-critical
  }
}

function wireEvents() {
  $$('.adm-link').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $('#sign-out')?.addEventListener('click', doLogout);
  $('#refresh-all')?.addEventListener('click', () => {
    loadTab(currentTab);
    loadRecentDashboard();
    showToast('Refreshed');
  });
  $$('.adm-more').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    if (tab && TABS.includes(tab)) switchTab(tab);
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.target.closest('input,textarea,select') || document.querySelector('dialog[open]')) return;
    const box = $(currentTab === 'applications' ? '#app-search' : currentTab === 'enquiries' ? '#enq-search' : '');
    if (box) { e.preventDefault(); box.focus(); }
  });
  // Search
  $('#app-search')?.addEventListener('input', e => filterTable('apps', e.target.value));
  $('#enq-search')?.addEventListener('input', e => filterTable('enqs', e.target.value));
  // Export
  $('#app-export')?.addEventListener('click', () => exportCSV('apps'));
  $('#enq-export')?.addEventListener('click', () => exportCSV('enqs'));
  // Create content
  $('#content-create')?.addEventListener('click', () => openContentCreateDialog());
}

function filterTable(prefix, query) {
  const rows = $$(`#${prefix}-tbody tr[data-id]`);
  const q = query.toLowerCase();
  rows.forEach(tr => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}

async function bulkAction(prefix, action) {
  if (!action) return;
  const selected = $$(`#${prefix}-tbody input[type="checkbox"]:checked`);
  if (selected.length === 0) { showToast('No items selected', true); return; }
  const ids = Array.from(selected).map(cb => cb.closest('tr').dataset.id);
  try {
    if (prefix === 'apps') {
      await apiFetch('/api/admin/applications/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) });
    } else {
      await apiFetch('/api/admin/enquiries/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) });
    }
    showToast('Bulk action completed');
    if (prefix === 'apps') await loadApplications();
    else await loadEnquiries();
  } catch (e) { showToast('Bulk action failed: ' + e.message, true); }
}

function exportCSV(prefix) {
  const rows = $$(`#${prefix}-tbody tr[data-id]`);
  if (rows.length === 0) { showToast('No data to export', true); return; }
  const headers = prefix === 'apps'
    ? ['Reference', 'Programme', 'Name', 'Email', 'Phone', 'Status', 'Created']
    : ['Name', 'Email', 'Type', 'Status', 'Created'];
  const csv = [headers.join(',')];
  rows.forEach(tr => {
    if (tr.style.display === 'none') return;
    const cells = Array.from(tr.querySelectorAll('td')).map(td => '"' + td.textContent.replace(/"/g, '""') + '"');
    csv.push(cells.join(','));
  });
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${prefix}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// Content create dialog
async function openContentCreateDialog() {
  const table = currentContentTable;
  const dialog = $('#content-dialog');
  let fieldsHtml = '';
  const defaults = table === 'programmes' ? { published: false, sort_order: 0 } :
                   table === 'gallery_items' ? { collection: 'design', published: false, sort_order: 0 } :
                   { verified: false, published: false, sort_order: 0 };
  for (const [key, val] of Object.entries(defaults)) {
    if (typeof val === 'boolean') {
      fieldsHtml += `<dt>${key}</dt><dd><label class="check"><input type="checkbox" name="${key}" ${val ? 'checked' : ''}> Yes</label></dd>`;
    } else {
      fieldsHtml += `<dt>${key}</dt><dd><input type="text" name="${key}" value="${val}"></dd>`;
    }
  }
  dialog.innerHTML = `
    <h2>Create ${table.replace('_', ' ')}</h2>
    <button class="dialog-close" aria-label="Close">&times;</button>
    <div class="detail-grid">${fieldsHtml}</div>
    <div class="dialog-actions">
      <button class="btn g" id="content-create-save">Create</button>
    </div>
  `;
  dialog.showModal();
  $('#content-dialog .dialog-close').onclick = () => dialog.close();
  $('#content-create-save').onclick = async () => {
    const data = {};
    $$('#content-dialog [name]').forEach(el => {
      data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    try {
      await apiFetch('/api/admin/content/' + table, { method: 'POST', body: JSON.stringify(data) });
      showToast('Created');
      dialog.close();
      await loadContentTable(table);
    } catch (e) { showToast('Create failed: ' + e.message, true); }
  };
}

wireEvents();
initApp();