// Từ đồng âm tiếng Anh (nghe y hệt, viết khác). Ở chế độ Luyện nghe, người xem chỉ NGHE được âm — gõ cách viết nào trong
// nhóm cũng tính đúng (nghe "pear" mà gõ "pair" vẫn đúng). Chỉ liệt kê cặp phát âm giống nhau ở giọng Mỹ lẫn Anh.
const GROUPS = [
  ['pair', 'pear', 'pare'], ['flower', 'flour'], ['right', 'write', 'rite'], ['sea', 'see'], ['son', 'sun'], ['meet', 'meat'],
  ['hear', 'here'], ['knight', 'night'], ['know', 'no'], ['weak', 'week'], ['mail', 'male'], ['tail', 'tale'], ['sail', 'sale'],
  ['peace', 'piece'], ['plane', 'plain'], ['bear', 'bare'], ['deer', 'dear'], ['hole', 'whole'], ['hour', 'our'], ['wait', 'weight'],
  ['blew', 'blue'], ['road', 'rode'], ['steal', 'steel'], ['stair', 'stare'], ['waist', 'waste'], ['cell', 'sell'], ['fair', 'fare'],
  ['flu', 'flew'], ['heel', 'heal'], ['buy', 'by', 'bye'], ['eye', 'i'], ['ate', 'eight'], ['one', 'won'], ['two', 'too', 'to'],
  ['four', 'for'], ['berry', 'bury'], ['cereal', 'serial'], ['principal', 'principle'], ['stationary', 'stationery'],
  ['aisle', 'isle'], ['brake', 'break'], ['dye', 'die'], ['hare', 'hair'], ['muscle', 'mussel'], ['pain', 'pane'], ['pause', 'paws'],
  ['pole', 'poll'], ['rain', 'reign', 'rein'], ['rose', 'rows'], ['sole', 'soul'], ['toe', 'tow'], ['whale', 'wail'],
  ['wood', 'would'], ['morning', 'mourning'], ['board', 'bored'], ['chili', 'chilly'], ['coarse', 'course'], ['cue', 'queue'],
  ['flea', 'flee'], ['groan', 'grown'], ['knot', 'not'], ['lessen', 'lesson'], ['mist', 'missed'], ['new', 'knew'],
  ['pail', 'pale'], ['root', 'route'], ['scene', 'seen'], ['suite', 'sweet'], ['tea', 'tee'], ['threw', 'through'], ['vain', 'vein'],
  ['weather', 'whether'], ['which', 'witch'], ['beach', 'beech'], ['cent', 'scent', 'sent'], ['idle', 'idol'], ['lead', 'led'],
  ['main', 'mane'], ['peak', 'peek'], ['tide', 'tied'], ['yolk', 'yoke'], ['ball', 'bawl'], ['bee', 'be'], ['dough', 'doe'],
  ['fir', 'fur'], ['grate', 'great'], ['heard', 'herd'], ['hi', 'high'], ['inn', 'in'], ['genes', 'jeans'], ['nose', 'knows'],
  ['oar', 'or', 'ore'], ['pray', 'prey'], ['rap', 'wrap'], ['ring', 'wring'], ['sew', 'so', 'sow'], ['stake', 'steak'],
  ['wear', 'where', 'ware'], ['allowed', 'aloud'], ['bored', 'board'], ['ceiling', 'sealing'], ['cheap', 'cheep'],
  ['council', 'counsel'], ['days', 'daze'], ['find', 'fined'], ['guessed', 'guest'], ['higher', 'hire'], ['hoarse', 'horse'],
  ['loan', 'lone'], ['made', 'maid'], ['minor', 'miner'], ['moose', 'mousse'], ['naval', 'navel'], ['pedal', 'peddle'],
  ['plum', 'plumb'], ['raise', 'rays'], ['roll', 'role'], ['sight', 'site', 'cite'], ['some', 'sum'], ['tire', 'tyre'],
  ['towed', 'toad'], ['wade', 'weighed'], ['way', 'weigh'], ['whine', 'wine'], ['bread', 'bred'],
  ['carrot', 'carat', 'karat'], ['cellar', 'seller'], ['chord', 'cord'], ['knead', 'need'], ['knows', 'nose'],
  ['mall', 'maul'], ['medal', 'meddle'], ['patience', 'patients'], ['presence', 'presents']
];

const byWord = new Map();
for (const group of GROUPS) for (const w of group) byWord.set(w, [...new Set([...(byWord.get(w) || []), ...group])]);

/** Các cách viết nghe giống `word` (gồm chính nó), chữ thường. */
export function homophonesOf(word) {
  const w = String(word).toLowerCase();
  return byWord.get(w) || [w];
}
