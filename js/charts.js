import { fmtIDR, groupBy, sum, lastNDates, lastNMonths } from './utils.js';

// ============================================================
// DONUT CHART — Revenue Proportion by Doc Type
// ============================================================
export const renderDonutChart = (data, docTypes, docColors, existingChart) => {
  const byType = groupBy(data, r => r.docType);
  const total = sum(data, 'jumlah') || 1;
  const labels = docTypes.filter(t => byType[t]);
  const values = labels.map(t => sum(byType[t] || [], 'jumlah'));
  const colors = labels.map(t => docColors[t] || '#666');

  // Destroy old instance to prevent canvas ghosting
  if (existingChart) existingChart.destroy();

  const canvas = document.getElementById('chart-donut');
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  
  // Note: Chart is accessed via window object since it's loaded via CDN in index.html
  const newChart = new window.Chart(ctx, {
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

  // Render Custom HTML Legend
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

  return newChart;
};

// ============================================================
// TREND CHART — Last 7 Days
// ============================================================
export const renderTrendChart = (data, existingChart) => {
  const dates = lastNDates(data, 7);
  if (dates.length === 0) return existingChart;

  const byDate = groupBy(data.filter(r => dates.includes(r.dateStr)), r => r.dateStr);
  const values = dates.map(d => sum(byDate[d] || [], 'jumlah'));
  const labels = dates.map(d => d.slice(5)); // Extract MM-DD

  if (existingChart) existingChart.destroy();

  const canvas = document.getElementById('chart-trend');
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');

  // Create Amber Gradient Fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(232,164,56,0.3)');
  gradient.addColorStop(1, 'rgba(232,164,56,0.0)');

  return new window.Chart(ctx, {
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
};

// ============================================================
// MONTHLY TREND CHART — Per Doc Type (4 Months)
// ============================================================
export const renderMonthlyTrendChart = (data, docTypes, docColors, existingChart) => {
  const months = lastNMonths(data, 4);
  const byMonth = groupBy(data, r => r.monthStr);

  if (existingChart) existingChart.destroy();

  const canvas = document.getElementById('chart-monthly-trend');
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');

  return new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: docTypes.map(t => ({
        label: t,
        data: months.map(m => sum((byMonth[m] || []).filter(r => r.docType === t), 'jumlah')),
        borderColor: docColors[t],
        backgroundColor: docColors[t] + '20',
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
};
