"use strict";
/* Plow Route UI: views, sheets, map, actions. Depends on core.js. */

const svg = (d, w = 2.2) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  nav: svg('<path d="M3 11l18-8-8 18-2-8z"/>'),
  cam: svg('<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>'),
  check: svg('<path d="M4 12l5 5L20 6"/>', 2.8),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.4),
  map: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', 2),
  flake: svg('<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5"/>', 2),
  cloud: svg('<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 7 18z"/>', 2),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
  up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 2.4),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 1.8),
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  share: svg('<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>'),
  msg: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  note: svg('<path d="M5 4h14v12l-5 4H5z"/><path d="M14 20v-4h5M8 9h8M8 13h5"/>'),
  target: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  fit: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  dots: svg('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  box: svg('<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>', 2),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>')
};

/* ---------- toast ---------- */
let toastT;
function toast(msg, ms = 3400) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
let confirmT;
function arm(key) { S.confirm = key; clearTimeout(confirmT); confirmT = setTimeout(() => { S.confirm = null; render(); }, 4000); render(); }
function armBtn(b, label) {
  if (b.dataset.armed === "1") return true;
  b.dataset.armed = "1"; b.classList.add("armed"); b.dataset.old = b.innerHTML; b.textContent = label;
  setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.classList.remove("armed"); b.innerHTML = b.dataset.old; } }, 4000);
  return false;
}

/* ---------- render ---------- */
let rafId = 0;
function render() { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(draw); }
const TABS = ["storm", "map", "clients", "records"];
function curTab() { const h = (location.hash || "#storm").slice(1); return TABS.includes(h) ? h : "storm"; }
function applyTheme() { const t = S.settings.theme; if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

function draw() {
  applyTheme();
  const t = curTab(), st = activeStorm();
  $("#brand-name").textContent = S.settings.biz || "Plow Route";
  $("#brand-sub").textContent = st ? stormTitle(st) : (S.settings.town || "");
  const pill = $("#pill");
  if (st) { pill.hidden = false; pill.className = "pill live"; pill.innerHTML = "<i></i>" + ((st.pass || 1) > 1 ? "Pass " + st.pass : "Live"); }
  else if (S.forecast && S.forecast.snow && Date.now() - S.forecast.at < 12 * 3600e3) { pill.hidden = false; pill.className = "pill snow"; pill.textContent = "Snow coming"; }
  else pill.hidden = true;
  $$(".tabs a").forEach(a => { if (a.dataset.tab === t) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("#mapwrap").hidden = t !== "map"; $("#view").hidden = t === "map";
  if (t === "map") { drawMap(); return; }
  $("#view").innerHTML = '<div class="col">' + (t === "clients" ? clientsView() : t === "records" ? recordsView() : stormView()) + "</div>";
}

/* ---------- storm tab ---------- */
function forecastCard() {
  const f = S.forecast, town = esc(S.settings.town || "your area");
  const link = `<a class="lnk" href="https://forecast.weather.gov/MapClick.php?lat=${homePt().lat.toFixed(4)}&lon=${homePt().lng.toFixed(4)}" target="_blank" rel="noopener">Full forecast</a>`;
  if (!f) return `<div class="fc"><div class="ico">${I.cloud}</div><div class="grow"><b class="t">${S.online ? "Checking the forecast…" : "Forecast needs a signal"}</b><span class="small muted">National Weather Service forecast for ${town}. ${link}</span></div></div>`;
  const stale = Date.now() - f.at > 6 * 3600e3;
  const periods = (f.periods || []).slice(0, 6).map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.short)}${p.temp != null ? ", " + esc(p.temp) + "°" : ""}${p.acc ? ` · <span class="sn">${esc(p.acc)}</span>` : ""}</span></li>`).join("");
  const ice = f.iceIn >= 0.05 ? ` Ice possible: plan to sand.` : "";
  return `<div class="fc ${f.snow ? "snow" : ""}">
    <div class="ico">${f.snow ? I.flake : I.cloud}</div>
    <div class="grow">
      <b class="t">${esc(f.headline)}</b>
      <span class="small ${stale ? "warn" : "muted"}">${stale ? "May be out of date. " : ""}National Weather Service, checked ${esc(fmtDay(f.at))} ${esc(fmtTime(f.at))}.${ice}</span>
      <details ${S.open.has("fc") ? "open" : ""} data-open="fc"><summary>Next few days</summary><ul>${periods}</ul>
        <div class="row small" style="margin-top:8px"><button class="lnk" data-act="fc-refresh">Check again</button>${link}</div></details>
    </div></div>`;
}
function thumbsHtml(v, canAdd) {
  const ps = (v && v.photos) || [];
  if (!ps.length && !canAdd) return "";
  return `<div class="thumbs">${ps.map((p, i) => `<button data-act="lightbox" data-vid="${esc(v.id)}" data-i="${i}" aria-label="View photo ${i + 1}"><img src="${p.thumb}" alt=""></button>`).join("")}${canAdd ? `<button class="add" data-act="photo" data-cid="${esc(v.clientId)}" aria-label="Add another photo">${I.cam}</button>` : ""}</div>`;
}
function smsHref(c, v) {
  const t = v && v.doneAt ? " at " + fmtTime(v.doneAt) : "";
  const body = `Your driveway at ${c.address || "your address"} was plowed${t}.` + (S.settings.biz ? " - " + S.settings.biz : "");
  return "sms:" + String(c.phone).replace(/[^\d+]/g, "") + "?&body=" + encodeURIComponent(body);
}
function stopCard(c, r, n, kind) {
  const v = r.storm ? curVisit(c.id) : null, busy = S.busy.has(c.id), l = r.legs.get(c.id);
  const tags = (c.priority ? ' <span class="tag first">First</span>' : "") + (c.example ? ' <span class="tag ex">Example</span>' : "");
  const legTxt = l ? `<span class="num">${fmtDur(l.sec)} · ${fmtMi(l.mi)}</span>` : "";
  const sw = on => `<button class="sw" role="switch" aria-checked="${on}" data-act="skip" data-cid="${c.id}"><span class="t"></span>${on ? "On route" : "Skipped"}</button>`;
  const note = c.notes ? `<div class="note">${esc(c.notes)}</div>` : "";
  if (kind === "next") {
    return `<article class="stop next">
      <div class="badge num">${n}</div>
      <div class="body"><div class="eyebrow">Next stop${r.pinned ? " · moved up" : ""}${l ? " · " + legTxt : ""}</div>
        <div class="name">${esc(c.name)}${tags}</div><div class="addr">${esc(c.address || "")}</div>${note}${thumbsHtml(v, false)}</div>
      <div class="acts">
        <a class="btn nav" href="${navUrl(c)}" target="_blank" rel="noopener">${I.nav}Navigate</a>
        ${busy ? `<button class="btn primary" disabled><span class="spin"></span>Saving…</button>` : `<button class="btn primary" data-act="photo-done" data-cid="${c.id}">${I.cam}Photo &amp; done</button>`}
      </div>
      <div class="acts" style="margin-top:2px">
        <button class="btn ghost sm" data-act="done-nophoto" data-cid="${c.id}">${I.check}Done, no photo</button>
        ${c.phone ? `<a class="btn ghost sm" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">${I.phone}Call</a>` : ""}
        <span class="grow"></span>${sw(true)}
      </div></article>`;
  }
  if (kind === "todo") {
    return `<article class="stop">
      <div class="badge num">${n}</div>
      <div class="body"><div class="name">${esc(c.name)}${tags}</div><div class="addr">${esc(c.address || "")}${l ? " · " + legTxt : ""}</div>${note}</div>
      <div class="acts"><button class="btn sm quiet" data-act="next-up" data-cid="${c.id}">${I.up}Do next</button><span class="grow"></span>${sw(true)}</div></article>`;
  }
  if (kind === "done") {
    const ps = (v && v.photos) || [];
    return `<article class="stop done">
      <div class="badge">${I.check}</div>
      <div class="body"><div class="name">${esc(c.name)}${tags}</div>
        <div class="addr">Done ${esc(fmtTime(v.doneAt))} · ${ps.length} photo${ps.length === 1 ? "" : "s"}</div>
        ${v.note ? `<div class="vnote">${esc(v.note)}</div>` : ""}${busy ? `<div class="row small muted" style="margin-top:6px"><span class="spin"></span>Saving photo…</div>` : ""}${thumbsHtml(v, true)}</div>
      <div class="acts">
        <button class="btn sm quiet" data-act="vnote" data-vid="${esc(v.id)}">${I.note}${v.note ? "Edit note" : "Add note"}</button>
        ${c.phone ? `<a class="btn sm quiet" href="${smsHref(c, v)}">${I.msg}Text client</a>` : ""}
        <button class="btn ghost sm" data-act="undo" data-cid="${c.id}">${I.undo}Undo</button>
      </div></article>`;
  }
  if (kind === "noloc") {
    return `<article class="stop">
      <div class="badge">?</div>
      <div class="body"><div class="name">${esc(c.name)}${tags}</div><div class="addr">${esc(c.address || "No address")}</div><div class="small warn">Not on the map yet, so it can't be routed.</div>${note}</div>
      <div class="acts"><button class="btn sm" data-act="edit" data-cid="${c.id}">${I.edit}Place on map</button>
        ${busy ? `<button class="btn sm primary" disabled><span class="spin"></span>Saving…</button>` : `<button class="btn sm primary" data-act="photo-done" data-cid="${c.id}">${I.cam}Photo &amp; done</button>`}${sw(true)}</div></article>`;
  }
  return `<article class="stop off"><div class="badge">–</div>
    <div class="body"><div class="name">${esc(c.name)}${tags}</div><div class="addr">${esc(c.address || "")}</div></div>
    <div class="acts"><span class="small muted grow">Not plowing this storm. No photo needed.</span>${sw(false)}</div></article>`;
}
function stormView() {
  const r = computeRoute(), st = r.storm;
  let h = forecastCard();
  if (!hasLoc(S.settings.home) && S.clients.size) h += `<div class="notice amber"><span>Set your home base so every route starts and ends at your driveway.</span><div><button class="btn sm" data-act="edit-home">${I.home}Set home base</button></div></div>`;
  const total = r.done.length + r.todo.length + r.noLoc.length;
  const src = r.todo.length ? (r.real ? "Order uses real drive times." : S.online ? "Order uses estimated distances for now." : "Order uses estimated distances (no signal).") : "";
  if (!st) {
    if (!S.clients.size) {
      return h + `<div class="card empty"><b>Add your driveways</b><p class="muted">Put in the houses you plow and this screen builds the fastest route from your home, every storm.</p>
        <div class="btns" style="width:100%"><a class="btn primary" href="#clients">${I.plus}Add clients</a></div></div>`;
    }
    h += `<section class="card hero">
      <div><div class="sub">No storm running</div><h2>Ready when it snows</h2></div>
      <div class="stats">
        <div class="stat"><b class="num">${r.todo.length + r.noLoc.length}</b><span>Stops</span></div>
        <div class="stat"><b class="num">${r.todo.length ? fmtDur(r.driveSec + r.back.sec) : "–"}</b><span>Driving</span></div>
        <div class="stat"><b class="num">${r.todo.length ? fmtMi(r.mi + r.back.mi).replace(" mi", "") : "–"}</b><span>Miles</span></div>
      </div>
      <button class="btn primary big" data-act="start" ${r.todo.length + r.noLoc.length ? "" : "disabled"}>${I.flake}Start storm</button>
      <span class="small muted">Starting opens today's checklist with every active client on it. Switch off anyone you're skipping and the route re-plans.</span>
    </section>`;
    if (r.todo.length) {
      h += `<h3 class="h">Route from home<span class="count">${esc(src)}</span></h3>
      <div class="card"><ol class="plist">${r.todo.map((c, i) => `<li><span class="n num">${i + 1}</span><span class="grow"><b>${esc(c.name)}${c.priority ? ' <span class="tag first">First</span>' : ""}${c.example ? ' <span class="tag ex">Example</span>' : ""}</b><span class="a">${esc(c.address || "")}</span></span><span class="small muted num">${fmtDur(r.legs.get(c.id).sec)}</span></li>`).join("")}</ol></div>`;
    }
    if (r.noLoc.length) h += `<div class="notice">${r.noLoc.length} client${r.noLoc.length > 1 ? "s aren't" : " isn't"} on the map yet: ${r.noLoc.map(c => esc(c.name)).join(", ")}. <a class="lnk" href="#clients">Fix in Clients</a></div>`;
    return h;
  }
  const doneN = r.done.length, pct = total ? Math.round(doneN / total * 100) : 0;
  const leftSec = r.driveSec + r.serviceSec;
  h += `<section class="card hero">
    <div><div class="sub">Started ${esc(fmtDay(st.startedAt))}, ${esc(fmtTime(st.startedAt))}${st.inches ? " · " + esc(st.inches) + " in." : ""}</div>
      <h2>${esc(st.name)}${(st.pass || 1) > 1 ? ` <span class="tag pass">Pass ${st.pass}</span>` : ""}</h2></div>
    <div class="stats">
      <div class="stat"><b class="num">${doneN}/${total}</b><span>Done</span></div>
      <div class="stat"><b class="num">${r.todo.length + r.noLoc.length ? fmtDur(leftSec) : "0"}</b><span>Time left</span></div>
      <div class="stat"><b class="num">${r.todo.length ? fmtMi(r.mi).replace(" mi", "") : "0"}</b><span>Miles left</span></div>
    </div>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    ${r.todo.length ? `<span class="small muted">Last driveway around <b>${esc(fmtTime(Date.now() + leftSec * 1000))}</b>${r.end ? `, home by ${esc(fmtTime(Date.now() + (leftSec + r.back.sec) * 1000))}` : ""}. Planned from ${esc(r.fromLabel)}. ${esc(src)}</span>` : ""}
    <div class="btns"><a class="btn" href="#map">${I.map}Map</a><button class="btn" data-act="storm-opts">${I.dots}Storm options</button></div>
  </section>`;
  if (r.todo.length) {
    h += `<div class="stops">${stopCard(r.todo[0], r, doneN + 1, "next")}</div>`;
    if (r.todo.length > 1) h += `<h3 class="h">After that<span class="count num">${r.todo.length - 1} more</span></h3><div class="stops">${r.todo.slice(1).map((c, i) => stopCard(c, r, doneN + i + 2, "todo")).join("")}</div>`;
  } else if (!r.noLoc.length) {
    h += `<div class="card empty"><b>${doneN ? "Every stop is done" : "Nothing on the route"}</b>
      <p class="muted">${doneN && r.end ? "About " + fmtDur(r.back.sec) + " back home. " : ""}${doneN ? "File this storm, or start another pass if it's still coming down." : "Every client is skipped or paused."}</p>
      <div class="btns" style="width:100%">${doneN ? `<button class="btn" data-act="new-pass">${I.refresh}Another pass</button>` : ""}<button class="btn go" data-act="finish-now">${I.check}Finish storm</button></div></div>`;
  }
  if (r.noLoc.length) h += `<h3 class="h">Not on the map<span class="count num">${r.noLoc.length}</span></h3><div class="stops">${r.noLoc.map(c => stopCard(c, r, 0, "noloc")).join("")}</div>`;
  if (r.done.length) h += `<h3 class="h">Done${(st.pass || 1) > 1 ? " this pass" : ""}<span class="count num">${r.done.length}</span></h3><div class="stops">${r.done.slice().reverse().map(c => stopCard(c, r, 0, "done")).join("")}</div>`;
  if (r.skipped.length) h += `<h3 class="h">Skipped this storm<span class="count num">${r.skipped.length}</span></h3><div class="stops">${r.skipped.map(c => stopCard(c, r, 0, "off")).join("")}</div>`;
  return h;
}

/* ---------- clients tab ---------- */
function clientsView() {
  const list = [...S.clients.values()].sort((a, b) => (a.active === false) - (b.active === false) || (a.name || "").localeCompare(b.name || ""));
  const activeN = list.filter(c => c.active !== false).length, exN = list.filter(c => c.example).length;
  let h = "";
  if (!list.length) {
    return `<div class="card empty"><b>No clients yet</b><p class="muted">Add each driveway once. The app finds it on the map and works it into the route.</p>
      <div class="btns" style="width:100%"><button class="btn primary" data-act="new">${I.plus}Add a client</button><button class="btn" data-act="paste">${I.list}Paste a list</button></div>
      <button class="lnk" data-act="examples">Or load 8 example stops to try it out</button></div>`;
  }
  if (exN) h += `<div class="notice amber"><span>${exN} of these are <b>example stops</b> at public places around town, so you can try a storm. Remove them when you add real clients.</span><div><button class="btn sm ${S.confirm === "examples" ? "danger armed" : ""}" data-act="clear-examples">${S.confirm === "examples" ? "Tap again to remove" : "Remove examples"}</button></div></div>`;
  h += `<div class="btns"><button class="btn primary" data-act="new">${I.plus}Add client</button><button class="btn" data-act="paste">${I.list}Paste a list</button></div>`;
  h += `<h3 class="h">Clients<span class="count num">${activeN} active${list.length - activeN ? " · " + (list.length - activeN) + " paused" : ""}</span></h3>`;
  h += `<div class="clist">${list.map(c => `<div class="client ${c.active === false ? "paused" : ""}">
      <div class="grow"><b>${esc(c.name)}</b>${c.priority ? ' <span class="tag first">First</span>' : ""}${c.example ? ' <span class="tag ex">Example</span>' : ""}
        <span class="sub">${esc(c.address || "")}${Number(c.rate) > 0 ? " · " + fmtMoney(Number(c.rate)) : ""}</span>
        ${hasLoc(c) ? "" : '<span class="sub warn">Not on the map yet</span>'}</div>
      <div class="row" style="gap:2px;flex-wrap:nowrap">
        <button class="sw" role="switch" aria-checked="${c.active !== false}" aria-label="${esc(c.name)} active this season" data-act="season" data-cid="${c.id}"><span class="t"></span></button>
        <button class="btn ghost sm" data-act="edit" data-cid="${c.id}" aria-label="Edit ${esc(c.name)}">${I.edit}</button>
      </div></div>`).join("")}</div>`;
  h += `<p class="small muted" style="margin:0">The switch pauses a client for the whole season. To skip someone for one storm only, use the switch on the Storm tab.</p>`;
  return h;
}

/* ---------- records tab ---------- */
function recordsView() {
  const t = seasonTotals(), since = S.settings.lastBackupAt;
  const newStorms = S.storms.filter(s => s.status === "done" && (!since || (s.endedAt || "") > since)).length;
  let h = `<div class="notice ${newStorms ? "amber" : ""}"><span><b>Records live on this phone.</b> ${since ? "Last backup " + esc(fmtDate(since)) + "." + (newStorms ? ` ${newStorms} storm${newStorms > 1 ? "s" : ""} since then.` : "") : (newStorms ? `${newStorms} storm${newStorms > 1 ? "s" : ""} not backed up yet.` : "Not backed up yet.")} A backup is one file with every photo and the full log.</span>
    <div class="btns"><button class="btn sm ${newStorms ? "primary" : ""}" data-act="backup">${I.box}Back up now</button><button class="btn sm" data-act="csv">${I.share}Service log (CSV)</button></div></div>`;
  h += `<h3 class="h">Season ${esc(t.label)}</h3><section class="card" style="display:grid;gap:12px">
    <div class="stats"><div class="stat"><b class="num">${t.storms}</b><span>Storms</span></div><div class="stat"><b class="num">${t.visits}</b><span>Plows</span></div><div class="stat"><b class="num">${t.anyRate ? fmtMoney(t.amount) : "–"}</b><span>To bill</span></div></div>
    ${t.rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Client</th><th>Storms</th><th>Plows</th>${t.anyRate ? "<th>Amount</th>" : ""}</tr></thead>
      <tbody>${t.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="num">${r.storms}</td><td class="num">${r.visits}</td>${t.anyRate ? `<td class="num">${r.rate ? fmtMoney(r.amount) : "–"}</td>` : ""}</tr>`).join("")}</tbody>
      ${t.anyRate ? `<tfoot><tr><td>Total</td><td></td><td class="num">${t.visits}</td><td class="num">${fmtMoney(t.amount)}</td></tr></tfoot>` : ""}</table></div>
      <span class="small muted">${t.anyRate ? "Billed per " + (S.settings.billBy === "visit" ? "plow" : "storm") + ". Change it in settings." : "Add a price to each client to see what to bill."}</span>`
      : `<span class="small muted">Finish a storm and each client's count shows up here.</span>`}
  </section>`;
  h += `<h3 class="h">Storms<span class="count num">${S.storms.length}</span></h3>`;
  if (!S.storms.length) return h + `<div class="card empty"><b>No storms yet</b><p class="muted">Every storm is filed here with each stop's time and photos.</p></div>`;
  h += `<div class="hist">${S.storms.map(s => {
    const vs = stormVisits(s.id), dur = s.endedAt ? Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 6e4) : null, key = "st:" + s.id;
    const open = S.open.has(key);
    let pass = 0;
    const inner = !open ? "" : (vs.length ? vs.map(v => {
      const head = (s.pass || 1) > 1 && v.pass !== pass ? ((pass = v.pass), `<div class="lbl" style="margin-top:6px">Pass ${v.pass}</div>`) : "";
      return head + `<div class="hv"><div class="row"><b class="grow">${esc(v.name)}</b><span class="small muted num">${esc(fmtTime(v.doneAt))}</span></div><span class="small muted">${esc(v.address || "")}</span>
        ${v.note ? `<div class="small">${esc(v.note)}</div>` : ""}${(v.photos || []).length ? thumbsHtml(v, false) : '<span class="small muted">No photo</span>'}</div>`;
    }).join("") : '<span class="small muted">No stops recorded.</span>');
    return `<details data-open="${esc(key)}" ${open ? "open" : ""}>
      <summary><b>${esc(s.name)}</b><span class="pill ${s.status === "active" ? "live" : ""}" style="${s.status === "active" ? "" : "background:var(--surface-2);color:var(--muted)"}">${s.status === "active" ? "<i></i>Live" : vs.length + " plow" + (vs.length === 1 ? "" : "s")}</span>
        <span class="small muted">${esc(fmtDay(s.startedAt))} · ${esc(fmtTime(s.startedAt))}${dur != null ? " · " + fmtDur(dur * 60) : ""}${s.inches ? " · " + esc(s.inches) + " in." : ""}</span></summary>
      <div class="inner">${(s.skippedNames || []).length ? `<div class="small muted">Skipped: ${s.skippedNames.map(esc).join(", ")}</div>` : ""}${s.notes ? `<div class="small">${esc(s.notes)}</div>` : ""}${inner}
        <div class="btns"><button class="btn sm" data-act="report" data-sid="${s.id}">${I.share}Share report</button>${s.status === "done" ? `<button class="btn ghost sm danger" data-act="del-storm" data-sid="${s.id}">Delete storm</button>` : ""}</div></div></details>`;
  }).join("")}</div>`;
  return h;
}

/* ---------- map tab ---------- */
let map = null, mapLayer = null, mapFit = "";
const TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png", TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const geoCache = new Map(); let geoBusy = false;
const mkIcon = (cls, html, size = 34) => L.divIcon({className: "", html: `<div class="mk ${cls}">${html}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2]});
async function ensureGeo(sig, pts) {
  const hit = geoCache.get(sig);
  if ((hit && (hit.line || Date.now() - hit.at < 120000)) || geoBusy || !navigator.onLine || pts.length < 2 || pts.length > 60) return;
  geoBusy = true;
  try {
    const r = await fetchJ("https://router.project-osrm.org/route/v1/driving/" + pts.map(p => p.lng.toFixed(5) + "," + p.lat.toFixed(5)).join(";") + "?overview=full&geometries=geojson", 15000);
    if (r.code === "Ok" && r.routes && r.routes[0]) geoCache.set(sig, {line: r.routes[0].geometry.coordinates.map(([x, y]) => [y, x]), at: Date.now()});
    else geoCache.set(sig, {at: Date.now()});
  } catch (e) { geoCache.set(sig, {at: Date.now()}); }
  finally { geoBusy = false; }
  if (geoCache.get(sig).line && curTab() === "map") drawMap();
}
function popupHtml(c, kind, l) {
  const st = activeStorm();
  return `<b>${esc(c.name)}</b>${esc(c.address || "")}${l ? `<br><span class="muted">${fmtDur(l.sec)} · ${fmtMi(l.mi)} from the stop before</span>` : ""}
    <div class="btns"><a class="btn sm" href="${navUrl(c)}" target="_blank" rel="noopener">${I.nav}Navigate</a>${st && kind === "todo" ? `<button class="btn sm primary" data-act="next-up" data-cid="${c.id}" data-go="storm">${I.up}Do next</button>` : ""}${st && kind === "next" ? `<a class="btn sm primary" href="#storm">Open stop</a>` : ""}</div>`;
}
function drawMap() {
  const info = $("#mapinfo");
  if (!window.L) { info.innerHTML = "<b>Map unavailable</b>Reload the app with a signal."; return; }
  const home = homePt();
  if (!map) {
    map = L.map("map", {zoomControl: false}).setView([home.lat, home.lng], 13);
    L.control.zoom({position: "topright"}).addTo(map);
    L.tileLayer(TILE, {maxZoom: 19, attribution: TILE_ATTR}).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
  }
  map.invalidateSize();
  mapLayer.clearLayers();
  const r = computeRoute(), doneN = r.done.length, all = [];
  const add = (p, icon, html, z) => { const m = L.marker([p.lat, p.lng], {icon, zIndexOffset: z || 0}).addTo(mapLayer); if (html) m.bindPopup(html); all.push([p.lat, p.lng]); return m; };
  const path = [r.start, ...r.todo]; if (r.end && r.todo.length) path.push(r.end);
  if (path.length > 1) {
    const sig = path.map(pkey).join(";"), g = geoCache.get(sig), color = getComputedStyle(document.documentElement).getPropertyValue("--ice").trim() || "#0A6FB3";
    if (g && g.line) L.polyline(g.line, {color, weight: 5, opacity: .85}).addTo(mapLayer);
    else { L.polyline(path.map(p => [p.lat, p.lng]), {color, weight: 3, opacity: .7, dashArray: "6 8"}).addTo(mapLayer); ensureGeo(sig, path); }
  }
  add(home, mkIcon("home", I.home), `<b>${hasLoc(S.settings.home) ? "Home base" : "Town center"}</b>${esc((S.settings.home && S.settings.home.address) || "Set your home base in settings.")}`, -100);
  r.skipped.filter(hasLoc).forEach(c => add(c, mkIcon("off", "–"), popupHtml(c, "off"), -50));
  r.done.filter(hasLoc).forEach(c => add(c, mkIcon("done", I.check), popupHtml(c, "done"), 0));
  r.todo.forEach((c, i) => add(c, i === 0 && r.storm ? mkIcon("next", doneN + 1, 40) : mkIcon("", doneN + i + 1), popupHtml(c, i === 0 ? "next" : "todo", r.legs.get(c.id)), i === 0 ? 500 : 100 - i));
  if (S.me) L.marker([S.me.lat, S.me.lng], {icon: mkIcon("me", "", 18), zIndexOffset: 900, interactive: false}).addTo(mapLayer);
  const fit = all.map(a => a[0].toFixed(4) + a[1].toFixed(4)).sort().join("|");
  if (fit !== mapFit && all.length) { mapFit = fit; map.fitBounds(L.latLngBounds(all).pad(0.15), {maxZoom: 16, animate: false}); }
  const nx = r.todo[0];
  info.innerHTML = r.storm
    ? (nx ? `<b>${doneN + 1}. ${esc(nx.name)}</b>${fmtDur(r.legs.get(nx.id).sec)} away · ${r.todo.length} left` : "<b>All stops done</b>Finish the storm on the Storm tab.")
    : (r.todo.length ? `<b>${r.todo.length} stops · ${fmtDur(r.driveSec + r.back.sec)}</b>${fmtMi(r.mi + r.back.mi)} of driving${S.online ? "" : " · map needs a signal"}` : "<b>No stops yet</b>Add clients to see the route.");
}
function locate(then) {
  if (!navigator.geolocation) { toast("This phone won't share its location with the app."); return; }
  toast("Finding you…", 8000);
  navigator.geolocation.getCurrentPosition(pos => {
    S.me = {lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now()};
    $("#toast").hidden = true; then(S.me);
  }, () => toast("Couldn't get your location. Allow Location for this app in your phone's settings."), {enableHighAccuracy: true, timeout: 12000, maximumAge: 30000});
}

/* ---------- sheets ---------- */
let pinMap = null, pinMarker = null, pin = null;
function closeSheet() {
  if (pinMap) { try { pinMap.stop(); pinMap.off(); pinMap.remove(); } catch (e) {} pinMap = null; pinMarker = null; }
  $("#layer").innerHTML = "";
}
function sheet(html, opts = {}) {
  closeSheet();
  $("#layer").innerHTML = `<div class="scrim" data-act="scrim" ${opts.lock ? 'data-lock="1"' : ""}><form class="sheet ${opts.full ? "full" : ""}" id="sheet" role="dialog" aria-modal="true" novalidate>${html}</form></div>`;
  const f = $("#sheet");
  f.addEventListener("submit", e => { e.preventDefault(); if (opts.submit) opts.submit(f); });
  return f;
}
const sheetHead = (title, lock) => `<div class="row"><h3 class="grow">${title}</h3>${lock ? "" : `<button type="button" class="iconbtn" style="background:var(--surface-2)" data-act="close" aria-label="Close">${I.x}</button>`}</div>`;
function pinMsg(text, cls) { const m = $("#pin-msg"); if (m) m.innerHTML = `<span class="${cls || ""}">${text}</span>`; }
function setPin(p, pan) {
  pin = {lat: +(+p.lat).toFixed(6), lng: +(+p.lng).toFixed(6)};
  if (!pinMap) return;
  if (!pinMarker) {
    pinMarker = L.marker([pin.lat, pin.lng], {draggable: true, icon: mkIcon("next", I.home, 40)}).addTo(pinMap);
    pinMarker.on("dragend", () => { const ll = pinMarker.getLatLng(); pin = {lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6)}; pinMsg("Pin moved. Save to keep it."); });
  } else pinMarker.setLatLng([pin.lat, pin.lng]);
  if (pan) pinMap.setView([pin.lat, pin.lng], 17, {animate: false});
}
function initPinMap(loc) {
  pin = hasLoc(loc) ? {lat: loc.lat, lng: loc.lng} : null; pinMarker = null;
  const el = $("#pinmap"); if (!el || !window.L) return;
  const c = pin || homePt();
  pinMap = L.map(el, {zoomControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false}).setView([c.lat, c.lng], pin ? 17 : 13);
  L.tileLayer(TILE, {maxZoom: 19, attribution: TILE_ATTR}).addTo(pinMap);
  if (pin) setPin(pin, false);
  pinMap.on("click", e => { setPin({lat: e.latlng.lat, lng: e.latlng.lng}, false); pinMsg("Pin placed. Save to keep it."); });
  setTimeout(() => { if (pinMap) pinMap.invalidateSize(); }, 80);
}
const placeFields = (d, isHome) => `
  <div class="field"><label for="f-addr">Address</label>
    <div class="inrow"><input id="f-addr" value="${esc(d.address)}" placeholder="12 Main St" autocomplete="off" autocapitalize="words"><button type="button" class="btn" data-act="find">${I.target}Find</button></div>
    <span class="hint">Just the street is enough. ${esc(S.settings.town || "")} is added for you.</span></div>
  <div class="field"><span class="lbl">${isHome ? "Where the truck starts" : "Driveway on the map"}</span>
    <div class="pinmap" id="pinmap"></div>
    <span class="hint" id="pin-msg">${hasLoc(d) ? "Drag the pin or tap the map to fix the spot." : "Tap Find, or tap the map to drop a pin on the driveway."}</span>
    <details><summary class="small muted" style="cursor:pointer;padding:4px 0">Paste coordinates instead</summary><input id="f-loc" placeholder="41.87412, -72.80105 or a map link" style="margin-top:6px" autocomplete="off"></details></div>`;
function openClientSheet(c) {
  const d = c || {active: true};
  const f = sheet(`${sheetHead(c ? "Edit client" : "New client")}
    <div class="field"><label for="f-name">Name</label><input id="f-name" value="${esc(d.name)}" placeholder="The Joneses" autocomplete="off" autocapitalize="words"></div>
    ${placeFields(d, false)}
    <div class="field"><label for="f-notes">Notes for the driver</label><textarea id="f-notes" placeholder="Push snow to the left. Watch the stone wall by the mailbox.">${esc(d.notes)}</textarea></div>
    <div class="row" style="align-items:flex-start">
      <div class="field grow"><label for="f-phone">Phone</label><input id="f-phone" type="tel" value="${esc(d.phone)}" placeholder="860-555-0142" autocomplete="off"></div>
      <div class="field" style="width:120px"><label for="f-rate">Price per plow</label><input id="f-rate" type="number" inputmode="decimal" min="0" step="1" value="${esc(d.rate || "")}" placeholder="45"></div>
    </div>
    <label class="check"><input type="checkbox" id="f-pri" ${d.priority ? "checked" : ""}><span><b>Plow first</b><br><span class="small muted">Leaves early, medical need, or a business lot. These go at the front of every route.</span></span></label>
    <label class="check"><input type="checkbox" id="f-act" ${d.active !== false ? "checked" : ""}><span><b>Active this season</b><br><span class="small muted">Off takes them out of every storm until you switch it back on.</span></span></label>
    <div class="btns"><button type="submit" class="btn primary" id="f-save">${I.check}Save</button>${c ? `<button type="button" class="btn danger" data-act="delete" data-cid="${c.id}">Delete</button>` : ""}</div>`,
    {submit: () => saveClientSheet(c)});
  initPinMap(d);
  if (!c) setTimeout(() => $("#f-name") && $("#f-name").focus(), 60);
}
function openHomeSheet() {
  const d = S.settings.home || {};
  sheet(`${sheetHead("Home base")}<p class="muted">Every route starts here${S.settings.returnHome !== false ? " and ends back here" : ""}.</p>${placeFields(d, true)}
    <div class="btns"><button type="submit" class="btn primary" id="f-save">${I.check}Save</button></div>`, {submit: saveHomeSheet});
  initPinMap(d);
}
async function readPlace() {
  const address = $("#f-addr").value.trim(), raw = $("#f-loc") ? $("#f-loc").value.trim() : "";
  if (raw) { const p = parseCoords(raw); if (!p) { pinMsg("Those don't look like coordinates. Try 41.87412, -72.80105.", "warn"); return null; } setPin(p, true); }
  let found = true;
  if (!pin && address) {
    const b = $("#f-save"); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>Finding address…'; }
    const g = navigator.onLine ? await geocode(address) : null;
    if (g) pin = {lat: g.lat, lng: g.lng}; else found = false;
  }
  return {address, loc: pin, found};
}
async function saveClientSheet(c) {
  const name = $("#f-name").value.trim();
  if (!name) { $("#f-name").focus(); toast("Give the client a name."); return; }
  const fields = {notes: $("#f-notes").value.trim(), phone: $("#f-phone").value.trim(), rate: Math.max(0, Number($("#f-rate").value) || 0), priority: $("#f-pri").checked, active: $("#f-act").checked};
  const place = await readPlace(); if (!place) return;
  const rec = {...(c || {}), id: c ? c.id : rid("c-"), name, address: place.address, ...fields, createdAt: (c && c.createdAt) || new Date().toISOString()};
  if (place.loc) { rec.lat = place.loc.lat; rec.lng = place.loc.lng; } else { delete rec.lat; delete rec.lng; }
  if (c && c.example && (c.name !== name || c.address !== place.address)) delete rec.example;
  closeSheet();
  await saveClient(rec); render();
  toast(place.found ? name + " saved." : name + " saved, but the address wasn't found. Open it and tap the map to place the pin.", place.found ? 3000 : 6000);
  ensureMatrix().then(ch => ch && render());
}
async function saveHomeSheet() {
  const place = await readPlace(); if (!place) return;
  if (!place.loc) { const b = $("#f-save"); if (b) { b.disabled = false; b.innerHTML = I.check + "Save"; } pinMsg(place.address ? "Couldn't find that address. Tap the map to drop the pin." : "Type the address or tap the map to drop the pin.", "warn"); return; }
  closeSheet();
  await saveSettings({home: {address: place.address, lat: place.loc.lat, lng: place.loc.lng}}); render();
  toast("Home base saved.");
  loadForecast(true).then(ch => ch && render()); ensureMatrix().then(ch => ch && render());
}
function parseList(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    let name = "", address = "";
    if (l.includes("\t")) { const p = l.split("\t").map(x => x.trim()).filter(Boolean); name = p[0] || ""; address = p.slice(1).join(", "); }
    else {
      const m = l.match(/^(.*?)\s+[-–—:|]\s+(.*)$/);
      if (m && !/^\d/.test(m[1])) { name = m[1].trim(); address = m[2].trim(); }
      else { const i = l.indexOf(","); if (i > 0 && !/^\d/.test(l)) { name = l.slice(0, i).trim(); address = l.slice(i + 1).trim(); } else { address = l; name = l.split(",")[0].trim(); } }
    }
    return {name: name || address, address: address || name};
  });
}
function openPasteSheet() {
  sheet(`${sheetHead("Paste a list")}
    <p class="muted">One client per line, name first, then the address. Copy it from a text, a note or a spreadsheet.</p>
    <div class="field"><label for="f-list">Clients</label><textarea id="f-list" style="min-height:190px" placeholder="Joneses, 12 Main St&#10;Smith, 48 West Mountain Rd&#10;Dr. Patel office, 250 Hopmeadow St" autocapitalize="words"></textarea>
      <span class="hint" id="paste-msg">Each address is looked up on the map as it's added.</span></div>
    <div class="btns"><button type="submit" class="btn primary" id="paste-go">${I.plus}Add them</button></div>`,
    {submit: async () => {
      const rows = parseList($("#f-list").value); if (!rows.length) { toast("Paste at least one line."); return; }
      const b = $("#paste-go"); b.disabled = true; let miss = 0;
      for (let i = 0; i < rows.length; i++) {
        b.innerHTML = `<span class="spin"></span>Finding ${i + 1} of ${rows.length}…`;
        const g = navigator.onLine ? await geocode(rows[i].address) : null; if (!g) miss++;
        await saveClient({id: rid("c-"), name: rows[i].name, address: rows[i].address, ...(g ? {lat: g.lat, lng: g.lng} : {}), notes: "", phone: "", rate: 0, priority: false, active: true, createdAt: new Date().toISOString()});
        if (g && g.source === "osm") await new Promise(r => setTimeout(r, 1100));
      }
      closeSheet(); location.hash = "#clients"; render();
      toast(`Added ${rows.length} client${rows.length > 1 ? "s" : ""}.` + (miss ? ` ${miss} need a pin placed on the map.` : ""), 6000);
      ensureMatrix().then(ch => ch && render());
    }});
}
function openStormSheet() {
  const st = activeStorm(); if (!st) return;
  const r = computeRoute(), chunks = routeChunks(r);
  sheet(`${sheetHead("Storm options")}
    <div class="row" style="align-items:flex-start">
      <div class="field grow"><label for="s-name">Storm name</label><input id="s-name" value="${esc(st.name)}" autocomplete="off"></div>
      <div class="field" style="width:110px"><label for="s-in">Snow (in.)</label><input id="s-in" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(st.inches || "")}" placeholder="4"></div>
    </div>
    <div class="field"><label for="s-notes">Notes</label><textarea id="s-notes" placeholder="Heavy wet snow. Sanded the hill on Winthrop.">${esc(st.notes || "")}</textarea></div>
    <div class="btns"><button type="submit" class="btn primary">${I.check}Save</button></div>
    <h4>Route</h4>
    <div class="btns"><button type="button" class="btn" data-act="reroute">${I.target}Re-plan from where I am</button>
      ${chunks.map(ch => `<a class="btn" href="${ch.url}" target="_blank" rel="noopener">${I.map}${chunks.length > 1 ? `Stops ${ch.from}–${ch.to} in Google Maps` : "Whole route in Google Maps"}</a>`).join("")}</div>
    <h4>Storm</h4>
    <div class="btns"><button type="button" class="btn" data-act="new-pass">${I.refresh}Start another pass</button><button type="button" class="btn danger" data-act="finish">Finish storm</button></div>
    <p class="small muted">Another pass puts every stop back on the list for a second round. Finish files the storm under Records.</p>`,
    {submit: async () => { await saveStorm({...activeStorm(), name: $("#s-name").value.trim() || st.name, inches: $("#s-in").value.trim(), notes: $("#s-notes").value.trim()}); closeSheet(); render(); toast("Saved."); }});
}
function openNoteSheet(vid) {
  const v = S.visits.get(vid); if (!v) return;
  sheet(`${sheetHead("Note for " + esc(v.name))}
    <div class="field"><label for="v-note">What happened</label><textarea id="v-note" placeholder="Car parked in the driveway, plowed around it.">${esc(v.note || "")}</textarea><span class="hint">Saved with this stop in your records.</span></div>
    <div class="btns"><button type="submit" class="btn primary">${I.check}Save note</button></div>`,
    {submit: async () => { await saveVisit({...S.visits.get(vid), note: $("#v-note").value.trim()}); closeSheet(); render(); }});
  setTimeout(() => $("#v-note") && $("#v-note").focus(), 60);
}
const seg = (key, opts, cur) => `<div class="seg" role="group">${opts.map(([v, label]) => `<button type="button" data-act="set" data-k="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${label}</button>`).join("")}</div>`;
async function openSettings(keepScroll) {
  const s = S.settings, top = keepScroll && $("#sheet") ? $("#sheet").scrollTop : 0;
  let usage = "";
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); usage = (e.usage / 1048576).toFixed(e.usage > 1e7 ? 0 : 1) + " MB used on this phone"; } } catch (e) {}
  const exN = [...S.clients.values()].filter(c => c.example).length;
  const f = sheet(`${sheetHead("Settings")}
    <div class="field"><label for="g-biz">Business name</label><input id="g-biz" data-k="biz" value="${esc(s.biz)}" placeholder="Smith Plowing" autocomplete="off" autocapitalize="words"><span class="hint">Shown at the top, stamped on photos and added to reports.</span></div>
    <div class="field"><label for="g-town">Town</label><input id="g-town" data-k="town" value="${esc(s.town)}" placeholder="Simsbury, CT" autocomplete="off"><span class="hint">Added to addresses so you only type the street.</span></div>
    <h4>Route</h4>
    <div class="setrow"><div class="grow"><b>Home base</b><div class="small muted">${esc((s.home && s.home.address) || (hasLoc(s.home) ? "Pin placed" : "Not set"))}${s.home && s.home.example ? " (example)" : ""}</div></div><button type="button" class="btn sm" data-act="edit-home">${I.edit}Edit</button></div>
    <button type="button" class="sw" role="switch" aria-checked="${s.returnHome !== false}" data-act="toggle" data-k="returnHome"><span class="t"></span>End each route back home</button>
    <div class="field"><span class="lbl">Navigate with</span>${seg("maps", [["apple", "Apple Maps"], ["google", "Google Maps"]], s.maps)}</div>
    <div class="field"><label for="g-min">Minutes per driveway</label><input id="g-min" data-k="serviceMin" type="number" inputmode="numeric" min="0" max="120" value="${esc(s.serviceMin)}"><span class="hint">Used to estimate when you'll finish.</span></div>
    <h4>Billing</h4>
    <div class="field"><span class="lbl">Charge each client per</span>${seg("billBy", [["storm", "Storm"], ["visit", "Plow (each pass)"]], s.billBy)}</div>
    <h4>Screen</h4>
    <div class="field"><span class="lbl">Appearance</span>${seg("theme", [["auto", "Match phone"], ["dark", "Dark"], ["light", "Light"]], s.theme)}</div>
    <button type="button" class="sw" role="switch" aria-checked="${!!s.keepAwake}" data-act="toggle" data-k="keepAwake"><span class="t"></span>Keep the screen on during a storm</button>
    <h4>Your records</h4>
    <p class="small muted">Everything is stored on this phone, not online. ${usage ? esc(usage) + ". " : ""}${s.lastBackupAt ? "Last backup " + esc(fmtDate(s.lastBackupAt)) + "." : "No backup yet."}</p>
    <div class="btns"><button type="button" class="btn" data-act="backup">${I.box}Back up now</button><button type="button" class="btn" data-act="restore">${I.undo}Restore a backup</button></div>
    ${exN ? `<div class="btns"><button type="button" class="btn" data-act="clear-examples-now">Remove the ${exN} example stops</button></div>` : ""}
    <div class="btns"><button type="button" class="btn danger" data-act="erase">Erase everything</button></div>
    <p class="small muted">Plow Route ${APP_VERSION}. Forecast: National Weather Service. Maps and drive times: OpenStreetMap contributors and the OSRM project. Address lookup: US Census Bureau.</p>`);
  f.addEventListener("change", e => {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    let v = e.target.value.trim(); if (k === "serviceMin") v = Math.max(0, Math.min(120, Number(v) || 0));
    saveSettings({[k]: v}).then(render);
  });
  if (top) f.scrollTop = top;
}
function openWelcome() {
  sheet(`<div class="welcome-ico"><img src="icon-192.png" alt=""></div>
    <h3>Plow Route</h3>
    <p class="muted">The fastest way through your driveways, every storm. Two things to set it up.</p>
    <div class="field"><label for="w-biz">Your business name</label><input id="w-biz" placeholder="Smith Plowing" autocomplete="off" autocapitalize="words"><span class="hint">Optional. Stamped on your photos.</span></div>
    <div class="field"><label for="w-town">Your town</label><input id="w-town" value="${esc(S.settings.town)}" autocomplete="off"></div>
    <div class="field"><label for="w-home">Where the truck is parked</label><input id="w-home" placeholder="12 Main St" autocomplete="off" autocapitalize="words"><span class="hint" id="w-msg">Routes start and end here.</span></div>
    <div class="btns"><button type="submit" class="btn primary big" id="w-go">Get started</button></div>
    <button type="button" class="lnk" data-act="restore" style="justify-self:center">I have a backup to restore</button>`,
    {lock: true, full: true, submit: async () => {
      const b = $("#w-go"), addr = $("#w-home").value.trim();
      await saveSettings({biz: $("#w-biz").value.trim(), town: $("#w-town").value.trim() || DEFAULTS.town});
      let home = null;
      if (addr) { b.disabled = true; b.innerHTML = '<span class="spin"></span>Finding your address…'; const g = navigator.onLine ? await geocode(addr) : null; home = g ? {address: addr, lat: g.lat, lng: g.lng} : {address: addr}; }
      await saveSettings({home, onboarded: true});
      closeSheet(); location.hash = "#clients"; render();
      if (addr && !hasLoc(home)) { toast("Couldn't find that address. Drop the pin on the map.", 5000); openHomeSheet(); }
      loadForecast(true).then(ch => ch && render());
    }});
}
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; });
function openInstall() {
  const steps = isIOS
    ? `<ol class="steps"><li><span>Tap the <b>Share</b> button ${I.share} in the browser bar.</span></li><li><span>Scroll down and tap <b>Add to Home Screen</b>.</span></li><li><span>Open <b>Plow Route</b> from your home screen.</span></li></ol>`
    : `<ol class="steps"><li><span>Tap <b>Install app</b> below${installEvt ? "" : ", or open the browser menu and choose <b>Add to Home screen</b>"}.</span></li><li><span>Open <b>Plow Route</b> from your home screen.</span></li></ol>`;
  sheet(`<div class="welcome-ico"><img src="icon-192.png" alt=""></div>
    <h3>Put Plow Route on your home screen</h3>
    <p class="muted">It then opens like any other app, works with no signal, and keeps your clients and photos saved.</p>
    ${steps}
    ${!isIOS ? `<div class="btns"><button type="button" class="btn primary big" data-act="install">Install app</button></div>` : ""}
    <div class="notice"><span>Set up your clients <b>after</b> you open it from the home screen. Anything entered here in the browser stays in the browser.</span></div>
    <button type="button" class="lnk" data-act="browser-ok" style="justify-self:center">Use it in the browser anyway</button>`, {lock: true, full: true});
}
async function openLightbox(vid, i) {
  const v = S.visits.get(vid), p = v && v.photos && v.photos[i]; if (!p) return;
  closeSheet();
  $("#layer").innerHTML = `<div class="lb" role="dialog" aria-modal="true" aria-label="Photo" data-vid="${esc(vid)}" data-i="${i}">
    <button class="x" data-act="close" aria-label="Close">${I.x}</button>
    <div class="mid"><img id="lb-img" src="${p.thumb}" alt="Service photo"></div>
    <div><p>${esc(v.name)} · ${esc(new Date(p.at).toLocaleString([], {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}))}${v.photos.length > 1 ? ` · ${i + 1} of ${v.photos.length}` : ""}</p>
      <div class="btns"><button class="btn" data-act="lb-share">${I.share}Share photo</button><button class="btn danger" data-act="lb-del">Delete</button></div></div></div>`;
  const u = await photoUrl(p.id), im = $("#lb-img"); if (im && u) im.src = u;
}

/* ---------- camera ---------- */
let camJob = null;
function takePhoto(cid, markDone) {
  const st = activeStorm(); if (!st) return;
  camJob = {cid, markDone, sid: st.id, pass: st.pass || 1};
  const inp = $("#cam"); inp.value = ""; inp.click();
}
function newVisit(st, cid) {
  const c = S.clients.get(cid) || {};
  return {id: visitId(st.id, st.pass || 1, cid), stormId: st.id, pass: st.pass || 1, clientId: cid, name: c.name || "", address: c.address || "", done: false, doneAt: null, note: "", photos: []};
}
async function markDone(cid, extra) {
  const st = activeStorm(); if (!st) return;
  const prev = curVisit(cid) || newVisit(st, cid);
  await saveVisit({...prev, done: true, doneAt: prev.doneAt || Date.now(), ...(extra || {})});
  if (st.nextUp === cid) await saveStorm({...activeStorm(), nextUp: null});
}
$("#cam").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0], job = camJob; camJob = null;
  if (!file || !job) return;
  const st = activeStorm(); if (!st || st.id !== job.sid) return;
  const c = S.clients.get(job.cid) || {}; S.busy.add(job.cid); render();
  try {
    const now = Date.now(), when = new Date(now).toLocaleString([], {month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"});
    const {blob, thumb} = await processPhoto(file, [(c.name || "Stop") + (c.address ? " · " + c.address : ""), when + (S.settings.biz ? " · " + S.settings.biz : "")]);
    const pid = rid("p-"), vid = visitId(job.sid, job.pass, job.cid);
    await dbPut("photos", {id: pid, stormId: job.sid, visitId: vid, clientId: job.cid, at: now, type: "image/jpeg", buf: await blob.arrayBuffer()});
    const prev = S.visits.get(vid) || newVisit(st, job.cid), photos = [...(prev.photos || []), {id: pid, at: now, thumb}];
    if (job.markDone) { await saveVisit({...prev, photos}); await markDone(job.cid); toast((c.name || "Stop") + " done. Photo saved."); window.scrollTo({top: 0, behavior: "smooth"}); }
    else { await saveVisit({...prev, photos}); toast("Photo saved."); }
  } catch (err) { toast("Couldn't save that photo. Try taking it again.", 5000); }
  finally { S.busy.delete(job.cid); render(); }
});
$("#restore").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  toast("Restoring…", 60000);
  try { const r = await restoreBackup(file); closeSheet(); location.hash = "#storm"; render(); toast(`Restored ${r.clients} clients, ${r.storms} storms and ${r.photos} photos.`, 6000); ensureMatrix().then(ch => ch && render()); loadForecast(true).then(ch => ch && render()); }
  catch (err) { toast("That file isn't a Plow Route backup.", 5000); }
});

/* ---------- actions ---------- */
async function startStorm() {
  const b = seasonBounds(), n = S.storms.filter(s => Date.parse(s.startedAt) >= b.from).length + 1, now = new Date();
  await saveStorm({id: rid("s-"), name: "Storm " + n, status: "active", startedAt: now.toISOString(), endedAt: null, pass: 1, skipped: [], nextUp: null, inches: "", notes: "", startFrom: null});
  render(); window.scrollTo(0, 0); toast("Storm started. Drive safe."); syncWake();
}
async function finishStorm() {
  const st = activeStorm(); if (!st) return;
  const r = computeRoute(), any = stormVisits(st.id).length;
  if (!any) { S.storms = S.storms.filter(s => s.id !== st.id); bump(); await dbDel("storms", st.id); closeSheet(); render(); toast("Storm cancelled. Nothing was recorded."); syncWake(); return; }
  await saveStorm({...st, status: "done", endedAt: new Date().toISOString(), nextUp: null, skippedNames: r.skipped.map(c => c.name)});
  closeSheet(); render(); window.scrollTo(0, 0); syncWake();
  toast("Storm filed under Records.", 4000);
}
async function deleteStorm(sid) {
  const vs = [...S.visits.values()].filter(v => v.stormId === sid);
  await dbWrite(["storms", "visits", "photos"], t => {
    t.objectStore("storms").delete(sid);
    vs.forEach(v => { t.objectStore("visits").delete(v.id); (v.photos || []).forEach(p => t.objectStore("photos").delete(p.id)); });
  });
  vs.forEach(v => S.visits.delete(v.id)); S.storms = S.storms.filter(s => s.id !== sid); bump(); render(); toast("Storm deleted.");
}
async function doBackup() {
  toast("Building backup…", 60000);
  try {
    const b = await buildBackup(), name = "plow-route-backup-" + new Date().toISOString().slice(0, 10) + ".zip";
    const how = await giveFile(b.blob, name, "Plow Route backup");
    if (how === "cancelled") { toast("Backup not saved."); return; }
    await saveSettings({lastBackupAt: new Date().toISOString()}); render();
    toast(how === "shared" ? "Backup saved. Keep it in Files or iCloud." : "Backup downloaded: " + name, 5000);
  } catch (e) { toast("Couldn't build the backup. Try again.", 5000); }
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, cid = b.dataset.cid, st = activeStorm();
  switch (act) {
    case "scrim": if (e.target === b && !b.dataset.lock) closeSheet(); return;
    case "close": closeSheet(); return;
    case "settings": openSettings(); return;
    case "new": openClientSheet(null); return;
    case "edit": openClientSheet(S.clients.get(cid)); return;
    case "edit-home": openHomeSheet(); return;
    case "paste": openPasteSheet(); return;
    case "storm-opts": openStormSheet(); return;
    case "vnote": openNoteSheet(b.dataset.vid); return;
    case "lightbox": openLightbox(b.dataset.vid, +b.dataset.i); return;
    case "fc-refresh": toast("Checking…"); loadForecast(true).then(ch => { render(); toast(ch ? "Forecast updated." : "Couldn't reach the forecast. Try again with a signal."); }); return;
    case "find": {
      const addr = $("#f-addr").value.trim(); if (!addr) { pinMsg("Type the address first.", "warn"); return; }
      if (!navigator.onLine) { pinMsg("No signal. Tap the map to drop the pin, or try again later.", "warn"); return; }
      b.disabled = true; pinMsg('<span class="spin"></span> Looking it up…');
      const g = await geocode(addr); b.disabled = false;
      if (g) { setPin(g, true); pinMsg("Found it. Drag the pin onto the driveway if it's a little off."); }
      else pinMsg("Couldn't find that address. Check the spelling, or tap the map to drop the pin.", "warn");
      return;
    }
    case "set": await saveSettings({[b.dataset.k]: b.dataset.v}); render(); openSettings(true); return;
    case "toggle": await saveSettings({[b.dataset.k]: !(b.getAttribute("aria-checked") === "true")}); render(); openSettings(true); syncWake(); return;
    case "examples": await loadExamples(); if (!S.settings.onboarded) await saveSettings({onboarded: true}); render(); toast("Example stops loaded. Try Start storm."); ensureMatrix().then(ch => ch && render()); return;
    case "clear-examples": if (S.confirm !== "examples") { arm("examples"); return; } S.confirm = null; await clearExamples(); render(); toast("Examples removed."); return;
    case "clear-examples-now": if (!armBtn(b, "Tap again to remove")) return; await clearExamples(); render(); openSettings(true); toast("Examples removed."); return;
    case "season": { const c = S.clients.get(cid); if (c) { await saveClient({...c, active: c.active === false}); render(); } return; }
    case "delete": { if (!armBtn(b, "Tap again to delete")) return; const c = S.clients.get(cid); closeSheet(); await removeClient(cid); render(); toast(((c && c.name) || "Client") + " deleted. Past visits stay in Records."); return; }
    case "start": await startStorm(); return;
    case "skip": {
      if (!st) return; const sk = new Set(st.skipped || []); sk.has(cid) ? sk.delete(cid) : sk.add(cid);
      await saveStorm({...st, skipped: [...sk], nextUp: st.nextUp === cid ? null : st.nextUp}); render(); return;
    }
    case "next-up": if (!st) return; await saveStorm({...st, nextUp: cid}); if (b.dataset.go) location.hash = "#" + b.dataset.go; render(); window.scrollTo({top: 0, behavior: "smooth"}); return;
    case "photo-done": takePhoto(cid, true); return;
    case "photo": takePhoto(cid, false); return;
    case "done-nophoto": await markDone(cid); render(); toast(((S.clients.get(cid) || {}).name || "Stop") + " done."); return;
    case "undo": { const v = curVisit(cid); if (v) { await saveVisit({...v, done: false, doneAt: null}); render(); } return; }
    case "new-pass": if (!st) return; await saveStorm({...st, pass: (st.pass || 1) + 1, nextUp: null, startFrom: null}); closeSheet(); render(); window.scrollTo(0, 0); toast("Pass " + ((st.pass || 1) + 1) + " started. Every stop is back on the list."); return;
    case "finish": if (!armBtn(b, "Tap again to finish")) return; await finishStorm(); return;
    case "finish-now": await finishStorm(); return;
    case "reroute": locate(async me => { const s2 = activeStorm(); if (!s2) return; await saveStorm({...s2, startFrom: {lat: me.lat, lng: me.lng, at: Date.now()}, nextUp: null}); closeSheet(); render(); toast("Route re-planned from where you are."); }); return;
    case "locate": locate(me => { drawMap(); if (map) map.setView([me.lat, me.lng], 15); }); return;
    case "fit": mapFit = ""; drawMap(); return;
    case "report": { const s = S.storms.find(x => x.id === b.dataset.sid); if (!s) return; const how = await giveText(stormReport(s), stormTitle(s)); if (how === "copied") toast("Report copied. Paste it into a text or email."); else if (how === "failed") toast("Couldn't share the report."); return; }
    case "del-storm": if (!armBtn(b, "Tap again to delete")) return; await deleteStorm(b.dataset.sid); return;
    case "csv": { const how = await giveFile(new Blob(["﻿" + visitsCsv()], {type: "text/csv"}), "plow-service-log.csv", "Plow service log"); if (how === "downloaded") toast("Service log downloaded."); return; }
    case "backup": await doBackup(); return;
    case "restore": { const has = S.clients.size || S.storms.length; if (has && !armBtn(b, "Replaces what's here. Tap again")) return; const inp = $("#restore"); inp.value = ""; inp.click(); return; }
    case "erase": if (!armBtn(b, "Deletes all clients and photos. Tap again")) return; await eraseEverything(); closeSheet(); render(); openWelcome(); return;
    case "lb-share": { const lb = $(".lb"), v = S.visits.get(lb.dataset.vid), p = v && v.photos[+lb.dataset.i]; if (!p) return; const blob = await photoBlob(p.id); if (blob) await giveFile(blob, safeName(v.name) + " " + new Date(p.at).toISOString().slice(0, 10) + ".jpg", v.name); return; }
    case "lb-del": {
      if (!armBtn(b, "Tap again to delete")) return;
      const lb = $(".lb"), v = S.visits.get(lb.dataset.vid), p = v && v.photos[+lb.dataset.i]; if (!p) return;
      await saveVisit({...v, photos: v.photos.filter(x => x.id !== p.id)}); await dbDel("photos", p.id);
      if (photoUrls.has(p.id)) { URL.revokeObjectURL(photoUrls.get(p.id)); photoUrls.delete(p.id); }
      closeSheet(); render(); toast("Photo deleted."); return;
    }
    case "install": if (installEvt) { installEvt.prompt(); installEvt = null; } else toast("Open the browser menu and choose Add to Home screen.", 6000); return;
    case "browser-ok": ls.set("plow.browserOk", "1"); closeSheet(); if (!S.settings.onboarded) openWelcome(); return;
  }
});
document.addEventListener("toggle", e => {
  const d = e.target; if (!(d instanceof HTMLDetailsElement) || !d.dataset.open) return;
  const was = S.open.has(d.dataset.open);
  if (d.open) S.open.add(d.dataset.open); else S.open.delete(d.dataset.open);
  if (d.open && !was && d.dataset.open.startsWith("st:")) render();
}, true);
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#layer").firstChild && !$("#layer [data-lock]")) closeSheet(); });
window.addEventListener("hashchange", () => { render(); if (curTab() !== "map") window.scrollTo(0, 0); });
window.addEventListener("online", () => { S.online = true; render(); refreshOnline(); });
window.addEventListener("offline", () => { S.online = false; render(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { refreshOnline(); render(); } syncWake(); });

function refreshOnline() {
  loadForecast(false).then(ch => ch && render());
  ensureMatrix().then(ch => ch && render());
}
let wake = null;
async function syncWake() {
  const want = !!S.settings.keepAwake && !!activeStorm() && document.visibilityState === "visible";
  if (want && !wake && navigator.wakeLock) { try { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } catch (e) {} }
  else if (!want && wake) { try { await wake.release(); } catch (e) {} wake = null; }
}

/* ---------- boot ---------- */
async function boot() {
  try { await loadAll(); }
  catch (e) {
    $("#view").innerHTML = `<div class="col"><div class="card empty"><b>Can't save on this browser</b><p class="muted">Plow Route keeps your records on the phone, and this browser is blocking that. Turn off Private Browsing, or open the link in Safari or Chrome.</p></div></div>`;
    return;
  }
  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  const mobile = isIOS || isAndroid;
  if (mobile && !isStandalone() && ls.get("plow.browserOk") !== "1") openInstall();
  else if (!S.settings.onboarded && !S.clients.size) openWelcome();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  refreshOnline(); syncWake();
  setInterval(() => { if (document.visibilityState === "visible" && activeStorm() && curTab() === "storm" && !$("#layer").firstChild) render(); }, 60000);
}
boot();
