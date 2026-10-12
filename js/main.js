/* ============================================================
   CS77 PRODUCT SCANNER
   Crafted by AndrewCS77 · Powered by DeepSeek
   ============================================================ */

const GITHUB_URL_DEFAULT = "https://raw.githubusercontent.com/KhatwahAmam-Dev/universal_log/main/data/master.json";
const STORAGE = {
  master: "cs77_master",
  manual: "cs77_manual",
  expired: "cs77_expired",
  settings: "cs77_settings"
};

let state = {
  master: [],
  manual: [],
  expired: {},
  scanner: null,
  scannerActive: false,
  lastScan: null
};

/* ---------- UTIL ---------- */
function $(id) { return document.getElementById(id); }
function today() { return new Date(new Date().toDateString()); }

function toast(msg, type) {
  type = type || "";
  const t = $("toast");
  if (!t) return;

  // Reset animasi kalau toast sebelumnya masih muncul
  t.className = "toast " + type;
  void t.offsetWidth; // 🔑 paksa reflow biar animasi restart

  // Tampilkan
  t.textContent = msg;
  t.className = "toast show " + type;

  // Auto-hide dengan durasi adaptif (pesan panjang = tampil lebih lama)
  const durasi = Math.min(4500, Math.max(2200, msg.length * 60));
  clearTimeout(t._timer);
  t._timer = setTimeout(function() {
    t.className = "toast " + type; // hilang total
  }, durasi);
}
function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn(e); }
}
function loadLocal(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch(e) { return def; }
}

/* ---------- EXPIRED LOGIC ---------- */
function getExpiryStatus(plu) {
  const e = state.expired[plu];
  if (!e || !e.tgl) return { level: "gray", label: "Belum input expired", days: null, icon: "📝" };

  const exp = new Date(e.tgl);
  const days = daysBetween(today(), exp);

  if (days > 30)  return { level: "green",  label: "Aman dipajang", days: days, icon: "✅" };
  if (days > 14)  return { level: "yellow", label: "Sisa pajang " + days + " hari", days: days, icon: "⚠️" };
  if (days > 0)   return { level: "orange", label: "SEGERA TARIK! Sisa " + days + " hari", days: days, icon: "🚨" };
  return { level: "red", label: "EXPIRED " + Math.abs(days) + " hari lalu", days: days, icon: "❌" };
}

/* ---------- CARI PRODUK ---------- */
function findProduct(code) {
  if (!code) return null;
  const c = String(code).trim().toLowerCase();
  const all = state.master.concat(state.manual);

  let p = all.find(function(x) { return String(x.barcode || "").toLowerCase() === c; });
  if (p) return p;

  p = all.find(function(x) { return String(x.plu || "").toLowerCase() === c; });
  return p || null;
}

/* ---------- RENDER HASIL SCAN ---------- */
function renderScanResult(product, code) {
  const box = $("scanResult");
  if (!box) return;

  if (!product) {
    box.innerHTML =
      '<div class="card" style="border-left:4px solid #dc2626;">' +
        '<h3 style="color:#dc2626;">❌ Produk Tidak Ditemukan</h3>' +
        '<p style="font-size:13px;color:#64748b;">Kode: <b style="font-family:monospace;">' + code + '</b></p>' +
        '<p style="font-size:12px;color:#64748b;margin-top:8px;">Produk ini belum ada di master. Tambahkan lewat tab <b>Manual</b>.</p>' +
      '</div>';
    return;
  }

  const exp = getExpiryStatus(product.plu);
  const expData = state.expired[product.plu];
  const tglExp = expData ? expData.tgl : "";

  let html = '';
  html += '<div class="product-card">';
  html += '  <div class="product-header ' + exp.level + '">';
  html += '    <div class="expiry-badge">' + exp.icon + ' ' + (exp.level === "gray" ? "Belum input" : exp.days + " hari") + '</div>';
  html += '    <div class="plu">PLU: ' + product.plu + '</div>';
  html += '    <div class="name">' + (product.descp || product.s_descp || "-") + '</div>';
  html += '    <div class="barcode">📊 ' + (product.barcode || "-") + '</div>';
  html += '  </div>';
  html += '  <div class="product-body">';

  if (product.lokasi_rak) {
    html += '<div class="lokasi-rak">';
    html += '  <div class="lbl">📍 LOKASI RAK</div>';
    html += '  <div class="val">' + product.lokasi_rak + '</div>';
    html += '</div>';
  } else {
    html += '<div class="lokasi-rak" style="background:#f1f5f9;border-color:#94a3b8;">';
    html += '  <div class="lbl" style="color:#64748b;">📍 LOKASI RAK</div>';
    html += '  <div class="val" style="color:#64748b;">Belum diisi</div>';
    html += '</div>';
  }

  html += '<div class="info-grid">';
  html += '  <div class="info-item"><div class="lbl">Kategori</div><div class="val">' + (product.kategori || "-") + '</div></div>';
  html += '  <div class="info-item"><div class="lbl">Satuan</div><div class="val">' + (product.satuan || "PCS") + '</div></div>';
  html += '  <div class="info-item"><div class="lbl">Harga</div><div class="val">Rp ' + (product.price1 || 0).toLocaleString("id-ID") + '</div></div>';
  html += '  <div class="info-item"><div class="lbl">Qty</div><div class="val">' + (product.qty1 || 0) + ' / ' + (product.qty2 || 0) + ' / ' + (product.qty3 || 0) + '</div></div>';
  html += '</div>';

  html += '<div class="expiry-section">';
  html += '  <div class="expiry-status ' + exp.level + '">';
  html += '    <span class="icon">' + exp.icon + '</span>';
  html += '    <div>';
  html += '      <div style="font-size:12px;opacity:0.8;">Status Expired</div>';
  html += '      <div>' + exp.label + '</div>';
  html += '    </div>';
  html += '  </div>';
  html += '  <label>Input / Update Tanggal Expired</label>';
  html += '  <div class="row">';
  html += '    <input type="date" id="expDateInput" value="' + tglExp + '">';
  html += '    <button class="btn sm green" id="btnSaveExp" style="flex:0 0 auto;">💾 Simpan</button>';
  html += '  </div>';
  if (expData) {
    html += '<p style="font-size:11px;color:#64748b;margin-top:6px;">Diinput: ' + new Date(expData.inputAt).toLocaleString("id-ID") + '</p>';
  }
  html += '</div>';
  html += '</div></div>';

  box.innerHTML = html;

  const btnSave = $("btnSaveExp");
  if (btnSave) {
    btnSave.onclick = function() {
      const tgl = $("expDateInput").value;
      if (!tgl) { toast("Pilih tanggal dulu", "red"); return; }
      state.expired[product.plu] = { tgl: tgl, inputAt: Date.now() };
      saveLocal(STORAGE.expired, state.expired);
      toast("✅ Tanggal expired disimpan", "green");
      renderScanResult(product, code);
      renderDashboard();
    };
  }
}

/* ---------- SCANNER ---------- */
/* ---------- SCANNER (IMPROVED - HD + AUTO-FALLBACK + SWITCH CAMERA) ---------- */
let currentCameraIndex = 0;
let availableCameras = [];

async function startScanner() {
  if (state.scannerActive) return;

  if (typeof Html5Qrcode === "undefined") {
    toast("Library scanner belum termuat. Refresh halaman.", "red");
    return;
  }

  const btn = $("btnStartScan");
  btn.innerHTML = '<span class="spinner"></span> Memuat kamera...';

  // Bersihkan sisa stream kamera yang mungkin nyangkut
  await cleanupStaleStreams();

  try {
    // 1. Cek dulu perangkat kamera yang tersedia
    availableCameras = await Html5Qrcode.getCameras();

    if (!availableCameras || availableCameras.length === 0) {
      throw new Error("Kamera tidak terdeteksi di perangkat ini");
    }

    // 2. Buat instance scanner
    state.scanner = new Html5Qrcode("reader");

    // 3. Konfigurasi HD: 1280x720, fps 15 (lebih smooth untuk barcode)
    const config = {
      fps: 15,
      qrbox: function(viewfinderWidth, viewfinderHeight) {
        // Kotak scan lebih lebar & proporsional (cocok untuk barcode)
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        return {
          width: Math.floor(minEdge * 0.85),
          height: Math.floor(minEdge * 0.45)
        };
      },
      aspectRatio: 1.777, // 16:9
      disableFlip: false,
      videoConstraints: {
        width:  { ideal: 1280, min: 640 },
        height: { ideal: 720,  min: 480 },
        facingMode: { ideal: "environment" }, // utamakan kamera belakang
        // Auto-focus & exposure (kalau didukung browser)
        advanced: [
          { focusMode: "continuous" },
          { exposureMode: "continuous" },
          { whiteBalanceMode: "continuous" }
        ]
      }
    };

    // 4. Pilih kamera: prioritas "environment" (belakang)
    let cameraIdOrConfig;
    const envCam = availableCameras.find(function(c) {
      return /back|rear|environment|belakang/i.test(c.label || "");
    });

    if (envCam) {
      cameraIdOrConfig = envCam.id;
      currentCameraIndex = availableCameras.indexOf(envCam);
    } else {
      cameraIdOrConfig = { facingMode: "environment" };
    }

    // 5. Coba start dengan HD config
    await state.scanner.start(
      cameraIdOrConfig,
      config,
      onScanSuccess,
      function() { /* ignore per-frame errors */ }
    );

    state.scannerActive = true;
    updateScannerButtons(true);

    // Tampilkan tombol switch kamera kalau ada >1 kamera
    if (availableCameras.length > 1) {
      showSwitchCameraButton();
    }

    toast("✅ Kamera aktif (HD 1280×720)", "green");

  } catch (err) {
    console.error("Start scanner error:", err);
    handleCameraError(err);
    btn.innerHTML = "▶️ Nyalakan Kamera";
  }
}

/* ---------- FALLBACK: kalau HD gagal, coba resolusi rendah ---------- */
async function startScannerFallback() {
  try {
    state.scanner = new Html5Qrcode("reader");
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      videoConstraints: {
        facingMode: { ideal: "environment" }
      }
    };
    await state.scanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      function() {}
    );
    state.scannerActive = true;
    updateScannerButtons(true);
    toast("✅ Kamera aktif (mode kompatibilitas)", "green");
  } catch (err) {
    handleCameraError(err);
  }
}

/* ---------- HANDLE ERROR KAMERA DENGAN PESAN JELAS ---------- */
function handleCameraError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  let userMsg = "Gagal akses kamera";

  if (/NotReadableError|Failed to allocate|Could not start/i.test(msg)) {
    userMsg = "⚠️ Kamera sedang dipakai aplikasi lain. Tutup Zoom/Meet/WhatsApp/OBS, lalu coba lagi.";
  } else if (/NotAllowedError|Permission denied/i.test(msg)) {
    userMsg = "⚠️ Izin kamera ditolak. Klik ikon 🔒 di address bar → izinkan Camera.";
  } else if (/NotFoundError|no camera|tidak terdeteksi/i.test(msg)) {
    userMsg = "⚠️ Kamera tidak terdeteksi. Pastikan kamera terpasang & aktif.";
  } else if (/OverconstrainedError/i.test(msg)) {
    userMsg = "⚠️ Kamera tidak mendukung resolusi ini. Coba tombol fallback.";
  }

  toast(userMsg, "red");

  // Tawarkan fallback otomatis setelah 1 detik
  if (/OverconstrainedError|NotReadableError/i.test(msg)) {
    setTimeout(function() {
      if (confirm("Coba pakai mode kompatibilitas (resolusi lebih rendah)?")) {
        startScannerFallback();
      }
    }, 800);
  }
}

/* ---------- BERSIHKAN STREAM KAMERA YANG NYANGKUT ---------- */
async function cleanupStaleStreams() {
  try {
    // Matikan stream di video element (kalau ada sisa)
    const videos = document.querySelectorAll("#reader video");
    videos.forEach(function(v) {
      if (v.srcObject) {
        v.srcObject.getTracks().forEach(function(t) { t.stop(); });
        v.srcObject = null;
      }
    });

    // Matikan scanner lama kalau ada
    if (state.scanner) {
      try { await state.scanner.stop(); } catch(e) {}
      try { await state.scanner.clear(); } catch(e) {}
      state.scanner = null;
    }

    // Kasih waktu browser release resource
    await new Promise(function(r) { setTimeout(r, 300); });
  } catch(e) {
    console.warn("Cleanup warn:", e);
  }
}

/* ---------- UPDATE TOMBOL SCANNER ---------- */
function updateScannerButtons(isActive) {
  const bs = $("btnStartScan");
  const bp = $("btnStopScan");
  if (bs) {
    bs.innerHTML = "▶️ Nyalakan Kamera";
    bs.style.display = isActive ? "none" : "inline-flex";
  }
  if (bp) {
    bp.style.display = isActive ? "inline-flex" : "none";
  }
}

/* ---------- TOMBOL SWITCH KAMERA DEPAN/BELAKANG ---------- */
function showSwitchCameraButton() {
  // Hapus tombol lama kalau ada
  const old = $("btnSwitchCam");
  if (old) old.remove();

  const btn = document.createElement("button");
  btn.id = "btnSwitchCam";
  btn.className = "btn orange";
  btn.innerHTML = "🔄 Ganti Kamera";
  btn.style.marginTop = "8px";
  btn.style.width = "100%";

  btn.onclick = async function() {
    if (!state.scannerActive) return;
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    const cam = availableCameras[currentCameraIndex];

    try {
      btn.innerHTML = '<span class="spinner"></span> Ganti...';
      await state.scanner.stop();
      await state.scanner.start(
        cam.id,
        {
          fps: 15,
          qrbox: function(w, h) {
            const m = Math.min(w, h);
            return { width: Math.floor(m * 0.85), height: Math.floor(m * 0.45) };
          },
          videoConstraints: {
            width: { ideal: 1280 }, height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" }]
          }
        },
        onScanSuccess,
        function() {}
      );
      btn.innerHTML = "🔄 Ganti Kamera";
      toast("✅ Pindah ke: " + (cam.label || "Kamera " + (currentCameraIndex + 1)), "green");
    } catch (err) {
      console.error(err);
      btn.innerHTML = "🔄 Ganti Kamera";
      toast("Gagal ganti kamera: " + (err.message || err), "red");
    }
  };

  const readerBox = $("reader");
  if (readerBox && readerBox.parentNode) {
    readerBox.parentNode.insertBefore(btn, readerBox.nextSibling);
  }
}

/* ---------- CALLBACK SCAN BERHASIL ---------- */
function onScanSuccess(decodedText) {
  if (state.lastScan === decodedText) return;
  state.lastScan = decodedText;
  setTimeout(function() { state.lastScan = null; }, 2000);

  const p = findProduct(decodedText);
  renderScanResult(p, decodedText);
  if (p) toast("✅ " + (p.s_descp || p.descp), "green");
  else toast("❌ Produk tidak ditemukan", "red");

  if (navigator.vibrate) navigator.vibrate(80);
}

/* ---------- STOP SCANNER ---------- */
async function stopScanner() {
  if (!state.scanner) return;
  try {
    if (state.scannerActive) await state.scanner.stop();
    await state.scanner.clear();
  } catch(e) {}
  state.scanner = null;
  state.scannerActive = false;

  // Hapus tombol switch kamera
  const sc = $("btnSwitchCam");
  if (sc) sc.remove();

  updateScannerButtons(false);
  toast("Kamera dimatikan");
}

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const all = state.master.concat(state.manual);
  let green=0, yellow=0, orange=0, red=0;

  all.forEach(function(p) {
    const s = getExpiryStatus(p.plu);
    if (s.level === "green") green++;
    else if (s.level === "yellow") yellow++;
    else if (s.level === "orange") orange++;
    else if (s.level === "red") red++;
  });

  const grid = $("statGrid");
  if (grid) {
    grid.innerHTML =
      '<div class="stat-card green"><div class="num">' + green + '</div><div class="lbl">🟢 Aman (>30 hari)</div></div>' +
      '<div class="stat-card yellow"><div class="num">' + yellow + '</div><div class="lbl">🟡 Pantau (15-30 hari)</div></div>' +
      '<div class="stat-card orange"><div class="num">' + orange + '</div><div class="lbl">🟠 Segera Tarik (1-14 hari)</div></div>' +
      '<div class="stat-card red"><div class="num">' + red + '</div><div class="lbl">🔴 Expired (lewat)</div></div>';
  }

  const alerts = all
    .map(function(p) { return { p: p, s: getExpiryStatus(p.plu) }; })
    .filter(function(x) { return x.s.level === "orange" || x.s.level === "red"; })
    .sort(function(a, b) { return a.s.days - b.s.days; });

  const list = $("alertList");
  if (!list) return;

  if (!alerts.length) {
    list.innerHTML = '<div class="empty"><div class="big">✅</div>Tidak ada produk yang perlu ditarik</div>';
  } else {
    list.innerHTML = alerts.map(function(x) {
      return '<div class="list-item">' +
        '<div class="dot ' + x.s.level + '"></div>' +
        '<div class="info">' +
          '<div class="t">' + (x.p.s_descp || x.p.descp || "-") + '</div>' +
          '<div class="s">PLU ' + x.p.plu + ' · ' + (x.p.lokasi_rak || "rak belum diisi") + ' · ' + x.s.label + '</div>' +
        '</div>' +
      '</div>';
    }).join("");
  }
}

/* ---------- PRODUK MANUAL ---------- */
function renderManualList() {
  const box = $("manualList");
  if (!box) return;

  if (!state.manual.length) {
    box.innerHTML = '<div class="empty">Belum ada produk manual</div>';
    return;
  }

  box.innerHTML = state.manual.map(function(p, i) {
    return '<div class="list-item">' +
      '<div class="dot" style="background:#2563eb;"></div>' +
      '<div class="info">' +
        '<div class="t">' + (p.s_descp || p.descp) + '</div>' +
        '<div class="s">PLU ' + p.plu + ' · ' + (p.barcode || "-") + ' · ' + (p.lokasi_rak || "-") + '</div>' +
      '</div>' +
      '<button class="btn sm red" data-idx="' + i + '" onclick="hapusManual(' + i + ')">🗑️</button>' +
    '</div>';
  }).join("");
}

window.hapusManual = function(i) {
  if (!confirm("Hapus produk manual ini?")) return;
  state.manual.splice(i, 1);
  saveLocal(STORAGE.manual, state.manual);
  renderManualList();
  renderDashboard();
  toast("Produk manual dihapus", "orange");
};

/* ---------- FETCH GITHUB ---------- */
async function fetchGithub(url) {
  if (!url) { toast("URL kosong", "red"); return; }
  const btn = $("btnFetchGithub");
  if (btn) btn.innerHTML = '<span class="spinner"></span> Mengambil...';

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Format JSON harus array");

    state.master = data;
    saveLocal(STORAGE.master, state.master);
    const st = loadLocal(STORAGE.settings, {});
    st.lastUrl = url;
    st.lastFetch = Date.now();
    saveLocal(STORAGE.settings, st);

    const info = $("lastFetchInfo");
    if (info) info.textContent = "✅ Terakhir fetch: " + new Date().toLocaleString("id-ID") + " (" + data.length + " produk)";
    toast("✅ " + data.length + " produk dimuat dari GitHub", "green");
    renderDashboard();
    renderDataInfo();
    setOnline(true);
  } catch (err) {
    console.error(err);
    toast("Gagal fetch: " + (err.message || err), "red");
    setOnline(false);
  } finally {
    if (btn) btn.innerHTML = "⬇️ Ambil Data";
  }
}

function setOnline(ok) {
  const d = $("statusDot");
  if (!d) return;
  d.className = "status-dot" + (ok ? "" : " offline");
  d.title = ok ? "Online" : "Offline";
}

/* ---------- EXPORT PDF ---------- */
async function exportPdf() {
  const all = state.master.concat(state.manual);
  const withExp = all.filter(function(p) { return state.expired[p.plu]; });

  if (!withExp.length) { toast("Belum ada produk yang diinput expired", "orange"); return; }

  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPDFCtor) { toast("Library PDF belum termuat", "red"); return; }

  const doc = new jsPDFCtor({ unit: "mm", format: "a4" });
  let y = 15;
  const pageW = 210;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("CS77 · LAPORAN EXPIRED PRODUK", 14, 10);
  doc.setFontSize(9);
  doc.text("Dicetak: " + new Date().toLocaleString("id-ID") + " · Total: " + withExp.length + " produk", 14, 17);

  y = 32;
  doc.setTextColor(0, 0, 0);

  withExp.forEach(function(p) {
    if (y > 240) { doc.addPage(); y = 20; }

    const s = getExpiryStatus(p.plu);
    const e = state.expired[p.plu];

    const colors = {
      green: [22,163,74], yellow: [234,179,8],
      orange: [249,115,22], red: [220,38,38], gray: [100,116,139]
    };
    const c = colors[s.level] || colors.gray;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(14, y, 3, 32, "F");

    doc.setFontSize(11);
    doc.text((p.descp || p.s_descp || "-").substring(0, 55), 20, y + 5);

    doc.setFontSize(9);
    doc.text("PLU: " + p.plu + "    Barcode: " + (p.barcode || "-"), 20, y + 11);
    doc.text("Lokasi Rak: " + (p.lokasi_rak || "-"), 20, y + 16);
    doc.text("Expired: " + formatDate(e.tgl) + "    Status: " + s.label, 20, y + 21);

    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, String(p.barcode || p.plu), {
        format: "CODE128", width: 1.6, height: 30, displayValue: false, margin: 0
      });
      const img = canvas.toDataURL("image/png");
      doc.addImage(img, "PNG", 130, y + 1, 65, 15);
      doc.setFontSize(7);
      doc.text(String(p.barcode || p.plu), 130, y + 18);
    } catch (err) {}

    doc.setDrawColor(220, 220, 220);
    doc.line(14, y + 34, pageW - 14, y + 34);
    y += 38;
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Crafted by AndrewCS77 · Powered by DeepSeek", pageW / 2, 290, { align: "center" });

  const fname = "CS77_Expired_" + new Date().toISOString().slice(0,10) + ".pdf";
  doc.save(fname);
  toast("✅ PDF berhasil diexport", "green");
}

/* ---------- BACKUP JSON ---------- */
function backupJson() {
  const data = {
    exportedAt: new Date().toISOString(),
    app: "CS77 Product Scanner",
    master: state.master,
    manual: state.manual,
    expired: state.expired
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "CS77_Backup_" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
  toast("✅ Backup tersimpan", "green");
}

/* ---------- INFO DATA ---------- */
function renderDataInfo() {
  const el = $("dataInfo");
  if (!el) return;
  const st = loadLocal(STORAGE.settings, {});
  el.innerHTML =
    '<div>📦 Master: <b>' + state.master.length + '</b> produk</div>' +
    '<div>➕ Manual: <b>' + state.manual.length + '</b> produk</div>' +
    '<div>⏰ Expired terinput: <b>' + Object.keys(state.expired).length + '</b> produk</div>' +
    '<div style="margin-top:8px;font-size:11px;color:#64748b;">' +
      'URL terakhir: <span style="font-family:monospace;word-break:break-all;">' + (st.lastUrl || "-") + '</span>' +
    '</div>';
}

/* ---------- EVENT BINDING (dipanggil setelah DOM siap) ---------- */
function bindEvents() {
  document.querySelectorAll("nav button").forEach(function(btn) {
    btn.onclick = function() {
      document.querySelectorAll("nav button").forEach(function(b) { b.classList.remove("active"); });
      document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
      btn.classList.add("active");
      const pg = $("page-" + btn.dataset.page);
      if (pg) pg.classList.add("active");
      if (btn.dataset.page === "dashboard") renderDashboard();
      if (btn.dataset.page === "manual") renderManualList();
      if (btn.dataset.page === "data") renderDataInfo();
    };
  });

  const bs = $("btnStartScan"); if (bs) bs.onclick = startScanner;
  const bp = $("btnStopScan");  if (bp) bp.onclick = stopScanner;

  const bms = $("btnManualSearch");
  if (bms) bms.onclick = function() {
    const code = $("manualInput").value.trim();
    if (!code) { toast("Isi kode dulu", "red"); return; }
    const p = findProduct(code);
    renderScanResult(p, code);
    if (p) toast("✅ Ditemukan", "green"); else toast("❌ Tidak ditemukan", "red");
  };

  const mi = $("manualInput");
  if (mi) mi.addEventListener("keydown", function(e) {
    if (e.key === "Enter") $("btnManualSearch").click();
  });

  const bam = $("btnAddManual");
  if (bam) bam.onclick = function() {
    const plu = $("mPlu").value.trim();
    const nama = $("mNama").value.trim();
    if (!plu || !nama) { toast("PLU & Nama wajib diisi", "red"); return; }

    state.manual.push({
      plu: isNaN(plu) ? plu : Number(plu),
      descp: nama, s_descp: nama,
      barcode: $("mBarcode").value.trim(),
      lokasi_rak: $("mRak").value.trim(),
      price1: Number($("mHarga").value) || 0,
      satuan: "PCS", kategori: 0,
      _manual: true, _createdAt: Date.now()
    });
    saveLocal(STORAGE.manual, state.manual);
    $("mPlu").value = ""; $("mNama").value = ""; $("mBarcode").value = "";
    $("mRak").value = ""; $("mHarga").value = "";
    renderManualList();
    renderDashboard();
    renderDataInfo();
    toast("✅ Produk manual disimpan", "green");
  };

  const bfg = $("btnFetchGithub");
  if (bfg) bfg.onclick = function() { fetchGithub($("githubUrl").value.trim()); };

  const bru = $("btnResetUrl");
  if (bru) bru.onclick = function() { $("githubUrl").value = GITHUB_URL_DEFAULT; toast("URL direset"); };

  const fu = $("fileUpload");
  if (fu) fu.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error("Format harus array");
        state.master = data;
        saveLocal(STORAGE.master, state.master);
        renderDashboard();
        renderDataInfo();
        toast("✅ " + data.length + " produk dimuat dari file", "green");
      } catch (err) {
        toast("File tidak valid: " + err.message, "red");
      }
    };
    reader.readAsText(file);
  };

  const bep = $("btnExportPdf");  if (bep) bep.onclick = exportPdf;
  const bbj = $("btnBackupJson"); if (bbj) bbj.onclick = backupJson;

  const bce = $("btnClearExpired");
  if (bce) bce.onclick = function() {
    if (!confirm("Hapus SEMUA data expired? Tindakan ini tidak bisa dibatalkan.")) return;
    state.expired = {};
    saveLocal(STORAGE.expired, state.expired);
    renderDashboard();
    renderDataInfo();
    toast("Data expired dihapus", "orange");
  };
}

/* ---------- INIT ---------- */
function init() {
  state.master = loadLocal(STORAGE.master, []);
  state.manual = loadLocal(STORAGE.manual, []);
  state.expired = loadLocal(STORAGE.expired, {});

  const st = loadLocal(STORAGE.settings, {});
  const gi = $("githubUrl");
  if (gi) gi.value = st.lastUrl || GITHUB_URL_DEFAULT;

  bindEvents();

  renderDashboard();
  renderManualList();
  renderDataInfo();

  if (st.lastFetch) {
    const info = $("lastFetchInfo");
    if (info) info.textContent = "📦 Terakhir fetch: " + new Date(st.lastFetch).toLocaleString("id-ID") + " (" + state.master.length + " produk)";
  }

  setOnline(navigator.onLine);
  window.addEventListener("online", function() { setOnline(true); });
  window.addEventListener("offline", function() { setOnline(false); });

  if (navigator.onLine) {
    const lastFetch = st.lastFetch || 0;
    const jamSejakFetch = (Date.now() - lastFetch) / (1000 * 60 * 60);
    if (jamSejakFetch > 24 || state.master.length === 0) {
      fetchGithub(st.lastUrl || GITHUB_URL_DEFAULT);
    }
  }
}

/* ---------- START ---------- */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
