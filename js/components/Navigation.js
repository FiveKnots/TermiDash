// ============================================================
// NAVIGATION COMPONENT
// ============================================================

/**
 * Returns the HTML string for the Tab Navigation
 */
export const Navigation = () => {
  return `
    <nav class="tab-nav">
      <button class="tab-btn active" data-tab="dashboard">01 — Main Dashboard</button>
      <button class="tab-btn" data-tab="analysis">02 — Analysis</button>
      <button class="tab-btn" data-tab="knowledge">03 — Knowledge Repository</button>
      <button class="tab-btn" data-tab="commodity">04 — Commodity Report</button>
    </nav>
  `;
};

/**
 * Initializes the tab switching logic
 * @param {Function} onTabChangeCallback - Optional callback executed after a tab changes
 */
export const initNavigation = (onTabChangeCallback) => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // 1. Remove active class from all buttons and panels
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      
      // 2. Add active class to the clicked button and its corresponding panel
      const targetTab = e.target.dataset.tab;
      e.target.classList.add('active');
      
      const targetPanel = document.getElementById(`tab-${targetTab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      // 3. Trigger callback if provided (useful for re-rendering charts that were hidden)
      if (typeof onTabChangeCallback === 'function') {
        onTabChangeCallback(targetTab);
      }
    });
  });
};
