export const DIE_TYPES = {
  attack: { id: 'attack', label: 'Attack', sym: 'ATK', color: '#ff4444' },
  block:  { id: 'block',  label: 'Block',  sym: 'BLK', color: '#3498db' },
  pierce: { id: 'pierce', label: 'Pierce', sym: 'PRC', color: '#ff9900' },
  copy:   { id: 'copy',   label: 'Copy',   sym: 'CPY', color: '#cc88ff' },
};

export const DIE_TYPE_KEYS = Object.keys(DIE_TYPES);

export const SIDES_PROGRESSION = [6, 8, 10, 12, 20];

export const STARTER_DICE = [
  { id: 's0', type: 'attack', sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
  { id: 's1', type: 'block',  sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
];

export const FIGHTER_CONFIG = [
  { id: 'f0', type: 'attack', sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
  { id: 'f1', type: 'block',  sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
  { id: 'f2', type: 'pierce', sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
];

export const MAGICIAN_CONFIG = [
  { id: 'm0', type: 'attack', sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
  { id: 'm1', type: 'block',  sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
  { id: 'm2', type: 'copy',   sides: 6, rune: null, runeFaceIdx: -1, material: null, culledFaces: [] },
];
