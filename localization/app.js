/* Localization Review — multi-page SPA. Live from localization.db via /api/*. */
const $ = (s, r=document) => r.querySelector(s);
const S = { date:null, dates:[], tableDates:{} };
let _charts = [];
async function getJSON(u){
  if(window.__STATIC__){            // GitHub Pages static snapshot → read pre-baked JSON files
    const url=new URL(u, location.href), p=(url.pathname.split("/api/")[1]||""), q=url.searchParams;
    let f;
    if(p==="table") f=`data/table_${q.get("name")||"country"}.json`;
    else if(p==="campaign_daily") f=`data/daily/${(q.get("campaign")||"").replace(/[^A-Za-z0-9]+/g,"_")}.json`;
    else if(p==="translation_segments") f=`data/seg_${q.get("page")}_${q.get("lang")}.json`;
    else f=`data/${p}.json`;
    try{ const r=await fetch(f); if(!r.ok) return {};
      return window.__ENC__ ? JSON.parse(await _decB64(await r.text())) : await r.json(); }catch(e){ return {}; }
  }
  const r = await fetch(u); return r.json();
}
async function postJSON(u, b){
  if(window.__STATIC__) return {ok:false, static:true};   // read-only on the published snapshot
  const r = await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}); return r.json();
}
/* ── published-snapshot password gate: data files are AES-256-GCM encrypted; the password
   derives the decryption key (PBKDF2/Web Crypto), so the JSON is unreadable without it,
   even at its direct URL. enc.json (salt + check token) is the only plaintext. ── */
function _b64buf(b64){ const s=atob(b64), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i); return u; }
async function _deriveKey(pw, salt, iter){
  const base=await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:iter, hash:"SHA-256"}, base, {name:"AES-GCM", length:256}, false, ["decrypt"]);
}
async function _decB64(b64){
  const buf=_b64buf(b64), iv=buf.slice(0,12), ct=buf.slice(12);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv}, window.__KEY__, ct));
}
async function showLogin(){
  let cfg; try{ cfg=await (await fetch("data/enc.json")).json(); }catch(e){ return init(); }
  const ov=document.createElement("div"); ov.className="login-ov";
  ov.innerHTML=`<form class="login-card" id="lform">
    <div class="login-brand">Hello Nancy</div><div class="login-sub">Localization Daily · sign in</div>
    <input id="luser" placeholder="Username" autocomplete="username" autocapitalize="off" autofocus>
    <input id="lpass" type="password" placeholder="Password" autocomplete="current-password">
    <button type="submit">Enter</button><div class="login-err" id="lerr"></div></form>`;
  document.body.appendChild(ov);
  ov.querySelector("#lform").onsubmit=async e=>{
    e.preventDefault(); const err=ov.querySelector("#lerr"), btn=ov.querySelector("button"); err.textContent="";
    const user=ov.querySelector("#luser").value.trim(), pw=ov.querySelector("#lpass").value;
    btn.disabled=true; btn.textContent="Checking…";
    try{
      if(cfg.user && user.toLowerCase()!==String(cfg.user).toLowerCase()) throw 0;
      window.__KEY__=await _deriveKey(pw, _b64buf(cfg.salt), cfg.iter);
      if((await _decB64(cfg.check))!=="OK") throw 0;
      ov.remove(); init();
    }catch(_){ window.__KEY__=null; err.textContent="Wrong username or password."; btn.disabled=false; btn.textContent="Enter"; }
  };
}
const usd = (v,dec=0)=> v==null ? "—" : "$"+Number(v).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});
const num = v => Number(v).toLocaleString();
const roasCls = v => v>=1.7?"g":(v<1.1?"r":"a");
const crCls = v => v>=6?"g":(v>=4?"a":"r");
const _MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtStart = iso => { if(!iso) return "—"; const p=String(iso).split("-").map(Number); return `${_MON[p[1]-1]} ${p[2]}, ${p[0]}`; };
function killCharts(){ _charts.forEach(c=>{try{c.destroy()}catch(e){}}); _charts=[]; document.querySelectorAll(".cjs-tip").forEach(e=>e.remove()); }
/* HTML tooltip — escapes the canvas so it isn't clipped by small chart containers (e.g. the donut) */
function htmlTooltip(ctx){
  const {chart, tooltip}=ctx; const par=chart.canvas.parentNode;
  let el=par.querySelector(".cjs-tip");
  if(!el){ el=document.createElement("div"); el.className="cjs-tip"; par.appendChild(el); }
  if(!tooltip || tooltip.opacity===0){ el.style.opacity=0; return; }
  const title=(tooltip.title||[]).join(" ");
  const body=(tooltip.body||[]).map(b=>b.lines.join(" ")).join("<br>");
  el.innerHTML=(title?`<div class="cjs-tip-t">${title}</div>`:"")+body;
  el.style.opacity=1;
  el.style.left=(chart.canvas.offsetLeft+tooltip.caretX)+"px";
  el.style.top=(chart.canvas.offsetTop+tooltip.caretY)+"px";
}
function statusCls(val, target){ if(target==null||val==null) return ""; const r=val/target; return r>=1?"g":(r>=0.75?"a":"r"); }
function statusDot(val, target){ const c=statusCls(val,target); return c?`<span class="sdot ${c}"></span>`:""; }
// flat status dots for legends (replaces ${SD.g}${SD.a}${SD.r}${SD.m})
const SD={ g:'<span class="sdot g"></span>', a:'<span class="sdot a"></span>', r:'<span class="sdot r"></span>', m:'<span class="sdot muted"></span>' };

/* ── line icons (stroke=currentColor, sized via CSS) ── */
const ICONS={
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  grid:'<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  trend:'<path d="M3 16.5l5-5 4 3 6-7.5"/><path d="M3 21h18"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2.2"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M21 15.5 16 11 5 20"/>',
  rocket:'<path d="M14.5 4.5C18 6 19 12 16 16l-4 1-5-5 1-4c1.5-2 4-3.5 6.5-3.5z"/><path d="M7 15c-1 1-1.4 4-1.4 4s3-.4 4-1.4"/><circle cx="14" cy="9" r="1.5"/>',
  dollar:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M14.6 9.2c0-1.1-1.2-1.8-2.6-1.8s-2.6.8-2.6 1.9 1.2 1.6 2.6 1.8 2.6.8 2.6 1.9-1.2 1.8-2.6 1.8-2.6-.8-2.6-1.8"/>',
  wallet:'<path d="M3 7.5a2 2 0 0 1 2-2h11v3.5"/><rect x="3" y="7.5" width="18" height="12" rx="2.2"/><circle cx="16.5" cy="13.5" r="1.4"/>',
  cart:'<circle cx="9.5" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2.2l2.3 12h10l2-8.5H6"/>',
  spark:'<path d="M12 3l1.7 5L19 9.6l-5 1.7L12 16l-1.7-4.7L5 9.6l5.3-1.6L12 3z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
  lang:'<path d="M3 5h8"/><path d="M7 4v1c0 4-2 7-5 9"/><path d="M5 9c0 2 2 4.5 5.5 5.5"/><path d="M21 21l-4-9-4 9"/><path d="M14 18h6"/>',
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]||""}</svg>`;
function campLink(name, url){ const t=String(name==null?"":name); return url
  ? `<a class="camplink" href="${url}" target="_blank" rel="noopener noreferrer" title="Open in Meta Ads Manager">${t}<span class="ext">↗</span></a>` : t; }
function kpiIconName(label){ const l=(label||"").toLowerCase();
  if(l.includes("revenue")) return "dollar"; if(l.includes("roas")) return "target";
  if(l.includes("spend")) return "wallet"; if(l.includes("order")) return "cart";
  if(l.includes("market")) return "globe"; return "grid"; }
function kpiCard(k, opts={}){
  const fmtv = k.fmt==="usd"?usd(k.value): k.fmt==="x"?Number(k.value).toFixed(2): k.fmt==="frac"?`${k.value} / ${k.den}`: num(k.value);
  const dot = k.target!=null ? statusDot(k.value,k.target) : "";
  const tgt = k.target!=null ? (k.fmt==="usd"?usd(k.target): k.fmt==="x"?k.target.toFixed(2): k.target) : "";
  const wow = k.wow==null?"":`<span class="wow ${k.wow>=0?'up':'down'}">${k.wow>=0?'▲':'▼'} ${Math.abs(k.wow)}%</span>`;
  const spark = (opts.spark && k.spark && k.spark.length>1) ? `<div class="sparkbox"><canvas class="spark" id="spk_${slug(k.label)}"></canvas></div>` : "";
  const cls = "kpi" + (opts.clickable ? " clickable" : "");
  const dki = (opts.idx!=null) ? ` data-ki="${opts.idx}"` : "";
  const hint = opts.clickable ? `<span class="verify">view 30d →</span>` : "";
  return `<div class="${cls}"${dki}><div class="kpi-top"><div class="kpi-ic">${svg(kpiIconName(k.label))}</div>${wow}</div>
    <div class="lab">${k.label}</div><div class="val">${fmtv}${dot}</div>${tgt!==""?`<div class="tgt">target <b>${tgt}</b></div>`:""}${spark}${hint}</div>`;
}
if(window.Chart){ Chart.defaults.font.family="'Geist',system-ui,sans-serif"; Chart.defaults.font.size=11.5;
  Chart.defaults.color="#8A8694"; Chart.defaults.borderColor="#F1EFF5"; }
const slug = s => (s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
/* Shopify analytics report (session-country CR) for a given date — opens as "proof" */
function shopifySourceUrl(date){
  const ql=`FROM sessions\n  SHOW online_store_visitors, sessions, sessions_that_completed_checkout,\n    conversion_rate\n  WHERE session_country IS NOT NULL\n  GROUP BY session_country WITH TOTALS, CURRENCY 'USD'\n  SINCE ${date} UNTIL ${date}\n  ORDER BY sessions DESC\n  LIMIT 1000\nVISUALIZE conversion_rate TYPE horizontal_bar`;
  return "https://admin.shopify.com/store/hello-nancy-toys/analytics/reports/73761089?ql="+encodeURIComponent(ql);
}
/* Shopify sales report (revenue/orders source) — localized markets, daily, for a window.
   total_sales = the field the dashboard's "Shopify Revenue" sums. */
const LOC_MARKETS = "'Netherlands', 'Sweden', 'France', 'Denmark', 'Germany', 'Belgium', 'Italy', "
  + "'Switzerland', 'Spain', 'Poland', 'Austria', 'Portugal', 'Mexico', 'Hungary', 'Finland', "
  + "'Brazil', 'Greece', 'Norway', 'Japan', 'Romania', 'Czechia'";
function shopifyRevenueUrl(start, end){
  const ql=`FROM sales\n  SHOW orders, total_sales\n  WHERE billing_country IN (${LOC_MARKETS})\n  TIMESERIES day WITH TOTALS\n  SINCE ${start} UNTIL ${end}\n  ORDER BY day DESC\n  LIMIT 1000\nVISUALIZE orders, total_sales TYPE line`;
  return "https://admin.shopify.com/store/hello-nancy-toys/analytics/reports/317292865?ql="+encodeURIComponent(ql);
}
/* Glued report — source of all Meta ad data (spend · ROAS · campaigns · ads) */
const GLUED_REPORT_URL="https://app.glued.me/reports/rep_460d8684-f4df-49fc-a081-706e0ffc78aa";
const gluedSourceUrl=()=>GLUED_REPORT_URL;
function gluedLink(){ return ""; }   /* source links moved to the topbar buttons */
function shopifyLink(){ return ""; }
/* Auto-written, data-driven "Today's read" callout (recomputed every day) */
function insightCard(html, label="Today's read"){
  return `<div class="insight"><span class="insight-ic">${svg('spark')}</span>
    <div class="insight-tx"><span class="lbl">${label}</span>${html}</div></div>`;
}
const pct=(a,b)=> b? Math.round(a/b*100) : 0;
/* copy an Ad ID to the clipboard with inline ✓ feedback */
function fallbackCopy(text){ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0";
  document.body.appendChild(ta); ta.focus(); ta.select(); try{document.execCommand("copy");}catch(e){} document.body.removeChild(ta); }
function copyAdId(td, id){
  const ic=td.querySelector(".copyic");
  const done=()=>{ if(!ic) return; ic.textContent="copied ✓"; ic.classList.add("ok"); setTimeout(()=>{ic.textContent="⧉"; ic.classList.remove("ok");},1300); };
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(id).then(done).catch(()=>{fallbackCopy(id);done();}); }
  else { fallbackCopy(id); done(); }
}
function drawSparks(kpis){
  kpis.forEach(k=>{ if(!k.spark||k.spark.length<2) return; const el=document.getElementById("spk_"+slug(k.label)); if(!el) return;
    _charts.push(new Chart(el,{type:"line",data:{labels:k.spark.map((_,i)=>i),datasets:[{data:k.spark,
      borderColor:"#FF00CF",backgroundColor:"rgba(255,0,207,.10)",borderWidth:2,fill:true,tension:.4,pointRadius:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},
        scales:{x:{display:false},y:{display:false,min:Math.min(...k.spark)*0.9}}}})); });
}

/* ── menu collapse toggle (persisted in localStorage) ── */
function initNavToggle(){
  const app=document.querySelector(".app");
  if(!app) return;
  const c=document.getElementById("navcollapse");
  const setT=h=>{ if(c){ c.title=h?"Expand menu":"Collapse menu"; c.setAttribute("aria-label",c.title); } };
  if(localStorage.getItem("navHidden")==="1") app.classList.add("nav-hidden");
  setT(app.classList.contains("nav-hidden"));
  const toggle=()=>{ const hidden=app.classList.toggle("nav-hidden"); localStorage.setItem("navHidden", hidden?"1":"0"); setT(hidden); };
  const t=document.getElementById("navtoggle"); if(t) t.onclick=toggle;       // » reopen (topbar; hidden in mini)
  if(c) c.onclick=toggle;                                                     // «/» collapse↔expand (in rail)
}

/* ── KPI detail drawer: 30-day breakdown so the headline average can be verified ── */
let _trend30={date:null,series:null}, _drawerChart=null;
async function getTrend30(){
  if(_trend30.date===S.date && _trend30.series) return _trend30.series;
  const d=await getJSON(`/api/trend?date=${S.date}&days=30`);
  _trend30={date:S.date, series:d.series||[]}; return _trend30.series;
}
function kpiField(label){ const l=(label||"").toLowerCase();
  if(l.includes("meta revenue")||l.includes("meta-attributed")||l.includes("attributed revenue")) return {f:"meta_rev_usd",fmt:"usd"};
  if(l.includes("revenue")) return {f:"revenue_usd",fmt:"usd"};
  if(l.includes("roas")) return {f:"meta_roas",fmt:"x"};
  if(l.includes("spend")) return {f:"meta_spend_usd",fmt:"usd"};
  if(l.includes("order")) return {f:"orders",fmt:"int"};
  return null; }
const _SHOP_IC='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';
const _GLUE_IC='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/></svg>';
function drawerSource(fld, start, end){
  // Only Shopify (a different report than the topbar). Glued/Meta is already in the topbar.
  if(!(fld.f==="revenue_usd" || fld.f==="orders")) return "";
  return `<a class="srcbtn" style="margin-top:12px" href="${shopifyRevenueUrl(start,end)}" target="_blank" rel="noopener noreferrer">${_SHOP_IC} Shopify source <span class="ext">↗</span></a>`;
}
function _drawerEls(){
  if(document.getElementById("kdrawer")) return;
  const ov=document.createElement("div"); ov.id="kdrawer-ov"; ov.className="drawer-ov"; ov.onclick=closeDrawer;
  const dr=document.createElement("div"); dr.id="kdrawer"; dr.className="drawer"; dr.setAttribute("role","dialog");
  document.body.append(ov,dr);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeDrawer(); });
}
function closeDrawer(){ const o=document.getElementById("kdrawer-ov"), d=document.getElementById("kdrawer");
  if(o) o.classList.remove("open"); if(d) d.classList.remove("open");
  if(_drawerChart){ try{_drawerChart.destroy()}catch(e){} _drawerChart=null; } }
async function openKpiDrawer(kpi){
  _drawerEls(); const dr=document.getElementById("kdrawer");
  dr.innerHTML=`<div class="drawer-h"><div class="loading" style="padding:8px">Loading…</div></div>`;
  document.getElementById("kdrawer-ov").classList.add("open"); dr.classList.add("open");
  const fld=kpiField(kpi.label);
  if(!fld) return renderMarketsDrawer(kpi);
  const s=await getTrend30();
  const rows=s.map(p=>({date:p.date, v:Number(p[fld.f])||0}));
  const vals=rows.map(r=>r.v), sum=vals.reduce((a,b)=>a+b,0), avg=sum/(vals.length||1);
  const fmt=v=> fld.fmt==="usd"?usd(Math.round(v)): fld.fmt==="x"?Number(v).toFixed(2): num(Math.round(v));
  const totalRow = fld.fmt!=="x" ? `<tr><td class="tot-label">30-day total</td><td class="num">${fmt(sum)}</td></tr>` : "";
  const tgt = kpi.target!=null ? (fld.fmt==="usd"?usd(kpi.target): fld.fmt==="x"?Number(kpi.target).toFixed(2): kpi.target) : null;
  const trows=[...rows].reverse().map(r=>`<tr><td class="dt">${r.date}</td><td class="num">${fmt(r.v)}</td></tr>`).join("");
  const start=rows.length?rows[0].date:S.date, end=rows.length?rows[rows.length-1].date:S.date;
  dr.innerHTML=`<div class="drawer-h"><div><div class="dk-lbl">${kpi.label}</div><div class="dk-big">${fmt(avg)}</div>
      <div class="sub-note" style="margin:5px 0 0">30-day daily average${tgt?` · target ${tgt}`:''} · summed across all localized (non-English) markets</div>
      ${drawerSource(fld,start,end)}</div>
      <button class="drawer-close" id="dclose" aria-label="Close">✕</button></div>
    <div class="drawer-body">
      <div class="chartbox" style="height:160px;margin-bottom:14px"><canvas id="dchart"></canvas></div>
      <div class="tablewrap"><table><thead><tr><th>Date</th><th class="num">Value</th></tr></thead>
        <tbody>${trows}</tbody><tfoot><tr><td class="tot-label">30-day average</td><td class="num">${fmt(avg)}</td></tr>${totalRow}</tfoot></table></div>
      <div class="note">Daily localized-market values — the headline KPI is the average of these ${rows.length} days.</div></div>`;
  document.getElementById("dclose").onclick=closeDrawer;
  if(_drawerChart){ try{_drawerChart.destroy()}catch(e){} }
  _drawerChart=new Chart(document.getElementById("dchart"),{type:"line",
    data:{labels:rows.map(r=>r.date.slice(5)),datasets:[{data:vals,borderColor:"#FF00CF",backgroundColor:"rgba(255,0,207,.08)",fill:true,tension:.3,pointRadius:0,borderWidth:2}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:6,font:{size:10}}},y:{grid:{color:"#F1EFF5"}}}}});
}
async function renderMarketsDrawer(kpi){
  const d=await getJSON(`/api/markets?date=${S.date}`); const dr=document.getElementById("kdrawer"); const goal=d.goal_pct;
  const rows=[...d.cr_chart].sort((a,b)=>b.cr-a.cr).map(r=>`<tr><td class="dt" style="color:var(--ink)">${r.market}</td><td class="num ${r.cr>=goal?'g':'r'}">${r.cr.toFixed(1)}%</td><td class="num">${num(r.sessions)}</td><td class="num">${r.cr>=goal?'✓':''}</td></tr>`).join("");
  dr.innerHTML=`<div class="drawer-h"><div><div class="dk-lbl">${kpi.label}</div><div class="dk-big">${kpi.value} / ${kpi.den}</div>
      <div class="sub-note" style="margin:5px 0 0">markets at ≥${goal}% CR · L7D · top by sessions</div></div>
      <button class="drawer-close" id="dclose" aria-label="Close">✕</button></div>
    <div class="drawer-body"><div class="tablewrap"><table><thead><tr><th>Market</th><th class="num">CR 7d</th><th class="num">Sessions</th><th class="num">≥${goal}%</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  document.getElementById("dclose").onclick=closeDrawer;
}
async function openCampaignDrawer(r){
  _drawerEls(); const dr=document.getElementById("kdrawer");
  dr.innerHTML=`<div class="drawer-h"><div class="loading" style="padding:8px">Loading…</div></div>`;
  document.getElementById("kdrawer-ov").classList.add("open"); dr.classList.add("open");
  const end=(r.off&&r.last_active)?r.last_active:S.date;
  const d=await getJSON(`/api/campaign_daily?campaign=${encodeURIComponent(r.raw)}&end=${end}`);
  const days=d.days||[];
  const tSpend=days.reduce((s,p)=>s+p.spend_usd,0), tRev=days.reduce((s,p)=>s+p.revenue_usd,0), bRoas=tSpend?tRev/tSpend:0;
  const trows=[...days].reverse().map(p=>`<tr><td class="dt">${p.date}</td><td class="num">${usd(p.spend_usd)}</td><td class="num">${usd(p.revenue_usd)}</td><td class="num ${p.spend_usd<1?'zero':roasCls(p.roas)}">${p.spend_usd<1?'—':p.roas.toFixed(2)}</td></tr>`).join("");
  dr.innerHTML=`<div class="drawer-h"><div><div class="dk-lbl">${r.campaign}${r.off?' <span class="offpill">killed</span>':''}</div><div class="dk-big">${bRoas.toFixed(2)}× <span style="font-size:12px;color:var(--mut);font-weight:600">7-day ROAS</span></div>
      <div class="sub-note" style="margin:5px 0 0">${end===S.date?'last 7 days':'final active week · ended '+end} · spend ${usd(tSpend)} · revenue ${usd(tRev)}</div></div>
      <button class="drawer-close" id="dclose" aria-label="Close">✕</button></div>
    <div class="drawer-body">
      <div class="chartbox" style="height:170px;margin-bottom:14px"><canvas id="dchart"></canvas></div>
      <div class="tablewrap"><table><thead><tr><th>Date</th><th class="num">Spend</th><th class="num">Revenue</th><th class="num">ROAS</th></tr></thead>
        <tbody>${trows}</tbody><tfoot><tr><td class="tot-label">7-day total</td><td class="num">${usd(tSpend)}</td><td class="num">${usd(tRev)}</td><td class="num ${roasCls(bRoas)}">${bRoas.toFixed(2)}</td></tr></tfoot></table></div></div>`;
  document.getElementById("dclose").onclick=closeDrawer;
  if(_drawerChart){ try{_drawerChart.destroy()}catch(e){} }
  _drawerChart=new Chart(document.getElementById("dchart"),{type:"bar",
    data:{labels:days.map(p=>p.date.slice(5)),datasets:[
      {label:"Spend",data:days.map(p=>p.spend_usd),backgroundColor:"#E2DDEC",borderRadius:3},
      {label:"Revenue",data:days.map(p=>p.revenue_usd),backgroundColor:"#FF00CF",borderRadius:3}]},
    options:{maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{usePointStyle:true,boxWidth:8,padding:12,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:"#F1EFF5"},ticks:{callback:v=>'$'+v}}}}});
}

const PAGES = [
  {k:"home",      icon:"home",   label:"Home",      group:"Overview",    render:renderHome},
  {k:"scorecard", icon:"grid",   label:"Scorecard", group:"Overview",    render:renderScorecard},
  {k:"trends",    icon:"trend",  label:"Trends",    group:"Overview",    render:renderTrends},
  {k:"markets",   icon:"globe",  label:"Markets",   group:"Performance", render:renderMarkets},
  {k:"campaigns", icon:"target", label:"Campaigns", group:"Performance", render:renderCampaigns},
  {k:"creative",  icon:"image",  label:"Creative",  group:"Performance", render:renderCreative},
  {k:"plan",      icon:"rocket", label:"The Plan",  group:"Strategy",    render:renderPlan},
  {k:"translations", icon:"lang", label:"Translations", group:"Quality", render:renderTranslations},
];
function curPage(){ const h=location.hash.replace("#/",""); return PAGES.find(p=>p.k===h)||PAGES[0]; }
function buildNav(){
  const nav=$("#nav"); nav.innerHTML=""; let group=null;
  PAGES.forEach(p=>{
    if(p.group!==group){ group=p.group; const g=document.createElement("div"); g.className="navgroup"; g.textContent=group; nav.appendChild(g); }
    const a=document.createElement("a"); a.href="#/"+p.k; a.dataset.k=p.k;
    a.innerHTML=`${svg(p.icon)}<span>${p.label}</span>`; a.title=p.label; nav.appendChild(a);
  });
}
async function route(){
  killCharts(); closeDrawer();
  const p=curPage();
  $("#pagetitle").innerHTML = svg(p.icon)+`<span>${p.label}</span>`;
  const ss=$("#shopsrc"); if(ss) ss.href=shopifySourceUrl(S.date);
  const gs=$("#gluedsrc"); if(gs) gs.href=gluedSourceUrl();
  document.querySelectorAll(".nav a").forEach(a=>a.classList.toggle("active", a.dataset.k===p.k));
  const view=$("#view"); view.innerHTML='<div class="loading">Loading…</div>';
  try{ await p.render(view); }
  catch(e){ view.innerHTML=`<div class="empty err">Error: ${e.message}</div>`; }
}
window.addEventListener("hashchange", route);

async function init(){
  const meta = await getJSON("/api/dates");
  S.dates=meta.dates; S.tableDates=meta.tables; S.date=meta.dates[0];
  const sel=$("#date");
  meta.dates.forEach(d=>{ const o=document.createElement("option"); o.value=d; o.textContent=d; sel.appendChild(o); });
  sel.value=S.date;
  sel.onchange=()=>{ S.date=sel.value; route(); };
  buildNav();
  initNavToggle();
  if(!location.hash) location.hash="#/home";
  route();
}

/* ═══════════════════════ HOME (ported ops dashboard) ═══════════════════════ */
const HOME_TABS = {country:"Countries", campaign:"Campaigns (localized)", super_cbo:"Super CBO", abo:"ABO ad sets"};
const HOME_ORDER = ["country","campaign","super_cbo","abo"];
const HOME_TBL = {country:"loc_daily_country", campaign:"loc_daily_campaign", super_cbo:"loc_daily_adset", abo:"loc_daily_adset"};
let H = { tab:"country", data:null, sortCol:null, sortDir:1, reportText:"" };
let HO = { tab:"campaigns", data:null };

function hfmt(col, v){
  if(v===null||v===undefined||v==="") return {t:"", cls:""};
  if(!H.data.numeric.includes(col)) return {t:String(v), cls:"txt"};
  const n=Number(v); let cls="num", t;
  if(col==="conversion_rate"){ cls+=n>=0.06?" g":(n>=0.04?" a":" r"); }
  else if(col==="roas"||col==="meta_roas"){ cls+=n===0?" zero":(n>=1.7?" g":(n>=1.1?" a":" r")); }
  if(col==="conversion_rate") t=(n*100).toFixed(2)+"%";
  else if(col==="roas"||col==="meta_roas") t=n.toFixed(2);
  else if(col.endsWith("_usd")||col.endsWith("_hkd")) t=n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  else t=Number.isInteger(n)?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:2});
  return {t, cls};
}
function hTotals(d, rows){
  const numset=new Set(d.numeric), leaf=rows.filter(r=>r.country_code!=="_NONENG_TOTAL");
  const has=c=>d.columns.includes(c), sum=c=>leaf.reduce((s,r)=>s+(Number(r[c])||0),0);
  const cells={}; let labeled=false;
  for(const c of d.columns){
    if(!numset.has(c)){ cells[c]=labeled?{t:"",cls:""}:{t:"Σ Total",cls:"tot-label"}; labeled=true; continue; }
    let val;
    if(c==="conversion_rate"){ const s=sum("sessions"); val=(has("checkouts")&&s)?sum("checkouts")/s:null; }
    else if(c==="meta_roas"){ const s=sum("meta_spend_hkd"); val=(has("meta_revenue_hkd")&&s)?sum("meta_revenue_hkd")/s:null; }
    else if(c==="roas"){ const s=sum("spend_hkd"); val=(has("revenue_hkd")&&s)?sum("revenue_hkd")/s:null; }
    else val=sum(c);
    cells[c]= val===null?{t:"",cls:"num"}:hfmt(c,val);
  }
  return cells;
}
function hRenderTable(root){
  const d=H.data, thead=$("#tbl thead",root), tbody=$("#tbl tbody",root);
  thead.innerHTML=""; tbody.innerHTML=""; const oldtf=$("#tbl tfoot",root); if(oldtf) oldtf.remove();
  if(d.error){ tbody.innerHTML=`<tr><td class="empty err">${d.error}</td></tr>`; return; }
  const tr=document.createElement("tr");
  d.columns.forEach(c=>{ const th=document.createElement("th"); const isN=d.numeric.includes(c);
    th.className=isN?"num":""; th.innerHTML=c+'<span class="ar"></span>';
    if(H.sortCol===c){ th.setAttribute("aria-sort",H.sortDir>0?"ascending":"descending"); th.querySelector(".ar").textContent=H.sortDir>0?"▲":"▼"; }
    th.onclick=()=>{ if(H.sortCol===c) H.sortDir*=-1; else {H.sortCol=c; H.sortDir=isN?-1:1;} hRenderTable(root); };
    tr.appendChild(th); });
  thead.appendChild(tr);
  let rows=d.rows.slice();
  if(H.sortCol){ const c=H.sortCol, n=d.numeric.includes(c);
    rows.sort((a,b)=>{ let x=a[c],y=b[c]; if(n){x=Number(x)||0;y=Number(y)||0;return (x-y)*H.sortDir;}
      x=(x??"").toString().toLowerCase(); y=(y??"").toString().toLowerCase(); return x<y?-H.sortDir:x>y?H.sortDir:0; }); }
  if(!rows.length){ tbody.innerHTML=`<tr><td class="empty" colspan="${d.columns.length}">No rows for ${S.date}.</td></tr>`; }
  rows.forEach(r=>{ const trr=document.createElement("tr");
    d.columns.forEach(c=>{ const td=document.createElement("td"); const f=hfmt(c,r[c]); td.className=f.cls;
      if(c==="campaign" && r.ads_url){ td.innerHTML=campLink(f.t, r.ads_url); } else { td.textContent=f.t; }
      if(c==="ad_name"||c==="campaign"||c==="adset") td.title=r[c]||""; trr.appendChild(td); });
    tbody.appendChild(trr); });
  $("#rowmeta",root).textContent=`${rows.length} row${rows.length===1?"":"s"}`;
  if(rows.length){ const cells=hTotals(d,rows); const tf=document.createElement("tfoot"); const tr2=document.createElement("tr");
    d.columns.forEach(c=>{ const td=document.createElement("td"); const v=cells[c]; td.className=v.cls; td.textContent=v.t; tr2.appendChild(td); });
    tf.appendChild(tr2); $("#tbl",root).appendChild(tf); }
}
function hTabs(root){ const t=$("#tabs",root); t.innerHTML="";
  HOME_ORDER.forEach(k=>{ const b=document.createElement("button"); b.className="tab"; b.setAttribute("aria-selected",String(k===H.tab));
    b.textContent=HOME_TABS[k]; b.onclick=()=>{ H.tab=k; H.sortCol=null; H.sortDir=1; hTabs(root); hLoadTable(root); }; t.appendChild(b); }); }
async function hLoadTable(root){
  H.data=await getJSON(`/api/table?name=${H.tab}&date=${S.date}`); hRenderTable(root);
  const dates=S.tableDates[H.tab]||[]; const span=dates.length?`${dates[dates.length-1]} → ${dates[0]}`:"no data";
  let note=`source: ${HOME_TBL[H.tab]} · available ${span}`;
  if(H.tab==="super_cbo") note+=" · via Glued ad pull (small ad sets under-count vs Meta export)";
  if(H.tab==="abo") note+=" · ABO campaign launched Jun 2026 — ROAS still settling, not flagged for kill yet";
  $("#srcnote",root).textContent=note;
}
function hOptCampaigns(root,d){
  const box=$("#optcamp",root); $(".optwrap",root).style.display="none"; box.style.display="block"; box.innerHTML="";
  const rows=d.campaigns||[]; if(!rows.length){ box.innerHTML=`<div class="empty">No scale/kill campaigns for ${S.date}.</div>`; return; }
  const money=v=>(v==null)?"—":"$"+Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); const r2=v=>Number(v).toFixed(2);
  [["Scale",SD.g+" SCALE ≥"+Number(d.scale_thr).toFixed(1)],["Kill",SD.r+" KILL ≤"+Number(d.kill_thr).toFixed(1)]].forEach(([act,hdr])=>{
    const items=rows.filter(r=>r.action===act); if(!items.length) return;
    const h=document.createElement("div"); h.className="optg"; h.innerHTML=hdr; box.appendChild(h);
    items.forEach(r=>{ const c=document.createElement("div"); c.className="optcard";
      c.innerHTML=`<div class="optname">・ ${campLink(r.campaign, r.ads_url)}</div><div class="optmeta">Budget: ${money(r.budget_usd)} | YSpend: ${money(r.yspend_usd)} | L7D: <b>${r2(r.l7d)}</b> | Yday: ${r2(r.yday)} | Today: ${r2(r.today)}</div>`;
      box.appendChild(c); });
  });
}
function hRenderOpt(root){
  const d=HO.data; if(!d) return; const tab=HO.tab;
  if(tab==="campaigns"){ return hOptCampaigns(root,d); }
  $("#optcamp",root).style.display="none"; $(".optwrap",root).style.display="";
  const rows=d[tab]||[]; const cols=tab==="ads"?["action","roas","spend_usd","ad_name","campaign"]:["action","roas","spend_usd","adset","countries"];
  const LB={action:"Action",roas:"ROAS",spend_usd:"Spend 7d",campaign:"Campaign",ad_name:"Ad",adset:"Ad set",countries:"Countries"};
  const thead=$("#opttbl thead",root), tbody=$("#opttbl tbody",root); thead.innerHTML=""; tbody.innerHTML="";
  const tr=document.createElement("tr"); cols.forEach(c=>{ const th=document.createElement("th"); th.className=(c==="roas"||c==="spend_usd")?"num":""; th.textContent=LB[c]; tr.appendChild(th); }); thead.appendChild(tr);
  const tabLbl={ads:"ads",adsets:"Super CBO ad sets",abo_adsets:"ABO ad sets"}[tab]||tab;
  if(!rows.length){ tbody.innerHTML=`<tr><td class="empty" colspan="${cols.length}">No scale/cut ${tabLbl} for ${S.date}.</td></tr>`; return; }
  rows.forEach(r=>{ const trr=document.createElement("tr");
    cols.forEach(c=>{ const td=document.createElement("td");
      if(c==="action") td.innerHTML=`<span class="badge ${r.action==='Scale'?'b-scale':'b-kill'}">${r.action}</span>`;
      else if(c==="roas"){ td.className="num "+roasCls(r.roas); td.textContent=Number(r.roas).toFixed(2); }
      else if(c==="spend_usd"){ td.className="num"; td.textContent="$"+num(r.spend_usd); }
      else if(c==="campaign"){ td.className="txt"; td.innerHTML=campLink(r.campaign, r.ads_url); td.title=r.campaign||""; }
      else if(c==="ad_name" && r.ad_id){ td.className="txt copyad"; td.title="Click to copy Ad ID "+r.ad_id;
        td.innerHTML=`<span class="adcell"><span class="adnm">${r.ad_name||""}</span><span class="copyic" aria-hidden="true">⧉</span></span>`;
        td.onclick=()=>copyAdId(td, r.ad_id); }
      else { td.className="txt"; td.textContent=r[c]||""; td.title=r[c]||""; }
      trr.appendChild(td); });
    tbody.appendChild(trr); });
}
function hOptTabs(root){ const t=$("#opttabs",root); t.innerHTML="";
  [["campaigns","Campaigns"],["ads","Ads"],["adsets","Super CBO ad sets"],["abo_adsets","ABO ad sets"]].forEach(([k,lbl])=>{
    const b=document.createElement("button"); b.className="tab"; b.setAttribute("aria-selected",String(k===HO.tab));
    b.textContent=lbl+(HO.data?` (${HO.data[k].length})`:""); b.onclick=()=>{ HO.tab=k; hOptTabs(root); hRenderOpt(root); }; t.appendChild(b); }); }
async function hLoadOpt(root){ HO.data=await getJSON(`/api/optimization?date=${S.date}`); hOptTabs(root); hRenderOpt(root); }
async function renderHome(view){
  view.innerHTML=`<div class="kpis strip" id="kstrip"></div>
    <div class="grid">
    <section class="report-col">
      <div class="col-head"><span class="k">The Report</span>
        <span class="ch-r"><span class="folio">${S.date}</span><button id="copybtn" class="copybtn" type="button">Copy</button></span></div>
      <pre id="report">Loading…</pre>
    </section>
    <section class="ledger">
      <div class="tabs" id="tabs" role="tablist"></div>
      <div class="meta"><span id="rowmeta"></span></div>
      <div class="tablewrap"><table id="tbl"><thead></thead><tbody></tbody></table></div>
      <footer class="note" id="srcnote"></footer>
      <div class="opt" id="opt">
        <div class="opt-head">OPTIMIZATION — L7D · scale or cut</div>
        <div class="tabs" id="opttabs" role="tablist"></div>
        <div id="optcamp" class="optcamp" style="display:none"></div>
        <div class="tablewrap optwrap"><table id="opttbl"><thead></thead><tbody></tbody></table></div>
      </div>
    </section></div>`;
  $("#copybtn",view).onclick=async()=>{ const b=$("#copybtn",view); try{await navigator.clipboard.writeText(H.reportText||"");}catch(e){} b.textContent="Copied ✓"; b.classList.add("done"); setTimeout(()=>{b.textContent="Copy";b.classList.remove("done");},1400); };
  // tables/opt load fast; the report does a live Glued pull (Today ROAS) so let it fill in async
  hTabs(view); hLoadTable(view); hLoadOpt(view);
  getJSON(`/api/scorecard?date=${S.date}`).then(d=>{ const el=$("#kstrip",view); if(el&&d.kpis) el.innerHTML=d.kpis.map(kpiCard).join(""); });
  getJSON(`/api/report?date=${S.date}`).then(j=>{ H.reportText=j.error?"":j.text; const el=$("#report",view); if(el) el.textContent=j.error?("Error: "+j.error):j.text; });
}

/* ═══════════════════════ SCORECARD ═══════════════════════ */
async function renderScorecard(view){
  const d=await getJSON(`/api/scorecard?date=${S.date}`);
  const PAL=["#FF00CF","#C800A2","#FF6FE0","#9B2D86","#FFA3EA","#7A1F6B","#E25BC9","#FFD0F4","#5C1450"];
  const fpv=p=> p.fmt==="usd"?usd(p.value): p.fmt==="x"?Number(p.value).toFixed(2): num(p.value);
  const fpt=p=> p.fmt==="usd"?usd(p.target): p.fmt==="x"?Number(p.target).toFixed(2): p.target;
  // progress bars
  const progRows=d.progress.map(p=>{ const pct=Math.max(0,p.pct), w=Math.min(100,pct), cls=pct>=100?"g":(pct>=75?"a":"r");
    const right = p.fmt==="frac" ? `${p.value} <span class="of">/ ${p.target}</span>` : `${fpv(p)} <span class="of">/ ${fpt(p)}</span>`;
    return `<div class="prog"><div class="prog-top"><span class="pl">${p.label}</span><span class="pv">${right}</span></div>
      <div class="track"><div class="fill ${cls}" style="width:${w}%"></div></div>
      <div class="ppct ${cls}">${pct}% to target</div></div>`; }).join("");
  // revenue-by-market list
  const mixList=d.revenue_mix.map((m,i)=>`<div class="mxrow"><span class="sw" style="background:${PAL[i%PAL.length]}"></span>
    <span class="mxn">${m.market}</span><span class="mxp">${m.pct}%</span><span class="mxv">${usd(m.revenue_usd)}</span></div>`).join("");
  // funnel — clean monotonic session funnel from session_country (sessions → reached → completed).
  // Orders/revenue are billing_country (different attribution) so they're context in the sub-note, not bars.
  const f=d.funnel, _rc=f.reached_checkout||0;
  const stg=[["Sessions",num(f.sessions),"grid",null],
             ["Reached checkout",num(_rc),"cart", f.sessions?(_rc/f.sessions*100).toFixed(1)+"% of sessions":null],
             ["Completed",num(f.checkouts),"target", _rc?(f.checkouts/_rc*100).toFixed(1)+"% of reached":null]];
  const funnelHtml=stg.map(([lab,val,ic,sub],i)=>`${i?`<div class="fn-arrow">→</div>`:""}<div class="fn-stage"><div class="fn-ic">${svg(ic)}</div><div class="fn-val">${val}</div><div class="fn-lab">${lab}</div>${sub?`<div class="fn-sub">${sub}</div>`:""}</div>`).join("");
  const K=l=>d.kpis.find(k=>k.label.toLowerCase().includes(l))||{};
  const P=l=>d.progress.find(p=>p.label.toLowerCase().includes(l))||{pct:0};
  const _rev=K("revenue"),_roas=K("roas"),_mk=K("market");
  const goalP=((_mk.label||"").match(/(\d+)%/)||[])[1]||6;
  const scRead=`Shopify revenue is averaging <b>${usd(_rev.value)} a day</b>, about ${P("revenue").pct}% of the ${usd(_rev.target)} goal, at <b>${Number(_roas.value).toFixed(2)} ROAS</b> against a ${Number(_roas.target).toFixed(1)} target. Only <b>${_mk.value} of ${_mk.den}</b> markets are clearing ${goalP}% conversion, and spend is sitting at roughly ${P("spend").pct}% of target. The constraint right now is conversion, not budget.`;
  view.innerHTML=`<div class="sec">Where we are · vs BETTER target</div>
    ${insightCard(scRead)}
    <div class="sub-note">30-day daily averages · Δ = week-over-week (last 7d vs prior 7d) · ${SD.g} at target · ${SD.a} close · ${SD.r} below</div>
    <div class="kpis">${d.kpis.map((k,i)=>kpiCard(k,{spark:true,clickable:true,idx:i})).join("")}</div>
    <div class="sc-grid">
      <div class="panel"><h3 class="cardh">Progress to BETTER target</h3>${progRows}</div>
      <div class="panel"><h3 class="cardh">Localized revenue by market · L7D</h3>
        <div class="mixwrap"><div class="donutwrap"><canvas id="revmix"></canvas></div><div class="mxlist">${mixList}</div></div></div>
    </div>
    <div class="sec">Localized funnel · last 7 days</div>
    <div class="sub-note">All localized markets · <b>${f.cr}%</b> session→completed CR · ${num(f.orders)} orders · ${usd(f.revenue_usd)} revenue</div>
    <div class="panel funnel">${funnelHtml}</div>`;
  drawSparks(d.kpis);
  view.querySelectorAll(".kpi.clickable").forEach(el=>el.onclick=()=>openKpiDrawer(d.kpis[+el.dataset.ki]));
  const mixTotal=d.revenue_mix.reduce((a,m)=>a+(m.revenue_usd||0),0);
  const donutCenter={id:"donutCenter",afterDraw(c){const{ctx,chartArea:a}=c; if(!a) return;
    const cx=(a.left+a.right)/2, cy=(a.top+a.bottom)/2; ctx.save(); ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle="#8A8694"; ctx.font="700 8.5px 'Geist',sans-serif"; ctx.fillText("L7D TOTAL", cx, cy-10);
    ctx.fillStyle="#15131A"; ctx.font="600 15px 'Geist',sans-serif"; ctx.fillText(usd(mixTotal), cx, cy+6); ctx.restore();}};
  _charts.push(new Chart($("#revmix",view),{type:"doughnut",
    data:{labels:d.revenue_mix.map(m=>m.market),datasets:[{data:d.revenue_mix.map(m=>m.revenue_usd),backgroundColor:PAL,borderWidth:2,borderColor:"#fff",hoverOffset:7,hoverBorderColor:"#fff"}]},
    options:{cutout:"66%",maintainAspectRatio:false,layout:{padding:6},
      plugins:{legend:{display:false},tooltip:{enabled:false,external:htmlTooltip,
        callbacks:{title:i=>i[0].label, label:i=>`${usd(i.raw)} · ${d.revenue_mix[i.dataIndex].pct}%`}}}},
    plugins:[donutCenter]}));
}

/* ═══════════════════════ TRENDS ═══════════════════════ */
async function renderTrends(view){
  const d=await getJSON(`/api/trend?date=${S.date}&days=30`);
  const s=d.series, labels=s.map(p=>p.date.slice(5));
  const rev=s.map(p=>p.revenue_usd), spend=s.map(p=>p.meta_spend_usd),
        mrev=s.map(p=>p.meta_rev_usd||0), roas=s.map(p=>p.meta_roas);
  const last=a=>a[a.length-1]||0, avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const ma=(a,w=7)=>a.map((_,i)=>+(avg(a.slice(Math.max(0,i-w+1),i+1))).toFixed(2));
  const d7=a=>{const l=avg(a.slice(-7)),p=avg(a.slice(-14,-7));return p?Math.round((l-p)/p*100):null;};
  const stat=(label,val,delta)=>{const dv=delta==null?"":`<span class="td ${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${Math.abs(delta)}%</span>`;
    return `<div class="tstat clickable" data-kpi="${label}"><div class="tl">${label}</div><div class="tvv">${val}${dv}</div></div>`;};
  const dRev=d7(rev), dRoas=d7(roas), roas7=avg(roas.slice(-7)), goalR=d.roas_goal||1.7;
  const dir=v=> v==null?"flat":(v>=0?`up ${v}%`:`down ${Math.abs(v)}%`);
  const trRead=`Revenue is <b>${dir(dRev)}</b> on the prior week and spend is <b>${dir(d7(spend))}</b>. The 7-day ROAS sits at <b>${roas7.toFixed(2)}</b>, ${roas7>=goalR?`above the ${goalR} scale line, so there's room to push spend`:`still under the ${goalR} scale line. Efficiency (conversion and creative) needs fixing before more budget goes in`}.`;
  view.innerHTML=`<div class="sec">30-day performance trend</div>
    ${insightCard(trRead)}
    <div class="sub-note">Localized markets · daily values with a <b>7-day moving average</b> (bold line) to cut noise · Δ = last 7 days vs prior 7</div>
    <div class="tstats">
      ${stat("Avg revenue / day", usd(Math.round(avg(rev.slice(-7)))), d7(rev))}
      ${stat("Avg Meta revenue / day", usd(Math.round(avg(mrev.slice(-7)))), d7(mrev))}
      ${stat("Avg Meta spend / day", usd(Math.round(avg(spend.slice(-7)))), d7(spend))}
      ${stat("Avg Meta ROAS", avg(roas.slice(-7)).toFixed(2), d7(roas))}
      ${stat("30-day revenue", usd(rev.reduce((a,b)=>a+b,0)), null)}
    </div>
    <div class="sm-grid">
      <div class="sm-card wide"><div class="sm-h"><span class="sm-t">Shopify revenue / day</span><span class="sm-cur">latest ${usd(last(rev))}</span></div><div class="sm-box"><canvas id="tc_rev"></canvas></div></div>
      <div class="sm-card"><div class="sm-h"><span class="sm-t">Meta spend vs attributed revenue / day</span><span class="sm-cur">ROAS ${last(roas).toFixed(2)}</span></div><div class="sm-box"><canvas id="tc_spend"></canvas></div></div>
      <div class="sm-card"><div class="sm-h"><span class="sm-t">Meta ROAS / day</span><span class="sm-cur">goal ${(d.roas_goal||1.7)} · kill ${(d.roas_kill||1.1)}</span></div><div class="sm-box"><canvas id="tc_roas"></canvas></div></div>
    </div>`;
  view.querySelectorAll(".tstat.clickable").forEach(el=>el.onclick=()=>openKpiDrawer({label:el.dataset.kpi}));
  const bx={grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8}};
  const dollarY={ticks:{callback:v=>"$"+(v/1000)+"k"},grid:{color:"#F1EFF5"}};
  // Revenue — faint daily area + bold 7d MA
  _charts.push(new Chart($("#tc_rev",view),{type:"line",data:{labels,datasets:[
    {label:"Daily",data:rev,borderColor:"rgba(255,0,207,.22)",backgroundColor:"rgba(255,0,207,.06)",borderWidth:1.5,fill:true,tension:.3,pointRadius:0},
    {label:"7-day avg",data:ma(rev),borderColor:"#FF00CF",borderWidth:2.5,tension:.3,pointRadius:0},
  ]},options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false}},scales:{x:bx,y:dollarY}}}));
  // Spend vs attributed revenue — same $ axis (gap = profit, ratio = ROAS)
  _charts.push(new Chart($("#tc_spend",view),{data:{labels,datasets:[
    {type:"bar",label:"Meta spend",data:spend,backgroundColor:"#E7E4EE",borderRadius:2},
    {type:"line",label:"Attributed revenue",data:mrev,borderColor:"#FF00CF",backgroundColor:"rgba(255,0,207,.07)",borderWidth:2,fill:true,tension:.3,pointRadius:0},
  ]},options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"top",labels:{usePointStyle:true,boxWidth:8,padding:12}}},scales:{x:bx,y:dollarY}}}));
  // ROAS — daily + 7d MA + goal/kill lines
  const roasGoals={id:"rg",afterDatasetsDraw(c){const{ctx,chartArea:a,scales:{y}}=c;
    [[d.roas_goal||1.7,"#16A34A","scale ≥"+(d.roas_goal||1.7)],[d.roas_kill||1.1,"#EF4444","kill ≤"+(d.roas_kill||1.1)]].forEach(([v,col,lbl])=>{
      const yy=y.getPixelForValue(v); if(yy<a.top||yy>a.bottom) return;
      ctx.save();ctx.strokeStyle=col;ctx.setLineDash([5,4]);ctx.lineWidth=1.2;
      ctx.beginPath();ctx.moveTo(a.left,yy);ctx.lineTo(a.right,yy);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=col;ctx.font="600 10px 'Geist Mono',monospace";ctx.textAlign="right";ctx.fillText(lbl,a.right-4,yy-4);ctx.restore();});}};
  _charts.push(new Chart($("#tc_roas",view),{type:"line",data:{labels,datasets:[
    {label:"Daily",data:roas,borderColor:"rgba(201,133,26,.28)",borderWidth:1.5,tension:.3,pointRadius:0},
    {label:"7-day avg",data:ma(roas),borderColor:"#C9851A",borderWidth:2.5,tension:.3,pointRadius:0},
  ]},options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false}},
    scales:{x:bx,y:{suggestedMin:0.8,suggestedMax:Math.max(1.9,...roas),grid:{color:"#F1EFF5"}}}},plugins:[roasGoals]}));
}

/* ═══════════════════════ MARKETS ═══════════════════════ */
let MK={tab:"top", sortCol:"revenue_usd", sortDir:-1};
async function renderMarkets(view){
  const d=await getJSON(`/api/markets?date=${S.date}`);
  view.innerHTML=`<div class="tabs" id="mktabs"></div><div id="mkview"></div>`;
  const tabs=[["top","Top 15 markets"],["cr","CR vs goal"],["mvs","Meta vs Shopify"],["opp","Opportunity map"]];
  const tb=$("#mktabs",view);
  tabs.forEach(([k,l])=>{ const b=document.createElement("button"); b.className="tab"; b.setAttribute("aria-selected",String(k===MK.tab));
    b.textContent=l; b.onclick=()=>{ MK.tab=k; killCharts(); renderMarketsBody(view,d); tb.querySelectorAll(".tab").forEach((x,i)=>x.setAttribute("aria-selected",String(tabs[i][0]===MK.tab))); }; tb.appendChild(b); });
  renderMarketsBody(view,d);
}
function renderMarketsBody(view,d){
  const box=$("#mkview",view); const goal=d.goal_pct;
  if(MK.tab==="top") mkTop(box,d);
  else if(MK.tab==="cr") mkCR(box,d,goal);
  else if(MK.tab==="mvs") mkMVS(box,d);
  else mkOpp(box,d,goal);
}
/* Tab 1 — sortable Top-15 with Orders, AOV, blended totals, n/a ROAS on $0 spend */
function mkTop(box,d){
  const COLS=[["market","Market"],["revenue_usd","Shopify Sales 7d"],["spend_usd","Meta Spend 7d"],["roas","Meta ROAS"],["cr","Shopify CR"],["orders","Orders"],["aov","AOV"],["sessions","Sessions"]];
  const rows=d.top.map(r=>({...r, aov:r.orders?r.revenue_usd/r.orders:0}));
  const sc=MK.sortCol, dir=MK.sortDir;
  rows.sort((a,b)=> sc==="market" ? (a.market<b.market?-dir:a.market>b.market?dir:0) : ((Number(a[sc])||0)-(Number(b[sc])||0))*dir);
  const cell=(r,c)=>{
    if(c==="market") return `<td class="txt">${r.market}</td>`;
    if(c==="revenue_usd") return `<td class="num">${usd(r.revenue_usd)}</td>`;
    if(c==="spend_usd") return `<td class="num">${usd(r.spend_usd)}</td>`;
    if(c==="roas") return r.spend_usd<1?`<td class="num zero">—</td>`:`<td class="num ${roasCls(r.roas)}">${r.roas.toFixed(2)}</td>`;
    if(c==="cr") return `<td class="num ${crCls(r.cr)}">${r.cr.toFixed(1)}%</td>`;
    if(c==="orders") return `<td class="num">${num(r.orders)}</td>`;
    if(c==="aov") return `<td class="num">${r.orders?usd(r.aov):'—'}</td>`;
    return `<td class="num">${num(r.sessions)}</td>`;
  };
  const body=rows.map(r=>`<tr>${COLS.map(([c])=>cell(r,c)).join("")}</tr>`).join("");
  const sum=k=>rows.reduce((s,r)=>s+(Number(r[k])||0),0);
  const tRev=sum("revenue_usd"),tSpend=sum("spend_usd"),tOrd=sum("orders"),tSess=sum("sessions"),tMrev=sum("meta_rev_usd");
  const bRoas=tSpend?tMrev/tSpend:0, bCr=tSess?rows.reduce((s,r)=>s+r.cr*r.sessions,0)/tSess:0, tAov=tOrd?tRev/tOrd:0;
  const foot=`<tr><td class="tot-label">Σ Total (15)</td><td class="num">${usd(tRev)}</td><td class="num">${usd(tSpend)}</td>
    <td class="num ${roasCls(bRoas)}">${bRoas.toFixed(2)}</td><td class="num ${crCls(bCr)}">${bCr.toFixed(1)}%</td>
    <td class="num">${num(tOrd)}</td><td class="num">${usd(tAov)}</td><td class="num">${num(tSess)}</td></tr>`;
  const head=COLS.map(([c,l])=>{const on=sc===c; return `<th class="${c==='market'?'':'num'}" data-c="${c}" ${on?`aria-sort="${dir>0?'ascending':'descending'}"`:''}>${l}<span class="ar">${on?(dir>0?'▲':'▼'):''}</span></th>`;}).join("");
  const goal=d.goal_pct, leader=[...d.top].sort((a,b)=>b.revenue_usd-a.revenue_usd)[0];
  const eff=d.top.filter(r=>r.spend_usd>=1&&r.roas>=1.7).sort((a,b)=>b.roas-a.roas).slice(0,3).map(r=>r.market);
  const topRead=`<b>${leader.market}</b> leads on revenue at <b>${usd(leader.revenue_usd)}</b>. Across the top 15, blended Meta ROAS is <b>${bRoas.toFixed(2)}</b> and conversion is <b>${bCr.toFixed(1)}%</b>, ${bCr>=goal?`at or above the ${goal}% goal`:`still short of the ${goal}% goal`}${eff.length?`. The most efficient markets are ${eff.join(", ")}`:''}.`;
  box.innerHTML=`${insightCard(topRead)}<div class="sub-note">L7D · <b>Shopify Sales</b> (all-channel), CR, Orders, AOV & Sessions are from Shopify · <b>Meta Spend</b> & <b>Meta ROAS</b> are from Glued (Meta-attributed only — so ROAS is Meta revenue ÷ Meta spend, not Shopify Sales ÷ spend) · click headers to sort · ROAS shown “—” where there's no ad spend</div>
    <div class="tablewrap"><table id="mktbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>`;
  box.querySelectorAll("#mktbl thead th").forEach(th=>{ th.onclick=()=>{ const c=th.dataset.c;
    if(MK.sortCol===c) MK.sortDir*=-1; else {MK.sortCol=c; MK.sortDir=c==="market"?1:-1;} mkTop(box,d); }; });
}
/* Tab 2 — CR vs goal (goal line + avg line + session gutter) */
function mkCR(box,d,goal){
  const r=d.cr_chart, labels=r.map(x=>x.market), data=r.map(x=>x.cr), sess=r.map(x=>x.sessions);
  const at=r.filter(x=>x.cr>=goal).map(x=>x.market);
  const drag=[...r].filter(x=>x.cr<goal && x.sessions>=1500).sort((a,b)=>b.sessions-a.sessions).slice(0,3).map(x=>x.market);
  const read=`${at.length?`<b>${at.join(", ")}</b> clear the ${goal}% goal`:`No market clears the ${goal}% goal`}${drag.length?`, while the biggest-traffic markets (<b>${drag.join(", ")}</b>) sit below it and drag blended CR down`:''}. Lifting CR in the high-traffic markets is the fastest win.`;
  box.innerHTML=`${insightCard(read)}<div class="sub-note">CR by market (L7D) · top 15 by sessions · ${SD.g} ≥${goal}% · ${SD.a} 4–6% · ${SD.r} <4%</div><div class="chartbox" style="height:${Math.max(360,d.cr_chart.length*38)}px"><canvas id="crc"></canvas></div>`;
  const cols=data.map(v=>v>=6?"#16A34A":(v>=4?"#C9851A":"#EF4444"));
  const avg=data.reduce((a,b)=>a+b,0)/(data.length||1);
  const xMax=Math.ceil(Math.max(goal,...data))+1;
  const vline=(x,col,dash,lbl,top)=>({draw(ctx,a,px){ctx.save();ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(px,a.top);ctx.lineTo(px,a.bottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=col;ctx.font="600 10.5px 'Geist Mono',monospace";ctx.textAlign="center";ctx.fillText(lbl,px,a.top-top);ctx.restore();}});
  const lines={id:"lines",afterDatasetsDraw(c){const{ctx,chartArea:a,scales:{x}}=c;
    vline(0,"#15131A",[6,4],goal+"% goal").draw(ctx,a,x.getPixelForValue(goal));
    vline(0,"#A8A4B0",[3,3],"avg "+avg.toFixed(1)+"%").draw(ctx,a,x.getPixelForValue(avg),16);}};
  const annot={id:"annot",afterDatasetsDraw(c){const{ctx,chartArea:a}=c;const m=c.getDatasetMeta(0);
    ctx.save();ctx.font="600 11px 'Geist Mono',monospace";ctx.textBaseline="middle";
    m.data.forEach((bar,i)=>{ctx.fillStyle="#444";ctx.textAlign="left";ctx.fillText(data[i].toFixed(1)+"%",bar.x+6,bar.y);
      ctx.fillStyle="#999";ctx.textAlign="right";ctx.fillText(sess[i].toLocaleString()+" sess",a.right+62,bar.y);});
    ctx.fillStyle="#15131A";ctx.textAlign="right";ctx.fillText("Sessions 7d",a.right+62,a.top-4);ctx.restore();}};
  _charts.push(new Chart($("#crc",box),{type:"bar",data:{labels,datasets:[{label:"CR %",data,backgroundColor:cols,borderRadius:3}]},
    options:{indexAxis:"y",maintainAspectRatio:false,layout:{padding:{right:72,top:16}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>`CR ${i.raw.toFixed(1)}% · ${sess[i.dataIndex].toLocaleString()} sessions`}}},
      scales:{x:{min:0,max:xMax,ticks:{callback:v=>v+"%"},grid:{color:"#F1EFF5"}},y:{ticks:{font:{size:12}},grid:{display:false}}}},
    plugins:[lines,annot]}));
}
/* Tab 3 — Meta vs Shopify, stacked so Meta's share of revenue is obvious */
function mkMVS(box,d){
  const r=d.meta_vs_shopify.map(x=>({...x, other:Math.max(0,(x.revenue_usd||0)-(x.meta_rev_usd||0)), share:x.revenue_usd?Math.round((x.meta_rev_usd||0)/x.revenue_usd*100):0}));
  const labels=r.map(x=>x.market);
  const totRev=r.reduce((s,x)=>s+(x.revenue_usd||0),0), totMeta=r.reduce((s,x)=>s+(x.meta_rev_usd||0),0);
  const overall=pct(totMeta,totRev);
  const topShare=[...r].filter(x=>x.revenue_usd>500).sort((a,b)=>b.share-a.share).slice(0,2).map(x=>`${x.market} (${x.share}%)`);
  const read=`Meta only gets credit for about <b>${overall}%</b> of localized revenue. The rest comes from other channels like organic, email and direct. The markets leaning most on Meta are <b>${topShare.join(", ")}</b>. It's worth double-checking the attribution windows before reading too much into ROAS.`;
  box.innerHTML=`${insightCard(read)}<div class="sub-note">L7D revenue per market — <b style="color:#FF00CF">pink</b> = Meta-attributed, gray = other channels · stacked to total revenue</div><div class="chartbox"><canvas id="mvsc"></canvas></div>`;
  _charts.push(new Chart($("#mvsc",box),{type:"bar",data:{labels,datasets:[
    {label:"Meta-attributed",data:r.map(x=>x.meta_rev_usd),backgroundColor:"#FF00CF",borderRadius:3,stack:"rev"},
    {label:"Other channels",data:r.map(x=>x.other),backgroundColor:"#E2DDEC",borderRadius:3,stack:"rev"}]},
    options:{interaction:{mode:"index",intersect:false},plugins:{legend:{position:"top",labels:{usePointStyle:true,boxWidth:8,padding:16}},
      tooltip:{callbacks:{afterbody:items=>{const i=items[0].dataIndex; return `Meta share: ${r[i].share}% of ${usd(r[i].revenue_usd)}`;}}}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>"$"+(v/1000)+"k"},grid:{color:"#F1EFF5"}}}}}));
}
/* Tab 4 — Opportunity map: spend × CR bubble (size=sessions, color=ROAS) */
function mkOpp(box,d,goal){
  const pts=(d.scatter||[]);
  const colFor=r=> r.spend_usd<1?"#B9B4C2":(r.roas>=1.7?"#16A34A":(r.roas>=1.1?"#C9851A":"#EF4444"));
  const maxSess=Math.max(1,...pts.map(p=>p.sessions));
  const data=pts.map(r=>({x:r.spend_usd,y:r.cr,r:7+Math.sqrt(r.sessions/maxSess)*20}));
  const opps=pts.filter(r=>r.cr>=goal).sort((a,b)=>a.spend_usd-b.spend_usd);
  const list=opps.length? opps.map(r=>`<div class="opprow"><span class="om">${r.market}</span><span class="oc">${r.cr.toFixed(1)}%</span><span class="os">${usd(r.spend_usd)}</span><span class="oo">${num(r.sessions)} sess</span></div>`).join("") : `<div class="empty">No market clears ${goal}% CR yet.</div>`;
  // ── plain-language, data-driven read of the map (recomputed every day) ──
  const SCALE=1.7, KILL=1.1, ws=pts.filter(r=>r.spend_usd>=1);
  const mk=r=>`<b>${r.market}</b>`, names=(a,n=3)=>a.slice(0,n).map(mk).join(", ");
  const scaleHere=pts.filter(r=>r.cr>=goal && r.spend_usd<700).sort((a,b)=>b.cr-a.cr);
  const proven=ws.filter(r=>r.roas>=SCALE && r.cr>=goal*0.6).sort((a,b)=>b.roas-a.roas);
  const leaking=ws.filter(r=>r.spend_usd>=500 && (r.roas<=KILL || r.cr<goal*0.6)).sort((a,b)=>a.roas-b.roas);
  const untapped=pts.filter(r=>r.spend_usd<60 && r.cr>=goal*0.8).sort((a,b)=>b.cr-a.cr);
  const ins=[];
  if(scaleHere.length){const t=scaleHere[0];ins.push(`<li><span class="ib g">Scale now</span> ${names(scaleHere)} ${scaleHere.length>1?"are":"is"} converting at or above your ${goal}% goal on very little spend. ${mk(t)} is at <b>${t.cr.toFixed(1)}%</b> for only <b>${usd(t.spend_usd)}</b>, so that's the best place to add budget.</li>`);}
  if(proven.length){ins.push(`<li><span class="ib g">Profitable</span> ${names(proven)} return more than <b>$${SCALE}</b> for every $1 spent (ROAS ${SCALE} or better), so it's safe to push more budget.</li>`);}
  if(leaking.length){const t=leaking[0];ins.push(`<li><span class="ib r">Fix first</span> ${names(leaking)} ${leaking.length>1?"are":"is"} spending real money below target. ${mk(t)} burned <b>${usd(t.spend_usd)}</b> at just <b>${t.cr.toFixed(1)}%</b> CR and <b>${t.roas.toFixed(2)}×</b> ROAS, so fix the page or creative before adding budget.</li>`);}
  if(untapped.length){ins.push(`<li><span class="ib n">Untapped</span> ${names(untapped)} convert well on almost no ad spend, so they're worth a small test campaign.</li>`);}
  if(!ins.length) ins.push(`<li>No standout signals today. Spend and conversion are broadly in line across markets.</li>`);
  box.innerHTML=`<div class="sub-note">Each bubble = a market · x = 7-day spend · y = CR · size = sessions · color = ROAS (${SD.g} ≥1.7 ${SD.a} ≥1.1 ${SD.r} <1.1 ${SD.m} no spend) · <b>top-left = high CR + low spend = scale here</b></div>
    <div class="opp-grid">
      <div class="chartbox" style="height:440px"><canvas id="oppc"></canvas></div>
      <div class="opp-right">
        <div class="panel"><h3 class="cardh">Scale these — ≥${goal}% CR, lowest spend</h3><div class="opplist">${list}</div></div>
        <div class="panel"><h3 class="cardh">What it's telling you today · ${S.date}</h3><ul class="oppnow">${ins.join("")}</ul></div>
      </div>
    </div>
    <div class="panel oppread-box"><h3 class="cardh">How to read this map</h3>
      <ul class="oppread">
        <li><b>Each circle is a market</b> (country).</li>
        <li><b>Left → right = ad spend</b> over the last 7 days. Further right = you spent more.</li>
        <li><b>Bottom → top = conversion rate</b> (share of visitors who buy). Higher is better — the green dashed line is your <b>${goal}% goal</b>.</li>
        <li><b>Circle size = traffic</b> (sessions). Bigger circle = more visitors.</li>
        <li><b>Circle color = ROAS</b> (dollars back per $1 spent): ${SD.g} profitable ≥1.7 · ${SD.a} ok ≥1.1 · ${SD.r} losing &lt;1.1 · ${SD.m} no ad spend.</li>
        <li><b>Top-left is the sweet spot</b> — high conversion on low spend: it's working and you're barely paying, so scale it. Bottom-right = paying a lot for weak conversion = wasteful.</li>
      </ul></div>`;
  const goalLine={id:"og",afterDatasetsDraw(c){const{ctx,chartArea:a,scales:{y}}=c;const yy=y.getPixelForValue(goal);if(yy<a.top||yy>a.bottom)return;
    ctx.save();ctx.strokeStyle="#16A34A";ctx.setLineDash([5,4]);ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(a.left,yy);ctx.lineTo(a.right,yy);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#16A34A";ctx.font="600 10.5px 'Geist Mono',monospace";ctx.textAlign="left";ctx.fillText(goal+"% goal",a.left+5,yy-4);ctx.restore();}};
  const labelPts={id:"ol",afterDatasetsDraw(c){const{ctx}=c;const m=c.getDatasetMeta(0);ctx.save();ctx.font="600 10px 'Geist',sans-serif";ctx.fillStyle="#15131A";ctx.textAlign="center";
    m.data.forEach((pt,i)=>{const r=pts[i];if(r.cr>=goal||r.sessions>=1800) ctx.fillText(r.market,pt.x,pt.y-pt.options.radius-3);});ctx.restore();}};
  _charts.push(new Chart($("#oppc",box),{type:"bubble",data:{datasets:[{data,backgroundColor:pts.map(r=>colFor(r)+"C0"),borderColor:pts.map(colFor),borderWidth:1.2}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>{const r=pts[i.dataIndex];return ` ${r.market}: ${r.cr.toFixed(1)}% CR · ${usd(r.spend_usd)} spend · ${num(r.sessions)} sess · ROAS ${r.spend_usd<1?'—':r.roas.toFixed(2)}`;}}}},
      scales:{x:{title:{display:true,text:"7-day spend ($)"},min:0,ticks:{callback:v=>"$"+(v>=1000?(v/1000)+"k":v)},grid:{color:"#F1EFF5"}},
              y:{title:{display:true,text:"Conversion rate (%)"},min:0,ticks:{callback:v=>v+"%"},grid:{color:"#F1EFF5"}}}},
    plugins:[goalLine,labelPts]}));
}

/* ═══════════════════════ CAMPAIGNS ═══════════════════════ */
let CP={tab:"all", sortCol:"spend_usd", sortDir:-1};
async function renderCampaigns(view){
  const d=await getJSON(`/api/campaigns?date=${S.date}`);
  view.innerHTML=`<div class="tabs" id="cptabs" role="tablist"></div><div id="cpview"></div>`;
  const tabs=[["all",`All campaigns (${d.campaigns.length})`],
              ["cbo",`Super CBO · ad sets (${d.cbo_adsets.length})`],
              ["abo",`ABO · ad sets (${d.abo_adsets.length})`]];
  const tb=$("#cptabs",view);
  tabs.forEach(([k,l])=>{ const b=document.createElement("button"); b.className="tab"; b.setAttribute("aria-selected",String(k===CP.tab));
    b.textContent=l; b.onclick=()=>{ CP.tab=k; CP.sortCol="spend_usd"; CP.sortDir=-1;
      tb.querySelectorAll(".tab").forEach((x,i)=>x.setAttribute("aria-selected",String(tabs[i][0]===CP.tab))); cpBody(view,d); };
    tb.appendChild(b); });
  cpBody(view,d);
}
function cpBody(view,d){ const box=$("#cpview",view);
  if(CP.tab==="all") cpAll(box,d); else cpAdsets(box,d, CP.tab==="cbo"?d.cbo_adsets:d.abo_adsets, CP.tab); }
function cpSort(rows,txtCol){ const sc=CP.sortCol,dir=CP.sortDir;
  const isStr = sc===txtCol || sc==="campaign" || sc==="started" || sc==="label" || sc==="countries";
  return rows.slice().sort((a,b)=> isStr ? ((a[sc]||"")<(b[sc]||"")?-dir:(a[sc]||"")>(b[sc]||"")?dir:0) : ((Number(a[sc])||0)-(Number(b[sc])||0))*dir); }
function cpHead(COLS,txtCol){ const sc=CP.sortCol,dir=CP.sortDir;
  return COLS.map(([c,l])=>{const on=sc===c; return `<th class="${c===txtCol?'':'num'}" data-c="${c}" ${on?`aria-sort="${dir>0?'ascending':'descending'}"`:''}>${l}<span class="ar">${on?(dir>0?'▲':'▼'):''}</span></th>`;}).join(""); }
function cpWire(box,render){ box.querySelectorAll("#cptbl thead th").forEach(th=>{ th.onclick=()=>{ const c=th.dataset.c;
  if(CP.sortCol===c) CP.sortDir*=-1; else {CP.sortCol=c; CP.sortDir=(c==="campaign"||c==="label"||c==="countries")?1:-1;} render(); }; }); }
// `newish` (the just-launched ABO) is never flagged red — too early to judge — but still earns green if it scales.
const cpRowCls=(r,d,newish)=> r.spend_usd>=1 && r.roas>=d.scale_thr ? "win" : (!newish && r.spend_usd>=1 && r.roas<=d.kill_thr ? "lose" : "");

function cpAll(box,d){
  const COLS=[["campaign","Campaign"],["started","Started"],["budget_usd","Budget"],["spend_usd","Spend 7d"],["revenue_usd","Revenue 7d"],["roas","ROAS"],["yday","Yday"],["today","Today"]];
  const rows=cpSort(d.campaigns,"campaign");
  const cell=(r,c)=>{
    if(c==="campaign") return `<td class="txt">${campLink(r.campaign,r.ads_url)}${r.off?` <span class="offpill"${r.last_active?` title="last active ${r.last_active}"`:''}>killed</span>`:''}</td>`;
    if(c==="started") return `<td class="num sub" style="white-space:nowrap">${fmtStart(r.started)}</td>`;
    if(c==="budget_usd") return `<td class="num">${r.budget_usd==null?'—':usd(r.budget_usd)}</td>`;
    if(c==="spend_usd") return `<td class="num">${usd(r.spend_usd)}</td>`;
    if(c==="revenue_usd") return `<td class="num">${usd(r.revenue_usd)}</td>`;
    if(c==="roas") return r.spend_usd<1?`<td class="num zero">—</td>`:`<td class="num ${r.off?'sub':roasCls(r.roas)}">${r.roas.toFixed(2)}</td>`;
    if(c==="yday") return `<td class="num sub">${r.yday?r.yday.toFixed(2):'—'}</td>`;
    return `<td class="num sub">${r.today?r.today.toFixed(2):'—'}</td>`;
  };
  const body=rows.map(r=>`<tr class="${r.off?'off':cpRowCls(r,d,/ABO/i.test(r.campaign))}">${COLS.map(([c])=>cell(r,c)).join("")}</tr>`).join("");
  const act=rows.filter(r=>!r.off);
  const tSpend=act.reduce((s,r)=>s+r.spend_usd,0), tRev=act.reduce((s,r)=>s+r.revenue_usd,0), bRoas=tSpend?tRev/tSpend:0;
  const foot=`<tr><td class="tot-label">Σ Active</td><td class="num"></td><td class="num">—</td><td class="num">${usd(tSpend)}</td><td class="num">${usd(tRev)}</td><td class="num ${roasCls(bRoas)}">${bRoas.toFixed(2)}</td><td class="num"></td><td class="num"></td></tr>`;
  const off=d.campaigns.filter(r=>r.off);
  const wins=act.filter(r=>r.spend_usd>=1&&r.roas>=d.scale_thr).sort((a,b)=>b.roas-a.roas);
  const read=`<b>${act.length}</b> active localized campaign${act.length!==1?'s':''} ran over the last 7 days at a blended <b>${bRoas.toFixed(2)}×</b>${off.length?`, plus <b>${off.length}</b> killed last week (${off.map(r=>r.campaign).join(", ")})`:''}. ${wins.length?`<b>${wins.length}</b> ${wins.length===1?'is':'are'} scaling (≥${d.scale_thr}×), led by <b>${wins[0].campaign}</b> at ${wins[0].roas.toFixed(2)}×`:`None clear the ${d.scale_thr}× scale line`}.`;
  box.innerHTML=`${insightCard(read)}<div class="sub-note">Active = last 7 days · <span class="offpill">killed</span> = had spend then stopped — showing its final active week · ${SD.g} ROAS ≥${d.scale_thr} ${SD.r} ≤${d.kill_thr} · click a row for the daily breakdown · the campaign name opens Ads Manager · click headers to sort</div>
    <div class="tablewrap"><table id="cptbl"><thead><tr>${cpHead(COLS,"campaign")}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>`;
  cpWire(box,()=>cpAll(box,d));
  box.querySelectorAll("#cptbl tbody tr").forEach((tr,i)=>{ if(!rows[i])return; tr.style.cursor="pointer";
    tr.onclick=e=>{ if(e.target.closest("a"))return; openCampaignDrawer(rows[i]); }; });
}

function cpAdsets(box,d,rows0,which){
  const COLS=[["label","Ad set"],["countries","Countries"],["budget_usd","Budget"],["spend_usd","Spend 7d"],["revenue_usd","Revenue 7d"],["roas","ROAS"],["impressions","Impressions"]];
  const rows=cpSort(rows0,"label");
  const cell=(r,c)=>{
    if(c==="label") return `<td class="txt">${r.label}</td>`;
    if(c==="countries") return `<td class="txt sub">${r.countries||'—'}</td>`;
    if(c==="budget_usd") return `<td class="num">${r.budget_usd==null?'—':usd(r.budget_usd)}</td>`;
    if(c==="spend_usd") return `<td class="num">${usd(r.spend_usd)}</td>`;
    if(c==="revenue_usd") return `<td class="num">${usd(r.revenue_usd)}</td>`;
    if(c==="roas") return r.spend_usd<1?`<td class="num zero">—</td>`:`<td class="num ${roasCls(r.roas)}">${r.roas.toFixed(2)}</td>`;
    return `<td class="num">${num(r.impressions)}</td>`;
  };
  const body=rows.length?rows.map(r=>`<tr class="${cpRowCls(r,d,which==="abo")}">${COLS.map(([c])=>cell(r,c)).join("")}</tr>`).join("")
    :`<tr><td class="empty" colspan="7">No ad sets delivering on ${S.date}.</td></tr>`;
  const tSpend=rows.reduce((s,r)=>s+r.spend_usd,0), tRev=rows.reduce((s,r)=>s+r.revenue_usd,0), tImp=rows.reduce((s,r)=>s+(r.impressions||0),0), bRoas=tSpend?tRev/tSpend:0;
  const foot=rows.length?`<tr><td class="tot-label">Σ Blended</td><td class="num"></td><td class="num"></td><td class="num">${usd(tSpend)}</td><td class="num">${usd(tRev)}</td><td class="num ${roasCls(bRoas)}">${bRoas.toFixed(2)}</td><td class="num">${num(tImp)}</td></tr>`:"";
  const nm=which==="cbo"?"Super CBO":"ABO";
  const wins=rows0.filter(r=>r.spend_usd>=1&&r.roas>=d.scale_thr).sort((a,b)=>b.roas-a.roas);
  const note=which==="abo"?" · newly launched Jun 2026 — ROAS still settling":" · CBO: budget self-allocates, so trim losers rather than scale";
  const read=`<b>${nm}</b> ran <b>${rows0.length}</b> language ad sets at a blended <b>${bRoas.toFixed(2)}×</b> over 7 days${wins.length?`. Best performer: <b>${wins[0].label}</b> at ${wins[0].roas.toFixed(2)}×`:''}.`;
  box.innerHTML=`${insightCard(read)}<div class="sub-note">L7D · per language ad set · ${SD.g} ROAS ≥${d.scale_thr} ${SD.r} ≤${d.kill_thr}${note} · click headers to sort</div>
    <div class="tablewrap"><table id="cptbl"><thead><tr>${cpHead(COLS,"label")}</tr></thead><tbody>${body}</tbody>${foot?`<tfoot>${foot}</tfoot>`:''}</table></div>`;
  cpWire(box,()=>cpAdsets(box,d,rows0,which));
}

/* ═══════════════════════ CREATIVE ═══════════════════════ */
async function renderCreative(view){
  const d=await getJSON(`/api/creative?date=${S.date}`);
  const top=d.ads[0], above=d.ads.filter(a=>a.roas>=1.7).length, below=d.ads.filter(a=>a.roas<=1.1).length;
  const crRead=d.ads.length ? `The top creative by spend is <b>${(top.ad_name||'').slice(0,46)}</b> at <b>${top.roas.toFixed(2)}×</b> ROAS. Of <b>${d.ads.length}</b> live creatives, <b>${above}</b> are profitable (1.7× or better) and <b>${below}</b> are under 1.1×, so those are the ones to refresh or cut.` : `No creatives cleared the spend floor for ${S.date}.`;
  view.innerHTML=`<div class="sec">Top localized creatives — L7D</div>
    ${insightCard(crRead)}
    <div class="sub-note">Ranked by 7-day spend (min spend floor). Ads of paused campaigns excluded.</div>
    <div class="creative-grid">${d.ads.map(a=>`
      <div class="cre-card">
        ${a.thumb?`<img class="cre-thumb" loading="lazy" src="${a.thumb}" alt="">`:`<div class="cre-noimg">no thumbnail<br>(stored on next snapshot)</div>`}
        <div class="cre-body"><div class="cre-name" title="${a.ad_name}">${a.ad_name}</div>
        <div class="cre-stats"><span class="${roasCls(a.roas)}">ROAS ${a.roas.toFixed(2)}</span> · ${usd(a.spend_usd)}</div></div>
      </div>`).join("") || `<div class="empty">No creatives for ${S.date}.</div>`}</div>`;
}

/* ═══════════════════════ THE PLAN ═══════════════════════ */
async function renderPlan(view){
  const [notes,sd]=await Promise.all([getJSON("/api/notes"),getJSON(`/api/scorecard?date=${S.date}`)]);
  const K=l=>(sd.kpis||[]).find(k=>k.label.toLowerCase().includes(l))||{};
  const P=l=>(sd.progress||[]).find(p=>p.label.toLowerCase().includes(l))||{pct:0};
  const _rev=K("revenue"),_roas=K("roas"),_mk=K("market");
  const planRead=`The localized business is <b>${P("revenue").pct}%</b> of the way to the $40k/day revenue goal, running at <b>${Number(_roas.value).toFixed(2)} ROAS</b> against a 1.7 target, with <b>${_mk.value} of ${_mk.den}</b> markets at 6% CR and spend at about <b>${P("spend").pct}%</b> of target. The plan follows from that: fix conversion first (moves 1 and 2), then scale the proven low-spend markets (move 3).`;
  const moves=[["1","Translate Top 50 winning statics","Re-cut the proven LEM / Rose static winners natively for FR, DE, IT & ES."],
               ["2","Redo & QA the website + landing pages","Fix the half-translated stores & LPs holding CR below 6% in the big markets."],
               ["3","Launch high-CR / low-spend markets","Stand up dedicated campaigns where CR is high and spend is tiny (see Markets → opportunity)."]];
  view.innerHTML=`<div class="sec">The Goal & The Plan</div>
    ${insightCard(planRead,"Where things stand today")}
    <div class="panel"><b>Goal:</b> every Top-15 market to 6% CR, then scale localized spend ~7× at ≥1.7 ROAS — taking localized revenue toward $40k/day (Better tier).</div>
    <div class="moves">${moves.map(([n,h,b])=>`<div class="move"><span class="n">${n}</span><h4>${h}</h4><div class="sub-note" style="margin:0">${b}</div></div>`).join("")}</div>
    <div class="sec">This week</div>
    <div class="plan-grid">
      ${noteBox("what_we_did","What we did — last 7 days", notes.what_we_did)}
      ${noteBox("the_move","The move this week", notes.the_move)}
    </div>`;
  ["what_we_did","the_move"].forEach(k=>{
    const ta=$(`#nt_${k}`,view), btn=$(`#sv_${k}`,view);
    btn.onclick=async()=>{ await postJSON("/api/notes",{key:k,value:ta.value}); btn.textContent="Saved ✓"; btn.classList.add("done"); setTimeout(()=>{btn.textContent="Save";btn.classList.remove("done");},1400); };
  });
}
function noteBox(k,title,val){
  return `<div class="notebox"><h3>${title}</h3><textarea id="nt_${k}" placeholder="Type this week's notes…">${(val||"").replace(/</g,"&lt;")}</textarea>
    <div class="saverow"><button class="savebtn" id="sv_${k}">Save</button><span class="sub-note" style="margin:0">saved to the database</span></div></div>`;
}

/* ═══════════════════════ TRANSLATIONS (QA) ═══════════════════════ */
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
let TQ={page:null,lang:null};
async function renderTranslations(view){
  const d=await getJSON("/api/translations");
  if(!d.pages||!d.pages.length){ view.innerHTML=`<div class="sec">Translation quality</div><div class="empty">No QA results yet. Run <code>python3 -m localization.translation_qa.fetch</code> then <code>… grade</code>.</div>`; return; }
  // default selection = weakest cell
  if(!TQ.page || !(d.cells[TQ.page]&&d.cells[TQ.page][TQ.lang])){ let w=null;
    d.pages.forEach(p=>d.langs.forEach(l=>{const c=d.cells[p.key][l]; if(c&&(!w||c.quality<w.q)) w={page:p.key,lang:l,q:c.quality};}));
    if(w){TQ.page=w.page;TQ.lang=w.lang;} }
  const k=d.kpis;
  const langHead=d.langs.map(l=>`<th class="num">${l.toUpperCase()}</th>`).join("");
  const body=d.pages.map(p=>{
    const tds=d.langs.map(l=>{const c=d.cells[p.key][l];
      if(!c) return `<td class="tqcell na" title="not published in ${d.lang_names[l]||l}">—</td>`;
      const cls=c.quality>=85?"g":c.quality>=70?"a":"r";
      const crit=c.n_critical>0?`<span class="tqcrit" title="${c.n_critical} untranslated body string(s)"></span>`:"";
      const sel=(TQ.page===p.key&&TQ.lang===l)?" sel":"";
      return `<td class="tqcell ${cls}${sel}" data-p="${p.key}" data-l="${l}" title="${d.lang_names[l]||l}: quality ${c.quality}/100 · ${c.completeness}% translated — click for the issue list">${crit}<span class="tqq">${c.quality}</span><span class="tqc">${c.completeness}% transl.</span></td>`;}).join("");
    return `<tr><td class="txt tqp">${p.label}<span class="tqkind">${p.kind}</span></td>${tds}</tr>`;
  }).join("");
  view.innerHTML=`<div class="sec">Translation quality</div>
    ${insightCard(`${esc(d.read)} <span style="color:var(--mut2)">Last checked ${d.checked_at}.</span>`,"Translation status")}
    <div class="tstats">
      <div class="tstat"><div class="tl">Avg quality</div><div class="tvv">${k.avg_quality}<span class="tu"> /100</span></div></div>
      <div class="tstat"><div class="tl">Avg completeness</div><div class="tvv">${k.avg_completeness}%</div></div>
      <div class="tstat"><div class="tl">Critical issues</div><div class="tvv">${k.critical}</div></div>
      <div class="tstat"><div class="tl">Checks</div><div class="tvv">${k.checked}</div></div>
    </div>
    <div class="sub-note">Each cell = one page in one language, with <b>two translation metrics</b> (not conversion rates): the <b>big number</b> is the <b>Quality</b> score /100 (${SD.g} ≥85 · ${SD.a} 70–84 · ${SD.r} &lt;70), the <b>small number</b> is <b>% translated</b> (completeness). Red dot = untranslated body copy · <b>click a cell</b> for the issue list · <b>—</b> = page not published in that language.</div>
    <div class="tablewrap"><table class="tqheat"><thead><tr><th>Page</th>${langHead}</tr></thead><tbody>${body}</tbody></table></div>
    <div id="tqdetail"></div>
    <div class="note">Objective checks graded against the EN master + <code>glossary-and-tone.md</code>: untranslated English leftovers &amp; locale formatting. On-demand — refresh with <code>python3 -m localization.translation_qa.fetch &amp;&amp; … grade</code>.</div>`;
  view.querySelectorAll(".tqcell[data-p]").forEach(td=>{ td.onclick=()=>{ TQ.page=td.dataset.p; TQ.lang=td.dataset.l;
    view.querySelectorAll(".tqcell").forEach(x=>x.classList.remove("sel")); td.classList.add("sel"); tqDetail(view,d);
    $("#tqdetail",view).scrollIntoView({behavior:"smooth",block:"nearest"}); }; });
  tqDetail(view,d);
}
let TQF="issues";  // segment filter
async function tqDetail(view,d){
  const box=$("#tqdetail",view); const c=(d.cells[TQ.page]||{})[TQ.lang];
  if(!c){ box.innerHTML=""; return; }
  const p=d.pages.find(x=>x.key===TQ.page), ln=d.lang_names[TQ.lang]||TQ.lang;
  box.innerHTML=`<div class="panel tqd">
    <div class="tqd-h">
      <div><h3 class="cardh" style="margin:0">${p.label} · ${ln}</h3>
        <div class="sub-note" style="margin:6px 0 0">Quality <b>${c.quality}/100</b> · ${c.completeness}% complete · ${c.n_issues} issue${c.n_issues!==1?'s':''} (${c.n_critical} critical) · checked ${c.checked_at}</div></div>
      <a class="srcbtn" href="${c.source_url}" target="_blank" rel="noopener noreferrer">Open page <span class="ext">↗</span></a></div>
    <div class="insight" style="margin:14px 0"><span class="insight-ic">${svg('spark')}</span><div class="insight-tx"><span class="lbl">Verdict</span>${esc(c.summary)}</div></div>
    <div id="segwrap"><div class="loading">Loading text…</div></div></div>`;
  const sd=await getJSON(`/api/translation_segments?page=${TQ.page}&lang=${TQ.lang}`);
  renderSegments(view,sd);
}
function segVerdict(s){
  if(s.status==="untranslated") return {cls:"r",txt:"✗ Not translated"};
  if(s.status==="missing") return {cls:"a",txt:"⚠ Missing in translation"};
  if(s.status==="added") return {cls:"m",txt:"➕ Extra (not in EN)"};
  if(s.status==="shared") return {cls:"muted",txt:"— shared"};
  if(s.rating){ const cls=s.rating>=4?"g":s.rating>=3?"a":"r"; return {cls,txt:"★".repeat(s.rating)+"☆".repeat(5-s.rating),note:s.note}; }
  return {cls:"g",txt:"✓ Translated"};
}
function segShow(s){
  if(TQF==="all") return true;
  if(TQF==="issues") return ["untranslated","missing","added"].includes(s.status) || (s.status==="translated"&&s.rating&&s.rating<=2);
  if(TQF==="untranslated") return s.status==="untranslated";
  if(TQF==="missing") return s.status==="missing";
  if(TQF==="reviewed") return !!s.rating;
  return true;
}
function renderSegments(view,sd){
  const wrap=$("#segwrap",view); const c=sd.counts||{};
  const segs=sd.segments.filter(segShow);
  const tabs=[["issues",`Issues (${(c.untranslated||0)+(c.missing||0)+(c.added||0)})`],
              ["all",`Full text (${sd.segments.length})`],
              ["untranslated",`Untranslated (${c.untranslated||0})`],
              ["missing",`Missing (${c.missing||0})`],
              ["reviewed",`Deep-reviewed (${sd.reviewed||0})`]];
  const bar=tabs.map(([k,l])=>`<button class="tab seg-filter" data-f="${k}" aria-selected="${k===TQF}">${l}</button>`).join("");
  const rows=segs.length? segs.map(s=>{const v=segVerdict(s);
    return `<tr class="seg ${s.status}"><td class="segn">${s.idx+1}</td>
      <td class="segen">${esc(s.en_text)||'<span class="muted">—</span>'}</td>
      <td class="segloc">${esc(s.loc_text)||'<span class="muted">—</span>'}</td>
      <td class="segv"><span class="vb ${v.cls}">${v.txt}</span>${v.note?`<span class="vnote">${esc(v.note)}</span>`:''}</td></tr>`;}).join("")
    : `<tr><td class="empty" colspan="4">Nothing under this filter</td></tr>`;
  const banner=(sd.approx_align && (TQF==="all"))
    ? `<div class="segwarn">⚠ This page is <b>restructured</b> in translation, so the line-by-line pairing below is <b>approximate</b>. The <b>Issues / Untranslated / Missing</b> filters are exact. Ask Claude for a <b>deep AI review</b> of this page for accurate line-by-line verdicts.</div>` : "";
  wrap.innerHTML=`<div class="segfilters">${bar}<span class="segleg">${sd.reviewed||0} of ${c.translated||0} translated lines deep-reviewed</span></div>${banner}
    <div class="tablewrap segtable"><table><thead><tr><th class="segn">#</th><th>English (source)</th><th>${sd.lang_name}</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  wrap.querySelectorAll(".seg-filter").forEach(b=>b.onclick=()=>{TQF=b.dataset.f; renderSegments(view,sd);});
}

if(window.__ENC__) showLogin(); else init();
