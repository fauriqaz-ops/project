// app.js — EbookForge AI Frontend Logic

// ── CONSTANTS ─────────────────────────────────────────────────────────────
const STEPS = ["Input", "Struktur", "Konten", "Selesai"];
const GAYA_OPTIONS = ["Santai & Mengalir", "Formal & Profesional", "Storytelling", "Motivatif", "Akademik Ringan"];
const PANJANG_OPTIONS = [
  { label: "Short (~20 hal)", value: "short", bab: 5 },
  { label: "Medium (~40 hal)", value: "medium", bab: 8 },
  { label: "Long (~70 hal)", value: "long", bab: 12 },
];
const TUJUAN_OPTIONS = [
  "Edukasi / Berbagi Ilmu",
  "Jualan / Monetisasi",
  "Personal Branding",
  "Lead Magnet Gratis",
  "Kursus / Training",
];

// ── STATE ──────────────────────────────────────────────────────────────────
let state = {
  step: 0,
  form: {
    topik: "",
    target: "",
    tujuan: "Edukasi / Berbagi Ilmu",
    gaya: "Santai & Mengalir",
    panjang: "medium",
    konteks: "",
  },
  loading: false,
  logLines: [],
  structure: null,
  chapters: [],
  extras: { pengantar: "", penutup: "", checklist: "" },
  error: "",
  currentBab: -1,
};

// ── API CALL ───────────────────────────────────────────────────────────────
async function callAPI(systemPrompt, userPrompt) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data.text || "";
}

function parseJSON(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    // Coba ekstrak JSON dari teks
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

// ── LOG HELPER ─────────────────────────────────────────────────────────────
function addLog(msg, active = false) {
  state.logLines.push({ msg, active });
  renderLog();
}

function renderLog() {
  const el = document.getElementById("progress-log");
  if (!el) return;
  el.innerHTML = state.logLines
    .map(l => `<div class="log-line ${l.active ? "active" : ""}">› ${l.msg}</div>`)
    .join("");
  el.scrollTop = el.scrollHeight;
}

function updateLoadingSub(msg) {
  const el = document.getElementById("loading-sub");
  if (el) el.textContent = msg;
}

function updateBabProgress() {
  if (!state.structure) return;
  const el = document.getElementById("bab-progress");
  if (!el) return;
  el.innerHTML = state.structure.bab
    .map((b, i) => {
      const cls = i < state.currentBab ? "done" : i === state.currentBab ? "active" : "";
      return `<div class="bab-chip ${cls}">Bab ${b.nomor}</div>`;
    })
    .join("");
}

// ── GENERATE STRUCTURE ─────────────────────────────────────────────────────
async function generateStructure() {
  state.error = "";
  state.loading = true;
  state.logLines = [];
  renderStep0Loading();
  addLog("Menghubungi Gemini AI...", true);

  try {
    const panjangInfo = PANJANG_OPTIONS.find(p => p.value === state.form.panjang);
    const raw = await callAPI(
      `Kamu editor ebook profesional Indonesia. Return JSON murni tanpa teks lain.`,
      `Buat struktur ebook:
Topik: ${state.form.topik}
Target: ${state.form.target}
Tujuan: ${state.form.tujuan}
Gaya: ${state.form.gaya}
Jumlah bab: ${panjangInfo?.bab}
Konteks: ${state.form.konteks || "-"}

Return JSON persis (tanpa teks lain):
{"judul":"...","subtitle":"...","hook":"2-3 kalimat pembuka menarik","bab":[{"nomor":1,"judul":"...","deskripsi":"1 kalimat ringkas isi bab"},...]}`
    );

    addLog("Struktur diterima. Memparse...");
    const parsed = parseJSON(raw);
    if (!parsed?.bab?.length) throw new Error("Gagal memparse struktur. Coba generate ulang.");

    state.structure = parsed;
    addLog("✓ Struktur berhasil dibuat!");
    state.loading = false;
    state.step = 1;
    render();
  } catch (e) {
    state.error = e.message;
    state.loading = false;
    render();
  }
}

// ── GENERATE CONTENT ───────────────────────────────────────────────────────
async function generateContent() {
  state.error = "";
  state.loading = true;
  state.logLines = [];
  state.chapters = [];
  renderStep1Loading();

  const sys = `Kamu penulis ebook profesional Indonesia. Gaya: ${state.form.gaya}. Target: ${state.form.target}. Tujuan: ${state.form.tujuan}. Judul: "${state.structure.judul}". Tulis langsung tanpa preamble. Bahasa Indonesia natural dan mengalir.`;

  try {
    // Kata Pengantar
    addLog("Menulis Kata Pengantar...", true);
    const pengantar = await callAPI(sys,
      `Tulis Kata Pengantar ebook "${state.structure.judul}" untuk ${state.form.target}. Hook: "${state.structure.hook}". 250-350 kata. Gaya ${state.form.gaya}. Langsung isinya tanpa heading "Kata Pengantar".`
    );
    state.extras.pengantar = pengantar;
    addLog("✓ Kata Pengantar selesai");

    // Setiap Bab
    for (let i = 0; i < state.structure.bab.length; i++) {
      const bab = state.structure.bab[i];
      state.currentBab = i;
      updateBabProgress();
      updateLoadingSub(`Bab ${bab.nomor}/${state.structure.bab.length}: ${bab.judul}`);
      addLog(`Menulis Bab ${bab.nomor}: ${bab.judul}...`, true);

      const content = await callAPI(sys,
        `Tulis isi Bab ${bab.nomor}: "${bab.judul}". Deskripsi: ${bab.deskripsi}.
Format WAJIB (tulis langsung):
**Pembuka** – cerita/situasi nyata yang relatable (100-150 kata)
**Konsep Utama** – inti materi yang dijelaskan (200-250 kata)
**Contoh Nyata** – kasus konkret / ilustrasi praktis (150-200 kata)
**Strategi Praktis** – langkah-langkah actionable (150-200 kata)
**Takeaway** – 3-5 poin kunci dengan bullet (- poin)
Total minimal 600-750 kata. Bahasa ${state.form.gaya}.`
      );

      state.chapters.push({ ...bab, content });
      addLog(`✓ Bab ${bab.nomor} selesai (${content.length} karakter)`);
    }

    // Penutup
    state.currentBab = state.structure.bab.length;
    updateBabProgress();
    updateLoadingSub("Menulis Penutup...");
    addLog("Menulis Penutup...", true);
    const penutup = await callAPI(sys,
      `Tulis Penutup ebook "${state.structure.judul}". 200-280 kata. Rangkum perjalanan pembaca, berikan motivasi, dan call-to-action sesuai tujuan "${state.form.tujuan}". Langsung isinya tanpa heading.`
    );
    state.extras.penutup = penutup;
    addLog("✓ Penutup selesai");

    // Checklist Bonus
    updateLoadingSub("Membuat Checklist Bonus...");
    addLog("Membuat Checklist Bonus...", true);
    const checklist = await callAPI(sys,
      `Buat checklist 10-15 item aksi nyata untuk pembaca ebook "${state.structure.judul}". Format: - item. Kelompokkan dalam 2-3 kategori dengan heading. Langsung tulis daftarnya.`
    );
    state.extras.checklist = checklist;
    addLog("✓ Checklist selesai");

    state.currentBab = -1;
    addLog("🎉 Ebook selesai dibuat!");
    state.loading = false;
    state.step = 2;
    render();
  } catch (e) {
    state.error = e.message;
    state.loading = false;
    render();
  }
}

// ── EXPORT FUNCTIONS ───────────────────────────────────────────────────────
function textToHTML(raw) {
  if (!raw) return "";
  return raw.split("\n").map(line => {
    const t = line.trim();
    if (!t) return `<p style="margin:0 0 5pt">&nbsp;</p>`;
    if (t.startsWith("**") && t.endsWith("**")) {
      const h = t.replace(/\*\*/g, "");
      return `<h3 style="font-family:Georgia,serif;font-size:13pt;color:#2a1a08;margin:16pt 0 6pt;font-weight:bold">${h}</h3>`;
    }
    if (/^[-•✓]\s/.test(t)) {
      const b = t.replace(/^[-•✓]\s*/, "");
      return `<p style="margin:0 0 5pt;padding-left:18pt;font-family:Georgia,serif;font-size:11pt;color:#3a2a10;line-height:1.7">&#10003;&nbsp;&nbsp;${b}</p>`;
    }
    const inlined = t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    return `<p style="margin:0 0 7pt;font-family:Georgia,serif;font-size:11pt;color:#3a2a10;line-height:1.75;text-align:justify">${inlined}</p>`;
  }).join("\n");
}

function buildWordHTML() {
  const s = state.structure;
  const tocRows = s.bab.map(b => `
    <tr>
      <td style="padding:5pt 10pt;border-bottom:1px solid #e0d8c8;font-family:Georgia,serif;font-size:11pt;color:#8a7a60">Bab ${b.nomor}</td>
      <td style="padding:5pt 10pt;border-bottom:1px solid #e0d8c8;font-family:Georgia,serif;font-size:11pt;color:#3a2a10;font-style:italic">${b.judul}</td>
    </tr>`).join("");

  const chaptersHTML = state.chapters.map(c => `
<div style="page-break-before:always">
  <p style="font-family:Georgia,serif;font-size:9pt;color:#8a7a60;text-transform:uppercase;letter-spacing:2pt;margin:0 0 6pt">BAB ${c.nomor}</p>
  <h2 style="font-family:Georgia,serif;font-size:20pt;font-weight:bold;color:#1a1510;margin:0 0 8pt;line-height:1.2">${c.judul}</h2>
  <div style="width:50px;height:2px;background:#c9a84c;margin:0 0 18pt"></div>
  ${textToHTML(c.content)}
</div>`).join("\n");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${s.judul}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>
</xml><![endif]-->
<style>
  @page { size: A4; margin: 2.5cm 3cm; }
  body { font-family: Georgia, serif; font-size: 11pt; background: #fff; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- COVER -->
<div style="text-align:center;padding:80pt 40pt;background:#0f0a19;page-break-after:always">
  <p style="font-family:Georgia,serif;font-size:9pt;color:#8a6f30;letter-spacing:3pt;text-transform:uppercase;margin:0 0 16pt">Ebook Eksklusif &middot; ${state.form.tujuan}</p>
  <div style="width:60pt;height:2pt;background:#c9a84c;margin:0 auto 18pt"></div>
  <p style="font-family:Georgia,serif;font-size:28pt;font-weight:bold;color:#ffffff;line-height:1.2;margin:0 0 14pt">${s.judul}</p>
  <div style="width:40pt;height:2pt;background:#c9a84c;margin:0 auto 14pt"></div>
  <p style="font-family:Georgia,serif;font-size:13pt;color:#b4aa96;line-height:1.6;margin:0 0 28pt">${s.subtitle}</p>
  <p style="font-family:Georgia,serif;font-size:9pt;color:#5a5040">Untuk: ${state.form.target} &middot; Gaya: ${state.form.gaya}</p>
</div>

<!-- KATA PENGANTAR -->
<div style="page-break-after:always">
  <p style="font-family:Georgia,serif;font-size:9pt;color:#8a7a60;text-transform:uppercase;letter-spacing:2pt;margin:0 0 6pt">Pembuka</p>
  <h2 style="font-family:Georgia,serif;font-size:22pt;font-weight:bold;color:#1a1510;margin:0 0 8pt">Kata Pengantar</h2>
  <div style="width:50px;height:2px;background:#c9a84c;margin:0 0 18pt"></div>
  <p style="font-family:Georgia,serif;font-size:11pt;color:#3a2a10;line-height:1.85;font-style:italic;text-align:justify">${(state.extras.pengantar || "").replace(/\n/g, "<br>")}</p>
</div>

<!-- DAFTAR ISI -->
<div style="page-break-after:always">
  <p style="font-family:Georgia,serif;font-size:9pt;color:#8a7a60;text-transform:uppercase;letter-spacing:2pt;margin:0 0 6pt">Navigasi</p>
  <h2 style="font-family:Georgia,serif;font-size:22pt;font-weight:bold;color:#1a1510;margin:0 0 8pt">Daftar Isi</h2>
  <div style="width:50px;height:2px;background:#c9a84c;margin:0 0 18pt"></div>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:5pt 10pt;border-bottom:1px solid #e0d8c8;font-family:Georgia,serif;font-size:11pt;color:#8a7a60">Pembuka</td>
      <td style="padding:5pt 10pt;border-bottom:1px solid #e0d8c8;font-family:Georgia,serif;font-size:11pt;color:#3a2a10;font-style:italic">Kata Pengantar</td>
    </tr>
    ${tocRows}
    <tr>
      <td style="padding:5pt 10pt;border-bottom:1px solid #e0d8c8;font-family:Georgia,serif;font-size:11pt;color:#8a7a60">Penutup</td>
      <td style="padding:5pt 10pt;border-bottom:1px solid #e0d8c8;font-family:Georgia,serif;font-size:11pt;color:#3a2a10;font-style:italic">Kesimpulan &amp; Langkah Selanjutnya</td>
    </tr>
    <tr>
      <td style="padding:5pt 10pt;font-family:Georgia,serif;font-size:11pt;color:#8a7a60">Bonus</td>
      <td style="padding:5pt 10pt;font-family:Georgia,serif;font-size:11pt;color:#3a2a10;font-style:italic">Checklist Aksi Nyata</td>
    </tr>
  </table>
</div>

${chaptersHTML}

<!-- PENUTUP -->
<div style="page-break-before:always;page-break-after:always">
  <p style="font-family:Georgia,serif;font-size:9pt;color:#8a7a60;text-transform:uppercase;letter-spacing:2pt;margin:0 0 6pt">Penutup</p>
  <h2 style="font-family:Georgia,serif;font-size:22pt;font-weight:bold;color:#1a1510;margin:0 0 8pt">Kesimpulan &amp; Langkah Selanjutnya</h2>
  <div style="width:50px;height:2px;background:#c9a84c;margin:0 0 18pt"></div>
  ${textToHTML(state.extras.penutup)}
</div>

<!-- CHECKLIST BONUS -->
<div style="page-break-before:always">
  <div style="background:#c9a84c;padding:10pt 20pt;margin-bottom:20pt">
    <p style="font-family:Georgia,serif;font-size:11pt;font-weight:bold;color:#1a1510;margin:0">&#9670; BONUS CHECKLIST AKSI NYATA</p>
  </div>
  <h2 style="font-family:Georgia,serif;font-size:22pt;font-weight:bold;color:#1a1510;margin:0 0 8pt">Checklist Aksi Nyata</h2>
  <div style="width:50px;height:2px;background:#c9a84c;margin:0 0 18pt"></div>
  ${textToHTML(state.extras.checklist)}
</div>

</body>
</html>`;
}

function exportWord() {
  const html = buildWordHTML();
  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(state.structure?.judul || "ebook").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").slice(0, 50)}.doc`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function exportPrintPDF() {
  const html = buildWordHTML();
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup diblokir browser.\n\nCara fix:\n1. Klik ikon di address bar\n2. Izinkan popup\n3. Coba lagi");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 600);
}

function handleCopy() {
  const s = state.structure;
  let out = `${s.judul}\n${s.subtitle}\n\nKATA PENGANTAR\n\n${state.extras.pengantar}\n\nDAFTAR ISI\n`;
  s.bab.forEach(b => { out += `Bab ${b.nomor}: ${b.judul}\n`; });
  state.chapters.forEach(c => { out += `\n\nBAB ${c.nomor}: ${c.judul}\n${"─".repeat(40)}\n${c.content}`; });
  out += `\n\nPENUTUP\n${"─".repeat(40)}\n${state.extras.penutup}\n\nBONUS CHECKLIST\n${"─".repeat(40)}\n${state.extras.checklist}`;
  navigator.clipboard.writeText(out).catch(() => {});
  alert("✓ Teks ebook disalin!\nPaste ke Word / Google Docs.");
}

function resetAll() {
  state = {
    step: 0,
    form: { topik: "", target: "", tujuan: "Edukasi / Berbagi Ilmu", gaya: "Santai & Mengalir", panjang: "medium", konteks: "" },
    loading: false, logLines: [], structure: null,
    chapters: [], extras: { pengantar: "", penutup: "", checklist: "" },
    error: "", currentBab: -1,
  };
  render();
}

// ── RENDER HELPERS ─────────────────────────────────────────────────────────
function renderStep0Loading() {
  document.getElementById("app").innerHTML = `
    <div>
      <h1 class="section-title">Buat <span>Ebook</span> Kamu</h1>
      <p class="section-sub">Isi detail di bawah — AI akan menyusun struktur, menulis tiap bab, hingga bonus checklist.</p>
      ${renderFormHTML()}
      <div class="loading-card">
        <div class="spinner"></div>
        <div class="loading-title">Membangun Struktur Ebook...</div>
        <div class="loading-sub" id="loading-sub">AI sedang merancang judul, subtitle & daftar isi</div>
        <div class="progress-log" id="progress-log"></div>
      </div>
    </div>`;
  renderLog();
}

function renderStep1Loading() {
  const bab = state.structure?.bab || [];
  document.getElementById("app").innerHTML = `
    <div>
      <h1 class="section-title">Review <span>Struktur</span></h1>
      <p class="section-sub">Konten sedang ditulis...</p>
      <div class="loading-card">
        <div class="spinner"></div>
        <div class="loading-title">Menulis Konten Ebook...</div>
        <div class="loading-sub" id="loading-sub">Menyiapkan...</div>
        <div class="bab-progress" id="bab-progress">
          ${bab.map(b => `<div class="bab-chip">Bab ${b.nomor}</div>`).join("")}
        </div>
        <div class="progress-log" id="progress-log"></div>
      </div>
    </div>`;
  renderLog();
}

function renderFormHTML() {
  const f = state.form;
  return `
  <div class="form-grid">
    <div class="form-group full">
      <label>Topik Ebook *</label>
      <input id="f-topik" type="text" placeholder="Contoh: Cara Guru Buat Konten Edukasi di YouTube" value="${escHtml(f.topik)}" />
    </div>
    <div class="form-group">
      <label>Target Pembaca *</label>
      <input id="f-target" type="text" placeholder="Contoh: Guru SD-SMA, pemula konten" value="${escHtml(f.target)}" />
    </div>
    <div class="form-group">
      <label>Tujuan Ebook</label>
      <select id="f-tujuan">
        ${TUJUAN_OPTIONS.map(t => `<option value="${t}" ${f.tujuan === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="form-group full">
      <label>Gaya Bahasa</label>
      <div class="pill-group" id="gaya-pills">
        ${GAYA_OPTIONS.map(g => `<button class="pill ${f.gaya === g ? "selected" : ""}" data-gaya="${g}">${g}</button>`).join("")}
      </div>
    </div>
    <div class="form-group full">
      <label>Panjang Ebook</label>
      <div class="pill-group" id="panjang-pills">
        ${PANJANG_OPTIONS.map(p => `<button class="pill ${f.panjang === p.value ? "selected" : ""}" data-panjang="${p.value}">${p.label}</button>`).join("")}
      </div>
    </div>
    <div class="form-group full">
      <label>Konteks Tambahan (opsional)</label>
      <textarea id="f-konteks" placeholder="Contoh: Fokus ke guru di daerah 3T, belum familiar teknologi">${escHtml(f.konteks)}</textarea>
    </div>
  </div>`;
}

function escHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── MAIN RENDER ────────────────────────────────────────────────────────────
function render() {
  renderStepper();

  if (state.step === 0) renderStep0();
  else if (state.step === 1) renderStep1();
  else if (state.step === 2) renderStep2();
}

function renderStepper() {
  document.getElementById("stepper").innerHTML = STEPS.map((s, i) => `
    ${i > 0 ? `<div class="step-line"></div>` : ""}
    <div class="step-item">
      <div class="step-dot ${state.step === i ? "active" : state.step > i ? "done" : ""}">${state.step > i ? "✓" : i + 1}</div>
      <div class="step-label ${state.step === i ? "active" : ""}">${s}</div>
    </div>`).join("");
}

function renderStep0() {
  const canSubmit = state.form.topik.trim() && state.form.target.trim();
  document.getElementById("app").innerHTML = `
    <div>
      <h1 class="section-title">Buat <span>Ebook</span> Kamu</h1>
      <p class="section-sub">Isi detail di bawah — AI akan menyusun struktur, menulis tiap bab, hingga bonus checklist.</p>
      ${renderFormHTML()}
      ${state.error ? `<div class="error-box">⚠ ${state.error}</div>` : ""}
      <div class="btn-row">
        <button class="btn-primary" id="btn-generate" ${canSubmit ? "" : "disabled"}>✦ Generate Struktur Ebook</button>
      </div>
    </div>`;
  bindFormEvents();
}

function renderStep1() {
  const s = state.structure;
  const panjangInfo = PANJANG_OPTIONS.find(p => p.value === state.form.panjang);
  document.getElementById("app").innerHTML = `
    <div>
      <h1 class="section-title">Review <span>Struktur</span></h1>
      <p class="section-sub">Cek judul & daftar isi. Klik "Generate Konten" untuk mulai menulis semua bab.</p>
      <div class="structure-box">
        <div class="structure-header">
          <div>
            <div class="structure-title-text">${escHtml(s.judul)}</div>
            <div class="structure-subtitle-text">${escHtml(s.subtitle)}</div>
          </div>
          <div class="badge">${panjangInfo?.bab || s.bab.length} Bab</div>
        </div>
        <div class="structure-body">
          <div style="font-size:13px;color:var(--muted);margin-bottom:14px;font-style:italic">"${escHtml(s.hook)}"</div>
          ${s.bab.map(b => `
            <div class="toc-item">
              <div class="toc-num">0${b.nomor}</div>
              <div class="toc-text">${escHtml(b.judul)}<div class="toc-sub">${escHtml(b.deskripsi)}</div></div>
            </div>`).join("")}
        </div>
      </div>
      ${state.error ? `<div class="error-box">⚠ ${state.error}</div>` : ""}
      <div class="btn-row">
        <button class="btn-primary" id="btn-content">✦ Generate Semua Konten</button>
        <button class="btn-outline" id="btn-back">← Ubah Input</button>
      </div>
    </div>`;

  document.getElementById("btn-content").addEventListener("click", generateContent);
  document.getElementById("btn-back").addEventListener("click", () => { state.step = 0; render(); });
}

function renderStep2() {
  const s = state.structure;
  document.getElementById("app").innerHTML = `
    <div>
      <h1 class="section-title">Ebook <span>Selesai</span> ✦</h1>
      <p class="section-sub">Download sebagai file Word (.doc) — siap diedit & format ulang di MS Word.</p>

      <div class="export-bar">
        <div class="export-label"><strong>${state.chapters.length} bab</strong> · siap download</div>
        <button class="btn-outline" id="btn-copy" style="padding:8px 14px;font-size:12px">⎘ Salin Teks</button>
        <button class="btn-outline" id="btn-print" style="padding:8px 14px;font-size:12px">🖨 Print / PDF</button>
        <button class="btn-primary" id="btn-word" style="padding:10px 20px;font-size:13px">⬇ Download Word (.doc)</button>
        <button class="btn-outline" id="btn-new" style="padding:8px 14px;font-size:12px">+ Baru</button>
      </div>

      <div class="info-box">
        <strong class="gold">Cara export:</strong><br>
        📄 <strong class="white">Download Word</strong> → buka di MS Word → format sesuai selera → Save As PDF<br>
        🖨 <strong class="white">Print / PDF</strong> → tab baru terbuka → Ctrl+P / Cmd+P → pilih "Save as PDF"<br>
        ⎘ <strong class="white">Salin Teks</strong> → paste ke Word / Google Docs → format manual
      </div>

      <div class="ebook-preview">
        <div class="ebook-cover">
          <div class="ebook-cover-tag">Ebook Eksklusif · ${escHtml(state.form.tujuan)}</div>
          <div class="ebook-cover-title">${escHtml(s.judul)}</div>
          <div class="ebook-cover-divider"></div>
          <div class="ebook-cover-subtitle">${escHtml(s.subtitle)}</div>
          <div class="ebook-cover-meta">Untuk ${escHtml(state.form.target)} · Gaya: ${escHtml(state.form.gaya)}</div>
        </div>
        <div class="ebook-body">
          ${state.extras.pengantar ? `
          <div class="ebook-section">
            <span class="ebook-section-label">Pembuka</span>
            <div class="ebook-chapter-title">Kata Pengantar</div>
            <div class="ebook-intro">${escHtml(state.extras.pengantar)}</div>
          </div>` : ""}
          <div class="ebook-section">
            <span class="ebook-section-label">Navigasi</span>
            <div class="ebook-chapter-title">Daftar Isi</div>
            <ul class="toc-list">
              <li>Kata Pengantar <span>—</span></li>
              ${s.bab.map(b => `<li>Bab ${b.nomor} — ${escHtml(b.judul)} <span>${b.nomor}</span></li>`).join("")}
              <li>Penutup <span>—</span></li>
              <li>Bonus Checklist <span>—</span></li>
            </ul>
          </div>
          ${state.chapters.map(c => `
          <div class="ebook-section">
            <span class="ebook-section-label">Bab ${c.nomor}</span>
            <div class="ebook-chapter-title">${escHtml(c.judul)}</div>
            <div class="ebook-chapter-body">${escHtml(c.content)}</div>
          </div>`).join("")}
          ${state.extras.penutup ? `
          <div class="ebook-section">
            <span class="ebook-section-label">Penutup</span>
            <div class="ebook-chapter-title">Kesimpulan & Langkah Selanjutnya</div>
            <div class="ebook-chapter-body">${escHtml(state.extras.penutup)}</div>
          </div>` : ""}
          ${state.extras.checklist ? `
          <div class="ebook-section" style="background:#faf7f0">
            <span class="ebook-section-label">Bonus</span>
            <div class="ebook-chapter-title">Checklist Aksi Nyata</div>
            <div class="ebook-chapter-body">${escHtml(state.extras.checklist)}</div>
          </div>` : ""}
        </div>
      </div>
    </div>`;

  document.getElementById("btn-copy").addEventListener("click", handleCopy);
  document.getElementById("btn-print").addEventListener("click", exportPrintPDF);
  document.getElementById("btn-word").addEventListener("click", exportWord);
  document.getElementById("btn-new").addEventListener("click", resetAll);
}

// ── FORM EVENT BINDING ─────────────────────────────────────────────────────
function bindFormEvents() {
  const saveForm = () => {
    state.form.topik = document.getElementById("f-topik")?.value || "";
    state.form.target = document.getElementById("f-target")?.value || "";
    state.form.tujuan = document.getElementById("f-tujuan")?.value || state.form.tujuan;
    state.form.konteks = document.getElementById("f-konteks")?.value || "";
    // Update button state
    const btn = document.getElementById("btn-generate");
    if (btn) btn.disabled = !(state.form.topik.trim() && state.form.target.trim());
  };

  ["f-topik", "f-target", "f-tujuan", "f-konteks"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", saveForm);
    document.getElementById(id)?.addEventListener("change", saveForm);
  });

  document.querySelectorAll("[data-gaya]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.form.gaya = btn.dataset.gaya;
      document.querySelectorAll("[data-gaya]").forEach(b => b.classList.toggle("selected", b.dataset.gaya === state.form.gaya));
    });
  });

  document.querySelectorAll("[data-panjang]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.form.panjang = btn.dataset.panjang;
      document.querySelectorAll("[data-panjang]").forEach(b => b.classList.toggle("selected", b.dataset.panjang === state.form.panjang));
    });
  });

  document.getElementById("btn-generate")?.addEventListener("click", () => {
    saveForm();
    if (state.form.topik.trim() && state.form.target.trim()) generateStructure();
  });
}

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Wrap main in .app div for background gradient
  const main = document.querySelector("body");
  main.innerHTML = `<div class="app">${main.innerHTML}</div>`;
  render();
});
