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

function getToken() { return localStorage.getItem(AUTH_KEY); }
function setToken(token, user) {
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(AUTH_USER, JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_USER);
}
function getUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_USER) || 'null'); } catch { return null; }
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

function setLoading(el, loading) {
  if (!el) return;
  if (loading) {
    el.classList.add('loading');
    el.disabled = true;
    el.dataset._text = el.textContent;
    el.textContent = '';
  } else {
    el.classList.remove('loading');
    el.disabled = false;
    el.textContent = el.dataset._text || el.textContent;
  }
}

// --- Confirm dialog ---
function confirmDialog(title, message, onConfirm, cancelLabel = 'Cancel', confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    const d = $('#confirm-dialog');
    d.innerHTML = `
      <h2>${escapeHtml(title)}</h2>
      <button class="dialog-close" aria-label="Close">&times;</button>
      <p class="confirm-message">${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button class="btn" id="confirm-cancel">${escapeHtml(cancelLabel)}</button>
        <button class="btn g" id="confirm-ok">${escapeHtml(confirmLabel)}</button>
      </div>
    `;
    d.showModal();
    const close = () => { d.close(); resolve(false); };
    $('#confirm-dialog .dialog-close').onclick = close;
    $('#confirm-cancel').onclick = close;
    $('#confirm-ok').onclick = () => { d.close(); resolve(true); };
    d.addEventListener('close', () => { d.innerHTML = ''; }, { once: true });
  });
}

// --- Tabs ---
const TABS = ['dashboard', 'applications', 'enquiries', 'content', 'audit', 'users', 'settings'];
let currentTab = 'dashboard';
let bulkSelections = { applications: new Set(), enquiries: new Set(), content: new Set(), users: new Set(), settings: new Set() };

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
  updateBulkBar();
}

async function loadTab(name) {
  try {
    if (name === 'dashboard') await loadDashboard();
    else if (name === 'applications') await loadApplications();
    else if (name === 'enquiries') await loadEnquiries();
    else if (name === 'content') await loadContent();
    else if (name === 'audit') await loadAudit();
    else if (name === 'users') await loadUsers();
    else if (name === 'settings') await loadSettings();
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
      <div class="stat"><div class="stat-val">${s.underReview ?? 0}</div><div class="stat-label">Under Review</div></div>
      <div class="stat"><div class="stat-val">${s.accepted ?? 0}</div><div class="stat-label">Accepted</div></div>
      <div class="stat"><div class="stat-val">${s.totalEnquiries ?? 0}</div><div class="stat-label">Total Enquiries</div></div>
      <div class="stat"><div class="stat-val">${s.newEnquiries ?? 0}</div><div class="stat-label">New Enquiries</div></div>
    `;
    updateBadges(s);
    updateDashBadges(s);
  } catch (e) {
    showToast('Failed to load dashboard: ' + e.message, true);
  }
}

function updateDashBadges(s) {
  const badges = {
    'dash-badge-apps': (s.submitted ?? 0) + (s.underReview ?? 0),
    'dash-badge-enqs': s.newEnquiries ?? 0,
    'dash-badge-users': 0
  };
  for (const [id, count] of Object.entries(badges)) {
    const el = $(id);
    if (el) {
      el.textContent = count;
      el.hidden = count === 0;
    }
  }
}

function updateBadges(s) {
  const appBadge = $('#badge-applications');
  const enqBadge = $('#badge-enquiries');
  if (appBadge) {
    const count = (s.submitted ?? 0) + (s.underReview ?? 0);
    appBadge.textContent = count;
    appBadge.hidden = count === 0;
  }
  if (enqBadge) {
    const count = s.newEnquiries ?? 0;
    enqBadge.textContent = count;
    enqBadge.hidden = count === 0;
  }
}

// --- Applications ---
let appsCache = [];
let appsPage = 1;
const APPS_PER_PAGE = 25;
let appStatusFilter = '';
let appSearch = '';

async function loadApplications() {
  try {
    const data = await apiFetch('/api/admin/applications');
    appsCache = data.applications || [];
    appsPage = 1;
    appStatusFilter = $('#app-status-filter') ? $('#app-status-filter').value : '';
    renderApplications();
    renderAppChips();
  } catch (e) {
    showToast('Failed to load applications: ' + e.message, true);
  }
}

function renderAppChips() {
  const container = $('#app-chips');
  if (!container) return;
  const statuses = [...new Set(appsCache.map(a => a.status).filter(Boolean))];
  const allLabel = appStatusFilter ? 'All' : 'All';
  container.innerHTML = `
    <button class="chip${!appStatusFilter ? ' on' : ''}" data-status="">All (${appsCache.length})</button>
    ${statuses.map(s => `
      <button class="chip${appStatusFilter === s ? ' on' : ''}" data-status="${escapeHtml(s)}">${escapeHtml(s)} (${appsCache.filter(a => a.status === s).length})</button>
    `).join('')}
  `;
  $$('#app-chips .chip').forEach(b => {
    b.onclick = () => {
      appStatusFilter = b.dataset.status || '';
      $('#app-status-filter').value = appStatusFilter;
      appsPage = 1;
      renderApplications();
      renderAppChips();
    };
  });
}

function filterApplications() {
  const q = (appSearch || '').toLowerCase();
  const s = appStatusFilter || '';
  return appsCache.filter(a => {
    const matchText = !q ||
      String(a.full_name || '').toLowerCase().includes(q) ||
      String(a.email || '').toLowerCase().includes(q) ||
      String(a.reference || '').toLowerCase().includes(q) ||
      String(a.programme_name || '').toLowerCase().includes(q);
    const matchStatus = !s || a.status === s;
    return matchText && matchStatus;
  });
}

function renderApplications() {
  const filtered = filterApplications();
  const start = (appsPage - 1) * APPS_PER_PAGE;
  const pageItems = filtered.slice(start, start + APPS_PER_PAGE);
  const tbody = $('#apps-tbody');
  const selectAll = $('#app-select-all');
  const allSelected = pageItems.length > 0 && pageItems.every(a => bulkSelections.applications.has(a.id));
  const countEl = $('#app-count');
  if (countEl) countEl.textContent = filtered.length + ' application' + (filtered.length !== 1 ? 's' : '');

  tbody.innerHTML = pageItems.map(a => {
    const selected = bulkSelections.applications.has(a.id);
    return `
      <tr data-id="${a.id}" class="${selected ? 'selected' : ''}">
        <td class="table-check"><input type="checkbox" class="row-select" data-id="${a.id}" ${selected ? 'checked' : ''} ${allSelected ? '' : ''}></td>
        <td><code>${escapeHtml(a.reference)}</code></td>
        <td>${escapeHtml(a.programme_name)}</td>
        <td>${escapeHtml(a.full_name)}</td>
        <td><a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a></td>
        <td><a href="tel:${escapeHtml(a.phone)}">${escapeHtml(a.phone)}</a></td>
        <td><span class="badge ${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td>
        <td>${a.fee_received ? '<span class="badge paid">Paid</span>' : '<span class="badge unpaid">Unpaid</span>'}</td>
        <td>${fmtDate(a.created_at)}</td>
        <td class="table-actions">
          <div class="row-actions">
            <button class="action-btn view" title="View" onclick="openApplicationDialog('${escapeHtml(a.id)}')">View</button>
            <button class="action-btn edit" title="Edit" onclick="openApplicationDialog('${escapeHtml(a.id)}')">Edit</button>
            ${quickStatusButtons(a.status, a.id)}
            <button class="action-btn delete" title="Delete" onclick="deleteApplication('${escapeHtml(a.id)}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="10" style="text-align:center;color:var(--mut)">No applications</td></tr>`;

  $('#apps-pagination').innerHTML = renderPagination(filtered.length, appsPage, APPS_PER_PAGE, 'apps');
  if (selectAll) selectAll.checked = allSelected;
  attachRowClicks('apps');
  attachSelectAll('app-select-all', 'applications');
  updateBulkBar();
}

function attachSelectAll(selectAllId, tableKey) {
  const cb = $('#' + selectAllId);
  if (!cb) return;
  const tbodyId = { applications: 'apps', enquiries: 'enqs', content: 'content', users: 'users', settings: 'settings' }[tableKey];
  cb.onclick = () => {
    const checked = cb.checked;
    const visibleIds = $$(`#${tbodyId}-tbody tr[data-id]`).map(tr => tr.dataset.id);
    if (checked) {
      visibleIds.forEach(id => bulkSelections[tableKey].add(id));
    } else {
      visibleIds.forEach(id => bulkSelections[tableKey].delete(id));
    }
    renderTable(tableKey);
    updateBulkBar();
  };
}

function attachRowClicks(prefix) {
  $$(`#${prefix}-tbody tr[data-id]`).forEach(tr => {
    const cb = tr.querySelector('.row-select');
    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('.row-actions')) return;
      if (prefix === 'apps') openApplicationDialog(tr.dataset.id);
      else if (prefix === 'enqs') openEnquiryDialog(tr.dataset.id);
      else if (prefix === 'content') openContentDialog(tr.dataset.id.split('|')[0], tr.dataset.id.split('|')[1]);
      else if (prefix === 'users') openUserDialog(tr.dataset.id);
      else if (prefix === 'settings') {
        const s = settingsCache.find(x => x.key === tr.dataset.id);
        editSetting(tr.dataset.id, s ? JSON.stringify(s.value) : '');
      }
    });
    cb?.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = tr.dataset.id;
      const tableKey = prefix === 'apps' ? 'applications' : prefix === 'enquiries' ? 'enquiries' : prefix === 'content' ? 'content' : prefix === 'users' ? 'users' : 'settings';
      if (cb.checked) bulkSelections[tableKey].add(id);
      else bulkSelections[tableKey].delete(id);
      tr.classList.toggle('selected', cb.checked);
      updateBulkBar();
    });
  });
}

function renderTable(tableKey) {
  if (tableKey === 'applications') renderApplications();
  else if (tableKey === 'enquiries') renderEnquiries();
  else if (tableKey === 'content') renderContentTable(currentContentTable);
  else if (tableKey === 'users') renderUsers();
  else if (tableKey === 'settings') renderSettings();
}

function updateBulkBar() {
  const tableKey = currentTab === 'applications' ? 'applications' : currentTab === 'enquiries' ? 'enquiries' : currentTab === 'content' ? 'content' : currentTab === 'users' ? 'users' : 'settings';
  const count = bulkSelections[tableKey].size;
  const bar = currentTab === 'applications' ? $('#app-bulk-bar') : currentTab === 'enquiries' ? $('#enq-bulk-bar') : currentTab === 'content' ? $('#content-bulk-bar') : currentTab === 'users' ? $('#users-bulk-bar') : $('#settings-bulk-bar');
  const countEl = currentTab === 'applications' ? $('#app-bulk-count') : currentTab === 'enquiries' ? $('#enq-bulk-count') : currentTab === 'content' ? $('#content-bulk-count') : currentTab === 'users' ? $('#users-bulk-count') : $('#settings-bulk-count');
  const delBtn = currentTab === 'applications' ? $('#app-delete-selected') : currentTab === 'enquiries' ? $('#enq-delete-selected') : currentTab === 'content' ? $('#content-delete-selected') : currentTab === 'users' ? null : $('#settings-delete-selected');

  if (bar) bar.hidden = count === 0;
  if (countEl) countEl.textContent = count;
  if (delBtn) delBtn.hidden = count === 0;
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
        <dt>Reference</dt><dd><code>${escapeHtml(a.reference)}</code></dd>
        <dt>Programme</dt><dd>${escapeHtml(a.programme_name)}</dd>
        <dt>Full Name</dt><dd>${escapeHtml(a.full_name)}</dd>
        <dt>Email</dt><dd><a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a></dd>
        <dt>Phone</dt><dd><a href="tel:${escapeHtml(a.phone)}">${escapeHtml(a.phone)}</a></dd>
        <dt>Date of Birth</dt><dd>${a.date_of_birth ? fmtDate(a.date_of_birth) : '—'}</dd>
        <dt>Address</dt><dd>${escapeHtml(a.address || '—')}</dd>
        <dt>Education</dt><dd>${escapeHtml(a.education_background || '—')}</dd>
        <dt>Additional Info</dt><dd>${escapeHtml(a.additional_info || '—')}</dd>
        <dt>Status</dt><dd>
          <select id="app-status">
            <option value="submitted" ${a.status === 'submitted' ? 'selected' : ''}>Submitted</option>
            <option value="under_review" ${a.status === 'under_review' ? 'selected' : ''}>Under Review</option>
            <option value="accepted" ${a.status === 'accepted' ? 'selected' : ''}>Accepted</option>
            <option value="rejected" ${a.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </dd>
        <dt>Fee Received</dt><dd><label class="check"><input type="checkbox" id="app-fee" ${a.fee_received ? 'checked' : ''}> Yes</label></dd>
        <dt>Admin Notes</dt><dd><textarea id="app-notes">${escapeHtml(a.admin_notes || '')}</textarea></dd>
      </div>
      <div class="dialog-actions">
        <button class="btn" id="app-delete-item">Delete</button>
        <button class="btn g" id="app-save">Save Changes</button>
      </div>
    `;
    dialog.showModal();
    $('#app-dialog .dialog-close').onclick = () => dialog.close();

    $('#app-delete-item').onclick = async () => {
      const ok = await confirmDialog('Delete application', 'Delete application ' + escapeHtml(a.reference) + '? This cannot be undone.', 'Delete', 'Cancel', 'Delete');
      if (!ok) return;
      try {
        await apiFetch('/api/admin/applications/' + id, { method: 'DELETE' });
        showToast('Application deleted');
        dialog.close();
        await loadApplications();
        loadDashboard();
      } catch (e) { showToast('Delete failed: ' + e.message, true); }
    };

    $('#app-save').onclick = async () => {
      setLoading($('#app-save'), true);
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
        loadDashboard();
      } catch (e) { showToast('Save failed: ' + e.message, true); }
      finally { setLoading($('#app-save'), false); }
    };
  } catch (e) { showToast('Failed to load application: ' + e.message, true); }
}

async function deleteApplication(id) {
  const ok = await confirmDialog('Delete application', 'Delete this application? This cannot be undone.', 'Delete', 'Cancel', 'Delete');
  if (!ok) return;
  try {
    await apiFetch('/api/admin/applications/' + id, { method: 'DELETE' });
    showToast('Application deleted');
    await loadApplications();
    loadDashboard();
  } catch (e) { showToast('Delete failed: ' + e.message, true); }
}

function quickStatusButtons(status, id) {
  const isTerminal = status === 'accepted' || status === 'rejected';
  if (isTerminal) {
    return `<button class="action-btn" title="Reopen" onclick="quickStatus('${escapeHtml(String(id))}', 'submitted')" style="color:#dcae3c;border-color:#dcae3c">Reopen</button>`;
  }
  return `
    <button class="action-btn" title="Accept" onclick="quickStatus('${escapeHtml(String(id))}', 'accepted')" style="color:#2ca64e;border-color:#2ca64e">Accept</button>
    <button class="action-btn" title="Reject" onclick="quickStatus('${escapeHtml(String(id))}', 'rejected')" style="color:#dc3c3c;border-color:#dc3c3c">Reject</button>
  `;
}

async function quickStatus(id, newStatus) {
  const ok = await confirmDialog('Change status', 'Set application status to "' + newStatus + '"?', 'Change', 'Cancel', 'Change');
  if (!ok) return;
  try {
    await apiFetch('/api/admin/applications/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    showToast('Status updated to ' + newStatus);
    await loadApplications();
    loadDashboard();
  } catch (e) { showToast('Status change failed: ' + e.message, true); }
}

// --- Enquiries ---
let enqsCache = [];
let enqsPage = 1;
const ENQS_PER_PAGE = 25;
let enqStatusFilter = '';
let enqSearch = '';

async function loadEnquiries() {
  try {
    const data = await apiFetch('/api/admin/enquiries');
    enqsCache = data.enquiries || [];
    enqsPage = 1;
    enqStatusFilter = $('#enq-status-filter') ? $('#enq-status-filter').value : '';
    renderEnquiries();
    renderEnqChips();
  } catch (e) {
    showToast('Failed to load enquiries: ' + e.message, true);
  }
}

function renderEnqChips() {
  const container = $('#enq-chips');
  if (!container) return;
  const statuses = [...new Set(enqsCache.map(e => e.status).filter(Boolean))];
  container.innerHTML = `
    <button class="chip${!enqStatusFilter ? ' on' : ''}" data-status="">All (${enqsCache.length})</button>
    ${statuses.map(s => `
      <button class="chip${enqStatusFilter === s ? ' on' : ''}" data-status="${escapeHtml(s)}">${escapeHtml(s)} (${enqsCache.filter(e => e.status === s).length})</button>
    `).join('')}
  `;
  $$('#enq-chips .chip').forEach(b => {
    b.onclick = () => {
      enqStatusFilter = b.dataset.status || '';
      $('#enq-status-filter').value = enqStatusFilter;
      enqsPage = 1;
      renderEnquiries();
      renderEnqChips();
    };
  });
}

function filterEnquiries() {
  const q = (enqSearch || '').toLowerCase();
  const s = enqStatusFilter || '';
  return enqsCache.filter(e => {
    const matchText = !q ||
      String(e.name || '').toLowerCase().includes(q) ||
      String(e.email || '').toLowerCase().includes(q) ||
      String(e.message || '').toLowerCase().includes(q);
    const matchStatus = !s || e.status === s;
    return matchText && matchStatus;
  });
}

function renderEnquiries() {
  const filtered = filterEnquiries();
  const start = (enqsPage - 1) * ENQS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ENQS_PER_PAGE);
  const tbody = $('#enqs-tbody');
  const selectAll = $('#enq-select-all');
  const allSelected = pageItems.length > 0 && pageItems.every(e => bulkSelections.enquiries.has(e.id));
  const countEl = $('#enq-count');
  if (countEl) countEl.textContent = filtered.length + ' enquiry' + (filtered.length !== 1 ? 'ies' : '');

  tbody.innerHTML = pageItems.map(e => {
    const selected = bulkSelections.enquiries.has(e.id);
    return `
      <tr data-id="${e.id}" class="${selected ? 'selected' : ''}">
        <td class="table-check"><input type="checkbox" class="row-select" data-id="${e.id}" ${selected ? 'checked' : ''}></td>
        <td>${escapeHtml(e.name)}</td>
        <td><a href="mailto:${escapeHtml(e.email)}">${escapeHtml(e.email)}</a></td>
        <td>${escapeHtml(e.enquiry_type)}</td>
        <td><span class="badge ${escapeHtml(e.status)}">${escapeHtml(e.status)}</span></td>
        <td>${fmtDate(e.created_at)}</td>
        <td class="table-actions">
          <div class="row-actions">
            <button class="action-btn view" title="View" onclick="openEnquiryDialog('${escapeHtml(e.id)}')">View</button>
            <button class="action-btn edit" title="Edit" onclick="openEnquiryDialog('${escapeHtml(e.id)}')">Edit</button>
            <button class="action-btn delete" title="Delete" onclick="deleteEnquiry('${escapeHtml(e.id)}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--mut)">No enquiries</td></tr>`;

  $('#enqs-pagination').innerHTML = renderPagination(filtered.length, enqsPage, ENQS_PER_PAGE, 'enqs');
  if (selectAll) selectAll.checked = allSelected;
  attachRowClicks('enqs');
  attachSelectAll('enq-select-all', 'enquiries');
  updateBulkBar();
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
        <dt>Email</dt><dd><a href="mailto:${escapeHtml(e.email)}">${escapeHtml(e.email)}</a></dd>
        <dt>Type</dt><dd>${escapeHtml(e.enquiry_type)}</dd>
        <dt>Message</dt><dd>${escapeHtml(e.message)}</dd>
        <dt>Status</dt><dd>
          <select id="enq-status">
            <option value="new" ${e.status === 'new' ? 'selected' : ''}>New</option>
            <option value="read" ${e.status === 'read' ? 'selected' : ''}>Read</option>
            <option value="replied" ${e.status === 'replied' ? 'selected' : ''}>Replied</option>
          </select>
        </dd>
        <dt>Reply Subject</dt><dd><input type="text" id="enq-reply-subject" placeholder="Subject" value="${escapeHtml(e.reply_subject || '')}"></dd>
        <dt>Reply Body</dt><dd><textarea id="enq-reply-body" rows="6" placeholder="Your reply...">${escapeHtml(e.reply_body || '')}</textarea></dd>
      </div>
      <div class="dialog-actions">
        <button class="btn" id="enq-delete-item">Delete</button>
        <button class="btn" id="enq-save-status">Save Status Only</button>
        <button class="btn g" id="enq-save-reply">Save Reply & Mark Replied</button>
      </div>
    `;
    dialog.showModal();
    $('#enq-dialog .dialog-close').onclick = () => dialog.close();

    $('#enq-delete-item').onclick = async () => {
      const ok = await confirmDialog('Delete enquiry', 'Delete enquiry from ' + escapeHtml(e.name) + '? This cannot be undone.', 'Delete', 'Cancel', 'Delete');
      if (!ok) return;
      try {
        await apiFetch('/api/admin/enquiries/' + id, { method: 'DELETE' });
        showToast('Enquiry deleted');
        dialog.close();
        await loadEnquiries();
        loadDashboard();
      } catch (err) { showToast('Delete failed: ' + err.message, true); }
    };

    $('#enq-save-status').onclick = async () => {
      setLoading($('#enq-save-status'), true);
      const status = $('#enq-status').value;
      try {
        await apiFetch('/api/admin/enquiries/' + e.id, { method: 'PATCH', body: JSON.stringify({ status }) });
        showToast('Status updated');
        dialog.close();
        await loadEnquiries();
        loadDashboard();
      } catch (err) { showToast('Save failed: ' + err.message, true); }
      finally { setLoading($('#enq-save-status'), false); }
    };

    $('#enq-save-reply').onclick = async () => {
      setLoading($('#enq-save-reply'), true);
      const reply_subject = $('#enq-reply-subject').value.trim();
      const reply_body = $('#enq-reply-body').value.trim();
      if (!reply_subject || !reply_body) { showToast('Enter subject and reply', true); setLoading($('#enq-save-reply'), false); return; }
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
        loadDashboard();
      } catch (err) { showToast('Save failed: ' + err.message, true); }
      finally { setLoading($('#enq-save-reply'), false); }
    };
  } catch (err) { showToast('Failed to load enquiry: ' + err.message, true); }
}

async function deleteEnquiry(id) {
  const ok = await confirmDialog('Delete enquiry', 'Delete this enquiry? This cannot be undone.', 'Delete', 'Cancel', 'Delete');
  if (!ok) return;
  try {
    await apiFetch('/api/admin/enquiries/' + id, { method: 'DELETE' });
    showToast('Enquiry deleted');
    await loadEnquiries();
    loadDashboard();
  } catch (e) { showToast('Delete failed: ' + e.message, true); }
}

// --- Content ---
const CONTENT_TABLES = ['programmes', 'gallery_items', 'achievements'];
let currentContentTable = 'programmes';
let contentCache = [];
let contentSearch = '';
let contentPage = 1;
const CONTENT_PER_PAGE = 25;

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
  contentPage = 1;
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

function filterContent() {
  const q = (contentSearch || '').toLowerCase();
  return contentCache.filter(item => {
    const name = String(item.name || item.title || '').toLowerCase();
    return !q || name.includes(q);
  });
}

function renderContentTable(table) {
  const filtered = filterContent();
  const tbody = $('#content-tbody');
  const isGallery = table === 'gallery_items';
  const selectAll = $('#content-select-all');
  const allSelected = filtered.length > 0 && filtered.every(i => bulkSelections.content.has(i.id));

  tbody.innerHTML = filtered.map(item => {
    const selected = bulkSelections.content.has(item.id);
    return `
      <tr data-id="${item.id}" class="${selected ? 'selected' : ''}">
        <td class="table-check"><input type="checkbox" class="row-select" data-id="${item.id}" ${selected ? 'checked' : ''}></td>
        <td>${escapeHtml(item.name || item.title || item.id)}</td>
        <td>${isGallery ? escapeHtml(item.collection || '') : escapeHtml(item.slug || '')}</td>
        <td>${item.published !== undefined ? (item.published ? '<span class="badge paid">Published</span>' : '<span class="badge unpaid">Unpublished</span>') : ''}</td>
        <td>${fmtDate(item.created_at)}</td>
        <td class="table-actions">
          <div class="row-actions">
            <button class="action-btn view" title="View" onclick="openContentDialog('${escapeHtml(table)}', '${escapeHtml(String(item.id))}')">View</button>
            <button class="action-btn edit" title="Edit" onclick="openContentDialog('${escapeHtml(table)}', '${escapeHtml(String(item.id))}')">Edit</button>
            <button class="action-btn delete" title="Delete" onclick="deleteContent('${escapeHtml(table)}', '${escapeHtml(String(item.id))}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--mut)">No items</td></tr>`;

  $('#content-pagination').innerHTML = renderPagination(filtered.length, 1, CONTENT_PER_PAGE, 'content');
  if (selectAll) selectAll.checked = allSelected;
  attachRowClicks('content');
  attachSelectAll('content-select-all', 'content');
  updateBulkBar();
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
        <button class="btn" id="content-delete-item">Delete</button>
        <button class="btn g" id="content-save">Save</button>
      </div>
    `;
    dialog.showModal();
    $('#content-dialog .dialog-close').onclick = () => dialog.close();

    $('#content-delete-item').onclick = async () => {
      const ok = await confirmDialog('Delete item', 'Delete this ' + table.replace('_', ' ') + '? This cannot be undone.', 'Delete', 'Cancel', 'Delete');
      if (!ok) return;
      try {
        await apiFetch('/api/admin/content/' + table + '/' + id, { method: 'DELETE' });
        showToast('Deleted');
        dialog.close();
        await loadContentTable(table);
        loadDashboard();
      } catch (e) { showToast('Delete failed: ' + e.message, true); }
    };

    $('#content-save').onclick = async () => {
      setLoading($('#content-save'), true);
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
        loadDashboard();
      } catch (e) { showToast('Save failed: ' + e.message, true); }
      finally { setLoading($('#content-save'), false); }
    };
  } catch (e) { showToast('Failed to load item: ' + e.message, true); }
}

async function deleteContent(table, id) {
  const ok = await confirmDialog('Delete item', 'Delete this ' + table.replace('_', ' ') + '? This cannot be undone.', 'Delete', 'Cancel', 'Delete');
  if (!ok) return;
  try {
    await apiFetch('/api/admin/content/' + table + '/' + id, { method: 'DELETE' });
    showToast('Deleted');
    await loadContentTable(table);
    loadDashboard();
  } catch (e) { showToast('Delete failed: ' + e.message, true); }
}

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
    setLoading($('#content-create-save'), true);
    const data = {};
    $$('#content-dialog [name]').forEach(el => {
      data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    try {
      await apiFetch('/api/admin/content/' + table, { method: 'POST', body: JSON.stringify(data) });
      showToast('Created');
      dialog.close();
      await loadContentTable(table);
      loadDashboard();
    } catch (e) { showToast('Create failed: ' + e.message, true); }
    finally { setLoading($('#content-create-save'), false); }
  };
}

// --- Audit ---
async function loadAudit() {
  try {
    const tableFilter = $('#audit-table-filter') ? $('#audit-table-filter').value : '';
    const url = tableFilter ? '/api/admin/audit?table=' + encodeURIComponent(tableFilter) : '/api/admin/audit';
    const data = await apiFetch(url);
    const tbody = $('#audit-tbody');
    renderAuditChips(data.logs || []);
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

function renderAuditChips(logs) {
  const container = $('#audit-chips');
  if (!container) return;
  const tables = [...new Set(logs.map(l => l.target_table).filter(Boolean))];
  container.innerHTML = `
    <button class="chip${!$('#audit-table-filter').value ? ' on' : ''}" data-table="">All (${logs.length})</button>
    ${tables.map(t => `
      <button class="chip${$('#audit-table-filter').value === t ? ' on' : ''}" data-table="${escapeHtml(t)}">${escapeHtml(t)} (${logs.filter(l => l.target_table === t).length})</button>
    `).join('')}
  `;
  $$('#audit-chips .chip').forEach(b => {
    b.onclick = () => {
      $('#audit-table-filter').value = b.dataset.table || '';
      loadAudit();
    };
  });
}

// --- Bulk actions ---
async function bulkAction(tableKey, action) {
  const ids = Array.from(bulkSelections[tableKey]);
  if (ids.length === 0) { showToast('No items selected', true); return; }

  const ok = await confirmDialog(
    'Bulk ' + action,
    'Apply "' + action + '" to ' + ids.length + ' selected item' + (ids.length > 1 ? 's' : '') + '?',
    'Apply', 'Cancel', 'Apply'
  );
  if (!ok) return;

  try {
    if (tableKey === 'applications') {
      await apiFetch('/api/admin/applications/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) });
    } else if (tableKey === 'enquiries') {
      await apiFetch('/api/admin/enquiries/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) });
    } else if (tableKey === 'content') {
      // content bulk publish/unpublish handled per-item below
      for (const id of ids) {
        const item = contentCache.find(c => c.id === id);
        if (!item) continue;
        const newPublished = action === 'publish';
        await apiFetch('/api/admin/content/' + currentContentTable + '/' + id, {
          method: 'PATCH', body: JSON.stringify({ published: newPublished })
        });
      }
    } else if (tableKey === 'users') {
      // users bulk deactivate
      for (const id of ids) {
        await apiFetch('/api/admin/users/' + id, { method: 'DELETE' });
      }
    } else if (tableKey === 'settings') {
      // settings bulk delete
      for (const id of ids) {
        await apiFetch('/api/admin/settings/' + id, { method: 'DELETE' });
      }
    }
    showToast('Bulk action completed');
    bulkSelections[tableKey].clear();
    updateBulkBar();
    if (tableKey === 'applications') await loadApplications();
    else if (tableKey === 'enquiries') await loadEnquiries();
    else if (tableKey === 'content') await loadContentTable(currentContentTable);
    loadDashboard();
  } catch (e) { showToast('Bulk action failed: ' + e.message, true); }
}

// --- Users ---
let usersCache = [];

async function loadUsers() {
  try {
    const data = await apiFetch('/api/admin/users');
    usersCache = data.users || [];
    renderUsers();
    updateUserBadge();
  } catch (e) { showToast('Failed to load users: ' + e.message, true); }
}

function updateUserBadge() {
  const badge = $('#badge-users');
  if (!badge) return;
  badge.textContent = usersCache.length;
  badge.hidden = usersCache.length === 0;
}

function renderUsers() {
  const tbody = $('#users-tbody');
  const countEl = $('#users-count');
  if (countEl) countEl.textContent = usersCache.length + ' user' + (usersCache.length !== 1 ? 's' : '');
  tbody.innerHTML = usersCache.map(u => `
    <tr data-id="${u.id}">
      <td>${escapeHtml(u.name || '—')}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="badge ${u.is_active ? 'paid' : 'unpaid'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${u.last_login_at ? fmtDate(u.last_login_at) : 'Never'}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td class="table-actions">
        <div class="row-actions">
          <button class="action-btn edit" title="Edit" onclick="openUserDialog('${escapeHtml(String(u.id))}')">Edit</button>
          <button class="action-btn delete" title="Deactivate" onclick="deactivateUser('${escapeHtml(String(u.id))}', '${escapeHtml(u.email)}')">${u.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--mut)">No users</td></tr>`;
}

async function openUserDialog(id) {
  const isCreate = id === 'new';
  const dialog = $('#user-dialog');
  let user = null;
  if (!isCreate) {
    try {
      const data = await apiFetch('/api/admin/users/' + id);
      user = data.user;
    } catch (e) { showToast('Failed to load user: ' + e.message, true); return; }
  }
  dialog.innerHTML = `
    <h2>${isCreate ? 'Create Admin User' : 'Edit User: ' + escapeHtml(user.email)}</h2>
    <button class="dialog-close" aria-label="Close">&times;</button>
    <div class="detail-grid">
      <dt>Email</dt><dd><input type="email" id="user-email" value="${isCreate ? '' : escapeHtml(user.email)}" ${!isCreate ? 'readonly' : ''} placeholder="name@example.com"></dd>
      <dt>Name</dt><dd><input type="text" id="user-name" value="${isCreate ? '' : escapeHtml(user.name || '')}" placeholder="Full name"></dd>
      ${isCreate ? '<dt>Password</dt><dd><input type="password" id="user-password" placeholder="Min 8 characters" required></dd>' : ''}
      <dt>Active</dt><dd><label class="check"><input type="checkbox" id="user-active" ${(isCreate || user.is_active) ? 'checked' : ''}> Yes</label></dd>
    </div>
    <div class="dialog-actions">
      ${!isCreate ? '<button class="btn" id="user-deactivate">' + (user.is_active ? 'Deactivate' : 'Activate') + '</button>' : ''}
      <button class="btn g" id="user-save">${isCreate ? 'Create' : 'Save'}</button>
    </div>
  `;
  dialog.showModal();
  $('#user-dialog .dialog-close').onclick = () => dialog.close();

  if (!isCreate) {
    $('#user-deactivate').onclick = async () => {
      const ok = await confirmDialog('Deactivate user', 'Deactivate ' + escapeHtml(user.email) + '? They will lose admin access.', 'Deactivate', 'Cancel', 'Deactivate');
      if (!ok) return;
      try {
        await apiFetch('/api/admin/users/' + id, { method: 'DELETE' });
        showToast('User deactivated');
        dialog.close();
        await loadUsers();
        loadDashboard();
      } catch (e) { showToast('Deactivate failed: ' + e.message, true); }
    };
  }

  $('#user-save').onclick = async () => {
    setLoading($('#user-save'), true);
    const email = $('#user-email').value.trim().toLowerCase();
    const name = $('#user-name').value.trim();
    const active = $('#user-active').checked;
    const body = { name, is_active: active };
    if (isCreate) {
      body.email = email;
      body.password = $('#user-password').value;
      if (!email || !body.password) { showToast('Email and password required', true); setLoading($('#user-save'), false); return; }
      if (body.password.length < 8) { showToast('Password must be at least 8 characters', true); setLoading($('#user-save'), false); return; }
    }
    try {
      if (isCreate) {
        await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
        showToast('User created');
      } else {
        await apiFetch('/api/admin/users/' + id, { method: 'PATCH', body: JSON.stringify(body) });
        showToast('User updated');
      }
      dialog.close();
      await loadUsers();
      loadDashboard();
    } catch (e) { showToast('Save failed: ' + e.message, true); }
    finally { setLoading($('#user-save'), false); }
  };
}

async function deactivateUser(id, email) {
  const ok = await confirmDialog('Deactivate user', 'Deactivate ' + escapeHtml(email) + '? They will lose admin access.', 'Deactivate', 'Cancel', 'Deactivate');
  if (!ok) return;
  try {
    await apiFetch('/api/admin/users/' + id, { method: 'DELETE' });
    showToast('User deactivated');
    await loadUsers();
    loadDashboard();
  } catch (e) { showToast('Deactivate failed: ' + e.message, true); }
}

// --- Settings ---
let settingsCache = [];

async function loadSettings() {
  try {
    const data = await apiFetch('/api/admin/settings');
    settingsCache = data.settings || [];
    renderSettings();
  } catch (e) { showToast('Failed to load settings: ' + e.message, true); }
}

function renderSettings() {
  const tbody = $('#settings-tbody');
  const countEl = $('#settings-count');
  if (countEl) countEl.textContent = settingsCache.length + ' setting' + (settingsCache.length !== 1 ? 's' : '');
  renderSettingsFiltered('');
}

function renderSettingsFiltered(q) {
  const tbody = $('#settings-tbody');
  const filtered = settingsCache.filter(s => s.key.toLowerCase().includes(q));
  tbody.innerHTML = filtered.map(s => {
    const val = typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value);
    const shortVal = val.length > 60 ? val.slice(0, 60) + '…' : val;
    return `
      <tr data-key="${escapeHtml(s.key)}">
        <td><code>${escapeHtml(s.key)}</code></td>
        <td>${escapeHtml(shortVal)}</td>
        <td>${fmtDate(s.updated_at)}</td>
        <td class="table-actions">
          <div class="row-actions">
            <button class="action-btn edit" title="Edit" onclick="editSetting('${escapeHtml(s.key)}', ${JSON.stringify(val)})">Edit</button>
            <button class="action-btn delete" title="Delete" onclick="deleteSetting('${escapeHtml(s.key)}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--mut)">No settings</td></tr>`;
}

async function editSetting(key, currentValue) {
  const dialog = $('#settings-dialog');
  dialog.innerHTML = `
    <h2>Edit Setting: ${escapeHtml(key)}</h2>
    <button class="dialog-close" aria-label="Close">&times;</button>
    <div class="detail-grid">
      <dt>Key</dt><dd><code>${escapeHtml(key)}</code></dd>
      <dt>Value (JSON)</dt><dd><textarea id="setting-value" rows="8">${escapeHtml(currentValue)}</textarea></dd>
    </div>
    <div class="dialog-actions">
      <button class="btn" id="setting-delete">Delete</button>
      <button class="btn g" id="setting-save">Save</button>
    </div>
  `;
  dialog.showModal();
  $('#user-dialog .dialog-close').onclick = () => dialog.close();

  $('#setting-delete').onclick = async () => {
    const ok = await confirmDialog('Delete setting', 'Delete setting ' + escapeHtml(key) + '?', 'Delete', 'Cancel', 'Delete');
    if (!ok) return;
    try {
      await apiFetch('/api/admin/settings/' + key, { method: 'DELETE' });
      showToast('Setting deleted');
      dialog.close();
      await loadSettings();
    } catch (e) { showToast('Delete failed: ' + e.message, true); }
  };

  $('#setting-save').onclick = async () => {
    setLoading($('#setting-save'), true);
    const raw = $('#setting-value').value;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { showToast('Invalid JSON', true); setLoading($('#setting-save'), false); return; }
    try {
      await apiFetch('/api/admin/settings/' + key, { method: 'PATCH', body: JSON.stringify({ value: parsed }) });
      showToast('Setting saved');
      dialog.close();
      await loadSettings();
    } catch (e) { showToast('Save failed: ' + e.message, true); }
    finally { setLoading($('#setting-save'), false); }
  };
}

async function deleteSetting(key) {
  const ok = await confirmDialog('Delete setting', 'Delete setting ' + escapeHtml(key) + '?', 'Delete', 'Cancel', 'Delete');
  if (!ok) return;
  try {
    await apiFetch('/api/admin/settings/' + key, { method: 'DELETE' });
    showToast('Setting deleted');
    await loadSettings();
  } catch (e) { showToast('Delete failed: ' + e.message, true); }
}

// --- Auth ---
async function doLogin(email, password) {
  const btn = $('#login-btn');
  const msg = $('#login-msg');
  setLoading(btn, true);
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
    const emailEl = $('#login-email');
    const pwEl = $('#login-password');
    if (emailEl) emailEl.classList.add('error');
    if (pwEl) pwEl.classList.add('error');
    emailEl?.focus();
  } finally { setLoading(btn, false); }
}

async function doLogout() {
  const ok = await confirmDialog('Sign out', 'Sign out of the admin panel?', 'Sign out', 'Cancel', 'Sign out');
  if (!ok) return;
  clearAuth();
  window.location.reload();
}

function showLoginForm() {
  $('#admin-app').hidden = true;
  $('#user-info').hidden = true;
  $('#sign-out').hidden = true;
  const loginHtml = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-branding">
          <img src="/images/logo.png" alt="Jokel" class="login-logo" width="40" height="40">
          <div class="login-branding-copy">
            <h2>Jokel Admin</h2>
            <p class="login-subtitle">Sign in to manage your fashion house</p>
          </div>
        </div>
        <div class="login-divider" aria-hidden="true"></div>
        <form id="login-form" class="login-form">
          <div class="field">
            <label class="field-label" for="login-email">Email</label>
            <input type="email" id="login-email" name="email" required autocomplete="email" class="login-input" placeholder="you@studio.com">
          </div>
          <div class="field">
            <label class="field-label" for="login-password">Password</label>
            <div class="field-input-wrap pw-wrap">
              <input type="password" id="login-password" name="password" required autocomplete="current-password" class="login-input" placeholder="••••••••">
              <button type="button" id="login-toggle-pw" class="login-pw-toggle" aria-label="Toggle password visibility">&#128065;</button>
            </div>
          </div>
          <p class="note f error" id="login-msg" hidden></p>
          <div class="login-options">
            <label class="remember-label" for="login-remember">
              <input type="checkbox" id="login-remember" name="remember" class="remember-checkbox">
              Remember me
            </label>
            <a href="#" id="login-forgot" class="login-forgot">Forgot password?</a>
          </div>
          <button class="btn g" type="submit" id="login-btn">Sign In</button>
        </form>
        <div class="login-footer">
          <a href="/" class="login-back">← Back to site</a>
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
    const btn = $('#login-btn');
    const msg = $('#login-msg');
    const emailEl = $('#login-email');
    const pwEl = $('#login-password');
    setLoading(btn, true);
    msg.hidden = true;
    msg.textContent = '';
    msg.className = 'note f error';
    emailEl.classList.remove('error');
    pwEl.classList.remove('error');
    try {
      await doLogin(fd.get('email'), fd.get('password'));
    } catch (e) {
      msg.hidden = false;
      msg.textContent = e.message;
      msg.className = 'note f error';
      emailEl.classList.add('error');
      pwEl.classList.add('error');
      emailEl.focus();
    } finally {
      setLoading(btn, false);
    }
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('adm-side-open')) close();
  });
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
  $$('.adm-dash-btn').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = b.dataset.tab;
    if (tab && TABS.includes(tab)) switchTab(tab);
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.target.closest('input,textarea,select') || document.querySelector('dialog[open]')) return;
    const box = $(currentTab === 'applications' ? '#app-search' : currentTab === 'enquiries' ? '#enq-search' : currentTab === 'settings' ? '#settings-search' : '');
    if (box) { e.preventDefault(); box.focus(); }
  });
  // Search
  $('#app-search')?.addEventListener('input', e => { appSearch = e.target.value; appsPage = 1; renderApplications(); });
  $('#enq-search')?.addEventListener('input', e => { enqSearch = e.target.value; enqsPage = 1; renderEnquiries(); });
  $('#settings-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderSettingsFiltered(q);
  });
  // Create content
  $('#content-create')?.addEventListener('click', () => openContentCreateDialog());
  // Create user
  $('#user-create')?.addEventListener('click', () => openUserDialog('new'));
  // Audit refresh
  $('#audit-refresh')?.addEventListener('click', () => loadAudit());
  // Bulk action buttons
  $$('[id^="app-bulk-"]').forEach(btn => {
    btn.onclick = () => bulkAction('applications', btn.id.replace('app-bulk-', ''));
  });
  $$('[id^="enq-bulk-"]').forEach(btn => {
    btn.onclick = () => bulkAction('enquiries', btn.id.replace('enq-bulk-', ''));
  });
  $$('[id^="content-bulk-"]').forEach(btn => {
    btn.onclick = () => bulkAction('content', btn.id.replace('content-bulk-', ''));
  });
  $$('[id^="users-bulk-"]').forEach(btn => {
    btn.onclick = () => bulkAction('users', btn.id.replace('users-bulk-', ''));
  });
  $$('[id^="settings-bulk-"]').forEach(btn => {
    btn.onclick = () => bulkAction('settings', btn.id.replace('settings-bulk-', ''));
  });
  // Delete selected buttons
  $('#app-delete-selected')?.addEventListener('click', async () => {
    const ids = Array.from(bulkSelections.applications);
    if (ids.length === 0) return;
    const ok = await confirmDialog('Delete applications', 'Delete ' + ids.length + ' selected application' + (ids.length > 1 ? 's' : '') + '?', 'Delete', 'Cancel', 'Delete');
    if (!ok) return;
    for (const id of ids) {
      try { await apiFetch('/api/admin/applications/' + id, { method: 'DELETE' }); } catch {}
    }
    showToast('Deleted ' + ids.length + ' application' + (ids.length > 1 ? 's' : ''));
    bulkSelections.applications.clear();
    updateBulkBar();
    await loadApplications();
    loadDashboard();
  });
  $('#enq-delete-selected')?.addEventListener('click', async () => {
    const ids = Array.from(bulkSelections.enquiries);
    if (ids.length === 0) return;
    const ok = await confirmDialog('Delete enquiries', 'Delete ' + ids.length + ' selected enquiry' + (ids.length > 1 ? 's' : '') + '?', 'Delete', 'Cancel', 'Delete');
    if (!ok) return;
    for (const id of ids) {
      try { await apiFetch('/api/admin/enquiries/' + id, { method: 'DELETE' }); } catch {}
    }
    showToast('Deleted ' + ids.length + ' enquiry' + (ids.length > 1 ? 's' : ''));
    bulkSelections.enquiries.clear();
    updateBulkBar();
    await loadEnquiries();
    loadDashboard();
  });
  $('#content-delete-selected')?.addEventListener('click', async () => {
    const ids = Array.from(bulkSelections.content);
    if (ids.length === 0) return;
    const ok = await confirmDialog('Delete items', 'Delete ' + ids.length + ' selected item' + (ids.length > 1 ? 's' : '') + '?', 'Delete', 'Cancel', 'Delete');
    if (!ok) return;
    for (const id of ids) {
      try { await apiFetch('/api/admin/content/' + currentContentTable + '/' + id, { method: 'DELETE' }); } catch {}
    }
    showToast('Deleted ' + ids.length + ' item' + (ids.length > 1 ? 's' : ''));
    bulkSelections.content.clear();
    updateBulkBar();
    await loadContentTable(currentContentTable);
    loadDashboard();
  });
  $('#users-delete-selected')?.addEventListener('click', async () => {
    const ids = Array.from(bulkSelections.users);
    if (ids.length === 0) return;
    const ok = await confirmDialog('Deactivate users', 'Deactivate ' + ids.length + ' selected user' + (ids.length > 1 ? 's' : '') + '?', 'Deactivate', 'Cancel', 'Deactivate');
    if (!ok) return;
    for (const id of ids) {
      try { await apiFetch('/api/admin/users/' + id, { method: 'DELETE' }); } catch {}
    }
    showToast('Deactivated ' + ids.length + ' user' + (ids.length > 1 ? 's' : ''));
    bulkSelections.users.clear();
    updateBulkBar();
    await loadUsers();
    loadDashboard();
  });
  $('#settings-delete-selected')?.addEventListener('click', async () => {
    const ids = Array.from(bulkSelections.settings);
    if (ids.length === 0) return;
    const ok = await confirmDialog('Delete settings', 'Delete ' + ids.length + ' selected setting' + (ids.length > 1 ? 's' : '') + '?', 'Delete', 'Cancel', 'Delete');
    if (!ok) return;
    for (const id of ids) {
      try { await apiFetch('/api/admin/settings/' + id, { method: 'DELETE' }); } catch {}
    }
    showToast('Deleted ' + ids.length + ' setting' + (ids.length > 1 ? 's' : ''));
    bulkSelections.settings.clear();
    updateBulkBar();
    await loadSettings();
    loadDashboard();
  });
}

function exportCSV(prefix) {
  const rows = $$(`#${prefix}-tbody tr[data-id]`);
  if (rows.length === 0) { showToast('No data to export', true); return; }
  const headers = prefix === 'apps'
    ? ['Reference', 'Programme', 'Name', 'Email', 'Phone', 'Status', 'Fee', 'Created']
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

// Expose global handlers for inline onclick in rendered HTML
window.openApplicationDialog = openApplicationDialog;
window.openEnquiryDialog = openEnquiryDialog;
window.openContentDialog = openContentDialog;
window.deleteApplication = deleteApplication;
window.deleteEnquiry = deleteEnquiry;
window.deleteContent = deleteContent;

wireEvents();
initApp();
