import { fmtIDR, fmtNum, sum, groupBy, today, pctChange } from '../utils.js';
import { renderDonutChart, renderTrendChart } from '../charts.js';

// ============================================================
// HTML TEMPLATE
// ============================================================
export const DashboardView = () => {
  return `
    <div id="tab-dashboard" class="tab-panel active">
      <!-- FILTERS -->
      <div class="filters-bar">
        <div class="filter-group">
          <label>TANGGAL MULAI</label>
          <input type="date" id="date-from" class="filter-input" />
        </div>
        <div class="filter-group">
          <label>TANGGAL AKHIR</label>
          <input type="date" id="date-to" class="filter-input" />
        </div>
        <div class="filter-group">
          <label>JENIS DOKUMEN</label>
          <div class="checkbox-group">
            <label class="cb-label"><input type="checkbox" class="doc-filter" value="CD" checked /> CD</label>
            <label class="cb-label"><input type="checkbox" class="doc-filter" value="IMEI" checked /> IMEI</label>
            <label class="cb-label"><input type="checkbox" class="doc-filter" value="PIBK" checked /> PIBK</label>
            <label class="cb-label"><input type="checkbox" class="doc-filter" value="EKSPOR" checked /> EKSPOR</label>
          </div>
        </div>
        <button class="apply-btn" id="apply-filters">Apply Filters</button>
      </div>

      <!-- DAILY REPORT BAR -->
      <div class="report-bar">
        <div class="report-bar-left">
          <span class="report-bar-label">📋 LAPORAN HARIAN</span>
          <div class="report-date-group">
            <label class="report-date-label">Pilih Tanggal:</label>
            <input type="date" id="report-date" class="filter-input report-date-input" />
          </div>
        </div>
        <button class="copy-report-btn" id="copy-report-btn">
          <span class="copy-icon">📱</span> Copy Laporan ke Clipboard
        </button>
        <span id="copy-feedback" class="copy-feedback"></span>
      </div>

      <!-- KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card accent">
          <div class="kpi-label">TOTAL REVENUE</div>
          <div class="kpi-value" id="kpi-total-revenue">—</div>
          <div class="kpi-sub" id="kpi-total-docs">— documents</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">BULAN INI</div>
          <div class="kpi-value" id="kpi-month-total">—</div>
          <div class="kpi-sub" id="kpi-month-docs">—</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">TAHUN INI</div>
          <div class="kpi-value" id="kpi-year-total">—</div>
          <div class="kpi-sub" id="kpi-year-docs">—</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">AVG / DOKUMEN</div>
          <div class="kpi-value" id="kpi-avg-doc">—</div>
          <div class="kpi-sub">Revenue rata-rata</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">AVG / HARI</div>
          <div class="kpi-value" id="kpi-avg-day">—</div>
          <div class="kpi-sub">Revenue rata-rata</div>
        </div>
      </div>

      <!-- CHARTS ROW 1 -->
      <div class="charts-row">
        <div class="chart-box donut-box">
          <div class="chart-header">
            <span class="chart-title">PROPORSI PER JENIS DOKUMEN</span>
          </div>
          <div class="donut-wrap">
            <div class="donut-chart-container">
              <canvas id="chart-donut"></canvas>
            </div>
            <div class="donut-legend" id="donut-legend"></div>
          </div>
        </div>
        <div class="chart-box trend-box">
          <div class="chart-header">
            <span class="chart-title">TREN REVENUE — 7 HARI TERAKHIR</span>
          </div>
          <canvas id="chart-trend"></canvas>
        </div>
      </div>

      <!-- BREAKDOWN TABLE -->
      <div class="section-box">
        <div class="chart-header">
          <span class="chart-title">BREAKDOWN PER JENIS DOKUMEN</span>
        </div>
        <div class="mobile-scroll">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Jenis Dokumen</th>
                <th>Jumlah Dok.</th>
                <th>Total BM</th>
                <th>Total PPN</th>
                <th>Total PPH</th>
                <th>Total BK</th>
                <th>Total Revenue</th>
                <th>% dari Total</th>
              </tr>
            </thead>
            <tbody id="breakdown-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- DETAIL TABLE -->
      <div class="section-box">
        <div class="chart-header">
          <span class="chart-title">DETAIL DATA</span>
          <div class="table-controls">
            <input type="text" id="search-input" class="search-input" placeholder="Cari nomor dokumen..." />
            <span id="table-info" class="table-info"></span>
          </div>
        </div>
        <div class="table-scroll">
          <table class="detail-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>No. Dokumen</th>
                <th>Jenis</th>
                <th>BM</th>
                <th>PPN</th>
                <th>PPH</th>
                <th>BK</th>
                <th>Jumlah</th>
                <th>Bank</th>
                <th>Petugas</th>
              </tr>
            </thead>
            <tbody id="detail-tbody"></tbody>
          </table>
        </div>
        <div class="pagination" id="pagination"></div>
      </div>
    </div>
  `;
};

// ============================================================
// VIEW LOGIC
// ============================================================

export const initDashboard = (appState) => {
  // Bind Filter Events
  document.getElementById('apply-filters').addEventListener('click', () => applyFilters(appState));
  
  // Bind Search Event
  document.getElementById('search-input').addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.toLowerCase();
    appState.currentPage = 1;
    renderDetailTable(appState);
  });

  // Bind Daily Report Events
  initReportDatePicker(appState);
  document.getElementById('copy-report-btn').addEventListener('click', () => handleCopyReport(appState));

  // Initial Load
  applyFilters(appState);
};

export const applyFilters = (appState) => {
  if (appState.rawData.length === 0) return;

  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  const checkedTypes = [...document.querySelectorAll('.doc-filter:checked')].map(el => el.value);

  appState.filteredData = appState.rawData.filter(r => {
    if (from && r.dateStr < from) return false;
    if (to && r.dateStr > to) return false;
    if (!checkedTypes.includes(r.docType)) return false;
    return true;
  });

  // Re-render UI Components
  renderKPIs(appState);
  appState.charts.donut = renderDonutChart(appState.filteredData, appState.docTypes, appState.docColors, appState.charts.donut);
  appState.charts.trend = renderTrendChart(appState.filteredData, appState.charts.trend);
  renderBreakdown(appState);
  renderDetailTable(appState);
};

// ============================================================
// RENDERERS
// ============================================================

function renderKPIs(appState) {
  const data = appState.filteredData;
  const now = new Date();
  
  // Format current month and year to match our data structure (YYYY-MM and YYYY)
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curYear = `${now.getFullYear()}`;

  const totalRev = sum(data, 'jumlah');
  const totalDocs = data.length;
  const monthData = data.filter(r => r.monthStr === curMonth);
  const yearData = data.filter(r => r.yearStr === curYear);
  const monthRev = sum(monthData, 'jumlah');
  const yearRev = sum(yearData, 'jumlah');
  const avgPerDoc = totalDocs > 0 ? totalRev / totalDocs : 0;

  const uniqueDays = [...new Set(data.map(r => r.dateStr))];
  const avgPerDay = uniqueDays.length > 0 ? totalRev / uniqueDays.length : 0;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText('kpi-total-revenue', fmtIDR(totalRev));
  setText('kpi-total-docs', `${fmtNum(totalDocs)} dokumen`);
  setText('kpi-month-total', fmtIDR(monthRev));
  setText('kpi-month-docs', `${fmtNum(monthData.length)} dokumen bulan ini`);
  setText('kpi-year-total', fmtIDR(yearRev));
  setText('kpi-year-docs', `${fmtNum(yearData.length)} dokumen tahun ini`);
  setText('kpi-avg-doc', fmtIDR(avgPerDoc));
  setText('kpi-avg-day', fmtIDR(avgPerDay));
}

function renderBreakdown(appState) {
  const byType = groupBy(appState.filteredData, r => r.docType);
  const totalRev = sum(appState.filteredData, 'jumlah') || 1;

  const tbody = document.getElementById('breakdown-tbody');
  if (!tbody) return;

  tbody.innerHTML = appState.docTypes.map(t => {
    const rows = byType[t] || [];
    if (rows.length === 0) return '';
    const rev = sum(rows, 'jumlah');
    const pct = ((rev / totalRev) * 100).toFixed(1);
    const color = appState.docColors[t] || '#666';
    
    return `<tr>
      <td><span class="doc-badge badge-${t}">${t}</span></td>
      <td>${fmtNum(rows.length)}</td>
      <td>${fmtIDR(sum(rows, 'bm'))}</td>
      <td>${fmtIDR(sum(rows, 'ppn'))}</td>
      <td>${fmtIDR(sum(rows, 'pph'))}</td>
      <td>${fmtIDR(sum(rows, 'bk'))}</td>
      <td style="color:${color};font-weight:600">${fmtIDR(rev)}</td>
      <td>${pct}%</td>
    </tr>`;
  }).join('');
}

function renderDetailTable(appState) {
  const search = appState.searchQuery;
  let data = appState.filteredData;

  if (search) {
    data = data.filter(r =>
      r.docNum.toLowerCase().includes(search) ||
      r.docType.toLowerCase().includes(search) ||
      r.bank.toLowerCase().includes(search)
    );
  }

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / appState.PAGE_SIZE));
  appState.currentPage = Math.min(appState.currentPage, totalPages);
  
  const start = (appState.currentPage - 1) * appState.PAGE_SIZE;
  const pageData = data.slice(start, start + appState.PAGE_SIZE);

  const tbody = document.getElementById('detail-tbody');
  if (!tbody) return;

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">No records found</td></tr>`;
  } else {
    tbody.innerHTML = pageData.map(r => `
      <tr>
        <td>${r.dateStr}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${r.docNum || '—'}</td>
        <td><span class="doc-badge badge-${r.docType}">${r.docType}</span></td>
        <td>${fmtNum(r.bm)}</td>
        <td>${fmtNum(r.ppn)}</td>
        <td>${fmtNum(r.pph)}</td>
        <td>${fmtNum(r.bk)}</td>
        <td style="color:var(--accent);font-weight:500">${fmtIDR(r.jumlah)}</td>
        <td>${r.bank || '—'}</td>
        <td>${r.petugas || '—'}</td>
      </tr>
    `).join('');
  }

  const infoEl = document.getElementById('table-info');
  if (infoEl) {
    infoEl.textContent = `${start + 1}–${Math.min(start + appState.PAGE_SIZE, total)} of ${total}`;
  }

  renderPagination(appState, totalPages);
}

function renderPagination(appState, totalPages) {
  const pg = document.getElementById('pagination');
  if (!pg) return;

  const maxVisible = 7;
  let pages = [];

  if (totalPages <= maxVisible) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const around = new Set([1, totalPages, appState.currentPage, appState.currentPage - 1, appState.currentPage + 1].filter(p => p >= 1 && p <= totalPages));
    pages = [...around].sort((a, b) => a - b);
    
    const withEllipsis = [];
    for (let i = 0; i < pages.length; i++) {
      if (i > 0 && pages[i] - pages[i - 1] > 1) withEllipsis.push('…');
      withEllipsis.push(pages[i]);
    }
    pages = withEllipsis;
  }

  pg.innerHTML = `
    <button class="page-btn" ${appState.currentPage === 1 ? 'disabled' : ''} data-page="${appState.currentPage - 1}">‹</button>
    ${pages.map(p => p === '…'
      ? `<span style="color:var(--text-muted);padding:4px 6px">…</span>`
      : `<button class="page-btn ${p === appState.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-btn" ${appState.currentPage === totalPages ? 'disabled' : ''} data-page="${appState.currentPage + 1}">›</button>
  `;

  pg.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (!isNaN(p)) { 
        appState.currentPage = p; 
        renderDetailTable(appState); 
      }
    });
  });
}

// ============================================================
// DAILY REPORT LOGIC
// ============================================================

function initReportDatePicker(appState) {
  const el = document.getElementById('report-date');
  if (!el) return;
  if (appState.rawData.length > 0) {
    const dates = [...new Set(appState.rawData.map(r => r.dateStr))].sort();
    el.value = dates[dates.length - 1]; // default = latest date in data
  } else {
    el.value = today();
  }
}

function fmtDateID(dateStr) {
  if (!dateStr) return '—';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${bulan[parseInt(m) - 1]} ${y}`;
}

function fmtMonthID(monthStr) {
  if (!monthStr) return '—';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const [y, m] = monthStr.split('-');
  return `${bulan[parseInt(m) - 1]} ${y}`;
}

function fmtIDRFull(val) {
  if (!val || isNaN(val)) return 'Rp 0';
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

function generateReport(appState, reportDateStr) {
  if (appState.rawData.length === 0) return 'Data belum dimuat. Silakan upload file atau tunggu auto-load selesai.';

  const byDate = groupBy(appState.rawData, r => r.dateStr);
  const sortedDates = Object.keys(byDate).sort();

  const dayData = byDate[reportDateStr] || [];
  const prevDates = sortedDates.filter(d => d < reportDateStr);
  const yestStr = prevDates.length > 0 ? prevDates[prevDates.length - 1] : null;
  const yestData = yestStr ? (byDate[yestStr] || []) : [];

  const revByType = {};
  appState.docTypes.forEach(t => {
    revByType[t] = sum(dayData.filter(r => r.docType === t), 'jumlah');
  });

  const totalToday = sum(dayData, 'jumlah');
  const totalDocs  = dayData.length;
  const totalYest  = sum(yestData, 'jumlah');

  const pctVsYest = pctChange(totalToday, totalYest);
  const deltaYestStr = pctVsYest !== null
    ? (pctVsYest >= 0 ? `+${pctVsYest.toFixed(1)}%` : `${pctVsYest.toFixed(1)}%`)
    : 'N/A';

  const uniqueDays = [...new Set(appState.rawData.map(r => r.dateStr))];
  const totalAll = sum(appState.rawData, 'jumlah');
  const dailyAvg = uniqueDays.length > 0 ? totalAll / uniqueDays.length : 0;
  const pctVsAvg = pctChange(totalToday, dailyAvg);
  const deltaAvgStr = pctVsAvg !== null
    ? (pctVsAvg >= 0 ? `+${pctVsAvg.toFixed(1)}%` : `${pctVsAvg.toFixed(1)}%`)
    : 'N/A';

  const monthStr = reportDateStr.slice(0, 7);
  const monthData = appState.rawData.filter(r => r.monthStr === monthStr);
  const monthTotal = sum(monthData, 'jumlah');
  const monthDocs  = monthData.length;

  const yearStr = reportDateStr.slice(0, 4);
  const yearData = appState.rawData.filter(r => r.yearStr === yearStr);
  const yearTotal = sum(yearData, 'jumlah');
  const yearDocs  = yearData.length;

  const topTypes = appState.docTypes
    .filter(t => revByType[t] > 0)
    .sort((a, b) => revByType[b] - revByType[a]);
    
  const topType   = topTypes.length > 0 ? topTypes[0] : '—';
  const topRevStr = topTypes.length > 0 ? fmtIDRFull(revByType[topTypes[0]]) : '—';

  let insight = '';
  if (pctVsAvg !== null && pctVsAvg > 0) {
    insight += `✅ Hari ini ABOVE average — performa sangat baik!\n`;
  } else if (pctVsAvg !== null && pctVsAvg < -10) {
    insight += `⚠️ Hari ini BELOW average — perlu perhatian.\n`;
  } else {
    insight += `📊 Hari ini dalam rentang normal.\n`;
  }
  if (pctVsYest !== null && pctVsYest > 20) {
    insight += `🚀 Lonjakan signifikan vs kemarin (${deltaYestStr})!\n`;
  } else if (pctVsYest !== null && pctVsYest < -20) {
    insight += `📉 Penurunan signifikan vs kemarin (${deltaYestStr}).\n`;
  }
  if (topType !== '—') {
    insight += `📱 ${topType} mendominasi penerimaan hari ini.\n`;
  }

  const now = new Date();
  const jamWIB = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

  const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const lines = [
    `📊 *LAPORAN HARIAN PENERIMAAN TERMINAL*`,
    `*Terminal 3 dan 2F- Bea Cukai Soekarno Hatta*`,
    sep,
    `📅 *Tanggal:* ${fmtDateID(reportDateStr)}`,
    ``,
    `💰 *BREAKDOWN HARI INI:*`,
    ...appState.docTypes.map(t => `├ ${t}: ${fmtIDRFull(revByType[t])}`),
    ``,
    `💵 *GRAND TOTAL : ${fmtIDRFull(totalToday)}*`,
    `📋 *DOKUMEN : ${totalDocs}*`,
    ``,
    `📈 *vs KEMARIN:* ${deltaYestStr}`,
    `Kemarin: ${fmtIDRFull(totalYest)}`,
    ``,
    `⬆️ *vs RATA-RATA:* ${deltaAvgStr} (avg: ${fmtIDRFull(dailyAvg)})`,
    ``,
    `🏆 *TOP PENERIMAAN:* ${topType}`,
    `${topRevStr}`,
    ``,
    `📅 *BULAN ${fmtMonthID(monthStr).toUpperCase()}:*`,
    `├ Jumlah Dokumen: ${monthDocs.toLocaleString('id-ID')}`,
    `└ Total : ${fmtIDRFull(monthTotal)}`,
    ``,
    `📆 *TAHUN ${yearStr}:*`,
    `├ Jumlah Dokumen: ${yearDocs.toLocaleString('id-ID')}`,
    `└ Total : ${fmtIDRFull(yearTotal)}`,
    ``,
    `💡 *INSIGHT:*`,
    insight.trim(),
    sep,
    `🔗 *Detail & Analisis Lengkap:*`,
    `"http://s.kemenkeu.go.id/DashboardTerminal"`,
    `🤖 _Terima Kasih Tim Admin Terminal, Auto-generated by Dashboard Penerimaan Terminal_`,
    `🕐 _${jamWIB}_`,
  ];

  return lines.join('\n');
}

async function handleCopyReport(appState) {
  const dateEl = document.getElementById('report-date');
  const reportDateStr = dateEl ? dateEl.value : today();

  if (!reportDateStr) {
    alert('Pilih tanggal terlebih dahulu.');
    return;
  }

  const text = generateReport(appState, reportDateStr);

  const showCopyFeedback = (msg) => {
    const el = document.getElementById('copy-feedback');
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 3000);
  };

  try {
    await navigator.clipboard.writeText(text);
    showCopyFeedback('✓ Tersalin!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showCopyFeedback('✓ Tersalin!');
  }
}
