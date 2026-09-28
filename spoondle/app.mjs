import { puzzles } from './puzzles.mjs';
import { swapWords, checkSwap, tradeAnswer, solvedAnswer, usedIds, availableColumn, moveWord, shuffleColumns, revealHint, hintTargets } from './game.mjs';
import { STORAGE_KEY, puzzleKey, restoreRecord, readProgress, elapsedMs, formatTime, finishRecord, giveUpRecord, pauseRecord, resumeRecord, streak, shareText } from './progress.mjs';
const $ = id => document.getElementById(id);
let saved = { records:{},completionDays:[],current:null }, storageAvailable = true;
try { saved = readProgress(localStorage); } catch { storageAvailable = false; }
const keys = puzzles.map(puzzleKey);
let records = puzzles.map((p,i) => restoreRecord(p,saved.records[keys[i]]));
let states = records.map(r=>r.state);
const requestedKey = new URL(location.href).searchParams.get('p');
const initialIndex = keys.indexOf(requestedKey || saved.current);
let current = Math.max(0,initialIndex), selected = [], positions = {}, reorderMode = false, drag = null, suppressHandleClickUntil = 0;
const puzzle = () => puzzles[current], state = () => states[current], record = () => records[current];
function persist() {
  saved.current=keys[current];records.forEach((r,i)=>{saved.records[keys[i]]=r;});
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));storageAvailable=true; } catch { storageAvailable=false; }
  $('save-warning').hidden=storageAvailable;
}
// Only the puzzle on screen, in a visible tab and not behind How to play, has a running clock.
// A puzzle's clock starts the first time it's shown, and its cards deal in.
let dealIn = false;
function syncClocks() {
  const showing = !document.hidden && !$('help-dialog').open;
  records.forEach((r, i) => {
    if (i !== current || !showing) { pauseRecord(r); return; }
    if (r.startedAt === null) { r.startedAt = Date.now(); dealIn = true; }
    resumeRecord(r);
  });
}
function refreshClocks() { syncClocks(); if (dealIn) render(); else { persist(); updateTimer(); } }
// Playing a puzzle means it's on screen, so its clock starts now if it hasn't yet.
function ensureStarted() { if (record().startedAt === null) syncClocks(); }
function updateTimer() { $('timer').textContent=formatTime(elapsedMs(record())); }
function resultText() {
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('p',keys[current]);
  return shareText(puzzle(),record(),url.href);
}
function manualCopy(text) { $('share-text').value=text;$('share-dialog').showModal();$('share-text').focus();$('share-text').select(); }
async function copyResult() {
  const text=resultText();
  try { await navigator.clipboard.writeText(text);$('share-status').textContent='Copied! Send it to a friend.'; }
  catch { manualCopy(text); }
}
async function shareResult() {
  const text=resultText();
  if(navigator.share) { try {await navigator.share({text});$('share-status').textContent='Result shared.';}catch(error){if(error.name!=='AbortError')manualCopy(text);} }
  else await copyResult();
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
const wordFor = id => puzzle().cards.find(c => c.id === id).word;
const feedbackText = status => status === 'swap' ? 'Swap this tile' : 'Leave this tile';
const hintsLabel = n => `${n} hint${n === 1 ? '' : 's'}`;
const categoryDescriptions = {
  'Names': 'Proper nouns: people, places, story titles, and such.',
  'Compound words': 'Join two meaningful pieces into one word.',
  'Hidden words': 'Extra tricky! Join the new pieces to reveal one hidden word.'
};
const categoryPrompt = () => `Make an answer in the ${puzzle().category.toLowerCase()} category. The right letters count as soon as you pick them.`;
function announce(text) { $('announcement').textContent = text; }
function captureRows() { return new Map([...document.querySelectorAll('[data-row]')].map(e => [e.dataset.row, e.getBoundingClientRect()])); }
function animateReorder(before) {
  if (!before || reducedMotion()) return;
  document.querySelectorAll('[data-row]').forEach(e => {
    const previous = before.get(e.dataset.row), next = e.getBoundingClientRect();
    if (previous && Math.abs(previous.top - next.top) > 1) e.animate([{ transform: `translateY(${previous.top - next.top}px)` }, { transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
  });
}
function tile(char, id, index, interactive = false) {
  const status = state().feedback[id]?.[index];
  const t = el(interactive ? 'button' : 'span', interactive ? 'letter' : 'tile');
  t.dataset.index = String(index); t.dataset.word = id;
  if (status) t.dataset.status = status;
  t.append(el('span', 'tile-letter', char));
  if (interactive) {
    t.id = `letter-${id}-${index}`;
    t.setAttribute('aria-label', `${char}, letter ${index + 1} of ${wordFor(id)}${status ? '. ' + feedbackText(status) : ''}`);
    t.setAttribute('aria-pressed', String(positions[id] === index));
    t.addEventListener('click', () => { if (positions[id] === index) delete positions[id]; else positions[id] = index; $('trade-feedback').hidden = true; $('trade-message').classList.remove('error'); renderTrade(); $(t.id)?.focus(); if (tradeAnswer(puzzle(), selected, selected.map(x => positions[x]))) submit(); });
  }
  return t;
}
function makeRow(id) {
  const c = puzzle().cards.find(c => c.id === id), row = el('div', 'word-row' + (reorderMode ? ' reordering' : '')); row.dataset.row = id;
  const handle = el('button', 'drag-handle', '⠿'); handle.dataset.handle = id;
  handle.setAttribute('aria-label', `Select ${c.word}. Drag up or down to rearrange, or use arrow keys.`);
  handle.title = 'Drag up or down';
  handle.addEventListener('pointerdown', e => startDrag(e, id, row, handle));
  handle.addEventListener('pointermove', updateDrag);
  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', cancelDrag);
  handle.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
  handle.addEventListener('keydown', e => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const column = state().columnById[id], order = availableColumn(puzzle(), state(), column), index = order.indexOf(id);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : Math.max(0, Math.min(order.length - 1, index + (e.key === 'ArrowUp' ? -1 : 1)));
    move(id, next); document.querySelector(`[data-handle="${id}"]`)?.focus();
  });
  const b = el('button', 'word-card' + (selected.includes(id) ? ' selected' : '')); b.dataset.card = id;
  b.setAttribute('aria-pressed', String(selected.includes(id))); b.setAttribute('aria-label', `${c.word}, ${state().columnById[id] === 0 ? 'left' : 'right'} column${selected.includes(id) ? ', selected' : ''}`);
  const letters = el('span', 'word-tiles'); letters.setAttribute('aria-hidden', 'true'); [...c.word].forEach((char, i) => letters.append(tile(char, id, i))); b.append(letters);
  const known = Object.entries(state().feedback[id] || {}).map(([i, status]) => `Letter ${Number(i) + 1}, ${c.word[i]}: ${feedbackText(status)}.`).join(' ');
  if (known) { const note = el('span', 'sr-only', known); note.id = `feedback-${id}`; row.append(note); b.setAttribute('aria-describedby', note.id); }
  row.addEventListener('click', () => { if (performance.now() < suppressHandleClickUntil) return; selectCard(id); });
  row.append(handle, b);
  if (reorderMode) {
    const controls = el('div', 'row-reorder'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', `Move ${c.word}`);
    const order = availableColumn(puzzle(), state(), state().columnById[id]), index = order.indexOf(id);
    for (const delta of [-1, 1]) {
      const button = el('button', 'reorder-step', delta < 0 ? '↑' : '↓'); button.dataset.move = `${id}:${delta}`;
      button.setAttribute('aria-label', `Move ${c.word} ${delta < 0 ? 'up' : 'down'}`);
      button.disabled = delta < 0 ? index === 0 : index === order.length - 1;
      button.addEventListener('click', e => {
        e.stopPropagation(); move(id, index + delta);
        const next = document.querySelector(`[data-move="${id}:${delta}"]`);
        (next?.disabled ? document.querySelector(`[data-move="${id}:${-delta}"]`) : next)?.focus();
      }); controls.append(button);
    }
    controls.addEventListener('click', e => e.stopPropagation()); row.append(controls);
  }
  return row;
}
function render(options = {}) {
  const p = puzzle(), s = state();
  $('puzzle-label').textContent = `Puzzle ${current + 1} / ${puzzles.length}${record().finishedAt !== null && !state().revealed ? ' ✓' : ''}`;
  $('category-name').textContent = p.category;
  $('category-description').textContent = categoryDescriptions[p.category];
  $('difficulty').textContent = p.difficulty; $('difficulty').dataset.level = p.difficulty.toLowerCase();
  $('previous').disabled = current === 0; $('next').disabled = current === puzzles.length - 1;
  const found = s.solved.length - s.revealed;
  $('progress-label').textContent = `${found} of ${p.answers.length} found`;
  $('progress-dots').replaceChildren(...p.answers.map((_, i) => el('span', 'progress-square' + (i < found ? ' filled' : i < s.solved.length ? ' revealed' : '') + (options.reveal === i ? ' just-filled' : ''), i < found ? '✓' : '')));
  $('mistakes').textContent = `${s.misses} miss${s.misses === 1 ? '' : 'es'}`;
  $('board').replaceChildren(...[0, 1].map(column => {
    const panel = el('section', 'word-column'); panel.setAttribute('aria-label', column === 0 ? 'Left column' : 'Right column'); panel.dataset.column = String(column);
    const list = el('div', 'column-words');
    list.append(...availableColumn(p,s,column).map(makeRow));
    panel.append(list); return panel;
  }));
  $('selection-prompt').textContent = selected.length === 1 ? `Now pick a word on the ${s.columnById[selected[0]] === 0 ? 'right' : 'left'}.` : 'Pick one word from each column.';
  $('clear').hidden = !selected.length;
  $('reorder-toggle').setAttribute('aria-pressed', String(reorderMode));
  $('reorder-toggle').textContent = reorderMode ? 'Done reordering' : 'Reorder';
  $('hint').disabled = !hintTargets(p, s).length;
  $('hint').title = $('hint').disabled ? 'Every letter you need to swap is already showing' : 'Show one letter you need to swap';
  const won = s.solved.length === p.answers.length;
  $('board-stage').hidden=won;
  for (const id of ['selection-bar', 'board-tools', 'reorder-toggle-wrap']) $(id).hidden = won;
  $('feedback-key').hidden = won || !Object.keys(s.feedback).length;
  updateTimer();if(!options.sync)persist();
  $('win').hidden = !won;
  $('win-symbol').textContent = s.revealed ? '⚑' : '✓'; $('win-title').textContent = s.revealed ? "Here's how it clicks." : 'Everything clicks.';
  const days = streak(saved.completionDays);
  $('win-summary').textContent = `${s.revealed ? `Answers shown after ${formatTime(elapsedMs(record()))} · ${found} of ${p.answers.length} found` : `Finished in ${formatTime(elapsedMs(record()))}`} · ${s.misses} miss${s.misses === 1 ? '' : 'es'} · ${hintsLabel(s.hints)}` + (days > 1 && !s.revealed ? ` · ${days}-day streak` : '');
  const upcoming = nextUnfinished();
  $('next-after-win').hidden = upcoming < 0;
  $('next-after-win').firstChild.textContent = upcoming === current + 1 ? 'Try the next puzzle ' : `Try puzzle ${upcoming + 1} `;
  $('all-done').hidden = upcoming >= 0;
  $('all-done').textContent = `That's all ${puzzles.length} test puzzles. Thanks for playing! Tell Zack what you thought.`;
  $('discoveries').hidden = !s.solved.length;
  $('solved-list').replaceChildren(...s.solved.map((ids, i) => {
    const shown = i >= found, fresh = options.reveal === i || (shown && options.revealFrom !== undefined);
    const row = el('div', 'solved-row' + (shown ? ' revealed' : '') + (fresh ? ' newly-solved' : '')); row.append(el('span', 'solved-check', shown ? '⚑' : '✓'));
    if (fresh && shown) row.style.animationDelay = `${(i - options.revealFrom) * 110}ms`;
    const text = el('div'); text.append(el('div', 'solved-answer', solvedAnswer(p, ids).label), el('div', 'solved-source', ids.map(wordFor).join(' + ') + (shown ? ' · revealed' : ''))); row.append(text); return row;
  }));
  animateReorder(options.before);
  if (dealIn) {
    dealIn = false;
    if (!reducedMotion()) document.querySelectorAll('.word-row').forEach((row, i) => row.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 340, delay: (i % 4) * 60 + (i >= 4 ? 30 : 0), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
  }
}
function nextUnfinished() {
  for (let step = 1; step < puzzles.length; step++) { const i = (current + step) % puzzles.length; if (records[i].finishedAt === null) return i; }
  return -1;
}
function lockTrade(locked) { $('trade-dialog').classList.toggle('is-solved', locked); $('letter-rows').inert = locked; }
function openTrade() {
  lockTrade(false); $('trade-feedback').hidden = true;
  $('trade-message').textContent = categoryPrompt(); $('trade-message').classList.remove('error', 'success');
  renderTrade(); if (!$('trade-dialog').open) $('trade-dialog').showModal();
}
function selectCard(id) {
  ensureStarted();
  if (!puzzle().cards.some(c => c.id === id) || usedIds(puzzle(), state()).has(id)) throw new Error('Choose an available word.');
  if (selected.includes(id)) selected = selected.filter(x => x !== id);
  else selected = [...selected.filter(x => state().columnById[x] !== state().columnById[id]), id];
  render();
  if (selected.length === 2) {
    selected.sort((a, b) => state().columnById[a] - state().columnById[b]); positions = {};
    openTrade();
  }
}
function renderTrade() {
  $('letter-rows').replaceChildren(...selected.map(id => {
    const group = el('div', 'letter-group'); group.append(el('div', 'letter-label', state().columnById[id] === 0 ? 'LEFT WORD' : 'RIGHT WORD'));
    const row = el('div', 'letter-row'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', `Choose a letter in ${wordFor(id)}`);
    [...wordFor(id)].forEach((char, i) => row.append(tile(char, id, i, true))); group.append(row); return group;
  }));
  const ready = selected.length === 2 && selected.every(id => Number.isInteger(positions[id]));
  $('preview').replaceChildren(); $('submit').disabled = true;
  if (!ready) { $('trade-message').textContent = categoryPrompt(); $('preview').append(el('span', 'preview-placeholder', 'Your exchange will appear here.')); return; }
  const words = swapWords(puzzle(), selected, selected.map(id => positions[id]));
  const unchanged = words.every((w, i) => w === wordFor(selected[i])), answer = !unchanged && tradeAnswer(puzzle(), selected, selected.map(id => positions[id]));
  $('submit').disabled = unchanged || !!answer;
  if (!$('trade-message').classList.contains('error')) $('trade-message').textContent = unchanged ? 'Those letters match, so nothing changes. Pick a different one.' : answer ? '' : 'Not an answer. Change a letter, or show a clue.';
  words.forEach((w, i) => {
    if (i) $('preview').append(el('span', 'preview-plus', '+'));
    const word = el('span', 'preview-word'); [...w].forEach((char, j) => word.append(el('span', j === positions[selected[i]] ? 'changed-letter' : '', char))); $('preview').append(word);
  });
}
function submit() {
  ensureStarted();
  const before = captureRows();
  const result = checkSwap(puzzle(), state(), selected, selected.map(id => positions[id]));
  if (result.correct) {
    finishRecord(puzzle(),record(),saved.completionDays);
    lockTrade(true); $('submit').disabled = true; $('trade-feedback').hidden = true;
    $('trade-message').classList.remove('error'); $('trade-message').classList.add('success'); $('trade-message').textContent = 'Correct!';
    $('preview').replaceChildren(...[...result.label].map((char, i) => { const t = el('span', char === ' ' ? 'solved-gap' : 'solved-letter', char); t.style.setProperty('--i', i); return t; }));
    const board = current;
    setTimeout(() => {
      if (current !== board) return;
      if ($('trade-dialog').open) $('trade-dialog').close();
      selected = []; positions = {}; render({ before, reveal: result.index });
      announce(`${result.label}. ${result.clue}`);
      if (state().solved.length === puzzle().answers.length) { $('win').scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'nearest' }); celebrate(); }
    }, reducedMotion() ? 300 : 850);
  } else {
    renderTrade();
    $('trade-message').textContent = result.unchanged ? 'Those letters match, so nothing changes. Pick a different one.' : result.repeated ? 'You already have this clue. No extra miss counted.' : 'Clue added: your tiles are colored. That counts as one miss.';
    $('trade-message').classList.add('error');
    if (!reducedMotion() && !result.repeated && !result.unchanged) $('preview').animate([0, -7, 6, -4, 2, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 380, easing: 'ease-out' });
    $('trade-feedback').hidden = !result.feedback;
    if (result.feedback) {
      $('trade-feedback').replaceChildren(...result.feedback.map(f => {
        const line = el('div', 'feedback-line'); line.append(el('span', `key-tile ${f.status}`), el('span', '', `${wordFor(f.id)} · ${wordFor(f.id)[f.index]}: ${feedbackText(f.status).toLowerCase()}.`)); return line;
      }));
      if (!reducedMotion()) result.feedback.forEach((f, i) => $(`letter-${f.id}-${f.index}`)?.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(80deg)' }, { transform: 'rotateX(0deg)' }], { duration: 360, delay: i * 80 }));
    }
    render();
  }
  return result;
}
function celebrate() {
  if (reducedMotion()) return;
  const canvas = el('canvas', 'confetti'), ctx = canvas.getContext('2d'), w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
  canvas.setAttribute('aria-hidden', 'true'); canvas.width = w * dpr; canvas.height = h * dpr; ctx.scale(dpr, dpr); document.body.append(canvas);
  const css = getComputedStyle(document.documentElement), colors = ['--primary', '--swap', '--selected-line', '--stay-line'].map(v => css.getPropertyValue(v).trim());
  const bits = Array.from({ length: 150 }, (_, i) => ({ x: w * (.35 + Math.random() * .3), y: h * .4, vx: (Math.random() - .5) * 13, vy: -5 - Math.random() * 11, size: 6 + Math.random() * 6, angle: Math.random() * 6, spin: (Math.random() - .5) * .3, color: colors[i % colors.length] }));
  const start = performance.now(), length = 1900;
  requestAnimationFrame(function frame(now) {
    const t = now - start; ctx.clearRect(0, 0, w, h); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 900) / (length - 900));
    for (const b of bits) {
      b.vy += .35; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.angle += b.spin;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); ctx.fillStyle = b.color; ctx.fillRect(-b.size / 2, -b.size / 3, b.size, b.size * .66); ctx.restore();
    }
    if (t < length) requestAnimationFrame(frame); else canvas.remove();
  });
}
function move(id, index, before = captureRows()) {
  ensureStarted();
  const result = moveWord(puzzle(), state(), id, index); render({ before });
  announce(`${wordFor(id)} moved to position ${result.position} in the ${result.column === 0 ? 'left' : 'right'} column.`);
  return result;
}
function startDrag(e, id, row, handle) {
  ensureStarted();
  if (e.button !== 0 || drag) return;
  const column = state().columnById[id], ids = availableColumn(puzzle(), state(), column);
  const rects = ids.map(x => document.querySelector(`[data-row="${x}"]`).getBoundingClientRect());
  drag = { id, column, ids, rects, from: ids.indexOf(id), target: ids.indexOf(id), startY: e.clientY, row, handle, pointerId: e.pointerId, active: false };
  handle.setPointerCapture(e.pointerId);
}
function updateDrag(e) {
  if (!drag || drag.pointerId !== e.pointerId) return;
  const d = drag; let dy = e.clientY - d.startY;
  if (!d.active && Math.abs(dy) < 7) return;
  d.active = true; e.preventDefault(); d.row.classList.add('dragging');
  const own = d.rects[d.from]; dy = Math.max(d.rects[0].top - own.top, Math.min(d.rects.at(-1).bottom - own.bottom, dy));
  d.row.style.transform = `translateY(${dy}px)`;
  const center = own.top + own.height / 2 + dy;
  d.target = d.rects.reduce((best, r, i) => Math.abs(r.top + r.height / 2 - center) < Math.abs(d.rects[best].top + d.rects[best].height / 2 - center) ? i : best, 0);
  document.querySelectorAll('[data-row]').forEach(row => row.classList.toggle('drop-target', row.dataset.row === d.ids[d.target] && d.target !== d.from));
}
function cleanDrag() {
  const d = drag; if (!d) return; drag = null;
  d.row.style.transform = ''; d.row.classList.remove('dragging'); document.querySelectorAll('.drop-target').forEach(e => e.classList.remove('drop-target'));
  if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId);
  return d;
}
function finishDrag(e) {
  if (!drag || drag.pointerId !== e.pointerId) return;
  const before = captureRows(), d = cleanDrag();
  if (d.active) { suppressHandleClickUntil = performance.now() + 600; e.preventDefault(); move(d.id, d.target, before); }
}
function cancelDrag() { const d = cleanDrag(); if (d?.active) suppressHandleClickUntil = performance.now() + 600; }
function goTo(index) {
  if (!Number.isInteger(index) || index < 0 || index >= puzzles.length) throw new Error(`Choose a puzzle from 1 to ${puzzles.length}.`);
  cancelDrag(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); current = index; syncClocks(); const url=new URL(location.href);url.searchParams.set('p',keys[current]);history.replaceState(null,'',url); selected = []; positions = {}; reorderMode = false; $('share-status').textContent=''; announce(''); render();
}
function openHint() {
  ensureStarted();
  const reveal = revealHint(puzzle(), state());
  if (!reveal) { announce('Every letter you need to swap is already showing.'); return null; }
  render();
  announce(`Hint: swap the ${wordFor(reveal.id)[reveal.index]} in ${wordFor(reveal.id)} (letter ${reveal.index + 1}).`);
  const target = document.querySelector(`[data-card="${reveal.id}"] [data-index="${reveal.index}"]`);
  if (target && !reducedMotion()) target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 480 });
  return reveal;
}
function giveUp() {
  ensureStarted();
  const before = captureRows(), from = state().solved.length;
  $('give-up-dialog').close();
  if (!giveUpRecord(puzzle(), record())) return;
  selected = []; positions = {}; reorderMode = false; render({ before, revealFrom: from });
  announce(`Answers shown: ${state().solved.slice(from).map(ids => solvedAnswer(puzzle(), ids).label).join(', ')}.`);
  $('win').scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'nearest' });
}
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark'; $('theme').setAttribute('aria-pressed', String(dark)); $('theme').setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode'); $('theme').firstElementChild.textContent = dark ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111521' : '#f7f8fc';
}
$('share-result').addEventListener('click',shareResult);$('copy-result').addEventListener('click',copyResult);
$('theme').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('spoondle-theme', theme); } catch {} updateThemeButton(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { let preference; try { preference = localStorage.getItem('spoondle-theme'); } catch {} if (!preference) { document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'; updateThemeButton(); } });
const openHelp = () => { $('help-dialog').showModal(); refreshClocks(); };
$('help').addEventListener('click', openHelp); $('feedback-help').addEventListener('click', openHelp);
$('hint').addEventListener('click', openHint); $('submit').addEventListener('click', submit);
$('give-up').addEventListener('click', () => { ensureStarted(); $('give-up-dialog').showModal(); }); $('confirm-give-up').addEventListener('click', giveUp);
$('clear').addEventListener('click', () => { selected = []; render(); });
$('previous').addEventListener('click', () => goTo(current - 1)); $('next').addEventListener('click', () => goTo(current + 1)); $('next-after-win').addEventListener('click', () => goTo(nextUnfinished()));
$('reorder-toggle').addEventListener('click', () => { ensureStarted(); reorderMode = !reorderMode; render(); announce(reorderMode ? 'Up and down buttons are shown beneath each word.' : 'Reorder controls hidden.'); });
$('shuffle').addEventListener('click', e => { ensureStarted(); const before = captureRows(); shuffleColumns(puzzle(), state()); render({ before }); announce('Both columns shuffled. Every word stayed on its own side.'); if (e.detail > 0) $('shuffle').blur(); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
$('trade-dialog').addEventListener('close', () => { lockTrade(false); if (!selected.length) return; selected = []; positions = {}; render(); });
let helpSeen = true; try { helpSeen = localStorage.getItem('spoondle-help-seen') !== null; } catch {}
if (!helpSeen) $('help-dialog').showModal();
$('help-dialog').addEventListener('close', () => { try { localStorage.setItem('spoondle-help-seen', '1'); } catch {} refreshClocks(); });
syncClocks(); updateThemeButton(); render();
if(requestedKey && initialIndex<0)announce('That shared puzzle is not in this test edition. Choose one of the available puzzles.');
setInterval(updateTimer,250);
window.addEventListener('pagehide',()=>{pauseRecord(record());persist();});
window.addEventListener('pageshow',e=>{if(e.persisted)refreshClocks();});
document.addEventListener('visibilitychange',refreshClocks);
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY||!event.newValue)return;
  try{saved=readProgress(localStorage);records=puzzles.map((p,i)=>restoreRecord(p,saved.records[keys[i]]));states=records.map(r=>r.state);syncClocks();selected=[];positions={};document.querySelectorAll('dialog[open]').forEach(d=>d.close());render({sync:true});}catch{}
});
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    { name: 'read_spoondle_board', description: 'Read available words by column, revealed tile feedback, progress, and selection. Does not reveal answers.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => record().startedAt===null ? {puzzle:current+1,category:puzzle().category,started:false,message:'Start the puzzle to reveal its words.'} : ({ puzzle: current + 1, category:puzzle().category, columns: state().columns.map((_, column) => availableColumn(puzzle(), state(), column).map(id => ({ id, word: wordFor(id) }))), feedback: state().feedback, found: state().solved.length, misses: state().misses, selected }) },
    { name: 'start_spoondle_puzzle', description: `Switch to one of ${puzzles.length} puzzles and start its timer. Saved progress is preserved.`, inputSchema: { type: 'object', properties: { puzzleNumber: { type: 'integer', minimum: 1, maximum: puzzles.length } }, required: ['puzzleNumber'], additionalProperties: false }, execute: input => { goTo(input?.puzzleNumber - 1); return { puzzle: current + 1 }; } },
    { name: 'reorder_spoondle_word', description: 'Move an available word to a zero-based position within its existing column.', inputSchema: { type: 'object', properties: { cardId: { type: 'string' }, position: { type: 'integer', minimum: 0, maximum: 3 } }, required: ['cardId', 'position'], additionalProperties: false }, execute: input => { if (!input || typeof input.cardId !== 'string') throw new Error('Choose a word.'); return move(input.cardId, input.position); } },
    { name: 'submit_spoondle_swap', description: 'Submit a reciprocal letter exchange using one word from each column. Incorrect new guesses add one miss and reveal tile feedback.', inputSchema: { type: 'object', properties: { cardIds: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, letterIndices: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 2, maxItems: 2 } }, required: ['cardIds', 'letterIndices'], additionalProperties: false }, execute: input => {
      ensureStarted();
      const ids = input?.cardIds, indices = input?.letterIndices; swapWords(puzzle(), ids, indices);
      if (ids.some(id => usedIds(puzzle(), state()).has(id))) throw new Error('Choose unsolved cards.');
      if (state().columnById[ids[0]] === state().columnById[ids[1]]) throw new Error('Choose one word from each column.');
      selected = [...ids]; positions = Object.fromEntries(ids.map((id, i) => [id, indices[i]])); openTrade(); return submit();
    } }
  ];
  for (const tool of tools) { try { Promise.resolve(context.registerTool({ ...tool, annotations: { readOnlyHint: false, untrustedContentHint: false, ...tool.annotations } }, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
