// ============================================================
// COMMODITY VIEW COMPONENT
// ============================================================

export const CommodityView = () => {
  return `
    <div id="tab-commodity" class="tab-panel active">
      
      <!-- KPI GRID -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">TOP HS CODE (VOLUME)</div>
          <div class="kpi-value" id="kpi-top-hs">—</div>
          <div class="kpi-sub" id="kpi-top-hs-desc">—</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">TOP ORIGIN PORT</div>
          <div class="kpi-value" id="kpi-top-port">—</div>
          <div class="kpi-sub" id="kpi-top-port-vol">— items</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">AVG CUSTOMS VALUE / ITEM</div>
          <div class="kpi-value" id="kpi-avg-val">—</div>
          <div class="kpi-sub">Across all commodities</div>
        </div>
        <div class="kpi-card accent">
          <div class="kpi-label">HIGHEST SINGLE ITEM VALUE</div>
          <div class="kpi-value" id="kpi-high-val">—</div>
          <div class="kpi-sub" id="kpi-high-desc">—</div>
        </div>
      </div>

      <!-- CHARTS -->
      <div class="charts-row">
        <div class="chart-box" style="flex: 2; min-width: 320px;">
          <div class="chart-header"><span class="chart-title">TOP 5 HS CODES (BY VOLUME)</span></div>
          <canvas id="chart-hs-bar"></canvas>
        </div>
        <div class="chart-box" style="flex: 1; min-width: 280px;">
          <div class="chart-header"><span class="chart-title">COMMODITY ORIGINS</span></div>
          <div class="donut-wrap" style="justify-content: center;">
            <div class="donut-chart-container">
                <canvas id="chart-origin-doughnut"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- JASTIP / PASSENGER PROFILING TABLE -->
      <div class="section-box">
        <div class="chart-header"><span class="chart-title">PASSENGER & COMMODITY PROFILING (JASTIP INDICATORS)</span></div>
        <div class="table-scroll">
          <table class="detail-table">
            <thead>
              <tr>
                <th>Passenger Name</th>
                <th>Passport</th>
                <th>Flight / Route</th>
                <th>Commodity Desc</th>
                <th>Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody id="profiling-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- COMMODITY BREAKDOWN TABLE -->
      <div class="section-box">
        <div class="chart-header"><span class="chart-title">ITEM-LEVEL REVENUE BREAKDOWN</span></div>
        <div class="table-scroll">
          <table class="detail-table">
            <thead>
              <tr>
                <th>HS Code</th>
                <th>Commodity Desc</th>
                <th>Nilai Pabean</th>
                <th>Pembebasan</th>
                <th>Estimasi BM</th>
              </tr>
            </thead>
            <tbody id="breakdown-tbody"></tbody>
          </table>
        </div>
      </div>
      
    </div>
  `;
};

export const initCommodity = async (appState) => {
  console.log("Commodity View Initialized");

  // Utilities
  const fmtIDR = (val) => {
    if (val == null || isNaN(val)) return '—';
    return 'Rp ' + Math.floor(val).toLocaleString('id-ID');
  };

  const groupBy = (arr, key) => {
    return arr.reduce((acc, curr) => {
      (acc[curr[key]] = acc[curr[key]] || []).push(curr);
      return acc;
    }, {});
  };

  let flattenedItems = [];
  let chartHsBar = null;
  let chartOriginDoughnut = null;

  try {
    // Fetch data using the provided JSON file structure
    const response = await fetch('Structure.json');
    const rawData = await response.json();

    // Flatten Data
    rawData.forEach(doc => {
      const passengerName = doc.importir?.data?.nama || 'Unknown';
      const passport = doc.importir?.data?.no_paspor || 'Unknown';
      const originPort = doc.pelabuhan_asal?.data?.nama || 'Unknown';
      const originCode = doc.pelabuhan_asal?.data?.kode || 'Unknown';
      const airline = doc.airline?.data?.kode || 'Unknown';
      const flightNum = doc.no_flight || 'Unknown';

      if (doc.details && doc.details.data) {
        doc.details.data.forEach(item => {
          flattenedItems.push({
            no_dok: doc.nomor_lengkap,
            passengerName,
            passport,
            originPort,
            originCode,
            route: `${airline} - ${flightNum} (${originCode})`,
            hsCode: item.hs?.data?.kode || 'Unknown',
            desc: item.uraian || 'Unknown',
            qty: parseFloat(item.jumlah_satuan) || 0,
            unit: item.satuan?.data?.kode || item.jenis_satuan || 'PCE',
            customsValue: parseFloat(item.nilai_pabean) || 0,
            exemption: parseFloat(item.pembebasan) || 0,
            bmTariff: parseFloat(item.hs?.data?.bm_tarif) || 0
          });
        });
      }
    });

    renderDashboard();
  } catch (error) {
    console.error("Failed to load commodity data", error);
    const topHsEl = document.getElementById('kpi-top-hs');
    if (topHsEl) topHsEl.textContent = 'Data Error';
  }

  function renderDashboard() {
    if (flattenedItems.length === 0) return;

    // KPI: Top HS
    const hsGroups = groupBy(flattenedItems, 'hsCode');
    let topHs = { code: '-', vol: 0, desc: '-' };
    for (const [code, items] of Object.entries(hsGroups)) {
      const totalVol = items.reduce((sum, i) => sum + i.qty, 0);
      if (totalVol > topHs.vol) {
        topHs = { code, vol: totalVol, desc: items[0].desc };
      }
    }
    document.getElementById('kpi-top-hs').textContent = topHs.code;
    document.getElementById('kpi-top-hs-desc').textContent = `${topHs.desc} (${topHs.vol} items)`;

    // KPI: Top Port
    const portGroups = groupBy(flattenedItems, 'originPort');
    let topPort = { name: '-', count: 0 };
    for (const [name, items] of Object.entries(portGroups)) {
      if (items.length > topPort.count) topPort = { name, count: items.length };
    }
    document.getElementById('kpi-top-port').textContent = topPort.name;
    document.getElementById('kpi-top-port-vol').textContent = `${topPort.count} items recorded`;

    // KPI: Avg Value
    const totalValue = flattenedItems.reduce((sum, item) => sum + item.customsValue, 0);
    document.getElementById('kpi-avg-val').textContent = fmtIDR(totalValue / flattenedItems.length);

    // KPI: Highest Value
    const highestItem = flattenedItems.reduce((prev, curr) => (prev.customsValue > curr.customsValue) ? prev : curr);
    document.getElementById('kpi-high-val').textContent = fmtIDR(highestItem.customsValue);
    document.getElementById('kpi-high-desc').textContent = highestItem.desc;

    // Table 1: Profiling
    const profileHtml = flattenedItems.map(item => `
      <tr>
        <td style="font-weight:600; color:var(--text)">${item.passengerName}</td>
        <td>${item.passport}</td>
        <td><span class="doc-badge" style="background:var(--bg-3); border:1px solid var(--border-2);">${item.route}</span></td>
        <td>${item.desc}</td>
        <td style="color:var(--accent); font-weight:bold;">${item.qty}</td>
        <td>${item.unit}</td>
      </tr>
    `).join('');
    document.getElementById('profiling-tbody').innerHTML = profileHtml;

    // Table 2: Breakdown
    const breakdownHtml = flattenedItems.map(item => {
      // Calculate basis by deducting exemption from customs value for each item first
      const basisValue = Math.max(0, item.customsValue - item.exemption);
      const estimasiBm = basisValue * (item.bmTariff / 100);
      
      return `
      <tr>
        <td style="color:var(--text-dim)">${item.hsCode}</td>
        <td>${item.desc}</td>
        <td>${fmtIDR(item.customsValue)}</td>
        <td>${fmtIDR(item.exemption)}</td>
        <td style="color:var(--green); font-weight:bold;">${fmtIDR(estimasiBm)}</td>
      </tr>
    `}).join('');
    document.getElementById('breakdown-tbody').innerHTML = breakdownHtml;

    // Charts Configuration
    Chart.defaults.color = '#6b7a7a';
    Chart.defaults.font.family = 'DM Mono';

    // Bar Chart
    const hsData = Object.keys(hsGroups).map(code => ({
      code: code,
      vol: hsGroups[code].reduce((sum, i) => sum + i.qty, 0)
    })).sort((a, b) => b.vol - a.vol).slice(0, 5);

    if (chartHsBar) chartHsBar.destroy();
    chartHsBar = new Chart(document.getElementById('chart-hs-bar'), {
      type: 'bar',
      data: {
        labels: hsData.map(d => d.code),
        datasets: [{
          label: 'Total Qty',
          data: hsData.map(d => d.vol),
          backgroundColor: '#e8a438',
          borderRadius: 4
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false,
        scales: { 
          y: { grid: { color: '#2a3030' } }, 
          x: { grid: { display: false } } 
        } 
      }
    });

    // Doughnut Chart
    const portLabels = Object.keys(portGroups);
    const portData = portLabels.map(code => portGroups[code].length);
    
    if (chartOriginDoughnut) chartOriginDoughnut.destroy();
    chartOriginDoughnut = new Chart(document.getElementById('chart-origin-doughnut'), {
      type: 'doughnut',
      data: {
        labels: portLabels,
        datasets: [{
          data: portData,
          backgroundColor: ['#5f9fe8', '#4ecb8c', '#e85f5f', '#b45fe8', '#e8a438'],
          borderWidth: 0
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false, 
        cutout: '70%', 
        plugins: { 
          legend: { position: 'right', labels: {color: '#6b7a7a'} } 
        } 
      }
    });
  }
};
