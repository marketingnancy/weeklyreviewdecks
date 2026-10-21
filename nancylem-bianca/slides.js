/* Per-slide renderers. Each returns an HTML string; demographic slides also
   register a chart mount via LEMSlides.mount(). Bound to the deck.json shapes. */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STATUS = { good: "good", bad: "bad", neutral: "" };

  function header(slide, meta, opts) {
    opts = opts || {};
    const week = meta.week_no ? ` · WEEK ${meta.week_no}` : "";
    const owner = slide.owner ? `<span class="s-owner">Owner: ${esc(slide.owner)}</span>` : "";
    return `
      <p class="s-kicker">${esc(slide.kicker || "")}</p>
      ${opts.title === false ? "" : `<h1 class="s-title">${esc(slide.title || "")}</h1>`}
      <div class="s-meta">
        <div class="s-thru">DATA THRU <b>${esc(meta.data_thru || "—")}</b>${week}</div>
        ${owner}
      </div>`;
  }

  // ── slide 1: goal (dark) ──────────────────────────────────────────────────
  function goal(slide) {
    const phases = slide.phases.map(p => `
      <div class="goal-phase">
        <div class="gp-tag">${esc(p.tag)}</div>
        <div class="gp-ebit">${esc(p.ebit)}</div>
        <div class="gp-unit">EBIT / day</div>
        <div class="gp-note">${esc(p.note)}</div>
      </div>`).join("");
    const fns = slide.functions.map(f => `
      <div class="goal-fn${f.active ? " on" : ""}">
        <div class="gf-name">${esc(f.name)}</div>
        <div class="gf-sub">${esc(f.sub)}</div>
      </div>`).join("");
    return `
      <p class="s-kicker">${esc(slide.kicker)}</p>
      <h1 class="s-title goal-title">${esc(slide.title)}</h1>
      <div class="goal-phases">${phases}</div>
      <div class="goal-fnlabel">THE FOUR FUNCTIONS — EACH AN OWNER, A NUMBER, REPORTED DAILY</div>
      <div class="goal-fns">${fns}</div>
      <div class="goal-footer">${esc(slide.footer)}</div>`;
  }

  // ── slide 2: scorecard ────────────────────────────────────────────────────
  function scorecard(slide, meta) {
    const sc = slide.scorecard;
    const cols = sc.cols.map(c => `<th>${esc(c)}</th>`).join("");
    const rows = sc.rows.map(r => {
      const sub = r.metric.startsWith("·");
      const vals = r.vals.map((v, i) => {
        const st = STATUS[(r.status || [])[i]] || "";
        return `<td class="num ${st}">${esc(v)}</td>`;
      }).join("");
      const tgt = r.target != null ? esc(r.target) : "";
      return `<tr class="${sub ? "sub" : ""}"><th class="metric">${esc(r.metric)}</th>${vals}<td class="num tgt">${tgt}</td></tr>`;
    }).join("");
    return `
      ${header(slide, meta)}
      ${slide.binding_constraint ? `<div class="bc-box">${esc(slide.binding_constraint)}</div>` : ""}
      <table class="scorecard">
        <thead><tr><th class="metric">LEM METRIC</th>${cols}<th class="tgt">TARGET</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="s-foot-note">Currency in USD · Revenue shown both ways — Shopify = all-channel total_sales, Meta = attributed (Glued) · Orders, % of Overall &amp; Repeat/NC = Shopify all-channel · Spend &amp; ROAS = Meta attributed</div>`;
  }

  // ── slides 3–9: campaign tables ───────────────────────────────────────────
  function campaigns(slide, meta) {
    const rows = slide.rows.map(r => {
      const rs = r.roas_status || [];
      const cell = (v, i) => `<td class="num ${STATUS[rs[i]] || ""}">${typeof v === "number" ? v.toFixed(2) : esc(v)}</td>`;
      const nameCell = r.ads_manager_url
        ? `<a class="cmplink" href="${esc(r.ads_manager_url)}" target="_blank" rel="noopener" title="${esc(r.campaign_full || r.campaign)} — open in Ads Manager">${esc(r.campaign)}</a>`
        : esc(r.campaign);
      return `<tr>
        <td class="cmp">${nameCell}</td>
        <td class="num">${esc(r.budget)}</td>
        ${cell(r.roas_l30d, 0)}${cell(r.roas_l7d, 1)}${cell(r.roas_yday, 2)}
        <td class="num">${esc(r.spend_l7d)}</td>
        <td><span class="act act-${esc(r.bucket || slide.bucket)}">${esc(slide.bucket_label)}</span></td>
      </tr>`;
    }).join("");
    const empty = slide.rows.length ? "" : `<tr><td colspan="7" class="empty">No campaigns in this bucket.</td></tr>`;
    return `
      ${header(slide, meta, { title: false })}
      <div class="funnel-band ${esc(slide.funnel)}">${esc(slide.funnel_label)}</div>
      <div class="cmp-head">
        <h1 class="s-title cmp-bucket">${esc(slide.bucket_label)}</h1>
        <span class="cmp-target">Target ROAS: ${esc(slide.target)}</span>
      </div>
      <table class="ctable">
        <thead><tr><th>Campaign</th><th>Budget</th><th>L30D ROAS</th><th>L7D ROAS</th><th>Yesterday ROAS</th><th>L7D Spend</th><th>Action</th></tr></thead>
        <tbody>${rows}${empty}</tbody>
      </table>
      <div class="s-foot-note">${esc(slide.footnote || "")} · ${slide.count} campaigns</div>`;
  }

  // ── slide 10: landing page analysis ───────────────────────────────────────
  function lp(slide, meta) {
    const win = w => `<td class="num">${esc(w.spend)}</td><td class="num">${typeof w.roas === "number" ? w.roas.toFixed(2) : esc(w.roas)}</td><td class="num">${esc(w.cvr)}</td>`;
    const rows = slide.rows.map(r => `<tr>
        <td class="cmp">${esc(r.lp)}</td>${win(r.yday)}${win(r.l7d)}${win(r.l30d)}
      </tr>`).join("");
    const empty = slide.rows.length ? "" : `<tr><td colspan="10" class="empty">No landing-page data yet.</td></tr>`;
    return `
      ${header(slide, meta)}
      <table class="lptable">
        <thead>
          <tr class="grp"><th rowspan="2">Landing Page</th><th colspan="3">YESTERDAY</th><th colspan="3">L7D</th><th colspan="3">L30D</th></tr>
          <tr class="sub"><th>Spend</th><th>ROAS</th><th>CVR</th><th>Spend</th><th>ROAS</th><th>CVR</th><th>Spend</th><th>ROAS</th><th>CVR</th></tr>
        </thead>
        <tbody>${rows}${empty}</tbody>
      </table>
      <div class="s-foot-note">${esc(slide.footnote || "")}</div>`;
  }

  // ── slides 11–13: creative grids ──────────────────────────────────────────
  function creative(slide, meta) {
    const cards = slide.cards.map(c => `
      <div class="cc-card">
        <div class="cc-thumb">${c.thumb ? `<img src="${esc(c.thumb)}" loading="lazy" alt="">` : `<div class="cc-noimg">${esc(c.asset_type || "AD")}</div>`}
          <span class="cc-type">${esc(c.asset_type || "")}</span></div>
        <div class="cc-body">
          <div class="cc-name" title="${esc(c.ad_name)}">${esc(c.ad_name)}</div>
          <div class="cc-cmp">${c.ads_manager_url ? `<a class="cmplink" href="${esc(c.ads_manager_url)}" target="_blank" rel="noopener" title="${esc(c.campaign)} — Ads Manager">${esc(c.campaign)}</a>` : esc(c.campaign)}</div>
          <div class="cc-stats"><span class="cc-roas">ROAS ${typeof c.roas === "number" ? c.roas.toFixed(2) : esc(c.roas)}</span><span class="cc-pur">${esc(c.purchases)} purchases</span></div>
        </div>
      </div>`).join("");
    const empty = slide.cards.length ? "" : `<div class="empty">No ads meet the threshold yet.</div>`;
    return `
      ${header(slide, meta)}
      <div class="funnel-band ${esc(slide.funnel)}">${esc(slide.funnel_label)}</div>
      <div class="cc-grid">${cards}${empty}</div>
      <div class="s-foot-note">${esc(slide.footnote || "")}</div>`;
  }

  // ── slides 14–17: age & gender (from NANCY LEM.xlsx · Campaign Breakdown) ───
  function demographics(slide, meta) {
    if (!slide.available) {
      return `${header(slide, meta)}
        <div class="demo-panel"><div class="demo-unavail">
          <div class="du-title">Age &amp; gender data not loaded</div>
          <div class="du-sub">Populate it from the LEM workbook: <code>python3 -m scripts.gen_demographics</code>.</div>
        </div></div>`;
    }
    const src = `Best-converting age × gender per campaign · purchases · ${esc(slide.campaigns || "")} campaigns · source: ${esc(slide.source || "NANCY LEM.xlsx")}`;
    if (slide.view === "table") {
      const rows = slide.rows.map(r => `<tr>
          <td class="cmp">${r.ads_manager_url ? `<a class="cmplink" href="${esc(r.ads_manager_url)}" target="_blank" rel="noopener" title="${esc(r.campaign)} — Ads Manager">${esc(r.campaign)}</a>` : esc(r.campaign)}</td>
          <td class="seg good">${esc(r.best)}</td>
          <td class="num">${typeof r.best_roas === "number" ? r.best_roas.toFixed(2) : esc(r.best_roas)}</td>
          <td class="num">${esc(r.best_purch)}</td>
          <td class="seg bad">${esc(r.worst)}</td>
          <td class="num">${typeof r.worst_roas === "number" ? r.worst_roas.toFixed(2) : esc(r.worst_roas)}</td>
        </tr>`).join("");
      return `${header(slide, meta)}
        <div class="demo-srcline"><span class="demo-manual">from workbook${slide.updated ? " · " + esc(slide.updated) : ""}</span></div>
        <table class="demotable">
          <thead><tr><th>Campaign</th><th>Best audience</th><th>ROAS</th><th>Purchases</th><th>Worst audience</th><th>ROAS</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="s-foot-note">Best / worst age × gender segment per campaign · ${esc(slide.campaigns || "")} campaigns with data</div>`;
    }
    // chart view
    const cap = slide.funnel === "website_direct" ? "Website LP" : "Pre-Lander LP";
    return `${header(slide, meta)}
      <div class="demo-panel">
        <div class="demo-top">
          <div>
            <div class="demo-h">${esc(cap)}</div>
            <div class="demo-sub">${src}</div>
          </div>
          <span class="demo-manual">from workbook${slide.updated ? " · " + esc(slide.updated) : ""}</span>
        </div>
        <div class="demo-callouts">
          <div class="demo-co"><div class="dc-lbl">Top-converting age group</div><div class="dc-big">${esc(slide.highest ? slide.highest.b : "—")}</div><div class="dc-sub">${slide.highest ? esc(slide.highest.pct) + "% of best-segment purchases" : ""}</div></div>
          <div class="demo-co"><div class="dc-lbl">Dominant gender</div><div class="dc-big">${esc(slide.top_gender ? slide.top_gender.b : "—")}</div><div class="dc-sub">${slide.top_gender ? esc(slide.top_gender.pct) + "% of purchases" : ""}</div></div>
        </div>
        <div class="demo-charts">
          <div class="demo-chart"><div class="dch-h">Purchases % by Age Group</div><div class="dch-wrap"><canvas id="cv-age-${esc(slide.id)}"></canvas></div></div>
          <div class="demo-chart"><div class="dch-h">Purchases % by Gender</div><div class="dch-wrap"><canvas id="cv-gen-${esc(slide.id)}"></canvas></div></div>
        </div>
      </div>`;
  }

  // ── slide 18: decision ────────────────────────────────────────────────────
  function decision(slide, meta) {
    const did = slide.did.map(d => `<li>${esc(d)}</li>`).join("");
    const decs = slide.decisions.map(d => `<tr><td>${esc(d.decision)}</td><td class="own">${esc(d.owner)}</td><td class="when">${esc(d.by)}</td></tr>`).join("");
    return `
      ${header(slide, meta)}
      <div class="dec-boxes">
        <div class="dec-box"><div class="db-h">WHAT WE DID — LAST 7 DAYS</div><ul>${did}</ul></div>
        <div class="dec-box bc"><div class="db-h good">THE BINDING CONSTRAINT (from scorecard)</div><p>${esc(slide.binding_constraint)}</p></div>
      </div>
      <div class="dec-need">DECISIONS NEEDED FROM YOU TODAY</div>
      <table class="dectable">
        <thead><tr><th>Decision</th><th>Owner</th><th>By When</th></tr></thead>
        <tbody>${decs}</tbody>
      </table>`;
  }

  // ── Oct-2026 layout ───────────────────────────────────────────────────────
  const ownerPill = slide => slide.owner || OWNER ? `<span class="nx-owner">Owner: ${esc(slide.owner || OWNER)}</span>` : "";
  let OWNER = "";

  // screenshot panels (campaign attribution tables, landing pages); click an image to zoom
  function panels(slide) {
    const tags = (slide.tags || []).map(t => `<span class="nx-tag">${esc(t)}</span>`).join("");
    const ps = slide.panels.map(p => `
      <div class="nx-panel">
        ${p.title ? `<div class="nx-band">${esc(p.title)}</div>` : ""}
        <div class="nx-shot">${p.image ? `<img class="zoomable" src="${p.image}" alt="${esc(p.title || "")}">` : `<div class="empty">No image</div>`}</div>
      </div>`).join("");
    return `
      <div class="nx-head">
        <p class="s-kicker">${esc(slide.kicker || "")}</p>
        ${slide.title ? `<h1 class="nx-title">${esc(slide.title)}</h1>` : ""}
        <div class="nx-tags">${tags}</div>
      </div>
      ${ownerPill(slide)}
      <div class="nx-panels${slide.title ? " titled" : ""}">${ps}</div>
      <div class="nx-hint">Click a table to zoom</div>`;
  }

  // attribution windows: L7D ROAS by funnel + which window to use
  function attribution(slide) {
    const fr = slide.funnel_rows.map(r => `<tr class="${r.highlight ? "hl" : ""}">
        <td>${esc(r.window)}</td><td class="num">${esc(r.website)}</td><td class="num">${esc(r.prelander)}</td></tr>`).join("");
    const wr = slide.windows.map(w => `<tr>
        <td class="aw-name t-${esc(w.tone)}">${esc(w.name)}</td>
        <td><span class="aw-role t-${esc(w.tone)}">${esc(w.role)}</span>${w.role_sub ? `<div class="aw-sub t-${esc(w.tone)}">${esc(w.role_sub)}</div>` : ""}</td>
        <td class="aw-why">${w.why_b ? `<b>${esc(w.why_b)}</b> ` : ""}${esc(w.why)}</td></tr>`).join("");
    return `
      <p class="nx-kick-lav">${esc(slide.kicker)}</p>
      ${ownerPill(slide)}
      <h1 class="nx-big">${esc(slide.title)}<br>${esc(slide.title_2)}<span class="hl">${esc(slide.title_hl)}</span></h1>
      <div class="aw-grid">
        <div>
          <div class="nx-sublbl">L7D ROAS by funnel</div>
          <table class="aw-funnel"><thead><tr><th>Window</th><th>Website</th><th>Pre-Lander</th></tr></thead><tbody>${fr}</tbody></table>
          <div class="aw-be">Break-even = <b>${esc(slide.breakeven)}</b> · Below ${esc(slide.breakeven)} = losing money · Above ${esc(slide.breakeven)} = making money<br>${esc(slide.source)}</div>
        </div>
        <div>
          <div class="nx-sublbl">Which window to use — and why</div>
          <table class="aw-win"><thead><tr><th>Window</th><th>Role</th><th>Why not primary?</th></tr></thead><tbody>${wr}</tbody></table>
        </div>
      </div>
      <div class="nx-foot">${esc(slide.footnote || "")}</div>`;
  }

  // the three-step decision rule
  function rules(slide) {
    const box = b => `<div class="ru-box">
        <div class="ru-lbl">${esc(b.label)}</div>
        ${b.big ? `<div class="ru-big">${esc(b.big)}</div>` : ""}
        ${b.lines ? `<div class="ru-lines t-${esc(b.tone || "")}">${b.lines.map(esc).join("<br>")}</div>` : ""}
        ${b.verdict ? `<div class="ru-verdict t-${esc(b.tone || "")}">${esc(b.verdict)}</div>` : ""}
      </div>`;
    const cards = slide.steps.map(s => `
      <div class="ru-card${s.active ? " on" : ""}">
        <div class="ru-step">${esc(s.step)}</div>
        <div class="ru-name">${esc(s.name)}</div>
        <div class="ru-desc">${esc(s.desc)}</div>
        <div class="ru-boxes">${s.boxes.map(box).join("")}</div>
        <div class="ru-note">${esc(s.note)}</div>
      </div>`).join("");
    return `
      ${ownerPill(slide)}
      <h1 class="nx-big ru-title">${esc(slide.title)}</h1>
      <div class="ru-cards">${cards}</div>
      <div class="nx-foot">${esc(slide.footnote || "")}</div>`;
  }

  // a full-slide picture (e.g. the creative/copy matrix)
  function image(slide) {
    return `
      <div class="im-wrap"><img class="zoomable" src="${slide.image}" alt="${esc(slide.title || "")}"></div>`;
  }

  // testing campaigns awaiting approval
  function testing(slide) {
    const rows = slide.rows.map(r => `<tr>
        <td class="te-cmp">${esc(r.campaign)}</td>
        <td class="te-bud"><div class="te-bn">${esc(r.budget_note)}</div><div class="te-bt">${esc(r.budget)}</div></td>
        <td class="te-who">${esc(r.who)}</td>
        <td class="te-ang"><ul>${r.angles.map(a => `<li>${esc(a)}</li>`).join("")}</ul></td>
        <td class="te-ads">${r.adsets.map(a => `<div>- ${esc(a)}</div>`).join("")}</td>
      </tr>`).join("");
    const n = slide.rows.reduce((s, r) => s + r.adsets.length, 0);
    return `
      <h1 class="te-title">${esc(slide.title)}</h1>
      <div class="te-sum">${esc(slide.summary)}</div>
      <table class="te-table">
        <thead><tr><th>Campaign name</th><th>Budget</th><th>Who made it</th><th>Angle</th><th>Ad sets (${n})</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function openZoom(src) {
    const ov = document.createElement("div");
    ov.className = "zoom-ov";
    ov.innerHTML = `<img src="${src}" alt=""><button class="zoom-x" aria-label="Close">×</button>`;
    const close = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = e => { e.stopPropagation(); if (e.key === "Escape") close(); };   // no slide nav under the zoom
    ov.addEventListener("click", e => { if (e.target === ov || e.target.classList.contains("zoom-x")) close(); });
    ov.querySelector("img").addEventListener("click", e => e.currentTarget.classList.toggle("full"));
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(ov);
  }

  const RENDER = { goal, scorecard, campaigns, lp, creative, demographics, decision, panels, attribution, rules, image, testing };
  const DARK = { goal: 1, panels: 1, attribution: 1, rules: 1 };

  window.LEMSlides = {
    isDark(slide) { return !!DARK[slide.section]; },
    render(slide, meta, index, total) {
      OWNER = (meta && meta.owner) || "";
      const fn = RENDER[slide.section];
      const inner = fn ? fn(slide, meta) : `<div class="loading">Unknown slide: ${esc(slide.section)}</div>`;
      return inner + `<div class="s-page">${index + 1} / ${total}</div>`;
    },
    mount(slide) {
      document.querySelectorAll("#stage img.zoomable").forEach(img =>
        img.addEventListener("click", e => { e.stopPropagation(); openZoom(img.src); }));
      if (slide.section !== "demographics" || slide.view !== "chart" || !slide.available) return;
      const ageEl = document.getElementById("cv-age-" + slide.id);
      const genEl = document.getElementById("cv-gen-" + slide.id);
      if (ageEl && slide.age && slide.age.length) {
        LEMCharts.bar(ageEl, slide.age.map(a => a.b), slide.age.map(a => a.pct || 0), { pct: true, colors: "#d6457a" });
      }
      if (genEl && slide.gender && slide.gender.length) {
        const colors = slide.gender.map(g => (String(g.b).toLowerCase() === "male" ? "#e8a13a" : (String(g.b).toLowerCase() === "unknown" ? "#9d96b8" : "#d6457a")));
        LEMCharts.bar(genEl, slide.gender.map(g => g.b), slide.gender.map(g => g.pct || 0), { pct: true, max: 100, colors });
      }
    },
  };
})();
