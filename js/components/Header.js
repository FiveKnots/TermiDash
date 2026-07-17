// ============================================================
// HEADER COMPONENT
// ============================================================

export const Header = () => {
  return `
    <header class="header">
      <div class="header-left">
        <div class="logo-mark">▪</div>
        <div>
          <h1 class="header-title">DASHBOARD TERMINAL</h1>
          <p class="header-sub">KPU BEA CUKAI TIPE C SOEKARNO-HATTA</p>
        </div>
      </div>
      <div class="header-right">
        <span class="live-badge">● LIVE DATA</span>
        <span id="last-updated" class="last-updated">—</span>
      </div>
    </header>
  `;
};
