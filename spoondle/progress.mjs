import { createState } from './game.mjs';
export const STORAGE_KEY = 'spoondle-progress-v1';
const LEGACY_STORAGE_KEY = 'cross-talk-progress-v1';
export function puzzleKey(puzzle) {
  const text = JSON.stringify([puzzle.cards.map(c => [c.id,c.word]).sort(),puzzle.answers.map(a => [a.ids,a.words,a.label])]);
  let hash = 2166136261;
  for (const c of text) { hash ^= c.charCodeAt(0); hash = Math.imul(hash,16777619); }
  return 'sp-' + (hash >>> 0).toString(36);
}
export function freshRecord(puzzle) { return { state:createState(puzzle), startedAt:null, finishedAt:null }; }
export function restoreRecord(puzzle, saved) {
  const fresh = freshRecord(puzzle);
  if (!saved || !Number.isFinite(saved.startedAt) || saved.startedAt <= 0) return fresh;
  try {
    const s = saved.state, base = fresh.state, ids = puzzle.cards.map(c=>c.id);
    if (!Array.isArray(s.solved) || new Set(s.solved).size !== s.solved.length || s.solved.some(i=>!Number.isInteger(i)||!puzzle.answers[i])) return fresh;
    if (![s.misses,s.hints].every(n=>Number.isInteger(n)&&n>=0) || !Array.isArray(s.guesses) || s.guesses.some(x=>typeof x!=='string')) return fresh;
    if (s.columns.length!==2 || s.columns.flat().length!==ids.length || new Set(s.columns.flat()).size!==ids.length || s.columns.some((col,i)=>col.some(id=>base.columnById[id]!==i))) return fresh;
    if (s.solved.length===puzzle.answers.length && (!Number.isFinite(saved.finishedAt)||saved.finishedAt<saved.startedAt)) return fresh;
    const feedback = {};
    for (const [id, values] of Object.entries(s.feedback || {})) {
      const card=puzzle.cards.find(c=>c.id===id); if(!card) return fresh;
      feedback[id]={};
      const answer=puzzle.answers.find(a=>a.ids.includes(id)), target=answer.words[answer.ids.indexOf(id)];
      for(const index of Object.keys(values)) {
        if(!/^\d+$/.test(index)||Number(index)>=card.word.length)return fresh;
        feedback[id][index]=card.word[index]===target[index]?'stay':'swap';
      }
    }
    return { state:{...base,solved:[...s.solved],misses:s.misses,hints:s.hints,guesses:[...s.guesses],columns:s.columns.map(c=>[...c]),feedback}, startedAt:saved.startedAt, finishedAt:s.solved.length===puzzle.answers.length?saved.finishedAt:null };
  } catch { return fresh; }
}
export function readProgress(storage) {
  const raw=storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
  if(!raw)return {records:{},completionDays:[],current:null};
  try { const data=JSON.parse(raw); return {records:data.records && typeof data.records==='object'?data.records:{},completionDays:Array.isArray(data.completionDays)?data.completionDays.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)):[],current:typeof data.current==='string'?data.current:null}; }
  catch { return {records:{},completionDays:[],current:null}; }
}
export function elapsedMs(record, now=Date.now()) { return record.startedAt===null?0:Math.max(0,(record.finishedAt??now)-record.startedAt); }
export function formatTime(ms) {
  const sec=Math.floor(ms/1000), h=Math.floor(sec/3600), m=Math.floor(sec/60)%60,s=sec%60;
  return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
}
export function localDay(now=Date.now()) { const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function finishRecord(record, days, now=Date.now()) {
  if(record.startedAt===null||record.finishedAt!==null||record.state.solved.length!==4)return false;
  record.finishedAt=Math.max(record.startedAt,now);const day=localDay(now);if(!days.includes(day))days.push(day);return true;
}
export function streak(days, now=Date.now()) {
  const known=new Set(days), date=new Date(now);let count=0;
  if(!known.has(localDay(date.getTime())))date.setDate(date.getDate()-1);
  while(known.has(localDay(date.getTime()))) {count++;date.setDate(date.getDate()-1);}
  return count;
}
export function shareText(puzzle, record, url) {
  if(record.finishedAt===null)throw new Error('Finish the puzzle before sharing your result.');
  const s=record.state;
  return `Spoondle · Test puzzle ${puzzle.id}\n4/4 solved in ${formatTime(elapsedMs(record))}\n${s.misses} miss${s.misses===1?'':'es'} · ${s.hints} hint${s.hints===1?'':'s'}\nCan you beat my time?\n${url}`;
}
