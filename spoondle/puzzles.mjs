// Curated from the answer spreadsheet. Each board has one answer category.
const boards = [
  { category: 'Names', entries: [
    ['BOB ROSS', 'ROB', 'BOSS', 'BOB', 'ROSS', 'The painter known for happy little trees.'],
    ['TIM BURTON', 'RIM', 'BUTTON', 'TIM', 'BURTON', 'The filmmaker behind Edward Scissorhands.'],
    ['GREEN DAY', 'GREED', 'NAY', 'GREEN', 'DAY', 'The band behind American Idiot.'],
    ['SALLY RIDE', 'RALLY', 'SIDE', 'SALLY', 'RIDE', 'The first American woman in space.']
  ]},
  { category: 'Names', entries: [
    ['NOTTING HILL', 'NOTHING', 'TILL', 'NOTTING', 'HILL', 'A London neighborhood and a romantic comedy.'],
    ['NORMAN LEAR', 'NORMAL', 'NEAR', 'NORMAN', 'LEAR', 'The television producer behind All in the Family.'],
    ['BOB MARLEY', 'MOB', 'BARLEY', 'BOB', 'MARLEY', 'The reggae musician behind Three Little Birds.'],
    ['HOPE SOLO', 'HOSE', 'POLO', 'HOPE', 'SOLO', 'An American soccer goalkeeper.']
  ]},
  { category: 'Compound words', entries: [
    ['BLACKTOP', 'BLOCK', 'TAP', 'BLACK', 'TOP', 'Asphalt used to pave roads.'],
    ['ALLSPICE', 'ILL', 'SPACE', 'ALL', 'SPICE', 'A spice with a name that suggests a whole collection.'],
    ['BACKSLASH', 'BASK', 'CLASH', 'BACK', 'SLASH', 'The punctuation mark that leans left.'],
    ['ANTEATER', 'ART', 'EATEN', 'ANT', 'EATER', 'An animal with a long snout and a taste for insects.']
  ]},
  { category: 'Compound words', entries: [
    ['GOLDFISH', 'GOLF', 'DISH', 'GOLD', 'FISH', 'An orange pet often kept in a bowl.'],
    ['WORKSHOP', 'PORK', 'SHOW', 'WORK', 'SHOP', 'A place for making things, or a practical class.'],
    ['CELLBLOCK', 'BELL', 'CLOCK', 'CELL', 'BLOCK', 'A section of a prison.'],
    ['FOOTREST', 'ROOT', 'FEST', 'FOOT', 'REST', 'A support for your feet.']
  ]},
  { category: 'Hidden words', entries: [
    ['FORTUNE', 'FUR', 'TONE', 'FOR', 'TUNE', 'Luck or a large amount of money.'],
    ['BARGAIN', 'BAG', 'RAIN', 'BAR', 'GAIN', 'A particularly good deal.'],
    ['AWESOME', 'OWE', 'SAME', 'AWE', 'SOME', 'Inspiring admiration; excellent.'],
    ['SATIRE', 'SIT', 'ARE', 'SAT', 'IRE', 'Humor used to expose foolishness.']
  ]},
  { category: 'Hidden words', entries: [
    ['PROFIT', 'FRO', 'PIT', 'PRO', 'FIT', 'The money left after expenses.'],
    ['BUDGET', 'BED', 'GUT', 'BUD', 'GET', 'A plan for spending money.'],
    ['TIRESOME', 'TIME', 'SORE', 'TIRE', 'SOME', 'Annoying or wearisome.'],
    ['POETRY', 'TOE', 'PRY', 'POE', 'TRY', 'Writing arranged in verse.']
  ]}
];

export const puzzles = boards.map(({ category, entries }, index) => {
  const cards = entries.flatMap(([, left, right], i) => [
    { id: `p${i}a`, word: left }, { id: `p${i}b`, word: right }
  ]);
  // Fixed mixed order keeps each column separate and makes pairing part of play.
  const order = [2, 5, 0, 7, 3, 4, 1, 6];
  return {
    id: index + 1, category,
    cards: order.map(i => cards[i]),
    answers: entries.map(([label, , , left, right, hint], i) => ({
      ids: [`p${i}a`, `p${i}b`], words: [left, right], label, hint
    }))
  };
});
