/**
 * REVENUE COMMAND — Financial Dashboard
 * app.js — Shared state & utility functions
 * Loaded on every page (index.html, analysis.html, knowledge.html)
 */

// ============================================================
// STATE (shared across all pages)
// ============================================================
let RAW_DATA = [];        // All records parsed from file / Google Sheets
let FILTERED_DATA = [];   // After applying dashboard filters
let currentPage = 1;
const PAGE_SIZE = 10;
let searchQuery = '';

// Chart.js instances (kept for destroy/rebuild) — only used on pages with canvases
let chartDonut = null;
let chartTrend = null;
let chartMonthlyTrend = null;

// Document type colors
const DOC_COLORS = {
  CD:     '#5f9fe8',
  IMEI:   '#e8a438',
  PIBK:   '#4ecb8c',
  EKSPOR: '#b45fe8',
};
const DOC_TYPES = ['CD', 'IMEI', 'PIBK', 'EKSPOR'];

// localStorage key used to persist RAW_DATA across pages/offline fallback
const LOCAL_STORAGE_KEY = 'revenue_raw_data';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Format number as Indonesian currency (IDR), abbreviated for large values */
function fmtIDR(val) {
  if (val == null || isNaN(val)) return '—';

  if (val >= 1e9) {
    // Truncate to 2 decimals for Milyar (Billion)
    const truncated = Math.floor((val / 1e9) * 100) / 100;
    return 'Rp ' + truncated.toFixed(2) + 'M';
  }

  if (val >= 1e6) {
    // Truncate to 1 decimal for Juta (Million)
    const truncated = Math.floor((val / 1e6) * 10) / 10;
    return 'Rp ' + truncated.toFixed(1) + 'jt';
  }

  return 'Rp ' + Math.floor(val).toLocaleString('id-ID');
}

/** Format number with thousand separator */
function fmtNum(val) {
  if (val == null || isNaN(val)) return '—';
  return Math.round(val).toLocaleString('id-ID');
}

/** Parse date to YYYY-MM-DD string (uses local timezone, not UTC) */
function toDateStr(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
}

/** Get YYYY-MM string from date */
function toMonthStr(d) { return toDateStr(d).slice(0, 7); }

/** Get YYYY string from date */
function toYearStr(d) { return toDateStr(d).slice(0, 4); }

/** Get today's date as YYYY-MM-DD */
function today() { return toDateStr(new Date()); }

/** Compute delta percentage */
function pctChange(cur, prev) {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Render a delta badge (HTML string) */
function deltaBadge(cur, prev) {
  const pct = pctChange(cur, prev);
  if (pct === null) return '<span class="compare-delta delta-flat">—</span>';
  const sign = pct >= 0 ? '+' : '';
  const cls = pct >= 0 ? 'delta-up' : 'delta-down';
  const arrow = pct >= 0 ? '▲' : '▼';
  return `<span class="compare-delta ${cls}">${arrow} ${sign}${pct.toFixed(1)}%</span>`;
}

/** Sum a field in an array of records */
function sum(arr, field) {
  return arr.reduce((s, r) => s + (r[field] || 0), 0);
}

/** Group records by a key function */
function groupBy(arr, keyFn) {
  return arr.reduce((acc, r) => {
    const k = keyFn(r);
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
}

/** Get last N distinct date values from data (sorted ascending) */
function lastNDates(data, n) {
  const dates = [...new Set(data.map(r => toDateStr(r.date)))].sort().reverse();
  return dates.slice(0, n).reverse();
}

/** Get last N months (YYYY-MM) prior to most recent month in data */
function lastNMonths(data, n) {
  const months = [...new Set(data.map(r => toMonthStr(r.date)))].sort();
  return months.slice(-n);
}

/** Show/hide loading overlay (no-op if not present on this page) */
function showLoading(on) {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('visible', on);
}

/** Update data status bar (no-op if not present on this page) */
function setStatus(msg, type = '') {
  const el = document.getElementById('data-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'data-status' + (type ? ' ' + type : '');
}

/** Set textContent on an element by id, no-op if missing */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// LOCAL STORAGE PERSISTENCE (lets analysis.html / knowledge.html
// share the same RAW_DATA without re-fetching, and provides an
// offline fallback if the live Google Sheets fetch fails)
// ============================================================

/** Save RAW_DATA to localStorage so other pages / reloads can reuse it */
function saveRawDataToLocalStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(RAW_DATA));
  } catch (e) {
    console.warn('Could not save data to localStorage:', e);
  }
}

/** Load RAW_DATA from localStorage. Returns true if data was found & loaded. */
function loadRawDataFromLocalStorage() {
  const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!savedData) return false;
  try {
    const parsed = JSON.parse(savedData);
    RAW_DATA = parsed.map(r => {
      if (r.date) r.date = new Date(r.date);
      return r;
    });
    return true;
  } catch (e) {
    console.warn('Could not parse localStorage data:', e);
    return false;
  }
}
