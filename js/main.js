/**
 * REVENUE COMMAND — Financial Dashboard
 * main.js — Data pipeline, dashboard/analysis rendering, charts, daily report
 * Loaded on every page. Every section below checks for the DOM elements it
 * needs before doing anything, so it's safe on pages that don't have them
 * (e.g. dashboard-only elements simply no-op on analysis.html / knowledge.html).
 */

// ============================================================
// PARSING
// ============================================================

/**
 * Parse an array of raw row objects from SheetJS into normalized records.
 * Handles column name mapping for this specific dataset.
 */
function parseRows(rows) {
  if (!rows || rows.length === 0) return [];

  const out = [];
  for (const row of rows) {
    // Try different possible column name variations
    const dateRaw = row['Tgl Laporan'] || row['Tanggal Laporan'] || row['tanggal_laporan'] || row['Date'] || row['date'];
    const docType = (row['Jenis Dokumen'] || row['jenis_dokumen'] || row['DocType'] || '').toString().trim().toUpperCase();
    const docNum = row['Nomor Dokumen'] || row['nomor_dokumen'] || row['DocNumber'] || '';
    const bm = parseFloat(row['BM']) || 0;
    const ppn = parseFloat(row['PPN']) || 0;
    const pph = parseFloat(row['PPH']) || 0;
    const bk = parseFloat(row['BK']) || 0;
    const jumlah = parseFloat(row['Jumlah']) || 0;
    const bank = row['Bank'] || '';
    const petugas = row['Petugas Penetapan'] || '';
    const admin = row['Admin Input'] || '';
    const keterangan = row['Keterangan '] || row['Keterangan'] || '';
    const lokasi = row['Lokasi'] || '';

    // Parse date: SheetJS may return Date objects or strings
    let dateObj = null;
    if (dateRaw instanceof Date) {
      dateObj = dateRaw;
    } else if (typeof dateRaw === 'number') {
      // Excel serial date
      dateObj = new Date((dateRaw - 25569) * 86400 * 1000);
    } else if (dateRaw) {
      dateObj = new Date(dateRaw);
    }

    if (!dateObj || isNaN(dateObj)) continue; // Skip rows with invalid date
    if (!docType) continue;

    out.push({
      date: dateObj,
      dateStr: toDateStr(dateObj),
      monthStr: toMonthStr(dateObj),
      yearStr: toYearStr(dateObj),
      docType,
      docNum: docNum.toString(),
      bm,
      ppn,
      pph,
      bk,
      jumlah,
      bank: bank.toString(),
      petugas: petugas.toString(),
      admin: admin.toString(),
      keterangan: keterangan.toString(),
      lokasi: lokasi.toString(),
    });
  }
  return out;
}

// ============================================================
// FILE UPLOAD (only present on pages with the data-bar / #file-input)
// ============================================================
const fileInputEl = document.getElementById('file-input');
if (fileInputEl) {
  fileInputEl.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // reset input for re-upload

    setStatus('Reading file…');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, dateNF: 'yyyy-mm-dd' });
      loadData(rows, `${file.name} (${rows.length} rows)`);
    } catch (err) {
      setStatus('Error reading file: ' + err.message, 'err');
    }
  });
}

// ============================================================
// GOOGLE SHEETS LOAD (manual URL entry)
// ============================================================
const loadGsheetBtn = document.getElementById('load-gsheet-btn');
if (loadGsheetBtn) {
  loadGsheetBtn.addEventListener('click', async () => {
    let url = document.getElementById('gsheet-url').value.trim();
    if (!url) return setStatus('Please enter a Google Sheets URL.', 'err');

    // Convert Google Sheets edit URL to CSV export URL
    try {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) throw new Error('Invalid Google Sheets URL');
      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

      setStatus('Fetching Google Sheets…');
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Failed to fetch. Make sure the sheet is public.');
      const text = await res.text();

      const wb = XLSX.read(text, { type: 'string', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
      loadData(rows, `Google Sheets (${rows.length} rows)`);
    } catch (err) {
      setStatus('Error: ' + err.message, 'err');
    }
  });
}

// ============================================================
// LOAD DATA INTO APP
// ============================================================
function loadData(rows, label) {
  const parsed = parseRows(rows);
  if (parsed.length === 0) {
    setStatus('No valid rows found. Check column names.', 'err');
    return;
  }

  RAW_DATA = parsed.sort((a, b) => a.date - b.date);
  setText('last-updated', 'Loaded: ' + new Date().toLocaleTimeString('id-ID'));
  setStatus(`✓ ${label} loaded — ${parsed.length} records`, 'ok');

  // Set default date range based on data (guarded — only exists on index.html)
  const dates = RAW_DATA.map(r => r.dateStr).sort();
  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  if (dateFromEl) dateFromEl.value = dates[0] || '';
  if (dateToEl) dateToEl.value = dates[dates.length - 1] || '';

  // Hide empty state
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.classList.remove('visible');

  // Set report date picker to latest date in data
  initReportDatePicker();

  // Persist so other pages / reloads can reuse this data
  saveRawDataToLocalStorage();

  applyFilters();
}

// ============================================================
// FILTERS
// ============================================================
const applyFiltersBtn = document.getElementById('apply-filters');
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);

function applyFilters() {
  if (RAW_DATA.length === 0) return;

  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  const from = dateFromEl ? dateFromEl.value : '';
  const to = dateToEl ? dateToEl.value : '';
  // period-select is hidden in current HTML — safely read if present
  const periodEl = document.getElementById('period-select');
  const period = periodEl ? periodEl.value : 'daily';
  const checkedTypes = [...document.querySelectorAll('.doc-filter:checked')].map(el => el.value);

  FILTERED_DATA = RAW_DATA.filter(r => {
    if (from && r.dateStr < from) return false;
    if (to && r.dateStr > to) return false;
    if (checkedTypes.length > 0 && !checkedTypes.includes(r.docType)) return false;
    return true;
  });

  // Re-render everything (each function no-ops if its DOM isn't on this page)
  renderKPIs();
  renderDonut();
  renderTrend();
  renderBreakdown();
  renderDetailTable();
  renderAnalysisTab();
}

// Search box for detail table
const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
  searchInputEl.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    renderDetailTable();
  });
}

// ============================================================
// KPI CARDS
// ============================================================
function renderKPIs() {
  if (!document.getElementById('kpi-total-revenue')) return;

  const data = FILTERED_DATA;
  const now = new Date();
  const curMonth = toMonthStr(now);
  const curYear = toYearStr(now);

  const totalRev = sum(data, 'jumlah');
  const totalDocs = data.length;
  const monthData = data.filter(r => r.monthStr === curMonth);
  const yearData = data.filter(r => r.yearStr === curYear);
  const monthRev = sum(monthData, 'jumlah');
  const yearRev = sum(yearData, 'jumlah');
  const avgPerDoc = totalDocs > 0 ? totalRev / totalDocs : 0;

  // Average per day
  const uniqueDays = [...new Set(data.map(r => r.dateStr))];
  const avgPerDay = uniqueDays.length > 0 ? totalRev / uniqueDays.length : 0;

  setText('kpi-total-revenue', fmtIDR(totalRev));
  setText('kpi-total-docs', `${fmtNum(totalDocs)} dokumen`);
  setText('kpi-month-total', fmtIDR(monthRev));
  setText('kpi-month-docs', `${fmtNum(monthData.length)} dokumen bulan ini`);
  setText('kpi-year-total', fmtIDR(yearRev));
  setText('kpi-year-docs', `${fmtNum(yearData.length)} dokumen tahun ini`);
  setText('kpi-avg-doc', fmtIDR(avgPerDoc));
  setText('kpi-avg-day', fmtIDR(avgPerDay));
}

// ============================================================
// DONUT CHART — Revenue Proportion by Doc Type
// ============================================================
function renderDonut() {
  const canvas = document.getElementById('chart-donut');
  if (!canvas) return;

  const byType = groupBy(FILTERED_DATA, r => r.docType);
  const total = sum(FILTERED_DATA, 'jumlah') || 1;
  const labels = DOC_TYPES.filter(t => byType[t]);
  const values = labels.map(t => sum(byType[t] || [], 'jumlah'));
  const colors = labels.map(t => DOC_COLORS[t] || '#666');

  if (chartDonut) chartDonut.destroy();

  const ctx = canvas.getContext('2d');
  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmtIDR(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`
          }
        }
      },
      responsive: false,
    }
  });

  // Custom legend
  const legendEl = document.getElementById('donut-legend');
  if (legendEl) {
    legendEl.innerHTML = labels.map((l, i) => {
      const pct = ((values[i] / total) * 100).toFixed(1);
      return `<div class="legend-item">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <span class="legend-name">${l}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
    }).join('');
  }
}

// ============================================================
// TREND CHART — Last 7 Days
// ============================================================
function renderTrend() {
  const canvas = document.getElementById('chart-trend');
  if (!canvas) return;

  const dates = lastNDates(FILTERED_DATA, 7);
  if (dates.length === 0) return;

  const byDate = groupBy(FILTERED_DATA.filter(r => dates.includes(r.dateStr)), r => r.dateStr);
  const values = dates.map(d => sum(byDate[d] || [], 'jumlah'));
  const labels = dates.map(d => d.slice(5)); // MM-DD

  if (chartTrend) chartTrend.destroy();

  const ctx = canvas.getContext('2d');

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(232,164,56,0.3)');
  gradient.addColorStop(1, 'rgba(232,164,56,0.0)');

  chartTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        borderColor: '#e8a438',
        borderWidth: 2,
        pointBackgroundColor: '#e8a438',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.2,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmtIDR(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#2a3030' },
          ticks: { color: '#6b7a7a', font: { family: 'DM Mono', size: 10 } },
        },
        y: {
          grid: { color: '#2a3030' },
          ticks: {
            color: '#6b7a7a',
            font: { family: 'DM Mono', size: 10 },
            callback: v => fmtIDR(v)
          }
        }
      }
    }
  });
}

// ============================================================
// BREAKDOWN TABLE — Per Doc Type
// ============================================================
function renderBreakdown() {
  const tbody = document.getElementById('breakdown-tbody');
  if (!tbody) return;

  const byType = groupBy(FILTERED_DATA, r => r.docType);
  const totalRev = sum(FILTERED_DATA, 'jumlah') || 1;

  tbody.innerHTML = DOC_TYPES.map(t => {
    const rows = byType[t] || [];
    if (rows.length === 0) return '';
    const rev = sum(rows, 'jumlah');
    const pct = ((rev / totalRev) * 100).toFixed(1);
    const color = DOC_COLORS[t] || '#666';
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

// ============================================================
// DETAIL TABLE (paginated, searchable)
// ============================================================
function renderDetailTable() {
  const tbody = document.getElementById('detail-tbody');
  if (!tbody) return;

  const search = searchQuery;
  let data = FILTERED_DATA;

  // Apply search
  if (search) {
    data = data.filter(r =>
      r.docNum.toLowerCase().includes(search) ||
      r.docType.toLowerCase().includes(search) ||
      r.bank.toLowerCase().includes(search)
    );
  }

  // Total count for pagination
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = data.slice(start, start + PAGE_SIZE);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">No records found</td></tr>`;
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

  // Info
  setText('table-info', `${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`);

  // Pagination
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pg = document.getElementById('pagination');
  if (!pg) return;

  const maxVisible = 7;
  let pages = [];

  if (totalPages <= maxVisible) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    // Show first, last, and pages around current
    const around = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1].filter(p => p >= 1 && p <= totalPages));
    pages = [...around].sort((a, b) => a - b);
    // Insert ellipsis markers
    const withEllipsis = [];
    for (let i = 0; i < pages.length; i++) {
      if (i > 0 && pages[i] - pages[i - 1] > 1) withEllipsis.push('…');
      withEllipsis.push(pages[i]);
    }
    pages = withEllipsis;
  }

  pg.innerHTML = `
    <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>
    ${pages.map(p => p === '…'
      ? `<span style="color:var(--text-muted);padding:4px 6px">…</span>`
      : `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>
  `;

  pg.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (!isNaN(p)) { currentPage = p; renderDetailTable(); }
    });
  });
}

// ============================================================
// EXPORT TO EXCEL
// ============================================================
const exportBtn = document.getElementById('export-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (FILTERED_DATA.length === 0) return setStatus('No data to export.', 'err');

    const exportRows = FILTERED_DATA.map(r => ({
      'Tanggal Laporan': r.dateStr,
      'Nomor Dokumen': r.docNum,
      'Jenis Dokumen': r.docType,
      'BM': r.bm,
      'PPN': r.ppn,
      'PPH': r.pph,
      'BK': r.bk,
      'Jumlah': r.jumlah,
      'Bank': r.bank,
      'Petugas': r.petugas,
      'Admin Input': r.admin,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `dashboard_export_${today()}.xlsx`);
    setStatus(`✓ Exported ${exportRows.length} rows`, 'ok');
  });
}

// ============================================================
// ANALYSIS TAB
// ============================================================
function renderAnalysisTab() {
  if (!document.getElementById('tab-analysis') && !document.getElementById('chart-monthly-trend')) return;
  if (RAW_DATA.length === 0) return;
  renderComparisons();
  renderDocCompare();
  renderMonthlyComparison();
  renderMonthlyTrendChart();
  renderTopBottomDays();
}

/** Comparative insight cards */
function renderComparisons() {
  const data = RAW_DATA; // Use full raw data for time-based comparisons
  const byDate = groupBy(data, r => r.dateStr);
  const sortedDates = Object.keys(byDate).sort();

  // Get the most recent dates available
  const todayStr = sortedDates[sortedDates.length - 1] || today();
  const yesterdayStr = sortedDates[sortedDates.length - 2] || '';

  const todayRev = sum(byDate[todayStr] || [], 'jumlah');
  const yestRev = sum(byDate[yesterdayStr] || [], 'jumlah');

  // Current week vs last week (using most recent data day as reference)
  const refDate = new Date(todayStr);
  const dayOfWeek = refDate.getDay();
  const weekStart = new Date(refDate); weekStart.setDate(refDate.getDate() - dayOfWeek);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);

  const weekData = data.filter(r => r.date >= weekStart && r.date <= refDate);
  const lastWeekData = data.filter(r => r.date >= lastWeekStart && r.date < weekStart);
  const weekRev = sum(weekData, 'jumlah');
  const lastWeekRev = sum(lastWeekData, 'jumlah');

  // Current month vs last month
  const curMonthStr = todayStr.slice(0, 7);
  const prevMonthDate = new Date(refDate); prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthStr = toMonthStr(prevMonthDate);

  const curMonthRev = sum(data.filter(r => r.monthStr === curMonthStr), 'jumlah');
  const prevMonthRev = sum(data.filter(r => r.monthStr === prevMonthStr), 'jumlah');

  // Daily average
  const uniqueDays = [...new Set(data.map(r => r.dateStr))];
  const totalRev = sum(data, 'jumlah');
  const dailyAvg = uniqueDays.length > 0 ? totalRev / uniqueDays.length : 0;

  // Render cards
  renderCompareCard('comp-today', 'Hari Ini vs Kemarin',
    [['Hari Ini', todayStr, todayRev], ['Kemarin', yesterdayStr, yestRev]], todayRev, yestRev);

  renderCompareCard('comp-week', 'Minggu Ini vs Minggu Lalu',
    [['Minggu Ini', `${toDateStr(weekStart)} – ${todayStr}`, weekRev],
     ['Minggu Lalu', '', lastWeekRev]], weekRev, lastWeekRev);

  renderCompareCard('comp-month', 'Bulan Ini vs Bulan Lalu',
    [['Bulan Ini', curMonthStr, curMonthRev],
     ['Bulan Lalu', prevMonthStr, prevMonthRev]], curMonthRev, prevMonthRev);

  // vs daily avg
  const el = document.getElementById('comp-daily-avg');
  if (!el) return;
  el.innerHTML = `
    <div class="compare-card-title">Hari Ini vs Rata-rata Harian</div>
    <div class="compare-row"><span class="compare-row-label">Hari Ini</span><span class="compare-row-val">${fmtIDR(todayRev)}</span></div>
    <div class="compare-row"><span class="compare-row-label">Rata-rata Harian</span><span class="compare-row-val">${fmtIDR(dailyAvg)}</span></div>
    ${deltaBadge(todayRev, dailyAvg)}
  `;
}

function renderCompareCard(id, title, rows, cur, prev) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `
    <div class="compare-card-title">${title}</div>
    ${rows.map(([label, sub, val]) => `
      <div class="compare-row">
        <span class="compare-row-label">${label}${sub ? ` <small style="opacity:.5">${sub}</small>` : ''}</span>
        <span class="compare-row-val">${fmtIDR(val)}</span>
      </div>
    `).join('')}
    ${deltaBadge(cur, prev)}
  `;
}

/** Per doc type: today vs yesterday */
function renderDocCompare() {
  const grid = document.getElementById('doc-compare-grid');
  if (!grid) return;

  const data = RAW_DATA;
  const byDate = groupBy(data, r => r.dateStr);
  const sortedDates = Object.keys(byDate).sort();
  const todayStr = sortedDates[sortedDates.length - 1] || '';
  const yestStr = sortedDates[sortedDates.length - 2] || '';

  const todayData = byDate[todayStr] || [];
  const yestData = byDate[yestStr] || [];

  grid.innerHTML = DOC_TYPES.map(t => {
    const tr = sum(todayData.filter(r => r.docType === t), 'jumlah');
    const yr = sum(yestData.filter(r => r.docType === t), 'jumlah');
    const tc = todayData.filter(r => r.docType === t).length;
    const yc = yestData.filter(r => r.docType === t).length;
    const color = DOC_COLORS[t];
    return `<div class="doc-compare-card">
      <div class="doc-compare-type" style="color:${color}">
        <span class="doc-badge badge-${t}">${t}</span>
      </div>
      <div class="compare-row"><span class="compare-row-label">Hari Ini</span><span class="compare-row-val">${fmtIDR(tr)} (${tc} dok)</span></div>
      <div class="compare-row"><span class="compare-row-label">Kemarin</span><span class="compare-row-val">${fmtIDR(yr)} (${yc} dok)</span></div>
      ${deltaBadge(tr, yr)}
    </div>`;
  }).join('');
}

/** Monthly comparison table (last 4 months) */
function renderMonthlyComparison() {
  const head = document.getElementById('monthly-compare-head');
  const tbody = document.getElementById('monthly-compare-tbody');
  if (!head || !tbody) return;

  const months = lastNMonths(RAW_DATA, 4);
  const byMonth = groupBy(RAW_DATA, r => r.monthStr);

  head.innerHTML = `<tr>
    <th>Jenis Dokumen</th>
    ${months.map(m => `<th colspan="2">${m}</th>`).join('')}
  </tr>
  <tr>
    <th></th>
    ${months.map(() => `<th>Revenue</th><th>Dok.</th>`).join('')}
  </tr>`;

  tbody.innerHTML = DOC_TYPES.map(t => {
    const cells = months.map(m => {
      const rows = (byMonth[m] || []).filter(r => r.docType === t);
      return `<td>${fmtIDR(sum(rows, 'jumlah'))}</td><td>${rows.length}</td>`;
    }).join('');
    return `<tr>
      <td><span class="doc-badge badge-${t}">${t}</span></td>
      ${cells}
    </tr>`;
  }).join('');
}

/** Monthly trend line chart (4 months, per doc type) */
function renderMonthlyTrendChart() {
  const ctx = document.getElementById('chart-monthly-trend');
  if (!ctx) return;

  const months = lastNMonths(RAW_DATA, 4);
  const byMonth = groupBy(RAW_DATA, r => r.monthStr);

  if (chartMonthlyTrend) chartMonthlyTrend.destroy();

  chartMonthlyTrend = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: months,
      datasets: DOC_TYPES.map(t => ({
        label: t,
        data: months.map(m => sum((byMonth[m] || []).filter(r => r.docType === t), 'jumlah')),
        borderColor: DOC_COLORS[t],
        backgroundColor: DOC_COLORS[t] + '20',
        borderWidth: 2,
        pointRadius: 5,
        tension: 0.3,
        fill: false,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 3,
      plugins: {
        legend: {
          labels: { color: '#6b7a7a', font: { family: 'DM Mono', size: 11 } }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtIDR(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { color: '#2a3030' }, ticks: { color: '#6b7a7a', font: { family: 'DM Mono', size: 11 } } },
        y: { grid: { color: '#2a3030' }, ticks: { color: '#6b7a7a', font: { family: 'DM Mono', size: 11 }, callback: v => fmtIDR(v) } }
      }
    }
  });
}

/** Top 10 highest and lowest revenue days */
function renderTopBottomDays() {
  const top10Tbody = document.getElementById('top10-tbody');
  const bottom10Tbody = document.getElementById('bottom10-tbody');
  if (!top10Tbody || !bottom10Tbody) return;

  const byDate = groupBy(RAW_DATA, r => r.dateStr);
  const dayStats = Object.entries(byDate).map(([date, rows]) => ({
    date,
    rev: sum(rows, 'jumlah'),
    count: rows.length,
  })).sort((a, b) => b.rev - a.rev);

  const top10 = dayStats.slice(0, 10);
  const bottom10 = [...dayStats].sort((a, b) => a.rev - b.rev).slice(0, 10);

  const renderTable = (tbody, rows) => {
    tbody.innerHTML = rows.map((d, i) => `
      <tr>
        <td class="rank-num">${i + 1}</td>
        <td>${d.date}</td>
        <td style="color:var(--accent)">${fmtIDR(d.rev)}</td>
        <td>${d.count}</td>
      </tr>
    `).join('');
  };

  renderTable(top10Tbody, top10);
  renderTable(bottom10Tbody, bottom10);
}

// ============================================================
// INIT — Auto-load Google Sheets (with Local Storage fallback)
// ============================================================
async function init() {
  // Set default filter tanggal (guarded — only exists on index.html)
  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  if (dateFromEl) dateFromEl.value = '2026-01-01';
  if (dateToEl) dateToEl.value = today();

  showLoading(true);

  // URL Export CSV dari Google Sheets Anda
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Pjo1j9s42CJ_pAnTE0VmzSNxOiTnz1_XIMlg6Z3pJsc/export?format=csv';

  try {
    setStatus('Sedang menarik data dari Google Sheets...', 'ok');

    // 1. Coba ambil data terbaru dari Google Sheets
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error('Gagal terhubung ke Google Sheets');

    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // loadData() re-renders and persists to localStorage automatically
    loadData(rows, 'Live Google Sheets');

  } catch (error) {
    console.warn('Gagal memuat Google Sheets (Mungkin offline/diblokir). Mencoba Local Storage...', error);

    // 2. FALLBACK: Jika gagal memuat dari internet, gunakan data Local Storage
    const loaded = loadRawDataFromLocalStorage();
    if (loaded) {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.remove('visible');
      initReportDatePicker();
      applyFilters();
      setStatus(`Offline Mode: Memuat ${RAW_DATA.length} baris dari memori lokal.`, 'ok');
    } else {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.add('visible');
      setStatus('Gagal memuat data. Silakan cek koneksi internet Anda.', 'err');
    }
  } finally {
    showLoading(false);
  }
}

// ============================================================
// DAILY REPORT — Date Picker Init + Report Generation
// ============================================================

/** Set report-date input to the most recent date in data, or today */
function initReportDatePicker() {
  const el = document.getElementById('report-date');
  if (!el) return;
  if (RAW_DATA.length > 0) {
    const dates = [...new Set(RAW_DATA.map(r => r.dateStr))].sort();
    el.value = dates[dates.length - 1]; // default = latest date in data
  } else {
    el.value = today();
  }
}

/** Format a date string (YYYY-MM-DD) as Indonesian long format */
function fmtDateID(dateStr) {
  if (!dateStr) return '—';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${bulan[parseInt(m) - 1]} ${y}`;
}

/** Format a month string (YYYY-MM) as Indonesian month name + year */
function fmtMonthID(monthStr) {
  if (!monthStr) return '—';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const [y, m] = monthStr.split('-');
  return `${bulan[parseInt(m) - 1]} ${y}`;
}

/** Format full IDR for report text (always full number, no M/jt shortcut) */
function fmtIDRFull(val) {
  if (!val || isNaN(val)) return 'Rp 0';
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

/** Generate the daily report text for a given date */
function generateReport(reportDateStr) {
  if (RAW_DATA.length === 0) return 'Data belum dimuat. Silakan upload file atau tunggu auto-load selesai.';

  const byDate = groupBy(RAW_DATA, r => r.dateStr);
  const sortedDates = Object.keys(byDate).sort();

  // Selected date data
  const dayData = byDate[reportDateStr] || [];

  // Find "kemarin" = closest earlier date with data
  const prevDates = sortedDates.filter(d => d < reportDateStr);
  const yestStr = prevDates.length > 0 ? prevDates[prevDates.length - 1] : null;
  const yestData = yestStr ? (byDate[yestStr] || []) : [];

  // Revenue per doc type for selected date
  const revByType = {};
  DOC_TYPES.forEach(t => {
    revByType[t] = sum(dayData.filter(r => r.docType === t), 'jumlah');
  });

  const totalToday = sum(dayData, 'jumlah');
  const totalDocs  = dayData.length;
  const totalYest  = sum(yestData, 'jumlah');

  // Delta vs kemarin
  const pctVsYest = pctChange(totalToday, totalYest);
  const deltaYestStr = pctVsYest !== null
    ? (pctVsYest >= 0 ? `+${pctVsYest.toFixed(1)}%` : `${pctVsYest.toFixed(1)}%`)
    : 'N/A';

  // Daily average (all data)
  const uniqueDays = [...new Set(RAW_DATA.map(r => r.dateStr))];
  const totalAll = sum(RAW_DATA, 'jumlah');
  const dailyAvg = uniqueDays.length > 0 ? totalAll / uniqueDays.length : 0;
  const pctVsAvg = pctChange(totalToday, dailyAvg);
  const deltaAvgStr = pctVsAvg !== null
    ? (pctVsAvg >= 0 ? `+${pctVsAvg.toFixed(1)}%` : `${pctVsAvg.toFixed(1)}%`)
    : 'N/A';

  // Monthly stats (month of selected date)
  const monthStr = reportDateStr.slice(0, 7);
  const monthData = RAW_DATA.filter(r => r.monthStr === monthStr);
  const monthTotal = sum(monthData, 'jumlah');
  const monthDocs  = monthData.length;

  // Yearly stats
  const yearStr = reportDateStr.slice(0, 4);
  const yearData = RAW_DATA.filter(r => r.yearStr === yearStr);
  const yearTotal = sum(yearData, 'jumlah');
  const yearDocs  = yearData.length;

  // Top doc type(s) today
  const topTypes = DOC_TYPES
    .filter(t => revByType[t] > 0)
    .sort((a, b) => revByType[b] - revByType[a]);
  const topType   = topTypes.length > 0 ? topTypes[0] : '—';
  const topRevStr = topTypes.length > 0 ? fmtIDRFull(revByType[topTypes[0]]) : '—';

  // Insight
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

  // Current time WIB
  const now = new Date();
  const jamWIB = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

  // Build report text
  const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const lines = [
    `📊 *LAPORAN HARIAN PENERIMAAN TERMINAL*`,
    `*Terminal 3 dan 2F- Bea Cukai Soekarno Hatta*`,
    sep,
    `📅 *Tanggal:* ${fmtDateID(reportDateStr)}`,
    ``,
    `💰 *BREAKDOWN HARI INI:*`,
    ...DOC_TYPES.map(t => `├ ${t}: ${fmtIDRFull(revByType[t])}`),
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

/** Wire up the Copy Report button */
const copyReportBtn = document.getElementById('copy-report-btn');
if (copyReportBtn) {
  copyReportBtn.addEventListener('click', async () => {
    const dateEl = document.getElementById('report-date');
    const reportDateStr = dateEl ? dateEl.value : today();

    if (!reportDateStr) {
      alert('Pilih tanggal terlebih dahulu.');
      return;
    }

    const text = generateReport(reportDateStr);

    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback('✓ Tersalin!');
    } catch {
      // Fallback for browsers that block clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopyFeedback('✓ Tersalin!');
    }
  });
}

/** Show temporary copy feedback */
let _feedbackTimer = null;
function showCopyFeedback(msg) {
  const el = document.getElementById('copy-feedback');
  if (!el) return;
  el.textContent = msg;
  clearTimeout(_feedbackTimer);
  _feedbackTimer = setTimeout(() => { el.textContent = ''; }, 3000);
}

// ============================================================
// KICK OFF
// ============================================================
init();
