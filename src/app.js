(() => {
'use strict';

/* ---------- Segédfüggvények ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const huSort = arr => [...arr].sort((a, b) => a.localeCompare(b, 'hu'));
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => iso(new Date());
const fd = v => /^\d{4}-\d\d-\d\d$/.test(v) ? v.replace(/-/g, '.') + '.' : (v || '');
const dur = a => a.full ? 'Egész nap' : (a.lf === a.lt ? a.lf + '. óra' : a.lf + '–' + a.lt + '. óra');
const range = a => a.from === a.to ? fd(a.from) : fd(a.from) + ' – ' + fd(a.to);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
  return null;
}

/* ---------- Adatok (localStorage) ---------- */
const KEY = 'hianyzaskovet_v1';
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.students) return d;
  } catch (e) { /* üres adatból indulunk */ }
  return {
    students: [], absences: [],
    reporters: ['Diák', 'Szülő', 'Tanár'],
    reasons: ['Családi ok', 'Orvosi vizsgálat', 'Verseny', 'Zeneiskola'],
    theme: null
  };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('A mentés nem sikerült.'); }
}

/* ---------- Világos / sötét üzemmód ---------- */
function applyTheme() {
  const t = S.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
  $('#themeBtn').textContent = t === 'dark' ? 'Világos' : 'Sötét';
}
$('#themeBtn').onclick = () => {
  S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
};

/* ---------- Közös űrlap (rögzítés + módosítás) ---------- */
const lessonOpts = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option>${n}</option>`).join('');
const formHTML = p => `
  <div class="row2">
    <label>Mettől<input type="date" id="${p}from"></label>
    <label>Meddig<input type="date" id="${p}to"></label>
  </div>
  <fieldset>
    <legend>Időtartam</legend>
    <label class="chk"><input type="radio" name="${p}dur" value="full" checked> Egész tanítási nap</label>
    <label class="chk"><input type="radio" name="${p}dur" value="les"> Megadott órák</label>
    <div class="row2" id="${p}les" hidden>
      <label>Hanyadik órától<select id="${p}lf">${lessonOpts}</select></label>
      <label>Hanyadik óráig<select id="${p}lt">${lessonOpts}</select></label>
    </div>
  </fieldset>
  <label>Ki jelentette be?<select id="${p}rep"></select></label>
  <label>Milyen okkal?<select id="${p}reason"></select></label>`;

document.addEventListener('change', e => {
  const t = e.target;
  if (t.type === 'radio' && t.name && t.name.endsWith('dur')) {
    $('#' + t.name.slice(0, -3) + 'les').hidden = t.value !== 'les';
  }
});

function fillSel(id, list, extra) {
  const el = $('#' + id), v = extra || el.value;
  const all = list.includes(v) || !v ? list : [...list, v];
  el.innerHTML = '<option value="">– válassz –</option>' +
    huSort(all).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  el.value = v && all.includes(v) ? v : '';
}

function readForm(p) {
  const f = {
    from: $('#' + p + 'from').value,
    to: $('#' + p + 'to').value,
    full: document.querySelector(`input[name=${p}dur]:checked`).value === 'full',
    lf: +$('#' + p + 'lf').value,
    lt: +$('#' + p + 'lt').value,
    reporter: $('#' + p + 'rep').value,
    reason: $('#' + p + 'reason').value
  };
  if (!f.from || !f.to) return toast('Add meg a dátumokat.');
  if (f.to < f.from) return toast('A záró dátum nem lehet korábbi a kezdőnél.');
  if (!f.full && f.lt < f.lf) return toast('Az utolsó óra nem lehet korábbi az elsőnél.');
  if (!f.reporter) return toast('Válaszd ki, ki jelentette be.');
  if (!f.reason) return toast('Válaszd ki a hiányzás okát.');
  return f;
}

$('#recForm').innerHTML = formHTML('r');
$('#editForm').innerHTML = formHTML('e');
$('#rfrom').value = $('#rto').value = today();

/* ---------- Rögzítés fül ---------- */
const sortedStudents = () => [...S.students].sort((a, b) => a.name.localeCompare(b.name, 'hu'));

function renderRec() {
  const checked = new Set([...document.querySelectorAll('#stList input:checked')].map(i => i.value));
  const list = sortedStudents();
  $('#stList').innerHTML = list.length
    ? list.map(s => `<label class="chk"><input type="checkbox" value="${s.id}" ${checked.has(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')
    : '<p class="empty">Még nincs diák. Importáld őket a Beállítások fülön, vagy add hozzá a Diákok fülön.</p>';
  fillSel('rrep', S.reporters);
  fillSel('rreason', S.reasons);
}

$('#saveBtn').onclick = () => {
  const ids = [...document.querySelectorAll('#stList input:checked')].map(i => i.value);
  if (!ids.length) return toast('Jelölj be legalább egy diákot.');
  const f = readForm('r');
  if (!f) return;
  ids.forEach(id => {
    const s = S.students.find(x => x.id === id);
    if (s) S.absences.push({ id: uid(), sid: id, name: s.name, ...f });
  });
  save();
  document.querySelectorAll('#stList input').forEach(i => { i.checked = false; });
  toast(ids.length + ' hiányzás rögzítve.');
};

/* ---------- Diákok fül ---------- */
function renderStu() {
  const list = sortedStudents();
  $('#stuCount').textContent = 'Diákok (' + list.length + ')';
  $('#stuList').innerHTML = list.length
    ? list.map(s => `<div class="item"><div class="grow"><b>${esc(s.name)}</b><br>
        <small>Születési idő: ${esc(fd(s.birth)) || '–'}<br>Anyja neve: ${esc(s.mother) || '–'}</small></div>
        <button type="button" class="btn danger sm" data-stdel="${s.id}">Törlés</button></div>`).join('')
    : '<p class="empty">Nincs diák a listában.</p>';
}

$('#addStu').onclick = () => {
  const name = $('#nn').value.trim();
  if (!name) return toast('Add meg a diák nevét.');
  S.students.push({ id: uid(), name, birth: $('#nb').value, mother: $('#nm').value.trim() });
  save();
  $('#nn').value = $('#nb').value = $('#nm').value = '';
  renderStu(); toast('Diák hozzáadva.');
};

$('#delAll').onclick = () => {
  if (!S.students.length) return toast('Nincs törölhető diák.');
  if (confirm('Biztosan törlöd az összes diákot? A rögzített hiányzások megmaradnak a statisztikában.')) {
    S.students = []; save(); renderStu(); toast('Minden diák törölve.');
  }
};

/* ---------- Statisztika fül ---------- */
let mode = 'date';
const byDate = (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.name.localeCompare(b.name, 'hu');

function filtered() {
  const sf = $('#sf').value, st = $('#st').value;
  return S.absences.filter(a => (!sf || a.to >= sf) && (!st || a.from <= st)).sort(byDate);
}

function item(a) {
  const main = mode === 'date' ? esc(a.name) : esc(range(a));
  const line = mode === 'date' ? esc(range(a)) + ' · ' + esc(dur(a)) : esc(dur(a));
  return `<div class="item"><div class="grow"><b>${main}</b><br>${line}<br>
    <small>${esc(a.reporter)}, ${esc(a.reason)}</small></div>
    <button type="button" class="btn ghost sm" data-edit="${a.id}">Módosít</button>
    <button type="button" class="btn danger sm" data-del="${a.id}">Töröl</button></div>`;
}

function renderStat() {
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  let list = filtered();
  $('#sCount').textContent = list.length + ' bejegyzés';
  if (!list.length) { $('#statList').innerHTML = '<p class="empty">Nincs megjeleníthető hiányzás.</p>'; return; }
  if (mode === 'student') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'hu') || byDate(a, b));
  const groups = [], map = new Map();
  list.forEach(a => {
    const k = mode === 'date' ? a.from : a.sid + '|' + a.name;
    if (!map.has(k)) { const g = { label: mode === 'date' ? fd(a.from) : a.name, items: [] }; map.set(k, g); groups.push(g); }
    map.get(k).items.push(a);
  });
  $('#statList').innerHTML = groups.map(g =>
    `<div class="group"><h3>${esc(g.label)}<span>${g.items.length}</span></h3>${g.items.map(item).join('')}</div>`).join('');
}

document.querySelectorAll('.seg button').forEach(b => { b.onclick = () => { mode = b.dataset.mode; renderStat(); }; });
$('#sf').onchange = $('#st').onchange = renderStat;

/* Módosítás */
let editId = null;
function openEdit(id) {
  const a = S.absences.find(x => x.id === id);
  if (!a) return;
  editId = id;
  $('#eName').textContent = a.name;
  $('#efrom').value = a.from; $('#eto').value = a.to;
  document.querySelector(`input[name=edur][value=${a.full ? 'full' : 'les'}]`).checked = true;
  $('#eles').hidden = a.full;
  $('#elf').value = a.lf || 1; $('#elt').value = a.lt || 1;
  fillSel('erep', S.reporters, a.reporter);
  fillSel('ereason', S.reasons, a.reason);
  $('#modal').hidden = false;
}
$('#eCancel').onclick = () => { $('#modal').hidden = true; };
$('#eSave').onclick = () => {
  const f = readForm('e');
  if (!f) return;
  Object.assign(S.absences.find(x => x.id === editId), f);
  save(); $('#modal').hidden = true; renderStat(); toast('Bejegyzés módosítva.');
};

/* Excel export + megosztás (e-mail, Drive, stb.) */
$('#expBtn').onclick = async () => {
  const list = filtered();
  if (!list.length) return toast('Nincs exportálható bejegyzés.');
  const rows = [['Diák', 'Mettől', 'Meddig', 'Időtartam', 'Bejelentő', 'Ok']]
    .concat(list.map(a => [a.name, fd(a.from), fd(a.to), dur(a), a.reporter, a.reason]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];

  const counts = {};
  list.forEach(a => { counts[a.name] = (counts[a.name] || 0) + 1; });
  const sum = [['Diák', 'Bejegyzések száma']].concat(huSort(Object.keys(counts)).map(n => [n, counts[n]]));
  const ws2 = XLSX.utils.aoa_to_sheet(sum);
  ws2['!cols'] = [{ wch: 26 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hiányzások');
  XLSX.utils.book_append_sheet(wb, ws2, 'Diákonként');
  const name = 'hianyzasok_' + today() + '.xlsx';
  try {
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) {
      const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const { Filesystem, Share } = Cap.Plugins;
      const r = await Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
      await Share.share({ title: 'Hiányzási statisztika', text: 'Hiányzási statisztika (Excel)', files: [r.uri], dialogTitle: 'Statisztika megosztása' });
    } else {
      XLSX.writeFile(wb, name);
    }
  } catch (e) {
    if (!/cancel/i.test(String(e && e.message))) toast('A megosztás nem sikerült.');
  }
};

/* ---------- Beállítások fül ---------- */
function chips(list, kind) {
  return huSort(list).map(v =>
    `<span class="chip">${esc(v)}<button type="button" data-rm="${kind}" data-v="${esc(v)}" aria-label="Törlés">×</button></span>`).join('')
    || '<span class="muted">Nincs elem.</span>';
}
function renderSet() {
  $('#repList').innerHTML = chips(S.reporters, 'reporters');
  $('#reasonList').innerHTML = chips(S.reasons, 'reasons');
}
function addTo(key, inputId) {
  const v = $(inputId).value.trim();
  if (!v) return;
  if (S[key].some(x => x.toLowerCase() === v.toLowerCase())) return toast('Ez már szerepel a listában.');
  S[key].push(v); save();
  $(inputId).value = '';
  renderSet(); toast('Hozzáadva.');
}
$('#addRep').onclick = () => addTo('reporters', '#newRep');
$('#addReason').onclick = () => addTo('reasons', '#newReason');

/* Excel import */
function cellDate(v) {
  if (v instanceof Date) return iso(new Date(v.getTime() + 12 * 3600 * 1000));
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    return p ? p.y + '-' + pad(p.m) + '-' + pad(p.d) : String(v);
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})[.\-\/ ]+(\d{1,2})[.\-\/ ]+(\d{1,2})\.?$/);
  return m ? m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]) : s;
}
$('#xlsFile').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const wb = XLSX.read(reader.result, { type: 'array', cellDates: true });
      let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      if (rows.length && /n[ée]v/i.test(String(rows[0][0])) && !/\d/.test(String(rows[0][0]))) rows = rows.slice(1);
      const found = rows
        .map(r => ({ name: String(r[0] ?? '').trim(), birth: cellDate(r[1]), mother: String(r[2] ?? '').trim() }))
        .filter(x => x.name);
      const key = x => (x.name + '|' + x.birth).toLowerCase();
      const have = new Set(S.students.map(key));
      const fresh = found.filter(x => !have.has(key(x)));
      if (!found.length) return toast('Nem találtam diákot a fájlban.');
      if (!fresh.length) return toast('Minden diák már szerepel a listában.');
      if (confirm(fresh.length + ' új diák importálható. Hozzáadjam őket?')) {
        fresh.forEach(x => S.students.push({ id: uid(), ...x }));
        save(); toast(fresh.length + ' diák importálva.');
      }
    } catch (err) {
      toast('A fájl nem olvasható. Excel (.xlsx) fájlt válassz.');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
};

/* ---------- Gombok a listákban ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.edit) openEdit(b.dataset.edit);
  else if (b.dataset.del) {
    if (confirm('Biztosan törlöd ezt a bejegyzést?')) {
      S.absences = S.absences.filter(a => a.id !== b.dataset.del);
      save(); renderStat();
    }
  } else if (b.dataset.stdel) {
    const s = S.students.find(x => x.id === b.dataset.stdel);
    if (s && confirm(s.name + ' törlése? A rögzített hiányzásai megmaradnak.')) {
      S.students = S.students.filter(x => x.id !== s.id);
      save(); renderStu();
    }
  } else if (b.dataset.rm) {
    if (confirm('Törlöd ezt az elemet a listából? A korábbi bejegyzések nem változnak.')) {
      S[b.dataset.rm] = S[b.dataset.rm].filter(x => x !== b.dataset.v);
      save(); renderSet();
    }
  }
});

/* ---------- Fülek ---------- */
const renderers = { rec: renderRec, stu: renderStu, stat: renderStat, set: renderSet };
function showTab(t) {
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + t));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  renderers[t]();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

applyTheme();
showTab('rec');
})();
