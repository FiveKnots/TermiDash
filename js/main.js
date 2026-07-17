import { Header } from './components/Header.js';
import { Navigation, initNavigation } from './components/Navigation.js';
import { DashboardView, initDashboard, applyFilters } from './views/DashboardView.js';
import { AnalysisView, initAnalysis } from './views/AnalysisView.js';
import { KnowledgeView, initKnowledge } from './views/KnowledgeView.js';
import { fetchGoogleSheetsData } from './api.js';
import { parseRows, today } from './utils.js';
import { CommodityView, initCommodity } from './views/CommodityView.js';

// ============================================================
// GLOBAL STATE
// ============================================================
export const appState = {
  rawData: [],
  filteredData: [],
  searchQuery: '',
  currentPage: 1,
  PAGE_SIZE: 10,
  docColors: {
    CD: '#5f9fe8',
    IMEI: '#e8a438',
    PIBK: '#4ecb8c',
    EKSPOR: '#b45fe8'
  },
  docTypes: ['CD', 'IMEI', 'PIBK', 'EKSPOR'],
  
  // Chart instances to destroy/rebuild
  charts: {
    donut: null,
    trend: null,
    monthlyTrend: null
  }
};

// ============================================================
// APP INITIALIZATION
// ============================================================

/** Construct the base DOM layout */
const renderApp = () => {
  const appContainer = document.getElementById('app');
  appContainer.innerHTML = `
    ${Header()}
    ${Navigation()}
    ${DashboardView()}
    ${AnalysisView()}
    ${KnowledgeView()}
    ${CommodityView()}
    
    <!-- Empty State -->
    <div id="empty-state" class="empty-state visible">
      <div class="empty-icon">◈</div>
      <p class="empty-title">No Data Loaded</p>
      <p class="empty-sub">Connecting to Google Sheets...</p>
    </div>

    <!-- Loading overlay -->
    <div id="loading-overlay" class="loading-overlay">
      <div class="loading-spinner">Loading data…</div>
    </div>
  `;
};

/** Set status message in the UI (if you add the data-bar back) */
const setStatus = (msg, type = '') => {
  const el = document.getElementById('data-status');
  if (el) {
    el.textContent = msg;
    el.className = 'data-status' + (type ? ' ' + type : '');
  }
};

/** Process fetched rows and trigger view rendering */
const loadData = (rows, label) => {
  const parsed = parseRows(rows);
  if (parsed.length === 0) {
    setStatus('No valid rows found. Check column names.', 'err');
    return;
  }

  appState.rawData = parsed.sort((a, b) => a.date - b.date);
  
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = 'Loaded: ' + new Date().toLocaleTimeString('id-ID');
  }
  
  setStatus(`✓ ${label} loaded — ${parsed.length} records`, 'ok');

  // Set default date range based on data
  const dates = appState.rawData.map(r => r.dateStr).sort();
  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  
  if (dateFromEl) dateFromEl.value = '2026-01-01'; // Defaulting to start of your current operational year
  if (dateToEl) dateToEl.value = today();

  // Hide empty state
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.classList.remove('visible');

  // Initialize view logic
  initDashboard(appState);
  initAnalysis(appState);
};

/** Main Application Bootstrapper */
const initApp = async () => {
  renderApp();
  
  // Setup Tab Navigation
  initNavigation((targetTab) => {
    // Re-render analysis charts when switching to it (fixes canvas sizing bugs when hidden)
    if (targetTab === 'analysis' && appState.rawData.length > 0) {
      initAnalysis(appState);
    }
  });

  // Initialize Knowledge Repository interactions
  initKnowledge();

  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.classList.add('visible');

  // Fetch Data from Google Sheets
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Pjo1j9s42CJ_pAnTE0VmzSNxOiTnz1_XIMlg6Z3pJsc/export?format=csv";

  try {
    const rawRows = await fetchGoogleSheetsData(SHEET_URL);
    loadData(rawRows, "Live Google Sheets");
    
    // Save to local storage for offline fallback
    localStorage.setItem('revenue_raw_data', JSON.stringify(appState.rawData));
    
  } catch (error) {
    console.warn("Gagal memuat Google Sheets (Mungkin offline/diblokir). Mencoba Local Storage...", error);
    
    // Fallback: Local Storage
    const savedData = localStorage.getItem('revenue_raw_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        appState.rawData = parsed.map(r => {
          if (r.date) r.date = new Date(r.date);
          return r;
        });

        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.classList.remove('visible');
        
        // Use default dates
        const dateFromEl = document.getElementById('date-from');
        const dateToEl = document.getElementById('date-to');
        if (dateFromEl) dateFromEl.value = '2026-01-01';
        if (dateToEl) dateToEl.value = today();

        initDashboard(appState);
        initAnalysis(appState);
        
        setStatus(`Offline Mode: Memuat ${appState.rawData.length} baris dari memori lokal.`, 'ok');
      } catch (e) {
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.classList.add('visible');
      }
    } else {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.add('visible');
      setStatus("Gagal memuat data. Silakan cek koneksi internet Anda.", "err");
    }
  } finally {
    if (loadingOverlay) loadingOverlay.classList.remove('visible');
  }
};

// Boot the app when the DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
