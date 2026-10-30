/**
 * CivicLoop - Field Worker Command & Administrative Operations Module
 * Modular, Clean Architecture & Event-Driven UX
 */

let allReports = [];
let currentHotspots = [];
let activeEditingReportId = null;
let currentViewMode = 'cards'; // 'cards' | 'table' | 'map'
let activeQuickFilter = 'all'; // 'all' | 'high' | 'multiReported' | 'pending' | 'resolved'
let uploadedResolvedPhotoDataUrl = null;

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';

  toast.className = `pointer-events-auto flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold text-white border transition-all transform duration-300 translate-y-2 opacity-0 ${
    isSuccess ? 'bg-emerald-700/95 border-emerald-500 shadow-emerald-950/50' :
    isError ? 'bg-rose-700/95 border-rose-500 shadow-rose-950/50' :
    'bg-slate-900/95 border-slate-700 shadow-black/50'
  } backdrop-blur-md`;

  toast.innerHTML = `
    <span class="text-base">${isSuccess ? '✅' : isError ? '❌' : 'ℹ️'}</span>
    <span class="leading-snug">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, 3500);
}

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  fetchAllData();

  // Keyboard shortcut: Escape closes all open modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePhotoModal();
      closeWorkflowModal();
      closeReasoningModal();
      closeCorroborationModal();
    }
  });
});

/**
 * Multi-Report Citizen Aggregator:
 * Computes how many corroborating citizen complaints exist for an issue.
 */
function getPeopleReportedCount(report) {
  if (!report || !allReports) return 1;
  const parentId = (report.aiMetadata && report.aiMetadata.duplicateOf) ? report.aiMetadata.duplicateOf : report.id;
  
  const cluster = allReports.filter(r => {
    if (r.id === parentId) return true;
    if (r.aiMetadata && r.aiMetadata.duplicateOf === parentId) return true;
    return false;
  });

  return Math.max(1, cluster.length);
}

/**
 * View Switcher: Toggles between Cards and Table
 */
function setViewMode(mode) {
  currentViewMode = mode;
  const cardsCont = document.getElementById('cardsViewContainer');
  const tableCont = document.getElementById('tableViewContainer');
  const btnCards = document.getElementById('viewBtnCards');
  const btnTable = document.getElementById('viewBtnTable');

  if (mode === 'cards') {
    cardsCont.classList.remove('hidden');
    tableCont.classList.add('hidden');
    btnCards.className = 'px-3 py-1.5 rounded-lg transition bg-emerald-600 text-white shadow';
    btnTable.className = 'px-3 py-1.5 rounded-lg transition text-slate-400 hover:text-white';
  } else {
    cardsCont.classList.add('hidden');
    tableCont.classList.remove('hidden');
    btnTable.className = 'px-3 py-1.5 rounded-lg transition bg-emerald-600 text-white shadow';
    btnCards.className = 'px-3 py-1.5 rounded-lg transition text-slate-400 hover:text-white';
  }
}

/**
 * Quick Filter Pills handler
 */
function setFilterQuick(filterKey) {
  activeQuickFilter = filterKey;
  const pills = ['all', 'high', 'multiReported', 'pending', 'resolved'];
  const pillMap = {
    all: 'pillAll',
    high: 'pillHigh',
    multiReported: 'pillMulti',
    pending: 'pillPending',
    resolved: 'pillResolved'
  };

  pills.forEach(p => {
    const el = document.getElementById(pillMap[p]);
    if (!el) return;
    if (p === filterKey) {
      el.className = 'px-3.5 py-1.5 rounded-xl font-bold bg-emerald-600 text-white shadow transition whitespace-nowrap';
    } else {
      el.className = 'px-3.5 py-1.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition whitespace-nowrap';
    }
  });

  applyFilters();
}

/**
 * Fetch All Live Complaints, KPIs, and Hotspots
 */
async function fetchAllData(showSuccessToast = false) {
  const syncBtn = document.getElementById('syncBtn');
  const syncIcon = document.getElementById('syncIcon');
  const syncText = document.getElementById('syncText');
  const lastSyncBadge = document.getElementById('lastSyncBadge');

  if (syncIcon) syncIcon.classList.add('animate-spin');
  if (syncText) syncText.textContent = 'Syncing...';
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.classList.add('opacity-75');
  }

  try {
    const timestamp = Date.now();
    const fetchOptions = {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'X-Requested-From': 'admin-portal'
      }
    };

    const [reportsRes, statsRes, hotspotsRes] = await Promise.all([
      fetch(`/api/reports?_t=${timestamp}`, fetchOptions),
      fetch(`/api/insights/stats?_t=${timestamp}`, fetchOptions),
      fetch(`/api/insights/hotspots?_t=${timestamp}`, fetchOptions)
    ]);

    const reportsData = await reportsRes.json();
    const statsData = await statsRes.json();
    const hotspotsData = await hotspotsRes.json();

    if (reportsData.success) {
      allReports = reportsData.reports;
      renderRecentlyUpdated(allReports);
      applyFilters();
      updatePillCounters();
    }

    if (statsData.success && statsData.metrics) {
      renderStats(statsData.metrics);
    }

    if (hotspotsData.success && hotspotsData.hotspots) {
      currentHotspots = hotspotsData.hotspots;
      renderHotspots(currentHotspots);
    }

    // Update last sync timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (lastSyncBadge) {
      lastSyncBadge.textContent = `Synced: ${timeStr}`;
      lastSyncBadge.classList.add('text-emerald-400');
      setTimeout(() => lastSyncBadge.classList.remove('text-emerald-400'), 1500);
    }

    if (syncText) syncText.textContent = 'Synced!';
    if (syncIcon) syncIcon.textContent = '✅';

    if (showSuccessToast) {
      showToast(`✓ Queue Synced! ${allReports.length} live complaints loaded`);
    }
  } catch (err) {
    console.error('Data load error:', err);
    showToast('Error syncing data: ' + err.message, 'error');
    if (syncText) syncText.textContent = 'Sync Failed';
    if (syncIcon) syncIcon.textContent = '⚠️';
  } finally {
    setTimeout(() => {
      if (syncIcon) {
        syncIcon.classList.remove('animate-spin');
        syncIcon.textContent = '🔄';
      }
      if (syncText) syncText.textContent = 'Sync';
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.classList.remove('opacity-75');
      }
    }, 800);
  }
}

/**
 * Manual sync triggered by worker clicking the Sync button
 */
function manualSync() {
  fetchAllData(true);
}

// Auto-sync polling every 15 seconds to keep queue live
setInterval(() => {
  fetchAllData(false);
}, 15000);

function renderStats(m) {
  document.getElementById('metricTotal').textContent = m.total;
  document.getElementById('metricPending').textContent = m.submitted + m.inProgress;
  document.getElementById('metricHighHazards').textContent = m.highPriority;
  document.getElementById('metricDuplicates').textContent = m.duplicates;
  document.getElementById('metricDupRate').textContent = `${m.duplicatePercentage}% crowd`;
  document.getElementById('metricResolutionRate').textContent = `${m.resolutionRate}%`;
  document.getElementById('metricResolvedCount').textContent = `${m.resolved} Done`;
}

function updatePillCounters() {
  document.getElementById('countPillAll').textContent = allReports.length;
  document.getElementById('countPillHigh').textContent = allReports.filter(r => r.aiMetadata?.priority === 'High').length;
  document.getElementById('countPillMulti').textContent = allReports.filter(r => getPeopleReportedCount(r) >= 2).length;
  document.getElementById('countPillPending').textContent = allReports.filter(r => r.status !== 'Resolved').length;
  document.getElementById('countPillResolved').textContent = allReports.filter(r => r.status === 'Resolved').length;
  document.getElementById('queueBadgeTotal').textContent = allReports.length;
}

/**
 * UPPER SECTION: Renders recently updated / submitted complaints
 */
function renderRecentlyUpdated(reports) {
  const container = document.getElementById('recentlyUpdatedContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!reports || reports.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center text-xs text-slate-400 py-3">No complaints recorded yet.</div>`;
    return;
  }

  // Sort descending by updated timestamp
  const sorted = [...reports].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.submittedAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.submittedAt || 0).getTime();
    return timeB - timeA;
  });

  const top4 = sorted.slice(0, 4);

  top4.forEach(report => {
    const peopleCount = getPeopleReportedCount(report);
    const card = document.createElement('div');
    card.className = 'group relative bg-slate-950 p-3 rounded-2xl border border-slate-800 hover:border-emerald-500/60 transition shadow-md flex flex-col justify-between space-y-2';

    const imgUrl = report.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80';
    const updatedTimeStr = formatRelativeTime(report.updatedAt || report.submittedAt);
    const hasProof = Boolean(report.resolvedImageUrl);

    card.innerHTML = `
      <div class="space-y-2">
        <div class="relative w-full h-28 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer"
             onclick="openPhotoModal('${report.id}')">
          <img src="${imgUrl}" alt="${escapeHtml(report.title)}" class="w-full h-full object-cover img-zoom-hover"
               onerror="this.src='https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80'">
          
          <!-- UP-LEFT BOX -->
          ${peopleCount >= 2 ? `
            <div class="absolute top-2 left-2 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow border border-purple-300/40 flex items-center space-x-1">
              <span>🔥 ${peopleCount} People Reported</span>
            </div>
          ` : `
            <div class="absolute top-2 left-2 z-10 bg-slate-950/80 backdrop-blur-md text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700">
              <span>👤 1 Report</span>
            </div>
          `}

          <!-- Status badge -->
          <div class="absolute bottom-2 right-2 z-10 flex gap-1">
            ${hasProof ? `<span class="px-1.5 py-0.5 text-[9px] font-black bg-emerald-500 text-slate-950 rounded shadow">📸 Proof</span>` : ''}
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-md shadow ${
              report.status === 'Resolved' ? 'bg-emerald-600 text-white' :
              report.status === 'In Progress' ? 'bg-blue-600 text-white' :
              'bg-amber-600 text-white'
            }">
              ● ${report.status}
            </span>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span class="font-mono font-bold text-slate-300">${report.id}</span>
            <span class="text-emerald-400 font-semibold">${updatedTimeStr}</span>
          </div>
          <h4 class="text-xs font-bold text-white line-clamp-1 group-hover:text-emerald-300 transition">${escapeHtml(report.title)}</h4>
          <p class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
            <span>📍</span> <span>${escapeHtml(report.location?.street)}, ${escapeHtml(report.location?.area)}</span>
          </p>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
        <button onclick="openWorkflowModal('${report.id}')" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold py-1.5 rounded-lg transition text-center cursor-pointer">
          Update Status
        </button>
        <button onclick="openPhotoModal('${report.id}')" title="Inspect Photo" class="bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white px-2 py-1.5 rounded-lg text-xs transition cursor-pointer">
          🔍
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderHotspots(hotspots) {
  const container = document.getElementById('hotspotContainer');
  if (!container) return;
  document.getElementById('clusterCountDisplay').textContent = `${hotspots.length} Zones Tracked`;
  container.innerHTML = '';

  hotspots.slice(0, 3).forEach(cluster => {
    const isCritical = cluster.severityLevel.includes('Critical');
    const card = document.createElement('div');
    card.className = `p-4 rounded-3xl border transition ${
      isCritical
        ? 'bg-rose-950/20 border-rose-900/60 hover:border-rose-500'
        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
    } space-y-3 shadow-md`;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold ${isCritical ? 'text-rose-300 bg-rose-950/90 border border-rose-800' : 'text-amber-300 bg-amber-950/70 border border-amber-800'} px-2.5 py-0.5 rounded-full">
          ● ${cluster.severityLevel}
        </span>
        <span class="text-[11px] text-slate-400 font-mono">${cluster.centroid.lat}, ${cluster.centroid.lng}</span>
      </div>

      <div>
        <h3 class="text-base font-extrabold text-white">${escapeHtml(cluster.street)}</h3>
        <span class="text-xs text-slate-400">${escapeHtml(cluster.area)}</span>
      </div>

      <div class="grid grid-cols-3 gap-2 text-[11px] bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
        <div>
          <span class="text-slate-500 block">Reports:</span>
          <span class="font-bold text-white text-xs">${cluster.totalReports}</span>
        </div>
        <div>
          <span class="text-slate-500 block">Unresolved:</span>
          <span class="font-bold text-amber-400 text-xs">${cluster.activeIssues}</span>
        </div>
        <div>
          <span class="text-slate-500 block">Avg Urgency:</span>
          <span class="font-bold ${cluster.averageUrgency >= 75 ? 'text-rose-400' : 'text-amber-400'} text-xs">${cluster.averageUrgency}/100</span>
        </div>
      </div>

      <p class="text-[11px] text-slate-300 leading-snug line-clamp-2">
        ${escapeHtml(cluster.description)}
      </p>

      <button onclick="filterByStreet('${escapeHtml(cluster.street)}')" class="w-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl border border-slate-700 font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer">
        <span>Filter Queue to ${escapeHtml(cluster.street)}</span>
        <span>&rarr;</span>
      </button>
    `;
    container.appendChild(card);
  });
}

/**
 * Filter & Sort logic
 */
function getCurrentlyFilteredReports() {
  const search = (document.getElementById('adminSearch')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('filterCategory')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const dept = document.getElementById('filterDept')?.value || '';
  const street = document.getElementById('filterStreet')?.value || '';
  const sort = document.getElementById('sortOrder')?.value || 'recent';

  let filtered = allReports.filter(r => {
    if (activeQuickFilter === 'high' && r.aiMetadata?.priority !== 'High') return false;
    if (activeQuickFilter === 'multiReported' && getPeopleReportedCount(r) < 2) return false;
    if (activeQuickFilter === 'pending' && r.status === 'Resolved') return false;
    if (activeQuickFilter === 'resolved' && r.status !== 'Resolved') return false;

    if (cat && r.category !== cat) return false;
    if (status && r.status !== status) return false;
    if (dept && r.assignedDepartment !== dept) return false;
    if (street && !r.location?.street?.toLowerCase().includes(street.toLowerCase())) return false;

    if (search) {
      const match = (r.id && r.id.toLowerCase().includes(search)) ||
                    (r.title && r.title.toLowerCase().includes(search)) ||
                    (r.description && r.description.toLowerCase().includes(search)) ||
                    (r.location?.street && r.location.street.toLowerCase().includes(search)) ||
                    (r.location?.landmark && r.location.landmark.toLowerCase().includes(search)) ||
                    (r.assignedDepartment && r.assignedDepartment.toLowerCase().includes(search));
      if (!match) return false;
    }

    return true;
  });

  if (sort === 'recent') {
    filtered.sort((a, b) => new Date(b.updatedAt || b.submittedAt || 0) - new Date(a.updatedAt || a.submittedAt || 0));
  } else if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  } else if (sort === 'mostReported') {
    filtered.sort((a, b) => getPeopleReportedCount(b) - getPeopleReportedCount(a));
  } else if (sort === 'urgency') {
    filtered.sort((a, b) => (b.aiMetadata?.urgencyScore || 0) - (a.aiMetadata?.urgencyScore || 0));
  } else if (sort === 'street') {
    filtered.sort((a, b) => (a.location?.street || '').localeCompare(b.location?.street || ''));
  }

  return filtered;
}

function applyFilters() {
  const filtered = getCurrentlyFilteredReports();

  renderCards(filtered);
  renderTable(filtered);

  const countDisplay = document.getElementById('tableCountDisplay');
  if (countDisplay) {
    countDisplay.textContent = `Showing ${filtered.length} of ${allReports.length} reports`;
  }
}

/**
 * Render Cards View
 */
function renderCards(reports) {
  const container = document.getElementById('cardsViewContainer');
  if (!container) return;
  container.innerHTML = '';

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
        <span class="text-3xl block mb-2">🔍</span>
        <span class="text-sm font-semibold text-slate-300">No complaints match your active filter criteria.</span>
        <p class="text-xs text-slate-500 mt-1">Try clearing the search or category filters.</p>
      </div>
    `;
    return;
  }

  reports.forEach(report => {
    const peopleCount = getPeopleReportedCount(report);
    const priority = report.aiMetadata?.priority || 'Medium';
    const urgencyScore = report.aiMetadata?.urgencyScore || 50;
    const imgUrl = report.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80';
    const isDuplicate = report.aiMetadata?.isDuplicate;
    const updatedTime = formatRelativeTime(report.updatedAt || report.submittedAt);
    const hasProof = Boolean(report.resolvedImageUrl);

    const card = document.createElement('div');
    card.className = `relative rounded-3xl bg-slate-900 border ${
      report.status === 'Resolved' ? 'border-slate-800' :
      priority === 'High' ? 'border-rose-900/60 shadow-lg shadow-rose-950/20' : 'border-slate-800'
    } overflow-hidden flex flex-col justify-between hover:border-slate-600 transition shadow-xl`;

    card.innerHTML = `
      <div>
        <div class="relative w-full h-48 bg-slate-950 overflow-hidden cursor-pointer" onclick="openPhotoModal('${report.id}')">
          <img src="${imgUrl}" alt="${escapeHtml(report.title)}" class="w-full h-full object-cover img-zoom-hover"
               onerror="this.src='https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80'">

          <!-- UP-LEFT BOX -->
          ${peopleCount >= 2 ? `
            <div onclick="event.stopPropagation(); showCorroboratingModal('${report.id}')"
                 class="absolute top-3 left-3 z-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xl border border-purple-300/40 flex items-center space-x-1.5 ring-2 ring-purple-500/50 cursor-pointer animate-pulse"
                 title="Click to view all ${peopleCount} citizen reports for this issue">
              <span>🔥 Reported by ${peopleCount} Citizens!</span>
              <span class="text-[10px] bg-white/20 px-1 rounded">View &rarr;</span>
            </div>
          ` : `
            <div class="absolute top-3 left-3 z-10 bg-slate-950/85 backdrop-blur-md text-slate-300 font-bold text-[11px] px-2.5 py-1 rounded-xl border border-slate-700/80 shadow flex items-center space-x-1">
              <span>👤 1 Citizen Report</span>
            </div>
          `}

          <!-- Top-Right: Urgency Badge -->
          <div class="absolute top-3 right-3 z-10">
            <button onclick="event.stopPropagation(); showReasoningModal('${report.id}')"
                    class="px-2.5 py-1 rounded-xl font-bold text-xs shadow-md border flex items-center space-x-1 ${
                      priority === 'High' ? 'bg-rose-600 text-white border-rose-400' :
                      priority === 'Medium' ? 'bg-amber-600 text-white border-amber-400' :
                      'bg-slate-800 text-slate-200 border-slate-600'
                    }">
              <span>🚨 ${priority} (${urgencyScore})</span>
              <span class="text-[10px]">ℹ️</span>
            </button>
          </div>

          <!-- Bottom hint overlay -->
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-3 pt-6 flex items-end justify-between">
            <span class="text-[10px] font-bold text-white/90 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
              ${hasProof ? '🔍 Click to view Before & After Fix' : '🔍 Click photo to inspect'}
            </span>
            <span class="text-[10px] text-slate-300 font-mono">
              ${report.id}
            </span>
          </div>
        </div>

        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryBadgeStyle(report.category)}">
              ${escapeHtml(report.category)}
            </span>
            <span class="text-[11px] text-slate-400">
              Updated: <b class="text-slate-300">${updatedTime}</b>
            </span>
          </div>

          <div>
            <h3 class="text-sm sm:text-base font-bold text-white leading-snug">${escapeHtml(report.title)}</h3>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
              ${escapeHtml(report.aiMetadata?.summary || report.description)}
            </p>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
            <div class="flex items-center text-slate-300 font-medium">
              <span class="mr-1.5">📍</span>
              <span class="font-bold text-white">${escapeHtml(report.location?.street)}</span>,
              <span class="text-slate-400 ml-1">${escapeHtml(report.location?.landmark || report.location?.area)}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900 text-slate-400">
              <span>Squad: <b class="text-slate-300">${escapeHtml(report.assignedDepartment || 'Unassigned')}</b></span>
              ${isDuplicate ? `<span class="text-purple-400 font-bold">Corroborates #${report.aiMetadata.duplicateOf}</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- 1-Click Action Bar -->
      <div class="p-4 pt-0 space-y-2">
        <div class="grid grid-cols-2 gap-2 text-xs">
          ${report.status === 'Submitted' ? `
            <button onclick="quickUpdateStatus('${report.id}', 'In Progress')"
              class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition shadow cursor-pointer flex items-center justify-center space-x-1">
              <span>🚀 Dispatch Squad</span>
            </button>
          ` : report.status === 'In Progress' ? `
            <button onclick="openWorkflowModal('${report.id}')"
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition shadow cursor-pointer flex items-center justify-center space-x-1">
              <span>✅ Mark Resolved</span>
            </button>
          ` : `
            <button onclick="quickUpdateStatus('${report.id}', 'In Progress')"
              class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl transition cursor-pointer flex items-center justify-center space-x-1">
              <span>🔄 Reopen Work</span>
            </button>
          `}

          <button onclick="openWorkflowModal('${report.id}')"
            class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl transition cursor-pointer border border-slate-700 flex items-center justify-center space-x-1">
            <span>⚙️ Details / Notes</span>
          </button>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Status:</span>
          <span class="font-bold ${
            report.status === 'Resolved' ? 'text-emerald-400' :
            report.status === 'In Progress' ? 'text-blue-400' : 'text-amber-400'
          }">
            ● ${report.status}
          </span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Render Table View
 */
function renderTable(reports) {
  const tbody = document.getElementById('reportsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs font-semibold">No complaints match your active filter criteria.</td></tr>`;
    return;
  }

  reports.forEach(report => {
    const peopleCount = getPeopleReportedCount(report);
    const priority = report.aiMetadata?.priority || 'Medium';
    const urgencyScore = report.aiMetadata?.urgencyScore || 50;
    const imgUrl = report.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/80 transition';

    tr.innerHTML = `
      <td class="py-2.5 px-3 whitespace-nowrap">
        <div class="relative w-14 h-11 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group"
             onclick="openPhotoModal('${report.id}')">
          <img src="${imgUrl}" alt="Thumbnail" class="w-full h-full object-cover img-zoom-hover"
               onerror="this.src='https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80'">
          <div class="absolute inset-0 bg-black/30 group-hover:bg-transparent flex items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition">
            🔍
          </div>
        </div>
      </td>

      <td class="py-2.5 px-3 max-w-xs">
        <div class="flex items-center space-x-1.5 mb-0.5">
          <span class="font-mono font-bold text-white text-xs">${report.id}</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${getCategoryBadgeStyle(report.category)}">
            ${escapeHtml(report.category)}
          </span>
        </div>
        <p class="text-xs text-slate-200 font-medium line-clamp-1">${escapeHtml(report.title)}</p>
      </td>

      <td class="py-2.5 px-3 whitespace-nowrap">
        ${peopleCount >= 2 ? `
          <button onclick="showCorroboratingModal('${report.id}')"
            class="bg-gradient-to-r from-purple-900/80 to-pink-900/80 border border-purple-500/50 text-purple-200 text-[11px] font-extrabold px-2.5 py-1 rounded-lg flex items-center space-x-1 hover:border-purple-400 transition">
            <span>🔥 ${peopleCount} People Reported</span>
          </button>
        ` : `
          <span class="text-slate-400 text-[11px]">👤 1 Citizen</span>
        `}
      </td>

      <td class="py-2.5 px-3 whitespace-nowrap">
        <span class="font-bold text-slate-200 block text-xs">${escapeHtml(report.location?.street)}</span>
        <span class="text-[11px] text-slate-400 block">${escapeHtml(report.location?.landmark || report.location?.area)}</span>
      </td>

      <td class="py-2.5 px-3 whitespace-nowrap">
        <button onclick="showReasoningModal('${report.id}')" class="px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 ${
          priority === 'High' ? 'bg-rose-950 text-rose-300 border border-rose-700' :
          priority === 'Medium' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
          'bg-slate-800 text-slate-300 border border-slate-700'
        }">
          <span>${priority} (${urgencyScore})</span>
          <span>ℹ️</span>
        </button>
      </td>

      <td class="py-2.5 px-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
          report.status === 'Resolved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
          report.status === 'In Progress' ? 'bg-blue-950 text-blue-300 border border-blue-700' :
          'bg-amber-950 text-amber-300 border border-amber-700'
        }">
          ● ${report.status}
        </span>
        <span class="text-[10px] text-slate-400 block mt-0.5">${escapeHtml(report.assignedDepartment || 'Unassigned')}</span>
      </td>

      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <div class="flex items-center justify-end space-x-1.5">
          ${report.status === 'Submitted' ? `
            <button onclick="quickUpdateStatus('${report.id}', 'In Progress')" class="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer">
              🚀 Start
            </button>
          ` : report.status === 'In Progress' ? `
            <button onclick="openWorkflowModal('${report.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer">
              ✅ Resolve
            </button>
          ` : ''}
          <button onclick="openWorkflowModal('${report.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] px-2.5 py-1 rounded-lg transition border border-slate-700 cursor-pointer">
            ⚙️
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * 1-Click Status Update API Call
 */
async function quickUpdateStatus(reportId, newStatus) {
  try {
    const res = await fetch(`/api/reports/${reportId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Key': 'civicloop-field-worker-2026',
        'X-Requested-From': 'admin-portal'
      },
      body: JSON.stringify({
        status: newStatus,
        resolutionNotes: newStatus === 'Resolved' ? 'Field crew marked work completed on site.' : 'Crew dispatched to incident site.'
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Report #${reportId} updated to ${newStatus}!`);
      fetchAllData();
    } else {
      showToast(data.message || 'Update failed', 'error');
    }
  } catch (err) {
    showToast('Error updating status: ' + err.message, 'error');
  }
}

function getCategoryBadgeStyle(cat) {
  switch (cat) {
    case 'damaged roads': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    case 'waterlogging': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'broken streetlights': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    case 'waste bins': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    default: return 'bg-slate-800 text-slate-300';
  }
}

function filterByStreet(streetName) {
  const streetInput = document.getElementById('filterStreet');
  if (streetInput) streetInput.value = streetName;
  applyFilters();
  window.scrollTo({ top: 580, behavior: 'smooth' });
  showToast(`Filtered queue to ${streetName}`);
}

function clearFilters() {
  document.getElementById('adminSearch').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterDept').value = '';
  document.getElementById('filterStreet').value = '';
  document.getElementById('sortOrder').value = 'recent';
  activeQuickFilter = 'all';
  setFilterQuick('all');
  showToast('Filters cleared');
}

// ==========================================
// MODAL 1: PHOTO INSPECTION (BEFORE & AFTER)
// ==========================================
function openPhotoModal(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  document.getElementById('lightboxTicketId').textContent = report.id;
  document.getElementById('lightboxTitle').textContent = report.title;
  document.getElementById('lightboxLocation').textContent = `📍 ${report.location?.street}, ${report.location?.area} (${report.location?.landmark || ''})`;
  document.getElementById('lightboxImg').src = report.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80';
  document.getElementById('lightboxDate').textContent = `Reported: ${new Date(report.submittedAt).toLocaleString()}`;

  // Check if Resolved photo proof exists
  const afterContainer = document.getElementById('lightboxAfterContainer');
  const singleContainer = document.getElementById('lightboxSingleContainer');
  const splitContainer = document.getElementById('lightboxSplitContainer');

  if (report.resolvedImageUrl) {
    if (singleContainer) singleContainer.classList.add('hidden');
    if (splitContainer) splitContainer.classList.remove('hidden');
    document.getElementById('lightboxBeforeSplitImg').src = report.imageUrl;
    document.getElementById('lightboxAfterSplitImg').src = report.resolvedImageUrl;
  } else {
    if (splitContainer) splitContainer.classList.add('hidden');
    if (singleContainer) singleContainer.classList.remove('hidden');
  }

  const modal = document.getElementById('photoLightboxModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePhotoModal() {
  const modal = document.getElementById('photoLightboxModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==========================================
// MODAL 2: WORKFLOW & AFTER-FIX PHOTO UPLOAD
// ==========================================
function openWorkflowModal(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  activeEditingReportId = reportId;
  uploadedResolvedPhotoDataUrl = null;

  document.getElementById('modalTicketId').textContent = report.id;
  document.getElementById('modalTicketCategory').textContent = report.category;
  document.getElementById('modalTicketTitle').textContent = report.title;
  document.getElementById('modalTicketSummary').textContent = report.aiMetadata?.summary || report.description;
  document.getElementById('modalTicketImg').src = report.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80';
  document.getElementById('workflowStatus').value = report.status;
  document.getElementById('workflowDepartment').value = report.assignedDepartment || 'Roads & Infrastructure';
  document.getElementById('workflowNotes').value = report.resolutionNotes || '';

  // Reset proof photo preview
  const previewCont = document.getElementById('resolvedPhotoPreviewContainer');
  const previewName = document.getElementById('resolvedPhotoPreviewName');
  if (previewCont) previewCont.classList.add('hidden');
  if (previewName) previewName.textContent = report.resolvedImageUrl ? 'Existing proof on file' : 'No photo attached';

  const modal = document.getElementById('workflowModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeWorkflowModal() {
  const modal = document.getElementById('workflowModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  activeEditingReportId = null;
  uploadedResolvedPhotoDataUrl = null;
}

function handleResolvedPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('File size must be under 5 MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    uploadedResolvedPhotoDataUrl = event.target.result;
    const previewCont = document.getElementById('resolvedPhotoPreviewContainer');
    const previewImg = document.getElementById('resolvedPhotoPreviewImg');
    const previewName = document.getElementById('resolvedPhotoPreviewName');

    if (previewImg) previewImg.src = uploadedResolvedPhotoDataUrl;
    if (previewCont) previewCont.classList.remove('hidden');
    if (previewName) previewName.textContent = file.name;
    showToast('Fixed work photo attached');
  };
  reader.readAsDataURL(file);
}

function removeResolvedPhoto() {
  uploadedResolvedPhotoDataUrl = null;
  const previewCont = document.getElementById('resolvedPhotoPreviewContainer');
  const previewName = document.getElementById('resolvedPhotoPreviewName');
  const fileInput = document.getElementById('resolvedPhotoInput');

  if (fileInput) fileInput.value = '';
  if (previewCont) previewCont.classList.add('hidden');
  if (previewName) previewName.textContent = 'No photo attached';
}

async function submitWorkflow(e) {
  e.preventDefault();
  if (!activeEditingReportId) return;

  const saveBtn = document.getElementById('saveWorkflowBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Updating...';

  const status = document.getElementById('workflowStatus').value;
  const assignedDepartment = document.getElementById('workflowDepartment').value;
  const resolutionNotes = document.getElementById('workflowNotes').value;

  const payload = {
    status,
    assignedDepartment,
    resolutionNotes
  };

  if (uploadedResolvedPhotoDataUrl) {
    payload.resolvedImageUrl = uploadedResolvedPhotoDataUrl;
  }

  try {
    const res = await fetch(`/api/reports/${activeEditingReportId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Key': 'civicloop-field-worker-2026',
        'X-Requested-From': 'admin-portal'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Status & Sync';

    if (data.success) {
      closeWorkflowModal();
      fetchAllData();
      showToast(`Report #${data.report.id} updated to ${status}!`);
    } else {
      showToast(data.message || 'Update failed', 'error');
    }
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Status & Sync';
    showToast('Server error: ' + err.message, 'error');
  }
}

// ==========================================
// MODAL 3: AI REASONING TOOLTIP
// ==========================================
function showReasoningModal(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  document.getElementById('reasoningScore').textContent = `${report.aiMetadata?.urgencyScore || 50}/100 (${report.aiMetadata?.priority} Priority)`;
  document.getElementById('reasoningText').textContent = report.aiMetadata?.priorityReasoning || 'Assessed through neural keyword taxonomy.';

  const modal = document.getElementById('reasoningModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeReasoningModal() {
  const modal = document.getElementById('reasoningModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==========================================
// MODAL 4: CORROBORATING COMPLAINTS DRILLDOWN
// ==========================================
function showCorroboratingModal(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  const parentId = (report.aiMetadata && report.aiMetadata.duplicateOf) ? report.aiMetadata.duplicateOf : report.id;
  const cluster = allReports.filter(r => r.id === parentId || (r.aiMetadata && r.aiMetadata.duplicateOf === parentId));

  document.getElementById('corrobCountDisplay').textContent = cluster.length;
  const listContainer = document.getElementById('corroborationList');
  listContainer.innerHTML = '';

  cluster.forEach(item => {
    const isParent = item.id === parentId;
    const div = document.createElement('div');
    div.className = 'p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1';
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="font-mono font-bold text-white text-xs">${item.id}</span>
          ${isParent ? `<span class="bg-emerald-950 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800">Primary Incident</span>` : `<span class="bg-purple-950 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-800">Corroboration</span>`}
        </div>
        <span class="text-[10px] text-slate-400">${new Date(item.submittedAt).toLocaleDateString()}</span>
      </div>
      <p class="text-xs text-slate-300 font-medium">${escapeHtml(item.title)}</p>
      <p class="text-[11px] text-slate-400 truncate">${escapeHtml(item.description)}</p>
      <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1">
        <span>By: <b>${escapeHtml(item.userName || 'Citizen')}</b></span>
        <span>📍 ${escapeHtml(item.location?.street)}</span>
      </div>
    `;
    listContainer.appendChild(div);
  });

  const modal = document.getElementById('corroborationModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCorroborationModal() {
  const modal = document.getElementById('corroborationModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==========================================
// STRING & DATE UTILITIES
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return d.toLocaleDateString();
}
