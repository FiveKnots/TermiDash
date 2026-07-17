import { fmtIDR, sum, groupBy, today, toDateStr, toMonthStr, lastNMonths, deltaBadge } from '../utils.js';
import { renderMonthlyTrendChart } from '../charts.js';

// ============================================================
// HTML TEMPLATE
// ============================================================
export const AnalysisView = () => {
  return `
    <div id="tab-analysis" class="tab-panel">
      
      <!-- COMPARATIVE INSIGHTS -->
      <div class="section-box">
        <div class="chart-header"><span class="chart-title">PERBANDINGAN PERIODE</span></div>
        <div class="compare-grid">
          <div class="compare-card" id="comp-today"></div>
          <div class="compare-card" id="comp-week"></div>
          <div class="compare-card" id="comp-month"></div>
          <div class="compare-card" id="comp-daily-avg"></div>
        </div>
      </div>

      <!-- PER DOKUMEN TYPE ANALYSIS -->
      <div class="section-box">
        <div class="chart-header"><span class="chart-title">ANALISIS PER JENIS DOKUMEN — HARI INI vs KEMARIN</span></div>
        <div class="doc-compare-grid" id="doc-compare-grid"></div>
      </div>

      <!-- MONTHLY TREND PER DOC TYPE -->
      <div class="charts-row">
        <div class="chart-box" style="flex:1">
          <div class="chart-header"><span class="chart-title">TREN BULANAN PER JENIS DOKUMEN (4 BULAN)</span></div>
          <canvas id="chart-monthly-trend"></canvas>
        </div>
      </div>

      <!-- MONTHLY COMPARISON TABLE -->
      <div class="section-box">
        <div class="chart-header"><span class="chart-title">PERBANDINGAN BULANAN PER JENIS DOKUMEN (4 BULAN TERAKHIR)</span></div>
        <div class="mobile-scroll">
          <table class="breakdown-table">
            <thead id="monthly-compare-head"></thead>
            <tbody id="monthly-compare-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- TOP/BOTTOM DAYS -->
      <div class="charts-row">
        <div class="section-box" style="flex:1">
          <div class="chart-header"><span class="chart-title">🏆 TOP 10 HARI TERTINGGI</span></div>
          <div class="mobile-scroll">
            <table class="breakdown-table">
              <thead><tr><th>Rank</th><th>Tanggal</th><th>Revenue</th><th>Dok.</th></tr></thead>
              <tbody id="top10-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="section-box" style="flex:1">
          <div class="chart-header"><span class="chart-title">📉 TOP 10 HARI TERENDAH</span></div>
          <div class="mobile-scroll">
            <table class="breakdown-table">
              <thead><tr><th>Rank</th><th>Tanggal</th><th>Revenue</th><th>Dok.</th></tr></thead>
              <tbody id="bottom10-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  `;
};

// ============================================================
// VIEW LOGIC
// ============================================================

export const initAnalysis = (appState) => {
  if (appState.rawData.length === 0) return;

  renderComparisons(appState);
  renderDocCompare(appState);
  renderMonthlyComparison(appState);
  
  // Render Chart via charts.js
  appState.charts.monthlyTrend = renderMonthlyTrendChart(
    appState.rawData, 
    appState.docTypes, 
    appState.docColors, 
    appState.charts.monthlyTrend
  );

  renderTopBottomDays(appState);
};

// ============================================================
// RENDERERS
// ============================================================

function renderComparisons(appState) {
  const data = appState.rawData; // Use full raw data for time-based comparisons
  const byDate = groupBy(data, r => r.dateStr);
  const sortedDates = Object.keys(byDate).sort();

  // Get the most recent dates available
  const todayStr = sortedDates[sortedDates.length - 1] || today();
  const yesterdayStr = sortedDates[sortedDates.length - 2] || '';

  const todayRev = sum(byDate[todayStr] || [], 'jumlah');
  const yestRev = sum(byDate[yesterdayStr] || [], 'jumlah');

  // Current week vs last week
  const refDate = new Date(todayStr);
  const dayOfWeek = refDate.getDay();
  const weekStart = new Date(refDate); 
  weekStart.setDate(refDate.getDate() - dayOfWeek);
  
  const lastWeekStart = new Date(weekStart); 
  lastWeekStart.setDate(weekStart.getDate() - 7);

  const weekData = data.filter(r => r.date >= weekStart && r.date <= refDate);
  const lastWeekData = data.filter(r => r.date >= lastWeekStart && r.date < weekStart);
  
  const weekRev = sum(weekData, 'jumlah');
  const lastWeekRev = sum(lastWeekData, 'jumlah');

  // Current month vs last month
  const curMonthStr = todayStr.slice(0, 7);
  const prevMonthDate = new Date(refDate); 
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
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
  if (el) {
    el.innerHTML = `
      <div class="compare-card-title">Hari Ini vs Rata-rata Harian</div>
      <div class="compare-row"><span class="compare-row-label">Hari Ini</span><span class="compare-row-val">${fmtIDR(todayRev)}</span></div>
      <div class="compare-row"><span class="compare-row-label">Rata-rata Harian</span><span class="compare-row-val">${fmtIDR(dailyAvg)}</span></div>
      ${deltaBadge(todayRev, dailyAvg)}
    `;
  }
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

function renderDocCompare(appState) {
  const data = appState.rawData;
  const byDate = groupBy(data, r => r.dateStr);
  const sortedDates = Object.keys(byDate).sort();
  const todayStr = sortedDates[sortedDates.length - 1] || '';
  const yestStr = sortedDates[sortedDates.length - 2] || '';

  const todayData = byDate[todayStr] || [];
  const yestData = byDate[yestStr] || [];

  const grid = document.getElementById('doc-compare-grid');
  if (!grid) return;

  grid.innerHTML = appState.docTypes.map(t => {
    const tr = sum(todayData.filter(r => r.docType === t), 'jumlah');
    const yr = sum(yestData.filter(r => r.docType === t), 'jumlah');
    const tc = todayData.filter(r => r.docType === t).length;
    const yc = yestData.filter(r => r.docType === t).length;
    const color = appState.docColors[t];
    
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

function renderMonthlyComparison(appState) {
  const months = lastNMonths(appState.rawData, 4);
  const byMonth = groupBy(appState.rawData, r => r.monthStr);

  const head = document.getElementById('monthly-compare-head');
  const tbody = document.getElementById('monthly-compare-tbody');
  if (!head || !tbody) return;

  head.innerHTML = `<tr>
    <th>Jenis Dokumen</th>
    ${months.map(m => `<th colspan="2">${m}</th>`).join('')}
  </tr>
  <tr>
    <th></th>
    ${months.map(() => `<th>Revenue</th><th>Dok.</th>`).join('')}
  </tr>`;

  tbody.innerHTML = appState.docTypes.map(t => {
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

function renderTopBottomDays(appState) {
  const byDate = groupBy(appState.rawData, r => r.dateStr);
  const dayStats = Object.entries(byDate).map(([date, rows]) => ({
    date,
    rev: sum(rows, 'jumlah'),
    count: rows.length,
  })).sort((a, b) => b.rev - a.rev);

  const top10 = dayStats.slice(0, 10);
  const bottom10 = [...dayStats].sort((a, b) => a.rev - b.rev).slice(0, 10);

  const renderTable = (tbody, rows) => {
    if(!tbody) return;
    tbody.innerHTML = rows.map((d, i) => `
      <tr>
        <td class="rank-num">${i + 1}</td>
        <td>${d.date}</td>
        <td style="color:var(--accent)">${fmtIDR(d.rev)}</td>
        <td>${d.count}</td>
      </tr>
    `).join('');
  };

  renderTable(document.getElementById('top10-tbody'), top10);
  renderTable(document.getElementById('bottom10-tbody'), bottom10);
}
