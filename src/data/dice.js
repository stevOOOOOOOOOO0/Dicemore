export const DIE_TYPES = {
  attack: { id: 'attack', label: 'Attack', sym: 'ATK', color: '#ff4444' },
  block:  { id: 'block',  label: 'Block',  sym: 'BLK', color: '#3498db' },
  pierce: { id: 'pierce', label: 'Pierce', sym: 'PRC', color: '#ff9900' },
  copy:   { id: 'copy',   label: 'Copy',   sym: 'CPY', color: '#cc88ff' },
};

export const DIE_TYPE_KEYS = Object.keys(DIE_TYPES);

export const SIDES_PROGRESSION = [4, 6, 8, 10, 20];

export const STARTER_DICE = [
  { id: 's0', type: 'attack', sides: 4, rune: null, runeFaceIdx: -1, material: null },
  { id: 's1', type: 'block',  sides: 4, rune: null, runeFaceIdx: -1, material: null },
];

export const FIGHTER_CONFIG = [
  { id: 'f0', type: 'attack', sides: 4, rune: null, runeFaceIdx: -1, material: null },
  { id: 'f1', type: 'block',  sides: 4, rune: null, runeFaceIdx: -1, material: null },
  { id: 'f2', type: 'pierce', sides: 4, rune: null, runeFaceIdx: -1, material: null },
];

export const MAGICIAN_CONFIG = [
  { id: 'm0', type: 'attack', sides: 4, rune: null, runeFaceIdx: -1, material: null },
  { id: 'm1', type: 'block',  sides: 4, rune: null, runeFaceIdx: -1, material: null },
  { id: 'm2', type: 'copy',   sides: 4, rune: null, runeFaceIdx: -1, material: null },
];
