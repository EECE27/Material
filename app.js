// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Long text: supports [label](https://url), bare https:// links, and line breaks
function rich(t = '') {
  return esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/\n/g, '<br>');
}

// ---------- item formats ----------
const label = (name, key, i) => {
  let s = i.text ?? (i[key] != null ? `${name} ${i[key]}` : '');
  if (i.till) s += (s ? ' ' : '') + 'till slide ' + i.till;
  if (i.note) s += (s ? ' – ' : '') + i.note;
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmt = {
  slides:      i => label('Lecture', 'lecture', i),
  tutorials:   i => label('Tutorial', 'tutorial', i),
  assignments: i => label('Assignment', 'assignment', i),
  sheets: i => (i.text ?? `Sheet ${i.sheet}` + (i.q ? ` Q ${i.q}` : '') + (i.except ? ` except Q ${i.except}` : '')) + (i.note ? ` – ${i.note}` : '')
};
const KINDS = [['slides', 'Slides'], ['sheets', 'Sheets'], ['tutorials', 'Tutorials'], ['assignments', 'Assignments']];

// Renders slides / sheets / tutorials of one week (or one midterm); empty kinds are skipped
function contentBlock(c = {}) {
  const html = KINDS.filter(([k]) => c[k]?.length).map(([k, label]) =>
    `<div class="kind"><h4>${label}</h4><ul>${c[k].map(i =>
      `<li>${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">${fmt[k](i)}</a>` : fmt[k](i)}</li>`).join('')}</ul></div>`
  ).join('');
  return html || '<p class="muted">Nothing listed.</p>';
}

function guideBlock(text,dir) {
  return `<div class="guide">
    <div class="guide-toolbar"><strong>Guide</strong><button class="guide-direction" type="button" aria-pressed="true" aria-label="Switch guide text to left-to-right">RTL</button></div>
    <div class="guide-content" dir="${dir}">${rich(text)}</div>
  </div>`;
}

const sortedWeeks = s => [...(s.weeks || [])].sort((a, b) => b.week - a.week); // latest first
const cover = s => `img/${s.id}.jpg`;
const logoImg = (id, alt, cls = '') => `<img class="logo ${cls}" src="img/${id}.jpg" alt="${esc(alt)}">`;

// ---------- data + layout ----------
async function load() {
  const [data, config] = await Promise.all([
    fetch('data.json').then(r => r.json()),
    fetch('config.json').then(r => r.json())
  ]);
  document.title = config.siteTitle + ' – ' + document.title;
  $('#nav').innerHTML = `<a href="index.html">Home</a><a href="midterm.html">Midterm</a>`;
  $('#app').addEventListener('click', event => {
    const button = event.target.closest('.guide-direction');
    if (!button) return;
    const content = button.closest('.guide').querySelector('.guide-content');
    content.dir = content.dir === 'rtl' ? 'ltr' : 'rtl';
    const isRtl = content.dir === 'rtl';
    button.textContent = isRtl ? 'RTL' : 'LTR';
    button.setAttribute('aria-pressed', String(isRtl));
    button.setAttribute('aria-label', `Switch guide text to ${isRtl ? 'left-to-right' : 'right-to-left'}`);
  });
  return { data, config };
}

// ---------- pages ----------
async function homePage() {
  const { data, config } = await load();
  let out = '';
  const a = config.midtermAnnouncement;
  if (config.showMidtermAnnouncement && a)
    out += `<a class="banner" href="midterm.html"><strong>${esc(a.title)}</strong> ${esc(a.text)}</a>`;

  for (const g of data.groups) {
    const subs = data.subjects.filter(s => s.group === g.id);
    if (!subs.length) continue;
    out += `<h2>${esc(g.name)}</h2><div class="grid">` + subs.map(s => {
      const w = sortedWeeks(s)[0];
      return `<article class="card">
        <a href="subject.html?id=${s.id}"><img src="${cover(s)}" alt="${esc(s.name)}"></a>
        <div class="body"><h3><a href="subject.html?id=${s.id}">${esc(s.name)}</a></h3>
        ${w ? `<p class="muted">Week ${w.week}</p>${contentBlock(w)}` : '<p class="muted">No content yet.</p>'}</div></article>`;
    }).join('') + '</div>';
  }
  $('#app').innerHTML = out;
}

async function subjectPage() {
  const { data } = await load();
  const s = data.subjects.find(x => x.id === new URLSearchParams(location.search).get('id'));
  if (!s) { $('#app').innerHTML = '<p>Subject not found. <a href="index.html">Back to home</a></p>'; return; }
  document.title = s.name;
  const exam = data.midterm?.exams.find(e => e.subject === s.id);
  let out = `<div class="title">${logoImg(s.id, s.name, 'lg')}<div><h1>${esc(s.name)}</h1><p class="muted">${esc(data.groups.find(g => g.id === s.group)?.name)}</p></div></div>`;
  if (s.description) out += `<section class="panel">${rich(s.description)}</section>`;
  if (exam) out += `<a class="banner" href="midterm.html#${s.id}">Midterm: ${esc(exam.day)} ${esc(exam.date)}, ${esc(exam.time)}</a>`;
  const weeks = sortedWeeks(s);
  out += weeks.length
    ? weeks.map(w => `<section class="panel"><h3>Week ${w.week}</h3>${contentBlock(w)}</section>`).join('')
    : '<p class="muted">No weekly content yet.</p>';
  $('#app').innerHTML = out;
}

async function midtermPage() {
  const { data } = await load();
  const m = data.midterm, name = id => data.subjects.find(s => s.id === id)?.name || id;
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  let out = `<h1>Midterm</h1><table class="sched"><thead><tr><th>Day</th><th>Date</th><th>Exams</th></tr></thead><tbody>`;
  for (const d of days) {
    const ex = m.exams.filter(e => e.day === d);
    out += `<tr><td>${d}</td><td>${esc(ex[0]?.date || '')}</td><td>` + (ex.length
      ? ex.map(e => `<div class="exam">${logoImg(e.subject, name(e.subject), 'sm')}<a href="#${e.subject}"><strong>${esc(name(e.subject))}</strong></a> – ${esc(e.time)}${e.duration ? ` (${esc(e.duration)})` : ''}</div>`).join('')
      : '<span class="muted">None</span>') + `</td></tr>`;
  }
  out += `</tbody></table>`;
  if (m.note) out += `<section class="panel">${rich(m.note)}</section>`;
  out += m.exams.map(e => `<section class="panel" id="${e.subject}"><div class="title">${logoImg(e.subject, name(e.subject), 'md')}<h2>${esc(name(e.subject))}</h2></div>
    <p class="muted">${esc(e.day)} ${esc(e.date)} – ${esc(e.time)}${e.duration ? ` (${esc(e.duration)})` : ''}</p>
    ${contentBlock(e.content)}${e.content?.guide ? guideBlock(e.content.guide,e.content.guide_dir?e.content.guide_dir:"ltr") : ''}</section>`).join('');
  $('#app').innerHTML = out;
}
