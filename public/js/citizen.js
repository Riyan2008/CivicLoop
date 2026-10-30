/**
 * CivicLoop - Citizen Action Portal & Rewards Module
 * Handles report submission, live AI pre-flight heuristics,
 * Civic Wallet balances, and ticket tracking.
 */

let currentWalletBalance = 150;
let userUploadedPhotoDataUrl = null;

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';

  toast.className = `pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white transition-all transform duration-300 translate-y-2 opacity-0 ${
    isSuccess ? 'bg-emerald-600 shadow-emerald-600/30' : isError ? 'bg-rose-600 shadow-rose-600/30' : 'bg-slate-900'
  }`;

  toast.innerHTML = `
    <span>${isSuccess ? '✓' : isError ? '✕' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
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

// Initialization
window.addEventListener('DOMContentLoaded', () => {
  fetchWallet();
  fetchHotspotStats();
  loadTrackTicket('REP-1001');

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSuccessModal();
      closeRedeemModal();
    }
  });
});

// Fetch Wallet balance from backend
async function fetchWallet() {
  try {
    const res = await fetch('/api/wallet');
    const data = await res.json();
    if (data.success && data.wallet) {
      currentWalletBalance = data.wallet.balance;
      updateWalletUI();
    }
  } catch (e) {
    console.error('Wallet fetch error:', e);
  }
}

function updateWalletUI() {
  const balEl = document.getElementById('walletBalanceDisplay');
  const navBalEl = document.getElementById('navWalletBadge');
  if (balEl) balEl.textContent = currentWalletBalance;
  if (navBalEl) navBalEl.textContent = currentWalletBalance;
  
  const nextGoal = 300;
  const progressPercent = Math.min(100, Math.round((currentWalletBalance / nextGoal) * 100));
  const bar = document.getElementById('tierProgressBar');
  const txt = document.getElementById('tierNextProgress');
  if (bar) bar.style.width = progressPercent + '%';
  if (txt) txt.textContent = `${currentWalletBalance} / ${nextGoal} to Level 3`;
}

// Fetch Hotspot stats
async function fetchHotspotStats() {
  try {
    const [hotspotsRes, statsRes] = await Promise.all([
      fetch('/api/insights/hotspots'),
      fetch('/api/insights/stats')
    ]);
    const hotspotsData = await hotspotsRes.json();
    const statsData = await statsRes.json();

    if (hotspotsData.success) {
      const activeHotspotsCount = document.getElementById('activeHotspotsCount');
      if (activeHotspotsCount) activeHotspotsCount.textContent = `${hotspotsData.totalClusters} Hotspots Active`;
    }

    if (statsData.success && statsData.metrics) {
      const tot = document.getElementById('statTotalIssues');
      const high = document.getElementById('statHighHazards');
      const dup = document.getElementById('statDupRate');
      if (tot) tot.textContent = statsData.metrics.total;
      if (high) high.textContent = statsData.metrics.highPriority;
      if (dup) dup.textContent = `${statsData.metrics.duplicatePercentage}%`;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// Image Upload Handlers
function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('File size must be less than 5 MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    userUploadedPhotoDataUrl = event.target.result;
    document.getElementById('imagePreview').src = userUploadedPhotoDataUrl;
    document.getElementById('uploadLabel').textContent = file.name;
    document.getElementById('uploadSubLabel').textContent = `${(file.size / 1024).toFixed(1)} KB • Click to change photo`;
    document.getElementById('removePhotoBtn').classList.remove('hidden');
    document.getElementById('demoBtns').classList.add('hidden');
    showToast('Photo evidence attached');
  };
  reader.readAsDataURL(file);
}

function removeUploadedPhoto(e) {
  if (e) e.stopPropagation();
  userUploadedPhotoDataUrl = null;
  document.getElementById('photoFileInput').value = '';
  document.getElementById('imagePreview').src = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=300&auto=format&fit=crop&q=80';
  document.getElementById('uploadLabel').textContent = 'Click or drag & drop a photo here';
  document.getElementById('uploadSubLabel').textContent = 'JPG, PNG, WEBP — max 5 MB. Or use a demo preset →';
  document.getElementById('removePhotoBtn').classList.add('hidden');
  document.getElementById('demoBtns').classList.remove('hidden');
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadDropZone').classList.add('border-emerald-500', 'bg-emerald-50/50');
}

function onDragLeave(e) {
  e.preventDefault();
  document.getElementById('uploadDropZone').classList.remove('border-emerald-500', 'bg-emerald-50/50');
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('uploadDropZone').classList.remove('border-emerald-500', 'bg-emerald-50/50');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handlePhotoUpload({ target: { files: e.dataTransfer.files } });
  }
}

const DEMO_PHOTOS = {
  1: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
  2: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80',
  3: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=600&auto=format&fit=crop&q=80',
  4: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80'
};

function applyDemoPhoto(idx, e) {
  if (e) e.stopPropagation();
  userUploadedPhotoDataUrl = DEMO_PHOTOS[idx] || DEMO_PHOTOS[1];
  document.getElementById('imagePreview').src = userUploadedPhotoDataUrl;
  document.getElementById('uploadLabel').textContent = `Demo Preset Photo (${idx}) Selected`;
  document.getElementById('uploadSubLabel').textContent = 'JPG, PNG, WEBP — max 5 MB. Or use a demo preset →';
  document.getElementById('removePhotoBtn').classList.remove('hidden');
  showToast(`Demo photo ${idx} selected`);
}

function applyPreset(type) {
  if (type === 'pothole') {
    document.getElementById('reportTitle').value = 'Severe deep pothole causing vehicle damage near Metro Pillar 42';
    document.getElementById('reportDescription').value = 'A massive asphalt crater spanning 1.5 meters wide in the central traffic lane. Multiple two-wheelers have skidded here during rainfall.';
    document.getElementById('reportCategory').value = 'damaged roads';
    document.getElementById('reportStreet').value = 'MG Road';
    document.getElementById('reportLandmark').value = 'Near Metro Pillar 42, Opposite Cafe';
    applyDemoPhoto(1);
  } else if (type === 'electric') {
    document.getElementById('reportTitle').value = 'Snapped streetlight pole with live sparking wires near primary school gate';
    document.getElementById('reportDescription').value = 'High-voltage electric wires dangling near sidewalk puddle. Direct electrocution danger to school children and pedestrians.';
    document.getElementById('reportCategory').value = 'broken streetlights';
    document.getElementById('reportStreet').value = 'Church Street';
    document.getElementById('reportLandmark').value = 'Primary School Gate 2';
    applyDemoPhoto(3);
  } else if (type === 'waterlog') {
    document.getElementById('reportTitle').value = 'Submerged open manhole with knee-deep waterlogging';
    document.getElementById('reportDescription').value = 'Stormwater drain blocked, dirty sewerage water flooding entire road corridor. Completely hidden open drain causing extreme risk of pedestrian drowning.';
    document.getElementById('reportCategory').value = 'waterlogging';
    document.getElementById('reportStreet').value = '100 Feet Road';
    document.getElementById('reportLandmark').value = 'Corner crossing near bus depot';
    applyDemoPhoto(2);
  }
  onFormTextChange();
  showToast('Evaluator preset applied');
}

// GPS Simulator
function randomizeGPS() {
  const lat = (12.9716 + (Math.random() - 0.5) * 0.015).toFixed(4);
  const lng = (77.5946 + (Math.random() - 0.5) * 0.015).toFixed(4);
  document.getElementById('reportCoords').value = `${lat}, ${lng}`;
  showToast(`GPS pinned to ${lat}, ${lng}`);
}

// AI Pre-Flight Inspector
function onFormTextChange() {
  const title = (document.getElementById('reportTitle').value || '').toLowerCase();
  const desc = (document.getElementById('reportDescription').value || '').toLowerCase();
  const text = `${title} ${desc}`;

  let detectedCat = 'damaged roads';
  let badgeText = 'Damaged Roads / Potholes';
  if (text.includes('wire') || text.includes('light') || text.includes('electric') || text.includes('spark')) {
    detectedCat = 'broken streetlights';
    badgeText = 'Broken Streetlights / Electrical';
  } else if (text.includes('water') || text.includes('flood') || text.includes('drain') || text.includes('pipe')) {
    detectedCat = 'waterlogging';
    badgeText = 'Waterlogging & Drains';
  } else if (text.includes('garbage') || text.includes('waste') || text.includes('trash') || text.includes('bin')) {
    detectedCat = 'waste bins';
    badgeText = 'Waste Bins / Sanitation';
  }
  document.getElementById('previewCategoryBadge').textContent = badgeText;
  document.getElementById('reportCategory').value = detectedCat;

  let urgency = 'Medium';
  let badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
  let points = 25;

  if (text.includes('wire') || text.includes('spark') || text.includes('live') || text.includes('drown') || text.includes('deep pothole') || text.includes('danger') || text.includes('accident')) {
    urgency = 'High Priority (Immediate Hazard)';
    badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
    points = 50;
  }
  const urgEl = document.getElementById('previewUrgencyBadge');
  urgEl.textContent = urgency;
  urgEl.className = `px-2.5 py-0.5 rounded-full font-bold text-xs border ${badgeClass}`;

  let isDup = false;
  if ((text.includes('pothole') && text.includes('pillar 42')) || (text.includes('pothole') && document.getElementById('reportStreet').value === 'MG Road')) {
    isDup = true;
  }
  const dupEl = document.getElementById('previewDuplicateBadge');
  if (isDup) {
    dupEl.textContent = 'Potential Duplicate (+10 Corroboration Coins)';
    dupEl.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs border bg-purple-100 text-purple-800 border-purple-300';
    document.getElementById('previewCoinBonus').textContent = '+10 Coins';
  } else {
    dupEl.textContent = 'Unique Verified Incident';
    dupEl.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs border bg-emerald-100 text-emerald-800 border-emerald-300';
    document.getElementById('previewCoinBonus').textContent = `+${points} Coins`;
  }
}

// Form Submission
async function submitReport(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>⏳ Analyzing via AI Engine...</span>`;

  const coords = document.getElementById('reportCoords').value.split(',');
  const lat = parseFloat(coords[0].trim()) || 12.9752;
  const lng = parseFloat(coords[1].trim()) || 77.6094;

  const payload = {
    title: document.getElementById('reportTitle').value.trim(),
    description: document.getElementById('reportDescription').value.trim(),
    category: document.getElementById('reportCategory').value,
    location: {
      street: document.getElementById('reportStreet').value,
      area: 'Central Ward',
      landmark: document.getElementById('reportLandmark').value.trim() || 'Near Road Intersection',
      lat,
      lng
    },
    imageUrl: userUploadedPhotoDataUrl || DEMO_PHOTOS[1]
  };

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById('modalTicketId').textContent = data.report.id;
      document.getElementById('modalPriority').textContent = `${data.report.aiMetadata.priority} Priority (${data.report.aiMetadata.urgencyScore}/100)`;
      document.getElementById('modalDuplicateStatus').textContent = data.report.aiMetadata.isDuplicate
        ? `Linked Duplicate of #${data.report.aiMetadata.duplicateOf}`
        : 'Unique Incident Verified';
      document.getElementById('modalTokens').textContent = `+${data.tokensAwarded} Coins 🪙`;
      document.getElementById('modalReasoningBox').innerHTML = `<b>AI Priority Reasoning:</b> ${data.report.aiMetadata.priorityReasoning}`;

      currentWalletBalance = data.walletBalance;
      updateWalletUI();

      const modal = document.getElementById('successModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      document.getElementById('reportForm').reset();
      removeUploadedPhoto();
      randomizeGPS();
      onFormTextChange();
      loadTrackTicket(data.report.id);
      fetchHotspotStats();
    } else {
      showToast(data.message || 'Submission error', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to AI server: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>🚀 Submit & Analyze via AI Engine</span>`;
  }
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.add('hidden');
  document.getElementById('successModal').classList.remove('flex');
}

// Ticket Tracking
async function lookupReport() {
  const query = document.getElementById('trackInput').value.trim();
  if (!query) {
    showToast('Please enter a ticket ID', 'error');
    return;
  }
  loadTrackTicket(query);
}

async function loadTrackTicket(id) {
  const container = document.getElementById('trackResultContainer');
  container.innerHTML = `<div class="py-8 text-center text-xs text-slate-500">Querying municipal ledger for #${id}...</div>`;

  try {
    const res = await fetch(`/api/reports/${id}`);
    const data = await res.json();

    if (data.success && data.report) {
      renderTrackingCard(data.report);
      document.getElementById('trackInput').value = data.report.id;
    } else {
      container.innerHTML = `
        <div class="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <b>Ticket Not Found:</b> No record matching "${id}". Try one of the featured scenario buttons above.
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-xs text-rose-600">Error loading tracking data: ${err.message}</div>`;
  }
}

function renderTrackingCard(report) {
  const container = document.getElementById('trackResultContainer');
  const isResolved = report.status === 'Resolved';
  const isInProgress = report.status === 'In Progress' || isResolved;
  const isDuplicate = report.aiMetadata?.isDuplicate;
  const hasProof = Boolean(report.resolvedImageUrl);

  container.innerHTML = `
    <div class="border border-slate-200 rounded-3xl p-6 bg-slate-50/70 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="font-mono text-base font-black text-slate-900">${report.id}</span>
            <span class="px-2.5 py-0.5 text-xs font-bold rounded-full ${
              report.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
              report.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
              'bg-amber-100 text-amber-800 border border-amber-300'
            }">
              ● ${report.status}
            </span>
            ${isDuplicate ? `<span class="px-2.5 py-0.5 text-xs font-bold bg-purple-100 text-purple-800 rounded-full border border-purple-200">Duplicate of #${report.aiMetadata.duplicateOf}</span>` : ''}
          </div>
          <h3 class="text-base sm:text-lg font-bold text-slate-900">${escapeHtml(report.title)}</h3>
        </div>
        <div class="text-xs text-slate-500 sm:text-right">
          <div>Logged: <b>${new Date(report.submittedAt).toLocaleDateString()}</b></div>
          <div>Dept: <b class="text-slate-800">${escapeHtml(report.assignedDepartment || 'Pending Assignment')}</b></div>
        </div>
      </div>

      <!-- Visual 3-Stage Progress Timeline -->
      <div class="py-2">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-4">Resolution Lifecycle</span>
        <div class="relative flex items-center justify-between">
          <div class="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0"></div>
          <div class="absolute left-6 ${isResolved ? 'right-6' : isInProgress ? 'w-1/2' : 'w-0'} top-1/2 -translate-y-1/2 h-1 bg-emerald-500 z-0 transition-all duration-500"></div>

          <!-- Step 1 -->
          <div class="relative z-10 flex flex-col items-center">
            <div class="w-10 h-10 rounded-full bg-emerald-500 text-white font-black flex items-center justify-center text-xs shadow-md">
              ✓
            </div>
            <span class="text-xs font-bold text-slate-800 mt-2">1. Submitted</span>
            <span class="text-[10px] text-slate-400">AI Analyzed</span>
          </div>

          <!-- Step 2 -->
          <div class="relative z-10 flex flex-col items-center">
            <div class="w-10 h-10 rounded-full ${isInProgress ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'} font-black flex items-center justify-center text-xs shadow-md">
              ${isInProgress ? '✓' : '2'}
            </div>
            <span class="text-xs font-bold ${isInProgress ? 'text-slate-800' : 'text-slate-400'} mt-2">2. In Progress</span>
            <span class="text-[10px] text-slate-400">Field Squad</span>
          </div>

          <!-- Step 3 -->
          <div class="relative z-10 flex flex-col items-center">
            <div class="w-10 h-10 rounded-full ${isResolved ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'} font-black flex items-center justify-center text-xs shadow-md">
              ${isResolved ? '✓' : '3'}
            </div>
            <span class="text-xs font-bold ${isResolved ? 'text-slate-800' : 'text-slate-400'} mt-2">3. Resolved</span>
            <span class="text-[10px] text-slate-400">+100 Token Bonus</span>
          </div>
        </div>
      </div>

      <!-- Before & After Photo Verification Proof (If Resolved) -->
      ${hasProof ? `
        <div class="bg-white p-4 rounded-2xl border border-emerald-300 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
              <span>📸 Verified Proof of Completed Action (Before & After)</span>
            </span>
            <span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
              Field Action Verified
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span class="text-[11px] font-bold text-rose-600 block mb-1">🚨 Before (Reported Issue):</span>
              <div class="h-44 rounded-xl overflow-hidden border border-slate-200 bg-black">
                <img src="${report.imageUrl}" class="w-full h-full object-cover">
              </div>
            </div>
            <div>
              <span class="text-[11px] font-bold text-emerald-600 block mb-1">✅ After (Fixed by Crew):</span>
              <div class="h-44 rounded-xl overflow-hidden border border-emerald-300 bg-black">
                <img src="${report.resolvedImageUrl}" class="w-full h-full object-cover">
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Explainable AI Prioritization & Details -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
          <span class="font-bold text-slate-700 block text-xs">🧠 Explainable AI Priority Assessment</span>
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded font-bold text-white ${report.aiMetadata?.priority === 'High' ? 'bg-rose-600' : 'bg-amber-500'}">
              ${report.aiMetadata?.priority || 'Medium'} Priority
            </span>
            <span class="text-slate-500 font-mono">Urgency Score: ${report.aiMetadata?.urgencyScore || 60}/100</span>
          </div>
          <p class="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            ${escapeHtml(report.aiMetadata?.priorityReasoning || 'Assessed through neural keyword taxonomy.')}
          </p>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
          <span class="font-bold text-slate-700 block text-xs">📍 Location & Authority Response</span>
          <p class="text-slate-600">
            <b>Street:</b> ${escapeHtml(report.location?.street)}, ${escapeHtml(report.location?.area)}<br/>
            <b>Landmark:</b> ${escapeHtml(report.location?.landmark || 'N/A')}<br/>
            <b>Coordinates:</b> ${report.location?.lat}, ${report.location?.lng}
          </p>
          ${report.resolutionNotes ? `
            <div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 mt-2">
              <b>Municipal Notes:</b> ${escapeHtml(report.resolutionNotes)}
            </div>
          ` : '<div class="text-slate-400 italic">No field action notes recorded yet.</div>'}
        </div>
      </div>
    </div>
  `;
}

// Reward Redemption Modal
function openRedeemModal() {
  document.getElementById('redeemModal').classList.remove('hidden');
  document.getElementById('redeemModal').classList.add('flex');
}

function closeRedeemModal() {
  document.getElementById('redeemModal').classList.add('hidden');
  document.getElementById('redeemModal').classList.remove('flex');
  const resultBox = document.getElementById('voucherResultBox');
  if (resultBox) resultBox.classList.add('hidden');
}

async function executeRedemption(rewardTitle, cost) {
  try {
    const res = await fetch('/api/wallet/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardTitle, cost })
    });
    const data = await res.json();
    if (data.success) {
      currentWalletBalance = data.newBalance;
      updateWalletUI();
      
      const resultBox = document.getElementById('voucherResultBox');
      const codeDisplay = document.getElementById('voucherCodeDisplay');
      if (codeDisplay) codeDisplay.textContent = data.voucherCode;
      if (resultBox) resultBox.classList.remove('hidden');

      showToast(`🎉 Redeemed ${rewardTitle}! Voucher: ${data.voucherCode}`);
    } else {
      showToast(data.message || 'Redemption failed', 'error');
    }
  } catch (e) {
    showToast('Redemption error: ' + e.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
