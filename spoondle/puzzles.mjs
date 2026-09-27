// Nine curated test boards. Each starts with eight distinct 4–6-letter words.
const boards = [
  { category: 'Names', entries: [
    ['HARRY POTTER', 'PARRY', 'HOTTER', 'HARRY', 'POTTER', 'The young wizard from the book and film series.'],
    ['SALLY RIDE', 'RALLY', 'SIDE', 'SALLY', 'RIDE', 'The first American woman in space.'],
    ['KING LEAR', 'RING', 'LEAK', 'KING', 'LEAR', 'The aging monarch in Shakespeare’s tragedy.'],
    ['SNOW WHITE', 'STOW', 'WHINE', 'SNOW', 'WHITE', 'The fairy-tale princess with seven dwarfs.']
  ]},
  { category: 'Names', entries: [
    ['PALM BEACH', 'BALM', 'PEACH', 'PALM', 'BEACH', 'A town on the Florida coast.'],
    ['CAPE FEAR', 'CAFE', 'PEAR', 'CAPE', 'FEAR', 'A North Carolina headland and a thriller title.'],
    ['LAKE MEAD', 'MAKE', 'LEAD', 'LAKE', 'MEAD', 'A reservoir on the Colorado River.'],
    ['SHARK TALE', 'STARK', 'HALE', 'SHARK', 'TALE', 'An animated film set under the sea.']
  ]},
  { category: 'Names', entries: [
    ['HOPE SOLO', 'HOSE', 'POLO', 'HOPE', 'SOLO', 'The U.S. soccer goalkeeper.'],
    ['BOBBY HILL', 'HOBBY', 'BILL', 'BOBBY', 'HILL', 'Hank’s son in King of the Hill.'],
    ['NORMAN LEAR', 'NORMAL', 'NEAR', 'NORMAN', 'LEAR', 'The television producer behind All in the Family.'],
    ['KING KONG', 'KINK', 'GONG', 'KING', 'KONG', 'The giant ape of film fame.']
  ]},
  { category: 'Compound words', entries: [
    ['BOOKWORM', 'BOOM', 'WORK', 'BOOK', 'WORM', 'A person who loves reading.'],
    ['GOLDFISH', 'GOLF', 'DISH', 'GOLD', 'FISH', 'A small orange aquarium fish.'],
    ['HONEYMOON', 'HOMEY', 'NOON', 'HONEY', 'MOON', 'The period or trip just after a wedding.'],
    ['JACKHAMMER', 'HACK', 'JAMMER', 'JACK', 'HAMMER', 'A powered tool that pounds through pavement.']
  ]},
  { category: 'Compound words', entries: [
    ['FOOTBALL', 'BOOT', 'FALL', 'FOOT', 'BALL', 'A team sport with touchdowns.'],
    ['FIREWORK', 'WIRE', 'FORK', 'FIRE', 'WORK', 'A device that bursts into colored light in the sky.'],
    ['CHOPSTICK', 'CHIP', 'STOCK', 'CHOP', 'STICK', 'One of a pair of eating utensils.'],
    ['HEADLINE', 'HEAL', 'DINE', 'HEAD', 'LINE', 'The title at the top of a news story.']
  ]},
  { category: 'Compound words', entries: [
    ['BATHROOM', 'BOTH', 'ROAM', 'BATH', 'ROOM', 'A room with a toilet or bath.'],
    ['MILESTONE', 'MINE', 'STOLE', 'MILE', 'STONE', 'An important point in a journey or project.'],
    ['MOONLIGHT', 'LOON', 'MIGHT', 'MOON', 'LIGHT', 'Light from the moon.'],
    ['GRAPEVINE', 'GRAVE', 'PINE', 'GRAPE', 'VINE', 'A vine that bears grapes; also a source of rumors.']
  ]},
  { category: 'Hidden words', entries: [
    ['DETERMINE', 'METER', 'DINE', 'DETER', 'MINE', 'To settle or figure out.'],
    ['COVERAGE', 'ROVE', 'CAGE', 'COVE', 'RAGE', 'The extent of what is included.'],
    ['FLAGRANT', 'FLAT', 'RANG', 'FLAG', 'RANT', 'Conspicuously bad or offensive.'],
    ['KNOWLEDGE', 'KNEW', 'LODGE', 'KNOW', 'LEDGE', 'What someone knows.']
  ]},
  { category: 'Hidden words', entries: [
    ['INFERTILE', 'INTER', 'FILE', 'INFER', 'TILE', 'Unable to produce offspring.'],
    ['MODERATE', 'RODE', 'MATE', 'MODE', 'RATE', 'Neither extreme nor excessive.'],
    ['OVERSEEN', 'OVEN', 'SEER', 'OVER', 'SEEN', 'Supervised or watched over.'],
    ['MISSPOKE', 'MOSS', 'PIKE', 'MISS', 'POKE', 'Said something incorrectly.']
  ]},
  { category: 'Hidden words', entries: [
    ['UTTERMOST', 'OTTER', 'MUST', 'UTTER', 'MOST', 'The furthest possible extent.'],
    ['FLIPPANT', 'FLAP', 'PINT', 'FLIP', 'PANT', 'Not showing proper seriousness.'],
    ['SHOPPING', 'SHIP', 'PONG', 'SHOP', 'PING', 'Buying or looking for things to buy.'],
    ['DIVERGENT', 'GIVER', 'DENT', 'DIVER', 'GENT', 'Moving in different directions.']
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
