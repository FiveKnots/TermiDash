// ============================================================
// COMMODITY VIEW COMPONENT
// ============================================================

export const CommodityView = () => {
  return `
    <div id="tab-commodity" class="tab-panel">
      <div class="section-box">
        <div class="chart-header">
          <span class="chart-title">COMMODITY REPORT</span>
        </div>
        <div class="empty-state visible" style="padding: 40px 0;">
          <div class="empty-icon">⚙</div>
          <p class="empty-title">Under Construction</p>
          <p class="empty-sub">The Commodity Report module is currently being developed.</p>
        </div>
      </div>
    </div>
  `;
};

export const initCommodity = (appState) => {
  // Logic for your commodity report will go here later
  console.log("Commodity View Initialized");
};
