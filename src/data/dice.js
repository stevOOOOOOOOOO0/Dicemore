export const DIE_TYPES = {
  attack: { id: 'attack', label: 'Attack', sym: 'ATK', color: '#ff4444' },
  block:  { id: 'block',  label: 'Block',  sym: 'BLK', color: '#3498db' },
  pierce: { id: 'pierce', label: 'Pierce', sym: 'PRC', color: '#ff9900' },
  copy:   { id: 'copy',   label: 'Copy',   sym: 'CPY', color: '#cc88ff' },
  // Boss-reward-only special dice
  leech:  { id: 'leech',  label: 'Leech',  sym: 'LCH', color: '#aa44ff' },
  poison: { id: 'poison', label: 'Poison', sym: 'PSN', color: '#58d68d' },
  hex:    { id: 'hex',    label: 'Hex',    sym: 'HEX', color: '#9b59b6' },
  bomb:   { id: 'bomb',   label: 'Bomb',   sym: 'BOM', color: '#ff6622' },
};

export const DIE_TYPE_KEYS    = ['attack', 'block', 'pierce', 'copy'];
export const SPECIAL_DIE_KEYS = ['leech', 'poison', 'hex', 'bomb'];

export const SIDES_PROGRESSION = [4, 6, 8, 10, 12, 20];

export const STARTER_DICE = [
  { id: 's0', type: 'attack', sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 's1', type: 'block',  sides: 6, runeMap: {}, material: null, culledFaces: [] },
];

export const FIGHTER_CONFIG = [
  { id: 'f0', type: 'attack', sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'f1', type: 'block',  sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'f2', type: 'pierce', sides: 6, runeMap: {}, material: null, culledFaces: [] },
];

export const MAGICIAN_CONFIG = [
  { id: 'm0', type: 'attack', sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'm1', type: 'block',  sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'm2', type: 'copy',   sides: 6, runeMap: {}, material: null, culledFaces: [] },
];

export const ALCHEMIST_CONFIG = [
  { id: 'al0', type: 'attack', sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'al1', type: 'block',  sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'al2', type: 'poison', sides: 4, runeMap: {}, material: null, culledFaces: [] },
];

export const BRUTE_CONFIG = [
  { id: 'br0', type: 'attack', sides: 6, runeMap: {}, material: null, culledFaces: [] },
  { id: 'br1', type: 'block',  sides: 6, runeMap: {}, material: null, culledFaces: [] },
];
