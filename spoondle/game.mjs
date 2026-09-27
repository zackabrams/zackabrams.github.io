export function createState(puzzle) {
  const columnById = {};
  puzzle.answers.forEach((answer, index) => {
    const flip = (index + puzzle.id) % 2;
    columnById[answer.ids[flip]] = 0;
    columnById[answer.ids[1 - flip]] = 1;
  });
  return {
    solved: [], misses: 0, hints: 0, guesses: [], feedback: {}, columnById,
    columns: [0, 1].map(column => puzzle.cards.filter(c => columnById[c.id] === column).map(c => c.id))
  };
}
export function usedIds(puzzle, state) {
  return new Set(state.solved.flatMap(i => puzzle.answers[i].ids));
}
export function availableColumn(puzzle, state, column) {
  const used = usedIds(puzzle, state);
  return state.columns[column].filter(id => !used.has(id));
}
export function moveWord(puzzle, state, id, targetIndex) {
  const column = state.columnById[id];
  if (column === undefined) throw new Error('Unknown word card.');
  const available = availableColumn(puzzle, state, column);
  const from = available.indexOf(id);
  if (from < 0) throw new Error('That word has already been solved.');
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= available.length) throw new Error('Choose a position within this column.');
  available.splice(from, 1); available.splice(targetIndex, 0, id);
  const solved = state.columns[column].filter(x => !available.includes(x));
  state.columns[column] = [...available, ...solved];
  return { column, position: targetIndex + 1 };
}
export function shuffleColumns(puzzle, state, random = Math.random) {
  for (let column = 0; column < 2; column++) {
    const order = availableColumn(puzzle, state, column);
    const before = order.join('|');
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.length > 1 && before === order.join('|')) order.push(order.shift());
    state.columns[column] = [...order, ...state.columns[column].filter(id => !order.includes(id))];
  }
}
export function swapWords(puzzle, ids, positions) {
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) throw new Error('Choose two different words.');
  const cards = ids.map(id => puzzle.cards.find(c => c.id === id));
  if (cards.some(c => !c)) throw new Error('Unknown word card.');
  if (!Array.isArray(positions) || positions.length !== 2 || positions.some((p, i) => !Number.isInteger(p) || p < 0 || p >= cards[i].word.length)) throw new Error('Choose one letter in each word.');
  const words = cards.map(c => c.word.split(''));
  const [a, b] = positions;
  [words[0][a], words[1][b]] = [words[1][b], words[0][a]];
  return words.map(w => w.join(''));
}
export function checkSwap(puzzle, state, ids, positions) {
  const words = swapWords(puzzle, ids, positions);
  if (state.columnById[ids[0]] === state.columnById[ids[1]]) throw new Error('Choose one word from each column.');
  const used = usedIds(puzzle, state);
  if (ids.some(id => used.has(id))) throw new Error('That word has already been solved.');
  if (words.every((w, i) => w === puzzle.cards.find(c => c.id === ids[i]).word)) return { correct: false, unchanged: true, words };
  const index = puzzle.answers.findIndex(a => ids.every((id, i) => a.ids.includes(id) && a.words[a.ids.indexOf(id)] === words[i]));
  if (index >= 0) {
    state.solved.push(index);
    return { correct: true, index, words, label: puzzle.answers[index].label };
  }
  const key = ids.map((id, i) => id + ':' + positions[i]).sort().join('|');
  const repeated = state.guesses.includes(key);
  if (!repeated) { state.guesses.push(key); state.misses++; }
  // Feedback belongs to a particular ORIGINAL tile, not every copy of its letter.
  const feedback = ids.map((id, i) => {
    const answer = puzzle.answers.find(a => a.ids.includes(id));
    const source = puzzle.cards.find(c => c.id === id).word;
    const target = answer.words[answer.ids.indexOf(id)];
    const status = source[positions[i]] !== target[positions[i]] ? 'swap' : 'stay';
    state.feedback[id] ??= {};
    state.feedback[id][positions[i]] = status;
    return { id, index: positions[i], status };
  });
  return { correct: false, repeated, words, feedback };
}
export function revealHint(puzzle, state, random = Math.random) {
  const used = usedIds(puzzle, state), candidates = [];
  for (const card of puzzle.cards) {
    if (used.has(card.id)) continue;
    for (let index = 0; index < card.word.length; index++) {
      if (!state.feedback[card.id]?.[index]) candidates.push({ id: card.id, index });
    }
  }
  if (!candidates.length) return null;
  const chosen = candidates[Math.floor(random() * candidates.length)];
  const answer = puzzle.answers.find(a => a.ids.includes(chosen.id));
  const source = puzzle.cards.find(c => c.id === chosen.id).word;
  const target = answer.words[answer.ids.indexOf(chosen.id)];
  chosen.status = source[chosen.index] !== target[chosen.index] ? 'swap' : 'stay';
  state.feedback[chosen.id] ??= {};
  state.feedback[chosen.id][chosen.index] = chosen.status;
  state.hints++;
  return chosen;
}
export function hintCount(state) { return state.hints; }
