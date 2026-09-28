import { puzzles } from './puzzles.mjs';
import { checkSwap, tradeAnswer, guessKey, solvedAnswer, hintTargets, revealHint } from './game.mjs';
import { STORAGE_KEY, puzzleKey, restoreRecord, readProgress, elapsedMs, formatTime, finishRecord, giveUpRecord, pauseRecord, resumeRecord, shareText } from './progress.mjs';

const $ = id => document.getElementById(id);
const shelf = $('shelf'), mat = $('mat'), tray = $('tray'), message = $('message');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPRING = 'cubic-bezier(.2,1.35,.45,1)', SNAP = RM ? 1 : 360;
// How far past the mat's edge a letter has to be pulled before its whole word comes along.
const TEAR = 56;
const CLUE_KEY = 'Yellow: swap this letter. Gray: leave it.';

// ---------- saved progress ----------
let saved = { records: {}, completionDays: [], current: null };
try { saved = readProgress(localStorage); } catch {}
const keys = puzzles.map(puzzleKey);
let records = puzzles.map((p, i) => restoreRecord(p, saved.records[keys[i]]));
const requestedKey = new URL(location.href).searchParams.get('p');
let board = Math.max(0, keys.indexOf(requestedKey || saved.current));
const puzzle = () => puzzles[board], record = () => records[board], state = () => records[board].state;
function persist() {
  saved.current = keys[board]; records.forEach((r, i) => { saved.records[keys[i]] = r; });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {}
}

// ---------- start each puzzle deliberately; pause its clock when it is not visible ----------
function syncClocks() {
  const showing = !document.hidden && !$('help-dialog').open;
  records.forEach((r, i) => {
    if (i !== board || !showing || r.startedAt === null) { pauseRecord(r); return; }
    resumeRecord(r);
  });
}
function refreshClocks() { syncClocks(); persist(); updateStats(); }
function showStartGate() {
  const waiting = record().startedAt === null;
  $('play-area').classList.toggle('waiting', waiting);
  $('start-overlay').hidden = !waiting;
  for (const id of ['tray', 'shelf', 'mat', 'message']) $(id).inert = waiting;
  $('hint').disabled = waiting; $('give-up').disabled = waiting;
}
function startPuzzle() {
  if (record().startedAt !== null) return;
  record().startedAt = Date.now();
  showStartGate(); refreshClocks();
}
function ensureStarted() { if (record().startedAt === null) startPuzzle(); }
function updateStats() {
  const s = state(), plural = (n, word) => `${n} ${word}${n === 1 ? '' : word.endsWith('s') ? 'es' : 's'}`;
  $('timer').textContent = formatTime(elapsedMs(record()));
  $('tally').textContent = [s.misses && plural(s.misses, 'miss'), s.hints && plural(s.hints, 'hint')].filter(Boolean).join(' · ');
}

// ---------- sound: a short filtered click, like a plastic tile set down on a table ----------
let audio = null, soundOn = true;
try { soundOn = localStorage.getItem('spoondle-sound') !== 'off'; } catch {}
const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const SPEAKER_ON = icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>');
const SPEAKER_OFF = icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/>');
const MOON = icon('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>');
const SUN = icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
function showSound() { $('sound').innerHTML = soundOn ? SPEAKER_ON : SPEAKER_OFF; $('sound').setAttribute('aria-pressed', String(soundOn)); $('sound').setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off'); }
function ctx() { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); return audio; }
function clack(kind = 'place', volume = 1) {
  // Phones buzz only once the player has touched the page; before that the browser refuses.
  try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(kind === 'pick' ? 4 : 9); } catch {}
  if (!soundOn) return;
  try {
    const a = ctx(), t = a.currentTime, len = kind === 'pick' ? .016 : .03;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
    src.buffer = buf; filter.type = 'bandpass'; filter.frequency.value = kind === 'pick' ? 3400 : 1700 + Math.random() * 400; filter.Q.value = 1.6;
    gain.gain.value = (kind === 'pick' ? .3 : .75) * volume;
    src.connect(filter).connect(gain).connect(a.destination); src.start(t);
    if (kind !== 'pick') {
      const body = a.createOscillator(), bg = a.createGain();
      body.frequency.value = kind === 'nope' ? 170 : 480 + Math.random() * 80;
      bg.gain.setValueAtTime(.14 * volume, t); bg.gain.exponentialRampToValueAtTime(.001, t + (kind === 'nope' ? .16 : .05));
      body.connect(bg).connect(a.destination); body.start(t); body.stop(t + .2);
    }
  } catch {}
}
function chime() {
  if (!soundOn) return;
  try {
    const a = ctx(), t = a.currentTime;
    [660, 990].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * .09); g.gain.linearRampToValueAtTime(.12, t + i * .09 + .01); g.gain.exponentialRampToValueAtTime(.001, t + i * .09 + .35); o.connect(g).connect(a.destination); o.start(t + i * .09); o.stop(t + i * .09 + .4); });
  } catch {}
}

// ---------- building a board ----------
const homeOf = new Map();
let slots = [], busy = false, press = null, drag = null, picked = null, lastSwap = null, lastWrong = null;
function makeTile(ch, card = null, index = 0) {
  const t = document.createElement('div'); t.className = 'tile'; t.textContent = ch; t.dataset.letter = ch;
  if (card) { t.dataset.card = card; t.dataset.index = index; t.setAttribute('role', 'button'); t.tabIndex = 0; t.setAttribute('aria-label', ch); }
  return t;
}
function makeGap() { const g = document.createElement('div'); g.className = 'gap'; return g; }
function makeWord(card) {
  const w = document.createElement('div'); w.className = 'word'; w.dataset.col = card.column; w.dataset.id = card.id;
  [...card.word].forEach((ch, i) => { const t = makeTile(ch, card.id, i); t.style.setProperty('--r', `${(Math.random() * 4.4 - 2.2).toFixed(2)}deg`); w.append(t); });
  return w;
}
// Clues and hints color the original tiles: amber for a letter to swap, gray for one to leave.
function paintFeedback() {
  const feedback = state().feedback;
  for (const t of document.querySelectorAll('.tile[data-card]')) {
    const status = feedback[t.dataset.card]?.[t.dataset.index];
    if (status) t.dataset.status = status; else delete t.dataset.status;
    t.setAttribute('aria-label', t.dataset.letter + (status === 'swap' ? ', swap this letter' : status === 'stay' ? ', leave this letter' : ''));
  }
}
function fillFound(box, label, revealed) {
  const answer = document.createElement('span'); answer.className = 'answer'; answer.textContent = label;
  box.classList.add('filled'); box.classList.toggle('revealed', revealed);
  box.setAttribute('aria-label', revealed ? `${label}, revealed` : label);
  box.replaceChildren(answer);
  return answer;
}
function build(save = true) {
  const p = puzzle(), s = state(), solvedIds = new Set(s.solved.flat());
  busy = false; picked = null; lastSwap = null; lastWrong = null; homeOf.clear();
  syncClocks();
  $('category').textContent = p.category; $('level').textContent = p.difficulty; $('level').dataset.level = p.difficulty.toLowerCase();
  $('count').textContent = `${board + 1} / ${puzzles.length}${record().finishedAt !== null && !s.revealed ? ' ✓' : ''}`;
  $('prev').disabled = board === 0; $('next').disabled = board === puzzles.length - 1;
  const url = new URL(location.href); url.searchParams.set('p', keys[board]); history.replaceState(null, '', url);
  shelf.replaceChildren(); tray.replaceChildren(); mat.replaceChildren(); mat.className = 'mat'; mat.style.minHeight = '';
  // Size tiles so the longest word fits in a table column and across the mat.
  const longest = Math.max(...p.cards.map(c => c.word.length));
  shelf.style.setProperty('--shelf-s', `${Math.max(20, Math.min(34, Math.floor(((shelf.clientWidth - 12) / 2 - 4 * (longest - 1)) / longest)))}px`);
  mat.style.setProperty('--mat-s', `${Math.min(50, Math.floor((mat.clientWidth - 30 - 6 * (longest - 1)) / longest))}px`);
  const columns = [0, 1].map(c => p.cards.filter(card => card.column === c));
  for (let i = 0; i < columns[0].length; i++) for (const column of columns) {
    const home = document.createElement('div'); home.className = 'home'; const w = makeWord(column[i]);
    home.append(w); homeOf.set(w, home); shelf.append(home);
    if (solvedIds.has(w.dataset.id)) home.classList.add('done');
    // Tapping a word's empty spot on the table calls it back from the mat.
    home.addEventListener('click', () => { if (home.classList.contains('empty') && !busy && w.closest('.slot')) sendHome(w); });
    home.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === home && home.classList.contains('empty')) { e.preventDefault(); sendHome(w); } });
  }
  for (let i = 0; i < p.answers.length; i++) { const f = document.createElement('div'); f.className = 'found'; tray.append(f); }
  s.solved.forEach((ids, i) => fillFound(tray.children[i], solvedAnswer(p, ids).label, i >= s.solved.length - s.revealed));
  slots = [0, 1].map(() => { const slot = document.createElement('div'); slot.className = 'slot'; mat.append(slot); return slot; });
  paintFeedback();
  requestAnimationFrame(() => {
    for (const [w, home] of homeOf) { const r = w.getBoundingClientRect(); home.style.width = `${r.width}px`; home.style.height = `${r.height}px`; }
  });
  if (!RM && record().finishedAt === null) document.querySelectorAll('.home:not(.done) .tile').forEach((t, i) => t.animate([{ transform: 'translateY(-18px) scale(1.12)' }, { transform: 'none' }], { duration: 440, delay: i * 18, easing: SPRING, fill: 'backwards' }));
  showStartGate();
  if (save) persist();
  updateStats(); say();
}
function goTo(index) {
  if (busy || index < 0 || index >= puzzles.length) return;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  board = index; build();
}
function nextUnfinished() {
  for (let step = 1; step < puzzles.length; step++) { const i = (board + step) % puzzles.length; if (records[i].finishedAt === null) return i; }
  return -1;
}

// ---------- the line under the mat ----------
function pill(label, onClick, primary = false) {
  const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'pill primary' : 'pill'; b.textContent = label;
  b.addEventListener('click', () => onClick(b)); return b;
}
function say(parts = null) {
  const p = puzzle(), r = record(), s = state();
  message.replaceChildren();
  $('actions').hidden = r.finishedAt !== null;
  $('hint').disabled = !hintTargets(p, s).length;
  if (r.finishedAt !== null) {
    const next = nextUnfinished();
    message.append(s.revealed ? 'Answers shown.' : `Solved in ${formatTime(elapsedMs(r))}.`, pill('Share', shareResult));
    message.append(next >= 0 ? pill('Next puzzle', () => goTo(next), true) : 'That’s all nine. Thanks for playing!');
    return;
  }
  if (parts) { message.append(...parts); return; }
  const n = slots.filter(slot => slot.querySelector('.word')).length;
  message.textContent = n === 0 ? 'Drag a word onto the mat.' : n === 1 ? 'Now one from the other side.' : 'Drag a letter onto the other word.';
}

// ---------- motion: move elements in the DOM, then animate each from where it was ----------
function flip(els, mutate, { lifted = null, duration = SNAP } = {}) {
  const before = els.map(el => {
    if (lifted && lifted.el === el) { el.style.transform = ''; return { el, r: el.getBoundingClientRect() }; }
    const r = el.getBoundingClientRect();
    // A tile previewing a trade is measured where it shows, then set down without a second slide.
    if (el.style.translate) { el.style.transition = 'none'; el.style.translate = ''; requestAnimationFrame(() => { el.style.transition = ''; }); }
    return { el, r };
  });
  mutate();
  for (const { el, r } of before) {
    if (!el.isConnected) continue;
    const n = el.getBoundingClientRect(), s = n.width ? r.width / n.width : 1;
    let dx = r.left + r.width / 2 - (n.left + n.width / 2), dy = r.top + r.height / 2 - (n.top + n.height / 2), rot = 0, k = 1;
    if (lifted && lifted.el === el) { dx += lifted.ox; dy += lifted.oy; rot = lifted.rot; k = lifted.k; }
    const anim = el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s * k}) rotate(${rot}deg)` }, { transform: 'none' }], { duration, easing: SPRING });
    if (lifted && lifted.el === el) anim.finished.then(() => el.classList.remove('lifted')).catch(() => {});
  }
}
function snapBack(d) {
  const el = d.el; el.style.transform = '';
  el.animate([{ transform: `translate(${d.ox}px,${d.oy}px) scale(${d.k}) rotate(${d.rot}deg)` }, { transform: 'none' }], { duration: SNAP, easing: SPRING })
    .finished.then(() => el.classList.remove('lifted')).catch(() => {});
  clack('place', .5);
}
function domSwap(a, b) { const m = document.createComment(''); a.replaceWith(m); b.replaceWith(a); m.replaceWith(b); }
const inside = (r, x, y, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
const wordOn = side => slots[side]?.querySelector('.word') ?? null;
const text = w => [...w.children].map(t => t.dataset.letter).join('');
function syncSlots() { slots.forEach(slot => slot.classList.toggle('full', !!slot.querySelector('.word'))); }
function markHome(word, empty) {
  const home = homeOf.get(word); home.classList.toggle('empty', empty);
  if (empty) { home.tabIndex = 0; home.setAttribute('role', 'button'); home.setAttribute('aria-label', `Put ${text(word)} back`); }
  else { home.removeAttribute('tabindex'); home.removeAttribute('role'); home.removeAttribute('aria-label'); }
}

// ---------- the rules: words go to the mat; letters trade between the two words there ----------
function placeWord(word, lifted = null) {
  ensureStarted();
  const side = +word.dataset.col, old = wordOn(side);
  if (old === word) { if (lifted) snapBack(lifted); return; }
  flip(old ? [word, old] : [word], () => {
    if (old) { homeOf.get(old).append(old); markHome(old, false); }
    slots[side].append(word); markHome(word, true); syncSlots();
  }, { lifted });
  clack('place'); lastWrong = null; say();
}
function sendHome(word, lifted = null) {
  if (picked) { picked.classList.remove('picked'); picked = null; }
  flip([word], () => { homeOf.get(word).append(word); markHome(word, false); syncSlots(); }, { lifted });
  clack('place', .8); lastWrong = null; say();
}
function trade(a, b, lifted = null) {
  ensureStarted();
  const wa = a.parentNode, wb = b.parentNode;
  const ids = [wa.dataset.id, wb.dataset.id], positions = [+a.dataset.index, +b.dataset.index];
  flip([a, b], () => domSwap(a, b), { lifted });
  clack('place'); lastSwap = [a, b]; lastWrong = null;
  const unchanged = a.dataset.letter === b.dataset.letter, hit = unchanged ? null : tradeAnswer(puzzle(), ids, positions);
  busy = true;
  setTimeout(() => {
    if (!hit) return nope(unchanged ? null : { ids, positions });
    checkSwap(puzzle(), state(), ids, positions);
    finishRecord(puzzle(), record(), saved.completionDays);
    persist(); updateStats();
    solve(hit, hit.ids[0] === ids[0] ? [wa, wb] : [wb, wa]);
  }, 220);
}
function nope(wrong) {
  clack('nope', .7);
  if (!RM) slots.forEach(slot => slot.querySelector('.word')?.animate([{ rotate: '0deg' }, { rotate: '-2.5deg' }, { rotate: '2deg' }, { rotate: '-1deg' }, { rotate: '0deg' }], { duration: 380 }));
  setTimeout(() => {
    const [a, b] = lastSwap; flip([a, b], () => domSwap(a, b)); clack('place', .5); busy = false;
    if (!wrong) return say(['Those letters match.']);
    // A wrong trade is free. Its clue costs a miss, and only once per trade.
    const clued = state().guesses.includes(guessKey(wrong.ids, wrong.positions));
    lastWrong = clued ? null : wrong;
    say(clued ? ['Not an answer.'] : ['Not an answer.', pill('Show a clue (+1 miss)', showClue)]);
  }, 760);
}
function showClue() {
  if (!lastWrong || busy) return;
  const { ids, positions } = lastWrong; lastWrong = null;
  const result = checkSwap(puzzle(), state(), ids, positions);
  paintFeedback(); persist(); updateStats(); clack('place', .6);
  if (!RM) result.feedback?.forEach((f, i) => document.querySelector(`.tile[data-card="${f.id}"][data-index="${f.index}"]`)?.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(85deg)' }, { transform: 'rotateX(0deg)' }], { duration: 380, delay: i * 90 }));
  say([CLUE_KEY]);
}
function solve(hit, [first, second]) {
  chime(); first.classList.add('solved'); second.classList.add('solved');
  setTimeout(() => {
    const tiles = [...first.children, ...second.children], merged = document.createElement('div');
    merged.className = 'word merged solved';
    const n = hit.label.length, gap = 4, size = Math.min(50, Math.floor((mat.clientWidth - 30 - gap * (n - 1)) / n));
    merged.style.setProperty('--s', `${size}px`); merged.style.setProperty('--gap', `${gap}px`);
    mat.style.minHeight = `${mat.offsetHeight}px`;
    for (const w of [first, second]) { markHome(w, false); homeOf.get(w).classList.add('done'); }
    flip(tiles, () => {
      merged.append(...first.children); if (hit.label.includes(' ')) merged.append(makeGap()); merged.append(...second.children);
      mat.classList.add('merging'); mat.append(merged); first.remove(); second.remove(); syncSlots();
    }, { duration: RM ? 1 : 440 });
    clack('place', .8);
    setTimeout(() => flyToTray(merged, hit), RM ? 300 : 1000);
  }, RM ? 100 : 280);
}
function flyToTray(merged, hit) {
  const box = tray.children[state().solved.length - 1];
  const a = merged.getBoundingClientRect(), b = box.getBoundingClientRect();
  const dx = b.left + b.width / 2 - a.left - a.width / 2;
  const dy = b.top + b.height / 2 - a.top - a.height / 2;
  const scale = Math.min(b.width / a.width, b.height / a.height, 1);
  const finish = () => {
    merged.remove(); mat.classList.remove('merging'); mat.style.minHeight = '';
    const answer = fillFound(box, hit.label, false);
    if (!RM) answer.animate([{ opacity: 0, scale: .85 }, { opacity: 1, scale: 1 }], { duration: 260, easing: 'ease-out' });
    busy = false; clack('place', .6);
    const done = record().finishedAt !== null;
    $('count').textContent = `${board + 1} / ${puzzles.length}${done ? ' ✓' : ''}`;
    const label = document.createElement('b'); label.textContent = hit.label;
    say([label, hit.clue]);
    if (done) celebrate();
  };
  if (RM) { finish(); return; }
  merged.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 }
  ], { duration: 480, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' }).finished.then(finish, finish);
}


// ---------- hints, giving up, sharing ----------
function useHint() {
  if (busy) return;
  ensureStarted();
  const hint = revealHint(puzzle(), state()); if (!hint) return;
  paintFeedback(); persist(); updateStats(); clack('pick');
  const tile = document.querySelector(`.tile[data-card="${hint.id}"][data-index="${hint.index}"]`);
  if (tile && !RM) tile.animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 480, easing: 'ease-out' });
  say([`Hint: swap the ${tile?.dataset.letter} in ${puzzle().cards.find(c => c.id === hint.id).word}.`]);
}
function giveUp() {
  $('give-up-dialog').close();
  if (busy || !giveUpRecord(puzzle(), record())) return;
  build();
  if (!RM) [...tray.querySelectorAll('.found.revealed')].forEach((box, i) => box.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: i * 90, easing: SPRING, fill: 'backwards' }));
}
function resultText() {
  const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('p', keys[board]);
  return shareText(puzzle(), record(), url.href);
}
async function shareResult(button) {
  const text = resultText();
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); button.textContent = 'Copied!'; }
  catch { $('share-text').value = text; $('share-dialog').showModal(); $('share-text').select(); }
}
function celebrate() {
  if (RM) return;
  const canvas = document.createElement('canvas'), c2 = canvas.getContext('2d'), w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
  canvas.className = 'confetti'; canvas.setAttribute('aria-hidden', 'true'); canvas.width = w * dpr; canvas.height = h * dpr; c2.scale(dpr, dpr); document.body.append(canvas);
  const css = getComputedStyle(document.documentElement), colors = ['--accent', '--medium-bg', '--tile-mid', '--line'].map(v => css.getPropertyValue(v).trim());
  const bits = Array.from({ length: 150 }, (_, i) => ({ x: w * (.35 + Math.random() * .3), y: h * .45, vx: (Math.random() - .5) * 13, vy: -5 - Math.random() * 11, size: 6 + Math.random() * 6, angle: Math.random() * 6, spin: (Math.random() - .5) * .3, color: colors[i % colors.length] }));
  const start = performance.now(), length = 1900;
  requestAnimationFrame(function frame(now) {
    const t = now - start; c2.clearRect(0, 0, w, h); c2.globalAlpha = Math.max(0, 1 - Math.max(0, t - 900) / (length - 900));
    for (const b of bits) {
      b.vy += .35; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.angle += b.spin;
      c2.save(); c2.translate(b.x, b.y); c2.rotate(b.angle); c2.fillStyle = b.color; c2.fillRect(-b.size / 2, -b.size / 3, b.size, b.size * .66); c2.restore();
    }
    if (t < length) requestAnimationFrame(frame); else canvas.remove();
  });
}

// ---------- taps: a word on the table hops onto the mat ----------
function tap({ word, onMat }) { if (!onMat) placeWord(word); }
// Keyboard players pick one letter, then another, to trade them.
function pickLetter(tile) {
  if (!picked) { picked = tile; tile.classList.add('picked'); clack('pick'); return; }
  const a = picked; a.classList.remove('picked'); picked = null;
  if (a === tile) return;
  if (a.parentNode === tile.parentNode) { picked = tile; tile.classList.add('picked'); clack('pick'); return; }
  if (wordOn(0) && wordOn(1)) trade(a, tile);
}

// ---------- dragging: words on the table, single letters on the mat ----------
document.addEventListener('pointerdown', e => {
  const tile = e.target.closest('.shelf .tile, .slot .tile');
  if (!tile || busy || press || e.button > 0) return;
  e.preventDefault();
  press = { id: e.pointerId, tile, word: tile.closest('.word'), onMat: !!tile.closest('.slot'), x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
});
document.addEventListener('pointermove', e => {
  if (!press || e.pointerId !== press.id) return;
  press.x = e.clientX; press.y = e.clientY;
  if (!drag) {
    if (Math.hypot(press.x - press.x0, press.y - press.y0) < 6) return;
    if (picked) { picked.classList.remove('picked'); picked = null; }
    ensureStarted();
    drag = { el: press.onMat ? press.tile : press.word, mode: press.onMat ? 'tile' : 'word', ox: 0, oy: 0, rot: 0, k: press.onMat ? 1.14 : 1.05, vx: 0, lastX: press.x, target: null };
    if (press.onMat) {
      // The gap this letter leaves, and where the other word's letters sit before any preview moves them.
      drag.gap = press.tile.getBoundingClientRect();
      const other = wordOn(1 - +press.word.dataset.col);
      drag.spots = other ? [...other.children].map(t => ({ t, r: t.getBoundingClientRect() })) : [];
    }
    drag.el.classList.add('lifted'); clack('pick'); requestAnimationFrame(frame);
  }
  drag.vx += e.clientX - drag.lastX; drag.lastX = e.clientX;
  aim();
});
function frame() {
  if (!drag || !press) return;
  drag.vx *= .78; drag.rot += (Math.max(-14, Math.min(14, drag.vx * 1.6)) - drag.rot) * .25;
  drag.ox = press.x - press.x0; drag.oy = press.y - press.y0;
  drag.el.style.transform = `translate(${drag.ox}px,${drag.oy}px) scale(${drag.k}) rotate(${drag.rot}deg)`;
  requestAnimationFrame(frame);
}
function aim() {
  const matRect = mat.getBoundingClientRect();
  if (drag.mode === 'tile' && !inside(matRect, press.x, press.y, TEAR)) {
    // Pulled well past the mat's edge: the whole word comes along, ready to go back to the table.
    preview(null);
    drag.el.style.transform = ''; drag.el.classList.remove('lifted');
    drag.el = press.word; drag.mode = 'word'; drag.k = 1.05; drag.fromMat = true;
    drag.el.classList.add('lifted'); clack('pick');
  }
  if (drag.mode === 'word') {
    const over = inside(matRect, press.x, press.y, 16);
    mat.classList.toggle('ready', over && !drag.fromMat);
    const bumped = drag.fromMat ? null : wordOn(+drag.el.dataset.col);
    if (bumped && bumped !== drag.el) { bumped.classList.toggle('leaving', over); drag.leaving = bumped; }
    return;
  }
  // Nearest letter of the other word, judged by where its letters started, with no dead zones between them.
  let best = null, bestD = Infinity;
  for (const { t, r } of drag.spots) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.abs(press.y - cy) > r.height * .9 || Math.abs(press.x - cx) > r.width * .85) continue;
    const d = Math.hypot(press.x - cx, press.y - cy); if (d < bestD) { best = { t, cx, cy }; bestD = d; }
  }
  preview(best);
}
// Shows the trade before it happens: the hovered letter slides into the gap the dragged letter left.
function preview(spot) {
  const target = spot?.t ?? null;
  if (target === drag.target) return;
  if (drag.target) { drag.target.style.translate = ''; drag.target.classList.remove('target'); }
  drag.target = target;
  if (!target) return;
  target.classList.add('target');
  target.style.translate = `${drag.gap.left + drag.gap.width / 2 - spot.cx}px ${drag.gap.top + drag.gap.height / 2 - spot.cy}px`;
  clack('pick', .6);
}
function finish(e, cancelled) {
  if (!press || e.pointerId !== press.id) return;
  const p = press; press = null;
  if (!drag) { if (!cancelled) tap(p); return; }
  const d = drag; mat.classList.remove('ready'); d.leaving?.classList.remove('leaving');
  if (cancelled || d.mode !== 'tile') preview(null);
  drag = null; d.target?.classList.remove('target');
  if (cancelled) return snapBack(d);
  if (d.mode === 'word') {
    const onMat = inside(mat.getBoundingClientRect(), p.x, p.y, 16);
    if (d.fromMat) return onMat ? snapBack(d) : sendHome(d.el, d);
    return onMat ? placeWord(d.el, d) : snapBack(d);
  }
  return d.target ? trade(d.el, d.target, d) : snapBack(d);
}
document.addEventListener('pointerup', e => finish(e, false));
document.addEventListener('pointercancel', e => finish(e, true));
document.addEventListener('keydown', e => {
  const tile = e.target.closest?.('.shelf .tile, .slot .tile');
  if (!tile || busy) return;
  const word = tile.closest('.word'), onMat = !!tile.closest('.slot');
  if (onMat && (e.key === 'Escape' || e.key === 'Backspace')) { e.preventDefault(); return sendHome(word); }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault(); return onMat ? pickLetter(tile) : placeWord(word);
});

// ---------- header buttons, dialogs, and the page lifecycle ----------
function showTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('theme').innerHTML = dark ? SUN : MOON; $('theme').setAttribute('aria-pressed', String(dark)); $('theme').setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#121827' : '#dfe4ee';
}
$('theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme; try { localStorage.setItem('spoondle-theme', theme); } catch {} showTheme();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  let chosen = null; try { chosen = localStorage.getItem('spoondle-theme'); } catch {}
  if (!chosen) { document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'; showTheme(); }
});
$('sound').addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('spoondle-sound', soundOn ? 'on' : 'off'); } catch {} showSound(); if (soundOn) clack('place'); });
$('help').addEventListener('click', () => { $('help-dialog').showModal(); refreshClocks(); });
$('help-dialog').addEventListener('close', () => { try { localStorage.setItem('spoondle-help-seen-v2', '1'); } catch {} refreshClocks(); });
$('start').addEventListener('click', startPuzzle);
$('hint').addEventListener('click', useHint);
$('give-up').addEventListener('click', () => { if (!busy) $('give-up-dialog').showModal(); });
$('confirm-give-up').addEventListener('click', giveUp);
$('prev').addEventListener('click', () => goTo(board - 1));
$('next').addEventListener('click', () => goTo(board + 1));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
document.addEventListener('visibilitychange', refreshClocks);
window.addEventListener('pagehide', () => { pauseRecord(record()); persist(); });
window.addEventListener('pageshow', e => { if (e.persisted) refreshClocks(); });
// Another tab saved progress: take it, without saving back, so two open tabs don't echo each other.
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY || !e.newValue || busy || drag) return;
  try { saved = readProgress(localStorage); records = puzzles.map((p, i) => restoreRecord(p, saved.records[keys[i]])); build(false); } catch {}
});
setInterval(updateStats, 250);

let helpSeen = true; try { helpSeen = localStorage.getItem('spoondle-help-seen-v2') !== null; } catch {}
if (!helpSeen) $('help-dialog').showModal();
showTheme(); showSound(); build();
