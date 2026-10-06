// WebCare Admin Operations Dashboard Logic - Real-Time Queue & Voice Alert
document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

let tickets = [];
let currentFilter = 'active';
let currentSearch = '';
let selectedDate = getLocalDateStr(new Date());
let activeTicketForModal = null;
let knownTicketIds = new Set();
let isInitialLoad = true;

// Helper: Format Date to YYYY-MM-DD in local time
function getLocalDateStr(d) {
  const dateObj = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Extract YYYY-MM-DD from ticket
function getTicketDateStr(ticket) {
  if (!ticket) return '';
  const val = ticket.createdAt || ticket.date;
  if (!val) {
    return getLocalDateStr(new Date());
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return getLocalDateStr(d);
  } catch (e) {
    return '';
  }
}

function initAdminDashboard() {
  initAdminAuth();
  loadTicketsFromStorage();
  updateGreetingHeader();
  renderCalendarStrip();
  initFilterPills();
  initSearch();
  initModalHandlers();
  initClearQueue();
  initLogout();
  initVoiceAlertTest();
  initRealtimePolling();
  initLightboxHandlers();
  initSupabaseIntegration();
  initSupabaseSettingsModal();

  // Listen for storage events across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'webcare_tickets') {
      checkAndSyncTickets(true);
    }
  });

  // Listen for BroadcastChannel messages across tabs
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('webcare_sync_channel');
    channel.onmessage = () => {
      checkAndSyncTickets(true);
    };
  }

  // Refresh immediately when switching back to admin tab
  window.addEventListener('focus', () => checkAndSyncTickets(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkAndSyncTickets(true);
    }
  });

  // Preload speech synthesis voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  renderDashboard();
  isInitialLoad = false;
}

function loadTicketsFromStorage() {
  try {
    const raw = localStorage.getItem('webcare_tickets');
    if (raw) {
      tickets = JSON.parse(raw);
    } else {
      tickets = [];
      localStorage.setItem('webcare_tickets', JSON.stringify([]));
    }
    knownTicketIds = new Set(tickets.map(t => t.id));
  } catch (err) {
    console.error('Error loading tickets from storage:', err);
    tickets = [];
    knownTicketIds = new Set();
  }

  // If Supabase is configured, fetch latest from DB in background
  if (window.WebCareSupabase && window.WebCareSupabase.isConfigured()) {
    window.WebCareSupabase.fetchTickets().then(dbTickets => {
      if (dbTickets && Array.isArray(dbTickets)) {
        tickets = dbTickets;
        knownTicketIds = new Set(tickets.map(t => t.id));
        try {
          localStorage.setItem('webcare_tickets', JSON.stringify(tickets));
        } catch (e) {}
        renderDashboard();
      }
    });
  }
}

function checkAndSyncTickets(shouldNotify) {
  try {
    const raw = localStorage.getItem('webcare_tickets');
    if (raw === null) return;

    const stored = JSON.parse(raw || '[]');
    const newTickets = stored.filter(t => !knownTicketIds.has(t.id));

    if (newTickets.length > 0) {
      tickets = stored;
      knownTicketIds = new Set(tickets.map(t => t.id));
      renderDashboard();

      if (shouldNotify && !isInitialLoad) {
        playNewIssueVoiceNotification();
        showToast(`Issue baru masuk: ${newTickets[0].id} (${newTickets[0].reporter})`);
      }
    } else if (JSON.stringify(stored) !== JSON.stringify(tickets)) {
      tickets = stored;
      knownTicketIds = new Set(tickets.map(t => t.id));
      renderDashboard();
    }
  } catch (err) {
    console.error('Error syncing tickets:', err);
  }
}

function saveTicketsToStorage() {
  try {
    localStorage.setItem('webcare_tickets', JSON.stringify(tickets));
    knownTicketIds = new Set(tickets.map(t => t.id));
  } catch (err) {
    console.error('Error saving tickets:', err);
  }
  renderDashboard();
}

function initRealtimePolling() {
  setInterval(() => {
    checkAndSyncTickets(true);
  }, 800);
}

/* ==========================================================================
   VOICE & AUDIO NOTIFICATION ("Issue baru masuk")
   ========================================================================== */
function playNewIssueVoiceNotification() {
  // 1. Play clean chime sound via Web Audio API
  playChimeTone();

  // 2. Play Google Speech Synthesis Voice: "Issue baru masuk"
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech

      const utterance = new SpeechSynthesisUtterance('Issue baru masuk');
      utterance.lang = 'id-ID';
      utterance.rate = 0.95; // Natural speed
      utterance.pitch = 1.05; // Friendly pitch
      utterance.volume = 1.0;

      // Find Google Indonesian voice or any Indonesian voice available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => 
        v.lang === 'id-ID' || 
        v.lang === 'id_ID' || 
        v.lang.startsWith('id') || 
        v.name.toLowerCase().includes('indonesia')
      );

      if (idVoice) {
        utterance.voice = idVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
    }
  }
}

function playChimeTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, audioCtx.currentTime + 0.24); // D6

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.55);
  } catch (err) {
    // ignore
  }
}

function initVoiceAlertTest() {
  const btn = document.getElementById('testVoiceBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    playNewIssueVoiceNotification();
    showToast('Playing voice notification: "Issue baru masuk"');
  });
}

function renderDashboard() {
  updateGreetingHeader();
  renderCalendarStrip();
  renderIssuesList();
  renderInsightsMetrics();
  updateReminderBanner();
}

/* ==========================================================================
   GREETING & DATE HEADER
   ========================================================================== */
function updateGreetingHeader() {
  const greetingTitle = document.getElementById('greetingUser');
  const dateDisplay = document.getElementById('currentDateDisplay');
  const now = new Date();

  if (greetingTitle) {
    const hour = now.getHours();
    let timeGreeting = 'Morning';
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Afternoon';
    } else if (hour >= 17) {
      timeGreeting = 'Evening';
    }
    greetingTitle.textContent = `${timeGreeting}, Engineer`;
  }

  if (dateDisplay) {
    const options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    dateDisplay.textContent = now.toLocaleDateString('en-US', options);
  }
}

/* ==========================================================================
   RENDER ISSUES LIST (FILTERED BY STATUS, SEARCH & SELECTED DATE)
   ========================================================================== */
function renderIssuesList() {
  const container = document.getElementById('issuesListContainer');
  const countBadge = document.getElementById('totalFilteredCount');
  const feedTitle = document.getElementById('feedSectionTitle');
  if (!container) return;

  if (feedTitle) {
    if (currentFilter === 'history' || currentFilter === 'done') {
      feedTitle.textContent = 'History (Resolved Issues)';
    } else if (currentFilter === 'pending') {
      feedTitle.textContent = 'Pending Issues';
    } else if (currentFilter === 'working') {
      feedTitle.textContent = 'On Working Issues';
    } else {
      feedTitle.textContent = 'Active Issues';
    }
  }

  const filtered = tickets.filter(t => {
    let matchesFilter = false;
    if (currentFilter === 'active' || currentFilter === 'all') {
      // Active queue: only pending and working (done issues are moved to History)
      matchesFilter = (t.status === 'pending' || t.status === 'working');
    } else if (currentFilter === 'history' || currentFilter === 'done') {
      // History queue: only done/resolved issues
      matchesFilter = (t.status === 'done');
    } else {
      matchesFilter = (t.status === currentFilter);
    }

    const q = currentSearch.toLowerCase().trim();
    const matchesSearch = !q || 
      (t.id && t.id.toLowerCase().includes(q)) || 
      (t.reporter && t.reporter.toLowerCase().includes(q)) || 
      (t.phone && t.phone.toLowerCase().includes(q)) || 
      (t.website && t.website.toLowerCase().includes(q)) || 
      (t.details && t.details.toLowerCase().includes(q));

    // Date filtering: match ticket createdAt with selectedDate (YYYY-MM-DD)
    const ticketDateStr = getTicketDateStr(t);
    const matchesDate = !selectedDate || (ticketDateStr === selectedDate);

    return matchesFilter && matchesSearch && matchesDate;
  });

  if (countBadge) {
    countBadge.textContent = filtered.length;
  }

  if (filtered.length === 0) {
    let dateLabel = 'this selected day';
    if (selectedDate) {
      try {
        const dParts = selectedDate.split('-');
        if (dParts.length === 3) {
          const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
          dateLabel = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }
      } catch(e) {
        dateLabel = selectedDate;
      }
    }

    let emptyTitle = `No issues found for ${dateLabel}`;
    let emptyDesc = '';
    if (currentFilter === 'history' || currentFilter === 'done') {
      emptyTitle = `Belum ada riwayat selesai untuk ${dateLabel}`;
      emptyDesc = 'Issue yang berstatus "Done" akan otomatis tersimpan di tab History ini.';
    } else if (currentFilter === 'pending') {
      emptyTitle = `Tidak ada issue Pending untuk ${dateLabel}`;
      emptyDesc = 'Semua issue baru yang belum ditangani akan muncul di sini.';
    } else if (currentFilter === 'working') {
      emptyTitle = `Tidak ada issue On Working untuk ${dateLabel}`;
      emptyDesc = 'Issue yang sedang dalam proses perbaikan akan muncul di sini.';
    } else {
      emptyTitle = `Antrean issue aktif kosong untuk ${dateLabel}`;
      emptyDesc = 'Tidak ada tiket pending atau on working pada tanggal ini. Tiket yang sudah selesai (Done) tersimpan di tab History.';
    }

    container.innerHTML = `
      <div class="empty-issues-box">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#94a3b8" stroke-width="1.8" style="margin-bottom: 8px;">
          <path d="M22 12h-6l-2 3h-4l-2-3H2"></path>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        </svg>
        <p style="font-weight:600; color:#1e293b; margin-bottom:4px;">${emptyTitle}</p>
        <p style="font-size:0.82rem; color:#64748b;">${emptyDesc}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(ticket => {
    const statusClass = `status-${ticket.status}`;
    const statusDot = ticket.status === 'done' 
      ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : (ticket.status === 'working' ? '<span class="working-spinner-dot"></span>' : '<span class="pending-hollow-dot"></span>');
    const waLink = buildWhatsAppLink(ticket);
    const webUrl = ticket.website ? formatWebsiteUrl(ticket.website) : '#';
    const rawWeb = ticket.website || 'example.com';
    const shortWeb = shortenDisplayUrl(rawWeb, 22);
    const hasFiles = (ticket.files && ticket.files.length > 0) || (ticket.fileCount > 0);
    const fileNum = (ticket.files ? ticket.files.length : ticket.fileCount) || 0;

    return `
      <div class="issue-item-card ${statusClass}" data-id="${ticket.id}">
        
        <!-- Left details -->
        <div class="issue-left-group" onclick="openTicketDetail('${ticket.id}')">
          <div class="issue-status-indicator" title="Status: ${ticket.status.toUpperCase()}">
            ${statusDot}
          </div>

          <div class="issue-content">
            <div class="issue-title-line">
              <span class="ticket-code">${ticket.id}</span>
              <span class="reporter-name">${escapeHtml(ticket.reporter)}</span>
              ${ticket.status === 'done' ? '<span class="history-tag-pill">RESOLVED</span>' : ''}
            </div>
            <div class="issue-subline">
              <a href="${webUrl}" target="_blank" rel="noopener noreferrer" class="website-url-link subline-item" onclick="event.stopPropagation()" title="Open ${escapeHtml(rawWeb)} in new tab">
                <span class="url-text-clipped">${escapeHtml(shortWeb)}</span>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; flex-shrink:0;">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
              ${ticket.phone ? `<span class="subline-item subline-wa" title="WA: ${escapeHtml(ticket.phone)}">WA: ${escapeHtml(ticket.phone)}</span>` : ''}
              <span class="subline-item time-ago">${ticket.timeStr || 'Recently'}</span>
              ${hasFiles ? `<span class="subline-item proof-count-badge">${fileNum} proof</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Right Quick Status Toggle Buttons & Action -->
        <div class="issue-actions-group">
          <button class="status-toggle-btn btn-pending ${ticket.status === 'pending' ? 'active' : ''}" 
                  onclick="updateTicketStatus('${ticket.id}', 'pending')" title="Mark Pending">
            Pending
          </button>
          <button class="status-toggle-btn btn-working ${ticket.status === 'working' ? 'active' : ''}" 
                  onclick="updateTicketStatus('${ticket.id}', 'working')" title="Mark On Working">
            Working
          </button>
          <button class="status-toggle-btn btn-done ${ticket.status === 'done' ? 'active' : ''}" 
                  onclick="updateTicketStatus('${ticket.id}', 'done')" title="${ticket.status === 'done' ? 'Resolved in History' : 'Mark Done & Move to History'}">
            Done
          </button>

          ${ticket.status === 'done' && ticket.phone ? `
            <a href="${waLink}" target="_blank" class="quick-remind-btn" title="Notify client via WhatsApp">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </a>
          ` : ''}

          <button class="view-detail-btn" onclick="openTicketDetail('${ticket.id}')" title="View Full Ticket Details">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

/* ==========================================================================
   UPDATE TICKET STATUS
   ========================================================================== */
window.updateTicketStatus = function(ticketId, newStatus) {
  const target = tickets.find(t => t.id === ticketId);
  if (!target) return;

  target.status = newStatus;
  if (newStatus === 'done') {
    target.completedAt = new Date().toISOString();
  }
  saveTicketsToStorage();

  // Sync to Supabase if configured
  if (window.WebCareSupabase && window.WebCareSupabase.isConfigured()) {
    window.WebCareSupabase.updateStatus(ticketId, newStatus);
  }
  
  if (newStatus === 'done') {
    showToast(`Tiket ${ticketId} selesai & dipindahkan ke History`);
  } else {
    showToast(`Tiket ${ticketId} status diubah ke ${newStatus.toUpperCase()}`);
  }
  
  if (activeTicketForModal && activeTicketForModal.id === ticketId) {
    updateModalView(target);
  }
};

/* ==========================================================================
   NOTIFICATION LINK BUILDERS (WhatsApp & Email with Country Code Support)
   ========================================================================== */
function buildWhatsAppLink(ticket) {
  if (!ticket || !ticket.phone) return '#';
  let cleanDigits = ticket.phone.replace(/[^0-9]/g, '');
  if (!cleanDigits) return '#';
  if (cleanDigits.startsWith('0')) {
    cleanDigits = '62' + cleanDigits.slice(1);
  }
  
  const msg = `Halo ${ticket.reporter},\n\nKami dari tim WebCare Support ingin menginformasikan bahwa tiket kendala Anda (${ticket.id}) untuk website ${ticket.website} saat ini telah SELESAI (DONE) dan berhasil diperbaiki oleh tim engineer kami.\n\nDetail kendala:\n"${ticket.details}"\n\nSilakan dicek kembali website Anda. Jika ada kendala lebih lanjut, silakan balas pesan ini.\n\nTerima kasih,\nTim WebCare Support & Maintenance`;
  
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(msg)}`;
}

function buildEmailLink(ticket) {
  if (!ticket || !ticket.email) return '#';
  const subject = `[WebCare Solved] Kendala Website ${ticket.id} (${ticket.website}) Telah Selesai Diperbaiki`;
  const body = `Halo ${ticket.reporter},\n\nKami dari tim WebCare Support ingin menginformasikan bahwa tiket kendala Anda (${ticket.id}) untuk website ${ticket.website} saat ini telah berstatus SELESAI (DONE) dan berhasil diperbaiki oleh tim engineer kami.\n\nDetail kendala:\n${ticket.details}\n\nSilakan dicek kembali website Anda. Apabila masih ada kendala lain, jangan ragu untuk menghubungi kami kembali.\n\nSalam hormat,\nTim WebCare Support & Maintenance\nPT Webcare Digital Indonesia`;
  
  return `mailto:${ticket.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ==========================================================================
   RENDER PROGRESS & INSIGHTS (CIRCULAR DONUT GAUGE & BREAKDOWN)
   ========================================================================== */
function renderInsightsMetrics() {
  const total = tickets.length;
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const workingCount = tickets.filter(t => t.status === 'working').length;
  const doneCount = tickets.filter(t => t.status === 'done').length;

  const pendingPct = total > 0 ? Math.round((pendingCount / total) * 100) : 0;
  const workingPct = total > 0 ? Math.round((workingCount / total) * 100) : 0;
  const donePct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // 1. Update Breakdown Percentages & Counts
  const pctPending = document.getElementById('pctPending');
  const pctWorking = document.getElementById('pctWorking');
  const pctDone = document.getElementById('pctDone');
  const countPending = document.getElementById('countPending');
  const countWorking = document.getElementById('countWorking');
  const countDone = document.getElementById('countDone');

  if (pctPending) pctPending.textContent = `${pendingPct}%`;
  if (pctWorking) pctWorking.textContent = `${workingPct}%`;
  if (pctDone) pctDone.textContent = `${donePct}%`;

  if (countPending) countPending.textContent = `${pendingCount} issue${pendingCount !== 1 ? 's' : ''}`;
  if (countWorking) countWorking.textContent = `${workingCount} issue${workingCount !== 1 ? 's' : ''}`;
  if (countDone) countDone.textContent = `${doneCount} issue${doneCount !== 1 ? 's' : ''}`;

  // 2. Update SVG Circular Ring Donut Segments
  const C = 2 * Math.PI * 70; // 439.8225
  const segDone = document.getElementById('donutSegmentDone');
  const segWorking = document.getElementById('donutSegmentWorking');
  const segPending = document.getElementById('donutSegmentPending');

  if (segDone && segWorking && segPending) {
    if (total === 0) {
      segDone.style.strokeDasharray = `0 ${C}`;
      segWorking.style.strokeDasharray = `0 ${C}`;
      segPending.style.strokeDasharray = `0 ${C}`;
    } else {
      const lenDone = (doneCount / total) * C;
      const lenWorking = (workingCount / total) * C;
      const lenPending = (pendingCount / total) * C;

      // Segment 1: Done (Starts at 0deg)
      segDone.style.strokeDasharray = `${lenDone} ${C}`;
      segDone.style.strokeDashoffset = '0';

      // Segment 2: Ongoing / Working (Offset by Done length)
      segWorking.style.strokeDasharray = `${lenWorking} ${C}`;
      segWorking.style.strokeDashoffset = `${-lenDone}`;

      // Segment 3: Pending (Offset by Done + Working length)
      segPending.style.strokeDasharray = `${lenPending} ${C}`;
      segPending.style.strokeDashoffset = `${-(lenDone + lenWorking)}`;
    }
  }

  // 3. Update Center Ring Info
  const centerRate = document.getElementById('donutCenterRate');
  const centerLabel = document.getElementById('donutCenterLabel');
  if (centerRate) {
    centerRate.textContent = total > 0 ? `${donePct}%` : '0%';
  }
  if (centerLabel) {
    if (total === 0) {
      centerLabel.textContent = 'No Issues';
    } else if (donePct === 100) {
      centerLabel.textContent = 'All Done';
    } else {
      centerLabel.textContent = 'Resolved';
    }
  }

  // 4. Update Summary Box Metrics
  const rateDisplay = document.getElementById('resolutionRateDisplay');
  const totalDisplay = document.getElementById('statTotalTickets');
  const completedDisplay = document.getElementById('statCompletedTickets');

  if (rateDisplay) rateDisplay.textContent = total > 0 ? `${donePct}% Resolved` : '100% Rate';
  if (totalDisplay) totalDisplay.textContent = total;
  if (completedDisplay) completedDisplay.textContent = doneCount;
}

function updateReminderBanner() {
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const workingCount = tickets.filter(t => t.status === 'working').length;

  const pendingBadge = document.getElementById('pendingCountBadge');
  const workingBadge = document.getElementById('workingCountBadge');

  if (pendingBadge) pendingBadge.textContent = `${pendingCount} Pending`;
  if (workingBadge) workingBadge.textContent = `${workingCount} On Working`;
}

/* ==========================================================================
   INTERACTIONS: FILTER PILLS, SEARCH, CALENDAR STRIP
   ========================================================================== */
function initFilterPills() {
  const buttons = document.querySelectorAll('.filter-pill');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderIssuesList();
    });
  });
}

function initSearch() {
  const searchInput = document.getElementById('issueSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderIssuesList();
  });
}

/* ==========================================================================
   DYNAMIC 7-DAY CALENDAR STRIP (Last 7 days ending on today)
   ========================================================================== */
function renderCalendarStrip() {
  const container = document.getElementById('calendarStrip');
  if (!container) return;

  const today = new Date();
  const days = [];

  // Generate 7 days ending with today (i=6 is 6 days ago, i=0 is today)
  // e.g. if today is 7th, days will be 1st, 2nd, 3rd, 4th, 5th, 6th, 7th
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  // Check if selectedDate is valid; if not set, default to today
  if (!selectedDate) {
    selectedDate = getLocalDateStr(today);
  }

  container.innerHTML = days.map(d => {
    const dateStr = getLocalDateStr(d);
    const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const isSelected = (dateStr === selectedDate);
    const isToday = (dateStr === getLocalDateStr(today));

    // Check if tickets exist for this date
    const hasTicketsOnDay = tickets.some(t => getTicketDateStr(t) === dateStr);

    return `
      <button class="calendar-day-item ${isSelected ? 'active' : ''} ${hasTicketsOnDay ? 'has-tickets' : ''}" 
              data-date="${dateStr}" 
              data-day="${dayShort}"
              type="button"
              title="${d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}${isToday ? ' (Today)' : ''}">
        <span class="day-name">${dayShort}</span>
        <span class="day-number">${dayNum}</span>
      </button>
    `;
  }).join('');

  // Attach click listeners to day items
  const dayButtons = container.querySelectorAll('.calendar-day-item');
  dayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetDate = btn.getAttribute('data-date');
      selectedDate = targetDate;

      dayButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      renderIssuesList();

      const dParts = targetDate.split('-');
      if (dParts.length === 3) {
        const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
        const formatted = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        showToast(`Filtered queue for ${formatted}`);
      }
    });
  });
}

/* ==========================================================================
   DETAIL MODAL HANDLERS
   ========================================================================== */
window.openTicketDetail = function(ticketId) {
  const target = tickets.find(t => t.id === ticketId);
  if (!target) return;

  activeTicketForModal = target;
  updateModalView(target);

  const modal = document.getElementById('ticketDetailModal');
  if (modal) modal.classList.add('active');
};

function updateModalView(ticket) {
  document.getElementById('modalDetailTicketId').textContent = ticket.id;
  
  const badge = document.getElementById('modalDetailStatusBadge');
  badge.textContent = ticket.status.toUpperCase();
  badge.className = `modal-status-badge status-${ticket.status}`;

  document.getElementById('modalDetailReporter').textContent = ticket.reporter || '-';
  document.getElementById('modalDetailEmail').textContent = ticket.email || '-';
  document.getElementById('modalDetailPhone').textContent = ticket.phone || 'Not provided';
  
  // Clickable Website Domain link
  const websiteElem = document.getElementById('modalDetailWebsite');
  if (websiteElem) {
    const rawWeb = (ticket.website || '').trim();
    if (rawWeb && rawWeb !== '-') {
      const formattedUrl = formatWebsiteUrl(rawWeb);
      const shortWeb = shortenDisplayUrl(rawWeb, 32);
      websiteElem.innerHTML = `
        <a href="${formattedUrl}" target="_blank" rel="noopener noreferrer" class="clickable-website-domain-link" title="Open ${escapeHtml(rawWeb)} in new tab">
          <span class="url-text-clipped">${escapeHtml(shortWeb)}</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      `;
    } else {
      websiteElem.textContent = 'Not specified';
    }
  }

  document.getElementById('modalDetailTime').textContent = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent';
  document.getElementById('modalDetailDesc').textContent = ticket.details || 'No description entered.';

  // Render Proof & Attachments Preview (Gallery with Lightbox / Download)
  const proofBox = document.getElementById('modalDetailProofBox');
  if (ticket.files && ticket.files.length > 0) {
    proofBox.innerHTML = `
      <div class="proof-attachments-gallery">
        ${ticket.files.map((file) => {
          if (file.isImage && file.dataUrl) {
            return `
              <div class="proof-thumb-card" onclick="openLightbox('${file.dataUrl}', '${escapeHtml(file.name)}')">
                <div class="proof-thumb-img-box">
                  <img src="${file.dataUrl}" alt="${escapeHtml(file.name)}" loading="lazy">
                  <div class="proof-zoom-overlay">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      <line x1="11" y1="8" x2="11" y2="14"></line>
                      <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                    <span>View</span>
                  </div>
                </div>
                <div class="proof-info-row">
                  <span class="proof-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                  <span class="proof-file-size">${formatFileSize(file.size)}</span>
                </div>
              </div>
            `;
          } else {
            return `
              <div class="proof-file-card">
                <div class="proof-doc-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0052ff" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div class="proof-info-row">
                  <span class="proof-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                  <span class="proof-file-size">${formatFileSize(file.size)}</span>
                </div>
                ${file.dataUrl ? `<a href="${file.dataUrl}" download="${escapeHtml(file.name)}" class="proof-dl-btn" title="Download File">Download</a>` : ''}
              </div>
            `;
          }
        }).join('')}
      </div>
    `;
  } else if (ticket.fileCount > 0) {
    proofBox.innerHTML = `
      <div class="proof-fallback-notice">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0052ff" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span><strong>${ticket.fileCount} file(s)</strong> attached by client.</span>
      </div>
    `;
  } else {
    proofBox.innerHTML = '<span class="no-proof-text">No screenshots or error log files attached.</span>';
  }

  // Update status buttons in modal
  const statusBtns = document.querySelectorAll('.btn-change-status');
  statusBtns.forEach(btn => {
    const s = btn.getAttribute('data-status');
    if (s === ticket.status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Setup Notification / Remind Client Buttons
  const waBtn = document.getElementById('remindWhatsAppBtn');
  const emailBtn = document.getElementById('remindEmailBtn');

  if (waBtn) {
    if (ticket.phone) {
      waBtn.href = buildWhatsAppLink(ticket);
      waBtn.classList.remove('disabled');
      waBtn.title = `Send WhatsApp message to ${ticket.phone}`;
    } else {
      waBtn.href = '#';
      waBtn.classList.add('disabled');
      waBtn.title = 'No WhatsApp number provided by user';
    }
  }

  if (emailBtn) {
    if (ticket.email) {
      emailBtn.href = buildEmailLink(ticket);
      emailBtn.classList.remove('disabled');
      emailBtn.title = `Send email notification to ${ticket.email}`;
    } else {
      emailBtn.href = '#';
      emailBtn.classList.add('disabled');
    }
  }
}

function initModalHandlers() {
  const modal = document.getElementById('ticketDetailModal');
  const closeBtn = document.getElementById('closeDetailModalBtn');
  const confirmBtn = document.getElementById('modalConfirmDoneBtn');
  const deleteBtn = document.getElementById('deleteTicketBtn');
  const refreshInsightsBtn = document.getElementById('refreshInsightsBtn');

  const closeModal = () => {
    if (modal) modal.classList.remove('active');
    activeTicketForModal = null;
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (confirmBtn) confirmBtn.addEventListener('click', closeModal);
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Modal change status buttons
  const statusBtns = document.querySelectorAll('.btn-change-status');
  statusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!activeTicketForModal) return;
      const newStatus = btn.getAttribute('data-status');
      window.updateTicketStatus(activeTicketForModal.id, newStatus);
    });
  });

  // Delete ticket
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (!activeTicketForModal) return;
      if (confirm(`Are you sure you want to delete ticket ${activeTicketForModal.id}?`)) {
        tickets = tickets.filter(t => t.id !== activeTicketForModal.id);
        saveTicketsToStorage();
        closeModal();
        showToast('Ticket deleted successfully');
      }
    });
  }

  if (refreshInsightsBtn) {
    refreshInsightsBtn.addEventListener('click', () => {
      renderInsightsMetrics();
      showToast('Operations metrics refreshed');
    });
  }
}

/* ==========================================================================
   CLEAR QUEUE & LOGOUT
   ========================================================================== */
function initClearQueue() {
  const clearBtn = document.getElementById('clearAllBtn');
  if (!clearBtn) return;

  clearBtn.addEventListener('click', () => {
    if (tickets.length === 0) {
      showToast('Queue is already empty');
      return;
    }
    if (confirm('Are you sure you want to clear all tickets from the queue?')) {
      tickets = [];
      localStorage.setItem('webcare_ticket_seq', '0');
      saveTicketsToStorage();

      if (window.WebCareSupabase && window.WebCareSupabase.isConfigured()) {
        window.WebCareSupabase.clearQueue();
      }

      showToast('All tickets cleared and sequence reset to #00001');
    }
  });
}

function initLogout() {
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    if (confirm('Apakah Anda ingin logout dari Admin Portal?')) {
      deleteCookie(ADMIN_COOKIE_NAME);
      const overlay = document.getElementById('adminAuthOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        const userInput = document.getElementById('adminUsernameInput');
        if (userInput) userInput.focus();
      }
      showToast('Anda telah logout dari Admin Portal.');
    }
  });
}

/* ==========================================================================
   ADMIN AUTHENTICATION GATE (Username: webcareidn | Password: webcareidn123)
   ========================================================================== */
const ADMIN_VALID_USER = 'webcareidn';
const ADMIN_VALID_PASS = 'webcareidn123';
const ADMIN_COOKIE_NAME = 'webcare_admin_auth';
const ADMIN_COOKIE_DAYS = 30;

function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Strict`;
}

function initAdminAuth() {
  const overlay = document.getElementById('adminAuthOverlay');
  const form = document.getElementById('adminLoginForm');
  const userInput = document.getElementById('adminUsernameInput');
  const passInput = document.getElementById('adminPasswordInput');
  const errorMsg = document.getElementById('authErrorMsg');

  if (!overlay || !form) return;

  // Check existing session via cookie (30-day)
  const isAuthenticated = getCookie(ADMIN_COOKIE_NAME) === 'true';

  if (isAuthenticated) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
    if (userInput) {
      setTimeout(() => userInput.focus(), 150);
    }
  }

  // Clear error on typing
  if (userInput && passInput) {
    [userInput, passInput].forEach(inp => {
      inp.addEventListener('input', () => {
        if (errorMsg) errorMsg.classList.remove('show');
      });
    });
  }

  // Handle Login Form Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = (userInput ? userInput.value.trim() : '');
    const p = (passInput ? passInput.value.trim() : '');

    if (u === ADMIN_VALID_USER && p === ADMIN_VALID_PASS) {
      setCookie(ADMIN_COOKIE_NAME, 'true', ADMIN_COOKIE_DAYS);
      overlay.classList.add('hidden');
      if (errorMsg) errorMsg.classList.remove('show');
      form.reset();
      showToast('Selamat datang, Administrator WebCare! (Login tersimpan 30 hari)');
    } else {
      if (errorMsg) errorMsg.classList.add('show');
      if (passInput) {
        passInput.value = '';
        passInput.focus();
      }
    }
  });
}

/* ==========================================================================
   UTILITY: TOAST NOTIFICATION
   ========================================================================== */
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('adminToast');
  if (!toast) return;

  toast.textContent = msg;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function formatWebsiteUrl(url) {
  if (!url) return '#';
  let trimmed = String(url).trim();
  if (!trimmed || trimmed === '-') return '#';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return 'https://' + trimmed;
}

function shortenDisplayUrl(url, maxLen = 22) {
  if (!url) return 'example.com';
  let clean = String(url).trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
  
  if (clean.length > maxLen) {
    return clean.substring(0, maxLen - 3) + '...';
  }
  return clean;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/* ==========================================================================
   IMAGE LIGHTBOX / PREVIEW VIEWER
   ========================================================================== */
window.openLightbox = function(imgSrc, title) {
  const modal = document.getElementById('imageLightboxModal');
  const imgEl = document.getElementById('lightboxImageEl');
  const titleEl = document.getElementById('lightboxImageTitle');
  const downloadBtn = document.getElementById('lightboxDownloadBtn');

  if (!modal || !imgEl) return;

  imgEl.src = imgSrc;
  if (titleEl) titleEl.textContent = title || 'Screenshot Preview';
  if (downloadBtn) {
    downloadBtn.href = imgSrc;
    downloadBtn.download = title || 'screenshot.jpg';
  }

  modal.classList.add('active');
};

function initLightboxHandlers() {
  const modal = document.getElementById('imageLightboxModal');
  const closeBtn = document.getElementById('closeLightboxBtn');

  if (!modal) return;

  const closeLightbox = () => {
    modal.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeLightbox();
    }
  });
}

/* ==========================================================================
   SUPABASE DATABASE & REALTIME SETTINGS INTEGRATION
   ========================================================================== */
function initSupabaseIntegration() {
  updateSupabaseStatusIndicator();

  if (window.WebCareSupabase && window.WebCareSupabase.isConfigured()) {
    // 1. Initial background fetch
    window.WebCareSupabase.fetchTickets().then(dbTickets => {
      if (dbTickets && Array.isArray(dbTickets)) {
        tickets = dbTickets;
        knownTicketIds = new Set(tickets.map(t => t.id));
        try {
          localStorage.setItem('webcare_tickets', JSON.stringify(tickets));
        } catch (e) {}
        renderDashboard();
      }
    });

    // 2. Subscribe to Realtime DB updates
    window.WebCareSupabase.subscribe(
      // On Insert (New Ticket)
      (newTicket) => {
        if (!knownTicketIds.has(newTicket.id)) {
          tickets.unshift(newTicket);
          knownTicketIds.add(newTicket.id);
          try {
            localStorage.setItem('webcare_tickets', JSON.stringify(tickets));
          } catch (e) {}
          renderDashboard();
          playNewIssueVoiceNotification();
          showToast(`Issue baru masuk: ${newTicket.id} (${newTicket.reporter})`);
        }
      },
      // On Update (Status changed)
      (updatedRow) => {
        const found = tickets.find(t => t.id === updatedRow.id);
        if (found) {
          found.status = updatedRow.status;
          found.completedAt = updatedRow.completed_at;
          try {
            localStorage.setItem('webcare_tickets', JSON.stringify(tickets));
          } catch (e) {}
          renderDashboard();
          if (activeTicketForModal && activeTicketForModal.id === updatedRow.id) {
            updateModalView(found);
          }
        }
      },
      // On Delete
      (deletedRow) => {
        tickets = tickets.filter(t => t.id !== deletedRow.id);
        knownTicketIds.delete(deletedRow.id);
        try {
          localStorage.setItem('webcare_tickets', JSON.stringify(tickets));
        } catch (e) {}
        renderDashboard();
      }
    );
  }
}

function updateSupabaseStatusIndicator() {
  const statusText = document.getElementById('supabaseStatusText');
  const banner = document.getElementById('supabaseConnectionBanner');
  const bannerText = document.getElementById('supabaseBannerText');
  const dot = document.getElementById('supabaseStatusIndicatorDot');

  const isConfigured = window.WebCareSupabase && window.WebCareSupabase.isConfigured();

  if (isConfigured) {
    if (statusText) statusText.innerHTML = 'Supabase: <span style="color:#10b981; font-weight:700;">Connected</span>';
    if (banner) {
      banner.style.background = '#ecfdf5';
      banner.style.color = '#047857';
      banner.style.border = '1px solid #a7f3d0';
    }
    if (bannerText) bannerText.textContent = 'Status: Terhubung dengan Database Supabase (Realtime Sync Active)';
    if (dot) dot.style.background = '#10b981';
  } else {
    if (statusText) statusText.innerHTML = 'Supabase Sync';
    if (banner) {
      banner.style.background = '#f8fafc';
      banner.style.color = '#64748b';
      banner.style.border = '1px solid #e2e8f0';
    }
    if (bannerText) bannerText.textContent = 'Status: Menggunakan LocalStorage (Belum terhubung ke Supabase)';
    if (dot) dot.style.background = '#94a3b8';
  }
}

function initSupabaseSettingsModal() {
  const modal = document.getElementById('supabaseSettingsModal');
  const openBtn = document.getElementById('supabaseSettingsBtn');
  const closeBtn = document.getElementById('closeSupabaseModalBtn');
  const urlInput = document.getElementById('supabaseUrlInput');
  const keyInput = document.getElementById('supabaseKeyInput');
  const saveBtn = document.getElementById('saveSupabaseBtn');
  const testBtn = document.getElementById('testSupabaseBtn');
  const disconnectBtn = document.getElementById('disconnectSupabaseBtn');
  const migrateBtn = document.getElementById('migrateLocalToSupabaseBtn');

  if (!modal) return;

  const closeModal = () => modal.classList.remove('active');
  const openModal = () => {
    if (window.WebCareSupabase) {
      const { url, anonKey } = window.WebCareSupabase.getCredentials();
      if (urlInput) urlInput.value = url || '';
      if (keyInput) keyInput.value = anonKey || '';
    }
    updateSupabaseStatusIndicator();
    modal.classList.add('active');
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Save Credentials & Reconnect
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const url = urlInput ? urlInput.value.trim() : '';
      const key = keyInput ? keyInput.value.trim() : '';

      if (!url || !key) {
        alert('Mohon masukkan Project URL dan Anon Key Supabase Anda.');
        return;
      }

      window.WebCareSupabase.setCredentials(url, key);
      updateSupabaseStatusIndicator();
      initSupabaseIntegration();
      showToast('Konfigurasi Supabase berhasil disimpan!');
      closeModal();
    });
  }

  // Test Connection
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const url = urlInput ? urlInput.value.trim() : '';
      const key = keyInput ? keyInput.value.trim() : '';

      if (!url || !key) {
        alert('Masukkan URL dan Key terlebih dahulu untuk melakukan test koneksi.');
        return;
      }

      testBtn.textContent = 'Testing...';
      testBtn.disabled = true;

      try {
        window.WebCareSupabase.setCredentials(url, key);
        const data = await window.WebCareSupabase.fetchTickets();
        if (data !== null) {
          alert('Koneksi Berhasil! Database Supabase terhubung dengan sukses.');
          updateSupabaseStatusIndicator();
        } else {
          alert('Koneksi Gagal: Pastikan table "tickets" sudah dibuat dengan menjalankan "supabase_schema.sql" di SQL Editor Supabase Anda.');
        }
      } catch (err) {
        alert('Gagal menghubungkan ke Supabase: ' + err.message);
      } finally {
        testBtn.textContent = 'Test Connection';
        testBtn.disabled = false;
      }
    });
  }

  // Disconnect & Reset to LocalStorage
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin memutuskan koneksi Supabase dan kembali menggunakan LocalStorage?')) {
        window.WebCareSupabase.clearCredentials();
        if (urlInput) urlInput.value = '';
        if (keyInput) keyInput.value = '';
        updateSupabaseStatusIndicator();
        showToast('Koneksi Supabase dinonaktifkan. Mode LocalStorage aktif.');
      }
    });
  }

  // Upload Local Tickets to Supabase
  if (migrateBtn) {
    migrateBtn.addEventListener('click', async () => {
      if (!window.WebCareSupabase.isConfigured()) {
        alert('Harap hubungkan ke Supabase terlebih dahulu.');
        return;
      }
      if (tickets.length === 0) {
        alert('Tidak ada tiket lokal untuk di-upload.');
        return;
      }

      migrateBtn.textContent = 'Uploading...';
      migrateBtn.disabled = true;

      let count = 0;
      for (const t of tickets) {
        const ok = await window.WebCareSupabase.insertTicket(t);
        if (ok) count++;
      }

      alert(`Berhasil mengunggah ${count} dari ${tickets.length} tiket ke Supabase.`);
      migrateBtn.textContent = 'Upload Local Tickets to Supabase';
      migrateBtn.disabled = false;
      loadTicketsFromStorage();
    });
  }
}
