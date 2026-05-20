// All face token definitions
export const FACES = {
  blank:   { id: 'blank',   label: 'Blank',    sym: '--',   color: '#777777', effect: null },
  strike:  { id: 'strike',  label: 'Strike',   sym: 'ATK',  color: '#e74c3c', effect: 'damage',  value: 3, target: 'front' },
  strike2: { id: 'strike2', label: 'Strike 2', sym: 'ATK2', color: '#c0392b', effect: 'damage',  value: 6, target: 'front' },
  cleave:  { id: 'cleave',  label: 'Cleave',   sym: 'CLV',  color: '#e67e22', effect: 'cleave',  value: 3 },
  defend:  { id: 'defend',  label: 'Defend',   sym: 'DEF',  color: '#3498db', effect: 'block',   value: 2 },
  defend2: { id: 'defend2', label: 'Defend 2', sym: 'DEF2', color: '#2980b9', effect: 'block',   value: 4 },
  brace:   { id: 'brace',   label: 'Brace',    sym: 'BRC',  color: '#2471a3', effect: 'brace',   value: 4 },
  mend:    { id: 'mend',    label: 'Mend',     sym: 'MND',  color: '#2ecc71', effect: 'heal',    value: 4 },
  chaos:   { id: 'chaos',   label: 'Chaos',    sym: 'CHS',  color: '#9b59b6', effect: 'chaos' },
  pierce:  { id: 'pierce',  label: 'Pierce',   sym: 'PRC',  color: '#c0392b', effect: 'pierce',  value: 6 },
  // Enemy-only
  e_atk1:  { id: 'e_atk1', label: 'Atk 1',    sym: 'ATK',  color: '#e74c3c', effect: 'enemy_damage', value: 3 },
  e_atk2:  { id: 'e_atk2', label: 'Atk 2',    sym: 'ATK',  color: '#c0392b', effect: 'enemy_damage', value: 5 },
  e_atk3:  { id: 'e_atk3', label: 'Atk 3',    sym: 'ATK',  color: '#922b21', effect: 'enemy_damage', value: 8 },
  e_blk:   { id: 'e_blk',  label: 'Block',    sym: 'BLK',  color: '#2980b9', effect: 'enemy_block',  value: 3 },
  e_buff:  { id: 'e_buff', label: 'Buff',     sym: 'BUF',  color: '#e67e22', effect: 'enemy_buff',   value: 3 },
  e_blank: { id: 'e_blank', label: 'Blank',   sym: '--',   color: '#555555', effect: null },
};

// Tokens the player can put on their dice (for upgrade screen)
export const PLAYER_TOKENS = [
  'blank', 'strike', 'strike2', 'cleave', 'defend', 'defend2', 'brace', 'mend', 'chaos', 'pierce'
];

// Starting player dice configurations
export const STARTER_DICE = [
  { id: 'd1', faces: ['blank', 'blank', 'defend', 'defend', 'strike', 'cleave'] },
  { id: 'd2', faces: ['blank', 'strike', 'strike', 'defend', 'mend',  'cleave'] },
  { id: 'd3', faces: ['blank', 'blank', 'strike', 'strike', 'cleave', 'defend'] },
];

// Enemy definitions
export const ENEMIES = {
  grunt: {
    name: 'Grunt',
    hp: 14,
    tier: 'minion',
    color: '#e74c3c',
    dice: [
      { faces: ['e_atk1', 'e_atk1', 'e_atk2', 'e_blank', 'e_blank', 'e_blk'] }
    ]
  },
  soldier: {
    name: 'Soldier',
    hp: 22,
    tier: 'standard',
    color: '#c0392b',
    dice: [
      { faces: ['e_atk1', 'e_atk2', 'e_atk2', 'e_blk',  'e_blank', 'e_buff'] },
      { faces: ['e_atk1', 'e_atk1', 'e_blank', 'e_blank', 'e_blk',  'e_blk'] }
    ]
  },
  captain: {
    name: 'Captain',
    hp: 30,
    tier: 'elite',
    color: '#922b21',
    dice: [
      { faces: ['e_atk2', 'e_atk2', 'e_atk3', 'e_blk',  'e_buff',  'e_blank'] },
      { faces: ['e_atk1', 'e_atk2', 'e_atk2', 'e_blk',  'e_blk',   'e_blank'] },
      { faces: ['e_atk1', 'e_atk1', 'e_atk2', 'e_blank', 'e_blank', 'e_blk'] }
    ]
  }
};

export const BATTLE_SEQUENCE = ['grunt', 'soldier', 'captain'];
