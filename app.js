/* ==========================================================
   SI-KONDATA — PORTAL PUBLIK (client logic)
   Hanya: Beranda, Data Agregat, Arsip SIAK, Pencarian, Lihat & Unduh.
   Tidak ada login/session — semua endpoint server bersifat publik/read-only.
   ========================================================== */

/* ---------------------------------------------------------------
   MODE HOSTING TERPISAH (mis. GitHub Pages) — WAJIB DIISI
   ---------------------------------------------------------------
   Kalau file ini dibuka LANGSUNG dari dalam Apps Script (lewat
   doGet Code.gs), google.script.run sudah otomatis tersedia dan
   baris di bawah ini TIDAK dipakai sama sekali.

   Tapi kalau Index.html/CSS.html/JavaScript.html ini di-hosting
   sebagai file statis di luar Apps Script (GitHub Pages, dst),
   isi SCRIPT_URL di bawah ini dengan Web App URL Apps Script
   project INI (proyek publik, bukan proyek admin/login), yang
   berakhiran /exec, dan pastikan Code.gs proyek ini SUDAH punya
   fungsi doPost(e) untuk meneruskan pemanggilan google.script.run.
   --------------------------------------------------------------- */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_I_dlj3mECZAH6y0vKBwixkwO3W9vKk6ZZCqOi89Q0avR2IDjFGjNqsqTg0p-4L3WYA/exec';

if (typeof google === 'undefined' || !google.script || !google.script.run) {
  (function () {
    function callServer_(fnName, args, successHandler, failureHandler) {
      if (!SCRIPT_URL || SCRIPT_URL.indexOf('TEMPEL_') === 0) {
        const err = new Error('SCRIPT_URL belum diisi di JavaScript.html — tempel Web App URL Apps Script Anda dulu.');
        console.error(err.message);
        if (failureHandler) failureHandler(err);
        return;
      }
      fetch(SCRIPT_URL, {
        method: 'POST',
        // Sengaja pakai text/plain (BUKAN application/json) supaya browser
        // mengirim "simple request" tanpa preflight OPTIONS, karena Apps
        // Script Web App tidak mengimplementasikan doOptions().
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: fnName, args: args })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.__error) {
            if (failureHandler) failureHandler(new Error(data.message || 'Terjadi kesalahan di server.'));
          } else if (successHandler) {
            successHandler(data);
          }
        })
        .catch(function (err) {
          if (failureHandler) failureHandler(err);
        });
    }

    function makeRunner_(successHandler, failureHandler) {
      return new Proxy({}, {
        get: function (_target, prop) {
          if (prop === 'withSuccessHandler') {
            return function (cb) { return makeRunner_(cb, failureHandler); };
          }
          if (prop === 'withFailureHandler') {
            return function (cb) { return makeRunner_(successHandler, cb); };
          }
          if (prop === 'withUserObject') {
            return function () { return makeRunner_(successHandler, failureHandler); };
          }
          return function () {
            const args = Array.prototype.slice.call(arguments);
            callServer_(prop, args, successHandler, failureHandler);
          };
        }
      });
    }

    window.google = window.google || {};
    window.google.script = window.google.script || {};
    window.google.script.run = makeRunner_(null, null);
    window.google.script.host = window.google.script.host || { close: function () {} };
  })();
}

let KATEGORI_LIST = [];
let KABKOTA_LIST = [];
let BULAN_LIST = [];
const PROVINSI_LABEL_DEFAULT = 'Provinsi NTT';
let PROVINSI_LABEL = PROVINSI_LABEL_DEFAULT;

const ICONS = {
  beranda: '⌂', agregat: '🗂', provinsi: '🏛', kabkota: '📍',
  siak: '📄', folder: '📁', file: '📃'
};

/* ---------------- INIT ---------------- */
window.addEventListener('DOMContentLoaded', function () {
  bindMenuToggle();
  bindSearchBar();
  loadAppLogo();
  initApp();
});

function initApp() {
  const cachedRef = sessionStorage.getItem('sikondata_ref_publik');
  if (cachedRef) {
    applyReferenceData(JSON.parse(cachedRef));
    buildMenu();
    navigate('beranda');
  } else {
    showFullLoader('Memuat referensi data...');
    google.script.run
      .withSuccessHandler(function (ref) {
        sessionStorage.setItem('sikondata_ref_publik', JSON.stringify(ref));
        applyReferenceData(ref);
        hideFullLoader();
        buildMenu();
        navigate('beranda');
      })
      .withFailureHandler(handleServerError)
      .getReferenceData();
  }
}

function applyReferenceData(ref) {
  KATEGORI_LIST = ref.kategori;
  KABKOTA_LIST = ref.kabkota;
  BULAN_LIST = ref.bulan;
  PROVINSI_LABEL = ref.provinsiLabel || PROVINSI_LABEL_DEFAULT;
}

function handleServerError(err) {
  hideFullLoader();
  showToast('Kesalahan server: ' + err.message, 'error');
}

function loadAppLogo() {
  const cached = sessionStorage.getItem('sikondata_logo_publik');
  if (cached) { applyLogo(JSON.parse(cached)); return; }
  google.script.run
    .withSuccessHandler(function (res) {
      if (res.success) {
        sessionStorage.setItem('sikondata_logo_publik', JSON.stringify(res));
        applyLogo(res);
      }
    })
    .withFailureHandler(function () { /* biarkan tampil "SK" bila gagal memuat logo */ })
    .getAppLogo();
}

function applyLogo(res) {
  const dataUrl = 'data:' + res.mimeType + ';base64,' + res.base64;
  const el = document.getElementById('sidebar-mark');
  if (el) el.innerHTML = '<img src="' + dataUrl + '" alt="Logo">';
}

function bindMenuToggle() {
  document.getElementById('menu-toggle').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });
}

function bindSearchBar() {
  const input = document.getElementById('global-search');
  if (!input) return;
  let timer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    const q = input.value.trim();
    timer = setTimeout(function () {
      if (q.length >= 2) navigate('search', { query: q });
    }, 350);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { clearTimeout(timer); navigate('search', { query: input.value.trim() }); }
  });
}

/* ---------------- BUILD SIDEBAR MENU ---------------- */
function buildMenu() {
  const el = document.getElementById('menu-container');
  let html = '';

  html += menuLink('beranda', ICONS.beranda, 'Beranda', "navigate('beranda')");

  html += '<div class="menu-item">';
  html += '<a href="#" class="menu-link" onclick="toggleSubmenu(this);return false;">' +
          '<span class="ico">' + ICONS.agregat + '</span>Data Agregat Kependudukan' +
          '<span class="chev">▶</span></a>';
  html += '<div class="submenu">';
  html += menuLink('agregat-provinsi', ICONS.provinsi, PROVINSI_LABEL,
    "navigate('agregat', {wilayah:'" + esc(PROVINSI_LABEL) + "'})");

  html += '</div></div>';

  el.innerHTML = html;
}

function menuLink(id, ico, label, onclick) {
  return '<div class="menu-item"><a href="#" class="menu-link" data-nav="' + id + '" ' +
    'onclick="' + onclick + ';setActive(this);return false;">' +
    (ico ? '<span class="ico">' + ico + '</span>' : '<span class="ico"></span>') +
    label + '</a></div>';
}

function toggleSubmenu(linkEl) {
  linkEl.classList.toggle('open');
  linkEl.nextElementSibling.classList.toggle('open');
}

function setActive(linkEl) {
  document.querySelectorAll('.menu-link').forEach(function (a) { a.classList.remove('active'); });
  linkEl.classList.add('active');
  let parent = linkEl.closest('.submenu');
  while (parent) {
    parent.classList.add('open');
    const parentLink = parent.previousElementSibling;
    if (parentLink) parentLink.classList.add('open');
    parent = parent.parentElement.closest('.submenu');
  }
  if (window.innerWidth <= 860) document.getElementById('sidebar').classList.remove('mobile-open');
}

function esc(s) { return String(s).replace(/'/g, "\\'"); }

/* ---------------- ROUTER ---------------- */
function navigate(page, params) {
  params = params || {};
  const bc = document.getElementById('breadcrumb');
  const title = document.getElementById('page-title');
  const search = document.getElementById('global-search');
  if (page !== 'search' && search) search.value = '';

  if (page === 'beranda') {
    title.textContent = 'Beranda'; bc.innerHTML = '<b>Beranda</b>';
    renderBeranda();
  } else if (page === 'agregat') {
    title.textContent = params.wilayah;
    bc.innerHTML = 'Data Agregat Kependudukan / <b>' + params.wilayah + '</b>';
    renderKategoriFolders(params.wilayah);
  } else if (page === 'kategori-files') {
    title.textContent = params.kategori;
    bc.innerHTML = 'Data Agregat Kependudukan / ' + params.wilayah + ' / <b>' + params.kategori + '</b>';
    renderFileList(params.wilayah, params.kategori);
  } else if (page === 'siak') {
    title.textContent = 'Arsip Konsolidasi User SIAK'; bc.innerHTML = '<b>Arsip Konsolidasi User SIAK</b>';
    renderSiakFiles();
  } else if (page === 'search') {
    title.textContent = 'Hasil Pencarian'; bc.innerHTML = 'Pencarian / <b>"' + params.query + '"</b>';
    renderSearchResults(params.query);
  }
}

/* ---------------- BERANDA ---------------- */
function fmtId(n) { return (n === null || n === undefined || isNaN(n)) ? '-' : Number(n).toLocaleString('id-ID'); }
function fmtPctId(n) { return (n === null || n === undefined || isNaN(n)) ? '-' : n.toFixed(2).replace('.', ',') + '%'; }
function setHtml(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function noteBox(msg) { return '<div class="b-note">' + escapeHtml(msg) + '</div>'; }
function setStat(id, num, lbl) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="num">' + num + '</div><div class="lbl">' + lbl + '</div>';
}

let berandaProgres = null;   // hasil getBerandaProgres (untuk peringkat & selisih)
let berandaTren = null;      // hasil getBerandaTren
const SERIES_COLORS = ['#2563EB', '#F59E0B', '#16A34A', '#8B5CF6'];

function renderBeranda() {
  berandaProgres = null; berandaTren = null;
  const main = document.getElementById('main-content');
  main.innerHTML =
    '<div class="stat-grid">' +
      '<div class="stat-card accent" id="s-total"><div class="num">…</div><div class="lbl">Total Penduduk</div></div>' +
      '<div class="stat-card accent2" id="s-wil"><div class="num">…</div><div class="lbl">Kabupaten/Kota</div></div>' +
      '<div class="stat-card accent3" id="s-rasio"><div class="num">…</div><div class="lbl">Rasio Jenis Kelamin</div></div>' +
      '<div class="stat-card accent" id="s-cutoff"><div class="num">…</div><div class="lbl">Data layanan per</div></div>' +
    '</div>' +
    '<div class="beranda-grid">' +
      '<div class="panel"><h3>Penduduk Provinsi NTT Menurut Jenis Kelamin</h3>' +
        '<div class="b-fill" id="b-gender">' + loaderInline('Memuat data penduduk...') + '</div></div>' +
      '<div class="panel"><h3>5 Kab/Kota dengan Penduduk Terbanyak</h3>' +
        '<div class="b-fill" id="b-top5">' + loaderInline('Memuat data penduduk...') + '</div></div>' +
      '<div class="panel"><h3>Tren Progres Layanan Bulanan</h3>' +
        '<div class="b-fill" id="b-tren">' + loaderInline('Memuat tren...') + '</div></div>' +
      '<div class="panel card-wide"><h3 id="b-progres-title">Progres Layanan Dokumen Kependudukan Tingkat Provinsi NTT</h3>' +
        '<div id="b-progres">' + loaderInline('Memuat progres layanan...') + '</div></div>' +
      '<div class="panel card-wide"><h3>Peringkat Capaian Kab/Kota</h3>' +
        '<div id="b-rank">' + loaderInline('Memuat peringkat...') + '</div></div>' +
      '<div class="panel card-wide"><h3>Cara Membaca Data</h3>' + glossaryHtml() + '</div>' +
    '</div>';

  google.script.run
    .withSuccessHandler(function (d) {
      if (!d.success) {
        setHtml('b-gender', noteBox(d.message)); setHtml('b-top5', noteBox(d.message));
        setStat('s-total', '-', 'Total Penduduk'); setStat('s-wil', '-', 'Kabupaten/Kota'); setStat('s-rasio', '-', 'Rasio Jenis Kelamin');
        return;
      }
      setHtml('b-gender', genderCard(d));
      setHtml('b-top5', top5Card(d));
      setStat('s-total', fmtId(d.total), 'Total Penduduk &middot; ' + escapeHtml(d.periode));
      setStat('s-wil', fmtId(d.jumlahWilayah), 'Kabupaten/Kota');
      const rasio = d.pr ? (d.lk / d.pr * 100) : null;
      setStat('s-rasio', rasio === null ? '-' : rasio.toFixed(1).replace('.', ','), 'Rasio Jenis Kelamin (LK per 100 PR)');
    })
    .withFailureHandler(function (err) { setHtml('b-gender', errorBox(err.message)); setHtml('b-top5', errorBox(err.message)); })
    .getBerandaPenduduk();

  google.script.run
    .withSuccessHandler(function (d) {
      if (!d.success) { setHtml('b-progres', noteBox(d.message)); setHtml('b-rank', noteBox(d.message)); setStat('s-cutoff', '-', 'Data layanan per'); return; }
      berandaProgres = d;
      setHtml('b-progres-title', 'Progres Layanan Dokumen Kependudukan Tingkat Provinsi NTT per ' + escapeHtml(d.cutoff));
      setHtml('b-progres', progresCard(d));
      setHtml('b-rank', rankCard(d, 0));
      const p = d.cutoff.split(' ');
      setStat('s-cutoff', p[0] + ' ' + p[1].substring(0, 3) + ' ' + p[2], 'Data layanan per cutoff terkini');
      applyDeltas();
    })
    .withFailureHandler(function (err) { setHtml('b-progres', errorBox(err.message)); setHtml('b-rank', errorBox(err.message)); })
    .getBerandaProgres();

  loadTren(0);
}

/* ---- tren (dihitung bertahap di server bila belum pernah dibaca) ---- */
function loadTren(attempt) {
  google.script.run
    .withSuccessHandler(function (d) {
      if (!d.success) { setHtml('b-tren', noteBox(d.message)); return; }
      berandaTren = d;
      let html = trenCard(d);
      if (d.pending > 0) html += '<div class="b-note" style="margin-top:8px;">Menyiapkan riwayat bulan sebelumnya (' + d.pending + ' dokumen tersisa)...</div>';
      setHtml('b-tren', html);
      applyDeltas();
      if (d.pending > 0 && attempt < 15 && document.getElementById('b-tren')) loadTren(attempt + 1);
    })
    .withFailureHandler(function (err) { setHtml('b-tren', errorBox(err.message)); })
    .getBerandaTren();
}

function trenCard(d) {
  const W = 520, H = 250, L = 34, R = 12, T = 10, B = 26;
  const n = d.bulan.length, pw = W - L - R, ph = H - T - B;
  const x = function (i) { return n === 1 ? L + pw / 2 : L + pw * i / (n - 1); };
  const y = function (v) { return T + ph * (1 - v / 100); };
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="line-chart" role="img" aria-label="Tren progres layanan bulanan">';
  [0, 25, 50, 75, 100].forEach(function (g) {
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#E2E9F7" stroke-width="1"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(g) + 3.5) + '" text-anchor="end" class="axis-t">' + g + '%</text>';
  });
  d.bulan.forEach(function (b, i) {
    svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" class="axis-t">' + escapeHtml(b) + '</text>';
  });
  d.series.forEach(function (s, k) {
    const col = SERIES_COLORS[k % SERIES_COLORS.length];
    let path = '', pen = false;
    s.values.forEach(function (v, i) {
      if (v === null || v === undefined) { pen = false; return; }
      path += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      pen = true;
    });
    svg += '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    s.values.forEach(function (v, i) {
      if (v === null || v === undefined) return;
      svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.4" fill="' + col + '"><title>' +
        escapeHtml(s.label + ' · ' + d.bulan[i] + ' ' + d.tahun + ': ' + fmtPctId(v)) + '</title></circle>';
    });
  });
  svg += '</svg>';

  let legend = '<div class="chart-legend">';
  d.series.forEach(function (s, k) {
    let last = null;
    s.values.forEach(function (v) { if (v !== null && v !== undefined) last = v; });
    legend += '<span class="cl-item"><span class="legend-dot" style="background:' + SERIES_COLORS[k % SERIES_COLORS.length] + ';margin:0;"></span>' +
      escapeHtml(s.label) + ' <b>' + fmtPctId(last) + '</b></span>';
  });
  legend += '</div>';
  return '<div class="b-sub">Januari – ' + escapeHtml(d.bulan[d.bulan.length - 1]) + ' ' + d.tahun + '</div>' + svg + legend;
}

/* ---- selisih dibanding bulan sebelumnya (di kartu progres) ---- */
function applyDeltas() {
  if (!berandaProgres || !berandaTren || berandaProgres.tahun !== berandaTren.tahun) return;
  const bi = berandaProgres.bulanIdx;
  if (bi < 1) return;
  berandaProgres.items.forEach(function (it, n) {
    const el = document.getElementById('delta-' + n);
    const s = berandaTren.series[n];
    if (!el || !s || !it.available || it.pct === null) return;
    const prev = s.values[bi - 1];
    if (prev === null || prev === undefined) return;
    const diff = it.pct - prev;
    const nm = BULAN_LIST[bi - 1] || '';
    let cls = 'delta-flat', txt;
    if (Math.abs(diff) < 0.005) txt = '&#9644; tetap dari ' + nm;
    else if (diff > 0) { cls = 'delta-up'; txt = '&#9650; ' + diff.toFixed(2).replace('.', ',') + ' poin dari ' + nm; }
    else { cls = 'delta-down'; txt = '&#9660; ' + Math.abs(diff).toFixed(2).replace('.', ',') + ' poin dari ' + nm; }
    el.className = 'delta ' + cls;
    el.innerHTML = txt;
  });
}

/* ---- donat, top 5 ---- */
function donutSvg(lk, pr, total) {
  const C = 2 * Math.PI * 70, sum = (lk + pr) || 1;
  const lkL = C * lk / sum, prL = C * pr / sum;
  return '<svg viewBox="0 0 200 200" class="donut" role="img" aria-label="Komposisi penduduk laki-laki dan perempuan">' +
    '<g transform="rotate(-90 100 100)">' +
    '<circle cx="100" cy="100" r="70" fill="none" stroke="#E8F0FE" stroke-width="28"/>' +
    '<circle cx="100" cy="100" r="70" fill="none" stroke="#2563EB" stroke-width="28" stroke-dasharray="' + lkL + ' ' + (C - lkL) + '"/>' +
    '<circle cx="100" cy="100" r="70" fill="none" stroke="#F59E0B" stroke-width="28" stroke-dasharray="' + prL + ' ' + (C - prL) + '" stroke-dashoffset="' + (-lkL) + '"/>' +
    '</g>' +
    '<text x="100" y="98" text-anchor="middle" class="donut-num">' + fmtId(total) + '</text>' +
    '<text x="100" y="116" text-anchor="middle" class="donut-lbl">Total Penduduk</text></svg>';
}

function genderCard(d) {
  const sum = (d.lk + d.pr) || 1;
  const legend = function (color, name, val) {
    return '<div class="legend-item"><span class="legend-dot" style="background:' + color + ';"></span><div>' +
      '<div class="legend-name">' + name + '</div>' +
      '<div class="legend-val">' + fmtId(val) + '</div>' +
      '<div class="legend-pct">' + fmtPctId(val / sum * 100) + '</div></div></div>';
  };
  return '<div class="b-sub">Data ' + escapeHtml(d.periode) + '</div>' +
    '<div class="donut-wrap">' + donutSvg(d.lk, d.pr, d.total) +
    '<div class="legend">' + legend('#2563EB', 'Laki-laki', d.lk) + legend('#F59E0B', 'Perempuan', d.pr) + '</div></div>';
}

function top5Card(d) {
  if (!d.top || !d.top.length) return noteBox('Data Kab/Kota belum tersedia.');
  const max = d.top[0].jumlah || 1;
  let html = '<div class="b-sub">Data ' + escapeHtml(d.periode) + '</div><div class="b-fill">';
  d.top.forEach(function (r, i) {
    html += '<div class="hbar-row"><div class="hbar-name"><span class="rk-no">' + (i + 1) + '</span>' + escapeHtml(r.nama) + '</div>' +
      '<div class="hbar-track"><div class="hbar-fill" style="width:' + Math.max(2, Math.round(r.jumlah / max * 100)) + '%"></div></div>' +
      '<div class="hbar-val">' + fmtId(r.jumlah) + '</div></div>';
  });
  return html + '</div>';
}

/* ---- progres ---- */
function progresCard(d) {
  let html = '<div class="prog-grid">';
  d.items.forEach(function (it, n) {
    html += '<div class="prog-item"><div class="prog-head"><span class="prog-label">' + escapeHtml(it.label) + '</span>';
    if (!it.available || it.pct === null) {
      html += '</div><div class="prog-meta">' + escapeHtml(it.message || 'Data belum tersedia.') + '</div></div>';
      return;
    }
    const w = Math.max(0, Math.min(100, it.pct));
    html += '<span class="prog-pct">' + fmtPctId(it.pct) + '</span></div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
      '<div class="prog-meta">' + escapeHtml(it.numLabel) + ' ' + fmtId(it.num) + ' dari ' + fmtId(it.den) + ' (' + escapeHtml(it.denLabel) + ')</div>' +
      '<div class="delta" id="delta-' + n + '"></div></div>';
  });
  return html + '</div>';
}

/* ---- peringkat Kab/Kota (tab per layanan) ---- */
function rankCard(d, idx) {
  let tabs = '<div class="sheet-tabs">';
  d.items.forEach(function (it, i) {
    tabs += '<button class="sheet-tab' + (i === idx ? ' active' : '') + '" onclick="showRank(' + i + ')">' + escapeHtml(it.label) + '</button>';
  });
  tabs += '</div>';
  const it = d.items[idx];
  if (!it || !it.available || !it.rank || !it.rank.length) {
    return tabs + noteBox('Peringkat belum tersedia untuk layanan ini.');
  }
  const n = it.rank.length;
  let html = tabs + '<div class="b-sub">Per ' + escapeHtml(d.cutoff) + ' &middot; hijau = 3 tertinggi, merah = 3 terendah</div><div class="rk-grid">';
  it.rank.forEach(function (r, i) {
    const cls = i < 3 ? 'rk-top' : (i >= n - 3 ? 'rk-low' : '');
    const w = Math.max(1, Math.min(100, r.p));
    html += '<div class="rk-row"><span class="rk-no">' + (i + 1) + '</span><span class="rk-name">' + escapeHtml(r.n) + '</span>' +
      '<div class="hbar-track rk-track"><div class="hbar-fill ' + cls + '" style="width:' + w + '%"></div></div>' +
      '<span class="rk-val">' + fmtPctId(r.p) + '</span></div>';
  });
  return html + '</div>';
}

function showRank(i) {
  if (berandaProgres) setHtml('b-rank', rankCard(berandaProgres, i));
}

/* ---- penjelasan istilah ---- */
function glossaryHtml() {
  const items = [
    ['WKTP (Wajib KTP-el)', 'Penduduk yang wajib memiliki KTP-el, yaitu yang berusia 17 tahun ke atas, atau sudah/pernah kawin. Progres perekaman dihitung terhadap kelompok ini.'],
    ['IKD (Identitas Kependudukan Digital)', 'KTP digital di ponsel. Progres aktivasi IKD dihitung dari penduduk yang sudah merekam KTP-el.'],
    ['KIA (Kartu Identitas Anak)', 'Kartu identitas untuk anak. Progresnya menunjukkan persentase anak yang sudah memiliki KIA.'],
    ['Akta Kelahiran 0-4 Tahun', 'Persentase anak usia 0-4 tahun yang sudah memiliki akta kelahiran.'],
    ['Awal dan Dinamis', 'Data "Awal" adalah data dasar, sedangkan "Dinamis" adalah data yang diperbarui mengikuti perubahan penduduk. Persentase pada Beranda memakai data dinamis.'],
    ['Sumber dan pembaruan', 'Data berasal dari dokumen agregat yang diunggah Dinas Kependudukan dan Pencatatan Sipil Provinsi NTT dan diperbarui setiap bulan. Jumlah penduduk diperbarui per semester.']
  ];
  return items.map(function (x) {
    return '<details class="gloss"><summary>' + escapeHtml(x[0]) + '</summary><p>' + escapeHtml(x[1]) + '</p></details>';
  }).join('');
}

function statCard(num, lbl, accentClass) {
  return '<div class="stat-card ' + (accentClass || '') + '">' +
    '<div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
}

/* ---------------- 10 FOLDER KATEGORI ---------------- */
function renderKategoriFolders(wilayah) {
  const main = document.getElementById('main-content');
  let html = '<div class="folder-grid">';
  KATEGORI_LIST.forEach(function (kat) {
    html += '<div class="folder-card" onclick="navigate(\'kategori-files\',' +
      '{wilayah:\'' + esc(wilayah) + '\',kategori:\'' + esc(kat) + '\'})">' +
      '<div class="folder-ico">' + ICONS.folder + '</div>' +
      '<div class="folder-name">' + kat + '</div>' +
      '<div class="folder-count">Folder dokumen</div></div>';
  });
  html += '</div>';
  main.innerHTML = html;
}

/* ---------------- DAFTAR FILE DALAM 1 KATEGORI ---------------- */
function renderFileList(wilayah, kategori) {
  const main = document.getElementById('main-content');
  main.innerHTML = loaderInline('Memuat daftar dokumen...');

  google.script.run
    .withSuccessHandler(function (files) {
      main.innerHTML = filesPanel(files, wilayah, kategori);
    })
    .withFailureHandler(function (err) { main.innerHTML = errorBox(err.message); })
    .getFolderContents(wilayah, kategori);
}

function renderSiakFiles() {
  const main = document.getElementById('main-content');
  main.innerHTML = loaderInline('Memuat arsip konsolidasi SIAK...');
  google.script.run
    .withSuccessHandler(function (files) { main.innerHTML = filesPanel(files, null, null, true); })
    .withFailureHandler(function (err) { main.innerHTML = errorBox(err.message); })
    .getKonsolidasiSiakFiles();
}

function filesPanel(files, wilayah, kategori, isSiak, isSearch) {
  let html = '<div class="panel">';
  html += '<h3>' + (isSearch ? 'Hasil Pencarian' : (isSiak ? 'Dokumen Konsolidasi User SIAK' : kategori + ' — ' + wilayah)) +
    ' <span style="font-weight:400;color:#5B6B77;font-size:12px;">(' + files.length + ' dokumen)</span></h3>';

  if (!files.length) {
    html += '<div class="empty-state"><div class="big">🗄</div>Belum ada dokumen ditemukan.</div>';
  } else {
    files.forEach(function (f) {
      const tag = f.tahun ? '<span class="tag-chip">' + (f.bulan ? f.bulan + ' ' : '') + f.tahun + '</span>' : '';
      const ctx = isSearch ? '<div class="file-meta">' + (f.jenis === 'siak' ? 'Konsolidasi SIAK' : (f.wilayah + ' / ' + f.kategori)) + '</div>' : '';
      html += '<div class="file-row">' +
        '<span class="file-ico">' + ICONS.file + '</span>' +
        '<div><div class="file-name">' + f.name + ' ' + tag + '</div>' +
        ctx +
        '<div class="file-meta">' + formatSize(f.size) + ' &middot; ' + formatDate(f.ts || f.updated) + '</div></div>' +
        '<div class="file-actions">' +
        '<button class="btn-sm" onclick="previewFile(\'' + f.id + '\',\'' + esc(f.mime || '') + '\',\'' + esc(f.name) + '\')">Lihat</button>' +
        '<button class="btn-sm" onclick="downloadFile(\'' + f.id + '\',\'' + esc(f.name) + '\')">Unduh</button>' +
        '</div></div>';
    });
  }
  html += '</div>';
  return html;
}

/* ---------------- PENCARIAN ---------------- */
function renderSearchResults(query) {
  const main = document.getElementById('main-content');
  main.innerHTML = loaderInline('Mencari dokumen...');
  document.querySelectorAll('.menu-link').forEach(function (a) { a.classList.remove('active'); });

  google.script.run
    .withSuccessHandler(function (files) { main.innerHTML = filesPanel(files, null, null, false, true); })
    .withFailureHandler(function (err) { main.innerHTML = errorBox(err.message); })
    .searchFiles(query, {});
}

/* ---------------- LIHAT & UNDUH DOKUMEN ---------------- */
let currentPreviewFileId = null;
let currentPreviewName = null;
let currentSheetsData = null;
let currentSheetsNotes = [];

function isExcelMime(mime, name) {
  mime = mime || '';
  name = (name || '').toLowerCase();
  if (mime.indexOf('spreadsheetml') !== -1) return true;           // .xlsx
  if (mime === 'application/vnd.ms-excel') return true;             // .xls
  if (mime === 'application/vnd.google-apps.spreadsheet') return true;
  return /\.(xlsx|xls)$/.test(name);
}

function previewFile(fileId, mime, name) {
  currentPreviewFileId = fileId;
  currentPreviewName = name;
  openModal(name || 'Pratinjau Dokumen', true);

  if (isExcelMime(mime, name)) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (!res.success) {
          closeModal();
          showToast(res.message, 'error');
          if (res.tooLarge && res.url) window.open(res.url, '_blank');
          return;
        }
        renderSpreadsheetPreview(res);
      })
      .withFailureHandler(function (err) { closeModal(); showToast('Gagal memuat pratinjau: ' + err.message, 'error'); })
      .getSpreadsheetPreview(fileId);
    return;
  }

  google.script.run
    .withSuccessHandler(function (res) {
      if (!res.success) {
        closeModal();
        showToast(res.message, 'error');
        if (res.tooLarge && res.url) window.open(res.url, '_blank');
        return;
      }
      renderPreview(res);
    })
    .withFailureHandler(function (err) { closeModal(); showToast('Gagal memuat pratinjau: ' + err.message, 'error'); })
    .getFileBlob(fileId);
}

function renderPreview(res) {
  const mime = res.mimeType || '';
  const dataUrl = 'data:' + mime + ';base64,' + res.base64;
  let body;

  if (mime.indexOf('image/') === 0) {
    body = '<img src="' + dataUrl + '" style="max-width:100%;max-height:68vh;display:block;margin:0 auto;border-radius:6px;">';
  } else if (mime === 'application/pdf') {
    body = '<iframe src="' + dataUrl + '" style="width:100%;height:68vh;border:none;border-radius:6px;background:#fff;"></iframe>';
  } else if (mime.indexOf('text/') === 0 || mime === 'application/json') {
    body = '<div class="preview-text">' + escapeHtml(decodeUtf8Base64(res.base64)).slice(0, 20000) + '</div>';
  } else {
    body = '<div class="empty-state"><div class="big">📄</div>Pratinjau langsung tidak didukung untuk tipe file ini.<br>Silakan unduh dokumen untuk membukanya.</div>';
  }

  document.getElementById('modal-title').textContent = res.name;
  document.getElementById('modal-body').innerHTML = body;
  setModalFooter();
}

function renderSpreadsheetPreview(res) {
  currentSheetsData = res.sheets;
  currentSheetsNotes = res.notes || [];
  document.getElementById('modal-title').textContent = res.name;
  renderSheetTable(0);
  setModalFooter();
}

function renderSheetTable(idx) {
  const sheets = currentSheetsData;
  if (!sheets || !sheets.length) {
    document.getElementById('modal-body').innerHTML = '<div class="empty-state">Sheet kosong.</div>';
    return;
  }
  let tabsHtml = '';
  if (sheets.length > 1) {
    tabsHtml = '<div class="sheet-tabs">' + sheets.map(function (s, i) {
      return '<button class="sheet-tab' + (i === idx ? ' active' : '') + '" onclick="renderSheetTable(' + i + ')">' + escapeHtml(s.name) + '</button>';
    }).join('') + '</div>';
  }
  const rows = sheets[idx].rows;
  let tableHtml;
  if (!rows.length) {
    tableHtml = '<div class="empty-state">Sheet ini kosong.</div>';
  } else {
    tableHtml = '<div class="sheet-table-wrap"><table class="sheet-table"><tbody>';
    rows.forEach(function (row, r) {
      tableHtml += '<tr>' + row.map(function (cell) {
        const tag = r === 0 ? 'th' : 'td';
        return '<' + tag + '>' + escapeHtml(cell) + '</' + tag + '>';
      }).join('') + '</tr>';
    });
    tableHtml += '</tbody></table></div>';
  }
  let notesHtml = '';
  if (currentSheetsNotes && currentSheetsNotes.length) {
    notesHtml = '<div style="font-size:12px;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:8px 12px;margin-bottom:10px;">' +
      currentSheetsNotes.map(escapeHtml).join('<br>') + '</div>';
  }
  document.getElementById('modal-body').innerHTML = notesHtml + tabsHtml + tableHtml;
}

function setModalFooter() {
  document.getElementById('modal-foot').innerHTML =
    '<button class="btn-sm" onclick="closeModal()">Tutup</button>' +
    '<button class="btn-sm" style="background:linear-gradient(135deg,var(--blue-600),var(--blue-800));color:#fff;border-color:transparent;" onclick="downloadCurrentPreview()">Unduh Dokumen</button>';
}

function downloadCurrentPreview() {
  if (!currentPreviewFileId) return;
  downloadFile(currentPreviewFileId, currentPreviewName);
}

function downloadFile(fileId, fallbackName) {
  showToast('Menyiapkan unduhan...', '');
  google.script.run
    .withSuccessHandler(function (res) {
      if (!res.success) {
        if (res.tooLarge && res.url) { window.open(res.url, '_blank'); }
        showToast(res.message, 'error');
        return;
      }
      triggerBrowserDownload(res.base64, res.mimeType, res.name || fallbackName);
      showToast('Unduhan dimulai.', 'success');
    })
    .withFailureHandler(function (err) { showToast('Gagal mengunduh: ' + err.message, 'error'); })
    .getFileBlob(fileId);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function decodeUtf8Base64(base64) {
  return new TextDecoder('utf-8').decode(base64ToBytes(base64));
}
function triggerBrowserDownload(base64, mime, filename) {
  const bytes = base64ToBytes(base64);
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'dokumen';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------- MODAL ---------------- */
function openModal(title, loading) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = loading ? loaderInline('Memuat dokumen...') : '';
  document.getElementById('modal-foot').innerHTML = '';
  document.getElementById('preview-modal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('preview-modal').style.display = 'none';
  currentPreviewFileId = null;
  currentPreviewName = null;
  currentSheetsData = null;
  currentSheetsNotes = [];
}

/* ---------------- UTIL UI ---------------- */
function loaderInline(msg) {
  return '<div class="empty-state"><div class="spinner" style="width:22px;height:22px;border-color:#BFD6FF;border-top-color:#1D4ED8;"></div><br>' + msg + '</div>';
}
function errorBox(msg) {
  return '<div class="panel"><div style="background:#FDECEC;border:1px solid #F5C2C2;color:#B91C1C;font-size:12.5px;padding:9px 12px;border-radius:12px;">Gagal memuat data: ' + msg + '</div></div>';
}
function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(0) + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
}
function formatDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () { t.style.display = 'none'; }, 3500);
}
function showFullLoader(msg) {
  let el = document.getElementById('full-loader');
  if (!el) { el = document.createElement('div'); el.id = 'full-loader'; el.className = 'loader-full'; document.body.appendChild(el); }
  el.innerHTML = '<div class="spin-big"></div>' + msg;
  el.style.display = 'flex';
}
function hideFullLoader() {
  const el = document.getElementById('full-loader');
  if (el) el.style.display = 'none';
}
