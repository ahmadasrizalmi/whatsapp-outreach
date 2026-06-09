// WhatsApp Outreach — Background Service Worker

// ─── Leads Management ────────────────────────────────────────────

async function getLeads() {
  const data = await chrome.storage.local.get('leads');
  return data.leads || [];
}

async function saveLeads(leads) {
  await chrome.storage.local.set({ leads });
}

// ─── Templates ───────────────────────────────────────────────────

async function getTemplates() {
  const data = await chrome.storage.local.get('templates');
  return data.templates || [
    {
      id: 1,
      name: 'Perkenalan',
      text: 'Halo {nama}, saya lihat {bisnis} di {lokasi}. Saya fotografer interior yang berpengalaman membantu bisnis seperti {bisnis} menampilkan foto terbaik untuk menarik lebih banyak pelanggan. Apakah tertarik untuk berdiskusi?'
    },
    {
      id: 2,
      name: 'Promo',
      text: 'Halo {nama}! Saya Ahmad, fotografer interior di Jogja. Bulan ini ada promo khusus untuk {jenis} seperti {bisnis}. Foto profesional bisa meningkatkan booking hingga 40%. Minat?'
    },
    {
      id: 3,
      name: 'Portfolio',
      text: 'Halo {nama}, saya Ahmad fotografer interior. Ini portfolio saya: [link]. Saya bisa bantu {bisnis} punya foto sekelas ini. Gratis konsultasi, hubungi saya ya!'
    }
  ];
}

async function saveTemplates(templates) {
  await chrome.storage.local.set({ templates });
}

// ─── Message Handler ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  if (msg.type === 'GET_LEADS') {
    (async () => {
      const leads = await getLeads();
      sendResponse({ success: true, leads });
    })();
    return true;
  }
  
  if (msg.type === 'IMPORT_LEADS') {
    (async () => {
      await saveLeads(msg.leads);
      sendResponse({ success: true, count: msg.leads.length });
    })();
    return true;
  }
  
  if (msg.type === 'UPDATE_LEAD') {
    (async () => {
      const leads = await getLeads();
      const idx = leads.findIndex(l => l.id === msg.lead.id);
      if (idx >= 0) leads[idx] = { ...leads[idx], ...msg.lead };
      await saveLeads(leads);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'DELETE_LEAD') {
    (async () => {
      const leads = await getLeads();
      const filtered = leads.filter(l => l.id !== msg.leadId);
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
  
  if (msg.type === 'PREVIEW_MESSAGE') {
    (async () => {
      const templates = await getTemplates();
      const template = templates.find(t => t.id === msg.templateId);
      if (!template) {
        sendResponse({ success: false, error: 'Template not found' });
        return;
      }
      
      let message = template.text;
      message = message.replace(/{nama}/g, msg.lead.name || '');
      message = message.replace(/{bisnis}/g, msg.lead.businessName || msg.lead.name || '');
      message = message.replace(/{lokasi}/g, msg.lead.address || '');
      message = message.replace(/{jenis}/g, msg.lead.businessType || '');
      message = message.replace(/{telepon}/g, msg.lead.phone || '');
      
      sendResponse({ success: true, message });
    })();
    return true;
  }
  
  if (msg.type === 'OPEN_WHATSAPP') {
    (async () => {
      let phone = msg.phone.replace(/[^0-9+]/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
      } else if (!phone.startsWith('62') && !phone.startsWith('+')) {
        phone = '62' + phone;
      }
      phone = phone.replace('+', '');
      
      const text = encodeURIComponent(msg.message);
      const url = `https://wa.me/${phone}?text=${text}`;
      
      chrome.tabs.create({ url });
      sendResponse({ success: true, url });
    })();
    return true;
  }
  
  if (msg.type === 'EXPORT_LEADS') {
    (async () => {
      const leads = await getLeads();
      const csv = [
        'name,businessName,phone,address,businessType,status',
        ...leads.map(l => 
          `"${(l.name||'').replace(/"/g,'""')}","${(l.businessName||'').replace(/"/g,'""')}","${l.phone||''}","${(l.address||'').replace(/"/g,'""')}","${l.businessType||''}","${l.status||'pending'}"`
        )
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url,
        filename: `leads-export-${new Date().toISOString().split('T')[0]}.csv`,
        saveAs: true
      }, () => {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        sendResponse({ success: true });
      });
    })();
    return true;
  }
  
  return true;
});

// ─── Open Side Panel ──────────────────────────────────────────────


console.log('[WhatsApp Outreach] Background loaded');
