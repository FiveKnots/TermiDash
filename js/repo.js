/**
 * REVENUE COMMAND — Financial Dashboard
 * repo.js — Knowledge Repository cloud sync (JSONBin.io)
 * Only does anything on pages that have a #repo-tbody (knowledge.html)
 */

// 1. CONFIGURATION — Replace with your own JSONBin.io credentials
const BIN_ID = '6a58741cf5f4af5e299602e3';     // Get this from your JSONBin.io dashboard
const MASTER_KEY = '$2a$10$mpEqQgMdc.1wQV.yIvNaaufcuHdBY1eCZJueBmT6x3gjGuzJ3DBBW'; // Get this from your API Keys page

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let repoData = [];
let editingRepoId = null;

// 2. Load from JSONBin.io
async function loadRepoData() {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    const json = await response.json();
    repoData = json.record || [];
    renderRepoTable();
  } catch (error) {
    console.error('Error loading from Cloud:', error);
  }
}

// 3. Save to JSONBin.io
async function saveRepoData() {
  try {
    await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(repoData)
    });
  } catch (error) {
    console.error('Error saving to Cloud:', error);
  }
}

// 4. Update UI
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
        <button class="repo-action-btn" onclick="editRepo(${item.id})">Edit</button>
        <button class="repo-action-btn delete" onclick="deleteRepo(${item.id})">Del</button>
      </td>
    </tr>
  `).join('');
}

// 5. Handle Add / Update
const repoSaveBtn = document.getElementById('repo-save-btn');
if (repoSaveBtn) {
  repoSaveBtn.addEventListener('click', async () => {
    const title = document.getElementById('repo-title').value.trim();
    const category = document.getElementById('repo-category').value;
    const url = document.getElementById('repo-url').value.trim();

    if (!title || !url) { alert('Judul dan Link URL wajib diisi!'); return; }

    if (editingRepoId !== null) {
      const index = repoData.findIndex(r => r.id === editingRepoId);
      repoData[index] = { id: editingRepoId, title, category, url };
      editingRepoId = null;
      repoSaveBtn.textContent = '+ Add Document';
    } else {
      const newId = repoData.length > 0 ? Math.max(...repoData.map(r => r.id)) + 1 : 1;
      repoData.push({ id: newId, title, category, url });
    }

    document.getElementById('repo-title').value = '';
    document.getElementById('repo-url').value = '';

    await saveRepoData(); // Sync to cloud
    renderRepoTable();
  });
}

// Helper functions for Edit/Delete (exposed globally for inline onclick handlers)
window.editRepo = function (id) {
  const item = repoData.find(r => r.id === id);
  if (!item) return;
  document.getElementById('repo-title').value = item.title;
  document.getElementById('repo-category').value = item.category;
  document.getElementById('repo-url').value = item.url;
  editingRepoId = id;
  const btn = document.getElementById('repo-save-btn');
  if (btn) btn.textContent = '✓ Update Document';
};

window.deleteRepo = async function (id) {
  if (confirm('Hapus dokumen?')) {
    repoData = repoData.filter(r => r.id !== id);
    await saveRepoData(); // Sync to cloud
    renderRepoTable();
  }
};

// Initial load — only fetch if this page actually has the repository table
if (document.getElementById('repo-tbody')) {
  loadRepoData();
}
