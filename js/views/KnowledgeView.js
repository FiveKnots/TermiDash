import { fetchKnowledgeRepo, saveKnowledgeRepo } from '../api.js';

// ============================================================
// LOCAL STATE
// ============================================================
let repoData = [];
let editingRepoId = null;

// ============================================================
// HTML TEMPLATE
// ============================================================
export const KnowledgeView = () => {
  return `
    <div id="tab-knowledge" class="tab-panel">
      
      <div class="section-box">
        <div class="chart-header">
          <span class="chart-title">MANAGE REPOSITORY FILES & LINKS</span>
        </div>
        
        <!-- Input Form -->
        <div class="repo-form">
          <div class="repo-input-group">
            <label>JUDUL DOKUMEN</label>
            <input type="text" id="repo-title" class="filter-input" placeholder="e.g., Aturan Klasifikasi Jastip..." style="width: 100%;" />
          </div>
          <div class="repo-input-group">
            <label>KATEGORI</label>
            <select id="repo-category" class="filter-input" style="width: 100%;">
              <option value="SOP Internal">SOP Internal</option>
              <option value="Legal / Peraturan">Legal / Peraturan</option>
              <option value="Academic Research">Academic Research</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div class="repo-input-group">
            <label>LINK / URL</label>
            <input type="text" id="repo-url" class="filter-input" placeholder="https://..." style="width: 100%;" />
          </div>
          <button class="apply-btn" id="repo-save-btn" style="margin-top: 18px;">+ Add Document</button>
        </div>
      </div>

      <!-- Data Table -->
      <div class="section-box">
        <div class="chart-header">
          <span class="chart-title">DAFTAR REFERENSI</span>
        </div>
        <div class="table-scroll">
          <table class="detail-table">
            <thead>
              <tr>
                <th style="width: 50px;">No</th>
                <th>Judul Dokumen</th>
                <th>Kategori</th>
                <th>Link Tautan</th>
                <th style="text-align: center;">Aksi</th>
              </tr>
            </thead>
            <tbody id="repo-tbody">
              <!-- Rows will be populated dynamically -->
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
};

// ============================================================
// VIEW LOGIC & INITIALIZATION
// ============================================================

export const initKnowledge = async () => {
  // 1. Fetch initial data from Cloud
  repoData = await fetchKnowledgeRepo();
  renderRepoTable();

  // 2. Bind Save Button
  const saveBtn = document.getElementById('repo-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSave);
  }

  // 3. Bind Edit/Delete buttons using Event Delegation
  // This is the modern way to handle dynamic elements in modules
  const tbody = document.getElementById('repo-tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('edit-btn')) {
        const id = parseInt(target.dataset.id, 10);
        handleEdit(id);
      } else if (target.classList.contains('delete-btn')) {
        const id = parseInt(target.dataset.id, 10);
        handleDelete(id);
      }
    });
  }
};

// ============================================================
// RENDERERS & EVENT HANDLERS
// ============================================================

function renderRepoTable() {
  const tbody = document.getElementById('repo-tbody');
  if (!tbody) return;

  if (repoData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Repository kosong.</td></tr>`;
    return;
  }

  tbody.innerHTML = repoData.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td style="font-weight: 500; color: var(--text);">${item.title}</td>
      <td><span class="doc-badge" style="background: var(--bg-3); border: 1px solid var(--border-2);">${item.category}</span></td>
      <td><a href="${item.url}" target="_blank" class="repo-link">Buka Tautan ↗</a></td>
      <td style="text-align: center;">
        <button class="repo-action-btn edit-btn" data-id="${item.id}">Edit</button>
        <button class="repo-action-btn delete delete-btn" data-id="${item.id}">Del</button>
      </td>
    </tr>
  `).join('');
}

async function handleSave() {
  const titleInput = document.getElementById('repo-title');
  const categoryInput = document.getElementById('repo-category');
  const urlInput = document.getElementById('repo-url');
  const saveBtn = document.getElementById('repo-save-btn');

  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const url = urlInput.value.trim();

  if (!title || !url) { 
    alert("Judul dan Link URL wajib diisi!"); 
    return; 
  }

  // Visual feedback while saving
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  try {
    if (editingRepoId !== null) {
      // Update existing record
      const index = repoData.findIndex(r => r.id === editingRepoId);
      if (index !== -1) {
        repoData[index] = { id: editingRepoId, title, category, url };
      }
      editingRepoId = null;
    } else {
      // Create new record
      const newId = repoData.length > 0 ? Math.max(...repoData.map(r => r.id)) + 1 : 1;
      repoData.push({ id: newId, title, category, url });
    }

    // Persist to JSONBin
    await saveKnowledgeRepo(repoData);
    
    // Clear form and re-render
    titleInput.value = '';
    urlInput.value = '';
    renderRepoTable();
  } catch (error) {
    alert("Terjadi kesalahan saat menyimpan data ke cloud.");
  } finally {
    // Reset button state
    saveBtn.textContent = "+ Add Document";
    saveBtn.disabled = false;
  }
}

function handleEdit(id) {
  const item = repoData.find(r => r.id === id);
  if (!item) return;
  
  document.getElementById('repo-title').value = item.title;
  document.getElementById('repo-category').value = item.category;
  document.getElementById('repo-url').value = item.url;
  
  editingRepoId = id;
  const saveBtn = document.getElementById('repo-save-btn');
  if (saveBtn) {
    saveBtn.textContent = "✓ Update Document";
  }
}

async function handleDelete(id) {
  if (!confirm("Hapus dokumen ini dari repository?")) return;

  // Optimistically remove from local state
  const previousData = [...repoData];
  repoData = repoData.filter(r => r.id !== id);
  renderRepoTable();

  try {
    // Persist deletion to JSONBin
    await saveKnowledgeRepo(repoData);
  } catch (error) {
    // Revert if cloud save fails
    alert("Gagal menghapus data di cloud.");
    repoData = previousData;
    renderRepoTable();
  }
}
