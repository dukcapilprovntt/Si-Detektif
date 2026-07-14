/* ====================================================================
   SUMBER DATA
   Versi GitHub Pages (statis) tidak bisa memakai google.script.run,
   karena itu hanya tersedia saat halaman benar-benar dirender oleh
   server Apps Script. Di sini kita ambil data dengan fetch() biasa ke
   endpoint JSON Apps Script: <URL_WEBAPP>/exec?action=data

   GANTI nilai APPS_SCRIPT_URL di bawah ini dengan URL hasil deploy
   "Web app" dari project Apps Script kamu (Code.gs tetap dipakai di
   sana sebagai backend; index.html/Stylesheet.html/Script.html di
   project Apps Script tidak lagi dipakai — diganti oleh file statis
   index.html, style.css, script.js ini yang di-hosting di GitHub Pages).
   ==================================================================== */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxcKl3BlVO2wbESLxrur0DosQSmyIi6uxFp3z5vFQ_e33_Albxzkr7kJ_N4LQBs-Zy_/exec'; // contoh: https://script.google.com/macros/s/AKfycbx.../exec

let cachedData = null;
let currentTable = 1;
let chartTop10 = null;
let chartProgres = null;

/* ====================================================================
   PLUGIN: label nilai di ujung setiap bar
   Tidak pakai library tambahan (chartjs-plugin-datalabels dll), cukup
   plugin Chart.js manual yang menggambar teks tepat di ujung tiap bar
   (untuk bar horizontal: di kanan bar; untuk bar vertikal: di atas bar).
   ==================================================================== */
const barEndLabelsPlugin = {
  id: 'barEndLabels',
  afterDatasetsDraw(chart, args, opts){
    const { ctx } = chart;
    const isHorizontal = chart.options.indexAxis === 'y';
    chart.data.datasets.forEach((dataset, dIdx) => {
      const meta = chart.getDatasetMeta(dIdx);
      if(meta.hidden) return;
      meta.data.forEach((bar, i) => {
        const raw = dataset.data[i];
        const text = opts && opts.formatter ? opts.formatter(raw, i) : String(raw);
        if(text === '' || text == null) return;
        ctx.save();
        ctx.font = (opts && opts.font) || "600 10.5px 'Poppins', sans-serif";
        ctx.fillStyle = (opts && opts.color) || '#241710';
        if(isHorizontal){
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, bar.x + 6, bar.y);
        }else{
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, bar.y - 6);
        }
        ctx.restore();
      });
    });
  }
};
if(window.Chart) Chart.register(barEndLabelsPlugin);

function showPage(name, tblIdx, btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');

  if(name === 'table' && tblIdx){
    currentTable = tblIdx;
    switchTable(tblIdx);
  }
  toggleSidebar(false);
}

function toggleSidebar(force){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  const open = (force !== undefined) ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  ov.classList.toggle('open', open);
}

/* ---------- Mascot illustration (mengambang di kanan-bawah layar) ---------- */
document.addEventListener("DOMContentLoaded", function () {

  const mascotHTML = `
    <img src="icon SiDetektif.png" alt="Mascot SiDetektif"
         alt="Mascot SiDetektif"
         style="width:100%; height:auto; object-fit:contain;">
  `;

  const el = document.getElementById('mascotFloat');

  if (el) {
    el.innerHTML = mascotHTML;

    // 🔥 TAMBAHKAN CLICK EVENT DI SINI
    el.addEventListener("click", function () {
      window.open("https://wa.me/628213717090", "_blank");
    });
  }

});

/* ---------- Icons ---------- */
const icons = {
  idcard: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#241710" stroke-width="1.6"/><circle cx="8" cy="12" r="2.3" stroke="#241710" stroke-width="1.4"/><line x1="13" y1="9.5" x2="19" y2="9.5" stroke="#241710" stroke-width="1.4"/><line x1="13" y1="13" x2="19" y2="13" stroke="#241710" stroke-width="1.4"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#241710" stroke-width="1.6"/><circle cx="9" cy="8.5" r="2" stroke="#241710" stroke-width="1.4"/><line x1="7" y1="14" x2="17" y2="14" stroke="#241710" stroke-width="1.4"/><line x1="7" y1="17.5" x2="17" y2="17.5" stroke="#241710" stroke-width="1.4"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="2" width="12" height="20" rx="2.5" stroke="#241710" stroke-width="1.6"/><line x1="10" y1="18.5" x2="14" y2="18.5" stroke="#241710" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  cardRed: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" fill="#A23B2E"/><circle cx="8" cy="12" r="2.3" fill="#fff" opacity="0.9"/><line x1="13" y1="9.5" x2="19" y2="9.5" stroke="#fff" stroke-width="1.4" opacity="0.85"/><line x1="13" y1="13" x2="19" y2="13" stroke="#fff" stroke-width="1.4" opacity="0.85"/></svg>`,
  cardNavy: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" fill="#2E4A5E"/><circle cx="8" cy="12" r="2.3" fill="#fff" opacity="0.9"/><line x1="13" y1="9.5" x2="19" y2="9.5" stroke="#fff" stroke-width="1.4" opacity="0.85"/><line x1="13" y1="13" x2="19" y2="13" stroke="#fff" stroke-width="1.4" opacity="0.85"/></svg>`
};

function badge(type){
  if(type==='green') return `<span class="badge green">&#10003;</span>`;
  if(type==='red') return `<span class="badge red">&#10005;</span>`;
  return '';
}

function num(v){
  if(v === null || v === undefined || v === "") return 0;
  if(typeof v === "number"){
    return Number.isInteger(v) ? v : Math.round(v * 1000);
  }
  let s = String(v).trim();
  if(s.includes(",")) return parseInt(s.replace(/,/g, ""), 10) || 0;
  const f = parseFloat(s);
  return isNaN(f) ? 0 : f;
}
// Khusus nilai persen: 97.16 harus tetap 97.16 (bukan dikali 1000)
function numPct(v){
  if(v === null || v === undefined || v === "") return 0;
  if(typeof v === "number") return v;
  let s = String(v).trim();
  if(s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if(s.includes(",")) {
    s = s.replace(",", ".");
  }
  const f = parseFloat(s);
  return isNaN(f) ? 0 : f;
}
function fmt(n){ return Math.round(n).toLocaleString('id-ID'); }
function fmtPct(n){ return n.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%'; }
function titleCase(s){ return String(s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
function wilayahLabel(w){
  const name = titleCase(w);
  return /^kota/i.test(String(w).trim()) ? name : "Kab. " + name;
}
function isNTT(w){ return String(w || "").toUpperCase().includes("NUSA TENGGARA"); }
function provRow(arr){ if(!Array.isArray(arr)) return {}; return arr.find(r => isNTT(r.WILAYAH)) || arr[0] || {}; }
function kabRows(arr){ return (arr || []).filter(r => !isNTT(r.WILAYAH)).sort((a,b)=>(Number(a.NO)||0)-(Number(b.NO)||0)); }

// Buat lookup map jumlah penduduk dari sheet "Jumlah Penduduk" berdasarkan WILAYAH
function buildJpMap(jpArr){
  const map = {};
  (jpArr || []).forEach(r => {
    const key = String(r.WILAYAH || "").trim().toUpperCase();
    const lk = num(r["PENDUDUK(LK)"]); const pr = num(r["PENDUDUK(PR)"]);
    map[key] = num(r["PENDUDUK(JML)"]) || (lk + pr);
  });
  return map;
}
function jpFromMap(map, wilayah){
  const key = String(wilayah || "").trim().toUpperCase();
  return map[key] || 0;
}

function getLastDayPrevMonth(){
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return last.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
}
function getSemester(){
  const now = new Date(); const m = now.getMonth()+1; const y = now.getFullYear();
  return m <= 6 ? `Semester II ${y-1}` : `Semester I ${y}`;
}

function renderTotal(jpArr){
  const p = provRow(jpArr);
  const lk = num(p["PENDUDUK(LK)"]); const pr = num(p["PENDUDUK(PR)"]);
  const total = num(p["PENDUDUK(JML)"]) || (lk + pr);
  document.getElementById('lkVal').textContent = fmt(lk);
  document.getElementById('prVal').textContent = fmt(pr);
  document.getElementById('totalNum').textContent = fmt(total);
  const denom = (lk + pr) || 1; const prDeg = (pr / denom) * 360;
  document.getElementById('donut').style.background =
    `conic-gradient(var(--clay) 0deg ${prDeg}deg, var(--slate-deep) ${prDeg}deg 360deg)`;
  document.getElementById('periodLabel').textContent = getSemester();
}

function renderStats(data){
  document.getElementById('statPanelTitle').textContent =
    `Data Kependudukan Provinsi Nusa Tenggara Timur Keadaan ${getLastDayPrevMonth()}`;
  const per = provRow(data["Perekaman"]);
  const a04 = provRow(data["Akta Kelahiran (0-4)"]);
  const ikd = provRow(data["IKD"]); const kia = provRow(data["KIA"]);
  const ikdJml = num(ikd["JUMLAH IKD"]); const ikdBasis = num(ikd["REKAM DINAMIS"]);
  const ikdPct = ikdBasis ? (ikdJml / ikdBasis * 100) : 0;
  const stats = [
    { icon:'idcard', label:'Wajib Perekaman KTP-el',                  value:fmt(num(per["WKTP DINAMIS"])),                  badge:'' },
    { icon:'idcard', label:'Sudah Perekaman KTP-el',                  value:fmt(num(per["PROGRES REKAM"])),                 badge:'green' },
    { icon:'idcard', label:'Belum Perekaman KTP-el',                  value:fmt(num(per["PROGRES BELUM REKAM"])),           badge:'red' },
    { icon:'doc',    label:'Wajib Akta Kelahiran 0-4 Tahun',          value:fmt(num(a04["WAJIB AKTA(DINAMIS - JML)"])),     badge:'' },
    { icon:'doc',    label:'Kepemilikan Akta Kelahiran 0-4 Tahun',    value:fmt(num(a04["MEMILIKI(DINAMIS - JML)"])),       badge:'green' },
    { icon:'doc',    label:'Belum Memiliki Akta Kelahiran 0-4 Tahun', value:fmt(num(a04["BELUM MEMILIKI(DINAMIS - JML)"])), badge:'red' },
    { icon:'phone',  label:'Aktivasi IKD',                            value:fmtPct(ikdPct),                                badge:'' },
    { icon:'cardRed', label:'Kepemilikan KIA',                        value:fmt(num(kia["MEMILIKI DINAMIS(JML)"])),        badge:'' },
    { icon:'cardNavy',label:'Belum Memiliki KIA',                     value:fmt(num(kia["BELUM MEMILIKI DINAMIS(JML)"])),  badge:'' },
  ];
  document.getElementById('statGrid').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-text"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>
      <div class="stat-icon">${icons[s.icon]}${badge(s.badge)}</div>
    </div>`).join('');
}

/* ====================================================================
   GRAFIK
   ==================================================================== */
function renderCharts(data){
  document.getElementById('progresPanelTitle').textContent =
    `Progres Layanan Dokumen Kependudukan Tingkat Provinsi Keadaan ${getLastDayPrevMonth()}`;
  const jp  = data["Jumlah Penduduk"] || [];
  const per = data["Perekaman"] || [];
  const a04 = data["Akta Kelahiran (0-4)"] || [];
  const ikd = data["IKD"] || [];
  const kia = data["KIA"] || [];

  /* ---- Chart 1: Top 10 kab/kota berdasarkan jumlah penduduk ---- */
  const kabJp = kabRows(jp).map(r=>{
    const lk=num(r["PENDUDUK(LK)"]); const pr=num(r["PENDUDUK(PR)"]);
    return { label: wilayahLabel(r.WILAYAH), total: num(r["PENDUDUK(JML)"]) || (lk+pr) };
  }).sort((a,b)=>b.total-a.total).slice(0,10);

  const ctx1 = document.getElementById('chartTop10');
  if(chartTop10) chartTop10.destroy();
  chartTop10 = new Chart(ctx1, {
    type:'bar',
    data:{
      labels: kabJp.map(d=>d.label),
      datasets:[{
        data: kabJp.map(d=>d.total),
        backgroundColor:'#B5713F',
        borderRadius:5,
        maxBarThickness:22
      }]
    },
    options:{
      indexAxis:'y',
      layout:{ padding:{ right:54 } },
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label:(c)=>fmt(c.parsed.x) + ' jiwa' } },
        barEndLabels:{ formatter:(v)=>fmt(v) } },
      scales:{
        x:{ grace:'8%', ticks:{ callback:(v)=>fmt(v), font:{family:"'Poppins', sans-serif", size:10} }, grid:{ color:'#E2D5C0' } },
        y:{ ticks:{ font:{family:"'Poppins', sans-serif", size:10.5} }, grid:{ display:false } }
      },
      responsive:true,
      maintainAspectRatio:false
    }
  });

  /* ---- Chart 2: Progres layanan dokumen tingkat provinsi (persen) ---- */
  const perP = provRow(per);
  const a04P = provRow(a04);
  const ikdP = provRow(ikd);
  const kiaP = provRow(kia);
  const ikdPct = num(ikdP["REKAM DINAMIS"]) ? (num(ikdP["JUMLAH IKD"]) / num(ikdP["REKAM DINAMIS"]) * 100) : 0;

  const progresData = [
    { label:'Perekaman KTP-el', value: numPct(perP["PROGRES PERSENTASE"]) },
    { label:'Akta Kelahiran 0-4 Th', value: numPct(a04P["PERSEN (DINAMIS)(%)"]) },
    { label:'Aktivasi IKD', value: ikdPct },
    { label:'Kepemilikan KIA', value: numPct(kiaP["PERSEN DINAMIS(%)"]) }
  ];

  const ctx2 = document.getElementById('chartProgres');
  if(chartProgres) chartProgres.destroy();
  chartProgres = new Chart(ctx2, {
    type:'bar',
    data:{
      labels: progresData.map(d=>d.label),
      datasets:[{
        data: progresData.map(d=>Math.round(d.value*100)/100),
        backgroundColor:'#2E4A5E',
        borderRadius:6,
        maxBarThickness:48
      }]
    },
    options:{
      layout:{ padding:{ top:26 } },
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label:(c)=>fmtPct(c.parsed.y) } },
        barEndLabels:{ formatter:(v)=>fmtPct(v), color:'#2E4A5E' } },
      scales:{
        y:{ beginAtZero:true, max:100, ticks:{ callback:(v)=>v+'%', font:{family:"'Poppins', sans-serif", size:10} }, grid:{ color:'#E2D5C0' } },
        x:{ ticks:{ font:{family:"'Poppins', sans-serif", size:11} }, grid:{ display:false } }
      },
      responsive:true,
      maintainAspectRatio:false
    }
  });
}

/* ====================================================================
   HELPER TABLE BUILDER
   ==================================================================== */
function td(v,cls){ return `<td${cls?' class="'+cls+'"':''}>${v}</td>`; }
function tdN(v){ return td(v,'num'); }
function provTr(cells){ return `<tr class="prov-row">${cells.join('')}</tr>`; }

function note2(arr, keyFn, label, fmtFn){
  fmtFn = fmtFn || fmt;
  const s = [...arr].filter(r=>keyFn(r)!==undefined).sort((a,b)=>keyFn(b)-keyFn(a));
  if(!s.length) return '';
  const w = r => `<b>${wilayahLabel(r.WILAYAH)}</b>`;
  const top2 = s.slice(0,2), bot2 = s.slice(-2).reverse();

}

function note2Cards(leftNote, rightNote){
  const leftHtml = leftNote ? `<div class="tbl-note-card">${leftNote}</div>` : '';
  const rightHtml = rightNote ? `<div class="tbl-note-card">${rightNote}</div>` : '';
  if(!leftHtml && !rightHtml) return '';
  return `<div class="tbl-note-container">${leftHtml}${rightHtml}</div>`;
}

/* ====================================================================
   10 TABEL DEFINISI
   ==================================================================== */
function getTables(data){
  const tgl = getLastDayPrevMonth();
  const sem = getSemester();

  const jp    = data["Jumlah Penduduk"] || [];
  const per   = data["Perekaman"] || [];
  const ak04  = data["Akta Kelahiran (0-4)"] || [];
  const ak018 = data["Akta Kelahiran (0-18)"] || [];
  const akAll = data["Akta Kelahiran"] || [];
  const kia   = data["KIA"] || [];
  const ikd   = data["IKD"] || [];
  const akw   = data["Akta Kawin"] || data["akta kawin"] || data["AKTA KAWIN"]
             || data["Akta kawin"] || data["Kawin"] || [];
  const acr   = data["Akta Cerai"] || data["akta cerai"] || data["AKTA CERAI"]
             || data["Akta cerai"] || data["Cerai"] || [];
  const amt   = data["Akta Kematian"] || data["akta kematian"] || data["AKTA KEMATIAN"]
             || data["Akta kematian"] || data["Meninggal"] || [];

  // Buat lookup jumlah penduduk dari sheet Jumlah Penduduk
  const jpMap = buildJpMap(jp);



  /* ---- shared akta kelahiran builder ---- */
  function aktaTbl(arr, prov, tit){
    return {
      title: tit,
      head: `<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Wajib Akta Awal</th><th class="num">Wajib Akta Dinamis</th>
        <th class="num">Memiliki Dinamis</th><th class="num">Belum Memiliki Dinamis</th>
        <th class="num">Persen Dinamis (%)</th></tr>`,
      provRowHtml: provTr([
        td(''), td('Nusa Tenggara Timur'), tdN(prov.KODE||'-'),
        tdN(fmt(num(prov["WAJIB AKTA(AWAL-JML)"]))),
        tdN(fmt(num(prov["WAJIB AKTA(DINAMIS - JML)"]))),
        tdN(fmt(num(prov["MEMILIKI(DINAMIS - JML)"]))),
        tdN(fmt(num(prov["BELUM MEMILIKI(DINAMIS - JML)"]))),
        tdN(fmtPct(numPct(prov["PERSEN (DINAMIS)(%)"])))
      ]),
      bodyRows: kabRows(arr).map((r,i)=>`<tr>
        ${td(i+1)}${td(wilayahLabel(r.WILAYAH))}${tdN(r.KODE||'-')}
        ${tdN(fmt(num(r["WAJIB AKTA(AWAL-JML)"])))}${tdN(fmt(num(r["WAJIB AKTA(DINAMIS - JML)"])))}
        ${tdN(fmt(num(r["MEMILIKI(DINAMIS - JML)"])))}${tdN(fmt(num(r["BELUM MEMILIKI(DINAMIS - JML)"])))}
        ${tdN(fmtPct(numPct(r["PERSEN (DINAMIS)(%)"])))}</tr>`),
      note: note2Cards(
        note2(kabRows(arr), r=>numPct(r["PERSEN (DINAMIS)(%)"]),'Persen Dinamis', fmtPct),
        note2(kabRows(arr), r=>num(r["BELUM MEMILIKI(DINAMIS - JML)"]), 'Belum Memiliki Dinamis')
      )
    };
  }

  return [
    /* 1. Jumlah Penduduk */
    {
      // title:`REKAPITULASI JUMLAH PENDUDUK – JENIS KELAMIN PROVINSI NTT\n${sem.toUpperCase()}`,
      title:`REKAPITULASI JUMLAH PENDUDUK – JENIS KELAMIN PROVINSI NTT\n Semester II 2025`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Total Penduduk</th><th class="num">Laki-Laki (LK)</th>
        <th class="num">Persen LK</th><th class="num">Perempuan (PR)</th><th class="num">Persen PR</th></tr>`,
      provRowHtml:(()=>{
        const p=provRow(jp); const lk=num(p["PENDUDUK(LK)"]); const pr=num(p["PENDUDUK(PR)"]);
        const jml=num(p["PENDUDUK(JML)"])||(lk+pr); const den=jml||1;
        return provTr([td(''),td('Nusa Tenggara Timur'),tdN(p.KODE||'-'),
          tdN(`<strong>${fmt(jml)}</strong>`),tdN(fmt(lk)),tdN(fmtPct(lk/den*100)),tdN(fmt(pr)),tdN(fmtPct(pr/den*100))]);
      })(),
      bodyRows: kabRows(jp).map((r,i)=>{
        const lk=num(r["PENDUDUK(LK)"]); const pr=num(r["PENDUDUK(PR)"]);
        const jml=num(r["PENDUDUK(JML)"])||(lk+pr); const den=jml||1;
        return `<tr>${td(i+1)}${td(wilayahLabel(r.WILAYAH))}${tdN(r.KODE||'-')}
          ${tdN(`<strong>${fmt(jml)}</strong>`)}${tdN(fmt(lk))}${tdN(fmtPct(lk/den*100))}
          ${tdN(fmt(pr))}${tdN(fmtPct(pr/den*100))}</tr>`;
      }),
      note: note2(kabRows(jp), r=>{const lk=num(r["PENDUDUK(LK)"]);const pr=num(r["PENDUDUK(PR)"]);return num(r["PENDUDUK(JML)"])||(lk+pr);}, 'Total Penduduk')
    },

    /* 2. Perekaman KTP-el */
    {
      title:`REKAPITULASI PEREKAMAN KTP-eL PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Jumlah Penduduk</th><th class="num">WKTP Awal</th>
        <th class="num">WKTP Dinamis</th><th class="num">Progres Belum Rekam</th>
        <th class="num">Progres Rekam</th><th class="num">Progres (%)</th></tr>`,
      provRowHtml:(()=>{
        const p=provRow(per);
        return provTr([td(''),td('Nusa Tenggara Timur'),tdN(p.KODE||'-'),
          tdN(fmt(num(p["JUMLAH PENDUDUK"]))),tdN(fmt(num(p["WKTP AWAL"]))),
          tdN(fmt(num(p["WKTP DINAMIS"]))),tdN(fmt(num(p["PROGRES BELUM REKAM"]))),
          tdN(fmt(num(p["PROGRES REKAM"]))),tdN(fmtPct(numPct(p["PROGRES PERSENTASE"])))]);
      })(),
      bodyRows: kabRows(per).map((r,i)=>`<tr>${td(i+1)}${td(wilayahLabel(r.WILAYAH))}${tdN(r.KODE||'-')}
        ${tdN(fmt(num(r["JUMLAH PENDUDUK"])))}${tdN(fmt(num(r["WKTP AWAL"])))}
        ${tdN(fmt(num(r["WKTP DINAMIS"])))}${tdN(fmt(num(r["PROGRES BELUM REKAM"])))}
        ${tdN(fmt(num(r["PROGRES REKAM"])))}${tdN(fmtPct(numPct(r["PROGRES PERSENTASE"])))}</tr>`),
      note: note2Cards(
        note2(kabRows(per), r=>num(r["PROGRES REKAM"]), 'Progres Rekam'),
        note2(kabRows(per), r=>numPct(r["PROGRES PERSENTASE"]), 'Progres Persentase', fmtPct)
      )
    },

    /* 3. Akta Kelahiran 0-4 */
    aktaTbl(ak04, provRow(ak04), `REKAPITULASI KEPEMILIKAN AKTA KELAHIRAN (0–4 TAHUN) PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`),

    /* 4. Akta Kelahiran 0-18 */
    aktaTbl(ak018, provRow(ak018), `REKAPITULASI KEPEMILIKAN AKTA KELAHIRAN (0–18 TAHUN) PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`),

    /* 5. Akta Kelahiran Semua */
    aktaTbl(akAll, provRow(akAll), `REKAPITULASI KEPEMILIKAN AKTA KELAHIRAN (SEMUA USIA) PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`),

    /* 6. KIA */
    {
      title:`REKAPITULASI KEPEMILIKAN KIA PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Jumlah Penduduk</th><th class="num">Jumlah Awal</th>
        <th class="num">Jumlah Dinamis</th><th class="num">Memiliki Dinamis</th>
        <th class="num">Belum Memiliki Dinamis</th><th class="num">Persen Dinamis (%)</th></tr>`,
      provRowHtml:(()=>{
        const p=provRow(kia);
        const pPer = provRow(per);

        return provTr([td(''),td('Nusa Tenggara Timur'),tdN(p.KODE||'-'),
          tdN(fmt(num(pPer["JUMLAH PENDUDUK"]))),
          tdN(fmt(num(p["JUMLAH AWAL(JML)"]))),
          tdN(fmt(num(p["JUMLAH DINAMIS(TTL)"]))),tdN(fmt(num(p["MEMILIKI DINAMIS(JML)"]))),
          tdN(fmt(num(p["BELUM MEMILIKI DINAMIS(JML)"]))),tdN(fmtPct(numPct(p["PERSEN DINAMIS(%)"])))]);
      })(),
      bodyRows: kabRows(kia).map((r,i)=>{
        const perRow = kabRows(per).find(x => x.KODE == r.KODE) || {};

        return `<tr>
          ${td(i+1)}
          ${td(wilayahLabel(r.WILAYAH))}
          ${tdN(r.KODE || '-')}
          ${tdN(fmt(num(perRow["JUMLAH PENDUDUK"])))}
          ${tdN(fmt(num(r["JUMLAH AWAL(JML)"])))}
          ${tdN(fmt(num(r["JUMLAH DINAMIS(TTL)"])))}
          ${tdN(fmt(num(r["MEMILIKI DINAMIS(JML)"])))}
          ${tdN(fmt(num(r["BELUM MEMILIKI DINAMIS(JML)"])))}
          ${tdN(fmtPct(numPct(r["PERSEN DINAMIS(%)"])))}
        </tr>`;
      }),
      note: note2Cards(
        note2(kabRows(kia), r=>numPct(r["PERSEN DINAMIS(%)"]), 'Persen KIA', fmtPct),
        note2(kabRows(kia), r=>num(r["BELUM MEMILIKI DINAMIS(JML)"]), 'Belum Memiliki KIA')
      )
    },

    /* 7. IKD */
    {
      title:`REKAPITULASI JUMLAH AKTIVASI IKD PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Rekam Dinamis</th>
        <th class="num">Jumlah IKD</th>
        <th class="num">Belum Aktivasi IKD</th>
        <th class="num">Persen IKD (%)</th></tr>`,
      provRowHtml:(()=>{
        const p = provRow(ikd);
        const belum = Math.max(0,
          num(p["REKAM DINAMIS"]) - num(p["JUMLAH IKD"])
        );

        return provTr([
          td(''),
          td('Nusa Tenggara Timur'),
          tdN(p.KODE || '-'),
          tdN(fmt(num(p["REKAM DINAMIS"]))),
          tdN(fmt(num(p["JUMLAH IKD"]))),
          tdN(fmt(belum)),
          tdN(fmtPct(numPct(p["PERSEN IKD"])))
        ]);
      })(),
      bodyRows: kabRows(ikd).map((r,i)=>{
        const belum = Math.max(0,
          num(r["REKAM DINAMIS"]) - num(r["JUMLAH IKD"])
        );

        return `<tr>
          ${td(i+1)}
          ${td(wilayahLabel(r.WILAYAH))}
          ${tdN(r.KODE||'-')}
          ${tdN(fmt(num(r["REKAM DINAMIS"])))}
          ${tdN(fmt(num(r["JUMLAH IKD"])))}
          ${tdN(fmt(belum))}
          ${tdN(fmtPct(numPct(r["PERSEN IKD"])))}
        </tr>`;
      }),
      note: note2(kabRows(ikd), r=>numPct(r["PERSEN IKD"]), 'Persen IKD', fmtPct)
    },

    /* 8. Akta Kawin */
    {
      title:`REKAPITULASI KEPEMILIKAN AKTA KAWIN PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Jumlah Penduduk</th><th class="num">Wajib Akta Kawin</th>
        <th class="num">Memiliki Akta Kawin</th><th class="num">Belum Memiliki Akta Kawin</th>
        <th class="num">Persen Memiliki (%)</th></tr>`,
      provRowHtml:(()=>{
        const p=provRow(akw);
        const jpProv = provRow(jp);
        const jmlPendProv = num(jpProv["PENDUDUK(JML)"]) || (num(jpProv["PENDUDUK(LK)"])+num(jpProv["PENDUDUK(PR)"]));
        return provTr([td(''),td('Nusa Tenggara Timur'),tdN(p.KODE||'-'),
          tdN(fmt(jmlPendProv)),tdN(fmt(num(p["WAJIB AKTA KAWIN(JML)"]))),
          tdN(fmt(num(p["MEMILIKI AKTA KAWIN(JML)"]))),tdN(fmt(num(p["BELUM MEMILIKI AKTA KAWIN(JML)"]))),
          tdN(fmtPct(numPct(p["PERSEN (MEMILIKI)(%)"])))]);
      })(),
      bodyRows: kabRows(akw).map((r,i)=>`<tr>${td(i+1)}${td(wilayahLabel(r.WILAYAH))}${tdN(r.KODE||'-')}
        ${tdN(fmt(jpFromMap(jpMap, r.WILAYAH)))}${tdN(fmt(num(r["WAJIB AKTA KAWIN(JML)"])))}
        ${tdN(fmt(num(r["MEMILIKI AKTA KAWIN(JML)"])))}${tdN(fmt(num(r["BELUM MEMILIKI AKTA KAWIN(JML)"])))}
        ${tdN(fmtPct(numPct(r["PERSEN (MEMILIKI)(%)"])))}</tr>`),
      note: note2Cards(
        note2(kabRows(akw), r=>numPct(r["PERSEN (MEMILIKI)(%)"]), 'Persen Memiliki Akta Kawin', fmtPct),
        note2(kabRows(akw), r=>num(r["BELUM MEMILIKI AKTA KAWIN(JML)"]), 'Belum Memiliki Akta Kawin')
      )
    },

    /* 9. Akta Cerai */
    {
      title:`REKAPITULASI KEPEMILIKAN AKTA CERAI PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Jumlah Penduduk</th><th class="num">Memiliki Akta Cerai</th></tr>`,
      provRowHtml:(()=>{
        const p=provRow(acr);
        const jpProv = provRow(jp);
        const jmlPendProv = num(jpProv["PENDUDUK(JML)"]) || (num(jpProv["PENDUDUK(LK)"])+num(jpProv["PENDUDUK(PR)"]));
        return provTr([td(''),td('Nusa Tenggara Timur'),tdN(p.KODE||'-'),
          tdN(fmt(jmlPendProv)),tdN(fmt(num(p["MEMILIKI AKTA CERAI(JML)"])))]);
      })(),
      bodyRows: kabRows(acr).map((r,i)=>`<tr>${td(i+1)}${td(wilayahLabel(r.WILAYAH))}${tdN(r.KODE||'-')}
        ${tdN(fmt(jpFromMap(jpMap, r.WILAYAH)))}${tdN(fmt(num(r["MEMILIKI AKTA CERAI(JML)"])))}</tr>`),
      note: note2(kabRows(acr), r=>num(r["MEMILIKI AKTA CERAI(JML)"]), 'Memiliki Akta Cerai')
    },

    /* 10. Akta Kematian */
    {
      title:`REKAPITULASI KEPEMILIKAN AKTA KEMATIAN PROVINSI NTT\nKEADAAN ${tgl.toUpperCase()}`,
      head:`<tr><th>No</th><th>Wilayah</th><th>Kode</th>
        <th class="num">Jumlah Penduduk</th><th class="num">MENINGGAL(JML)</th></tr>`,
      provRowHtml:(()=>{
        const p=provRow(amt);
        const jpProv = provRow(jp);
        const jmlPendProv = num(jpProv["PENDUDUK(JML)"]) || (num(jpProv["PENDUDUK(LK)"])+num(jpProv["PENDUDUK(PR)"]));
        return provTr([td(''),td('Nusa Tenggara Timur'),tdN(p.KODE||'-'),
          tdN(fmt(jmlPendProv)),tdN(fmt(num(p["MENINGGAL(JML)"])))]);
      })(),
      bodyRows: kabRows(amt).map((r,i)=>`<tr>${td(i+1)}${td(wilayahLabel(r.WILAYAH))}${tdN(r.KODE||'-')}
        ${tdN(fmt(jpFromMap(jpMap, r.WILAYAH)))}${tdN(fmt(num(r["MENINGGAL(JML)"])))}</tr>`),
      note: note2(kabRows(amt), r=>num(r["MENINGGAL(JML)"]), 'MENINGGAL(JML)')
    }
  ];
}

/* ====================================================================
   SWITCH TABEL
   ==================================================================== */
function switchTable(idx){
  if(!cachedData) return;
  currentTable = parseInt(idx);
  const tables = getTables(cachedData);
  const t = tables[currentTable-1];
  if(!t) return;
  document.getElementById('tblTitle').innerHTML = t.title.replace(/\n/g,'<br>');
  document.getElementById('tblHead').innerHTML = t.head;
  document.getElementById('tableBody').innerHTML = t.provRowHtml + t.bodyRows.join('');
  const noteEl = document.getElementById('tblNote');
  noteEl.innerHTML = t.note || '';
  noteEl.style.display = t.note ? 'block' : 'none';
  renderSummary(currentTable, cachedData);
}

/* ====================================================================
   EXPORT TABEL KE XLSX
   Membaca ulang tabel yang sudah dirender di DOM (#tblHead + #tableBody)
   agar selalu konsisten 1:1 dengan apa yang dilihat user di layar,
   lalu menyusunnya jadi worksheet pakai SheetJS (xlsx.full.min.js).
   ==================================================================== */
function stripHtml(html){
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent.replace(/\s+/g,' ').trim();
}

function tableToAOA(){
  const aoa = [];
  const headRow = document.querySelector('#tblHead tr');
  if(!headRow) return aoa;
  aoa.push(Array.from(headRow.children).map(th => stripHtml(th.innerHTML)));

  document.querySelectorAll('#tableBody tr').forEach(tr=>{
    const cells = Array.from(tr.children).map(td=>{
      const text = stripHtml(td.innerHTML);
      // Coba parse jadi angka murni untuk kolom numerik agar di Excel jadi number, bukan teks
      if(td.classList.contains('num')){
        const cleaned = text.replace(/%$/,'').replace(/\./g,'').replace(',', '.');
        const n = parseFloat(cleaned);
        if(!isNaN(n) && text !== '-' && text !== ''){
          return text.includes('%') ? n / 100 : n;
        }
      }
      return text;
    });
    aoa.push(cells);
  });
  return aoa;
}

function downloadCurrentTableXlsx(){
  if(!cachedData){
    alert('Data belum termuat. Tunggu sebentar atau tekan "Perbarui data".');
    return;
  }
  const titleText = stripHtml(document.getElementById('tblTitle').innerHTML.replace(/<br>/g,' - '));
  const aoa = tableToAOA();
  if(aoa.length < 2){
    alert('Tabel belum berisi data untuk diunduh.');
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Lebar kolom otomatis berdasarkan isi terlebar tiap kolom
  const colCount = aoa[0].length;
  const colWidths = [];
  for(let c=0;c<colCount;c++){
    let maxLen = 8;
    aoa.forEach(row=>{
      const cell = row[c];
      const len = cell === undefined || cell === null ? 0 : String(cell).length;
      if(len > maxLen) maxLen = len;
    });
    colWidths.push({ wch: Math.min(maxLen + 2, 42) });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  const sheetName = `Tabel ${currentTable}`.slice(0,31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const stamp = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-');
  const safeTitle = (titleText || `SI-DETEKTIF Tabel ${currentTable}`).slice(0,60).replace(/[\\/:*?"<>|]/g,'');
  XLSX.writeFile(wb, `${safeTitle} (${stamp}).xlsx`);
}

/* ====================================================================
   STATUS + PENGAMBILAN DATA
   ==================================================================== */
function setStatus(state, text){
  ['statusDash','statusTable'].forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.className = 'status ' + state; el.textContent = text; }
  });
}

function loadData(){
  setStatus('loading', 'Memuat data terbaru…');
  document.querySelectorAll('#refreshBtnDash, #refreshBtnTable').forEach(b => b.disabled = true);

  if(!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('GANTI_DENGAN_URL') === 0){
    setStatus('error', 'URL Apps Script belum diisi. Lihat APPS_SCRIPT_URL di script.js.');
    console.error('APPS_SCRIPT_URL belum diisi. Buka script.js dan ganti dengan URL /exec hasil deploy Apps Script kamu.');
    document.querySelectorAll('#refreshBtnDash, #refreshBtnTable').forEach(b => b.disabled = false);
    return;
  }

  fetch(APPS_SCRIPT_URL + '?action=data', { method: 'GET' })
    .then(function(res){
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data){
      if(data && data.error){ throw new Error(data.message || 'Server error'); }
      cachedData = data;
      renderTotal(data["Jumlah Penduduk"]);
      renderStats(data);
      renderCharts(data);
      switchTable(currentTable);
      setStatus('ok', 'Data termutakhir');
    })
    .catch(function(err){
      setStatus('error', 'Gagal memuat data. Pastikan Web App Apps Script sudah di-deploy dengan akses "Anyone" dan URL-nya benar di script.js, lalu muat ulang halaman.');
      console.error('Gagal mengambil data dari server:', err);
    })
    .finally(function(){
      document.querySelectorAll('#refreshBtnDash, #refreshBtnTable').forEach(b => b.disabled = false);
    });
}


/* ====================================================================
   RINGKASAN PANEL (kanan layar pada halaman tabel)
   ==================================================================== */
function renderSummary(idx, data) {
  const panel = document.getElementById('summaryPanel');
  const emptyEl = document.getElementById('summaryEmpty');
  if (!panel) return;

  if (!data) {
    panel.innerHTML = '<div class="summary-no-data" id="summaryEmpty">Memuat data…</div>';
    return;
  }

  const tgl = getLastDayPrevMonth();
  const sem = getSemester();

  const jp   = data["Jumlah Penduduk"] || [];
  const per  = data["Perekaman"] || [];
  const ak04 = data["Akta Kelahiran (0-4)"] || data["Akta Kelahiran (0-4 Th)"] || data["Akta Kelahiran0-4"] || [];
  const ak018= data["Akta Kelahiran (0-18)"] || data["Akta Kelahiran (0-18 Th)"] || [];
  const akAll = data["Akta Kelahiran"] || [];
  const kia  = data["KIA"] || [];
  const ikd  = data["IKD"] || [];
  const akw   = data["Akta Kawin"] || data["akta kawin"] || data["AKTA KAWIN"]
             || data["Akta kawin"] || data["Kawin"] || [];
  const acr   = data["Akta Cerai"] || data["akta cerai"] || data["AKTA CERAI"]
             || data["Akta cerai"] || data["Cerai"] || [];
  const amt  = data["Akta Kematian"] || data["Akta kematian"] || data["Meninggal"] || [];

  function metricRow(label, value, sub, pct, isGood) {
    const cls = isGood === true ? 'good' : isGood === false ? 'bad' : '';
    const barHtml = pct !== undefined ? `
      <div class="mini-bar-wrap">
        <div class="mini-bar-fill ${cls}" style="width:${Math.min(100,Math.max(0,pct))}%"></div>
      </div>` : '';
    return `
      <div class="summary-metric">
        <div class="summary-metric-label">${label}</div>
        <div class="summary-metric-value">${value}</div>
        ${sub ? `<div class="summary-metric-sub">${sub}</div>` : ''}
        ${barHtml}
      </div>`;
  }

  function rankList(arr, keyFn, fmtFn, n, asc = false) {
    fmtFn = fmtFn || fmt;

    const sorted = [...arr]
      .filter(r => !isNTT(r.WILAYAH))
      .sort((a, b) => asc ? keyFn(a) - keyFn(b) : keyFn(b) - keyFn(a));

    if (!sorted.length) return '';

    return `<div class="rank-list">` +
      sorted.slice(0, n || 5).map((r, i) => `
        <div class="rank-item">
          <span class="rank-num">${i + 1}</span>
          <span class="rank-label">${wilayahLabel(r.WILAYAH)}</span>
          <span class="rank-val">${fmtFn(keyFn(r))}</span>
        </div>`).join('') +
      `</div>`;
  }

  function insightTag(text, type) {
    return `<span class="insight-tag ${type}">${text}</span>`;
  }

  function card(...items) {
    return `<div class="summary-card">${items.join('')}</div>`;
  }

  function sectionLabel(text) {
    return `<div style="font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--clay-deep);margin-bottom:4px;">${text}</div>`;
  }

  let html = `
    <div class="summary-card" style="border-top:3px solid var(--clay);padding-top:14px;">
      <span class="summary-eyebrow" style="font-family:var(--font-m);font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--clay-deep);display:block;margin-bottom:4px;">Ringkasan Tabel</span>
      <div style="font-family:var(--font-d);font-size:15px;font-weight:700;color:var(--ink);">${getSummaryTitle(idx)}</div>
      <div style="font-family:var(--font-m);font-size:10px;color:var(--ink-muted);margin-top:3px;">${tgl}</div>
    </div>`;

  switch (idx) {
    case 1: { // Jumlah Penduduk
      const p = provRow(jp);
      const lk = num(p["PENDUDUK(LK)"]); const pr = num(p["PENDUDUK(PR)"]);
      const total = num(p["PENDUDUK(JML)"]) || (lk + pr);
      const pctLk = total ? (lk/total*100) : 0;
      html += card(
        metricRow('Total Penduduk NTT', fmt(total), sem),
        metricRow('Laki-Laki', fmt(lk), fmtPct(pctLk), pctLk, null),
        metricRow('Perempuan', fmt(pr), fmtPct(100-pctLk), 100-pctLk, null)
      );
      html += card(
        sectionLabel('3 Kab/Kota Terbanyak'),
        rankList(kabRows(jp), r => { const l=num(r["PENDUDUK(LK)"]);const p=num(r["PENDUDUK(PR)"]);return num(r["PENDUDUK(JML)"])||(l+p); }, fmt, 3)
      );
      html += card(
        sectionLabel('3 Kab/Kota Tersedikit'),
        rankList(
          kabRows(jp),
          r => {
            const l = num(r["PENDUDUK(LK)"]);
            const p = num(r["PENDUDUK(PR)"]);
            return num(r["PENDUDUK(JML)"]) || (l + p);
          },
          fmt,
          3,
          true
        )
      );
      break;
    }
    case 2: { // Perekaman KTP-el
      const p = provRow(per);
      const pct = numPct(p["PROGRES PERSENTASE"]);
      const rekam = num(p["PROGRES REKAM"]);
      const belum = num(p["PROGRES BELUM REKAM"]);

      html += card(
        metricRow('Progres Perekaman KTP-el', fmtPct(pct), 'tingkat provinsi', pct, pct >= 80),
        metricRow('Sudah Rekam', fmt(rekam), '', rekam / (rekam + belum || 1) * 100, true),
        metricRow('Belum Rekam', fmt(belum), '', belum / (rekam + belum || 1) * 100, false)
      );

      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(per),
          r => numPct(r["PROGRES PERSENTASE"]),
          fmtPct,
          3
        )
      );

      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(per),
          r => numPct(r["PROGRES PERSENTASE"]),
          fmtPct,
          3,
          true
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Perekaman Tertinggi'),
        rankList(
          kabRows(per),
          r => num(r["PROGRES BELUM REKAM"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Perekaman Terendah'),
        rankList(
          kabRows(per),
          r => num(r["PROGRES BELUM REKAM"]),
          fmt,
          3,
          true
        )
      );
      break;
    }
    case 3:{ // Akta Kelahiran 0-4
      const arr = idx===3 ? ak04 : idx===4 ? ak018 : akAll;
      const labels = idx===3 ? '0–4 Thn' : idx===4 ? '0–18 Thn' : '';
      const p = provRow(arr);

      const memiliki = num(p["MEMILIKI(DINAMIS - JML)"]);
      const belum = num(p["BELUM MEMILIKI(DINAMIS - JML)"]);
      const pct = numPct(p["PERSEN (DINAMIS)(%)"]);

      html += card(
        metricRow(`Akta Kelahiran (${labels})`, fmtPct(pct), 'kepemilikan dinamis', pct, pct >= 80),
        metricRow('Memiliki Akta', fmt(memiliki), '', memiliki/(memiliki+belum||1)*100, true),
        metricRow('Belum Memiliki', fmt(belum), '', belum/(memiliki+belum||1)*100, false)
      );

      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(arr),
          r => numPct(r["PERSEN (DINAMIS)(%)"]),
          fmtPct,
          3
        )
      );

      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(arr),
          r => numPct(r["PERSEN (DINAMIS)(%)"]),
          fmtPct,
          3,
          true
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki Akta Kelahiran Terbanyak'),
        rankList(
          kabRows(arr),
          r => num(r["BELUM MEMILIKI(DINAMIS - JML)"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki Akta Kelahiran Tersedikit'),
        rankList(
          kabRows(arr),
          r => num(r["BELUM MEMILIKI(DINAMIS - JML)"]),
          fmt,
          3,
          true
        )
      );

      break;
    }
    case 4:{ // Akta Kelahiran 0-18
      const arr = idx===3 ? ak04 : idx===4 ? ak018 : akAll;
      const labels = idx===3 ? '0–4 Thn' : idx===4 ? '0–18 Thn' : '';
      const p = provRow(arr);

      const memiliki = num(p["MEMILIKI(DINAMIS - JML)"]);
      const belum = num(p["BELUM MEMILIKI(DINAMIS - JML)"]);
      const pct = numPct(p["PERSEN (DINAMIS)(%)"]);

      html += card(
        metricRow(`Akta Kelahiran (${labels})`, fmtPct(pct), 'kepemilikan dinamis', pct, pct >= 80),
        metricRow('Memiliki Akta', fmt(memiliki), '', memiliki/(memiliki+belum||1)*100, true),
        metricRow('Belum Memiliki', fmt(belum), '', belum/(memiliki+belum||1)*100, false)
      );

      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(arr),
          r => numPct(r["PERSEN (DINAMIS)(%)"]),
          fmtPct,
          3
        )
      );

      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(arr),
          r => numPct(r["PERSEN (DINAMIS)(%)"]),
          fmtPct,
          3,
          true
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki Akta Kelahiran Terbanyak'),
        rankList(
          kabRows(arr),
          r => num(r["BELUM MEMILIKI(DINAMIS - JML)"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki Akta Kelahiran Tersedikit'),
        rankList(
          kabRows(arr),
          r => num(r["BELUM MEMILIKI(DINAMIS - JML)"]),
          fmt,
          3,
          true
        )
      );

      break;
    }
    case 5: { // Akta Kelahiran
      const arr = idx===3 ? ak04 : idx===4 ? ak018 : akAll;
      
      const labels = idx===3 ? '0–4 Thn' : idx===4 ? '0–18 Thn' : ' ';
      const p = provRow(arr);

      const memiliki = num(p["MEMILIKI(DINAMIS - JML)"]);
      const belum = num(p["BELUM MEMILIKI(DINAMIS - JML)"]);
      const pct = numPct(p["PERSEN (DINAMIS)(%)"]);

      html += card(
        metricRow(`Akta Kelahiran`, fmtPct(pct), 'kepemilikan dinamis', pct, pct >= 80),
        metricRow('Memiliki Akta', fmt(memiliki), '', memiliki/(memiliki+belum||1)*100, true),
        metricRow('Belum Memiliki', fmt(belum), '', belum/(memiliki+belum||1)*100, false)
      );

      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(arr),
          r => numPct(r["PERSEN (DINAMIS)(%)"]),
          fmtPct,
          3
        )
      );

      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(arr),
          r => numPct(r["PERSEN (DINAMIS)(%)"]),
          fmtPct,
          3,
          true
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki Akta Kelahiran Terbanyak'),
        rankList(
          kabRows(arr),
          r => num(r["BELUM MEMILIKI(DINAMIS - JML)"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki Akta Kelahiran Tersedikit'),
        rankList(
          kabRows(arr),
          r => num(r["BELUM MEMILIKI(DINAMIS - JML)"]),
          fmt,
          3,
          true
        )
      );

      break;
    }
    case 6: { // KIA
      const p = provRow(kia);

      const memiliki = num(p["MEMILIKI DINAMIS(JML)"]);
      const belum = num(p["BELUM MEMILIKI DINAMIS(JML)"]);
      const pct = numPct(p["PERSEN DINAMIS(%)"]);

      html += card(
        metricRow('Kepemilikan KIA', fmtPct(pct), 'tingkat provinsi', pct, pct >= 70),
        metricRow('Memiliki KIA', fmt(memiliki), '', memiliki / (memiliki + belum || 1) * 100, true),
        metricRow('Belum Memiliki', fmt(belum), '', belum / (memiliki + belum || 1) * 100, false)
      );

      // 3 Progres Tertinggi
      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(kia),
          r => numPct(r["PERSEN DINAMIS(%)"]),
          fmtPct,
          3
        )
      );

      // 3 Progres Terendah
      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(kia),
          r => numPct(r["PERSEN DINAMIS(%)"]),
          fmtPct,
          3,
          true
        )
      );

      // 3 Belum Memiliki KIA Tertinggi
      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki KIA Tertinggi'),
        rankList(
          kabRows(kia),
          r => num(r["BELUM MEMILIKI DINAMIS(JML)"]),
          fmt,
          3
        )
      );

      // 3 Belum Memiliki KIA Terendah
      html += card(
        sectionLabel('3 Kab/Kota Belum Memiliki KIA Terendah'),
        rankList(
          kabRows(kia),
          r => num(r["BELUM MEMILIKI DINAMIS(JML)"]),
          fmt,
          3,
          true
        )
      );

      break;
    }
    case 7: { // IKD
      const p = provRow(ikd);

      const jumlah = num(p["JUMLAH IKD"]);
      const basis = num(p["REKAM DINAMIS"]);
      const pct = basis ? jumlah / basis * 100 : numPct(p["PERSEN IKD"]);

      html += card(
        metricRow('Aktivasi IKD', fmtPct(pct), 'dari rekam dinamis', pct, pct >= 60),
        metricRow('Jumlah Aktivasi', fmt(jumlah), 'akun IKD aktif'),
        metricRow('Basis Rekam', fmt(basis), 'rekam KTP-el dinamis')
      );

      // 3 Progres Tertinggi
      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(ikd),
          r => numPct(r["PERSEN IKD"]),
          fmtPct,
          3
        )
      );

      // 3 Progres Terendah
      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(ikd),
          r => numPct(r["PERSEN IKD"]),
          fmtPct,
          3,
          true
        )
      );

      // 3 Belum Aktivasi IKD Tertinggi
      html += card(
        sectionLabel('3 Kab/Kota Belum Aktivasi IKD Tertinggi'),
        rankList(
          kabRows(ikd),
          r => Math.max(0, num(r["REKAM DINAMIS"]) - num(r["JUMLAH IKD"])),
          fmt,
          3
        )
      );

      // 3 Belum Aktivasi IKD Terendah
      html += card(
        sectionLabel('3 Kab/Kota Belum Aktivasi IKD Terendah'),
        rankList(
          kabRows(ikd),
          r => Math.max(0, num(r["REKAM DINAMIS"]) - num(r["JUMLAH IKD"])),
          fmt,
          3,
          true
        )
      );

      break;
    }
    case 8: { // Akta Kawin
      const p = provRow(akw);

      const memiliki = num(p["MEMILIKI AKTA KAWIN(JML)"]); const belum = num(p["BELUM MEMILIKI AKTA KAWIN(JML)"]);
      const pct = numPct(p["PERSEN (MEMILIKI)(%)"]);
      html += card(
        metricRow('Kepemilikan Akta Kawin', fmtPct(pct), 'tingkat provinsi', pct, pct >= 70),
        metricRow('Memiliki Akta Kawin', fmt(memiliki), '', memiliki/(memiliki+belum||1)*100, true),
        metricRow('Belum Memiliki', fmt(belum), '', belum/(memiliki+belum||1)*100, false)
      );
      html += card(
        sectionLabel('3 Progres Tertinggi'),
        rankList(
          kabRows(akw),
          r => numPct(r["PERSEN (MEMILIKI)(%)"]),
          fmtPct,
          3
        )
      );

      html += card(
        sectionLabel('3 Progres Terendah'),
        rankList(
          kabRows(akw),
          r => numPct(r["PERSEN (MEMILIKI)(%)"]),
          fmtPct,
          3,
          true
        )
      );

      html += card(
        sectionLabel('3 Belum Memiliki Akta Kawin Terbanyak'),
        rankList(
          kabRows(akw),
          r => num(r["BELUM MEMILIKI AKTA KAWIN(JML)"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Belum Memiliki Akta Kawin Tersedikit'),
        rankList(
          kabRows(akw),
          r => num(r["BELUM MEMILIKI AKTA KAWIN(JML)"]),
          fmt,
          3,
          true
        )
      );
      break;
    }
    case 9: { // Akta Cerai
      const p = provRow(acr);
      const jml = num(p["MEMILIKI AKTA CERAI(JML)"]);
      html += card(
        metricRow('Total Akta Cerai Tercatat', fmt(jml), 'tingkat provinsi')
      );
      html += card(
        sectionLabel('3 Terbanyak'),
        rankList(
          kabRows(acr),
          r => num(r["MEMILIKI AKTA CERAI(JML)"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Tersedikit'),
        rankList(
          kabRows(acr),
          r => num(r["MEMILIKI AKTA CERAI(JML)"]),
          fmt,
          3,
          true
        )
      );
      break;
    }
    case 10: { // Akta Kematian
      const p = provRow(amt);
      const jml = num(p["MENINGGAL(JML)"]);
      html += card(
        metricRow('Total Akta Kematian Tercatat', fmt(jml), 'tingkat provinsi')
      );
      html += card(
        sectionLabel('3 Terbanyak'),
        rankList(
          kabRows(amt),
          r => num(r["MENINGGAL(JML)"]),
          fmt,
          3
        )
      );

      html += card(
        sectionLabel('3 Tersedikit'),
        rankList(
          kabRows(amt),
          r => num(r["MENINGGAL(JML)"]),
          fmt,
          3,
          true
        )
      );
      break;
    }
    default:
      html += `<div class="summary-no-data">Pilih tabel untuk melihat ringkasan.</div>`;
  }

  panel.innerHTML = html;
}

function getSummaryTitle(idx) {
  const titles = ['','Jumlah Penduduk','Perekaman KTP-el','Akta Kelahiran 0–4 Thn','Akta Kelahiran 0–18 Thn','Akta Kelahiran Semua Usia','Kepemilikan KIA','Aktivasi IKD','Akta Kawin','Akta Cerai','Akta Kematian'];
  return titles[idx] || 'Data Agregat';
}

document.addEventListener('DOMContentLoaded', loadData);