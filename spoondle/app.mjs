import { puzzles } from './puzzles.mjs';
import { swapWords, checkSwap, solvedAnswer, usedIds, availableColumn, moveWord, shuffleColumns, revealHint } from './game.mjs';
import { STORAGE_KEY, puzzleKey, restoreRecord, readProgress, elapsedMs, formatTime, finishRecord, streak, shareText } from './progress.mjs';
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
function requireStarted() { if(record().startedAt===null)throw new Error('Press Start to reveal this puzzle and begin the timer.'); }
function updateTimer() { $('timer').textContent=formatTime(elapsedMs(record()));const n=streak(saved.completionDays);$('streak-label').textContent=`${n}-day play streak`; }
function startPuzzle() {
  if(record().startedAt!==null)return;
  record().startedAt=Date.now();persist();render();
  document.querySelector('[data-card]')?.focus();announce('Puzzle started. The timer runs until you finish.');
}
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
const categoryPrompt = () => `Make an answer in the ${puzzle().category.toLowerCase()} category. Try either order.`;
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
    t.addEventListener('click', () => { positions[id] = index; $('trade-feedback').hidden = true; $('trade-message').classList.remove('error'); $('trade-message').textContent = categoryPrompt(); renderTrade(); $(t.id).focus(); });
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
  const p = puzzle(), s = state(), started = record().startedAt !== null;
  $('puzzle-label').textContent = `Puzzle ${current + 1} / ${puzzles.length}`;
  $('category-name').textContent = p.category;
  $('category-description').textContent = categoryDescriptions[p.category];
  $('previous').disabled = current === 0; $('next').disabled = current === puzzles.length - 1;
  $('progress-label').textContent = `${s.solved.length} of ${p.answers.length} found`;
  $('progress-dots').replaceChildren(...p.answers.map((_, i) => el('span', 'progress-square' + (i < s.solved.length ? ' filled' : ''), i < s.solved.length ? '✓' : '')));
  $('mistakes').textContent = `${s.misses} miss${s.misses === 1 ? '' : 'es'}`;
  $('board').replaceChildren(...[0, 1].map(column => {
    const panel = el('section', 'word-column'); panel.setAttribute('aria-label', column === 0 ? 'Left column' : 'Right column'); panel.dataset.column = String(column);
    const list = el('div', 'column-words');
    if(started)list.append(...availableColumn(p,s,column).map(makeRow));
    else for(let i=0;i<4;i++){const row=el('div','word-row'),card=el('div','word-card'),tiles=el('span','word-tiles');for(let j=0;j<6;j++)tiles.append(el('span','tile','X'));card.append(tiles);row.append(card);list.append(row);}
    panel.append(list); return panel;
  }));
  $('selection-prompt').textContent = selected.length === 1 ? `Now pick a word on the ${s.columnById[selected[0]] === 0 ? 'right' : 'left'}.` : 'Pick one word from each column. Drag the handles to rearrange.';
  $('clear').hidden = !selected.length;
  $('reorder-toggle').setAttribute('aria-pressed', String(reorderMode));
  $('reorder-toggle').textContent = reorderMode ? 'Done reordering' : 'Reorder';
  const used = usedIds(p, s);
  $('hint').disabled = !p.cards.some(c => !used.has(c.id) && [...c.word].some((_, i) => !s.feedback[c.id]?.[i]));
  $('hint').title = $('hint').disabled ? 'Every remaining tile color has been revealed' : 'Reveal one random, unrevealed tile';
  const won = s.solved.length === p.answers.length;
  $('board-stage').hidden=won;
  $('board').classList.toggle('is-locked',!started);$('board').inert=!started;
  $('board').setAttribute('aria-hidden',String(!started));$('start-gate').hidden=started;
  for (const id of ['selection-bar', 'board-tools', 'feedback-key', 'reorder-toggle-wrap']) $(id).hidden = won || !started;
  updateTimer();if(!options.sync)persist();
  $('win').hidden = !won;
  $('win-summary').textContent = `Finished in ${formatTime(elapsedMs(record()))} · ${s.misses} miss${s.misses === 1 ? '' : 'es'} · ${hintsLabel(s.hints)}`;
  $('next-after-win').hidden = current === puzzles.length - 1;
  $('discoveries').hidden = !s.solved.length;
  $('solved-list').replaceChildren(...s.solved.map((ids, i) => {
    const row = el('div', 'solved-row' + (options.reveal === i ? ' newly-solved' : '')); row.append(el('span', 'solved-check', '✓'));
    const text = el('div'); text.append(el('div', 'solved-answer', solvedAnswer(p, ids).label), el('div', 'solved-source', ids.map(wordFor).join(' + '))); row.append(text); return row;
  }));
  animateReorder(options.before);
}
function selectCard(id) {
  requireStarted();
  if (!puzzle().cards.some(c => c.id === id) || usedIds(puzzle(), state()).has(id)) throw new Error('Choose an available word.');
  if (selected.includes(id)) selected = selected.filter(x => x !== id);
  else selected = [...selected.filter(x => state().columnById[x] !== state().columnById[id]), id];
  render();
  if (selected.length === 2) {
    selected.sort((a, b) => state().columnById[a] - state().columnById[b]); positions = {};
    $('trade-feedback').hidden = true; $('trade-message').textContent = categoryPrompt(); $('trade-message').classList.remove('error'); renderTrade(); $('trade-dialog').showModal();
  }
}
function renderTrade() {
  $('letter-rows').replaceChildren(...selected.map(id => {
    const group = el('div', 'letter-group'); group.append(el('div', 'letter-label', state().columnById[id] === 0 ? 'LEFT WORD' : 'RIGHT WORD'));
    const row = el('div', 'letter-row'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', `Choose a letter in ${wordFor(id)}`);
    [...wordFor(id)].forEach((char, i) => row.append(tile(char, id, i, true))); group.append(row); return group;
  }));
  const ready = selected.length === 2 && selected.every(id => Number.isInteger(positions[id])); $('submit').disabled = !ready;
  $('preview').replaceChildren();
  if (!ready) { $('preview').append(el('span', 'preview-placeholder', 'Your exchange will appear here.')); return; }
  const words = swapWords(puzzle(), selected, selected.map(id => positions[id]));
  words.forEach((w, i) => {
    if (i) $('preview').append(el('span', 'preview-plus', '+'));
    const word = el('span', 'preview-word'); [...w].forEach((char, j) => word.append(el('span', j === positions[selected[i]] ? 'changed-letter' : '', char))); $('preview').append(word);
  });
}
function submit() {
  requireStarted();
  const before = captureRows();
  const result = checkSwap(puzzle(), state(), selected, selected.map(id => positions[id]));
  if (result.correct) {
    finishRecord(puzzle(),record(),saved.completionDays);
    $('trade-dialog').close(); selected = []; positions = {}; render({ before, reveal: result.index });
    announce(`${result.label}. ${result.clue}`);
    if (state().solved.length === puzzle().answers.length) $('win').scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'nearest' });
  } else {
    renderTrade();
    $('trade-message').textContent = result.unchanged ? 'Those letters are identical. Choose different letters; no miss counted.' : result.repeated ? 'You already tried this exchange. No extra miss counted.' : 'Not quite. Your original tiles now carry a clue.';
    $('trade-message').classList.add('error');
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
function move(id, index, before = captureRows()) {
  requireStarted();
  const result = moveWord(puzzle(), state(), id, index); render({ before });
  announce(`${wordFor(id)} moved to position ${result.position} in the ${result.column === 0 ? 'left' : 'right'} column.`);
  return result;
}
function startDrag(e, id, row, handle) {
  requireStarted();
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
  cancelDrag(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); current = index; const url=new URL(location.href);url.searchParams.set('p',keys[current]);history.replaceState(null,'',url); selected = []; positions = {}; reorderMode = false; $('share-status').textContent=''; announce(''); render();
}
function openHint() {
  requireStarted();
  const reveal = revealHint(puzzle(), state());
  if (!reveal) { announce('All remaining tile colors have been revealed.'); return null; }
  render();
  announce(`${wordFor(reveal.id)}, letter ${reveal.index + 1}: ${feedbackText(reveal.status).toLowerCase()}. One hint used.`);
  const target = document.querySelector(`[data-card="${reveal.id}"] [data-index="${reveal.index}"]`);
  if (target && !reducedMotion()) target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 480 });
  return reveal;
}
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark'; $('theme').setAttribute('aria-pressed', String(dark)); $('theme').setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode'); $('theme').firstElementChild.textContent = dark ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111521' : '#f7f8fc';
}
$('start').addEventListener('click', startPuzzle);
$('share-result').addEventListener('click',shareResult);$('copy-result').addEventListener('click',copyResult);
$('theme').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('spoondle-theme', theme); } catch {} updateThemeButton(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { let preference; try { preference = localStorage.getItem('spoondle-theme'); } catch {} if (!preference) { document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'; updateThemeButton(); } });
$('help').addEventListener('click', () => $('help-dialog').showModal()); $('feedback-help').addEventListener('click', () => $('help-dialog').showModal());
$('hint').addEventListener('click', openHint); $('submit').addEventListener('click', submit);
$('reverse').addEventListener('click', () => { selected.reverse(); renderTrade(); });
$('clear').addEventListener('click', () => { selected = []; render(); });
$('previous').addEventListener('click', () => goTo(current - 1)); $('next').addEventListener('click', () => goTo(current + 1)); $('next-after-win').addEventListener('click', () => goTo(current + 1));
$('reorder-toggle').addEventListener('click', () => { requireStarted(); reorderMode = !reorderMode; render(); announce(reorderMode ? 'Up and down buttons are shown beneath each word.' : 'Reorder controls hidden.'); });
$('shuffle').addEventListener('click', e => { requireStarted(); const before = captureRows(); shuffleColumns(puzzle(), state()); render({ before }); announce('Both columns shuffled. Every word stayed on its own side.'); if (e.detail > 0) $('shuffle').blur(); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
$('trade-dialog').addEventListener('close', () => { if (!selected.length) return; selected = []; positions = {}; render(); });
updateThemeButton(); render();
let helpSeen = true; try { helpSeen = localStorage.getItem('spoondle-help-seen') !== null; } catch {}
if (!helpSeen) $('help-dialog').showModal();
$('help-dialog').addEventListener('close', () => { try { localStorage.setItem('spoondle-help-seen', '1'); } catch {} });
if(requestedKey && initialIndex<0)announce('That shared puzzle is not in this test edition. Choose one of the available puzzles.');
setInterval(updateTimer,250);
window.addEventListener('pagehide',persist);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();else updateTimer();});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY||!event.newValue)return;
  try{saved=readProgress(localStorage);records=puzzles.map((p,i)=>restoreRecord(p,saved.records[keys[i]]));states=records.map(r=>r.state);selected=[];positions={};document.querySelectorAll('dialog[open]').forEach(d=>d.close());render({sync:true});}catch{}
});
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    { name: 'read_spoondle_board', description: 'Read available words by column, revealed tile feedback, progress, and selection. Does not reveal answers.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => record().startedAt===null ? {puzzle:current+1,category:puzzle().category,started:false,message:'Start the puzzle to reveal its words.'} : ({ puzzle: current + 1, category:puzzle().category, columns: state().columns.map((_, column) => availableColumn(puzzle(), state(), column).map(id => ({ id, word: wordFor(id) }))), feedback: state().feedback, found: state().solved.length, misses: state().misses, selected }) },
    { name: 'start_spoondle_puzzle', description: `Switch to one of ${puzzles.length} puzzles and start its timer. Saved progress is preserved.`, inputSchema: { type: 'object', properties: { puzzleNumber: { type: 'integer', minimum: 1, maximum: puzzles.length } }, required: ['puzzleNumber'], additionalProperties: false }, execute: input => { goTo(input?.puzzleNumber - 1); startPuzzle(); return { puzzle: current + 1 }; } },
    { name: 'reorder_spoondle_word', description: 'Move an available word to a zero-based position within its existing column.', inputSchema: { type: 'object', properties: { cardId: { type: 'string' }, position: { type: 'integer', minimum: 0, maximum: 3 } }, required: ['cardId', 'position'], additionalProperties: false }, execute: input => { if (!input || typeof input.cardId !== 'string') throw new Error('Choose a word.'); return move(input.cardId, input.position); } },
    { name: 'submit_spoondle_swap', description: 'Submit a reciprocal letter exchange using one word from each column. Incorrect new guesses add one miss and reveal tile feedback.', inputSchema: { type: 'object', properties: { cardIds: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, letterIndices: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 2, maxItems: 2 } }, required: ['cardIds', 'letterIndices'], additionalProperties: false }, execute: input => {
      requireStarted();
      const ids = input?.cardIds, indices = input?.letterIndices; swapWords(puzzle(), ids, indices);
      if (ids.some(id => usedIds(puzzle(), state()).has(id))) throw new Error('Choose unsolved cards.');
      if (state().columnById[ids[0]] === state().columnById[ids[1]]) throw new Error('Choose one word from each column.');
      selected = [...ids]; positions = Object.fromEntries(ids.map((id, i) => [id, indices[i]])); renderTrade(); if (!$('trade-dialog').open) $('trade-dialog').showModal(); return submit();
    } }
  ];
  for (const tool of tools) { try { Promise.resolve(context.registerTool({ ...tool, annotations: { readOnlyHint: false, untrustedContentHint: false, ...tool.annotations } }, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
