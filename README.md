# ResikPay — website prototipe

Website statis (HTML, CSS, JavaScript murni) untuk presentasi ResikPay.

## Menjalankan
Buka `index.html` langsung di browser, atau jalankan server lokal:

    python3 -m http.server 8000
    # lalu buka http://localhost:8000

## Struktur
- `index.html` — struktur halaman (semantik, tanpa angka keuangan tertulis langsung)
- `css/style.css` — design system dan layout responsif
- `js/data.js` — **satu-satunya sumber angka** (unit economics, SAM, proyeksi, skenario)
- `js/app.js` — render, grafik SVG, dashboard demo, interaksi
- `assets/` — cadangan untuk aset lokal (ikon dan ilustrasi saat ini berupa SVG inline)

## Memperbarui angka
Nilai `null` di `js/data.js` berarti angka belum tersedia di materi yang dilampirkan
(EBITDA per tahun, kebutuhan pendanaan skenario dasar/tertekan, hasil pilot,
kriteria sensitivitas reward, rincian biaya variabel). Isi dengan angka dari proposal final;
seluruh halaman menyesuaikan otomatis. Panel "Catatan validasi data" bisa dimatikan lewat
`meta.showDataAudit = false` setelah semua angka terverifikasi.
