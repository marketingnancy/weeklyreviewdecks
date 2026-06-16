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
      <div class="s-foot-note">Currency in USD · ROAS = Meta attributed</div>`;
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

  const RENDER = { goal, scorecard, campaigns, lp, creative, demographics, decision };

  window.LEMSlides = {
    isDark(slide) { return slide.section === "goal"; },
    render(slide, meta, index, total) {
      const fn = RENDER[slide.section];
      const inner = fn ? fn(slide, meta) : `<div class="loading">Unknown slide: ${esc(slide.section)}</div>`;
      return inner + `<div class="s-page">${index + 1} / ${total}</div>`;
    },
    mount(slide) {
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
