/* ==========================================================================
   ResikPay — sumber data terpusat
   --------------------------------------------------------------------------
   Semua angka bisnis dan keuangan di website diambil dari objek ini.
   Jangan menulis angka keuangan langsung di HTML.

   Status setiap angka:
     source     → tertulis di proposal / pitch deck ResikPay
     projection → proyeksi rencana bisnis (bukan hasil aktual)
     pilot      → hasil uji coba lapangan
     demo       → data contoh untuk prototipe antarmuka
     pending    → belum tersedia di materi yang dilampirkan; isi dari proposal

   Nilai `null` berarti angka belum tersedia. Website akan menampilkan label
   "Menunggu data" alih-alih mengarang angka. Setelah proposal dan pitch deck
   final dilampirkan, cukup isi nilai null di bawah ini.
   ========================================================================== */

window.RESIKPAY_DATA = {
  meta: {
    brand: "ResikPay",
    currency: "IDR",
    locale: "id-ID",
    year: 2026,
    // Tampilkan panel "Catatan validasi data" di bagian Risiko.
    // Matikan (false) setelah semua angka sudah diverifikasi dengan proposal final.
    showDataAudit: false
  },

  /* ---------- Unit economics per kg (sumber: proposal Tabel 4) ---------- */
  unitEconomics: {
    status: "source",
    pricePerKg: 2300,             // Harga jual material rata-rata
    householdRewardPct: 0.35,     // Reward rumah tangga (35%)
    householdRewardPerKg: 805,
    rwFundPct: 0.08,              // Dana lingkungan RW (8%)
    rwFundPerKg: 184,
    logisticsPerKg: 158,          // Angkutan (Rp150/kg terkumpul = Rp158/kg diterima)
    platformTaxPerKg: 275,        // Biaya variabel platform & alokasi pajak omzet
    contributionPerKg: 878,       // Kontribusi setelah biaya variabel (sebelum biaya tetap)
    // Rincian lengkap biaya variabel sesuai Tabel 4 proposal
    otherVariableCostBreakdown: { angkutan: 158, platformDanPajak: 275, kontribusi: 878 }
  },

  /* ---------- Ukuran pasar (sumber: proposal) ---------- */
  market: {
    status: "source",
    samTonsPerYear: 101000,
    samHouseholds: 860000,
    statedKgPerHouseholdPerMonth: 9.6,
    // Nilai yang sudah direkonsiliasi tim.
    approvedKgPerHouseholdPerMonth: 9.6
  },

  /* ---------- Proyeksi keuangan 3 tahun (sumber: proposal) ---------- */
  financials: {
    status: "projection",
    years: [
      { label: "Tahun 1", revenue: 15500000,  ebitda: -33800000, operatingCost: 41600000 },
      { label: "Tahun 2", revenue: 67900000,  ebitda: -22700000, operatingCost: 61200000 },
      { label: "Tahun 3", revenue: 143000000, ebitda: -15500000, operatingCost: 96200000 }
    ],
    // Proposal memproyeksikan EBITDA negatif di ketiga tahun.
    ebitdaSign: "negative"
  },

  /* ---------- Revenue stream yang disebut di materi ---------- */
  revenueStreams: [
    {
      id: "material",
      name: "Margin penjualan material",
      detail: "Selisih harga jual material ke mitra pembeli setelah reward rumah tangga dan dana RW, mengikuti unit economics per kg."
    },
    {
      id: "institutional",
      name: "Layanan institusional",
      detail: "Pendapatan dari layanan kepada lembaga. Proposal mencatat risiko keterlambatan realisasinya; nilai per stream belum dirinci di materi ini."
    }
  ],

  /* ---------- Skenario kebutuhan pendanaan (sumber: proposal) ---------- */
  fundingScenarios: {
    status: "projection",
    base:    { label: "Skenario dasar",  fundingNeed: 130000000, runwayMonths: 36 },
    adverse: { label: "Skenario tertekan", fundingNeed: 157000000, runwayMonths: 48 }
  },

  /* ---------- Asumsi kunci yang memengaruhi model ---------- */
  assumptions: [
    { id: "participation", name: "Partisipasi rumah tangga", effect: "Menentukan volume setoran dan kecepatan adopsi di tiap RW." },
    { id: "volume",        name: "Volume sampah terkumpul",  effect: "Seluruh pendapatan material, reward, dan dana RW dihitung per kg." },
    { id: "price",         name: "Harga jual material",      effect: "Reward 35% dan dana RW 8% mengikuti harga; penurunan harga mengecilkan semua alokasi." },
    { id: "logistics",     name: "Biaya pengumpulan dan angkut", effect: "Memengaruhi kontribusi per kg setelah biaya variabel." },
    { id: "institutional", name: "Waktu realisasi pendapatan layanan institusional", effect: "Keterlambatan menekan arus kas di tahun-tahun awal." }
  ],

  /* ---------- Kriteria validasi sensitivitas reward ---------- */
  rewardSensitivity: {
    pitchDeckCriterion: "Median hadiah minimum ≤ Rp4.000/bulan",
    proposalCriterion: "Median hadiah minimum ≤ Rp4.000/bulan"
  },

  /* ---------- Hasil terukur / pilot ---------- */
  measuredResults: {
    status: "projection",
    collectedKg: 91000,
    acceptedKg: 87000,
    activeHouseholds: 1518,
    activeRW: 20,
    rwFundDistributed: 16000000,
    rewardsDistributed: 70000000
  },

  /* ---------- Kontak: dari header proposal ---------- */
  contact: { team: "Tim Skem Hunter", institution: "Institut Teknologi Sepuluh Nopember", city: "Surabaya, Indonesia", competition: "YED UI 2026 · Babak Semifinal" },

  /* ---------- Parameter data demo (prototipe antarmuka) ---------- */
  demo: {
    status: "demo",
    rwCount: 5,
    householdsInRW: 120,
    rtCount: 6,
    materialShares: { plastik: 0.44, kertas: 0.34, logam: 0.13, kaca: 0.09 },
    rwFundTarget: 300000, // target contoh kas lingkungan per RW per 30 hari
    collectionDay: 6 // 0 = Minggu ... 6 = Sabtu
  }
};
