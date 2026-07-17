// ============================================================
// API & DATA FETCHING MODULE
// ============================================================

// JSONBin.io Credentials for Knowledge Repository
const BIN_ID = '6a58741cf5f4af5e299602e3';
const MASTER_KEY = '$2a$10$mpEqQgMdc.1wQV.yIvNaaufcuHdBY1eCZJueBmT6x3gjGuzJ3DBBW';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

/**
 * Fetch and parse Google Sheets CSV export URL using SheetJS
 * @param {string} sheetUrl - The export CSV URL of the Google Sheet
 * @returns {Promise<Array>} Array of row objects
 */
export const fetchGoogleSheetsData = async (sheetUrl) => {
  try {
    const response = await fetch(sheetUrl);
    if (!response.ok) throw new Error("Gagal terhubung ke Google Sheets");
    
    const arrayBuffer = await response.arrayBuffer();
    
    // XLSX is available globally via the CDN script in index.html
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    return window.XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  } catch (error) {
    console.error("Error fetching Google Sheets:", error);
    throw error;
  }
};

/**
 * Fetch Knowledge Repository data from JSONBin.io
 * @returns {Promise<Array>} Array of knowledge repository items
 */
export const fetchKnowledgeRepo = async () => {
  try {
    const response = await fetch(JSONBIN_URL, {
      method: 'GET',
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    
    if (!response.ok) throw new Error("Gagal mengambil data dari cloud");
    
    const json = await response.json();
    return json.record || []; 
  } catch (error) {
    console.error("Error loading Knowledge Repo from Cloud:", error);
    return []; // Return empty array as fallback so the UI doesn't break
  }
};

/**
 * Save Knowledge Repository data to JSONBin.io
 * @param {Array} data - The updated array of knowledge repository items
 * @returns {Promise<Object>} The API response object
 */
export const saveKnowledgeRepo = async (data) => {
  try {
    const response = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error("Gagal menyimpan ke cloud");
    
    return await response.json();
  } catch (error) {
    console.error("Error saving Knowledge Repo to Cloud:", error);
    throw error;
  }
};
