/* ==========================================================
   PETA TEMATIK DATA AGREGAT — Si-Detektif
   Peta choropleth 22 Kab/Kota Provinsi NTT (SVG murni, tanpa pustaka luar).
   Data   : google.script.run.getPetaTematik()  (Code.gs)
   Batas  : window.NTT_GEO                        (ntt-geo.js)
   Bergantung pada fungsi di app.js: fmtId, fmtPctId, escapeHtml,
   loaderInline, errorBox, showToast.
   ========================================================== */

const PETA = {
  data: null,        // hasil getPetaTematik (di-cache selama halaman terbuka)
  shapes: null,      // path SVG per wilayah (dihitung sekali)
  W: 760, H: 350,
  byKode: {}, byName: {},
  inds: [], active: 0, sel: null, labels: 'both'
};

const PETA_PALETTES = {
  num:   ['#EAF1FF', '#BFD6FF', '#7FA8F5', '#3B6FE0', '#123C86'],
  ratio: ['#F3EEFF', '#D9C9FB', '#B196F2', '#8456E0', '#4C1D95'],
  pct:   ['#E9F8EF', '#B7E7C9', '#6FCB95', '#2FA462', '#0F6B3A']
};
const PETA_NODATA = '#E5E7EB';

/* ---------------- util ---------------- */
function petaKey(s) {
  let k = String(s || '').toUpperCase()
    .replace(/\(.*?\)/g, '')
    .replace(/KABUPATEN/g, '')
    .replace(/^\s*KAB\b\.?/, '')
    .replace(/[^A-Z0-9]/g, '');
  const alias = { TIMORTENGAHSELATAN: 'TTS', TIMORTENGAHUTARA: 'TTU' };
  return alias[k] || k;
}

function petaMatch(kode, nama) {
  const kd = String(kode || '').replace(/\D/g, '');
  if (kd && PETA.byKode[kd]) return kd;
  return PETA.byName[petaKey(nama)] || null;
}

function petaShort(nama) { return String(nama).replace(/^Kab\.\s*/, ''); }

/* ---------------- geometri -> path SVG ---------------- */
function petaBuildShapes() {
  if (PETA.shapes) return;
  const feats = window.NTT_GEO.features;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const k = Math.cos(-9.5 * Math.PI / 180);
  const proj = function (c) { return [c[0] * k, -c[1]]; };

  function eachRing(geom, fn) {
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    polys.forEach(function (poly) { poly.forEach(function (ring, ri) { fn(ring, ri, poly); }); });
  }
  feats.forEach(function (f) {
    eachRing(f.geometry, function (ring) {
      ring.forEach(function (c) {
        const p = proj(c);
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
    });
  });

  const pad = 10;
  const sc = (PETA.W - pad * 2) / (maxX - minX);
  PETA.H = Math.round((maxY - minY) * sc + pad * 2);
  const tx = function (c) { const p = proj(c); return [(p[0] - minX) * sc + pad, (p[1] - minY) * sc + pad]; };

  PETA.byKode = {}; PETA.byName = {}; PETA.byKodeNama = {};
  PETA.shapes = feats.map(function (f) {
    const kode = f.properties.kode, nama = f.properties.nama;
    PETA.byKode[kode] = kode; PETA.byKodeNama[kode] = nama;
    PETA.byName[petaKey(nama)] = kode;

    let d = '', best = null, bestArea = -1;
    eachRing(f.geometry, function (ring, ri) {
      const pts = ring.map(tx);
      d += 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z';
      if (ri === 0) {
        let a = 0, cx = 0, cy = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const cr = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
          a += cr; cx += (pts[i][0] + pts[i + 1][0]) * cr; cy += (pts[i][1] + pts[i + 1][1]) * cr;
        }
        a /= 2;
        if (Math.abs(a) > bestArea && a !== 0) { bestArea = Math.abs(a); best = { cx: cx / (6 * a), cy: cy / (6 * a) }; }
      }
    });
    const c = best || { cx: PETA.W / 2, cy: PETA.H / 2 };
    return { kode: kode, nama: nama, d: d, cx: c.cx, cy: c.cy, area: bestArea };
  });
}

/* ---------------- indikator ---------------- */
function petaBuildIndicators(d) {
  const inds = [];

  if (d.penduduk && d.penduduk.rows && d.penduduk.rows.length) {
    const tot = {}, rasio = {};
    let sTot = 0, sLk = 0, sPr = 0;
    d.penduduk.rows.forEach(function (r) {
      const key = petaMatch(r.kode, r.nama);
      if (!key) return;
      if (r.total !== null && r.total !== undefined) { tot[key] = r.total; sTot += r.total; }
      if (r.lk && r.pr) { rasio[key] = r.lk / r.pr * 100; sLk += r.lk; sPr += r.pr; }
    });
    inds.push({
      id: 'pend', label: 'Jumlah Penduduk', short: 'Penduduk', kind: 'num', pal: 'num',
      unit: 'jiwa', periode: d.penduduk.periode, vals: tot,
      prov: sTot || null, provLabel: 'Total Provinsi', fmt: fmtId,
      desc: 'Jumlah penduduk menurut data agregat kependudukan.'
    });
    if (Object.keys(rasio).length) {
      inds.push({
        id: 'rasio', label: 'Rasio Jenis Kelamin', short: 'Rasio JK', kind: 'ratio', pal: 'ratio',
        unit: 'LK per 100 PR', periode: d.penduduk.periode, vals: rasio,
        prov: sPr ? sLk / sPr * 100 : null, provLabel: 'Rasio Provinsi',
        fmt: function (n) { return n.toFixed(1).replace('.', ','); },
        desc: 'Jumlah penduduk laki-laki untuk setiap 100 penduduk perempuan.'
      });
    }
  }

  if (d.progres && d.progres.items) {
    d.progres.items.forEach(function (it, i) {
      if (!it.available || !it.rank || !it.rank.length) return;
      const v = {};
      it.rank.forEach(function (r) {
        const key = petaMatch(null, r.n);
        if (key && r.p !== null && r.p !== undefined) v[key] = r.p;
      });
      if (!Object.keys(v).length) return;
      inds.push({
        id: 'pg' + i, label: 'Capaian ' + it.label, short: it.label, kind: 'pct', pal: 'pct',
        unit: '%', periode: 'Per ' + d.progres.cutoff, vals: v,
        prov: it.pct, provLabel: 'Capaian Provinsi', fmt: fmtPctId,
        desc: (it.numLabel ? it.numLabel + ' terhadap ' + String(it.denLabel || '').toLowerCase() + '.' : '')
      });
    });
  }
  return inds;
}

/* ---------------- klasifikasi (kuantil, 5 kelas) ---------------- */
function petaClassify(ind) {
  const keys = Object.keys(ind.vals);
  const arr = keys.map(function (k) { return ind.vals[k]; }).sort(function (a, b) { return a - b; });
  const n = Math.min(5, arr.length);
  const br = [];
  for (let i = 1; i < n; i++) br.push(arr[Math.max(0, Math.round(i * arr.length / n) - 1)]);
  br.push(arr[arr.length - 1]);
  const uniq = br.filter(function (v, i) { return i === 0 || v > br[i - 1]; });

  const klass = {};
  const lo = uniq.map(function () { return Infinity; }), hi = uniq.map(function () { return -Infinity; });
  keys.forEach(function (k) {
    const v = ind.vals[k];
    let c = uniq.findIndex(function (b) { return v <= b; });
    if (c < 0) c = uniq.length - 1;
    klass[k] = c;
    if (v < lo[c]) lo[c] = v;
    if (v > hi[c]) hi[c] = v;
  });
  const pal = PETA_PALETTES[ind.pal];
  const colors = uniq.map(function (_, i) {
    return pal[uniq.length === 1 ? 2 : Math.round(i * (pal.length - 1) / (uniq.length - 1))];
  });
  const ranked = keys.slice().sort(function (a, b) { return ind.vals[b] - ind.vals[a]; });
  return { klass: klass, lo: lo, hi: hi, colors: colors, ranked: ranked, count: uniq.length };
}

function petaFill(ind, cl, kode) {
  return cl.klass[kode] === undefined ? PETA_NODATA : cl.colors[cl.klass[kode]];
}

/* ---------------- tampilan utama ---------------- */
function renderPeta() {
  const main = document.getElementById('main-content');
  main.innerHTML = loaderInline('Memuat peta tematik...');

  if (!window.NTT_GEO) { main.innerHTML = errorBox('Berkas batas wilayah (ntt-geo.js) belum termuat.'); return; }
  petaBuildShapes();

  if (PETA.data) { petaStart(PETA.data); return; }
  google.script.run
    .withSuccessHandler(function (d) {
      if (!d || !d.success) { main.innerHTML = '<div class="panel">' + noteBox((d && d.message) || 'Data peta belum tersedia.') + '</div>'; return; }
      PETA.data = d;
      petaStart(d);
    })
    .withFailureHandler(function (err) { main.innerHTML = errorBox(err.message); })
    .getPetaTematik();
}

function petaStart(d) {
  PETA.inds = petaBuildIndicators(d);
  const main = document.getElementById('main-content');
  if (!PETA.inds.length) {
    main.innerHTML = '<div class="panel">' + noteBox('Belum ada data agregat yang dapat dipetakan.') + '</div>';
    return;
  }
  if (PETA.active >= PETA.inds.length) PETA.active = 0;
  PETA.sel = null;

  main.innerHTML =
    '<div class="panel pt-intro"><b>Peta Tematik Data Agregat</b> menampilkan sebaran data kependudukan di 22 Kabupaten/Kota ' +
      'Provinsi NTT. Pilih indikator, lalu arahkan kursor atau ketuk wilayah untuk melihat rinciannya.</div>' +
    '<div class="sheet-tabs pt-tabs" id="pt-tabs"></div>' +
    '<div class="stat-grid" id="pt-stats"></div>' +
    '<div class="pt-grid">' +
      '<div class="panel pt-mapcard">' +
        '<div class="pt-maphead"><h3 id="pt-title"></h3>' +
          '<div class="pt-tools"><label class="pt-chk">Label <select id="pt-lbl"><option value="both">Nama &amp; nilai</option><option value="name">Nama saja</option><option value="none">Tanpa label</option></select></label>' +
          '<button class="btn-sm" id="pt-png">Unduh PNG</button></div></div>' +
        '<div class="pt-mapbox" id="pt-mapbox"><svg id="pt-svg" viewBox="0 0 ' + PETA.W + ' ' + PETA.H + '" role="img" aria-label="Peta tematik Provinsi NTT"></svg>' +
          '<div class="pt-tip" id="pt-tip"></div></div>' +
        '<div class="pt-legend" id="pt-legend"></div>' +
        '<div class="b-note" id="pt-src"></div>' +
      '</div>' +
      '<div class="pt-side">' +
        '<div class="panel" id="pt-detail"></div>' +
        '<div class="panel" id="pt-rank"></div>' +
      '</div>' +
    '</div>';

  document.getElementById('pt-lbl').addEventListener('change', function (e) { PETA.labels = e.target.value; petaDrawMap(); });
  document.getElementById('pt-png').addEventListener('click', petaDownloadPng);
  document.getElementById('pt-lbl').value = PETA.labels;
  petaBindMap();
  petaRefresh();
}

function petaSelectIndicator(i) { PETA.active = i; petaRefresh(); }

function petaRefresh() {
  const ind = PETA.inds[PETA.active];
  const cl = petaClassify(ind);
  PETA.cl = cl;

  document.getElementById('pt-tabs').innerHTML = PETA.inds.map(function (x, i) {
    return '<button class="sheet-tab' + (i === PETA.active ? ' active' : '') + '" onclick="petaSelectIndicator(' + i + ')">' + escapeHtml(x.short) + '</button>';
  }).join('');

  // kartu ringkas
  const hiK = cl.ranked[0], loK = cl.ranked[cl.ranked.length - 1];
  const nm = function (k) { return escapeHtml(petaShort(PETA.byKodeNama[k])); };
  document.getElementById('pt-stats').innerHTML =
    '<div class="stat-card accent"><div class="num">' + (ind.prov !== null && ind.prov !== undefined ? ind.fmt(ind.prov) : '-') + '</div><div class="lbl">' + escapeHtml(ind.provLabel) + '</div></div>' +
    '<div class="stat-card accent3"><div class="num">' + ind.fmt(ind.vals[hiK]) + '</div><div class="lbl">Tertinggi &middot; ' + nm(hiK) + '</div></div>' +
    '<div class="stat-card accent2"><div class="num">' + ind.fmt(ind.vals[loK]) + '</div><div class="lbl">Terendah &middot; ' + nm(loK) + '</div></div>' +
    '<div class="stat-card accent"><div class="num">' + cl.ranked.length + '<span style="font-size:15px;font-weight:600;color:var(--ink-soft)"> / 22</span></div><div class="lbl">Wilayah memiliki data</div></div>';

  document.getElementById('pt-title').textContent = ind.label + (ind.unit && ind.kind !== 'pct' ? ' (' + ind.unit + ')' : '');
  document.getElementById('pt-src').innerHTML = escapeHtml(ind.periode) + '. ' + escapeHtml(ind.desc || '') +
    ' Kelas warna dibagi dengan metode kuantil (jumlah wilayah per kelas relatif sama).';

  petaDrawMap();
  petaDrawLegend(ind, cl);
  petaDrawDetail();
  petaDrawRank();
}

/* ---------------- peta ---------------- */
function petaMapInner(forExport) {
  const ind = PETA.inds[PETA.active], cl = PETA.cl;

  const selK = forExport ? null : PETA.sel;
  const order = PETA.shapes.slice().sort(function (a, b) {
    return (a.kode === selK ? 1 : 0) - (b.kode === selK ? 1 : 0);
  });
  let paths = '';
  order.forEach(function (s) {
    const sel = s.kode === selK;
    paths += '<path class="pt-reg' + (sel ? ' sel' : '') + '" data-k="' + s.kode + '" d="' + s.d + '" fill="' + petaFill(ind, cl, s.kode) +
      '" stroke="' + (sel ? '#0B2559' : '#fff') + '" stroke-width="' + (sel ? 2.2 : 1) + '" stroke-linejoin="round" fill-rule="evenodd"></path>';
  });

  let lbl = '';
  const mode = forExport ? 'both' : PETA.labels;
  if (mode !== 'none') {
    // singkatan & posisi manual untuk wilayah yang berdempetan (dx, dy dalam satuan viewBox)
    const ABBR = { '5315': 'Mgr. Barat', '5319': 'Mgr. Timur', '5318': 'SBD', '5317': 'S. Tengah', '5312': 'S. Barat', '5311': 'S. Timur' };
    const OFF = {
      '5315': { dx: 0, dy: -24 }, '5310': { dx: 6, dy: 30 }, '5319': { dx: 6, dy: -24 }, '5309': { dx: 0, dy: 32 },
      '5318': { dx: 0, dy: -26 }, '5312': { dx: 4, dy: 34 }, '5317': { dx: 0, dy: -34 },
      '5306': { dx: 0, dy: 30 }, '5304': { dx: 0, dy: -26 }, '5371': { dx: -8, dy: 24, a: 'end' },
      '5314': { dx: 0, dy: 4 }, '5320': { dx: 0, dy: 4 }
    };
    PETA.shapes.forEach(function (s) {
      const o = OFF[s.kode] || { dx: 0, dy: 0 };
      const x = (s.cx + o.dx).toFixed(1), y = (s.cy + o.dy).toFixed(1);
      const v = ind.vals[s.kode];
      const nm = ABBR[s.kode] || petaShort(s.nama);
      lbl += '<text x="' + x + '" y="' + y + '" text-anchor="' + (o.a || 'middle') + '" font-family="Plus Jakarta Sans,Arial,sans-serif" ' +
        'font-size="11" font-weight="700" fill="#0B2559" stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke" pointer-events="none">' +
        escapeHtml(nm) +
        (mode === 'both' ? '<tspan x="' + x + '" dy="11" font-weight="600" font-size="10">' + (v === undefined ? '-' : escapeHtml(ind.fmt(v))) + '</tspan>' : '') + '</text>';
    });
  }
  return '<g id="pt-paths">' + paths + '</g><g id="pt-labels">' + lbl + '</g>';
}

function petaDrawMap() {
  document.getElementById('pt-svg').innerHTML = petaMapInner(false);
}

function petaBindMap() {
  const box = document.getElementById('pt-mapbox');
  const tip = document.getElementById('pt-tip');
  const target = function (e) { const p = e.target.closest && e.target.closest('.pt-reg'); return p ? p.getAttribute('data-k') : null; };

  box.addEventListener('mousemove', function (e) {
    const k = target(e);
    if (!k) { tip.style.display = 'none'; return; }
    const ind = PETA.inds[PETA.active], v = ind.vals[k];
    tip.innerHTML = '<b>' + escapeHtml(PETA.byKodeNama[k]) + '</b><br>' + (v === undefined ? 'Tidak ada data' : escapeHtml(ind.fmt(v)) + (ind.kind === 'pct' ? '' : ' ' + escapeHtml(ind.unit)));
    const r = box.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 4) + 'px';
    tip.style.top = (e.clientY - r.top + 14) + 'px';
  });
  box.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  box.addEventListener('click', function (e) {
    const k = target(e);
    petaSelect(k === PETA.sel ? null : k);
  });
}

function petaSelect(k) {
  PETA.sel = k;
  petaDrawMap(); petaDrawDetail(); petaDrawRank();
}

/* ---------------- legenda ---------------- */
function petaDrawLegend(ind, cl) {
  let h = '';
  for (let i = 0; i < cl.count; i++) {
    const a = ind.fmt(cl.lo[i]), b = ind.fmt(cl.hi[i]);
    h += '<div class="pt-leg-i"><span class="pt-sw" style="background:' + cl.colors[i] + '"></span>' + (a === b ? a : a + ' &ndash; ' + b) + '</div>';
  }
  h += '<div class="pt-leg-i"><span class="pt-sw" style="background:' + PETA_NODATA + '"></span>Tidak ada data</div>';
  document.getElementById('pt-legend').innerHTML = h;
}

/* ---------------- panel rincian ---------------- */
function petaDrawDetail() {
  const el = document.getElementById('pt-detail');
  const k = PETA.sel;
  if (!k) {
    el.innerHTML = '<h3>Rincian Wilayah</h3><div class="b-note">Klik salah satu wilayah pada peta atau daftar peringkat untuk melihat rincian dan perbandingannya di semua indikator.</div>';
    return;
  }
  const ind = PETA.inds[PETA.active], cl = PETA.cl, v = ind.vals[k];
  const rank = cl.ranked.indexOf(k) + 1;
  let h = '<h3>' + escapeHtml(PETA.byKodeNama[k]) + '</h3>';
  if (v === undefined) {
    h += '<div class="b-note">Belum ada data ' + escapeHtml(ind.short) + ' untuk wilayah ini.</div>';
  } else {
    h += '<div class="pt-big">' + escapeHtml(ind.fmt(v)) + '<small> ' + (ind.kind === 'pct' ? '' : escapeHtml(ind.unit)) + '</small></div>' +
      '<div class="pt-meta"><span class="pt-sw" style="background:' + petaFill(ind, cl, k) + '"></span>Peringkat <b>' + rank + '</b> dari ' + cl.ranked.length + ' &middot; ' + escapeHtml(ind.short) + '</div>';
    if (ind.prov !== null && ind.prov !== undefined && ind.kind !== 'num') {
      const diff = v - ind.prov;
      const dTxt = ind.kind === 'pct' ? Math.abs(diff).toFixed(2).replace('.', ',') + ' poin' : Math.abs(diff).toFixed(1).replace('.', ',');
      h += '<div class="pt-meta">' + (Math.abs(diff) < 0.005 ? 'Setara dengan' : dTxt + (diff > 0 ? ' di atas' : ' di bawah')) + ' ' + escapeHtml(ind.provLabel.toLowerCase()) + ' (' + escapeHtml(ind.fmt(ind.prov)) + ')</div>';
    }
    if (ind.kind === 'num' && ind.prov) {
      h += '<div class="pt-meta">' + (v / ind.prov * 100).toFixed(2).replace('.', ',') + '% dari total penduduk provinsi</div>';
    }
  }
  // profil semua indikator
  h += '<table class="pt-prof"><tbody>';
  PETA.inds.forEach(function (x, i) {
    const c2 = i === PETA.active ? cl : petaClassify(x);
    const val = x.vals[k], rk = c2.ranked.indexOf(k) + 1;
    h += '<tr class="' + (i === PETA.active ? 'on' : '') + '" onclick="petaSelectIndicator(' + i + ')"><td>' + escapeHtml(x.short) + '</td><td class="r">' +
      (val === undefined ? '-' : escapeHtml(x.fmt(val))) + '</td><td class="r pt-rk">' + (rk ? '#' + rk : '') + '</td></tr>';
  });
  h += '</tbody></table>';
  el.innerHTML = h;
}

/* ---------------- peringkat ---------------- */
function petaDrawRank() {
  const ind = PETA.inds[PETA.active], cl = PETA.cl;
  const max = Math.max.apply(null, cl.ranked.map(function (k) { return ind.vals[k]; })) || 1;
  const min = Math.min.apply(null, cl.ranked.map(function (k) { return ind.vals[k]; }));
  // persentase & rasio: skala mulai dari 0 agar panjang batang jujur
  let h = '<h3>Peringkat Kab/Kota</h3><div class="pt-rank">';
  cl.ranked.forEach(function (k, i) {
    const v = ind.vals[k];
    h += '<div class="pt-row' + (k === PETA.sel ? ' sel' : '') + '" onclick="petaSelect(\'' + k + '\')">' +
      '<span class="pt-no">' + (i + 1) + '</span>' +
      '<span class="pt-nm">' + escapeHtml(petaShort(PETA.byKodeNama[k])) + '</span>' +
      '<span class="pt-bar"><i style="width:' + Math.max(2, v / max * 100).toFixed(1) + '%;background:' + petaFill(ind, cl, k) + '"></i></span>' +
      '<span class="pt-val">' + escapeHtml(ind.fmt(v)) + '</span></div>';
  });
  PETA.shapes.forEach(function (s) {
    if (ind.vals[s.kode] === undefined) h += '<div class="pt-row nodata"><span class="pt-no">-</span><span class="pt-nm">' + escapeHtml(petaShort(s.nama)) + '</span><span class="pt-bar"></span><span class="pt-val">-</span></div>';
  });
  document.getElementById('pt-rank').innerHTML = h + '</div>';
}

/* ---------------- unduh PNG ---------------- */
function petaDownloadPng() {
  const ind = PETA.inds[PETA.active], cl = PETA.cl;
  const W = PETA.W, mapH = PETA.H, top = 78, legH = 70, H = top + mapH + legH + 26;
  let leg = '';
  const colW = W / (cl.count + 1);
  for (let i = 0; i < cl.count; i++) {
    const a = ind.fmt(cl.lo[i]), b = ind.fmt(cl.hi[i]);
    leg += '<rect x="' + (20 + i * colW) + '" y="' + (top + mapH + 14) + '" width="18" height="14" rx="3" fill="' + cl.colors[i] + '"/>' +
      '<text x="' + (44 + i * colW) + '" y="' + (top + mapH + 26) + '" font-size="12" fill="#0F1B2D" font-family="Arial,sans-serif">' + escapeHtml(a === b ? a : a + ' – ' + b) + '</text>';
  }
  leg += '<rect x="' + (20 + cl.count * colW) + '" y="' + (top + mapH + 14) + '" width="18" height="14" rx="3" fill="' + PETA_NODATA + '"/>' +
    '<text x="' + (44 + cl.count * colW) + '" y="' + (top + mapH + 26) + '" font-size="12" fill="#0F1B2D" font-family="Arial,sans-serif">Tidak ada data</text>';

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<rect width="100%" height="100%" fill="#fff"/>' +
    '<text x="20" y="34" font-size="20" font-weight="700" fill="#0B2559" font-family="Arial,sans-serif">PETA TEMATIK ' + escapeHtml(ind.label.toUpperCase()) + '</text>' +
    '<text x="20" y="56" font-size="13" fill="#5B6B85" font-family="Arial,sans-serif">Provinsi Nusa Tenggara Timur &#183; ' + escapeHtml(ind.periode) + '</text>' +
    '<g transform="translate(0,' + top + ')">' + petaMapInner(true).replace(/class="pt-reg[^"]*"/g, '') + '</g>' + leg +
    '<text x="20" y="' + (H - 12) + '" font-size="11" fill="#5B6B85" font-family="Arial,sans-serif">Sumber: Si-Detektif &#8212; Dinas Kependudukan dan Pencatatan Sipil Provinsi NTT. Kelas warna: kuantil.</text></svg>';

  const img = new Image();
  img.onload = function () {
    const sc = 2, cv = document.createElement('canvas');
    cv.width = W * sc; cv.height = H * sc;
    const ctx = cv.getContext('2d');
    ctx.scale(sc, sc); ctx.drawImage(img, 0, 0, W, H);
    cv.toBlob(function (blob) {
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'Peta Tematik ' + ind.label.replace(/[\\/:*?"<>|]+/g, '') + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      showToast('Gambar peta berhasil dibuat.', 'success');
    }, 'image/png');
  };
  img.onerror = function () { showToast('Gagal membuat gambar peta.', 'error'); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
