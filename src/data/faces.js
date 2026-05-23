// All face token definitions
export const FACES = {
  blank:   { id: 'blank',   label: 'Blank',    sym: '--',   color: '#777777', effect: null },
  strike:  { id: 'strike',  label: 'Strike',   sym: 'ATK',  color: '#e74c3c', effect: 'damage',  value: 5, target: 'front' },
  strike2: { id: 'strike2', label: 'Strike 2', sym: 'ATK2', color: '#c0392b', effect: 'damage',  value: 8, target: 'front' },
  cleave:  { id: 'cleave',  label: 'Cleave',   sym: 'CLV',  color: '#e67e22', effect: 'cleave',  value: 3 },
  defend:  { id: 'defend',  label: 'Defend',   sym: 'DEF',  color: '#3498db', effect: 'block',   value: 2 },
  defend2: { id: 'defend2', label: 'Defend 2', sym: 'DEF2', color: '#2980b9', effect: 'block',   value: 4 },
  brace:   { id: 'brace',   label: 'Brace',    sym: 'BRC',  color: '#2471a3', effect: 'brace',   value: 4 },
  mend:    { id: 'mend',    label: 'Mend',     sym: 'MND',  color: '#2ecc71', effect: 'heal',    value: 4 },
  chaos:   { id: 'chaos',   label: 'Chaos',    sym: 'CHS',  color: '#9b59b6', effect: 'chaos' },
  pierce:  { id: 'pierce',  label: 'Pierce',   sym: 'PRC',  color: '#c0392b', effect: 'pierce',  value: 6 },

  // ─── Enemy faces ──────────────────────────────────────────────────────────
  // Damage tiers
  e_atk1:   { id: 'e_atk1',   sym: 'ATK', color: '#e74c3c', effect: 'enemy_damage',     value: 3  },
  e_atk2:   { id: 'e_atk2',   sym: 'ATK', color: '#c0392b', effect: 'enemy_damage',     value: 5  },
  e_atk3:   { id: 'e_atk3',   sym: 'ATK', color: '#922b21', effect: 'enemy_damage',     value: 8  },
  e_atk4:   { id: 'e_atk4',   sym: 'ATK', color: '#641e16', effect: 'enemy_damage',     value: 12 },
  // Block tiers
  e_blk:    { id: 'e_blk',    sym: 'BLK', color: '#2980b9', effect: 'enemy_block',      value: 3  },
  e_blk2:   { id: 'e_blk2',   sym: 'BLK', color: '#1a5276', effect: 'enemy_block',      value: 5  },
  // Status effects
  e_str:    { id: 'e_str',    sym: 'STR', color: '#e67e22', effect: 'enemy_strength',   value: 2  },
  e_poison: { id: 'e_poison', sym: 'PSN', color: '#58d68d', effect: 'enemy_poison',     value: 2  },
  e_vuln:   { id: 'e_vuln',   sym: 'VLN', color: '#bb44cc', effect: 'enemy_vulnerable', value: 1  },
  // Filler
  e_blank:  { id: 'e_blank',  sym: '--',  color: '#555555', effect: null                          },
};

// ─── Enemy roster ──────────────────────────────────────────────────────────

export const ENEMIES = {

  // ── MINIONS (1 die · HP 8-14) ───────────────────────────────────────────

  red_louse: {
    name: 'Red Louse', hp: 18, tier: 'minion', color: '#e74c3c',
    dice: [
      { faces: ['e_atk2', 'e_atk2', 'e_atk1', 'e_atk1', 'e_blk', 'e_atk1'] },
    ],
  },

  cultist: {
    name: 'Cultist', hp: 16, tier: 'minion', color: '#9b59b6',
    // Mostly stacks strength — harmless at first, terrifying by turn 3+
    dice: [
      { faces: ['e_str', 'e_str', 'e_str', 'e_atk2', 'e_atk1', 'e_blank'] },
    ],
  },

  jaw_worm: {
    name: 'Jaw Worm', hp: 28, tier: 'minion', color: '#c0392b',
    dice: [
      { faces: ['e_atk3', 'e_atk2', 'e_atk3', 'e_atk2', 'e_str', 'e_atk1'] },
    ],
  },

  // ── STANDARDS (2 dice · HP 14-22) ───────────────────────────────────────

  spike_slime: {
    name: 'Spike Slime', hp: 36, tier: 'standard', color: '#58d68d',
    dice: [
      { faces: ['e_atk2', 'e_atk2', 'e_poison', 'e_atk1', 'e_blank', 'e_blk'] },
      { faces: ['e_atk2', 'e_poison', 'e_poison', 'e_atk1', 'e_atk1', 'e_blank'] },
    ],
  },

  green_louse: {
    name: 'Green Louse', hp: 28, tier: 'standard', color: '#27ae60',
    // One die applies vulnerable, the other just attacks — punishes passive play
    dice: [
      { faces: ['e_vuln', 'e_vuln', 'e_atk1', 'e_atk1', 'e_atk1', 'e_blank'] },
      { faces: ['e_atk2', 'e_atk2', 'e_atk2', 'e_atk1', 'e_blank', 'e_atk1'] },
    ],
  },

  fungal_beast: {
    name: 'Fungal Beast', hp: 44, tier: 'standard', color: '#8e44ad',
    dice: [
      { faces: ['e_atk2', 'e_str', 'e_str', 'e_atk2', 'e_atk1', 'e_blank'] },
      { faces: ['e_atk2', 'e_blk', 'e_atk2', 'e_str', 'e_atk1', 'e_blank'] },
    ],
  },

  // ── ELITES (3 dice · HP 28-34) ──────────────────────────────────────────

  gremlin_nob: {
    name: 'Gremlin Nob', hp: 56, tier: 'elite', color: '#e67e22',
    // Applies vulnerable then follows up with heavy hits; also stacks strength
    dice: [
      { faces: ['e_vuln', 'e_atk2', 'e_atk2', 'e_atk1', 'e_str', 'e_blank'] },
      { faces: ['e_atk3', 'e_atk2', 'e_atk2', 'e_atk2', 'e_blank', 'e_blk'] },
      { faces: ['e_atk3', 'e_atk3', 'e_str', 'e_atk2', 'e_blank', 'e_blank'] },
    ],
  },

  lagavulin: {
    name: 'Lagavulin', hp: 68, tier: 'elite', color: '#2c3e50',
    // Heavily armored — lots of block, but when hits land they HURT
    dice: [
      { faces: ['e_blk2', 'e_blk2', 'e_blk', 'e_atk3', 'e_atk3', 'e_blank'] },
      { faces: ['e_blk', 'e_blk', 'e_atk3', 'e_atk4', 'e_atk3', 'e_blank'] },
      { faces: ['e_blk2', 'e_atk3', 'e_atk3', 'e_atk2', 'e_blank', 'e_blank'] },
    ],
  },

  bronze_automaton: {
    name: 'Automaton', hp: 60, tier: 'elite', color: '#ba8c63',
    // Relentless consistent damage + strength accumulation
    dice: [
      { faces: ['e_atk3', 'e_atk2', 'e_atk2', 'e_atk2', 'e_str', 'e_atk1'] },
      { faces: ['e_atk2', 'e_atk3', 'e_atk2', 'e_atk1', 'e_blank', 'e_blk'] },
      { faces: ['e_atk2', 'e_atk2', 'e_str', 'e_str', 'e_atk1', 'e_blank'] },
    ],
  },

  // ── BOSSES (4 dice · HP 46-52) ──────────────────────────────────────────

  slime_lord: {
    name: 'Slime Lord', hp: 92, tier: 'boss', color: '#2ecc71',
    // Heavy poison stacker + big damage — kill it fast or drown in DoT
    dice: [
      { faces: ['e_atk3', 'e_atk3', 'e_poison', 'e_atk2', 'e_atk2', 'e_blank'] },
      { faces: ['e_poison', 'e_poison', 'e_atk2', 'e_atk2', 'e_atk1', 'e_blank'] },
      { faces: ['e_atk3', 'e_atk3', 'e_blk', 'e_atk2', 'e_poison', 'e_str'] },
      { faces: ['e_atk3', 'e_str', 'e_str', 'e_atk2', 'e_atk2', 'e_blank'] },
    ],
  },

  hexaghost: {
    name: 'Hexaghost', hp: 104, tier: 'boss', color: '#cc88ff',
    // Stacks strength aggressively — starts manageable, becomes terrifying
    dice: [
      { faces: ['e_str', 'e_str', 'e_atk3', 'e_atk2', 'e_blank', 'e_blank'] },
      { faces: ['e_atk3', 'e_atk3', 'e_str', 'e_atk2', 'e_atk2', 'e_blank'] },
      { faces: ['e_vuln', 'e_atk3', 'e_str', 'e_str', 'e_atk2', 'e_blank'] },
      { faces: ['e_atk3', 'e_atk3', 'e_atk2', 'e_atk2', 'e_blank', 'e_str'] },
    ],
  },
};

// Ordered battle progression: minions → standards → elites → bosses
export const BATTLE_SEQUENCE = [
  'red_louse', 'cultist', 'jaw_worm',
  'spike_slime', 'green_louse', 'fungal_beast',
  'gremlin_nob', 'lagavulin', 'bronze_automaton',
  'slime_lord', 'hexaghost',
];
