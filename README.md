# 📚 EbookForge AI — Generator Ebook Premium

Generator ebook bertenaga Gemini AI. Deploy ke Vercel dalam 5 menit.

---

## 🗂 Struktur File

```
ebookforge-gemini/
├── api/
│   └── generate.js     ← Serverless function (API key aman di sini)
├── index.html           ← UI utama
├── app.js               ← Logic frontend
├── style.css            ← Styling
├── vercel.json          ← Konfigurasi Vercel
├── package.json         ← Dependencies
└── README.md
```

---

## 🚀 Cara Deploy ke Vercel

### Langkah 1 — Dapatkan Gemini API Key

1. Buka [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Klik **"Create API Key"**
3. Copy API key-nya (simpan, jangan dishare!)

---

### Langkah 2 — Upload ke GitHub

1. Buat repo baru di [github.com](https://github.com)
2. Upload semua file ini ke repo tersebut
   - Bisa drag & drop langsung di GitHub
   - Atau pakai Git:
     ```bash
     git init
     git add .
     git commit -m "Initial commit EbookForge AI"
     git remote add origin https://github.com/USERNAME/REPO.git
     git push -u origin main
     ```

---

### Langkah 3 — Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → Login dengan GitHub
2. Klik **"Add New Project"**
3. Pilih repo EbookForge yang baru dibuat
4. Klik **"Deploy"** (biarkan semua setting default)
5. Tunggu deploy selesai (~1 menit)

---

### Langkah 4 — Tambahkan API Key (PENTING!)

Setelah deploy berhasil:

1. Di dashboard Vercel → pilih project EbookForge
2. Klik tab **"Settings"**
3. Pilih **"Environment Variables"** di sidebar kiri
4. Klik **"Add New"**:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** paste API key Gemini kamu
   - **Environment:** centang Production, Preview, Development
5. Klik **"Save"**
6. Kembali ke tab **"Deployments"** → klik titik tiga → **"Redeploy"**

✅ Selesai! Aplikasi siap dipakai.

---

## 🔧 Development Lokal (opsional)

Kalau mau test di komputer sendiri sebelum deploy:

```bash
# Install Vercel CLI
npm install -g vercel

# Masuk ke folder project
cd ebookforge-gemini

# Buat file .env.local
echo "GEMINI_API_KEY=api_key_kamu_disini" > .env.local

# Jalankan dev server
vercel dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Konfigurasi

### Ganti Model Gemini

Edit file `api/generate.js` baris ini:

```js
// Gemini 2.0 Flash (default, gratis)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Gemini 1.5 Pro (lebih panjang context)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

// Gemini 2.5 Pro (paling canggih)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;
```

### Ganti Jumlah Bab

Edit file `app.js` konstanta `PANJANG_OPTIONS`:

```js
const PANJANG_OPTIONS = [
  { label: "Short (~20 hal)", value: "short", bab: 5 },   // ubah angka bab
  { label: "Medium (~40 hal)", value: "medium", bab: 8 },
  { label: "Long (~70 hal)", value: "long", bab: 12 },
];
```

---

## 📋 Fitur

- ✅ Generate struktur ebook (judul, subtitle, daftar isi)
- ✅ Generate konten tiap bab (600-750 kata/bab)
- ✅ Kata Pengantar + Penutup + Bonus Checklist
- ✅ Download sebagai Word (.doc) — siap diedit di MS Word
- ✅ Print / Save as PDF langsung dari browser
- ✅ Salin semua teks ke clipboard
- ✅ Pilihan gaya bahasa (Santai / Formal / Storytelling / dll.)
- ✅ Pilihan panjang ebook (Short / Medium / Long)
- ✅ API key aman (tidak terekspos ke frontend)

---

## 🔒 Keamanan

API key Gemini **tidak pernah terekspos ke browser/frontend**. Semua request ke Gemini dilakukan melalui serverless function `api/generate.js` yang berjalan di server Vercel.

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "GEMINI_API_KEY tidak ditemukan" | Cek environment variable di Vercel, lalu Redeploy |
| "API error 429" | Kamu kena rate limit Gemini. Tunggu beberapa menit |
| "API error 400" | API key salah atau tidak valid |
| Halaman kosong setelah deploy | Pastikan `vercel.json` sudah ada di repo |
| Popup diblokir saat Print PDF | Izinkan popup di browser untuk domain Vercel kamu |
