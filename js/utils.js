// ============================================================
// FORMATTING FUNCTIONS
// ============================================================

/** Format number as Indonesian currency (IDR) */
export function fmtIDR(val) {
  if (val == null || isNaN(val)) return '—';
  
  if (val >= 1e9) {
    // Dipotong ke bawah 2 angka di belakang koma untuk Milyar
    const truncated = Math.floor((val / 1e9) * 100) / 100;
    return 'Rp ' + truncated.toFixed(2) + 'M';
  }
  
  if (val >= 1e6) {
    // Dipotong ke bawah 1 angka di belakang koma untuk Juta
    const truncated = Math.floor((val / 1e6) * 10) / 10;
    return 'Rp ' + truncated.toFixed(1) + 'jt';
  }
  
  // Pembulatan ke bawah untuk angka sisanya
  return 'Rp ' + Math.floor(val).toLocaleString('id-ID');
}

/** Format number with thousand separator */
export function fmtNum(val) {
  if (val == null || isNaN(val)) return '—';
  return Math.round(val).toLocaleString('id-ID');
}

// ============================================================
// DATE FUNCTIONS
// ============================================================

/** Parse date to YYYY-MM-DD string using local timezone */
export function toDateStr(d) {
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
export function toMonthStr(d) { 
  return toDateStr(d).slice(0, 7); 
}

/** Get YYYY string from date */
export function toYearStr(d) { 
  return toDateStr(d).slice(0, 4); 
}

/** Get today's date as YYYY-MM-DD */
export function today() { 
  return toDateStr(new Date()); 
}

/** Get last N distinct date values from data (sorted desc) */
export function lastNDates(data, n) {
  const dates = [...new Set(data.map(r => toDateStr(r.date)))].sort().reverse();
  return dates.slice(0, n).reverse();
}

/** Get last N months (YYYY-MM) prior to most recent month in data */
export function lastNMonths(data, n) {
  const months = [...new Set(data.map(r => toMonthStr(r.date)))].sort();
  return months.slice(-n);
}

// ============================================================
// MATH & ARRAY FUNCTIONS
// ============================================================

/** Compute delta percentage */
export function pctChange(cur, prev) {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Render a delta badge (HTML string) */
export function deltaBadge(cur, prev) {
  const pct = pctChange(cur, prev);
  if (pct === null) return '<span class="compare-delta delta-flat">—</span>';
  const sign = pct >= 0 ? '+' : '';
  const cls = pct >= 0 ? 'delta-up' : 'delta-down';
  const arrow = pct >= 0 ? '▲' : '▼';
  return `<span class="compare-delta ${cls}">${arrow} ${sign}${pct.toFixed(1)}%</span>`;
}

/** Sum a field in an array of records */
export function sum(arr, field) {
  return arr.reduce((s, r) => s + (r[field] || 0), 0);
}

/** Group records by a key function */
export function groupBy(arr, keyFn) {
  return arr.reduce((acc, r) => {
    const k = keyFn(r);
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
}

// ============================================================
// PARSER FUNCTIONS
// ============================================================

/**
 * Parse an array of raw row objects from SheetJS into normalized records.
 * Handles column name mapping for this specific dataset.
 */
export function parseRows(rows) {
  if (!rows || rows.length === 0) return [];

  const out = [];
  for (const row of rows) {
    // Try different possible column name variations
    const dateRaw = row['Tgl Laporan'] || row['Tanggal Laporan'] || row['tanggal_laporan'] || row['Date'] || row['date'];
    const docType = (row['Jenis Dokumen'] || row['jenis_dokumen'] || row['DocType'] || '').toString().trim().toUpperCase();
    const docNum = row['Nomor Dokumen'] || row['nomor_dokumen'] || row['DocNumber'] || '';
    const bm = parseFloat(row['BM']) || 0;
    const ppn = parseFloat(row['PPN']) || 0;
    const pph = parseFloat(row['PPH']) || 0;
    const bk = parseFloat(row['BK']) || 0;
    const jumlah = parseFloat(row['Jumlah']) || 0;
    const bank = row['Bank'] || '';
    const petugas = row['Petugas Penetapan'] || '';
    const admin = row['Admin Input'] || '';
    const keterangan = row['Keterangan '] || row['Keterangan'] || '';
    const lokasi = row['Lokasi'] || '';

    // Parse date: SheetJS may return Date objects or strings
    let dateObj = null;
    if (dateRaw instanceof Date) {
      dateObj = dateRaw;
    } else if (typeof dateRaw === 'number') {
      // Excel serial date
      dateObj = new Date((dateRaw - 25569) * 86400 * 1000);
    } else if (dateRaw) {
      dateObj = new Date(dateRaw);
    }

    if (!dateObj || isNaN(dateObj)) continue; // Skip rows with invalid date
    if (!docType) continue;

    out.push({
      date: dateObj,
      dateStr: toDateStr(dateObj),
      monthStr: toMonthStr(dateObj),
      yearStr: toYearStr(dateObj),
      docType,
      docNum: docNum.toString(),
      bm,
      ppn,
      pph,
      bk,
      jumlah,
      bank: bank.toString(),
      petugas: petugas.toString(),
      admin: admin.toString(),
      keterangan: keterangan.toString(),
      lokasi: lokasi.toString(),
    });
  }
  return out;
}
