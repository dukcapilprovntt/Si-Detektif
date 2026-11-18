// ================== KONFIGURASI ==================
const SPREADSHEET_ID = '1I9OTQ1GY5Br0kFQY09Rb0fNYKFH1hgzGTEq3wIEBZ4g';
const ROOT_FOLDER_NAME = 'Si-Kondata Arsip Data Kependudukan';

const KATEGORI_LIST = [
  'Jumlah Penduduk',
  'Cakupan Perekaman KTP-el',
  'Capaian Akta Kelahiran 0-4 Tahun',
  'Capaian Akta Kelahiran 0-18 Tahun',
  'Akta Kelahiran Keseluruhan',
  'Capaian Aktivasi IKD',
  'Capaian KIA',
  'Capaian Akta Kawin',
  'Capaian Akta Cerai',
  'Capaian Akta Kematian'
];

const KABKOTA_LIST = [
  'Kab. Kupang(53.01)',
  'Kab. TTS(53.02)',
  'Kab. TTU(53.03)',
  'Kab. Belu(53.04)',
  'Kab. Alor(53.05)',
  'Kab. Flores Timur(53.06)',
  'Kab. Sikka(53.07)',
  'Kab. Ende(53.08)',
  'Kab. Ngada(53.09)',
  'Kab. Manggarai(53.10)',
  'Kab. Sumba Timur(53.11)',
  'Kab. Sumba Barat(53.12)',
  'Kab. Lembata(53.13)',
  'Kab. Rote Ndao(53.14)',
  'Kab. Manggarai Barat(53.15)',
  'Kab. Nagekeo(53.16)',
  'Kab. Sumba Tengah(53.17)',
  'Kab. Sumba Barat Daya(53.18)',
  'Kab. Manggarai Timur(53.19)',
  'Kab. Sabu Raijua(53.20)',
  'Kab. Malaka(53.21)',
  'Kota Kupang(53.71)'
];

const BULAN_LIST = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const KONSOLIDASI_SIAK_FOLDER = 'Arsip Konsolidasi User SIAK';
const PROVINSI_LABEL = 'Provinsi NTT';
const ALL_WILAYAH = [PROVINSI_LABEL].concat(KABKOTA_LIST);

// Kolom sheet FileIndex (harus identik dengan project admin)
const FI = { TS: 0, ID: 1, NAME: 2, JENIS: 3, WILAYAH: 4, KATEGORI: 5, TAHUN: 6, BULAN: 7, BY: 8, URL: 9, MIME: 10, SIZE: 11 };

// ================== WEB APP ENTRY POINT ==================
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  template.faviconDataUri = getFaviconDataUri_();

  return template.evaluate()
    .setTitle('Si-Detektif | Portal Publik Arsip Data Kependudukan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Jembatan untuk hosting eksternal (mis. GitHub Pages) yang memanggil
 * lewat fetch() ala google.script.run (lihat shim di JavaScript.html).
 * HANYA fungsi dalam ALLOWED_FUNCTIONS_ yang boleh dipanggil dari luar —
 * ini portal publik tanpa login, jadi daftar ini sengaja dibatasi ketat
 * pada fungsi baca-saja (read-only).
 */
const ALLOWED_FUNCTIONS_ = [
  'getReferenceData',
  'getDashboardStats',
  'getFolderContents',
  'getKonsolidasiSiakFiles',
  'searchFiles',
  'getFileBlob',
  'getSpreadsheetPreview',
  'getAppLogo',
  'getBerandaPenduduk',
  'getBerandaProgres',
  'getBerandaTren',
  'getPetaTematik'
];

function doPost(e) {
  let out;
  try {
    const body = JSON.parse(e.postData.contents);
    const fn = body.fn;
    const args = body.args || [];

    if (ALLOWED_FUNCTIONS_.indexOf(fn) === -1 || typeof this[fn] !== 'function') {
      throw new Error('Fungsi tidak diizinkan: ' + fn);
    }
    out = this[fn].apply(null, args);
  } catch (err) {
    out = { __error: true, message: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

const FAVICON_SUPPORTED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];

function getFaviconDataUri_() {
  const fileId = PropertiesService.getScriptProperties().getProperty(LOGO_PROP_KEY);
  if (!fileId) return '';
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    const mime = blob.getContentType();
    if (FAVICON_SUPPORTED_MIME.indexOf(mime) === -1) return '';
    const base64 = Utilities.base64Encode(blob.getBytes());
    return 'data:' + mime + ';base64,' + base64;
  } catch (err) {
    return '';
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ================== HELPER: SPREADSHEET ==================
function getSS_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name) {
  const ss = getSS_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

// ================== DATA REFERENSI UNTUK MENU (1 panggilan gabungan) ==================
function getReferenceData() {
  return {
    kategori: KATEGORI_LIST,
    kabkota: KABKOTA_LIST,
    bulan: BULAN_LIST,
    provinsiLabel: PROVINSI_LABEL
  };
}

// ================== FILE INDEX (sumber data cepat untuk UI) ==================
/** Cache seluruh isi FileIndex selama 3 menit agar navigasi antar halaman terasa instan */
function getFileIndex_() {
  const cache = CacheService.getScriptCache();
  const numChunks = parseInt(cache.get('FILE_INDEX_PUBLIK_COUNT') || '0', 10);
  
  if (numChunks > 0) {
    let jsonStr = '';
    for (let i = 0; i < numChunks; i++) {
      const chunk = cache.get('FILE_INDEX_PUBLIK_' + i);
      if (chunk) jsonStr += chunk;
      else { jsonStr = ''; break; }
    }
    if (jsonStr) return JSON.parse(jsonStr);
  }

  // Jika tidak ada di Cache, ambil dari Spreadsheet
  const sh = getSheet_('FileIndex');
  const data = sh.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][FI.ID]) continue;
    rows.push({
      ts: data[i][FI.TS] instanceof Date ? data[i][FI.TS].getTime() : data[i][FI.TS],
      id: data[i][FI.ID],
      name: data[i][FI.NAME],
      jenis: data[i][FI.JENIS],
      wilayah: data[i][FI.WILAYAH],
      kategori: data[i][FI.KATEGORI],
      tahun: data[i][FI.TAHUN],
      bulan: data[i][FI.BULAN],
      by: data[i][FI.BY],
      url: data[i][FI.URL],
      mime: data[i][FI.MIME],
      size: data[i][FI.SIZE]
    });
  }

  // Simpan dalam beberapa chunk (maksimal 90 KB per chunk)
  const fullJson = JSON.stringify(rows);
  const CHUNK_SIZE = 90 * 1024;
  const totalChunks = Math.ceil(fullJson.length / CHUNK_SIZE);
  
  const cacheObj = {};
  cacheObj['FILE_INDEX_PUBLIK_COUNT'] = String(totalChunks);
  for (let i = 0; i < totalChunks; i++) {
    cacheObj['FILE_INDEX_PUBLIK_' + i] = fullJson.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }
  
  try {
    cache.putAll(cacheObj, 180);
  } catch (e) {
    // Abaikan jika cache gagal
  }

  return rows;
}

// ================== LIHAT & UNDUH DOKUMEN (PUBLIK) ==================
// Batas ukuran file yang bisa dipratinjau/diunduh langsung lewat browser.
const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Portal ini publik (tanpa login), jadi satu-satunya "penjaga akses" adalah:
 * fileId yang diminta HARUS tercatat di sheet FileIndex. Ini mencegah
 * permintaan fileId Drive sembarangan yang tidak terdaftar sebagai arsip.
 */
function isFileInIndex_(fileId) {
  const rows = getFileIndex_();
  return rows.some(function (r) { return r.id === fileId; });
}

function getFileBlob(fileId) {
  if (!isFileInIndex_(fileId)) {
    return { success: false, message: 'Dokumen tidak ditemukan pada indeks arsip.' };
  }
  try {
    const file = DriveApp.getFileById(fileId);
    const size = file.getSize();
    if (size > MAX_INLINE_BYTES) {
      return {
        success: false, tooLarge: true, url: file.getUrl(),
        message: 'Ukuran dokumen ini lebih dari 20 MB sehingga tidak bisa dipratinjau/diunduh langsung dari browser. Gunakan tautan Drive untuk membukanya.'
      };
    }
    const blob = file.getBlob();
    return {
      success: true,
      name: file.getName(),
      mimeType: blob.getContentType(),
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (err) {
    return { success: false, message: 'Gagal memuat dokumen: ' + err.message };
  }
}

/**
 * Pratinjau file Excel (.xlsx/.xls) sebagai tabel.
 * PENTING — aktifkan Advanced Service "Drive API" (v2) dulu di menu
 * Layanan (Services) pada editor Apps Script, kalau belum.
 */
function getRawSpreadsheetPreview_(fileId) {
  if (!isFileInIndex_(fileId)) {
    return { success: false, message: 'Dokumen tidak ditemukan pada indeks arsip.' };
  }

  let tempFileId = null;
  try {
    const original = DriveApp.getFileById(fileId);
    if (original.getSize() > MAX_INLINE_BYTES) {
      return {
        success: false, tooLarge: true, url: original.getUrl(),
        message: 'Ukuran dokumen ini lebih dari 20 MB sehingga tidak bisa dipratinjau langsung. Gunakan tautan Drive untuk membukanya.'
      };
    }

    const resource = { title: 'preview-temp-' + original.getId(), mimeType: MimeType.GOOGLE_SHEETS };
    const converted = Drive.Files.insert(resource, original.getBlob(), { convert: true });
    tempFileId = converted.id;

    const ss = SpreadsheetApp.openById(tempFileId);
    const sheets = ss.getSheets().slice(0, 5);
    const result = sheets.map(function (sh) {
      const lastRow = Math.min(sh.getLastRow(), 200);
      const lastCol = Math.min(sh.getLastColumn(), 30);
      const rows = (lastRow > 0 && lastCol > 0)
        ? sh.getRange(1, 1, lastRow, lastCol).getDisplayValues()
        : [];
      return { name: sh.getName(), rows: rows };
    });

    return { success: true, name: original.getName(), sheets: result };
  } catch (err) {
    return {
      success: false,
      message: 'Pratinjau Excel gagal: ' + err.message +
        '. Pastikan Advanced Service "Drive API" (v2) sudah diaktifkan di menu Layanan (Services) pada editor Apps Script.'
    };
  } finally {
    if (tempFileId) {
      try { Drive.Files.remove(tempFileId); } catch (e1) {
        try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch (e2) { /* abaikan */ }
      }
    }
  }
}

// ================== BERANDA: STATISTIK (SEMUA WILAYAH, PUBLIK) ==================
function getDashboardStats() {
  const rows = getFileIndex_();

  const perKategori = {};
  KATEGORI_LIST.forEach(function (k) { perKategori[k] = 0; });
  const perWilayahMap = {};
  ALL_WILAYAH.forEach(function (w) { perWilayahMap[w] = 0; });

  let totalFile = 0, totalSiak = 0;

  rows.forEach(function (r) {
    if (r.jenis === 'siak') {
      totalSiak++;
    } else if (r.jenis === 'agregat' && perWilayahMap.hasOwnProperty(r.wilayah)) {
      totalFile++;
      if (perKategori.hasOwnProperty(r.kategori)) perKategori[r.kategori]++;
      perWilayahMap[r.wilayah]++;
    }
  });

  const perWilayah = ALL_WILAYAH.map(function (w) { return { wilayah: w, jumlah: perWilayahMap[w] }; });

  return {
    totalFile: totalFile,
    totalSiak: totalSiak,
    totalWilayah: ALL_WILAYAH.length,
    perKategori: perKategori,
    perWilayah: perWilayah
  };
}

// ================== DAFTAR FILE DALAM FOLDER (dari FileIndex, PUBLIK) ==================
function getFolderContents(wilayah, kategori) {
  const rows = getFileIndex_();
  return rows.filter(function (r) {
    return r.jenis === 'agregat' && r.wilayah === wilayah && r.kategori === kategori;
  }).sort(function (a, b) { return b.ts - a.ts; });
}

function getKonsolidasiSiakFiles() {
  const rows = getFileIndex_();
  return rows.filter(function (r) { return r.jenis === 'siak'; })
             .sort(function (a, b) { return b.ts - a.ts; });
}

// ================== PENCARIAN (PUBLIK) ==================
function searchFiles(query, filters) {
  filters = filters || {};
  const q = String(query || '').trim().toLowerCase();
  const rows = getFileIndex_();

  const result = rows.filter(function (r) {
    if (filters.tahun && String(r.tahun) !== String(filters.tahun)) return false;
    if (filters.bulan && String(r.bulan) !== String(filters.bulan)) return false;
    if (filters.jenis && r.jenis !== filters.jenis) return false;
    if (!q) return true;
    const hay = (r.name + ' ' + r.wilayah + ' ' + r.kategori).toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  result.sort(function (a, b) { return b.ts - a.ts; });
  return result.slice(0, 200);
}

// ================== LOGO / IDENTITAS APLIKASI (PUBLIK, READ-ONLY) ==================
// Portal ini tidak punya menu untuk mengganti logo (tidak ada admin/login).
// Kalau LOGO_PROP_KEY kebetulan sudah tersimpan di Script Properties project
// ini (mis. project ini adalah salinan/berbagi Script Properties dengan
// project admin), logo tersebut otomatis dipakai. Kalau tidak ada, sidebar
// akan menampilkan tanda "SK" bawaan.
const LOGO_PROP_KEY = 'APP_LOGO_FILE_ID';

function getAppLogo() {
  const props = PropertiesService.getScriptProperties();
  const fileId = props.getProperty(LOGO_PROP_KEY);
  if (!fileId) return { success: false };
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return { success: true, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
  } catch (err) {
    return { success: false };
  }
}

// ======================================================================
// ================== PRATINJAU EXCEL: KOLOM TERPILIH ===================
// ======================================================================
// Untuk dokumen jenis 'agregat', pratinjau hanya menampilkan kolom yang
// didefinisikan di SPEC_KOLOM (3 kolom awal selalu: No, Wilayah, Kode).
// Pencocokan header tidak peka huruf besar/kecil, spasi, dan tanda baca,
// sehingga 'WAJIB AKTA(DINAMIS - JML)' = 'wajib akta (dinamis-jml)'.

function colSrc_(label, key) { return { label: label, keys: [key], src: key }; }
function colCalc_(label, keys, fmt, fn) { return { label: label, keys: keys, fmt: fmt, calc: fn }; }

function pctOf_(a, total) {
  return (a === null || total === null || total === 0) ? null : (a / total) * 100;
}

const COL_EXT_PENDUDUK = colCalc_('Jumlah Penduduk', [], 'num', function (c) { return c.ext; });

const SPEC_KOLOM = {
  'Jumlah Penduduk': [
    colCalc_('Total Penduduk', ['PENDUDUK(JML)', 'PENDUDUK(LK)', 'PENDUDUK(PR)'], 'num', function (c) {
      var t = c.num('PENDUDUK(JML)');
      if (t === null || t === 0) {
        var lk = c.num('PENDUDUK(LK)'), pr = c.num('PENDUDUK(PR)');
        if (lk !== null || pr !== null) t = (lk || 0) + (pr || 0);
      }
      return t;
    }),
    colSrc_('Laki-Laki (LK)', 'PENDUDUK(LK)'),
    colCalc_('Persen LK', ['PENDUDUK(LK)'], 'pct', function (c) { return pctOf_(c.num('PENDUDUK(LK)'), c.vals[0]); }),
    colSrc_('Perempuan (PR)', 'PENDUDUK(PR)'),
    colCalc_('Persen PR', ['PENDUDUK(PR)'], 'pct', function (c) { return pctOf_(c.num('PENDUDUK(PR)'), c.vals[0]); })
  ],
  'Cakupan Perekaman KTP-el': [
    colSrc_('Jumlah Penduduk', 'JUMLAH PENDUDUK'),
    colSrc_('WKTP Awal', 'WKTP AWAL'),
    colSrc_('WKTP Dinamis', 'WKTP DINAMIS'),
    colSrc_('Progres Belum Rekam', 'PROGRES BELUM REKAM'),
    colSrc_('Progres Rekam', 'PROGRES REKAM'),
    colSrc_('Progres (%)', 'PROGRES PERSENTASE')
  ],
  'Capaian Akta Kelahiran 0-4 Tahun': aktaLahirCols_(),
  'Capaian Akta Kelahiran 0-18 Tahun': aktaLahirCols_(),
  'Akta Kelahiran Keseluruhan': aktaLahirCols_(),
  'Capaian Aktivasi IKD': [
    colSrc_('Rekam Dinamis', 'REKAM DINAMIS'),
    colSrc_('Jumlah IKD', 'JUMLAH IKD'),
    colCalc_('Belum Aktivasi IKD', ['REKAM DINAMIS', 'JUMLAH IKD'], 'num', function (c) {
      var a = c.num('REKAM DINAMIS'), b = c.num('JUMLAH IKD');
      return (a === null || b === null) ? null : a - b;
    }),
    colSrc_('Persen IKD (%)', 'PERSEN IKD')
  ],
  'Capaian KIA': [
    COL_EXT_PENDUDUK,
    colSrc_('Jumlah Awal', 'JUMLAH AWAL(JML)'),
    colSrc_('Jumlah Dinamis', 'JUMLAH DINAMIS(TTL)'),
    colSrc_('Memiliki Dinamis', 'MEMILIKI DINAMIS(JML)'),
    colSrc_('Belum Memiliki Dinamis', 'BELUM MEMILIKI DINAMIS(JML)'),
    colSrc_('Persen Dinamis (%)', 'PERSEN DINAMIS(%)')
  ],
  'Capaian Akta Kawin': [
    COL_EXT_PENDUDUK,
    colSrc_('Wajib Akta Kawin', 'WAJIB AKTA KAWIN(JML)'),
    colSrc_('Memiliki Akta Kawin', 'MEMILIKI AKTA KAWIN(JML)'),
    colSrc_('Belum Memiliki Akta Kawin', 'BELUM MEMILIKI AKTA KAWIN(JML)'),
    colSrc_('Persen Memiliki (%)', 'PERSEN (MEMILIKI)(%)')
  ],
  'Capaian Akta Cerai': [
    COL_EXT_PENDUDUK,
    colSrc_('Memiliki Akta Cerai', 'MEMILIKI AKTA CERAI(JML)')
  ],
  'Capaian Akta Kematian': [
    COL_EXT_PENDUDUK,
    colSrc_('MENINGGAL(LK)', 'MENINGGAL(LK)'),
    colSrc_('MENINGGAL(PR)', 'MENINGGAL(PR)'),
    colSrc_('MENINGGAL(JML)', 'MENINGGAL(JML)')
  ]
};

function aktaLahirCols_() {
  return [
    colSrc_('Wajib Akta Awal', 'WAJIB AKTA(AWAL-JML)'),
    colSrc_('Wajib Akta Dinamis', 'WAJIB AKTA(DINAMIS - JML)'),
    colSrc_('Memiliki Dinamis', 'MEMILIKI(DINAMIS - JML)'),
    colSrc_('Belum Memiliki Dinamis', 'BELUM MEMILIKI(DINAMIS - JML)'),
    colSrc_('Persen Dinamis (%)', 'PERSEN (DINAMIS)(%)')
  ];
}

// Kategori yang kolom "Jumlah Penduduk"-nya diambil dari dokumen kategori lain
// (wilayah & tahun yang sama): kolom pertama hasil ekstraksi dokumen tsb.
// Dokumen "Jumlah Penduduk" diarsipkan per SEMESTER (kolom Bulan = 'Semester I' / 'Semester II'):
// Januari-Juni -> Semester I, Juli-Desember -> Semester II pada tahun yang sama.
const EXT_SOURCE = {
  'Capaian KIA': 'Jumlah Penduduk',
  'Capaian Akta Kawin': 'Jumlah Penduduk',
  'Capaian Akta Cerai': 'Jumlah Penduduk',
  'Capaian Akta Kematian': 'Jumlah Penduduk'
};

const STD_NO = ['NO', 'NOMOR'];
const STD_WILAYAH = ['WILAYAH', 'NAMAWILAYAH', 'NAMA', 'KABKOTA', 'KABUPATENKOTA', 'KECAMATAN', 'NAMAKECAMATAN'];
const STD_KODE = ['KODE', 'KODEWILAYAH', 'KODEKEC', 'KODEKECAMATAN', 'KODEKABKOTA'];

// ---------- util ----------
function loose_(s) {
  return String(s === null || s === undefined ? '' : s).toUpperCase().replace(/[^A-Z0-9%]/g, '');
}

function parseNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  var s = String(v).trim().replace(/[%\s]/g, '');
  if (!s || s === '-') return null;
  var hasDot = s.indexOf('.') > -1, hasCom = s.indexOf(',') > -1;
  if (hasDot && hasCom) s = s.replace(/\./g, '').replace(',', '.');
  else if (hasCom) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function fmtNum_(n) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  var neg = n < 0; n = Math.abs(n);
  var isInt = Math.abs(n - Math.round(n)) < 1e-9;
  var parts = (isInt ? String(Math.round(n)) : n.toFixed(2)).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + parts.join(',');
}

function fmtPct_(n) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  return n.toFixed(2).replace('.', ',') + '%';
}

function firstDefined_(idx, names) {
  for (var i = 0; i < names.length; i++) if (idx[names[i]] !== undefined) return idx[names[i]];
  return undefined;
}

// ---------- deteksi baris header (mendukung header 1 baris maupun 2 baris) ----------
function buildHeaderMaps_(values, r) {
  var row = values[r] || [], next = values[r + 1] || [];
  var single = {}, combo = {}, parent = '';
  for (var c = 0; c < row.length; c++) {
    var h = loose_(row[c]);
    if (h) { parent = h; if (single[h] === undefined) single[h] = c; }
    var child = loose_(next[c]);
    if (parent && child) {
      var k = parent + child;
      if (combo[k] === undefined) combo[k] = c;
    }
  }
  var both = {};
  Object.keys(combo).forEach(function (k) { both[k] = combo[k]; });
  Object.keys(single).forEach(function (k) { both[k] = single[k]; });
  return { single: single, combo: both };
}

function detectHeader_(values, spec) {
  var keys = [];
  spec.forEach(function (col) {
    col.keys.forEach(function (k) { var l = loose_(k); if (keys.indexOf(l) === -1) keys.push(l); });
  });
  var best = null;
  var maxR = Math.min(15, values.length);
  for (var r = 0; r < maxR; r++) {
    var maps = buildHeaderMaps_(values, r);
    [['single', maps.single, r + 1], ['combo', maps.combo, r + 2]].forEach(function (m) {
      var score = keys.filter(function (k) { return m[1][k] !== undefined; }).length;
      if (score > 0 && (!best || score > best.score)) best = { score: score, idx: m[1], start: m[2] };
    });
  }
  return best;
}

// ---------- baca Excel (konversi sementara ke Google Sheets) ----------
function withSpreadsheet_(fileId, fn) {
  var tempId = null;
  try {
    var original = DriveApp.getFileById(fileId);
    var ss;
    if (original.getMimeType() === MimeType.GOOGLE_SHEETS) {
      ss = SpreadsheetApp.openById(fileId);
    } else {
      var resource = { title: 'preview-temp-' + fileId, mimeType: MimeType.GOOGLE_SHEETS };
      var converted = Drive.Files.insert(resource, original.getBlob(), { convert: true });
      tempId = converted.id;
      ss = SpreadsheetApp.openById(tempId);
    }
    return fn(ss);
  } finally {
    if (tempId) {
      try { Drive.Files.remove(tempId); } catch (e1) {
        try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e2) { /* abaikan */ }
      }
    }
  }
}

/**
 * Ambil kolom terpilih dari 1 file. Mengembalikan null bila header tidak dikenali.
 * extMap (opsional): peta kode/nama wilayah -> jumlah penduduk dari file kategori lain.
 */
function extractTable_(fileId, kategori, extMap) {
  var spec = SPEC_KOLOM[kategori];
  return withSpreadsheet_(fileId, function (ss) {
    var best = null;
    ss.getSheets().slice(0, 5).forEach(function (sh) {
      var lr = Math.min(sh.getLastRow(), 1500), lc = Math.min(sh.getLastColumn(), 60);
      if (lr < 1 || lc < 1) return;
      var rng = sh.getRange(1, 1, lr, lc);
      var values = rng.getValues();
      var det = detectHeader_(values, spec);
      if (det && (!best || det.score > best.det.score)) {
        best = { values: values, display: rng.getDisplayValues(), det: det };
      }
    });
    if (!best) return null;

    var idx = best.det.idx;
    var cNo = firstDefined_(idx, STD_NO);
    var cWil = firstDefined_(idx, STD_WILAYAH);
    var cKode = firstDefined_(idx, STD_KODE);
    if (cNo === undefined && cWil === undefined && cKode === undefined) { cNo = 0; cWil = 1; cKode = 2; }

    var dataCols = {};
    spec.forEach(function (col) {
      col.keys.forEach(function (k) { var i = idx[loose_(k)]; if (i !== undefined) dataCols[i] = true; });
    });
    var dataColList = Object.keys(dataCols);

    var missing = {};
    var rows = [];
    var seq = 0;

    for (var i = best.det.start; i < best.values.length; i++) {
      var v = best.values[i], d = best.display[i];
      var hasData = dataColList.some(function (ci) { return v[ci] !== '' && v[ci] !== null; });
      if (!hasData) continue;
      seq++;

      var nama = cWil !== undefined ? String(d[cWil] || '') : '';
      var kode = cKode !== undefined ? String(d[cKode] || '') : '';
      var kodeKey = kode.replace(/\D/g, '') ? 'K' + kode.replace(/\D/g, '') : '';
      var nameKey = loose_(nama) ? 'N' + loose_(nama) : '';

      var ext = null;
      if (extMap) {
        if (kodeKey && extMap[kodeKey] !== undefined) ext = extMap[kodeKey];
        else if (nameKey && extMap[nameKey] !== undefined) ext = extMap[nameKey];
      }

      var c = {
        vals: [], ext: ext,
        num: function (key) {
          var ci = idx[loose_(key)];
          if (ci === undefined) { missing[key] = true; return null; }
          var n = parseNum_(v[ci]);
          return n !== null ? n : parseNum_(d[ci]);
        }
      };

      var cells = [cNo !== undefined && d[cNo] !== '' ? String(d[cNo]) : String(seq), nama || '-', kode || '-'];
      spec.forEach(function (col, k) {
        var n;
        if (col.src) {
          var ci = idx[loose_(col.src)];
          if (ci === undefined) { missing[col.src] = true; c.vals[k] = null; cells.push('-'); return; }
          n = parseNum_(v[ci]);
          if (n === null) n = parseNum_(d[ci]);
          c.vals[k] = n;
          cells.push(d[ci] !== '' && d[ci] !== null ? String(d[ci]) : '-');
        } else {
          n = col.calc(c);
          c.vals[k] = n;
          cells.push(col.fmt === 'pct' ? fmtPct_(n) : fmtNum_(n));
        }
      });
      rows.push({ kodeKey: kodeKey, nameKey: nameKey, cells: cells, vals: c.vals });
    }

    return {
      labels: ['No', 'Wilayah', 'Kode'].concat(spec.map(function (col) { return col.label; })),
      rows: rows,
      missing: Object.keys(missing)
    };
  });
}

function findIndexRow_(fileId) {
  var rows = getFileIndex_();
  for (var i = 0; i < rows.length; i++) if (rows[i].id === fileId) return rows[i];
  return null;
}

function semesterOf_(bulan) {
  var idx = BULAN_LIST.indexOf(String(bulan));
  if (idx === -1) return null;
  return idx < 6 ? 1 : 2;
}

// Cocokkan nilai kolom Bulan dengan semester: 'Semester I', 'semester 1', 'SMT I', dst.
function isSemester_(bulan, sem) {
  var l = loose_(bulan).replace(/^SEMESTER|^SMT/, '');
  return sem === 1 ? (l === 'I' || l === '1') : (l === 'II' || l === '2');
}

function findSamePeriodRow_(base, kategori) {
  var rows = getFileIndex_(), found = null;
  var sem = (kategori === 'Jumlah Penduduk') ? semesterOf_(base.bulan) : null;
  rows.forEach(function (r) {
    if (r.jenis !== 'agregat' || r.kategori !== kategori || r.wilayah !== base.wilayah) return;
    if (String(r.tahun) !== String(base.tahun)) return;
    if (kategori === 'Jumlah Penduduk') {
      if (!sem || !isSemester_(r.bulan, sem)) return;
    } else if (String(r.bulan) !== String(base.bulan)) {
      return;
    }
    if (!found || r.ts > found.ts) found = r;
  });
  return found;
}

function getFilteredPreview_(base) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PVF3_' + base.id + '_' + base.ts;
  try {
    const hit = cache.get(cacheKey);
    if (hit) return JSON.parse(hit);
  } catch (e0) { /* abaikan */ }

  try {
    const original = DriveApp.getFileById(base.id);
    if (original.getSize() > MAX_INLINE_BYTES) {
      return {
        success: false, tooLarge: true, url: original.getUrl(),
        message: 'Ukuran dokumen ini lebih dari 20 MB sehingga tidak bisa dipratinjau langsung. Gunakan tautan Drive untuk membukanya.'
      };
    }

    const notes = [];
    let extMap = null;
    const extKat = EXT_SOURCE[base.kategori];
    if (extKat) {
      const semBase = semesterOf_(base.bulan);
      const periodeExt = (extKat === 'Jumlah Penduduk' && semBase)
        ? 'Semester ' + (semBase === 1 ? 'I' : 'II') + ' ' + base.tahun
        : base.bulan + ' ' + base.tahun;
      let alasan = '';
      const extRow = findSamePeriodRow_(base, extKat);
      if (!extRow) {
        alasan = 'dokumen tersebut belum diunggah untuk periode ini';
      } else {
        try {
          const er = extractTable_(extRow.id, extKat, null);
          if (er) {
            extMap = {};
            er.rows.forEach(function (r) {
              if (r.kodeKey) extMap[r.kodeKey] = r.vals[0];
              if (r.nameKey) extMap[r.nameKey] = r.vals[0];
            });
            if (er.missing.length) notes.push('Dokumen "' + extKat + '" (' + periodeExt + ', file ' + extRow.name +
              ') tidak memiliki kolom: ' + er.missing.join(', ') + '.');
          } else {
            alasan = 'file ' + extRow.name + ' ditemukan, tetapi header kolomnya tidak dikenali (cari: PENDUDUK(JML), PENDUDUK(LK), PENDUDUK(PR))';
          }
        } catch (eExt) {
          alasan = 'file ' + extRow.name + ' gagal dibaca (' + eExt.message + ')';
        }
      }
      if (!extMap) {
        notes.push('Kolom "Jumlah Penduduk" diambil dari dokumen "' + extKat + '" (' + base.wilayah + ', ' +
          periodeExt + '), tetapi ' + alasan + ', sehingga kolom ditampilkan "-".');
      }
    }

    const t = extractTable_(base.id, base.kategori, extMap);
    if (!t) {
      return {
        success: false,
        message: 'Kolom data untuk kategori "' + base.kategori + '" tidak ditemukan di file ini. Periksa nama header pada file Excel.'
      };
    }
    if (t.missing.length) notes.push('Kolom tidak ditemukan di file: ' + t.missing.join(', ') + '.');

    const out = {
      success: true,
      name: original.getName(),
      notes: notes,
      sheets: [{ name: base.kategori, rows: [t.labels].concat(t.rows.map(function (r) { return r.cells; })) }]
    };
    try {
      const s = JSON.stringify(out);
      if (s.length < 95000) cache.put(cacheKey, s, 600);
    } catch (e1) { /* abaikan */ }
    return out;
  } catch (err) {
    return {
      success: false,
      message: 'Pratinjau Excel gagal: ' + err.message +
        '. Pastikan Advanced Service "Drive API" (v2) sudah diaktifkan di menu Layanan (Services) pada editor Apps Script.'
    };
  }
}

/** Titik masuk pratinjau Excel (nama & argumen tetap, jadi daftar ALLOWED_FUNCTIONS_ tidak berubah). */
function getSpreadsheetPreview(fileId) {
  const base = findIndexRow_(fileId);
  if (!base) return { success: false, message: 'Dokumen tidak ditemukan pada indeks arsip.' };
  if (base.jenis === 'agregat' && SPEC_KOLOM[base.kategori]) return getFilteredPreview_(base);
  return getRawSpreadsheetPreview_(fileId);   // arsip SIAK dsb: tampil apa adanya
}


// ======================================================================
// ===================== BERANDA (DASHBOARD PROVINSI) ===================
// ======================================================================

/** Baris Kab/Kota saja (kode 4 digit, mis. 53.01). Bila tidak ada kode, buang baris total/provinsi. */
function provinceRows_(rows) {
  var kab = rows.filter(function (r) { return /^K\d{4}$/.test(r.kodeKey || ''); });
  if (kab.length) return kab;
  return rows.filter(function (r) { return !/TOTAL|JUMLAH|PROVINSI|NUSATENGGARA|NTT/.test(r.nameKey || ''); });
}

function sumIdx_(rows, i) {
  var s = 0, any = false;
  rows.forEach(function (r) {
    var v = r.vals[i];
    if (v !== null && v !== undefined) { s += v; any = true; }
  });
  return any ? s : null;
}

function cacheGetJson_(key) {
  try { var h = CacheService.getScriptCache().get(key); return h ? JSON.parse(h) : null; } catch (e) { return null; }
}
function cachePutJson_(key, obj, sec) {
  try { var s = JSON.stringify(obj); if (s.length < 95000) CacheService.getScriptCache().put(key, s, sec); } catch (e) { /* abaikan */ }
}

/** Dokumen Jumlah Penduduk Provinsi terkini: tahun terbesar, lalu Semester II > Semester I. */
function getLatestPendudukRow_() {
  var best = null, bestRank = -1;
  getFileIndex_().forEach(function (r) {
    if (r.jenis !== 'agregat' || r.kategori !== 'Jumlah Penduduk' || r.wilayah !== PROVINSI_LABEL) return;
    var sem = isSemester_(r.bulan, 2) ? 2 : (isSemester_(r.bulan, 1) ? 1 : 0);
    if (!sem) return;
    var rank = Number(r.tahun) * 10 + sem;
    if (rank > bestRank || (rank === bestRank && r.ts > best.ts)) { best = r; bestRank = rank; }
  });
  return best;
}

/** Kartu 1 & 2: komposisi LK/PR dan 5 Kab/Kota berpenduduk terbanyak. */
function getBerandaPenduduk() {
  var row = getLatestPendudukRow_();
  if (!row) return { success: false, message: 'Belum ada dokumen Jumlah Penduduk Provinsi NTT (Semester I/II) di arsip.' };

  var key = 'BP1_' + row.id + '_' + row.ts;
  var hit = cacheGetJson_(key);
  if (hit) return hit;

  try {
    var t = extractTable_(row.id, 'Jumlah Penduduk', null);
    if (!t) return { success: false, message: 'Header kolom pada file "' + row.name + '" tidak dikenali (cari: PENDUDUK(JML), PENDUDUK(LK), PENDUDUK(PR)).' };
    var rows = provinceRows_(t.rows);
    var lk = sumIdx_(rows, 1) || 0, pr = sumIdx_(rows, 3) || 0;
    var total = sumIdx_(rows, 0) || (lk + pr);

    var top = rows
      .filter(function (r) { return r.vals[0] !== null && r.vals[0] !== undefined; })
      .sort(function (a, b) { return b.vals[0] - a.vals[0]; })
      .slice(0, 5)
      .map(function (r) { return { nama: r.cells[1], jumlah: r.vals[0] }; });

    var out = {
      success: true,
      periode: row.bulan + ' ' + row.tahun,
      lk: lk, pr: pr, total: total,
      jumlahWilayah: rows.length,
      top: top
    };
    cachePutJson_(key, out, 1800);
    return out;
  } catch (err) {
    return { success: false, message: 'Gagal membaca dokumen Jumlah Penduduk: ' + err.message };
  }
}

/** Baris total/provinsi (nama mengandung TOTAL/JUMLAH/PROVINSI/NTT, atau kode 1-2 digit seperti 53). */
function findTotalRow_(rows) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (/TOTAL|JUMLAH|PROVINSI|NUSATENGGARA|NTT/.test(r.nameKey || '') || /^K\d{1,2}$/.test(r.kodeKey || '')) return r;
  }
  return null;
}

/**
 * Nilai kolom persen -> angka 0-100, memakai teks yang tampil di sel sebagai acuan skala.
 * Sel berformat % menyimpan pecahan (0,0084 tampil "0,84%"), sedangkan sel angka biasa
 * menyimpan 0,84 apa adanya. Dipilih skala (x1 atau x100) yang paling dekat dengan teks tampilan.
 */
function pctFromCell_(raw, disp) {
  if (raw === null || raw === undefined || isNaN(raw)) return null;
  var shown = parseNum_(disp);
  if (shown === null || String(disp).indexOf('%') === -1) return raw;   // tanpa tanda %, nilai dipakai apa adanya
  return Math.abs(raw * 100 - shown) < Math.abs(raw - shown) ? raw * 100 : raw;
}

const PROGRES_CFG = [
  { kategori: 'Cakupan Perekaman KTP-el', label: 'Perekaman KTP-el',
    numI: [4], denI: [4, 3], denAlt: [2], pctI: 5, numLabel: 'Sudah rekam', denLabel: 'Wajib KTP-el' },
  { kategori: 'Capaian Akta Kelahiran 0-4 Tahun', label: 'Akta Kelahiran 0-4 Tahun',
    numI: [2], denI: [1], denAlt: [2, 3], pctI: 4, numLabel: 'Memiliki akta', denLabel: 'Wajib akta' },
  { kategori: 'Capaian Aktivasi IKD', label: 'Aktivasi IKD',
    numI: [1], denI: [0], denAlt: null, pctI: 3, numLabel: 'IKD teraktivasi', denLabel: 'Rekam KTP-el' },
  { kategori: 'Capaian KIA', label: 'Kepemilikan KIA',
    numI: [3], denI: [2], denAlt: [3, 4], pctI: 5, numLabel: 'Memiliki KIA', denLabel: 'Jumlah anak' }
];

function sumOfIdx_(rows, idxList) {
  var s = 0, any = false;
  idxList.forEach(function (i) { var v = sumIdx_(rows, i); if (v !== null) { s += v; any = true; } });
  return any ? s : null;
}

// ---------- cache persisten hasil progres per file (sheet 'ProgresCache') ----------
// File arsip bulan lama jarang berubah, jadi hasil bacaan disimpan permanen di sheet
// agar tren/peringkat tidak perlu membuka ulang file Excel setiap kali Beranda dibuka.
const PROGRES_CACHE_SHEET = 'ProgresCache';
const PROGRES_CACHE_VER = 'v2';
const TREN_MAX_BARU = 6;   // maks. file baru yang dibaca per satu panggilan getBerandaTren

function loadProgresCache_() {
  var sh = getSheet_(PROGRES_CACHE_SHEET);
  var lr = sh.getLastRow(), map = {};
  if (lr < 1) {
    sh.appendRow(['Key', 'Kategori', 'Pct', 'Num', 'Den', 'RankJson']);
    return { sh: sh, map: map };
  }
  var data = sh.getRange(1, 1, lr, 6).getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    var rank = [];
    try { rank = r[5] ? JSON.parse(r[5]) : []; } catch (e) { rank = []; }
    map[r[0]] = {
      pct: r[2] === '' ? null : Number(r[2]),
      num: r[3] === '' ? null : Number(r[3]),
      den: r[4] === '' ? null : Number(r[4]),
      rank: rank
    };
  }
  return { sh: sh, map: map };
}

function progresKey_(file) { return PROGRES_CACHE_VER + '|' + file.id + '|' + file.ts; }

/** Baca 1 file progres Provinsi: persen dari baris total (cadangan: hitung dari jumlah Kab/Kota) + peringkat Kab/Kota. */
function computeProgres_(cfg, file) {
  var t = extractTable_(file.id, cfg.kategori, null);
  if (!t) throw new Error('Header kolom tidak dikenali.');
  var kab = provinceRows_(t.rows);
  var tot = findTotalRow_(t.rows);
  var pct = tot ? pctFromCell_(tot.vals[cfg.pctI], tot.cells[3 + cfg.pctI]) : null;
  var src = tot ? [tot] : null;
  if (pct === null) {
    src = kab;
    var n0 = sumOfIdx_(src, cfg.numI), d0 = sumOfIdx_(src, cfg.denI);
    if ((d0 === null || d0 === 0) && cfg.denAlt) d0 = sumOfIdx_(src, cfg.denAlt);
    pct = (n0 !== null && d0) ? (n0 / d0) * 100 : null;
  }
  var num = sumOfIdx_(src, cfg.numI), den = sumOfIdx_(src, cfg.denI);
  if ((den === null || den === 0) && cfg.denAlt) den = sumOfIdx_(src, cfg.denAlt);

  var rank = kab
    .map(function (r) { return { n: r.cells[1], p: pctFromCell_(r.vals[cfg.pctI], r.cells[3 + cfg.pctI]) }; })
    .filter(function (x) { return x.p !== null; })
    .sort(function (a, b) { return b.p - a.p; });
  return { pct: pct, num: num, den: den, rank: rank };
}

function saveProgresCache_(cache, file, cfg, res) {
  var key = progresKey_(file);
  cache.map[key] = res;
  try {
    cache.sh.appendRow([key, cfg.kategori,
      res.pct === null ? '' : res.pct, res.num === null ? '' : res.num, res.den === null ? '' : res.den,
      JSON.stringify(res.rank || [])]);
  } catch (e) { /* abaikan */ }
}

function getProgresCached_(cache, cfg, file) {
  var hit = cache.map[progresKey_(file)];
  if (hit) return hit;
  var res = computeProgres_(cfg, file);
  saveProgresCache_(cache, file, cfg, res);
  return res;
}

/** Kumpulkan file Provinsi untuk 4 layanan: byCat[kategori][tahun*100+bulan] = baris indeks terbaru. */
function collectProvinsiPeriods_() {
  var byCat = {}, periods = {};
  getFileIndex_().forEach(function (r) {
    if (r.jenis !== 'agregat' || r.wilayah !== PROVINSI_LABEL) return;
    var m = BULAN_LIST.indexOf(String(r.bulan));
    if (m === -1) return;
    var cfg = PROGRES_CFG.filter(function (c) { return c.kategori === r.kategori; })[0];
    if (!cfg) return;
    var pk = Number(r.tahun) * 100 + (m + 1);
    byCat[r.kategori] = byCat[r.kategori] || {};
    var cur = byCat[r.kategori][pk];
    if (!cur || r.ts > cur.ts) byCat[r.kategori][pk] = r;
    periods[pk] = true;
  });
  var pkList = Object.keys(periods).map(Number).sort(function (a, b) { return b - a; });
  return { byCat: byCat, pkList: pkList };
}

/** Periode terbaru yang datanya lengkap untuk keempat layanan (bila belum ada, periode terbaru apa pun). */
function chooseCutoff_(col) {
  for (var i = 0; i < col.pkList.length; i++) {
    var ok = PROGRES_CFG.every(function (c) { return col.byCat[c.kategori] && col.byCat[c.kategori][col.pkList[i]]; });
    if (ok) return col.pkList[i];
  }
  return col.pkList[0];
}

/** Kartu progres + peringkat Kab/Kota pada cutoff (bulan) terkini. */
function getBerandaProgres() {
  var col = collectProvinsiPeriods_();
  var byCat = col.byCat, pkList = col.pkList;
  if (!pkList.length) return { success: false, message: 'Belum ada dokumen progres layanan Provinsi NTT di arsip.' };

  var chosen = chooseCutoff_(col);
  var tahun = Math.floor(chosen / 100), bulanIdx = (chosen % 100) - 1;
  var lastDay = new Date(tahun, bulanIdx + 1, 0).getDate();
  var cutoff = lastDay + ' ' + BULAN_LIST[bulanIdx] + ' ' + tahun;

  var cache = loadProgresCache_();
  var items = PROGRES_CFG.map(function (c) {
    var f = byCat[c.kategori] && byCat[c.kategori][chosen];
    if (!f) return { label: c.label, available: false, message: 'Belum ada dokumen untuk periode ini.' };
    try {
      var r = getProgresCached_(cache, c, f);
      return {
        label: c.label, available: true,
        pct: r.pct, num: r.num, den: r.den,
        numLabel: c.numLabel, denLabel: c.denLabel, rank: r.rank
      };
    } catch (err) {
      return { label: c.label, available: false, message: 'Gagal dibaca: ' + err.message };
    }
  });
  return { success: true, cutoff: cutoff, tahun: tahun, bulanIdx: bulanIdx, items: items };
}

/**
 * Tren progres Provinsi per bulan (Januari s.d. bulan terbaru, tahun terbaru).
 * File yang belum pernah dibaca diproses bertahap (maks. TREN_MAX_BARU per panggilan);
 * 'pending' > 0 berarti klien perlu memanggil lagi sampai 0.
 */
function getBerandaTren() {
  var col = collectProvinsiPeriods_();
  if (!col.pkList.length) return { success: false, message: 'Belum ada data progres layanan untuk ditampilkan.' };

  var cut = chooseCutoff_(col);
  var tahun = Math.floor(cut / 100), lastMonth = cut % 100;
  var cache = loadProgresCache_();
  var baru = 0, pending = 0;

  var series = PROGRES_CFG.map(function (c) {
    var values = [];
    for (var m = 1; m <= lastMonth; m++) {
      var f = col.byCat[c.kategori] && col.byCat[c.kategori][tahun * 100 + m];
      if (!f) { values.push(null); continue; }
      var hit = cache.map[progresKey_(f)];
      if (hit) { values.push(hit.pct); continue; }
      if (baru >= TREN_MAX_BARU) { pending++; values.push(null); continue; }
      baru++;
      try { values.push(getProgresCached_(cache, c, f).pct); } catch (e) { values.push(null); }
    }
    return { label: c.label, values: values };
  });

  var bulan = [];
  for (var k = 0; k < lastMonth; k++) bulan.push(BULAN_LIST[k].substring(0, 3));
  return { success: true, tahun: tahun, bulan: bulan, series: series, pending: pending };
}

// ================== PETA TEMATIK DATA AGREGAT ==================
/**
 * Data untuk Peta Tematik: jumlah penduduk (LK/PR) per Kab/Kota dari dokumen Semester terbaru,
 * serta capaian 4 layanan (KTP-el, Akta Lahir 0-4, IKD, KIA) per Kab/Kota pada cutoff terkini
 * (memakai ulang hasil getBerandaProgres / ProgresCache, jadi tidak membuka ulang file Excel).
 */
function getPetaTematik() {
  var out = { success: true, penduduk: null, progres: null };

  var row = getLatestPendudukRow_();
  if (row) {
    var key = 'PETA_P1_' + row.id + '_' + row.ts;
    var hit = cacheGetJson_(key);
    if (hit) {
      out.penduduk = hit;
    } else {
      try {
        var t = extractTable_(row.id, 'Jumlah Penduduk', null);
        if (t) {
          out.penduduk = {
            periode: row.bulan + ' ' + row.tahun,
            rows: provinceRows_(t.rows).map(function (r) {
              return {
                kode: String(r.kodeKey || '').replace(/\D/g, ''),
                nama: r.cells[1],
                total: r.vals[0], lk: r.vals[1], pr: r.vals[3]
              };
            })
          };
          cachePutJson_(key, out.penduduk, 1800);
        }
      } catch (err) { out.pendudukError = err.message; }
    }
  }

  try {
    var pg = getBerandaProgres();
    if (pg && pg.success) {
      out.progres = {
        cutoff: pg.cutoff,
        items: pg.items.map(function (it) {
          return {
            label: it.label, available: it.available, pct: it.pct,
            numLabel: it.numLabel, denLabel: it.denLabel, rank: it.rank || []
          };
        })
      };
    }
  } catch (err2) { out.progresError = err2.message; }

  if (!out.penduduk && !out.progres) {
    return { success: false, message: 'Belum ada data agregat (Jumlah Penduduk / progres layanan) yang dapat dipetakan.' };
  }
  return out;
}
