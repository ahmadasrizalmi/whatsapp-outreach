// WhatsApp Outreach — Background Service Worker

// ─── Leads Management ────────────────────────────────────────────

async function getLeads() {
  const data = await chrome.storage.local.get('leads');
  return data.leads || [];
}

async function saveLeads(leads) {
  await chrome.storage.local.set({ leads });
}

async function updateLeadStatus(phone, status) {
  const leads = await getLeads();
  const lead = leads.find(l => l.phone === phone);
  if (lead) {
    lead.status = status;
    lead.lastContacted = new Date().toISOString();
    await saveLeads(leads);
  }
}

// ─── Templates ────────────────────────────────────────────────────

async function getTemplates() {
  const data = await chrome.storage.local.get('templates');
  return data.templates || [
    {
      id: 'default',
      name: 'Default - Jasa Foto Interior',
      text: 'Halo {nama}, saya Ahmad Asri dari Ahmad Asri Photography. Saya lihat {bisnis} di {lokasi} dan tertarik untuk membantu meningkatkan kualitas foto interior. Foto profesional bisa meningkatkan booking hingga 40%. Apakah tertarik untuk diskusi lebih lanjut?',
      variables: ['nama', 'bisnis', 'lokasi']
    },
    {
      id: 'portfolio',
      name: 'Portfolio Share',
      text: 'Halo {nama}! Saya fotografer interior profesional di Jogja. Saya sudah membantu banyak {jenis} seperti {bisnis} untuk mendapatkan foto yang menarik minat pelanggan. Mau lihat portofolio saya? Terima kasih!',
      variables: ['nama', 'jenis', 'bisnis']
    },
    {
      id: 'promo',
      name: 'Promo Spesial',
      text: 'Halo {nama}! Ada promo spesial untuk {jenis} di {lokasi}: paket foto interior mulai Rp 500rb. Sudah termasuk editing profesional + 20 foto. Berlaku hingga akhir bulan. Minat? Balas pesan ini ya!',
      variables: ['nama', 'jenis', 'lokasi']
    }
  ];
}

async function saveTemplates(templates) {
  await chrome.storage.local.set({ templates });
}

// ─── CSV Parser ──────────────────────────────────────────────────

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const leads = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    
    // Map to lead object
    const lead = {};
    headers.forEach((h, idx) => {
      lead[h] = (values[idx] || '').replace(/"/g, '').trim();
    });
    
    // Normalize fields
    const phone = lead.phone || lead.telepon || lead.whatsapp || lead['phone/whatsapp'] || '';
    if (!phone) continue;
    
    // Clean phone: remove spaces, dashes, ensure starts with 62 or 08
    let cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    if (!cleanPhone.startsWith('62') && !cleanPhone.startsWith('+')) cleanPhone = '62' + cleanPhone;
    cleanPhone = cleanPhone.replace(/^\+/, '');
    
    leads.push({
      id: `lead_${Date.now()}_${i}`,
      name: lead.name || lead.nama || lead['business name'] || lead['nama bisnis'] || '',
      phone: cleanPhone,
      phoneRaw: phone,
      email: lead.email || '',
      address: lead.address || lead.alamat || '',
      website: lead.website || '',
      mapsUrl: lead['maps url'] || lead['google maps url'] || '',
      businessType: lead.type || lead.jenis || lead['business type'] || lead['jenis bisnis'] || '',
      status: 'pending',
      lastContacted: null,
      notes: ''
    });
  }
  
  return leads;
}

// ─── Message Generator ────────────────────────────────────────────

function generateMessage(template, lead, customVars = {}) {
  let text = template;
  
  // Replace variables
  const vars = {
    nama: lead.name || 'Bapak/Ibu',
    bisnis: lead.name || 'bisnis Anda',
    lokasi: lead.address || 'lokasi Anda',
    jenis: lead.businessType || 'bisnis',
    alamat: lead.address || '',
    ...customVars
  };
  
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  return text;
}

// ─── Message Handler ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  if (msg.type === 'IMPORT_CSV') {
    (async () => {
      const leads = parseCSV(msg.csv);
      const existing = await getLeads();
      
      // Merge: skip duplicates by phone number
      const existingPhones = new Set(existing.map(l => l.phone));
      const newLeads = leads.filter(l => !existingPhones.has(l.phone));
      
      const all = [...existing, ...newLeads];
      await saveLeads(all);
      
      sendResponse({ 
        success: true, 
        imported: newLeads.length,
        duplicates: leads.length - newLeads.length,
        total: all.length
      });
    })();
    return true;
  }
  
  if (msg.type === 'GET_LEADS') {
    (async () => {
      const leads = await getLeads();
      sendResponse({ success: true, leads });
    })();
    return true;
  }
  
  if (msg.type === 'UPDATE_STATUS') {
    (async () => {
      await updateLeadStatus(msg.phone, msg.status);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'DELETE_LEAD') {
    (async () => {
      const leads = await getLeads();
      const filtered = leads.filter(l => l.id !== msg.id);
      await saveLeads(filtered);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'CLEAR_LEADS') {
    (async () => {
      await saveLeads([]);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'GET_TEMPLATES') {
    (async () => {
      const templates = await getTemplates();
      sendResponse({ success: true, templates });
    })();
    return true;
  }
  
  if (msg.type === 'SAVE_TEMPLATES') {
    (async () => {
      await saveTemplates(msg.templates);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'GENERATE_MESSAGE') {
    (async () => {
      const templates = await getTemplates();
      const template = templates.find(t => t.id === msg.templateId) || templates[0];
      const message = generateMessage(template.text, msg.lead, msg.customVars);
      sendResponse({ success: true, message });
    })();
    return true;
  }
  
  if (msg.type === 'OPEN_WHATSAPP') {
    // Open wa.me link
    const phone = msg.phone;
    const text = encodeURIComponent(msg.text);
    const url = `https://wa.me/${phone}?text=${text}`;
    
    chrome.tabs.create({ url, active: false });
    sendResponse({ success: true });
    return true;
  }
  
  if (msg.type === 'EXPORT_CSV') {
    (async () => {
      const leads = await getLeads();
      const headers = ['Name', 'Phone', 'Email', 'Address', 'Website', 'Status', 'Last Contacted'];
      const rows = leads.map(l => [
        l.name, l.phoneRaw || l.phone, l.email, l.address, l.website, l.status, l.lastContacted || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      
      const csv = [headers.join(','), ...rows].join('\n');
      sendResponse({ success: true, csv });
    })();
    return true;
  }
});

// ─── Open Side Panel ──────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('[WhatsApp Outreach] Background loaded');
