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
// intents: weighted pool of actions drawn each turn.
// type: 'attack'|'block'|'strength'|'vulnerable'|'frail'|'multi'
// multi has an intents[] of sub-intents (processed in order)
// obstacleCount: blank physics dice thrown as obstacles each turn

export const ENEMIES = {

  // ── MINIONS (1 obstacle · HP 16-28) ────────────────────────────────────

  red_louse: {
    name: 'Red Louse', hp: 18, tier: 'minion', color: '#e74c3c', obstacleCount: 1,
    intents: [
      { type: 'attack',   value: 5,  weight: 4 },
      { type: 'attack',   value: 8,  weight: 2 },
      { type: 'attack',   value: 3,  weight: 2 },
      { type: 'strength', value: 1,  weight: 2 },
    ],
  },

  cultist: {
    name: 'Cultist', hp: 16, tier: 'minion', color: '#9b59b6', obstacleCount: 1,
    // Stacks strength — harmless at first, terrifying later
    intents: [
      { type: 'strength', value: 2,  weight: 5 },
      { type: 'attack',   value: 4,  weight: 2 },
      { type: 'strength', value: 3,  weight: 2 },
      { type: 'attack',   value: 7,  weight: 1 },
    ],
  },

  jaw_worm: {
    name: 'Jaw Worm', hp: 28, tier: 'minion', color: '#c0392b', obstacleCount: 1,
    intents: [
      { type: 'attack',   value: 8,  weight: 3 },
      { type: 'strength', value: 2,  weight: 3 },
      { type: 'block',    value: 7,  weight: 2 },
      { type: 'attack',   value: 12, weight: 2 },
    ],
  },

  // ── STANDARDS (2 obstacles · HP 28-44) ─────────────────────────────────

  spike_slime: {
    name: 'Spike Slime', hp: 36, tier: 'standard', color: '#58d68d', obstacleCount: 2,
    intents: [
      { type: 'vulnerable', value: 1, weight: 4 },
      { type: 'attack',     value: 6, weight: 3 },
      { type: 'attack',     value: 9, weight: 2 },
      { type: 'strength',   value: 2, weight: 1 },
    ],
  },

  green_louse: {
    name: 'Green Louse', hp: 28, tier: 'standard', color: '#27ae60', obstacleCount: 2,
    intents: [
      { type: 'frail',    value: 1,  weight: 4 },
      { type: 'attack',   value: 7,  weight: 3 },
      { type: 'attack',   value: 11, weight: 2 },
      { type: 'vulnerable', value: 1, weight: 1 },
    ],
  },

  fungal_beast: {
    name: 'Fungal Beast', hp: 44, tier: 'standard', color: '#8e44ad', obstacleCount: 2,
    intents: [
      { type: 'attack',   value: 8,  weight: 3 },
      { type: 'strength', value: 2,  weight: 3 },
      { type: 'block',    value: 9,  weight: 2 },
      { type: 'attack',   value: 12, weight: 2 },
    ],
  },

  // ── ELITES (3 obstacles · HP 56-68) ────────────────────────────────────

  gremlin_nob: {
    name: 'Gremlin Nob', hp: 56, tier: 'elite', color: '#e67e22', obstacleCount: 3,
    intents: [
      { type: 'multi', weight: 3, intents: [{ type: 'vulnerable', value: 1 }, { type: 'attack', value: 10 }] },
      { type: 'attack',   value: 14, weight: 3 },
      { type: 'strength', value: 3,  weight: 2 },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 18 }, { type: 'strength', value: 2 }] },
    ],
  },

  lagavulin: {
    name: 'Lagavulin', hp: 68, tier: 'elite', color: '#2c3e50', obstacleCount: 3,
    intents: [
      { type: 'block',    value: 12, weight: 3 },
      { type: 'attack',   value: 16, weight: 3 },
      { type: 'attack',   value: 21, weight: 2 },
      { type: 'multi', weight: 2, intents: [{ type: 'frail', value: 1 }, { type: 'attack', value: 14 }] },
    ],
  },

  bronze_automaton: {
    name: 'Automaton', hp: 60, tier: 'elite', color: '#ba8c63', obstacleCount: 3,
    intents: [
      { type: 'attack',   value: 10, weight: 3 },
      { type: 'strength', value: 3,  weight: 3 },
      { type: 'multi', weight: 2, intents: [{ type: 'frail', value: 1 }, { type: 'attack', value: 8 }] },
      { type: 'attack',   value: 15, weight: 2 },
    ],
  },

  // ── BOSSES (4 obstacles · HP 92-104) ───────────────────────────────────

  slime_lord: {
    name: 'Slime Lord', hp: 92, tier: 'boss', color: '#2ecc71', obstacleCount: 4,
    intents: [
      { type: 'multi', weight: 3, intents: [{ type: 'vulnerable', value: 1 }, { type: 'attack', value: 12 }] },
      { type: 'attack',   value: 17, weight: 3 },
      { type: 'strength', value: 3,  weight: 2 },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 21 }, { type: 'frail', value: 1 }] },
    ],
  },

  hexaghost: {
    name: 'Hexaghost', hp: 104, tier: 'boss', color: '#cc88ff', obstacleCount: 4,
    // Pure chaos — always multi-intent
    intents: [
      { type: 'multi', weight: 3, intents: [{ type: 'strength', value: 2 }, { type: 'attack', value: 12 }] },
      { type: 'multi', weight: 3, intents: [{ type: 'vulnerable', value: 1 }, { type: 'frail', value: 1 }] },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 19 }, { type: 'strength', value: 2 }] },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 23 }, { type: 'vulnerable', value: 1 }] },
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
