"use strict";
/* Plow Route core: storage, routing, forecast, address lookup, photos, backup. No UI in this file. */

const APP_VERSION = "1.0";

/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hasLoc = c => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
const fmtTime = t => t ? new Date(t).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"}) : "";
const fmtDay = t => t ? new Date(t).toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"}) : "";
const fmtDate = t => t ? new Date(t).toLocaleDateString([], {month: "short", day: "numeric", year: "numeric"}) : "";
const fmtMi = x => (x < 0.1 ? "0.1" : x < 10 ? x.toFixed(1) : String(Math.round(x))) + " mi";
const fmtDur = sec => { const m = Math.max(1, Math.round(sec / 60)); return m < 60 ? m + " min" : Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m"; };
const fmtMoney = n => "$" + (Math.round(n * 100) / 100).toLocaleString([], {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2});
const UA = navigator.userAgent || "";
const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(UA);
const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
async function fetchJ(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, {signal: ctl.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

/* ---------- storage (IndexedDB, everything stays on this device) ---------- */
let idb = null;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("plowroute", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("kv");
      d.createObjectStore("clients", {keyPath: "id"});
      d.createObjectStore("storms", {keyPath: "id"});
      d.createObjectStore("visits", {keyPath: "id"});
      d.createObjectStore("photos", {keyPath: "id"});
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function dbWrite(stores, fn) {
  return new Promise((res, rej) => {
    const t = idb.transaction(stores, "readwrite");
    t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted"));
    fn(t);
  });
}
const dbPut = (store, val, key) => dbWrite(store, t => { key === undefined ? t.objectStore(store).put(val) : t.objectStore(store).put(val, key); });
const dbDel = (store, key) => dbWrite(store, t => { t.objectStore(store).delete(key); });
const dbAll = store => req(idb.transaction(store).objectStore(store).getAll());
const dbGet = (store, key) => req(idb.transaction(store).objectStore(store).get(key));
const dbKeys = store => req(idb.transaction(store).objectStore(store).getAllKeys());

/* ---------- state ---------- */
const DEFAULTS = {
  biz: "", town: "Simsbury, CT", home: null, returnHome: true,
  maps: isIOS ? "apple" : "google", theme: "auto", billBy: "storm", serviceMin: 10,
  keepAwake: false, lastBackupAt: null, onboarded: false
};
const S = {
  settings: {...DEFAULTS}, clients: new Map(), storms: [], visits: new Map(),
  matrix: null, forecast: null, nws: null, rev: 0,
  busy: new Set(), confirm: null, open: new Set(), online: navigator.onLine, me: null
};
const bump = () => { S.rev++; };
const TOWN_CENTER = {lat: 41.8759, lng: -72.8012};
const homePt = () => hasLoc(S.settings.home) ? S.settings.home : TOWN_CENTER;
const activeStorm = () => S.storms.find(s => s.status === "active") || null;
const visitId = (sid, pass, cid) => sid + "|" + pass + "|" + cid;
const curVisit = cid => { const st = activeStorm(); return st ? S.visits.get(visitId(st.id, st.pass || 1, cid)) : undefined; };
const stormVisits = sid => [...S.visits.values()].filter(v => v.stormId === sid && v.done).sort((a, b) => (a.pass - b.pass) || (a.doneAt - b.doneAt));
const stormTitle = s => s.name + " · " + fmtDay(s.startedAt);

async function loadAll() {
  idb = await openDB();
  const [settings, matrix, forecast, nws, clients, storms, visits] = await Promise.all([
    dbGet("kv", "settings"), dbGet("kv", "matrix"), dbGet("kv", "forecast"), dbGet("kv", "nws"),
    dbAll("clients"), dbAll("storms"), dbAll("visits")
  ]);
  S.settings = {...DEFAULTS, ...(settings || {})};
  S.matrix = matrix ? indexMatrix(matrix) : null;
  S.forecast = forecast || null; S.nws = nws || null;
  S.clients = new Map(clients.map(c => [c.id, c]));
  S.storms = storms.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  S.visits = new Map(visits.map(v => [v.id, v]));
  bump();
}
async function saveSettings(patch) { Object.assign(S.settings, patch); bump(); await dbPut("kv", S.settings, "settings"); }
async function saveClient(c) { S.clients.set(c.id, c); bump(); await dbPut("clients", c); }
async function removeClient(id) { S.clients.delete(id); bump(); await dbDel("clients", id); }
async function saveStorm(s) {
  const i = S.storms.findIndex(x => x.id === s.id);
  if (i < 0) S.storms.unshift(s); else S.storms[i] = s;
  bump(); await dbPut("storms", s);
}
async function saveVisit(v) { S.visits.set(v.id, v); bump(); await dbPut("visits", v); }

/* ---------- distances ---------- */
const pkey = p => p.lat.toFixed(5) + "," + p.lng.toFixed(5);
function hav(a, b) {
  const R = 3958.8, k = Math.PI / 180, dLat = (b.lat - a.lat) * k, dLng = (b.lng - a.lng) * k;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function indexMatrix(m) { m.idx = {}; m.keys.forEach((k, i) => { m.idx[k] = i; }); return m; }
// One driving leg. Uses real drive times when we have them, else straight line + 25% at 25 mph.
function leg(a, b) {
  const M = S.matrix;
  if (M) {
    const i = M.idx[pkey(a)], j = M.idx[pkey(b)];
    if (i != null && j != null && M.dur[i] && M.dur[i][j] != null) return {sec: M.dur[i][j], mi: M.dist[i][j] / 1609.344, real: true};
  }
  const mi = hav(a, b) * 1.25;
  return {sec: mi / 25 * 3600, mi, real: false};
}
let matrixBusy = false, matrixTried = "", matrixTriedAt = 0;
// Fetch a full drive-time table for home + every client once, then keep it on the phone.
async function ensureMatrix() {
  const pts = [homePt(), ...[...S.clients.values()].filter(hasLoc)];
  const keys = [...new Set(pts.map(pkey))];
  if (keys.length < 2 || keys.length > 90) return false;
  if (S.matrix && keys.every(k => S.matrix.idx[k] != null)) return false;
  const sig = keys.join(";");
  if (matrixBusy || !navigator.onLine || (matrixTried === sig && Date.now() - matrixTriedAt < 120000)) return false;
  matrixBusy = true; matrixTried = sig; matrixTriedAt = Date.now();
  try {
    const coords = keys.map(k => { const [la, ln] = k.split(","); return ln + "," + la; }).join(";");
    const r = await fetchJ("https://router.project-osrm.org/table/v1/driving/" + coords + "?annotations=duration,distance", 20000);
    if (r.code !== "Ok" || !Array.isArray(r.durations) || r.durations.length !== keys.length) throw new Error("bad table");
    const m = {keys, dur: r.durations, dist: r.distances || r.durations.map(row => row.map(s => (s || 0) * 11)), at: Date.now()};
    await dbPut("kv", {keys: m.keys, dur: m.dur, dist: m.dist, at: m.at}, "matrix");
    S.matrix = indexMatrix(m); bump();
    return true;
  } catch (e) { return false; }
  finally { matrixBusy = false; }
}

/* ---------- route solver ---------- */
// Shortest driving order through pts, starting at `start`, optionally ending at `end`.
// Checks every order exactly for up to 15 stops; larger lists use nearest-stop + 2-opt improvement.
function solve(start, pts, end) {
  const n = pts.length;
  if (n <= 1) return pts.slice();
  const D = pts.map(a => pts.map(b => leg(a, b).sec));
  const S0 = pts.map(p => leg(start, p).sec);
  const E = pts.map(p => end ? leg(p, end).sec : 0);
  if (n <= 15) {
    const FULL = 1 << n, dp = new Float64Array(FULL * n).fill(Infinity), par = new Int8Array(FULL * n).fill(-1);
    for (let i = 0; i < n; i++) dp[(1 << i) * n + i] = S0[i];
    for (let m = 1; m < FULL; m++) for (let j = 0; j < n; j++) {
      if (!(m & (1 << j))) continue;
      const v = dp[m * n + j]; if (v === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (m & (1 << k)) continue;
        const nm = m | (1 << k), c = v + D[j][k];
        if (c < dp[nm * n + k]) { dp[nm * n + k] = c; par[nm * n + k] = j; }
      }
    }
    let best = Infinity, bj = 0;
    for (let j = 0; j < n; j++) { const c = dp[(FULL - 1) * n + j] + E[j]; if (c < best) { best = c; bj = j; } }
    const order = []; let m = FULL - 1, j = bj;
    while (j >= 0) { order.push(j); const pj = par[m * n + j]; m &= ~(1 << j); j = pj; }
    return order.reverse().map(i => pts[i]);
  }
  const left = new Set(pts.map((_, i) => i)), ord = []; let cur = -1;
  while (left.size) {
    let bi = -1, bd = Infinity;
    for (const i of left) { const d = cur < 0 ? S0[i] : D[cur][i]; if (d < bd) { bd = d; bi = i; } }
    ord.push(bi); left.delete(bi); cur = bi;
  }
  const cost = o => { let c = S0[o[0]]; for (let i = 1; i < o.length; i++) c += D[o[i - 1]][o[i]]; return c + E[o[o.length - 1]]; };
  let improved = true, bestC = cost(ord), guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 0; i < n - 1; i++) for (let k = i + 1; k < n; k++) {
      const o2 = ord.slice(0, i).concat(ord.slice(i, k + 1).reverse(), ord.slice(k + 1)), c = cost(o2);
      if (c < bestC - 1e-6) { ord.splice(0, n, ...o2); bestC = c; improved = true; }
    }
  }
  return ord.map(i => pts[i]);
}

let routeMemo = null;
// The plan for right now: what is done, what is left (in the best order), what is skipped.
function computeRoute() {
  if (routeMemo && routeMemo.rev === S.rev) return routeMemo.r;
  const storm = activeStorm();
  const skippedSet = new Set(storm ? storm.skipped || [] : []);
  const done = [], todo = [], skipped = [], noLoc = [];
  const list = [...S.clients.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  for (const c of list) {
    const v = storm ? curVisit(c.id) : null;
    if (v && v.done) { done.push(c); continue; }
    if (c.active === false) continue;
    if (skippedSet.has(c.id)) skipped.push(c);
    else if (!hasLoc(c)) noLoc.push(c);
    else todo.push(c);
  }
  done.sort((a, b) => (curVisit(a.id).doneAt || 0) - (curVisit(b.id).doneAt || 0));
  const lastDone = [...done].reverse().find(hasLoc);
  const lastDoneAt = lastDone ? curVisit(lastDone.id).doneAt || 0 : 0;
  let start = homePt(), fromLabel = "home";
  if (lastDone) { start = lastDone; fromLabel = lastDone.name; }
  if (storm && storm.startFrom && hasLoc(storm.startFrom) && (storm.startFrom.at || 0) > lastDoneAt) { start = storm.startFrom; fromLabel = "your location"; }
  const end = S.settings.returnHome !== false ? homePt() : null;
  const ordered = []; let cur = start, pool = todo.slice();
  const pinned = storm && storm.nextUp ? pool.find(c => c.id === storm.nextUp) : null;
  if (pinned) { ordered.push(pinned); cur = pinned; pool = pool.filter(c => c !== pinned); }
  const pri = pool.filter(c => c.priority), rest = pool.filter(c => !c.priority);
  if (pri.length) { const o = solve(cur, pri, rest.length ? null : end); ordered.push(...o); cur = o[o.length - 1]; }
  if (rest.length) ordered.push(...solve(cur, rest, end));
  const legs = new Map(); let prev = start, sec = 0, mi = 0, real = ordered.length > 0;
  for (const c of ordered) { const l = leg(prev, c); legs.set(c.id, l); sec += l.sec; mi += l.mi; if (!l.real) real = false; prev = c; }
  const back = end && ordered.length ? leg(prev, end) : {sec: 0, mi: 0, real: true};
  const serviceSec = (ordered.length + noLoc.length) * (Number(S.settings.serviceMin) || 0) * 60;
  const r = {storm, done, todo: ordered, skipped, noLoc, legs, driveSec: sec, mi, back, serviceSec, start, end, fromLabel, real, pinned: !!pinned};
  routeMemo = {rev: S.rev, r};
  return r;
}

/* ---------- map links ---------- */
function navUrl(c) {
  return S.settings.maps === "apple"
    ? "https://maps.apple.com/?daddr=" + c.lat + "," + c.lng + "&dirflg=d"
    : "https://www.google.com/maps/dir/?api=1&destination=" + c.lat + "," + c.lng + "&travelmode=driving";
}
function routeChunks(r) {
  const pts = r.todo.map(c => c.lat + "," + c.lng);
  if (!pts.length) return [];
  const out = []; let origin = r.start.lat + "," + r.start.lng, i = 0;
  const end = r.end ? r.end.lat + "," + r.end.lng : null;
  while (i < pts.length) {
    const seg = pts.slice(i, i + 10), last = i + 10 >= pts.length;
    let dest = seg[seg.length - 1], way = seg.slice(0, -1);
    if (last && end && seg.length < 10) { way = seg; dest = end; }
    out.push({url: "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + origin + "&destination=" + dest + (way.length ? "&waypoints=" + encodeURIComponent(way.join("|")) : ""), from: i + 1, to: Math.min(i + 10, pts.length)});
    origin = seg[seg.length - 1]; i += 10;
  }
  return out;
}
function parseCoords(s) {
  if (!s) return null; s = String(s).trim();
  const ok = (lat, lng) => (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng)) ? {lat, lng} : null;
  let m = s.match(/(\d+(?:\.\d+)?)\s*°?\s*([NS])[,\s]+(\d+(?:\.\d+)?)\s*°?\s*([EW])/i);
  if (m) return ok(/s/i.test(m[2]) ? -m[1] : +m[1], /w/i.test(m[4]) ? -m[3] : +m[3]);
  m = s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || s.match(/[?&](?:q|ll|query|destination|daddr|sll|coordinate)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i)
    || s.match(/(-?\d{1,2}\.\d{3,})\s*[,\s]\s*(-?\d{1,3}\.\d{3,})/);
  return m ? ok(+m[1], +m[2]) : null;
}

/* ---------- address lookup ---------- */
function fullAddress(addr) {
  const a = String(addr || "").trim(); if (!a) return "";
  if (/,\s*[A-Za-z]{2}\b(\s+\d{5})?\s*$/.test(a) || /\b\d{5}\b/.test(a)) return a;
  return a + ", " + (S.settings.town || "Simsbury, CT");
}
let jsonpN = 0;
function jsonp(url, ms = 9000) {
  return new Promise((res, rej) => {
    const cb = "__plowcb" + (++jsonpN), s = document.createElement("script");
    const done = (fn, v) => { clearTimeout(t); delete window[cb]; s.remove(); fn(v); };
    const t = setTimeout(() => done(rej, new Error("timeout")), ms);
    window[cb] = d => done(res, d);
    s.onerror = () => done(rej, new Error("network"));
    s.src = url + "&callback=" + cb; document.head.appendChild(s);
  });
}
// US Census geocoder first (free, official), OpenStreetMap as a second try.
async function geocode(addr) {
  const q = fullAddress(addr); if (!q) return null;
  try {
    const d = await jsonp("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=jsonp&address=" + encodeURIComponent(q));
    const m = d && d.result && d.result.addressMatches && d.result.addressMatches[0];
    if (m && m.coordinates && Number.isFinite(+m.coordinates.y)) return {lat: +(+m.coordinates.y).toFixed(6), lng: +(+m.coordinates.x).toFixed(6), source: "census", matched: m.matchedAddress || q};
  } catch (e) {}
  try {
    const d = await fetchJ("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" + encodeURIComponent(q), 9000);
    if (d && d[0] && Number.isFinite(+d[0].lat)) return {lat: +(+d[0].lat).toFixed(6), lng: +(+d[0].lon).toFixed(6), source: "osm", matched: d[0].display_name || q};
  } catch (e) {}
  return null;
}

/* ---------- forecast (National Weather Service) ---------- */
const SNOW_RE = /snow|sleet|wintry|flurr|freezing rain|freezing drizzle|ice pellets|blizzard/i;
function sumGrid(series, hours) {
  if (!series || !Array.isArray(series.values)) return {total: 0, first: null};
  const now = Date.now(), lim = now + hours * 3600e3; let total = 0, first = null;
  for (const v of series.values) {
    const t = Date.parse(String(v.validTime).split("/")[0]);
    if (!Number.isFinite(t) || t > lim || t < now - 6 * 3600e3 || !(v.value > 0)) continue;
    total += v.value; if (first == null || t < first) first = t;
  }
  return {total, first};
}
let fcBusy = false;
async function loadForecast(force) {
  const h = homePt(), key = h.lat.toFixed(3) + "," + h.lng.toFixed(3);
  if (fcBusy || !navigator.onLine) return false;
  if (!force && S.forecast && S.forecast.key === key && Date.now() - S.forecast.at < 30 * 60e3) return false;
  fcBusy = true;
  try {
    let pt = S.nws && S.nws.key === key ? S.nws : null;
    if (!pt) {
      const r = await fetchJ("https://api.weather.gov/points/" + h.lat.toFixed(4) + "," + h.lng.toFixed(4));
      pt = {key, forecast: r.properties.forecast, grid: r.properties.forecastGridData};
      S.nws = pt; await dbPut("kv", pt, "nws");
    }
    const [f, g] = await Promise.allSettled([fetchJ(pt.forecast), pt.grid ? fetchJ(pt.grid) : Promise.reject(0)]);
    if (f.status !== "fulfilled") throw new Error("forecast unavailable");
    const now = Date.now();
    const periods = (f.value.properties.periods || []).slice(0, 8).map(p => {
      const text = (p.shortForecast || "") + " " + (p.detailedForecast || "");
      const acc = (p.detailedForecast || "").match(/snow accumulation of ([^.]*?)(?: possible)?\./i);
      return {name: p.name, temp: p.temperature, unit: p.temperatureUnit || "F", short: p.shortForecast || "", start: p.startTime,
        pop: p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null ? p.probabilityOfPrecipitation.value : null,
        snow: SNOW_RE.test(text), acc: acc ? acc[1].trim() : ""};
    });
    let totalIn = 0, iceIn = 0, first = null;
    if (g.status === "fulfilled" && g.value && g.value.properties) {
      const sn = sumGrid(g.value.properties.snowfallAmount, 72), ic = sumGrid(g.value.properties.iceAccumulation, 72);
      totalIn = sn.total / 25.4; iceIn = ic.total / 25.4; first = sn.first;
    }
    const soon = periods.filter(p => Date.parse(p.start) < now + 72 * 3600e3);
    const firstSnow = soon.find(p => p.snow);
    const snow = totalIn >= 0.1 || !!firstSnow || iceIn >= 0.05;
    let headline = "No snow in the next 3 days";
    if (snow) {
      const when = firstSnow ? firstSnow.name : (first ? fmtDay(first) : "soon");
      const amt = totalIn >= 0.1 ? "about " + (totalIn < 1 ? "under 1" : (Math.round(totalIn * 2) / 2)) + " in." : (firstSnow && firstSnow.acc ? firstSnow.acc : "");
      headline = (firstSnow ? "Snow " : iceIn >= 0.05 && totalIn < 0.1 ? "Ice " : "Snow ") + when + (amt ? " · " + amt : "");
    }
    S.forecast = {key, at: now, snow, headline, totalIn, iceIn, first, periods};
    await dbPut("kv", S.forecast, "forecast");
    return true;
  } catch (e) { return false; }
  finally { fcBusy = false; }
}

/* ---------- photos ---------- */
function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { res({im, url}); }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
    im.src = url;
  });
}
const canvasBlob = (cv, q) => new Promise(r => cv.toBlob(r, "image/jpeg", q));
// Shrink to 1600px, burn in a proof-of-service stamp, and make a small thumbnail.
async function processPhoto(file, lines) {
  const {im, url} = await loadImage(file);
  try {
    const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); g.drawImage(im, 0, 0, w, h);
    const fs = Math.max(15, Math.round(Math.min(w, h) / 30)), pad = Math.round(fs * 0.55), lh = Math.round(fs * 1.3);
    const boxH = lines.length * lh + pad * 2;
    g.fillStyle = "rgba(8,14,20,.72)"; g.fillRect(0, h - boxH, w, boxH);
    g.fillStyle = "#FFB020"; g.fillRect(0, h - boxH, Math.max(4, Math.round(fs / 3)), boxH);
    g.textBaseline = "middle";
    lines.forEach((t, i) => {
      g.font = (i === 0 ? "700 " : "500 ") + fs + "px Barlow, system-ui, sans-serif";
      g.fillStyle = i === 0 ? "#FFFFFF" : "#D5E0E8";
      g.fillText(t, pad * 2 + 4, h - boxH + pad + lh * i + lh / 2, w - pad * 4);
    });
    const blob = await canvasBlob(cv, 0.8);
    const T = 168, tc = document.createElement("canvas"); tc.width = T; tc.height = T;
    const side = Math.min(im.naturalWidth, im.naturalHeight);
    tc.getContext("2d").drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, 0, 0, T, T);
    return {blob, thumb: tc.toDataURL("image/jpeg", 0.6)};
  } finally { URL.revokeObjectURL(url); }
}
const photoUrls = new Map();
async function photoBlob(id) { const p = await dbGet("photos", id); return p ? new Blob([p.buf], {type: p.type || "image/jpeg"}) : null; }
async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const b = await photoBlob(id); if (!b) return "";
  const u = URL.createObjectURL(b); photoUrls.set(id, u); return u;
}

/* ---------- files out: share sheet on phones, download elsewhere ---------- */
async function giveFile(blob, name, title) {
  const file = new File([blob], name, {type: blob.type || "application/octet-stream"});
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: title || name}); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a"), u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
  return "downloaded";
}
async function giveText(text, title) {
  if (navigator.share) {
    try { await navigator.share({text, title}); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(text); return "copied"; } catch (e) { return "failed"; }
}

/* ---------- zip (plain, uncompressed) ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0, cdSize = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const nm = enc.encode(f.name), len = f.data.length, crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, len, true); lh.setUint32(22, len, true);
    lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, len, true); ch.setUint32(24, len, true);
    ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, nm); cdSize += 46 + nm.length; off += 30 + nm.length + len;
  }
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, e.buffer], {type: "application/zip"});
}
async function zipOpen(file) {
  const tailLen = Math.min(file.size, 65557), tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let p = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { p = i; break; }
  if (p < 0) throw new Error("not a zip");
  const n = tail.getUint16(p + 10, true), cdSize = tail.getUint32(p + 12, true), cdOff = tail.getUint32(p + 16, true);
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder(), entries = new Map();
  let q = 0;
  for (let i = 0; i < n; i++) {
    if (cd.getUint32(q, true) !== 0x02014b50) throw new Error("bad zip");
    const method = cd.getUint16(q + 10, true), csize = cd.getUint32(q + 20, true), nl = cd.getUint16(q + 28, true), el = cd.getUint16(q + 30, true), cl = cd.getUint16(q + 32, true), lho = cd.getUint32(q + 42, true);
    entries.set(dec.decode(new Uint8Array(cd.buffer, q + 46, nl)), {method, csize, lho});
    q += 46 + nl + el + cl;
  }
  return {
    names: [...entries.keys()],
    async read(name) {
      const e = entries.get(name); if (!e) return null;
      const lh = new DataView(await file.slice(e.lho, e.lho + 30).arrayBuffer());
      const start = e.lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), raw = file.slice(start, start + e.csize);
      if (e.method === 0) return new Uint8Array(await raw.arrayBuffer());
      if (e.method === 8 && typeof DecompressionStream === "function") return new Uint8Array(await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      throw new Error("unsupported zip");
    }
  };
}

/* ---------- records: CSV, storm report, season totals, backup ---------- */
const csvCell = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function visitsCsv() {
  const rows = [["Date", "Storm", "Pass", "Client", "Address", "Time done", "Photos", "Note", "Snow (in)"]];
  const byId = new Map(S.storms.map(s => [s.id, s]));
  [...S.visits.values()].filter(v => v.done).sort((a, b) => a.doneAt - b.doneAt).forEach(v => {
    const s = byId.get(v.stormId) || {};
    rows.push([fmtDate(v.doneAt), s.name || "", v.pass || 1, v.name || "", v.address || "", fmtTime(v.doneAt), (v.photos || []).length, v.note || "", s.inches || ""]);
  });
  return rows.map(r => r.map(csvCell).join(",")).join("\r\n");
}
function stormReport(s) {
  const vs = stormVisits(s.id), L = [];
  L.push((S.settings.biz ? S.settings.biz + " — " : "") + stormTitle(s));
  L.push("Started " + fmtTime(s.startedAt) + (s.endedAt ? ", finished " + fmtTime(s.endedAt) : "") + (s.inches ? " · " + s.inches + " in. of snow" : ""));
  if (s.notes) L.push(s.notes);
  let pass = 0;
  vs.forEach(v => {
    if ((s.pass || 1) > 1 && v.pass !== pass) { pass = v.pass; L.push("", "Pass " + pass); }
    L.push("• " + fmtTime(v.doneAt) + "  " + v.name + (v.address ? " — " + v.address : "") + (v.note ? " (" + v.note + ")" : ""));
  });
  if ((s.skippedNames || []).length) L.push("", "Skipped: " + s.skippedNames.join(", "));
  return L.join("\n");
}
function seasonBounds(t = Date.now()) {
  const d = new Date(t), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return {from: new Date(y, 6, 1).getTime(), to: new Date(y + 1, 6, 1).getTime(), label: y + "–" + String(y + 1).slice(2)};
}
function seasonTotals() {
  const b = seasonBounds(), per = new Map(); const storms = new Set();
  for (const v of S.visits.values()) {
    if (!v.done || v.doneAt < b.from || v.doneAt >= b.to) continue;
    storms.add(v.stormId);
    let r = per.get(v.clientId);
    if (!r) { const c = S.clients.get(v.clientId); r = {id: v.clientId, name: (c && c.name) || v.name, rate: c ? Number(c.rate) || 0 : 0, storms: new Set(), visits: 0}; per.set(v.clientId, r); }
    r.storms.add(v.stormId); r.visits++;
  }
  const rows = [...per.values()].map(r => ({...r, storms: r.storms.size, amount: r.rate * (S.settings.billBy === "visit" ? r.visits : r.storms.size)})).sort((a, b) => a.name.localeCompare(b.name));
  return {label: b.label, storms: storms.size, visits: rows.reduce((n, r) => n + r.visits, 0), amount: rows.reduce((n, r) => n + r.amount, 0), rows, anyRate: rows.some(r => r.rate > 0)};
}
const safeName = s => String(s || "").replace(/[\\/:*?"<>|\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "item";
async function buildBackup() {
  const enc = new TextEncoder(), files = [], photoFiles = {};
  const byStorm = new Map(S.storms.map(s => [s.id, s]));
  for (const v of S.visits.values()) for (const p of v.photos || []) {
    const s = byStorm.get(v.stormId) || {};
    const d = new Date(p.at || v.doneAt || Date.now()), hm = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
    photoFiles[p.id] = "photos/" + safeName((s.startedAt || "").slice(0, 10) + " " + (s.name || "Storm")) + "/" + safeName(v.name) + " " + hm + " " + p.id.slice(-5) + ".jpg";
  }
  const data = {app: "plow-route", v: 1, at: new Date().toISOString(), settings: S.settings, clients: [...S.clients.values()], storms: S.storms, visits: [...S.visits.values()], photoFiles};
  files.push({name: "plow-route-backup.json", data: enc.encode(JSON.stringify(data))});
  files.push({name: "service-log.csv", data: enc.encode("﻿" + visitsCsv())});
  let missing = 0;
  for (const id of Object.keys(photoFiles)) {
    const p = await dbGet("photos", id);
    if (p && p.buf) files.push({name: photoFiles[id], data: new Uint8Array(p.buf)}); else missing++;
  }
  return {blob: zipStore(files), photos: files.length - 2, missing};
}
async function restoreBackup(file) {
  const z = await zipOpen(file), raw = await z.read("plow-route-backup.json");
  if (!raw) throw new Error("not a backup");
  const data = JSON.parse(new TextDecoder().decode(raw));
  if (data.app !== "plow-route" || !Array.isArray(data.clients)) throw new Error("not a backup");
  await dbWrite(["kv", "clients", "storms", "visits", "photos"], t => {
    ["clients", "storms", "visits", "photos"].forEach(s => t.objectStore(s).clear());
    t.objectStore("kv").delete("matrix");
    t.objectStore("kv").put({...DEFAULTS, ...(data.settings || {}), onboarded: true}, "settings");
    data.clients.forEach(c => t.objectStore("clients").put(c));
    (data.storms || []).forEach(s => t.objectStore("storms").put(s));
    (data.visits || []).forEach(v => t.objectStore("visits").put(v));
  });
  let photos = 0;
  const meta = new Map();
  for (const v of data.visits || []) for (const p of v.photos || []) meta.set(p.id, {id: p.id, stormId: v.stormId, visitId: v.id, clientId: v.clientId, at: p.at, type: "image/jpeg"});
  for (const [id, path] of Object.entries(data.photoFiles || {})) {
    const bytes = await z.read(path); if (!bytes || !meta.has(id)) continue;
    await dbPut("photos", {...meta.get(id), buf: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)}); photos++;
  }
  photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls.clear();
  await loadAll();
  return {clients: data.clients.length, storms: (data.storms || []).length, photos};
}
async function eraseEverything() {
  await dbWrite(["kv", "clients", "storms", "visits", "photos"], t => { ["kv", "clients", "storms", "visits", "photos"].forEach(s => t.objectStore(s).clear()); });
  photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls.clear();
  await loadAll();
}

/* ---------- example stops (public places around Simsbury) ---------- */
const EXAMPLES = [
  ["Library lot", "725 Hopmeadow St, Simsbury, CT", 41.872583, -72.802697, "Pile snow at the back corner, away from the book drop.", true],
  ["High School drive", "34 Farms Village Rd, Simsbury, CT", 41.870128, -72.824167, "", false],
  ["Simsbury Farms", "100 Old Farms Rd, Simsbury, CT", 41.886585, -72.84621, "Long gravel drive: blade up a notch.", false],
  ["Squadron Line School", "44 Squadron Line Rd, Simsbury, CT", 41.901342, -72.806647, "", false],
  ["Tootin' Hills School", "25 Nimrod Rd, West Simsbury, CT", 41.861021, -72.861966, "", false],
  ["Henry James School", "155 Firetown Rd, Simsbury, CT", 41.88307, -72.81351, "", false],
  ["Tariffville School", "42 Winthrop St, Tariffville, CT", 41.909499, -72.766997, "Steep entrance. Sand after plowing.", false],
  ["Simsbury Airport", "95 Hoskins Rd, Simsbury, CT", 41.902054, -72.801127, "", false]
];
const EXAMPLE_HOME = {address: "933 Hopmeadow St, Simsbury, CT", lat: 41.88024, lng: -72.800149, example: true};
async function loadExamples() {
  for (const [name, address, lat, lng, notes, priority] of EXAMPLES)
    await saveClient({id: rid("ex-"), name, address, lat, lng, notes, priority, active: true, phone: "", rate: 45, example: true, createdAt: new Date().toISOString()});
  if (!hasLoc(S.settings.home)) await saveSettings({home: EXAMPLE_HOME});
}
async function clearExamples() {
  for (const c of [...S.clients.values()]) if (c.example) await removeClient(c.id);
  if (S.settings.home && S.settings.home.example) await saveSettings({home: null});
}
