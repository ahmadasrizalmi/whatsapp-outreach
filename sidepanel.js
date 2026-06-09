// WhatsApp Outreach — Side Panel Logic

const $ = id => document.getElementById(id);

let leads = [];
let templates = [];
let selectedLeadIndex = 0;

// ─── Init ──────────────────────────────────────────────────────────

async function init() {
  setupEvents();
  await loadData();
}

async function loadData() {
  // Load leads
  chrome.runtime.sendMessage({ type: 'GET_LEADS' }, (resp) => {
    if (resp?.success) {
      leads = resp.leads;
      renderLeads();
      updateStats();
      populateComposeSelect();
    }
  });
  
  // Load templates
  chrome.runtime.sendMessage({ type: 'GET_TEMPLATES' }, (resp) => {
    if (resp?.success) {
      templates = resp.templates;
      renderTemplates();
      populateTemplateSelect();
    }
  });
}

// ─── Leads ─────────────────────────────────────────────────────────

function renderLeads() {
  const container = $('lead-list');
  const importCard = $('import-card');
  const statsRow = $('stats-row');
  
  if (!leads || leads.length === 0) {
    importCard.style.display = 'block';
    statsRow.style.display = 'none';
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <div>Belum ada leads. Import CSV untuk mulai.</div>
      </div>
    `;
    return;
  }
  
  importCard.style.display = 'none';
  statsRow.style.display = 'grid';
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:15px; font-weight:600;">${leads.length} Leads</span>
      <button class="btn-sm btn-danger" id="btn-clear-leads">Hapus Semua</button>
    </div>
    <div class="lead-list">
      ${leads.map((l, i) => `
        <div class="lead-item" data-index="${i}">
          <div class="lead-status-dot ${l.status || 'pending'}"></div>
          <div class="lead-info">
            <div class="lead-name">${esc(l.name || 'Unknown')}</div>
            <div class="lead-phone">${esc(l.phone)}</div>
            <div class="lead-address">${esc(l.address || '')}</div>
          </div>
          <div class="lead-actions">
            <button class="lead-btn whatsapp" data-action="send" data-index="${i}" title="Kirim WhatsApp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
            <button class="lead-btn delete" data-action="delete" data-index="${i}" title="Hapus">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  // Event listeners
  container.querySelectorAll('.lead-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      if (btn.dataset.action === 'send') {
        selectedLeadIndex = idx;
        composeAndSend();
      } else if (btn.dataset.action === 'delete') {
        deleteLead(leads[idx].id);
      }
    });
  });
  
  // Clear all button
  const clearBtn = container.querySelector('#btn-clear-leads');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Hapus semua leads?')) {
        chrome.runtime.sendMessage({ type: 'CLEAR_LEADS' }, () => {
          leads = [];
          renderLeads();
          updateStats();
          toast('Semua leads dihapus');
        });
      }
    });
  }
}

function updateStats() {
  const total = leads.length;
  const pending = leads.filter(l => l.status === 'pending' || !l.status).length;
  const sent = leads.filter(l => l.status === 'sent').length;
  
  $('stat-total').textContent = total;
  $('stat-pending').textContent = pending;
  $('stat-sent').textContent = sent;
}

function deleteLead(id) {
  chrome.runtime.sendMessage({ type: 'DELETE_LEAD', id }, () => {
    leads = leads.filter(l => l.id !== id);
    renderLeads();
    updateStats();
    populateComposeSelect();
    toast('Lead dihapus');
  });
}

// ─── Compose ───────────────────────────────────────────────────────

function populateComposeSelect() {
  const select = $('compose-lead');
  select.innerHTML = '<option value="">Pilih lead</option>';
  
  leads.forEach((l, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${l.name || 'Unknown'} — ${l.phone}`;
    select.appendChild(option);
  });
}

function populateTemplateSelect() {
  const select = $('compose-template');
  select.innerHTML = '';
  
  templates.forEach((t, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = t.name;
    select.appendChild(option);
  });
  
  updatePreview();
}

function updatePreview() {
  const leadIdx = parseInt($('compose-lead').value);
  const templateIdx = parseInt($('compose-template').value);
  
  if (isNaN(leadIdx) || isNaN(templateIdx) || !leads[leadIdx] || !templates[templateIdx]) {
    $('compose-message').textContent = 'Pilih lead dan template untuk preview';
    return;
  }
  
  const lead = leads[leadIdx];
  const template = templates[templateIdx];
  
  // Replace variables
  let message = template.text;
  message = message.replace(/\{nama\}/g, lead.name || 'Bapak/Ibu');
  message = message.replace(/\{bisnis\}/g, lead.name || 'bisnis Anda');
  message = message.replace(/\{lokasi\}/g, lead.address || 'lokasi Anda');
  message = message.replace(/\{jenis\}/g, lead.businessType || 'bisnis');
  
  $('compose-message').textContent = message;
}

function composeAndSend() {
  const lead = leads[selectedLeadIndex];
  if (!lead) return;
  
  const templateIdx = parseInt($('compose-template').value);
  if (isNaN(templateIdx) || !templates[templateIdx]) {
    toast('Pilih template terlebih dahulu');
    return;
  }
  
  const template = templates[templateIdx];
  let message = template.text;
  message = message.replace(/\{nama\}/g, lead.name || 'Bapak/Ibu');
  message = message.replace(/\{bisnis\}/g, lead.name || 'bisnis Anda');
  message = message.replace(/\{lokasi\}/g, lead.address || 'lokasi Anda');
  message = message.replace(/\{jenis\}/g, lead.businessType || 'bisnis');
  
  // Open WhatsApp
  chrome.runtime.sendMessage({
    type: 'OPEN_WHATSAPP',
    phone: lead.phone,
    text: message
  });
  
  // Update status
  chrome.runtime.sendMessage({
    type: 'UPDATE_STATUS',
    phone: lead.phone,
    status: 'sent'
  });
  
  lead.status = 'sent';
  lead.lastContacted = new Date().toISOString();
  
  renderLeads();
  updateStats();
  toast('WhatsApp dibuka');
}

// ─── Templates ─────────────────────────────────────────────────────

function renderTemplates() {
  const container = $('template-list');
  
  container.innerHTML = templates.map((t, i) => `
    <div class="template-card" data-index="${i}">
      <div class="template-header">
        <input type="text" class="form-input" value="${esc(t.name)}" data-field="name" data-index="${i}" style="flex:1; margin-right:8px;">
        <button class="btn-sm btn-danger" data-action="delete" data-index="${i}">Hapus</button>
      </div>
      <textarea class="template-text" data-field="text" data-index="${i}">${esc(t.text)}</textarea>
      <div class="template-vars">
        <span class="template-var">{nama}</span>
        <span class="template-var">{bisnis}</span>
        <span class="template-var">{lokasi}</span>
        <span class="template-var">{jenis}</span>
      </div>
    </div>
  `).join('');
  
  // Event listeners
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      if (!isNaN(idx) && templates[idx]) {
        templates[idx][field] = e.target.value;
      }
    });
  });
  
  container.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.dataset.index);
      templates.splice(idx, 1);
      renderTemplates();
    });
  });
}

// ─── CSV Import ───────────────────────────────────────────────────

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const csv = e.target.result;
    chrome.runtime.sendMessage({ type: 'IMPORT_CSV', csv }, (resp) => {
      if (resp?.success) {
        loadData();
        let msg = `Import ${resp.imported} leads`;
        if (resp.duplicates > 0) msg += ` (${resp.duplicates} duplicates)`;
        toast(msg);
      } else {
        toast('Gagal import CSV');
      }
    });
  };
  reader.readAsText(file);
}

// ─── Export ────────────────────────────────────────────────────────

function exportCSV() {
  chrome.runtime.sendMessage({ type: 'EXPORT_CSV' }, (resp) => {
    if (resp?.success) {
      const blob = new Blob([resp.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outreach_leads_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV exported');
    }
  });
}

// ─── UI Helpers ────────────────────────────────────────────────────

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Events ────────────────────────────────────────────────────────

function setupEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  // Import CSV
  $('btn-import').addEventListener('click', () => $('csv-input').click());
  $('csv-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importCSV(e.target.files[0]);
  });
  
  // Compose
  $('compose-lead').addEventListener('change', () => {
    selectedLeadIndex = parseInt($('compose-lead').value);
    updatePreview();
  });
  $('compose-template').addEventListener('change', updatePreview);
  $('btn-send').addEventListener('click', composeAndSend);
  $('btn-send-next').addEventListener('click', () => {
    // Move to next pending lead
    const nextIdx = leads.findIndex((l, i) => i > selectedLeadIndex && (l.status === 'pending' || !l.status));
    if (nextIdx >= 0) {
      selectedLeadIndex = nextIdx;
      $('compose-lead').value = nextIdx;
      updatePreview();
    } else {
      toast('Semua leads sudah dikirim');
    }
  });
  $('btn-mark-sent').addEventListener('click', () => {
    const lead = leads[selectedLeadIndex];
    if (lead) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_STATUS',
        phone: lead.phone,
        status: 'sent'
      });
      lead.status = 'sent';
      lead.lastContacted = new Date().toISOString();
      renderLeads();
      updateStats();
      toast('Ditandai sudah terkirim');
    }
  });
  
  // Templates
  $('btn-add-template').addEventListener('click', () => {
    templates.push({
      id: `template_${Date.now()}`,
      name: 'Template Baru',
      text: 'Halo {nama}, ...',
      variables: ['nama', 'bisnis', 'lokasi']
    });
    renderTemplates();
  });
  
  $('btn-save-templates').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATES', templates }, () => {
      toast('Template disimpan');
    });
  });
  
  // Export
  $('btn-export').addEventListener('click', exportCSV);
}

// ─── Start ─────────────────────────────────────────────────────────

init();
