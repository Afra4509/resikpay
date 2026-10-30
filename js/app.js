/* ==========================================================================
   ResikPay — interaksi, render data, dan grafik (vanilla JS)
   Semua angka bisnis dibaca dari window.RESIKPAY_DATA (js/data.js).
   ========================================================================== */
(() => {
  "use strict";

  const D = window.RESIKPAY_DATA;
  if (!D) return;
  const UE = D.unitEconomics;
  const DEMO = D.demo;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------- Format ---------------- */
  const NF = {
    rp: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }),
    int: new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }),
    d1: new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    d2: new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  };
  const rp = (v) => NF.rp.format(Math.round(v));
  const rpJuta = (v) => "Rp " + NF.d1.format(v / 1e6) + " juta";
  const rpCompact = (v) => {
    const a = Math.abs(v);
    if (a >= 1e9) return "Rp " + NF.d1.format(v / 1e9) + " M";
    if (a >= 1e6) return rpJuta(v);
    if (a >= 1e4) return "Rp " + NF.int.format(v / 1e3) + " rb";
    return rp(v);
  };
  const pct = (v) => NF.int.format(Math.round(v * 100)) + "%";
  const kg = (v) => (v >= 10000 ? NF.d1.format(v / 1000) + " ton" : NF.d1.format(v) + " kg");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const SVG_NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

  const COLORS = {
    ink: "#0E1C15", forest: "#123D2B", emerald: "#1C8457", lime: "#A9CF45", limeBright: "#C8E86E",
    rest: "#4E7A63", red: "#A63C27", muted: "#55665B", line: "rgba(14,28,21,0.12)", paper2: "#EDEFE7",
    accepted: "#C8E86E"
  };
  const MATERIALS = [
    { id: "plastik", name: "Plastik", color: "#1C8457" },
    { id: "kertas", name: "Kertas", color: "#C79A33" },
    { id: "logam", name: "Logam", color: "#5D6E7C" },
    { id: "kaca", name: "Kaca", color: "#3B8EA5" }
  ];

  /* ==========================================================================
     1. Audit data — dijalankan sebelum UI dirender
     ========================================================================== */
  function auditData() {
    const issues = [];
    const passed = [];
    const close = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

    const rewardCalc = UE.pricePerKg * UE.householdRewardPct;
    (close(rewardCalc, UE.householdRewardPerKg) ? passed : issues).push({
      level: "validate",
      title: "Reward rumah tangga",
      text: `${pct(UE.householdRewardPct)} × ${rp(UE.pricePerKg)} = ${rp(rewardCalc)}; tertulis ${rp(UE.householdRewardPerKg)}.`
    });

    const rwCalc = UE.pricePerKg * UE.rwFundPct;
    (close(rwCalc, UE.rwFundPerKg) ? passed : issues).push({
      level: "validate",
      title: "Dana RW",
      text: `${pct(UE.rwFundPct)} × ${rp(UE.pricePerKg)} = ${rp(rwCalc)}; tertulis ${rp(UE.rwFundPerKg)}.`
    });

    const gap = UE.pricePerKg - UE.householdRewardPerKg - UE.rwFundPerKg - UE.contributionPerKg;
    if (gap !== 0 && !UE.otherVariableCostBreakdown) {
      issues.push({
        level: "validate",
        title: `Selisih ${rp(gap)}/kg belum dirinci`,
        text: `${rp(UE.pricePerKg)} − ${rp(UE.householdRewardPerKg)} − ${rp(UE.rwFundPerKg)} = ${rp(UE.pricePerKg - UE.householdRewardPerKg - UE.rwFundPerKg)}, sedangkan kontribusi setelah biaya variabel tertulis ${rp(UE.contributionPerKg)}. Rincian ${rp(gap)}/kg (misalnya biaya angkut atau pengumpulan) perlu diambil dari proposal. Diagram menandainya sebagai "belum dirinci".`
      });
    }

    const M = D.market;
    const implied = (M.samTonsPerYear * 1000) / M.samHouseholds / 12;
    if (!close(implied, M.statedKgPerHouseholdPerMonth, 0.05) && M.approvedKgPerHouseholdPerMonth == null) {
      issues.push({
        level: "validate",
        title: "Ketidaksesuaian aritmetika SAM",
        text: `${NF.int.format(M.samTonsPerYear)} ton ÷ ${NF.int.format(M.samHouseholds)} rumah tangga ÷ 12 bulan = ${NF.d2.format(implied)} kg/bulan, tidak sama dengan ${NF.d1.format(M.statedKgPerHouseholdPerMonth)} kg yang tertulis. Isi approvedKgPerHouseholdPerMonth setelah tim menyepakati angkanya.`
      });
    }

    const rs = D.rewardSensitivity;
    if (rs.pitchDeckCriterion == null || rs.proposalCriterion == null) {
      issues.push({ level: "pending", title: "Kriteria sensitivitas reward", text: "Kriteria validasi di pitch deck dan proposal belum tersedia untuk dibandingkan." });
    } else if (rs.pitchDeckCriterion !== rs.proposalCriterion) {
      issues.push({ level: "validate", title: "Kriteria sensitivitas reward berbeda", text: `Pitch deck: ${rs.pitchDeckCriterion}. Proposal: ${rs.proposalCriterion}.` });
    }

    if (D.financials.years.some((y) => y.ebitda == null)) {
      issues.push({ level: "pending", title: "Nilai EBITDA per tahun", text: "Proposal menyatakan EBITDA negatif di tiga tahun, tetapi nilainya belum tersedia di materi yang dilampirkan. Grafik menampilkan tanda negatif tanpa angka." });
    }
    const fs = D.fundingScenarios;
    if (fs.base.fundingNeed == null || fs.adverse.fundingNeed == null) {
      issues.push({ level: "pending", title: "Kebutuhan pendanaan skenario dasar dan tertekan", text: "Nilai belum tersedia. Kartu skenario menampilkan status menunggu data." });
    }
    if (Object.entries(D.measuredResults).filter(([k]) => k !== "status").every(([, v]) => v == null)) {
      issues.push({ level: "pending", title: "Hasil pilot atau data terukur", text: "Belum ada angka hasil lapangan. Website tidak menampilkan traksi, jumlah pengguna, atau dampak yang belum terukur." });
    }
    if (!D.contact) {
      issues.push({ level: "pending", title: "Kontak", text: "Email, telepon, dan media sosial tidak dicantumkan karena tidak ada di materi sumber." });
    }

    return { issues, passed, gap, impliedKg: implied };
  }

  const AUDIT = auditData();

  /* ==========================================================================
     2. Binding teks sederhana
     ========================================================================== */
  function bindText() {
    const map = {
      "ue.price": rp(UE.pricePerKg),
      "ue.rewardPct": pct(UE.householdRewardPct),
      "ue.rwPct": pct(UE.rwFundPct),
      "ue.rewardPerKg": rp(UE.householdRewardPerKg),
      "meta.year": String(D.meta.year)
    };
    $$("[data-bind]").forEach((el) => {
      const v = map[el.dataset.bind];
      if (v !== undefined) el.textContent = v;
    });
  }

  /* ==========================================================================
     3. Tooltip bersama
     ========================================================================== */
  const tip = $("#tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x - r.width / 2;
    let top = y - r.height - 14;
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    if (top < 8) top = y + 18;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function hideTip() { tip.hidden = true; }
  function tipForElement(el, html) {
    const r = el.getBoundingClientRect();
    showTip(html, r.left + r.width / 2, r.top);
  }
  function attachTip(el, htmlFn) {
    el.addEventListener("pointermove", (e) => showTip(htmlFn(), e.clientX, e.clientY));
    el.addEventListener("pointerleave", hideTip);
    el.addEventListener("focus", () => tipForElement(el, htmlFn()));
    el.addEventListener("blur", hideTip);
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ==========================================================================
     4. Navigasi
     ========================================================================== */
  function initNav() {
    const header = $("#siteHeader");
    const nav = $("#primaryNav");
    const toggle = $("#navToggle");
    const label = $(".sr-only", toggle);

    const onScroll = () => header.classList.toggle("is-solid", window.scrollY > 8 || document.body.classList.contains("nav-open"));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Tutup menu" : "Buka menu";
      $("use", toggle).setAttribute("href", open ? "#i-close" : "#i-menu");
      onScroll();
      if (open) { const first = $("a", nav); if (first) first.focus(); }
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("is-open") && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", (m) => { if (m.matches) setOpen(false); });

    // Penanda section aktif
    const links = $$("[data-nav]");
    const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + en.target.id ? "true" : "false"));
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach((s) => io.observe(s));
    }
  }

  /* ==========================================================================
     5. Reveal & counter
     ========================================================================== */
  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const vh = window.innerHeight;
    const items = $$(".reveal").filter((el) => el.getBoundingClientRect().top > vh * 0.9);
    items.forEach((el) => el.classList.add("is-armed"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.remove("is-armed"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }

  const COUNTERS = {
    "market.tons": { value: D.market.samTonsPerYear, format: (v) => NF.int.format(v) },
    "market.households": { value: D.market.samHouseholds, format: (v) => NF.int.format(v) }
  };
  function initCounters() {
    const els = $$("[data-counter]");
    els.forEach((el) => {
      const c = COUNTERS[el.dataset.counter];
      if (c) el.textContent = c.format(c.value);
    });
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const c = COUNTERS[en.target.dataset.counter];
        if (!c) return;
        const start = performance.now();
        const dur = 1100;
        const tick = (now) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          en.target.textContent = c.format(Math.round(c.value * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ==========================================================================
     6. Data demo (deterministik, dibuat di browser)
     ========================================================================== */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const DAYS = 168;
  const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  function buildSeries(role) {
    const seeds = { household: 41, rw: 77, admin: 913 };
    const r = mulberry32(seeds[role]);
    const out = [];
    const cday = DEMO.collectionDay;
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(TODAY);
      date.setDate(date.getDate() - i);
      const dow = date.getDay();
      const trend = 0.82 + 0.36 * (1 - i / DAYS);
      let total = 0;
      if (role === "household") {
        if (dow === cday && r() < 0.86) total = 2.2 + r() * 3.4;
        else if (dow === 3 && r() < 0.16) total = 0.8 + r() * 1.4;
      } else if (role === "rw") {
        total = dow === cday ? (68 + r() * 46) * trend : (r() < 0.45 ? (2 + r() * 8) * trend : 0);
      } else {
        const heavy = dow === 6 || dow === 3 || dow === 0;
        total = ((heavy ? 72 + r() * 52 : 0) + 14 + r() * 20) * trend;
      }
      const mats = {};
      let shareSum = 0;
      const raw = {};
      MATERIALS.forEach((m) => { raw[m.id] = DEMO.materialShares[m.id] * (0.75 + r() * 0.5); shareSum += raw[m.id]; });
      MATERIALS.forEach((m) => { mats[m.id] = total ? Math.round((total * raw[m.id]) / shareSum * 10) / 10 : 0; });
      const acceptRate = 0.9 + r() * 0.07;
      out.push({ date, dow, mats, acceptRate });
    }
    return out;
  }
  const SERIES = { household: buildSeries("household"), rw: buildSeries("rw"), admin: buildSeries("admin") };

  const dayKg = (d, filter) => MATERIALS.reduce((s, m) => s + (filter === "all" || filter === m.id ? d.mats[m.id] : 0), 0);
  const sumKg = (days, filter) => days.reduce((s, d) => s + dayKg(d, filter), 0);
  const sumAccepted = (days, filter) => days.reduce((s, d) => s + dayKg(d, filter) * d.acceptRate, 0);
  const dominantMaterial = (d) => MATERIALS.reduce((a, m) => (d.mats[m.id] > d.mats[a.id] ? m : a), MATERIALS[0]);

  const DATE_SHORT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
  const DATE_DOW = new Intl.DateTimeFormat("id-ID", { weekday: "short" });
  const DATE_LONG = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });

  /* ==========================================================================
     7. Grafik batang generik (SVG, responsif, tooltip)
     ========================================================================== */
  function niceMax(v) {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * exp;
  }

  /**
   * opts: { labels[], tips(i) => html, series:[{name,color,values[]}], axisFormat, valueFormat,
   *         showValues, barMax, padTop, ariaLabel(i) }
   */
  function renderBars(container, opts) {
    const W = Math.max(240, container.clientWidth);
    const H = Math.max(160, container.clientHeight);
    container.innerHTML = "";
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": opts.title || "Grafik" }, container);
    const padL = opts.padLeft ?? 48, padR = 8, padT = opts.padTop ?? 12, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    const n = opts.labels.length;
    const maxV = niceMax(Math.max(...opts.series.flatMap((s) => s.values), 0.0001));
    const y = (v) => padT + ih - (v / maxV) * ih;

    const axis = svg("g", { class: "axis" }, root);
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = (maxV / ticks) * t;
      const yy = y(v);
      svg("line", { x1: padL, x2: W - padR, y1: yy, y2: yy, stroke: COLORS.line, "stroke-dasharray": t === 0 ? null : "2 4" }, axis);
      const tx = svg("text", { x: padL - 8, y: yy + 4, "text-anchor": "end" }, axis);
      tx.textContent = opts.axisFormat(v);
    }

    const band = iw / n;
    const groupW = Math.min(band * 0.72, opts.barMax ?? 46);
    const sCount = opts.series.length;
    const barW = sCount > 1 ? (groupW - 2 * (sCount - 1)) / sCount : groupW;
    const maxLabels = Math.max(2, Math.floor(iw / 46));
    const every = Math.ceil(n / maxLabels);

    for (let i = 0; i < n; i++) {
      const gx = padL + band * i + (band - groupW) / 2;
      const g = svg("g", { class: "bar", tabindex: "0", role: "img", "aria-label": opts.ariaLabel ? opts.ariaLabel(i) : opts.labels[i] }, root);
      // target hover sepanjang kolom
      svg("rect", { x: padL + band * i, y: padT, width: band, height: ih, fill: "transparent" }, g);
      opts.series.forEach((s, si) => {
        const v = s.values[i];
        const h = Math.max(v > 0 ? 2 : 0, ih - (y(v) - padT));
        svg("rect", { x: gx + si * (barW + 2), y: padT + ih - h, width: barW, height: h, rx: Math.min(4, barW / 3), fill: s.color }, g);
        if (opts.showValues) {
          const tv = svg("text", { x: gx + si * (barW + 2) + barW / 2, y: padT + ih - h - 8, "text-anchor": "middle", class: "val" }, g);
          tv.textContent = opts.valueFormat(v);
        }
      });
      if (i % every === 0) {
        const lx = svg("text", { x: padL + band * i + band / 2, y: H - 6, "text-anchor": "middle", class: "xl" }, axis);
        lx.textContent = opts.labels[i];
      }
      attachTip(g, () => opts.tips(i));
    }
  }

  /* ==========================================================================
     8. Hero (pratinjau aplikasi, data demo)
     ========================================================================== */
  function renderHero() {
    const hh = SERIES.household;
    const last30 = hh.slice(-30);
    const kg30 = sumKg(last30, "all");
    $("#heroBalance").textContent = rp(kg30 * UE.householdRewardPerKg);
    $("#heroKg").textContent = kg(kg30);
    $("#heroRate").textContent = rp(UE.householdRewardPerKg) + "/kg";

    // 6 minggu terakhir
    const weeks = [];
    for (let w = 5; w >= 0; w--) weeks.push(hh.slice(DAYS - (w + 1) * 7, DAYS - w * 7));
    const vals = weeks.map((wk) => sumKg(wk, "all"));
    const el = $("#heroChart");
    const W = 360, H = 96;
    el.innerHTML = "";
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" }, el);
    const max = Math.max(...vals) * 1.15;
    const bw = W / vals.length;
    vals.forEach((v, i) => {
      const h = (v / max) * (H - 18);
      svg("rect", { x: i * bw + bw * 0.18, y: H - 16 - h, width: bw * 0.64, height: h, rx: 5, fill: i === vals.length - 1 ? COLORS.emerald : "#CFE2D5" }, root);
      const t = svg("text", { x: i * bw + bw / 2, y: H - 2, "text-anchor": "middle", "font-size": 10, fill: COLORS.muted, "font-family": "Geist Mono, monospace" }, root);
      t.textContent = i === vals.length - 1 ? "Minggu ini" : `M-${vals.length - 1 - i}`;
    });

    const deposits = hh.filter((d) => dayKg(d, "all") > 0).slice(-3).reverse();
    $("#heroDeposits").innerHTML = deposits.map((d) => {
      const k = dayKg(d, "all");
      const m = dominantMaterial(d);
      return `<li><span class="di">${icon("i-scale")}</span><p>${esc(DATE_SHORT.format(d.date))} · ${esc(m.name)} dominan<span>${kg(k)} ditimbang petugas</span></p><strong>+${rp(k * UE.householdRewardPerKg)}</strong></li>`;
    }).join("");

    // Ring alokasi per kg
    const ring = $("#heroRing");
    ring.innerHTML = "";
    const R = 26, C = 2 * Math.PI * R;
    svg("circle", { cx: 32, cy: 32, r: R, fill: "none", stroke: COLORS.paper2, "stroke-width": 8 }, ring);
    const segs = [
      { v: UE.householdRewardPct, c: COLORS.emerald },
      { v: UE.rwFundPct, c: COLORS.lime }
    ];
    let offset = 0;
    segs.forEach((s) => {
      svg("circle", {
        cx: 32, cy: 32, r: R, fill: "none", stroke: s.c, "stroke-width": 8,
        "stroke-dasharray": `${s.v * C} ${C}`, "stroke-dashoffset": -offset * C, transform: "rotate(-90 32 32)"
      }, ring);
      offset += s.v;
    });
    const t = svg("text", { x: 32, y: 36, "text-anchor": "middle", "font-size": 12, "font-weight": 600, fill: COLORS.ink, "font-family": "Geist Mono, monospace" }, ring);
    t.textContent = pct(UE.householdRewardPct);

    // Dana RW
    const rwKg30 = sumKg(SERIES.rw.slice(-30), "all");
    const fund = rwKg30 * UE.rwFundPerKg;
    $("#heroFund").textContent = rp(fund);
    $("#heroFundFoot").textContent = `${pct(Math.min(1, fund / DEMO.rwFundTarget))} dari target ${rp(DEMO.rwFundTarget)} · 30 hari`;
    requestAnimationFrame(() => { $("#heroFundBar").style.width = Math.min(100, (fund / DEMO.rwFundTarget) * 100) + "%"; });
  }

  /* ==========================================================================
     9. Cara kerja (tab berurutan)
     ========================================================================== */
  const FLOW = [
    { icon: "i-sort", title: "Rumah tangga memilah dan mengumpulkan sampah", body: "Warga memisahkan plastik, kertas, logam, dan kaca di rumah, lalu menyimpannya sampai jadwal pengumpulan di titik kumpul RW.", who: "Rumah tangga", data: "Belum ada pencatatan; sampah disimpan per jenis." },
    { icon: "i-scale", title: "Petugas mengumpulkan dan mencatat berat", body: "Petugas menimbang setoran setiap rumah tangga per jenis material dan mencatatnya ke akun rumah tangga tersebut.", who: "Petugas pengumpul", data: "Berat per jenis material, tanggal, akun rumah tangga." },
    { icon: "i-calc", title: "Sistem menghitung nilai material dan pembagian insentif", body: () => `Berat yang tercatat dikalikan harga jual material, lalu dibagi sesuai porsi: ${pct(UE.householdRewardPct)} untuk reward rumah tangga dan ${pct(UE.rwFundPct)} untuk dana lingkungan RW.`, who: "Platform ResikPay", data: () => `Nilai material (${rp(UE.pricePerKg)}/kg), porsi reward, porsi dana RW.` },
    { icon: "i-wallet", title: "Rumah tangga menerima reward sesuai aturan platform", body: "Reward dikreditkan ke saldo akun. Cara dan waktu pencairan mengikuti aturan platform, bukan transfer otomatis setiap kali menyetor.", who: "Platform ResikPay", data: "Saldo reward dan riwayat setoran per rumah tangga." },
    { icon: "i-fund", title: "Kontribusi lingkungan RW dicatat dan dilaporkan", body: "Setiap setoran menambah dana lingkungan RW. Pengurus dan warga bisa melihat rekap per RT dan per periode.", who: "Pengurus RW", data: "Dana masuk per transaksi, rekap per RT, laporan berkala." },
    { icon: "i-truck", title: "Material diteruskan kepada mitra pembeli", body: "Material yang terkumpul diangkut ke mitra pembeli. Berat yang diterima dan yang ditolak dicatat terpisah untuk perbaikan pemilahan.", who: "Platform dan mitra pembeli", data: "Berat diterima, berat ditolak, harga jual." }
  ];
  const val = (v) => (typeof v === "function" ? v() : v);

  function initFlow() {
    const track = $("#flowTabs");
    const panel = $("#flowPanel");
    track.innerHTML = FLOW.map((s, i) => `
      <button class="flow-step" type="button" role="tab" id="flow-tab-${i}" aria-controls="flowPanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-i="${i}">
        <span class="node">${icon(s.icon)}</span>
        <span class="num">Langkah ${String(i + 1).padStart(2, "0")}</span>
        <span class="title">${esc(s.title)}</span>
      </button>`).join("");
    const tabs = $$(".flow-step", track);

    const select = (i, focus) => {
      tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(j === i)); t.tabIndex = j === i ? 0 : -1; });
      if (focus) tabs[i].focus();
      const s = FLOW[i];
      panel.setAttribute("aria-labelledby", tabs[i].id);
      panel.innerHTML = `
        <div class="flow-progress" aria-hidden="true">${FLOW.map((_, j) => `<span class="${j <= i ? "on" : ""}"></span>`).join("")}</div>
        <p class="p-num">Langkah ${i + 1} dari ${FLOW.length}</p>
        <h3>${esc(s.title)}</h3>
        <p>${esc(val(s.body))}</p>
        <dl>
          <div><dt>Dijalankan oleh</dt><dd>${esc(s.who)}</dd></div>
          <div><dt>Data yang dicatat</dt><dd>${esc(val(s.data))}</dd></div>
        </dl>`;
    };
    track.addEventListener("click", (e) => {
      const b = e.target.closest(".flow-step");
      if (b) select(Number(b.dataset.i));
    });
    track.addEventListener("keydown", (e) => {
      const cur = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
      let next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (cur + 1) % tabs.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (cur - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = tabs.length - 1;
      if (next !== null) { e.preventDefault(); select(next, true); }
    });
    select(0);
  }

  /* ==========================================================================
     10. Dampak: SAM, simulasi, hasil terukur
     ========================================================================== */
  function renderImpact() {
    const M = D.market;
    const box = $("#marketValidate");
    const approved = M.approvedKgPerHouseholdPerMonth;
    if (approved != null) {
      box.innerHTML = `<p>Setara <strong>${NF.d1.format(approved)} kg</strong> sampah bernilai jual per rumah tangga per bulan.</p>`;
    } else {
      box.innerHTML = `
        <span class="tag tag-validate">Perlu validasi</span>
        <p>Proposal menulis setara <strong>${NF.d1.format(M.statedKgPerHouseholdPerMonth)} kg</strong> per rumah tangga per bulan. Jika dihitung ulang dari dua angka di atas, hasilnya <strong>${NF.d2.format(AUDIT.impliedKg)} kg</strong>. Angka turunan ini belum dipakai di website sampai tim menyepakati nilainya.</p>`;
    }

    // Simulasi
    const hhIn = $("#simHouseholds"), kgIn = $("#simKg");
    const update = () => {
      const h = Number(hhIn.value), k = Number(kgIn.value);
      $("#simHouseholdsOut").textContent = NF.int.format(h);
      $("#simKgOut").textContent = NF.d1.format(k) + " kg";
      const total = h * k;
      const value = total * UE.pricePerKg;
      $("#simTotalKg").textContent = kg(total) + " / bulan";
      const rows = [
        { name: "Nilai material", sub: `${rp(UE.pricePerKg)}/kg`, v: value, color: COLORS.forest },
        { name: "Reward rumah tangga", sub: `${pct(UE.householdRewardPct)} · ${rp(total * UE.householdRewardPerKg / h)} per rumah tangga`, v: total * UE.householdRewardPerKg, color: COLORS.emerald },
        { name: "Dana lingkungan RW", sub: `${pct(UE.rwFundPct)} dari nilai material`, v: total * UE.rwFundPerKg, color: COLORS.lime },
        { name: "Kontribusi setelah biaya variabel", sub: `${rp(UE.contributionPerKg)}/kg menurut model proposal`, v: total * UE.contributionPerKg, color: COLORS.rest }
      ];
      $("#simBars").innerHTML = rows.map((r) => `
        <li>
          <span class="ab-name">${esc(r.name)}<small>${esc(r.sub)}</small></span>
          <span class="ab-val">${rp(r.v)}<small>${rpCompact(r.v * 12)} / tahun</small></span>
          <span class="ab-track"><span class="ab-fill" style="width:${(r.v / value) * 100}%;background:${r.color}"></span></span>
        </li>`).join("");
      $("#simFoot").textContent = `Rumus: berat × tarif per kg dari proposal. Hasil tahunan = bulanan × 12, tanpa asumsi pertumbuhan atau perubahan harga.`;
    };
    hhIn.addEventListener("input", update);
    kgIn.addEventListener("input", update);
    update();

    // Hasil terukur
    const R = D.measuredResults;
    const rows = [
      { k: "collectedKg", name: "Volume sampah terkumpul", f: kg },
      { k: "acceptedKg", name: "Volume diterima pembeli", f: kg },
      { k: "activeHouseholds", name: "Rumah tangga aktif", f: (v) => NF.int.format(v) },
      { k: "rwFundDistributed", name: "Dana lingkungan RW", f: rp },
      { k: "rewardsDistributed", name: "Reward disalurkan", f: rp }
    ];
    const any = rows.some((r) => R[r.k] != null);
    const tag = $("#measuredTag");
    if (!any) {
      tag.className = "tag tag-pending";
      tag.textContent = "Menunggu data";
    } else {
      tag.className = "tag " + (R.status === "pilot" ? "tag-pilot" : "tag-source");
      tag.textContent = R.status === "pilot" ? "Hasil pilot" : "Terukur";
    }
    $("#measuredList").innerHTML = rows.map((r) => `
      <div><dt>${esc(r.name)}</dt><dd class="${R[r.k] != null ? "has-value" : ""}">${R[r.k] != null ? esc(r.f(R[r.k])) : "Belum ada data"}</dd></div>`).join("");
    $("#measuredFoot").textContent = any
      ? "Angka di atas bersumber dari pencatatan lapangan."
      : "Materi yang tersedia belum memuat hasil pilot. Bagian ini akan terisi otomatis setelah angka terukur dimasukkan ke data.js.";
  }

  /* ==========================================================================
     11. Unit economics: diagram alur (Sankey)
     ========================================================================== */
  const UE_STATE = { mult: 1, focus: null, pinned: null };

  function ueModel() {
    const price = UE.pricePerKg;
    const rest = price - UE.householdRewardPerKg - UE.rwFundPerKg;
    const gap = rest - UE.contributionPerKg;
    const items = [
      { key: "price", col: 0, v: price, color: COLORS.ink, name: "Harga jual material", desc: "Harga rata-rata yang dibayar mitra pembeli untuk setiap kilogram material.", tag: ["tag-source", "Sumber"] },
      { key: "reward", col: 1, parent: "price", v: UE.householdRewardPerKg, color: COLORS.emerald, name: "Reward rumah tangga", desc: `${pct(UE.householdRewardPct)} dari harga jual, dikreditkan ke saldo rumah tangga yang menyetor.`, tag: ["tag-source", "Sumber"] },
      { key: "rw", col: 1, parent: "price", v: UE.rwFundPerKg, color: COLORS.lime, name: "Dana lingkungan RW", desc: `${pct(UE.rwFundPct)} dari harga jual, masuk ke kas lingkungan RW asal setoran.`, tag: ["tag-source", "Sumber"] },
      { key: "rest", col: 1, parent: "price", v: rest, color: COLORS.rest, name: "Sisa untuk operasional", desc: "Hasil pengurangan harga jual dengan reward dan dana RW. Angka antara, dihitung dari tiga angka sumber.", tag: ["tag-sim", "Dihitung"] }
    ];
    if (gap > 0) items.push({ key: "gap", col: 2, parent: "rest", v: gap, color: COLORS.red, hatched: true, name: "Selisih belum dirinci", desc: "Sisa dikurangi kontribusi. Kemungkinan biaya variabel lain, tetapi rinciannya belum ada di materi sumber.", tag: ["tag-validate", "Perlu klarifikasi"] });
    items.push({ key: "contrib", col: 2, parent: "rest", v: UE.contributionPerKg, color: COLORS.forest, name: "Kontribusi setelah biaya variabel", desc: "Angka kontribusi per kg menurut model proposal, sebelum biaya tetap.", tag: ["tag-source", "Sumber"] });
    return items;
  }

  function renderSankey() {
    const host = $("#sankey");
    const width = host.clientWidth || 600;
    const vertical = width < 560;
    const items = ueModel();
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    const mult = UE_STATE.mult;

    const L = vertical ? 610 : 920;      // panjang arah alur
    const CW = vertical ? 340 : 380;     // lebar melintang
    const pad = vertical ? 10 : 28;
    const gapPx = 16;
    const node = 16;
    const cols = vertical ? [56, 300, 540] : [150, 450, 730];
    const k = (CW - 2 * pad - 2 * gapPx) / by.price.v;

    // Posisi melintang
    const pos = {};
    const total0 = by.price.v * k;
    pos.price = (CW - total0) / 2;
    const col1 = items.filter((i) => i.col === 1);
    let c = (CW - (col1.reduce((s, i) => s + i.v * k, 0) + gapPx * (col1.length - 1))) / 2;
    col1.forEach((i) => { pos[i.key] = c; c += i.v * k + gapPx; });
    const col2 = items.filter((i) => i.col === 2);
    const col2Total = col2.reduce((s, i) => s + i.v * k, 0) + gapPx * (col2.length - 1);
    let c2 = Math.min(CW - pad - col2Total, Math.max(pad, pos.rest + (by.rest.v * k) / 2 - col2Total / 2));
    col2.forEach((i) => { pos[i.key] = c2; c2 += i.v * k + gapPx; });

    const P = (a, b) => (vertical ? `${b},${a}` : `${a},${b}`);
    const rect = (a, b, la, lb) => (vertical ? { x: b, y: a, width: lb, height: la } : { x: a, y: b, width: la, height: lb });

    host.innerHTML = "";
    const root = svg("svg", { viewBox: vertical ? `0 0 ${CW} ${L}` : `0 0 ${L} ${CW}` }, host);
    const defs = svg("defs", {}, root);
    const pat = svg("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    svg("rect", { width: 6, height: 6, fill: "#F6E1DA" }, pat);
    svg("rect", { width: 2, height: 6, fill: COLORS.red }, pat);

    const ribbons = svg("g", {}, root);
    const nodes = svg("g", {}, root);
    const labels = svg("g", {}, root);
    const colAt = (i) => cols[i.col];

    // Pita
    const offsets = {};
    items.filter((i) => i.parent).forEach((i) => {
      const p = by[i.parent];
      offsets[p.key] = offsets[p.key] || 0;
      const a0 = colAt(p) + node, a1 = colAt(i);
      const s0 = pos[p.key] + offsets[p.key], s1 = s0 + i.v * k;
      const t0 = pos[i.key], t1 = t0 + i.v * k;
      offsets[p.key] += i.v * k;
      const am = (a0 + a1) / 2;
      const d = `M${P(a0, s0)} C${P(am, s0)} ${P(am, t0)} ${P(a1, t0)} L${P(a1, t1)} C${P(am, t1)} ${P(am, s1)} ${P(a0, s1)} Z`;
      const path = svg("path", { d, class: "ribbon", "data-key": i.key, fill: i.hatched ? "url(#hatch)" : i.color, "fill-opacity": i.hatched ? 0.55 : 0.22 }, ribbons);
      attachTip(path, () => ueTip(i));
      path.addEventListener("pointerenter", () => setUeFocus(i.key));
      path.addEventListener("pointerleave", () => setUeFocus(null));
    });

    // Node
    items.forEach((i) => {
      const r = rect(colAt(i), pos[i.key], node, Math.max(2, i.v * k));
      const n = svg("rect", { ...r, rx: 3, class: "node-rect", "data-key": i.key, fill: i.hatched ? "url(#hatch)" : i.color, stroke: i.hatched ? COLORS.red : "none" }, nodes);
      attachTip(n, () => ueTip(i));
      n.addEventListener("pointerenter", () => setUeFocus(i.key));
      n.addEventListener("pointerleave", () => setUeFocus(null));
    });

    // Label
    const unit = UE_STATE.mult === 1 ? "/kg" : UE_STATE.mult === 100 ? "/100 kg" : "/ton";
    const txt = (x, y, s, cls, anchor = "start") => { const t = svg("text", { x, y, class: cls, "text-anchor": anchor }, labels); t.textContent = s; return t; };
    items.forEach((i) => {
      const mid = pos[i.key] + (i.v * k) / 2;
      const value = rp(i.v * mult);
      if (!vertical) {
        if (i.key === "price") {
          txt(colAt(i) - 12, mid - 4, value, "sk-big", "end");
          txt(colAt(i) - 12, mid + 14, unit + " · harga jual", "sk-sub", "end");
        } else if (i.key === "rest") {
          txt(colAt(i) + node / 2, pos.rest + i.v * k + 18, `${value} · ${pct(i.v / by.price.v)} sisa`, "", "middle");
        } else {
          const short = { reward: "Reward rumah tangga", rw: "Dana RW", gap: "Belum dirinci", contrib: "Kontribusi" }[i.key];
          txt(colAt(i) + node + 10, mid - 2, `${value} · ${pct(i.v / by.price.v)}`, "");
          txt(colAt(i) + node + 10, mid + 14, short, "sk-sub");
        }
      } else {
        if (i.key === "price") {
          txt(CW / 2, colAt(i) - 22, value + " " + unit, "sk-big", "middle");
          txt(CW / 2, colAt(i) - 6, "harga jual", "sk-sub", "middle");
        } else if (i.key !== "rest") {
          // Label pendek agar node yang berdekatan tidak bertabrakan; nilai lengkap ada di daftar
          txt(mid, colAt(i) + node + 18, pct(i.v / by.price.v), "", "middle");
          const sub = { reward: "reward", rw: "RW", gap: "selisih", contrib: "kontribusi" }[i.key];
          txt(mid, colAt(i) + node + 34, sub, "sk-sub", "middle");
        }
      }
    });
    applyUeFocus();
  }

  function ueTip(i) {
    const unit = UE_STATE.mult === 1 ? "per kg" : UE_STATE.mult === 100 ? "per 100 kg" : "per ton";
    return `<strong>${esc(i.name)}</strong>${rp(i.v * UE_STATE.mult)} ${unit} · ${pct(i.v / UE.pricePerKg)} dari harga jual<br><span>${esc(i.desc)}</span>`;
  }

  function setUeFocus(key) { UE_STATE.focus = key; applyUeFocus(); }
  function applyUeFocus() {
    const key = UE_STATE.focus || UE_STATE.pinned;
    const host = $("#sankey");
    host.classList.toggle("is-focused", !!key);
    // Fokus pada "rest" juga menyorot cabang turunannya
    const related = key === "rest" ? ["rest", "gap", "contrib"] : key === "price" ? ["reward", "rw", "rest"] : [key];
    $$(".ribbon", host).forEach((p) => {
      const on = related.includes(p.dataset.key);
      p.classList.toggle("is-active", on);
      p.setAttribute("fill-opacity", on && p.getAttribute("fill") !== "url(#hatch)" ? 0.5 : p.getAttribute("fill") === "url(#hatch)" ? 0.55 : 0.22);
    });
    $$("#ueLedger li").forEach((li) => li.classList.toggle("is-active", li.dataset.key === key));
  }

  function renderLedger() {
    const items = ueModel();
    const unit = UE_STATE.mult === 1 ? "/kg" : UE_STATE.mult === 100 ? "/100 kg" : "/ton";
    $("#ueLedger").innerHTML = items.map((i) => `
      <li tabindex="0" data-key="${i.key}" aria-label="${esc(i.name)}: ${esc(rp(i.v * UE_STATE.mult))} ${unit}">
        <span class="sw${i.hatched ? " hatched" : ""}" style="${i.hatched ? "" : `background:${i.color}`}"></span>
        <span class="nm">${esc(i.name)}</span>
        <span class="vl">${rp(i.v * UE_STATE.mult)}<small>${unit} · ${pct(i.v / UE.pricePerKg)}</small></span>
        <span class="ds">${esc(i.desc)}</span>
        <span class="tag ${i.tag[0]}">${esc(i.tag[1])}</span>
      </li>`).join("");
    $$("#ueLedger li").forEach((li) => {
      li.addEventListener("pointerenter", () => setUeFocus(li.dataset.key));
      li.addEventListener("pointerleave", () => setUeFocus(null));
      li.addEventListener("focus", () => setUeFocus(li.dataset.key));
      li.addEventListener("blur", () => setUeFocus(null));
      li.addEventListener("click", () => { UE_STATE.pinned = UE_STATE.pinned === li.dataset.key ? null : li.dataset.key; applyUeFocus(); });
      li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); } });
    });
  }

  function initUnitEconomics() {
    const group = $("#ueUnits");
    radioGroup(group, (btn) => {
      UE_STATE.mult = Number(btn.dataset.mult);
      renderSankey();
      renderLedger();
    });
    renderLedger();
    renderSankey();
  }

  /* Radio group dengan panah keyboard */
  function radioGroup(group, onChange) {
    const btns = $$("button", group);
    const set = (b, focus) => {
      btns.forEach((x) => { x.setAttribute("aria-checked", String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      if (focus) b.focus();
      onChange(b);
    };
    btns.forEach((b) => { b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1; });
    group.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) set(b); });
    group.addEventListener("keydown", (e) => {
      const i = btns.findIndex((b) => b.getAttribute("aria-checked") === "true");
      let n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % btns.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + btns.length) % btns.length;
      if (n !== null) { e.preventDefault(); set(btns[n], true); }
    });
  }

  /* ==========================================================================
     12. Dashboard
     ========================================================================== */
  const DASH = { role: "household", range: 7, material: "all" };
  const ROLE_META = {
    household: { context: "Akun rumah tangga · RW 05, RT 03 (contoh)", heading: "Setoran dan reward saya" },
    rw: { context: "Pengurus RW 05 (contoh) · 120 rumah tangga terdaftar", heading: "Partisipasi dan dana lingkungan RW" },
    admin: { context: `Admin platform · ${DEMO.rwCount} RW aktif (contoh)`, heading: "Operasional dan penjualan material" }
  };

  function periodDays(series, range, back = 0) {
    const end = DAYS - back * range;
    return series.slice(end - range, end);
  }

  function chartData(days, range, filter, role) {
    let labels, full, groups;
    if (range === 84) {
      groups = [];
      for (let w = 0; w < 12; w++) groups.push(days.slice(w * 7, w * 7 + 7));
      labels = groups.map((g) => DATE_SHORT.format(g[0].date));
      full = groups.map((g) => `${DATE_SHORT.format(g[0].date)} – ${DATE_SHORT.format(g[g.length - 1].date)}`);
    } else {
      groups = days.map((d) => [d]);
      labels = days.map((d) => (range === 7 ? DATE_DOW.format(d.date) : String(d.date.getDate())));
      full = days.map((d) => DATE_LONG.format(d.date));
    }
    const collected = groups.map((g) => Math.round(sumKg(g, filter) * 10) / 10);
    const accepted = groups.map((g) => Math.round(sumAccepted(g, filter) * 10) / 10);
    return { labels, full, collected, accepted, role };
  }

  function renderDashboard() {
    const { role, range, material } = DASH;
    const series = SERIES[role];
    const cur = periodDays(series, range, 0);
    const prev = periodDays(series, range, 1);
    const kgNow = sumKg(cur, material);
    const kgPrev = sumKg(prev, material);
    const delta = kgPrev > 0 ? (kgNow - kgPrev) / kgPrev : 0;
    const accNow = sumAccepted(cur, material);
    const rangeLabel = range === 84 ? "12 minggu" : range + " hari";
    const matLabel = material === "all" ? "semua material" : MATERIALS.find((m) => m.id === material).name.toLowerCase();

    $("#dashContext").textContent = ROLE_META[role].context;
    $("#dashHeading").textContent = ROLE_META[role].heading;
    const main = $("#dashMain");
    main.setAttribute("aria-labelledby", "tab-" + role);

    const deltaHtml = `<span class="delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : "−"}${NF.int.format(Math.abs(delta * 100))}%</span> vs ${rangeLabel} sebelumnya`;
    let kpis;
    if (role === "household") {
      const count = cur.filter((d) => dayKg(d, material) > 0).length;
      kpis = [
        { l: "Total setoran", v: kg(kgNow), f: deltaHtml },
        { l: "Reward periode ini", v: rp(kgNow * UE.householdRewardPerKg), f: `${rp(UE.householdRewardPerKg)} per kg` },
        { l: "Kontribusi ke dana RW", v: rp(kgNow * UE.rwFundPerKg), f: `${rp(UE.rwFundPerKg)} per kg` },
        { l: "Jumlah setoran", v: NF.int.format(count) + "×", f: `dalam ${rangeLabel}` }
      ];
    } else if (role === "rw") {
      const cdays = cur.filter((d) => d.dow === DEMO.collectionDay);
      const avg = cdays.length ? sumKg(cdays, "all") / cdays.length : 0;
      const participants = Math.min(DEMO.householdsInRW, Math.round(avg / 1.15));
      kpis = [
        { l: "Total setoran RW", v: kg(kgNow), f: deltaHtml },
        { l: "Dana lingkungan masuk", v: rp(kgNow * UE.rwFundPerKg), f: `${pct(UE.rwFundPct)} dari nilai material` },
        { l: "Rumah tangga menyetor", v: `${NF.int.format(participants)}/${DEMO.householdsInRW}`, f: "rata-rata per hari pengumpulan" },
        { l: "Reward ke warga", v: rp(kgNow * UE.householdRewardPerKg), f: `${pct(UE.householdRewardPct)} dari nilai material` }
      ];
    } else {
      kpis = [
        { l: "Material terkumpul", v: kg(kgNow), f: deltaHtml },
        { l: "Diterima mitra pembeli", v: kg(accNow), f: `${pct(kgNow ? accNow / kgNow : 0)} dari yang terkumpul` },
        { l: "Nilai material diterima", v: rpCompact(accNow * UE.pricePerKg), f: `${rp(UE.pricePerKg)} per kg` },
        { l: "RW aktif", v: NF.int.format(DEMO.rwCount), f: "contoh untuk demo" }
      ];
    }
    $("#dashKpis").innerHTML = kpis.map((k) => `<div class="kpi"><p class="kpi-label">${esc(k.l)}</p><p class="kpi-value">${esc(k.v)}</p><p class="kpi-foot">${k.f}</p></div>`).join("");

    // Grafik
    const cd = chartData(cur, range, material, role);
    const isAdmin = role === "admin";
    $("#chartTitle").textContent = `${isAdmin ? "Terkumpul vs diterima" : "Setoran"} · ${matLabel}`;
    const series2 = [{ name: "Terkumpul", color: material === "all" ? COLORS.emerald : MATERIALS.find((m) => m.id === material).color, values: cd.collected }];
    if (isAdmin) series2.push({ name: "Diterima pembeli", color: COLORS.accepted, values: cd.accepted });
    $("#chartLegend").innerHTML = series2.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("") + `<span>${range === 84 ? "per minggu" : "per hari"}, kg</span>`;
    renderBars($("#dashChart"), {
      title: `Grafik setoran ${rangeLabel}, data demo`,
      labels: cd.labels,
      series: series2,
      padLeft: 44,
      axisFormat: (v) => NF.int.format(v),
      ariaLabel: (i) => `${cd.full[i]}: ${kg(cd.collected[i])}${isAdmin ? `, diterima ${kg(cd.accepted[i])}` : ""}`,
      tips: (i) => {
        const c = cd.collected[i];
        let h = `<strong>${esc(cd.full[i])}</strong>${kg(c)} ${isAdmin ? "terkumpul" : "disetor"}`;
        if (isAdmin) h += `<br>${kg(cd.accepted[i])} diterima pembeli`;
        if (role === "household") h += `<br><span>Reward ${rp(c * UE.householdRewardPerKg)}</span>`;
        if (role === "rw") h += `<br><span>Dana RW ${rp(c * UE.rwFundPerKg)}</span>`;
        if (isAdmin) h += `<br><span>Nilai ${rp(cd.accepted[i] * UE.pricePerKg)}</span>`;
        return h;
      }
    });

    // Kartu uang
    const allTimeKg = sumKg(series, material);
    if (role === "household") {
      $("#rewardCardTitle").textContent = "Saldo reward";
      $("#rewardCardValue").textContent = rp(allTimeKg * UE.householdRewardPerKg);
      $("#rewardCardSub").textContent = `Akumulasi ${kg(allTimeKg)} sejak ${DATE_SHORT.format(series[0].date)}. Pencairan mengikuti aturan platform.`;
    } else if (role === "rw") {
      $("#rewardCardTitle").textContent = "Reward diterima warga";
      $("#rewardCardValue").textContent = rp(kgNow * UE.householdRewardPerKg);
      $("#rewardCardSub").textContent = `Dalam ${rangeLabel}, dari ${kg(kgNow)} setoran.`;
    } else {
      $("#rewardCardTitle").textContent = "Reward rumah tangga";
      $("#rewardCardValue").textContent = rpCompact(kgNow * UE.householdRewardPerKg);
      $("#rewardCardSub").textContent = `Dalam ${rangeLabel} untuk ${DEMO.rwCount} RW, dihitung dari berat yang ditimbang.`;
    }
    const fundScope = role === "admin" ? SERIES.admin : SERIES.rw;
    const fund30 = sumKg(fundScope.slice(-30), material) * UE.rwFundPerKg;
    const target = DEMO.rwFundTarget * (role === "admin" ? DEMO.rwCount : 1);
    $("#fundCardTitle").textContent = role === "admin" ? `Dana lingkungan · ${DEMO.rwCount} RW` : "Dana lingkungan RW 05";
    $("#fundCardValue").textContent = rp(fund30);
    $("#fundCardBar").style.width = Math.min(100, (fund30 / target) * 100) + "%";
    const myShare = role === "household" ? ` Kontribusi Anda ${rp(sumKg(SERIES.household.slice(-30), material) * UE.rwFundPerKg)}.` : "";
    $("#fundCardSub").textContent = `30 hari terakhir, ${pct(Math.min(1, fund30 / target))} dari target contoh ${rpCompact(target)}.${myShare}`;

    renderActivity(role, cur, material, rangeLabel);
  }

  function renderActivity(role, cur, material, rangeLabel) {
    const head = $("#activityHead"), body = $("#activityBody");
    const matCell = (m) => `<span class="mat"><i style="background:${m.color}"></i>${esc(m.name)}</span>`;
    let rows = [];
    if (role === "household") {
      head.innerHTML = `<tr><th scope="col">Tanggal</th><th scope="col">Material dominan</th><th scope="col" class="num">Berat</th><th scope="col" class="num">Reward</th><th scope="col">Status</th></tr>`;
      const deps = cur.filter((d) => dayKg(d, material) > 0).slice(-6).reverse();
      rows = deps.map((d) => {
        const k = dayKg(d, material);
        const fresh = (TODAY - d.date) / 864e5 <= 2;
        const m = material === "all" ? dominantMaterial(d) : MATERIALS.find((x) => x.id === material);
        return `<tr><td>${esc(DATE_LONG.format(d.date))}</td><td>${matCell(m)}</td><td class="num">${kg(k)}</td><td class="num">${rp(k * UE.householdRewardPerKg)}</td><td><span class="status ${fresh ? "status-wait" : "status-ok"}">${fresh ? "Menunggu verifikasi" : "Masuk saldo"}</span></td></tr>`;
      });
      $("#activityTitle").textContent = "Riwayat setoran";
      $("#activityMeta").textContent = `${deps.length} setoran terakhir dalam ${rangeLabel}`;
    } else if (role === "rw") {
      head.innerHTML = `<tr><th scope="col">RT</th><th scope="col" class="num">Rumah tangga</th><th scope="col" class="num">Berat</th><th scope="col" class="num">Dana RW</th><th scope="col">Laporan</th></tr>`;
      const weights = [0.21, 0.18, 0.17, 0.16, 0.15, 0.13];
      const hh = [22, 20, 21, 19, 20, 18];
      const total = sumKg(cur, material);
      rows = weights.map((w, i) => {
        const k = total * w;
        const active = Math.min(hh[i], Math.round(hh[i] * (0.55 + w)));
        return `<tr><td>RT ${String(i + 1).padStart(2, "0")}</td><td class="num">${active}/${hh[i]}</td><td class="num">${kg(k)}</td><td class="num">${rp(k * UE.rwFundPerKg)}</td><td><span class="status status-ok">Tersedia</span></td></tr>`;
      });
      $("#activityTitle").textContent = "Rekap per RT";
      $("#activityMeta").textContent = `Periode ${rangeLabel} · contoh pembagian`;
    } else {
      head.innerHTML = `<tr><th scope="col">Tanggal angkut</th><th scope="col">Tujuan</th><th scope="col" class="num">Diterima</th><th scope="col" class="num">Ditolak</th><th scope="col" class="num">Nilai</th></tr>`;
      const trips = [];
      for (let i = cur.length - 1; i >= 0 && trips.length < 6; i--) {
        const d = cur[i];
        if ([0, 3, 6].includes(d.dow) && dayKg(d, material) > 0) trips.push(d);
      }
      rows = trips.map((d, i) => {
        const k = dayKg(d, material);
        const acc = k * d.acceptRate;
        return `<tr><td>${esc(DATE_LONG.format(d.date))}</td><td>Mitra pembeli ${i % 2 ? "B" : "A"} (contoh)</td><td class="num">${kg(acc)}</td><td class="num">${kg(k - acc)}</td><td class="num">${rp(acc * UE.pricePerKg)}</td></tr>`;
      });
      $("#activityTitle").textContent = "Pengiriman ke mitra pembeli";
      $("#activityMeta").textContent = `${trips.length} pengiriman terakhir dalam ${rangeLabel}`;
    }
    body.innerHTML = rows.length ? rows.join("") : `<tr class="empty-row"><td colspan="5">Belum ada aktivitas untuk filter ini dalam ${esc(rangeLabel)}.</td></tr>`;
  }

  function initDashboard() {
    // Peran (tablist)
    const tabs = $$("#roleSwitch button");
    const selectRole = (b, focus) => {
      tabs.forEach((t) => { t.setAttribute("aria-selected", String(t === b)); t.tabIndex = t === b ? 0 : -1; });
      if (focus) b.focus();
      DASH.role = b.dataset.role;
      renderDashboard();
    };
    $("#roleSwitch").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) selectRole(b); });
    $("#roleSwitch").addEventListener("keydown", (e) => {
      const i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
      let n = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % tabs.length;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      if (n !== null) { e.preventDefault(); selectRole(tabs[n], true); }
    });

    // Rentang waktu
    radioGroup($("#rangeSwitch"), (b) => { DASH.range = Number(b.dataset.range); renderDashboard(); });

    // Filter material
    const mf = $("#materialFilter");
    mf.innerHTML = [{ id: "all", name: "Semua", color: null }, ...MATERIALS].map((m) =>
      `<button type="button" data-mat="${m.id}" aria-pressed="${m.id === "all"}">${m.color ? `<i class="sw" style="background:${m.color}"></i>` : ""}${esc(m.name)}</button>`).join("");
    mf.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("button", mf).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      DASH.material = b.dataset.mat;
      renderDashboard();
    });

    renderDashboard();
  }

  /* ==========================================================================
     13. Program RW: peta alur & jadwal
     ========================================================================== */
  function renderRwMap() {
    const host = $("#rwMap");
    host.innerHTML = "";
    const W = 560, H = 400;
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}` }, host);
    // jalan
    svg("rect", { x: 0, y: 186, width: W, height: 28, fill: "#E4E9E1" }, root);
    svg("rect", { x: 266, y: 0, width: 28, height: H, fill: "#E4E9E1" }, root);
    svg("line", { x1: 0, y1: 200, x2: W, y2: 200, stroke: "#FCFCF8", "stroke-width": 2, "stroke-dasharray": "10 10" }, root);

    const point = { x: 280, y: 200 };
    const blocks = [
      { x: 40, y: 30 }, { x: 150, y: 30 }, { x: 330, y: 30 },
      { x: 40, y: 250 }, { x: 150, y: 250 }, { x: 330, y: 250 }
    ];
    const routes = svg("g", {}, root);
    blocks.forEach((b, i) => {
      const g = svg("g", {}, root);
      svg("rect", { x: b.x, y: b.y, width: 96, height: 118, rx: 10, fill: "#FCFCF8", stroke: "rgba(14,28,21,0.14)" }, g);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const hx = b.x + 14 + c * 38, hy = b.y + 22 + r * 44;
        const active = (i + r + c) % 4 !== 0;
        svg("path", { d: `M${hx} ${hy + 12} L${hx + 15} ${hy} L${hx + 30} ${hy + 12} V${hy + 30} H${hx} Z`, fill: active ? "#DCEEE2" : "#EDEFE7", stroke: active ? COLORS.emerald : "rgba(14,28,21,0.25)", "stroke-width": 1.4 }, g);
        svg("rect", { x: hx + 11, y: hy + 18, width: 8, height: 12, fill: active ? COLORS.emerald : "rgba(14,28,21,0.25)" }, g);
      }
      const t = svg("text", { x: b.x + 48, y: b.y + 112, "text-anchor": "middle" }, g);
      t.textContent = "RT " + String(i + 1).padStart(2, "0");
      const sx = b.x + 48, sy = b.y < 150 ? b.y + 118 : b.y;
      svg("path", { d: `M${sx} ${sy} Q${sx} ${point.y} ${point.x} ${point.y}`, fill: "none", stroke: COLORS.emerald, "stroke-width": 1.6, class: "route", opacity: 0.8 }, routes);
    });

    // titik kumpul
    svg("circle", { cx: point.x, cy: point.y, r: 26, fill: COLORS.forest }, root);
    svg("circle", { cx: point.x, cy: point.y, r: 34, fill: "none", stroke: COLORS.forest, "stroke-opacity": 0.25, "stroke-width": 6 }, root);
    const sc = svg("g", { transform: `translate(${point.x - 11} ${point.y - 11}) scale(0.92)`, fill: "none", stroke: COLORS.limeBright, "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" }, root);
    svg("rect", { x: 3, y: 11, width: 18, height: 10, rx: 2 }, sc);
    svg("path", { d: "M8 11a4 4 0 0 1 8 0" }, sc);

    // mitra pembeli
    const bx = 452, by = 170;
    svg("path", { d: `M${point.x + 34} ${point.y} H${bx}`, stroke: COLORS.ink, "stroke-width": 2, "stroke-dasharray": "4 5", fill: "none" }, root);
    svg("rect", { x: bx, y: by, width: 96, height: 60, rx: 10, fill: COLORS.ink }, root);
    const t1 = svg("text", { x: bx + 48, y: by + 26, "text-anchor": "middle", fill: COLORS.limeBright, style: "fill:#C8E86E" }, root);
    t1.textContent = "Mitra";
    const t2 = svg("text", { x: bx + 48, y: by + 42, "text-anchor": "middle", style: "fill:#C8E86E" }, root);
    t2.textContent = "pembeli";
    const tp = svg("text", { x: point.x, y: point.y + 52, "text-anchor": "middle", style: "fill:#0E1C15;font-weight:600" }, root);
    tp.textContent = "Titik kumpul RW";

    // legenda
    const lg = svg("g", { transform: "translate(452 260)" }, root);
    svg("rect", { x: 0, y: 0, width: 12, height: 12, rx: 2, fill: "#DCEEE2", stroke: COLORS.emerald }, lg);
    svg("text", { x: 18, y: 10 }, lg).textContent = "Aktif";
    svg("rect", { x: 0, y: 22, width: 12, height: 12, rx: 2, fill: "#EDEFE7", stroke: "rgba(14,28,21,0.25)" }, lg);
    svg("text", { x: 18, y: 32 }, lg).textContent = "Belum";

    // jadwal mingguan (Senin..Minggu)
    const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    const dowIdx = [1, 2, 3, 4, 5, 6, 0];
    $("#rwWeek").innerHTML = days.map((d, i) => {
      const on = dowIdx[i] === DEMO.collectionDay;
      return `<div class="${on ? "on" : ""}"><strong>${d}</strong>${on ? "Timbang" : "–"}</div>`;
    }).join("");
  }

  /* ==========================================================================
     14. Model bisnis
     ========================================================================== */
  function renderRevenue() {
    const yrs = D.financials.years;
    renderBars($("#revenueChart"), {
      title: "Proyeksi pendapatan tiga tahun",
      labels: yrs.map((y) => y.label),
      series: [{ name: "Pendapatan", color: COLORS.forest, values: yrs.map((y) => y.revenue) }],
      axisFormat: (v) => (v === 0 ? "0" : NF.int.format(v / 1e6) + " jt"),
      valueFormat: (v) => rpJuta(v),
      showValues: true,
      barMax: 120,
      padTop: 30,
      padLeft: 52,
      ariaLabel: (i) => `${yrs[i].label}: pendapatan proyeksi ${rpJuta(yrs[i].revenue)}`,
      tips: (i) => {
        const y = yrs[i];
        const prev = yrs[i - 1];
        const growth = prev ? `<br>${NF.d1.format(y.revenue / prev.revenue)}× dari ${esc(prev.label)}` : "";
        return `<strong>${esc(y.label)} · ${rpJuta(y.revenue)}</strong>Pendapatan proyeksi${growth}<br><span>Ini pendapatan, bukan laba. EBITDA diproyeksikan negatif.</span>`;
      }
    });

    const row = $("#ebitdaRow");
    row.innerHTML = `<span class="lbl">EBITDA</span>` + yrs.map((y) => {
      const known = y.ebitda != null;
      const tipText = known
        ? `${y.label}: EBITDA ${rp(y.ebitda)} (proyeksi).`
        : `${y.label}: proposal memproyeksikan EBITDA negatif. Nilainya belum dimasukkan ke data.js.`;
      return `<span class="ebitda-cell" tabindex="0" data-tip="${esc(tipText)}">${known ? esc(rpJuta(y.ebitda)) : "Negatif"}<small>${known ? "proyeksi" : "nilai menunggu data"}</small></span>`;
    }).join("") + `<p class="ebitda-note">Pendapatan tumbuh, tetapi biaya operasional masih lebih besar. Model ini belum menghasilkan laba di tiga tahun pertama.</p>`;
    $$(".ebitda-cell", row).forEach((c) => attachTip(c, () => esc(c.dataset.tip)));

    $("#streamList").innerHTML = D.revenueStreams.map((s) => `<li><h4>${esc(s.name)}</h4><p>${esc(s.detail)}</p></li>`).join("");

    const total = yrs.reduce((s, y) => s + y.revenue, 0);
    const growthRows = yrs.slice(1).map((y, i) => `<div class="growth-row"><span>${esc(yrs[i].label)} → ${esc(y.label)}</span><strong>${NF.d1.format(y.revenue / yrs[i].revenue)}×</strong></div>`).join("");
    $("#growthBox").innerHTML = `<span class="tag tag-proj">Proyeksi</span>${growthRows}<div class="growth-row"><span>Total pendapatan 3 tahun</span><strong>${rpJuta(total)}</strong></div>`;
  }

  /* ==========================================================================
     15. Risiko, skenario, audit
     ========================================================================== */
  function renderRisks() {
    $("#assumptionList").innerHTML = D.assumptions.map((a) => `<li><div><h3>${esc(a.name)}</h3><p>${esc(a.effect)}</p></div></li>`).join("");

    const fs = D.fundingScenarios;
    const card = (s, cls) => {
      const known = s.fundingNeed != null;
      return `<div class="scenario ${cls}">
        <span class="tag tag-proj">Proyeksi model</span>
        <h4>${esc(s.label)}</h4>
        <p class="sv ${known ? "" : "pending"}">${known ? esc(rpJuta(s.fundingNeed)) : "Menunggu angka proposal"}</p>
        <p>${s.runwayMonths != null ? `Runway ${NF.int.format(s.runwayMonths)} bulan.` : "Kebutuhan pendanaan dan runway akan ditampilkan persis seperti di proposal."}</p>
      </div>`;
    };
    $("#scenarioGrid").innerHTML = card(fs.base, "base") + card(fs.adverse, "adverse") +
      `<div class="scenario-ebitda"><strong>EBITDA negatif di Tahun 1–3.</strong> Skenario ini menggambarkan kebutuhan dana untuk menutup kekurangan tersebut, bukan hasil keuangan yang sudah terjadi atau dijamin.</div>`;

    const box = $("#auditBox");
    if (!D.meta.showDataAudit) { box.hidden = true; return; }
    const list = AUDIT.issues;
    $("#auditCount").textContent = list.length + " catatan";
    $("#auditList").innerHTML = list.map((i) => `<li><strong>${esc(i.title)}</strong><p>${esc(i.text)}</p></li>`).join("") +
      (AUDIT.passed.length ? `<li><strong>Lolos pengecekan</strong><p>${AUDIT.passed.map((p) => esc(p.text)).join(" ")}</p></li>` : "") +
      `<li><strong>Cara memperbarui</strong><p>Isi nilai <code>null</code> di <code>js/data.js</code> dengan angka dari proposal final. Semua bagian website akan menyesuaikan otomatis.</p></li>`;
  }

  /* ==========================================================================
     16. Footer
     ========================================================================== */
  function renderFooter() {
    const el = $("#footerContact");
    const c = D.contact;
    if (c) {
      el.innerHTML = `<h3>Kontak</h3>` + Object.values(c).map((v) => `<p>${esc(v)}</p>`).join("");
      return;
    }
    el.innerHTML = `<h3>Arti label data</h3>
      <p style="display:grid;gap:.45rem;justify-items:start">
        <span class="tag tag-source" style="background:rgba(200,232,110,.14);color:#C8E86E">Sumber</span>
        <span class="tag tag-proj" style="background:rgba(248,235,210,.12);color:#F2C98A">Proyeksi</span>
        <span class="tag tag-sim" style="background:rgba(221,235,241,.12);color:#A9D2E3">Simulasi</span>
        <span class="tag tag-demo" style="background:transparent;color:#A0B3A6;border-color:rgba(233,240,234,.3)">Data Demo</span>
      </p>`;
  }

  /* ==========================================================================
     17. Init & resize
     ========================================================================== */
  function onResize(fn) {
    let raf = 0, lastW = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastW) return; // abaikan perubahan tinggi (bilah alamat mobile)
      lastW = window.innerWidth;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fn);
    });
  }

  function init() {
    bindText();
    initNav();
    renderHero();
    initFlow();
    renderImpact();
    initUnitEconomics();
    initDashboard();
    renderRwMap();
    renderRevenue();
    renderRisks();
    renderFooter();
    initCounters();
    initReveal();
    onResize(() => { renderSankey(); renderDashboard(); renderRevenue(); });
    // Ulang render setelah font termuat agar ukuran grafik akurat
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { renderSankey(); renderDashboard(); renderRevenue(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
