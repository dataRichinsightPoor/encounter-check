import * as M from './model.js';
const $ = id => document.getElementById(id);
let current, out, dirty = false;
const pct = (n, d = 1) => Number.isFinite(n) ? `${(100 * n).toFixed(d)}%` : '—';
const pts = n => `${(100 * n).toFixed(1)} pts`;
const num = (n, d = 3) => Number.isFinite(n) ? (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : +n.toPrecision(d) + '') : '—';
const ratio = r => r >= 1 ? `${num(r)}:1` : `1:${num(1 / r)}`;
const fields = ['E', 'T', 'geometry', 'volume', 'area', 'window', 'readTime', 'diameter', 'k', 'tauC', 'p', 'killMode', 'tauR', 'kbg',
  'densityLow', 'densityHigh', 'volumeFactor', 'areaFactor', 'newTargets', 'altFactor',
  'drug', 'conc', 'depletion', 'KT', 'KE', 'RT', 'RE', 'trigger', 'doseLow', 'doseHigh'];
const text = new Set(['geometry', 'killMode', 'drug', 'depletion']);
const drugOnly = new Set(['conc', 'depletion', 'KT', 'KE', 'RT', 'RE', 'trigger', 'doseLow', 'doseHigh']);
const pM = x => { const v = x / 1e-12; return v >= 1000 ? `${num(v / 1000)} nM` : `${num(v)} pM`; };

function fill(c) {
  for (const k of fields) $(k).value = c[k];
  $('pl-ratios').value = c.plate.ratios.join(', ');
  $('pl-targets').value = c.plate.targets.join(', ');
  $('pl-volumes').value = c.plate.volumes.join(', ');
  $('pl-reps').value = c.plate.replicates;
  $('pl-doses').value = (c.plate.doses ?? [c.conc]).join(', ');
  syncForm();
}
function syncForm() {
  const u = M.units({geometry: $('geometry').value});
  $('k-unit').textContent = u.k;
  $('recovery').hidden = $('killMode').value === 'single';
  $('drug-fields').hidden = $('drug').value !== 'bridged';
  $('p-unit').textContent = $('drug').value === 'bridged' ? 'maximum' : 'per conjugate';
}
function read() {
  const c = {};
  const drugOn = $('drug').value === 'bridged';
  for (const k of fields) {
    if (text.has(k)) { c[k] = $(k).value; continue; }
    if (!drugOn && drugOnly.has(k)) { c[k] = Number($(k).value) || M.preset()[k]; continue; }
    if (!$(k).value.trim()) throw new Error(`Please enter ${$(k).labels[0].childNodes[0].textContent.trim().toLowerCase()}.`);
    c[k] = Number($(k).value);
  }
  c.plate = structuredClone(current?.plate ?? M.preset().plate);
  M.validate(c);
  return c;
}
function markDirty(message = 'Inputs changed. Run the check to update results. Exports are paused.') {
  dirty = true;
  $('workbench').classList.add('stale');
  document.body.classList.add('stale-all');
  $('status').className = '';
  $('status').textContent = message;
  for (const id of ['png', 'csv', 'json', 'plate-csv', 'dose-png', 'dose-csv']) $(id).disabled = true;
}
function calculate(c) {
  const next = {
    sim: M.simulate(c), ix: M.indices(c), scan: M.densityScan(c),
    runs: [c.densityLow, 1, c.densityHigh].map(f => ({f, sim: M.simulate({...c, E: c.E * f, T: c.T * f}, {points: 81})})),
    map: M.densityMap(c), geo: M.geometryTest(c), re: M.redesign(c), id: M.identifiability(c), settle: M.settling(c),
    drug: M.drugState(c), dose: M.doseResponse(c)
  };
  current = structuredClone(c); out = next; dirty = false;
  $('workbench').classList.remove('stale');
  document.body.classList.remove('stale-all');
  for (const id of ['png', 'csv', 'json', 'plate-csv']) $(id).disabled = false;
  for (const id of ['dose-png', 'dose-csv']) $(id).disabled = !next.dose;
  $('status').className = '';
  $('status').textContent = 'Check updated. Adaptive Dormand–Prince integration, tolerance 1e-9.';
  $('export-status').textContent = '';
  render();
  buildPlate();
}
function fail(e) {
  markDirty(e.message);
  $('status').className = 'error';
}

function render() {
  const c = current, o = out, u = M.units(c), ix = o.ix, s = o.scan;
  $('version').textContent = `v${M.VERSION}`;
  const spanFold = c.densityHigh / c.densityLow;
  $('headline').textContent = `At ${ratio(ix.ratio)}, the ${c.window} h lysis runs from ${pct(s.low)} to ${pct(s.high)} across a ${num(spanFold)}-fold density span. The ratio never changed.`;
  const el = s.elasticity;
  $('regime-badge').textContent = c.killMode === 'single' && el < 0.15 ? 'SINGLE-USE CEILING' : el > 0.6 ? 'DENSITY GOVERNS' : el < 0.15 ? 'RATIO NEARLY SUFFICIENT' : 'DENSITY AND RATIO BOTH MATTER';
  $('metrics').innerHTML = `<div class="metric"><small>Fixed-ratio spread</small><strong>${pts(s.spread)}</strong><p>Density elasticity ${num(el, 2)}; 1 = density only, 0 = ratio only</p></div>
<div class="metric"><small>Effector-attributed lysis at ${c.window} h</small><strong>${pct(o.sim.end.lysis)}</strong><p>Background-corrected specific lysis ${pct(o.sim.end.specificLysis)}</p></div>
<div class="metric"><small>Targets in conjugates at ${c.readTime} h</small><strong>${pct(o.sim.read.conjugatedTargets)}</strong><p>Mean encounters per target by ${c.window} h: ${o.sim.end.encountersPerTarget.toFixed(2)}</p></div>`;
  const cols = ['--muted', '--teal', '--amber'];
  $('time-legend').innerHTML = o.runs.map((r, i) => `<span style="color:var(${cols[i]})">${i === 1 ? '━' : '╌'} ${num(r.f)}× density · ${num(c.E * r.f)} E + ${num(c.T * r.f)} T${i === 1 ? ' (reference)' : ''}</span>`).join('');
  const diag = o.map.cells.filter(x => Math.abs(x.fe - x.ft) < 1e-12).map(x => x.lysis);
  $('map-note').textContent = `Along the reference-ratio diagonal (${ratio(ix.ratio)}), lysis runs from ${pct(Math.min(...diag))} to ${pct(Math.max(...diag))} over the ${num(o.map.factors.at(-1) / o.map.factors[0])}-fold range shown. Axes are cells per well in the declared ${c.geometry === 'settled' ? `${c.area} mm² bottom` : `${c.volume} µL medium`}; white ring marks the reference well.`;
  const single = c.killMode === 'single';
  const rows = [
    ['E:T ratio', ratio(ix.ratio), 'The quantity most protocols hold fixed'],
    ['Effector density', `${num(ix.effectorDensity)} ${u.density}`, 'Sets how often each target meets an effector'],
    ['Target density', `${num(ix.targetDensity)} ${u.density}`, 'Sets how often each effector meets a target'],
    ['Encounter rate per free target, a₀ = kE/G', `${num(ix.perTargetRate)} /h`, 'Mean time to first contact is 1/a₀'],
    ['Encounter rate per free effector, b₀ = kT/G', `${num(ix.perEffectorRate)} /h`, 'Mean search time is 1/b₀'],
    ['Handling time per contact, h = τc + pτR', single ? 'single use' : `${num(ix.handling)} h`, 'Time an effector is unavailable per contact'],
    ['Search fraction, 1/(1 + b₀h)', single ? 'not defined' : num(ix.searchFraction, 2), 'Near 1: density governs. Near 0: ratio governs'],
    ['Steady kills per effector', single ? '—' : `${num(ix.steadyKillRate)} /h`, 'p/(1/b₀ + h), before targets deplete'],
    ['Encounter ceiling, 1 − exp(−pa₀t)', pct(ix.encounterAsymptote), 'Upper bound if effectors never saturate'],
    [single ? 'Single-use ceiling, min(1, E/T)' : 'Handling ceiling, (E/T)(p/h)t', pct(ix.handlingAsymptote), single ? 'Each effector kills at most once, however long the assay runs' : 'Upper bound if every effector is always busy'],
    ['Bottom coverage by cell footprints', pct(ix.coverage), ix.crowded ? 'Above 25%: well-mixed contact is questionable' : 'Below the 25% crowding flag']
  ];
  const dr = o.drug;
  if (dr) rows.push(
    ['Free drug at the declared dose', `${pM(dr.free)} of ${pM(dr.total)}`, `${pct(dr.freeFraction)} free; antigen sites ${pM(dr.ST)}, effector sites ${pM(dr.SE)}`],
    ['Arm occupancy, θT and θE', `${pct(dr.thetaT)} · ${pct(dr.thetaE, 3)}`, 'Fraction of each cell’s sites holding drug'],
    ['Bridge index B', num(dr.bridge, 3), `1 at free drug √(KT·KE) = ${pM(dr.peakFree)}`],
    ['Kill probability per conjugate', num(dr.pEff, 3), `p·(1 − e^−sB); ${num(dr.pPeak, 3)} at full bridging`]
  );
  $('indices').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td>${r[2]}</td></tr>`).join('');
  renderRegime();
  renderGeometry();
  renderRedesign();
  renderIdent();
  renderDrug();
  drawAll();
}
function renderDrug() {
  const c = current, d = out.dose, on = !!d;
  $('drug-on').hidden = !on; $('drug-off').hidden = on;
  document.querySelectorAll('.drugcol').forEach(x => { x.hidden = !on; });
  $('pl-doses-wrap').hidden = !on;
  if (!on) return;
  const cols = ['--muted', '--teal', '--amber'];
  $('dose-legend').innerHTML = d.curves.map((cv, i) => `<span style="color:var(${cols[i]})">━ ${num(cv.factor)}× density · ${num(cv.E)} E + ${num(cv.T)} T</span>`).join('') + `<span style="color:var(--teal)">╌ 1×, if cells bound no drug</span><span style="color:var(--muted)">│ declared dose ${num(c.conc)} pM</span>`;
  $('drug-caption').textContent = `E:T ${ratio(c.E / c.T)} in ${num(c.volume)} µL. Each well’s plateau is its maximum lysis, reached at free drug √(KT·KE) = ${pM(d.rows[1].peakFree)}; EC50 is the lower dose giving half of it. Total EC50 = free EC50 + drug bound to both cell pools.`;
  $('drug-table').innerHTML = d.rows.map(r => `<tr${r.factor === 1 ? ' class="ref"' : ''}><td>${num(r.factor, 2)}× · ${num(r.E)} E + ${num(r.T)} T</td><td class="num">${pct(r.emax)}</td><td class="num">${pM(r.ec50Free)}</td><td class="num">${pM(r.ec50Total)}</td><td class="num">${pM(r.bound)}</td><td class="num">${pct(r.freeFractionAtDose)}</td><td class="num">${pct(r.lysisAtDose)}</td></tr>`).join('');
  const lo = d.rows[0], hi = d.rows[2], span = num(c.densityHigh / c.densityLow);
  $('drug-note').textContent = `Across the ${span}-fold density span the plateau moves from ${pct(lo.emax)} to ${pct(hi.emax)} through contact. Free EC50 changes ${num(d.foldFree, 3)}-fold, also through contact. Total EC50 changes ${num(d.foldTotal, 3)}-fold because denser wells hold more drug on cells. At ${num(c.conc)} pM, lysis runs from ${pct(lo.lysisAtDose)} to ${pct(hi.lysisAtDose)}.`;
  const pr = d.probe;
  $('drug-probe').textContent = `Probe: keep the cells and the ${num(c.conc)} pM concentration, change medium ${num(pr.factor)}×. ${pr.geometry === 'settled' ? 'Under the settled hypothesis contact does not change, so any shift is depletion' : 'Under the bulk hypothesis contact changes too, so the shift mixes both effects'}: lysis ${pct(pr.lysisRef)} → ${pct(pr.lysisVol)} with binding, ${pct(pr.lysisRefNoDep)} → ${pct(pr.lysisVolNoDep)} if cells bound no drug; total EC50 ${pM(pr.ec50Ref)} → ${pM(pr.ec50Vol)}.`;
}
function drawDose(canvas = $('dose'), exporting = false) {
  const c = current, d = out.dose; if (!d) return;
  const {g, width, height} = setup(canvas, exporting, 1440, 860);
  const top = exporting ? 150 : 24, bottom = exporting ? 236 : 46, left = exporting ? 84 : 52, right = exporting ? 96 : 30;
  const W = width - left - right, H = height - top - bottom;
  const all = d.curves.flatMap(cv => [...cv.withDepletion, ...cv.freeEqualsTotal]);
  const yMax = Math.max(0.2, ...all) * 1.12;
  const lx0 = Math.log10(d.doses[0]), lx1 = Math.log10(d.doses.at(-1));
  const X = x => left + (Math.log10(x) - lx0) / (lx1 - lx0) * W, Y = v => top + H * (1 - v / yMax);
  g.font = `${exporting ? 17 : 12}px 'DM Sans',sans-serif`;
  g.strokeStyle = color('--line'); g.fillStyle = color('--muted'); g.lineWidth = 1;
  const step = yMax > 0.6 ? 0.2 : yMax > 0.3 ? 0.1 : 0.05;
  for (let v = 0; v <= yMax; v += step) { const y = Y(v); g.beginPath(); g.moveTo(left, y); g.lineTo(width - right, y); g.stroke(); g.textAlign = 'right'; g.fillText(`${Math.round(v * 100)}%`, left - 8, y + 4); }
  const lab = e => e >= 6 ? `${10 ** (e - 6)} µM` : e >= 3 ? `${10 ** (e - 3)} nM` : `${10 ** e} pM`;
  const every = (lx1 - lx0) > 6 ? 2 : 1;
  for (let e = Math.ceil(lx0); e <= Math.floor(lx1); e++) { if ((e - Math.ceil(lx0)) % every) continue; g.textAlign = 'center'; g.fillText(lab(e), X(10 ** e), top + H + 23); }
  g.fillText('Total drug concentration (log scale)', left + W / 2, top + H + (exporting ? 55 : 42));
  const cols = ['--muted', '--teal', '--amber'];
  const line = (ys, col, w, dash) => { g.strokeStyle = color(col); g.lineWidth = w; g.setLineDash(dash); g.beginPath(); ys.forEach((y, j) => j ? g.lineTo(X(d.doses[j]), Y(y)) : g.moveTo(X(d.doses[j]), Y(y))); g.stroke(); g.setLineDash([]); };
  line(d.curves[1].freeEqualsTotal, '--teal', exporting ? 2 : 1.4, [7, 5]);
  d.curves.forEach((cv, i) => line(cv.withDepletion, cols[i], i === 1 ? (exporting ? 4 : 2.6) : 2, []));
  d.rows.forEach((r, i) => { const x = X(r.ec50Total / 1e-12); if (x < left || x > left + W) return; g.fillStyle = color(cols[i]); g.beginPath(); g.arc(x, Y(r.emax / 2), exporting ? 6 : 4, 0, Math.PI * 2); g.fill(); });
  if (c.conc > 0) { const x = X(c.conc); if (x >= left && x <= left + W) { g.strokeStyle = color('--muted'); g.setLineDash([3, 5]); g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + H); g.stroke(); g.setLineDash([]); g.fillStyle = color('--muted'); g.textAlign = 'left'; g.fillText('declared dose', x + 6, top + 14); } }
  if (exporting) {
    d.curves.forEach((cv, i) => { const j = cv.withDepletion.indexOf(Math.max(...cv.withDepletion)); g.fillStyle = color(cols[i]); g.textAlign = 'center'; g.fillText(`${num(cv.factor)}×`, X(d.doses[j]), Y(cv.withDepletion[j]) - 12); });
    g.textAlign = 'left'; g.fillStyle = color('--muted'); g.font = "14px 'DM Sans',sans-serif";
    g.fillText('DATA-RICH, INSIGHT-POOR  /  99 SMALL PROBLEMS  /  NO. 05', left, 36);
    g.fillStyle = color('--ink'); g.font = "34px 'DM Sans',sans-serif"; g.fillText('Encounter Check · bispecific bridge', left, 80);
    g.font = "18px 'DM Sans',sans-serif";
    g.fillText(`${ratio(c.E / c.T)} held fixed: plateau ${pct(d.rows[0].emax)} to ${pct(d.rows[2].emax)}; total EC50 ${pM(d.rows[0].ec50Total)} to ${pM(d.rows[2].ec50Total)} across a ${num(c.densityHigh / c.densityLow)}-fold density span.`, left, 116);
    const y = height - 112; g.font = "16px 'DM Sans',sans-serif"; g.fillStyle = color('--muted');
    g.fillText(`Solid: ${num(c.densityLow)}×, 1× and ${num(c.densityHigh)}× the reference cells, with drug bound by cells. Dashed: 1× if cells bound no drug. Dots: total EC50.`, left, y);
    g.fillText(`KD target ${num(c.KT)} nM, effector ${num(c.KE)} nM; ${num(c.RT)} antigens per target, ${num(c.RE)} receptors per effector; trigger s ${num(c.trigger)}; p max ${num(c.p, 2)}.`, left, y + 28);
    g.fillText(`Well: ${num(c.volume)} µL over ${num(c.area)} mm², ${c.geometry} contact; ${c.window} h window.`, left, y + 56);
    g.fillText(`v${M.VERSION} · synthetic parameters · forward simulation`, left, y + 84);
  }
}
function renderRegime() {
  const c = current, ix = out.ix, S = ix.searchFraction, single = c.killMode === 'single';
  $('meter').style.left = single ? '0%' : `calc(${(100 * S).toFixed(1)}% - 1px)`;
  $('meter').hidden = single;
  const on = single ? 3 : S > 0.67 ? 0 : S < 0.2 ? 2 : 1;
  document.querySelectorAll('#regime-cards article').forEach((a, i) => a.classList.toggle('on', i === on));
}
function renderGeometry() {
  const c = current, g = out.geo, st = out.settle;
  $('geo-caption').textContent = `Both hypotheses are calibrated to the same reference lysis. Nominal geometry: ${c.geometry}. Matched alternative encounter coefficient ${num(g.alternative.k)} ${M.units(g.alternative).k}.`;
  $('geo').innerHTML = g.rows.map((r, i) => `<tr${i === 0 ? ' class="ref"' : ''}><td>${r.label}</td><td class="num">${pct(r.settled)}</td><td class="num">${pct(r.bulk)}</td><td class="num ${r.separation > 0.05 ? 'good' : ''}">${r.separation < 1e-9 ? 'none' : pts(r.separation)}</td><td class="num ${r.coverage > M.FOOTPRINT_LIMIT ? 'warn' : ''}">${pct(r.coverage)}</td></tr>`).join('');
  $('settling').textContent = `Stokes estimate for a ${c.diameter} µm cell, 50 kg/m³ denser than medium at 37 °C: it falls the ${num(st.height)} mm column in about ${Math.round(st.minutes)} min, which is ${pct(st.fractionOfWindow, 1)} of the ${c.window} h window. Settling time is an order-of-magnitude estimate; convection, plate handling, and a round-bottom well all change it.`;
}
function renderRedesign() {
  const c = current, r = out.re;
  $('re-caption').textContent = `Reference lysis ${pct(r.reference)} with ${num(c.T)} targets. Only ${num(c.newTargets)} are available, a factor of ${num(r.factor, 2)}.`;
  $('re').innerHTML = r.options.map(o => `<tr${o.id === 'density' ? ' class="ref"' : ''}><td>${o.label}</td><td class="num">${num(o.E)}</td><td class="num">${num(o.T)}</td><td class="num">${ratio(o.ratio)}</td><td class="num">${num(o.volume)}</td><td class="num">${num(o.area)}</td><td class="num">${pct(o.lysis)}</td><td class="num ${Math.abs(o.deviation) < 1e-6 ? 'good' : 'warn'}">${Math.abs(o.deviation) < 1e-6 ? 'exact' : (o.deviation > 0 ? '+' : '') + pts(o.deviation)}</td></tr>`).join('');
}
function renderIdent() {
  const c = current, id = out.id;
  $('id-caption').textContent = c.drug === 'bridged'
    ? `Declared: k = ${num(c.k)}, kill probability ${num(id.pEffRef, 3)} at the declared dose. Rival: k = ${num(id.alternative.k)}, maximum p re-solved to ${num(id.alternative.p, 3)}, giving ${num(id.pEffAlt, 3)} at the same dose.`
    : `Declared: k = ${num(c.k)}, p = ${num(c.p, 2)}. Rival: k = ${num(id.alternative.k)}, p = ${num(id.alternative.p, 2)}, chosen so the reference well matches.`;
  $('ident').innerHTML = id.span.map(s => `<tr${s.factor === 1 ? ' class="ref"' : ''}><td>${num(s.factor, 2)}× · ${num(c.E * s.factor)} E + ${num(c.T * s.factor)} T</td><td class="num">${pct(s.lysisA)}</td><td class="num">${pct(s.lysisB)}</td><td class="num">${pct(s.conjA)}</td><td class="num">${pct(s.conjB)}</td></tr>`).join('');
  $('id-note').textContent = `Across the whole window the two explanations never differ by more than ${pts(id.maxLysisGap)} of lysis, but at ${c.readTime} h the rival holds ${num(id.conjugateRatio, 2)}× as many targets in conjugates. A conjugate readout, by imaging or flow, separates them; a lysis endpoint does not.`;
}
function color(k) { return getComputedStyle(document.documentElement).getPropertyValue(k).trim(); }
function setup(canvas, exporting, w, h) {
  const width = exporting ? w : Math.max(canvas.clientWidth, 260);
  const height = exporting ? h : canvas.clientHeight;
  const dpr = exporting ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr; canvas.height = height * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  g.fillStyle = color('--surface'); g.fillRect(0, 0, width, height);
  return {g, width, height};
}
function drawTime(canvas = $('time'), exporting = false) {
  const c = current, {g, width, height} = setup(canvas, exporting, 1440, 860);
  const top = exporting ? 150 : 24, bottom = exporting ? 236 : 46, left = exporting ? 84 : 52, right = exporting ? 96 : 18;
  const W = width - left - right, H = height - top - bottom;
  const yMax = Math.max(0.2, ...out.runs.flatMap(r => r.sim.rows.map(x => x.lysis))) * 1.12;
  const X = t => left + t / c.window * W, Y = v => top + H * (1 - v / yMax);
  g.font = `${exporting ? 17 : 12}px 'DM Sans',sans-serif`;
  g.strokeStyle = color('--line'); g.fillStyle = color('--muted'); g.lineWidth = 1;
  const step = yMax > 0.6 ? 0.2 : yMax > 0.3 ? 0.1 : 0.05;
  for (let v = 0; v <= yMax; v += step) {
    const y = Y(v); g.beginPath(); g.moveTo(left, y); g.lineTo(width - right, y); g.stroke();
    g.textAlign = 'right'; g.fillText(`${Math.round(v * 100)}%`, left - 8, y + 4);
  }
  for (let i = 0; i <= 4; i++) { const t = c.window * i / 4; g.textAlign = 'center'; g.fillText(`${+t.toFixed(2)}`, X(t), top + H + 23); }
  g.fillText('Time in co-culture (h)', left + W / 2, top + H + (exporting ? 55 : 42));
  const cols = ['--muted', '--teal', '--amber'];
  out.runs.forEach((r, i) => {
    g.strokeStyle = color(cols[i]); g.lineWidth = i === 1 ? (exporting ? 4 : 2.6) : 2; g.setLineDash(i === 1 ? [] : [7, 5]);
    g.beginPath(); r.sim.rows.forEach((x, j) => j ? g.lineTo(X(x.time), Y(x.lysis)) : g.moveTo(X(x.time), Y(x.lysis)));
    g.stroke(); g.setLineDash([]);
    if (exporting) { const e = r.sim.rows[r.sim.rows.length - 1]; g.fillStyle = color(cols[i]); g.textAlign = 'left'; g.fillText(`${num(r.f)}×`, X(e.time) + 10, Y(e.lysis) + 6); }
  });
  g.strokeStyle = color('--muted'); g.setLineDash([3, 5]); g.beginPath(); g.moveTo(X(c.readTime), top); g.lineTo(X(c.readTime), top + H); g.stroke(); g.setLineDash([]);
  g.fillStyle = color('--muted'); g.textAlign = 'left'; g.fillText('contact read', X(c.readTime) + 6, top + 14);
  if (exporting) {
    g.textAlign = 'left'; g.fillStyle = color('--muted'); g.font = "14px 'DM Sans',sans-serif";
    g.fillText('DATA-RICH, INSIGHT-POOR  /  99 SMALL PROBLEMS  /  NO. 05', left, 36);
    g.fillStyle = color('--ink'); g.font = "34px 'DM Sans',sans-serif"; g.fillText('Encounter Check', left, 80);
    g.font = "18px 'DM Sans',sans-serif";
    g.fillText(`${ratio(out.ix.ratio)} held fixed: ${pct(out.scan.low)} to ${pct(out.scan.high)} lysis across a ${num(c.densityHigh / c.densityLow)}-fold density span.`, left, 116);
    const y = height - 112; g.font = "16px 'DM Sans',sans-serif"; g.fillStyle = color('--muted');
    g.fillText(`Curves: ${num(c.densityLow)}×, 1× and ${num(c.densityHigh)}× the reference cell numbers at the same ratio. Effector-attributed lysis.`, left, y);
    g.fillText(`${c.geometry === "settled" ? "Settled" : "Bulk"} geometry; k ${num(c.k)} ${M.units(c).k}; conjugate ${num(c.tauC)} h; p ${num(c.p, 2)}; ${c.killMode === 'single' ? 'single-use effectors' : `recovery ${num(c.tauR)} h`}; background ${num(c.kbg)} /h.`, left, y + 28);
    g.fillText(`Well: ${num(c.volume)} µL over ${num(c.area)} mm²; search fraction ${num(out.ix.searchFraction, 2)}; density elasticity ${num(out.scan.elasticity, 2)}.`, left, y + 56);
    g.fillText(`v${M.VERSION} · synthetic parameters · forward simulation`, left, y + 84);
  }
}
function drawMap(canvas = $('map')) {
  const c = current, m = out.map, {g, width, height} = setup(canvas, false, 0, 0);
  const top = 20, bottom = 52, left = 70, right = 100;
  const W = width - left - right, H = height - top - bottom;
  const lo = Math.log(m.factors[0]), hi = Math.log(m.factors.at(-1));
  const X = f => left + (Math.log(f) - lo) / (hi - lo) * W, Y = f => top + H * (1 - (Math.log(f) - lo) / (hi - lo));
  const maxL = Math.max(...m.cells.map(x => x.lysis)) || 1;
  const cw = W / (m.n - 1), ch = H / (m.n - 1);
  const teal = color('--teal'), surf = color('--surface');
  const mix = t => {
    const p = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const a = p(surf.length === 7 ? surf : '#182126'), b = p(teal.length === 7 ? teal : '#7dd5c8');
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  };
  g.save(); g.beginPath(); g.rect(left, top, W, H); g.clip();
  for (const cell of m.cells) {
    g.fillStyle = mix(cell.lysis / maxL);
    g.fillRect(X(cell.fe) - cw / 2, Y(cell.ft) - ch / 2, cw + 1, ch + 1);
  }
  g.strokeStyle = color('--muted'); g.lineWidth = 1; g.setLineDash([4, 4]); g.globalAlpha = 0.7;
  for (const q of [0.25, 1, 4]) {
    g.beginPath();
    g.moveTo(X(m.factors[0]), Y(m.factors[0] / q));
    g.lineTo(X(m.factors.at(-1)), Y(m.factors.at(-1) / q));
    g.stroke();
  }
  g.restore(); g.setLineDash([]); g.globalAlpha = 1;
  g.strokeStyle = color('--ink'); g.lineWidth = 2; g.beginPath(); g.arc(X(1), Y(1), 6, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = color('--line'); g.lineWidth = 1; g.strokeRect(left, top, W, H);
  g.font = "12px 'DM Sans',sans-serif"; g.fillStyle = color('--muted');
  for (const f of [m.factors[0], 1, m.factors.at(-1)]) {
    g.textAlign = 'center'; g.fillText(num(c.E * f), X(f), top + H + 20);
    g.textAlign = 'right'; g.fillText(num(c.T * f), left - 8, Y(f) + 4);
  }
  g.textAlign = 'center'; g.fillText('Effector cells per well', left + W / 2, top + H + 42);
  g.save(); g.translate(16, top + H / 2); g.rotate(-Math.PI / 2); g.fillText('Target cells per well', 0, 0); g.restore();
  const bx = width - right + 22, bw = 14;
  for (let i = 0; i <= 60; i++) { g.fillStyle = mix(i / 60); g.fillRect(bx, top + H - (i + 1) * H / 61, bw, H / 61 + 1); }
  g.strokeStyle = color('--line'); g.strokeRect(bx, top, bw, H);
  g.fillStyle = color('--muted'); g.textAlign = 'left';
  g.fillText(pct(maxL, 0), bx + bw + 6, top + 10); g.fillText('0%', bx + bw + 6, top + H);
}
function drawAll() { drawTime(); drawMap(); if (out.dose && !$('drug-on').hidden) drawDose(); }
function buildPlate() {
  try {
    const list = id => $(id).value.split(/[,\s]+/).filter(Boolean).map(Number);
    const spec = {ratios: list('pl-ratios'), targets: list('pl-targets'), volumes: list('pl-volumes'), replicates: Number($('pl-reps').value)};
    if (current.drug === 'bridged') spec.doses = list('pl-doses'); else if (current.plate?.doses) spec.doses = current.plate.doses;
    const p = M.plateMap(current, spec);
    current.plate = spec;
    const maxL = Math.max(...p.wells.map(w => w[current.geometry])) || 1;
    const head = ['<span></span>', ...Array.from({length: 12}, (_, i) => `<span>${i + 1}</span>`)];
    const rowsUsed = Math.ceil(p.total / 12);
    const cells = [];
    for (let r = 0; r < rowsUsed; r++) {
      cells.push(`<span>${'ABCDEFGH'[r]}</span>`);
      for (let col = 0; col < 12; col++) {
        const w = p.wells[r * 12 + col];
        if (!w) { cells.push('<b style="opacity:.25"></b>'); continue; }
        const t = w[current.geometry] / maxL;
        cells.push(`<b class="${w.crowded ? 'crowded' : ''}" style="background:color-mix(in srgb, var(--teal) ${Math.round(t * 88)}%, var(--surface))" title="${w.well} · ${ratio(w.ratio)} · ${num(w.T)} targets · ${num(w.volume)} µL${current.drug === 'bridged' ? ` · ${num(w.dose)} pM` : ''} · ${pct(w[current.geometry])}">${w.condition}</b>`);
      }
    }
    $('plate-grid').innerHTML = head.join('') + cells.join('');
    $('plate-table').innerHTML = p.conditions.map((d, i) => `<tr><td class="num">${i + 1}</td><td class="num">${ratio(d.ratio)}</td><td class="num">${num(d.E)}</td><td class="num">${num(d.T)}</td><td class="num">${num(d.volume)}</td>${current.drug === 'bridged' ? `<td class="num">${num(d.dose)}</td><td class="num">${pct(d.freeFraction)}</td>` : ''}<td class="num">${pct(d.settled)}</td><td class="num">${pct(d.bulk)}</td><td class="num">${pct(d.conjugated)}</td><td class="num">${num(d.searchFraction, 2)}</td><td class="num ${d.crowded ? 'warn' : ''}">${pct(d.coverage)}</td></tr>`).join('');
    const rows = p.conditions.filter(d => d.volume === p.conditions[0].volume && d.dose === p.conditions[0].dose && Math.abs(d.ratio - p.conditions[0].ratio) < 1e-12);
    const slope = rows.length > 1 ? Math.abs(rows.at(-1).settled - rows[0].settled) : NaN;
    $('plate-status').className = 'hint';
    $('plate-status').textContent = `${p.conditions.length} conditions × ${spec.replicates} = ${p.total} wells. At the lowest ratio, changing target count alone moves predicted lysis by ${Number.isFinite(slope) ? pts(slope) : '—'}; ratio-only thinking predicts zero.`;
    $('plate-csv').disabled = false;
  } catch (e) {
    $('plate-status').className = 'hint error';
    $('plate-status').textContent = e.message;
    $('plate-csv').disabled = true;
  }
}
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
for (const id of fields) $(id).addEventListener('input', () => { syncForm(); markDirty(); });
$('controls').addEventListener('submit', e => { e.preventDefault(); try { calculate(read()); } catch (err) { fail(err); } });
$('preset').innerHTML = M.PRESET_NAMES.map(n => `<option value="${n}">${M.presetLabel(n)}</option>`).join('');
$('load').addEventListener('click', () => { const c = M.preset($('preset').value); fill(c); calculate(c); });
$('plate-form').addEventListener('submit', e => { e.preventDefault(); if (!dirty) buildPlate(); });
$('theme').addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  $('theme').textContent = light ? 'Dark mode' : 'Light mode';
  if (out) { drawAll(); buildPlate(); }
});
$('png').addEventListener('click', () => {
  if (dirty) return;
  const c = document.createElement('canvas'); drawTime(c, true);
  c.toBlob(b => { if (b) download(b, 'encounter-check-figure.png', 'image/png'); });
  $('export-status').textContent = 'The figure carries the parameter summary and model version. Keep its scenario JSON with it.';
});
$('csv').addEventListener('click', () => {
  if (dirty) return;
  download(M.timeCsv(current), 'encounter-check-time-course.csv', 'text/csv');
  $('export-status').textContent = 'Time course contains every state variable and derived fraction on the plotted grid.';
});
$('plate-csv').addEventListener('click', () => {
  if (dirty) return;
  download(M.plateCsv(current), 'encounter-check-plate-map.csv', 'text/csv');
  $('export-status').textContent = 'Plate map lists well positions, conditions, and predictions under both matched geometries.';
});
$('dose-png').addEventListener('click', () => {
  if (dirty || !out.dose) return;
  const cv = document.createElement('canvas'); drawDose(cv, true);
  cv.toBlob(b => { if (b) download(b, 'encounter-check-dose-figure.png', 'image/png'); });
  $('export-status').textContent = 'The dose figure carries the binding parameters and model version.';
});
$('dose-csv').addEventListener('click', () => {
  if (dirty || !out.dose) return;
  download(M.doseCsv(current), 'encounter-check-dose-response.csv', 'text/csv');
  $('export-status').textContent = 'Dose response lists lysis at each total dose for three densities, with and without drug bound by cells.';
});
$('json').addEventListener('click', () => {
  if (dirty) return;
  download(M.pack(current), 'encounter-check-scenario.json', 'application/json');
  $('export-status').textContent = 'Scenario JSON holds every input and the plate design. Import recalculates everything locally.';
});
$('import').addEventListener('change', async e => {
  try {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 100000) throw new Error('Scenario exceeds the 100 kB import limit.');
    const c = M.unpack(await file.text());
    current = c; fill(c); calculate(c);
    $('export-status').textContent = 'Scenario imported and recalculated locally.';
  } catch (err) {
    $('export-status').textContent = `Import rejected: ${err.message}. The previous scenario is unchanged.`;
  } finally { e.target.value = ''; }
});
new ResizeObserver(() => { if (out) drawAll(); }).observe($('results'));
document.fonts.ready.then(() => { if (out) drawAll(); });
const start = M.preset();
current = start; fill(start); calculate(start);
