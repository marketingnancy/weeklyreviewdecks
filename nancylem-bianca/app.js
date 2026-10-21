/* LEM Weekly Review — slide engine + present mode. */
(function () {
  const stage = document.getElementById("stage");
  const viewport = document.getElementById("viewport");
  const progress = document.getElementById("progress");
  const counter = document.getElementById("counter");
  const overview = document.getElementById("overview");
  const banner = document.getElementById("banner");
  const updated = document.getElementById("updated");

  const state = { deck: null, i: 0 };

  function slideCount() { return state.deck ? state.deck.slides.length : 0; }

  // ── static + scrambled-data support (published build) ───────────────────────
  // Pure-JS scramble (NO Web Crypto / crypto.subtle), so it works in locked-down
  // browsers where Web Crypto is unavailable. The build (web/lock.js) uses the
  // identical cyrb53 + mulberry32 keystream. This is obfuscation, not strong crypto.
  function _cyrb53(str, seed){ let h1=0xdeadbeef^seed, h2=0x41c6ce57^seed;
    for(let i=0;i<str.length;i++){ const ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
    h1=Math.imul(h1^(h1>>>16),2246822507); h1^=Math.imul(h2^(h2>>>13),3266489909);
    h2=Math.imul(h2^(h2>>>16),2246822507); h2^=Math.imul(h1^(h1>>>13),3266489909);
    return 4294967296*(2097151&h2)+(h1>>>0); }
  function _mb32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function _xorDec(b64, pw, salt){
    const bin=atob(b64), bytes=new Uint8Array(bin.length);
    const seed=((_cyrb53(salt+":"+pw,1)>>>0) ^ (_cyrb53(pw+":"+salt,2)>>>0))>>>0;
    const r=_mb32(seed);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i) ^ (Math.floor(r()*256));
    return new TextDecoder().decode(bytes);
  }
  const _v = () => (window.__V__ ? "?v=" + window.__V__ : "");
  async function fetchDeck(){
    if(window.__STATIC__){ const t=await (await fetch("data/deck.json"+_v())).text();
      return window.__ENC__ ? JSON.parse(_xorDec(t, window.__PW__, window.__SALT__)) : JSON.parse(t); }
    return (await fetch("/api/deck.json")).json();
  }
  async function showLogin(){
    let cfg; try{ cfg=await (await fetch("data/enc.json"+_v())).json(); }
    catch(e){ stage.innerHTML='<div class="loading">Could not load sign-in (data/enc.json). Check your connection.</div>'; return; }
    const ov=document.createElement("div"); ov.className="login-ov";
    ov.innerHTML=`<form class="login-card" id="lform">
      <div class="login-brand">LEM</div><div class="login-sub">Weekly Review · sign in</div>
      <input id="luser" placeholder="Username" autocomplete="username" autocapitalize="off" autofocus>
      <input id="lpass" type="password" placeholder="Password" autocomplete="current-password">
      <button type="submit">Enter</button><div class="login-err" id="lerr"></div></form>`;
    document.body.appendChild(ov);
    ov.querySelector("#lform").onsubmit=e=>{
      e.preventDefault(); const err=ov.querySelector("#lerr"), btn=ov.querySelector("button"); err.textContent="";
      const user=ov.querySelector("#luser").value.trim(), pw=ov.querySelector("#lpass").value;
      btn.disabled=true; btn.textContent="Checking…";
      try{
        if(cfg.user && user.toLowerCase()!==String(cfg.user).toLowerCase()) throw 0;
        if(_xorDec(cfg.check, pw, cfg.salt)!=="OK") throw 0;
        window.__PW__=pw; window.__SALT__=cfg.salt;
        ov.remove(); boot();
      }catch(_){ window.__PW__=null; err.textContent="Wrong username or password."; btn.disabled=false; btn.textContent="Enter"; }
    };
  }

  function fitScale() {
    const pad = 24;
    const aw = viewport.clientWidth - pad, ah = viewport.clientHeight - pad;
    const s = Math.min(aw / 1280, ah / 720);
    stage.style.transform = `scale(${s})`;
  }

  function relTime(iso) {
    if (!iso) return "";
    const t = Date.parse(iso); if (isNaN(t)) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.round(m / 60); if (h < 24) return h + "h ago";
    return Math.round(h / 24) + "d ago";
  }

  function render() {
    const deck = state.deck; if (!deck) return;
    const slide = deck.slides[state.i];
    const el = document.createElement("div");
    el.className = "slide enter" + (LEMSlides.isDark(slide) ? " dark" : "");
    el.innerHTML = LEMSlides.render(slide, deck.meta, state.i, slideCount());
    stage.innerHTML = "";
    stage.appendChild(el);
    LEMSlides.mount(slide);
    // progress dots
    progress.innerHTML = deck.slides.map((_, j) => `<span class="pdot${j <= state.i ? " on" : ""}"></span>`).join("");
    counter.textContent = `${state.i + 1} / ${slideCount()}`;
    document.getElementById("prev").disabled = state.i === 0;
    document.getElementById("next").disabled = state.i === slideCount() - 1;
    fitScale();
  }

  function go(i) {
    state.i = Math.max(0, Math.min(slideCount() - 1, i));
    location.hash = "/" + (state.i + 1);
    render();
  }
  function next() { go(state.i + 1); }
  function prev() { go(state.i - 1); }

  // overview
  function buildOverview() {
    const meta = state.deck.meta, total = slideCount();
    overview.innerHTML = state.deck.slides.map((s, j) => {
      const lbl = (s.title || s.bucket_label || s.funnel_label || s.section || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return `<div class="ov-card" data-i="${j}">
        <div class="ov-thumb"><div class="slide ${LEMSlides.isDark(s) ? "dark" : ""}">${LEMSlides.render(s, meta, j, total)}</div></div>
        <div class="ov-cap"><span class="ov-num">${j + 1}</span>${lbl}</div>
      </div>`;
    }).join("");
    // scale each mini-slide to fit its thumbnail width (real Canva-style previews)
    overview.querySelectorAll(".ov-thumb").forEach(th => {
      const el = th.querySelector(".slide");
      el.style.transform = `scale(${th.clientWidth / 1280})`;
    });
    overview.querySelectorAll(".ov-card").forEach(c =>
      c.addEventListener("click", () => { toggleOverview(false); go(+c.dataset.i); }));
  }
  function toggleOverview(force) {
    const show = force == null ? overview.hidden : force;
    if (show) { overview.hidden = false; buildOverview(); }   // visible first so thumbs can measure width
    else overview.hidden = true;
  }

  // refresh
  let polling = null;
  async function refresh() {
    if (window.__STATIC__) return;   // published snapshot is read-only
    const btn = document.getElementById("btn-refresh");
    btn.disabled = true; btn.textContent = "Refreshing…";
    try {
      await fetch("/api/refresh", { method: "POST" });
      polling = setInterval(checkStatus, 3000);
    } catch (e) { btn.disabled = false; btn.textContent = "Refresh"; }
  }
  async function checkStatus() {
    try {
      const r = await (await fetch("/api/refresh/status")).json();
      if (r.state === "done") { clearInterval(polling); polling = null; await load(); resetBtn(); }
      else if (r.state === "error") {
        clearInterval(polling); polling = null; resetBtn();
        showBanner("Refresh failed — showing last snapshot. " + (r.error || "Check Glued cookies in .env."));
      }
    } catch (e) { /* keep polling */ }
  }
  function resetBtn() { const b = document.getElementById("btn-refresh"); b.disabled = false; b.textContent = "Refresh"; }
  function showBanner(msg) {
    banner.innerHTML = msg + `<button id="bdismiss">Dismiss</button>`;
    banner.hidden = false;
    document.getElementById("bdismiss").onclick = () => banner.hidden = true;
  }

  async function load() {
    const deck = await fetchDeck();
    state.deck = deck;
    if (deck.meta && deck.meta.links) {
      document.getElementById("lnk-glued").href = deck.meta.links.glued || "#";
      document.getElementById("lnk-shop").href = deck.meta.links.shopify_sales || "#";
    }
    updated.textContent = deck.meta && deck.meta.last_refresh_utc ? "Updated " + relTime(deck.meta.last_refresh_utc) : "";
    if (window.__STATIC__) document.getElementById("btn-refresh").style.display = "none";  // no server to refresh against
    render();
  }

  // events
  document.getElementById("next").addEventListener("click", next);
  document.getElementById("prev").addEventListener("click", prev);
  document.getElementById("btn-refresh").addEventListener("click", refresh);
  document.getElementById("btn-overview").addEventListener("click", () => toggleOverview());
  window.addEventListener("resize", fitScale);
  window.addEventListener("keydown", e => {
    // don't hijack typing in the sign-in form (or any input)
    const t = e.target;
    if ((t && t.matches && t.matches("input, textarea, select")) || document.querySelector(".login-ov")) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slideCount() - 1);
    else if (e.key === "o" || e.key === "O") toggleOverview();
    else if (e.key === "r" || e.key === "R") refresh();
    else if (e.key === "Escape") toggleOverview(false);
  });
  // touch swipe
  let tx = 0;
  viewport.addEventListener("touchstart", e => tx = e.touches[0].clientX, { passive: true });
  viewport.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
  }, { passive: true });
  window.addEventListener("hashchange", () => {
    const n = parseInt((location.hash.match(/\/(\d+)/) || [])[1], 10);
    if (n && n - 1 !== state.i) go(n - 1);
  });

  // boot
  function boot() {
    const startN = parseInt((location.hash.match(/\/(\d+)/) || [])[1], 10);
    if (startN) state.i = startN - 1;
    load().catch(() => { stage.innerHTML = '<div class="loading">Failed to load deck.</div>'; });
  }
  if (window.__ENC__) showLogin(); else boot();
})();
