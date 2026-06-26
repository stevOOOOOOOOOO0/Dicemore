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

  // ── TUTORIAL ────────────────────────────────────────────────────────────

  training_dummy: {
    name: 'Training Dummy', hp: 14, tier: 'minion', color: '#f39c12', obstacleCount: 0,
    intents: [
      { type: 'attack', value: 2, weight: 3 },
      { type: 'attack', value: 3, weight: 2 },
      { type: 'block',  value: 3, weight: 2 },
    ],
    enemyDice: [{ type: 'attack', sides: 8 }, { type: 'attack', sides: 8 }],
  },

  // ── MINIONS (1 obstacle · HP 26-42) ────────────────────────────────────

  red_louse: {
    name: 'Red Louse', hp: 26, tier: 'minion', color: '#e74c3c', obstacleCount: 0,
    intents: [
      { type: 'attack',   value: 5,  weight: 4 },
      { type: 'attack',   value: 8,  weight: 2 },
      { type: 'attack',   value: 3,  weight: 2 },
      { type: 'strength', value: 1,  weight: 2 },
    ],
    enemyDice: [{ type: 'attack', sides: 12 }, { type: 'attack', sides: 12 }],
  },

  cultist: {
    name: 'Cultist', hp: 24, tier: 'minion', color: '#9b59b6', obstacleCount: 0,
    // Stacks strength — harmless at first, terrifying later
    intents: [
      { type: 'strength', value: 2,  weight: 5 },
      { type: 'attack',   value: 4,  weight: 2 },
      { type: 'strength', value: 3,  weight: 2 },
      { type: 'attack',   value: 7,  weight: 1 },
    ],
    enemyDice: [{ type: 'attack', sides: 12 }, { type: 'attack', sides: 12 }, { type: 'frail', sides: 8 }, { type: 'frail', sides: 8 }],
  },

  jaw_worm: {
    name: 'Jaw Worm', hp: 42, tier: 'minion', color: '#c0392b', obstacleCount: 0,
    intents: [
      { type: 'attack',   value: 8,  weight: 3 },
      { type: 'strength', value: 2,  weight: 3 },
      { type: 'block',    value: 7,  weight: 2 },
      { type: 'attack',   value: 12, weight: 2 },
    ],
    enemyDice: [{ type: 'attack', sides: 16 }, { type: 'attack', sides: 16 }],
  },

  // ── STANDARDS (2 obstacles · HP 48-62) ─────────────────────────────────

  spike_slime: {
    name: 'Spike Slime', hp: 52, tier: 'standard', color: '#58d68d', obstacleCount: 0,
    intents: [
      { type: 'vulnerable', value: 1, weight: 4 },
      { type: 'attack',     value: 6, weight: 3 },
      { type: 'attack',     value: 9, weight: 2 },
      { type: 'strength',   value: 2, weight: 1 },
    ],
    enemyDice: [{ type: 'attack', sides: 16 }, { type: 'attack', sides: 16 }, { type: 'block', sides: 12 }, { type: 'block', sides: 12 }],
  },

  green_louse: {
    name: 'Green Louse', hp: 44, tier: 'standard', color: '#27ae60', obstacleCount: 0,
    intents: [
      { type: 'frail',    value: 1,  weight: 4 },
      { type: 'attack',   value: 7,  weight: 3 },
      { type: 'attack',   value: 11, weight: 2 },
      { type: 'vulnerable', value: 1, weight: 1 },
    ],
    enemyDice: [{ type: 'attack', sides: 12 }, { type: 'attack', sides: 12 }, { type: 'attack', sides: 12 }, { type: 'attack', sides: 12 }],
  },

  fungal_beast: {
    name: 'Fungal Beast', hp: 62, tier: 'standard', color: '#8e44ad', obstacleCount: 0,
    intents: [
      { type: 'attack',   value: 8,  weight: 3 },
      { type: 'strength', value: 2,  weight: 3 },
      { type: 'block',    value: 9,  weight: 2 },
      { type: 'attack',   value: 12, weight: 2 },
    ],
    enemyDice: [{ type: 'attack', sides: 16 }, { type: 'attack', sides: 16 }, { type: 'strength', sides: 12 }, { type: 'strength', sides: 12 }],
  },

  // ── ELITES (3 obstacles · HP 80-96) ────────────────────────────────────

  gremlin_nob: {
    name: 'Gremlin Nob', hp: 80, tier: 'elite', color: '#e67e22', obstacleCount: 0,
    intents: [
      { type: 'multi', weight: 3, intents: [{ type: 'vulnerable', value: 1 }, { type: 'attack', value: 10 }] },
      { type: 'attack',   value: 14, weight: 3 },
      { type: 'strength', value: 3,  weight: 2 },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 18 }, { type: 'strength', value: 2 }] },
    ],
    enemyDice: [{ type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'strength', sides: 12 }, { type: 'strength', sides: 12 }],
  },

  lagavulin: {
    name: 'Lagavulin', hp: 96, tier: 'elite', color: '#2c3e50', obstacleCount: 0,
    intents: [
      { type: 'block',    value: 12, weight: 3 },
      { type: 'attack',   value: 16, weight: 3 },
      { type: 'attack',   value: 21, weight: 2 },
      { type: 'multi', weight: 2, intents: [{ type: 'frail', value: 1 }, { type: 'attack', value: 14 }] },
    ],
    enemyDice: [{ type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'block', sides: 16 }, { type: 'block', sides: 16 }],
  },

  bronze_automaton: {
    name: 'Automaton', hp: 86, tier: 'elite', color: '#ba8c63', obstacleCount: 0,
    intents: [
      { type: 'attack',   value: 10, weight: 3 },
      { type: 'strength', value: 3,  weight: 3 },
      { type: 'multi', weight: 2, intents: [{ type: 'frail', value: 1 }, { type: 'attack', value: 8 }] },
      { type: 'attack',   value: 15, weight: 2 },
    ],
    enemyDice: [{ type: 'attack', sides: 16 }, { type: 'attack', sides: 16 }, { type: 'attack', sides: 16 }, { type: 'attack', sides: 16 }, { type: 'block', sides: 12 }, { type: 'block', sides: 12 }],
  },

  // ── BOSSES (4 obstacles · HP 130-150) ──────────────────────────────────

  slime_lord: {
    name: 'Slime Lord', hp: 130, tier: 'elite', color: '#2ecc71', obstacleCount: 0,
    intents: [
      { type: 'multi', weight: 3, intents: [{ type: 'vulnerable', value: 1 }, { type: 'attack', value: 12 }] },
      { type: 'attack',   value: 17, weight: 3 },
      { type: 'strength', value: 3,  weight: 2 },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 21 }, { type: 'frail', value: 1 }] },
    ],
    enemyDice: [{ type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'strength', sides: 14 }, { type: 'strength', sides: 14 }],
  },

  hexaghost: {
    name: 'Hexaghost', hp: 150, tier: 'boss', color: '#cc88ff', obstacleCount: 0,
    // Pure chaos — always multi-intent
    intents: [
      { type: 'multi', weight: 3, intents: [{ type: 'strength', value: 2 }, { type: 'attack', value: 12 }] },
      { type: 'multi', weight: 3, intents: [{ type: 'vulnerable', value: 1 }, { type: 'frail', value: 1 }] },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 19 }, { type: 'strength', value: 2 }] },
      { type: 'multi', weight: 2, intents: [{ type: 'attack', value: 23 }, { type: 'vulnerable', value: 1 }] },
    ],
    enemyDice: [{ type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'attack', sides: 20 }, { type: 'block', sides: 16 }, { type: 'block', sides: 16 }, { type: 'strength', sides: 12 }, { type: 'strength', sides: 12 }],
  },

  // ── ALTERNATES (swap-in pool for branching map routes) ──────────────────
  // Each is a named alternative to a roster slot. Not in BATTLE_SEQUENCE —
  // routed via map logic when the branching map system is implemented.

  witch: {
    name: 'The Hex', hp: 22, tier: 'minion', color: '#cc44ff', obstacleCount: 0,
    abilities: [{ id: 'bumper_enrage', value: 2 }],
    enemyDice: [{ type: 'attack', sides: 10 }, { type: 'attack', sides: 10 }, { type: 'frail', sides: 8 }, { type: 'frail', sides: 8 }],
  },

  void_worm: {
    name: 'The Maw', hp: 38, tier: 'minion', color: '#4444cc', obstacleCount: 0,
    abilities: [{ id: 'flat_reduction', value: 2 }],
    enemyDice: [{ type: 'attack', sides: 14 }, { type: 'attack', sides: 14 }],
  },

  shatter_slime: {
    name: 'The Smashball', hp: 48, tier: 'standard', color: '#58d68d', obstacleCount: 0,
    abilities: [{ id: 'glass_curse' }],
    enemyDice: [{ type: 'attack', sides: 14 }, { type: 'attack', sides: 14 }, { type: 'block', sides: 10 }, { type: 'block', sides: 10 }],
  },

  swarm: {
    name: 'The Pack', hp: 36, tier: 'standard', color: '#27ae60', obstacleCount: 0,
    abilities: [{ id: 'contact_drain' }],
    enemyDice: [{ type: 'attack', sides: 10 }, { type: 'attack', sides: 10 }, { type: 'attack', sides: 10 }, { type: 'attack', sides: 10 }],
  },

  mycelium: {
    name: 'The Tangle', hp: 56, tier: 'standard', color: '#8e44ad', obstacleCount: 0,
    abilities: [{ id: 'obstacle_buff', value: 2 }],
    enemyDice: [{ type: 'attack', sides: 14 }, { type: 'attack', sides: 14 }, { type: 'strength', sides: 10 }, { type: 'strength', sides: 10 }],
  },

  pinball_nob: {
    name: 'Pinball Pete', hp: 72, tier: 'elite', color: '#f39c12', obstacleCount: 0,
    abilities: [{ id: 'bouncy_bumpers' }],
    enemyDice: [{ type: 'attack', sides: 18 }, { type: 'attack', sides: 18 }, { type: 'strength', sides: 10 }, { type: 'strength', sides: 10 }],
  },

  tar_giant: {
    name: 'Tar Molly', hp: 88, tier: 'elite', color: '#2c3e50', obstacleCount: 0,
    abilities: [{ id: 'sticky_walls' }],
    enemyDice: [{ type: 'attack', sides: 18 }, { type: 'attack', sides: 18 }, { type: 'block', sides: 14 }, { type: 'block', sides: 14 }],
  },

  artillery_bot: {
    name: 'The Gatling', hp: 80, tier: 'elite', color: '#ba8c63', obstacleCount: 0,
    abilities: [{ id: 'bullet_throws' }],
    enemyDice: [{ type: 'attack', sides: 14 }, { type: 'attack', sides: 14 }, { type: 'attack', sides: 14 }, { type: 'attack', sides: 14 }, { type: 'block', sides: 10 }, { type: 'block', sides: 10 }],
  },

};

// Ordered battle progression: minions → standards → elites → bosses
export const BATTLE_SEQUENCE = [
  'red_louse', 'cultist', 'jaw_worm',
  'spike_slime', 'green_louse', 'fungal_beast',
  'gremlin_nob', 'lagavulin', 'bronze_automaton',
  'slime_lord', 'hexaghost',
];
