// ─── Google Sheet CSV URL ────────────────────────────────────────────────────
// Publish your sheet: File → Share → Publish to web → CSV → copy URL here.
// Leave empty to always use the fallback list below.
export const SHEET_CSV_URL = '';

// ─── Fallback relic definitions ───────────────────────────────────────────────
// These are used when the sheet URL is empty or the fetch fails.
// Sheet columns (header row): id,name,description,rarity,trigger,effect,value,color
//
// trigger  : PASSIVE | START_TURN | ON_SETTLE | ON_ATTACK_HIT | ON_BLOCK | ON_DAMAGE_TAKEN | ON_KILL
// effect   : see EFFECT_TYPES below
// rarity   : common | uncommon | rare | boss
export const FALLBACK_RELICS = [
  // ── Common ──────────────────────────────────────────────────────────────────
  { id: 'burning_blood',     name: 'Burning Blood',      description: 'Heal 4 HP when you defeat an enemy.',              rarity: 'common',   trigger: 'ON_KILL',         effect: 'HEAL_ON_KILL',        value: 4,    color: '#e74c3c', synergies: ['vampiric_blade', 'happy_flower', 'meditation_stone'] },
  { id: 'anchor',            name: 'Anchor',             description: 'Start each turn with 3 Block.',                    rarity: 'common',   trigger: 'START_TURN',      effect: 'START_TURN_BLOCK',    value: 3,    color: '#3498db', synergies: ['stone_calendar', 'orichalcum', 'booming_shield', 'philosopher_stone'] },
  { id: 'molten_egg',        name: 'Molten Egg',         description: 'All attacks deal +2 damage.',                      rarity: 'common',   trigger: 'PASSIVE',         effect: 'BONUS_ATTACK_FLAT',   value: 2,    color: '#e67e22', synergies: ['war_paint', 'iron', 'fire', 'cursed_tome'] },
  { id: 'happy_flower',      name: 'Happy Flower',       description: 'Heal 1 HP each time any die settles.',             rarity: 'common',   trigger: 'ON_SETTLE',       effect: 'HEAL_ON_SETTLE',      value: 1,    color: '#f0c040', synergies: ['burning_blood', 'meditation_stone', 'giants_belt'] },
  { id: 'dead_branch',       name: 'Dead Branch',        description: 'Apply 1 Poison when an attack lands.',             rarity: 'common',   trigger: 'ON_ATTACK_HIT',   effect: 'POISON_ON_HIT',       value: 1,    color: '#58d68d', synergies: ['mango', 'venom', 'toxic', 'plague', 'poison'] },
  { id: 'meditation_stone',  name: 'Meditation Stone',   description: 'Heal 1 HP at the start of each turn.',             rarity: 'common',   trigger: 'START_TURN',      effect: 'START_TURN_HEAL',     value: 1,    color: '#27ae60', synergies: ['happy_flower', 'burning_blood', 'giants_belt'] },
  // ── Uncommon ────────────────────────────────────────────────────────────────
  { id: 'philosopher_stone', name: "Philosopher's Stone",description: 'Heal 2 HP when a block die activates.',            rarity: 'uncommon', trigger: 'ON_BLOCK',        effect: 'HEAL_ON_BLOCK',       value: 2,    color: '#1abc9c', synergies: ['anchor', 'orichalcum', 'booming_shield', 'block'] },
  { id: 'thorned_armor',     name: 'Thorned Armor',      description: 'Deal 3 damage to the enemy when you take damage.', rarity: 'uncommon', trigger: 'ON_DAMAGE_TAKEN', effect: 'THORNS',              value: 3,    color: '#95a5a6', synergies: ['weaken', 'vulnerable_heart'] },
  { id: 'orichalcum',        name: 'Orichalcum',         description: 'All Block amounts are doubled.',                   rarity: 'uncommon', trigger: 'PASSIVE',         effect: 'BLOCK_MULTIPLIER',    value: 2,    color: '#16a085', synergies: ['anchor', 'stone_calendar', 'booming_shield', 'block'] },
  { id: 'war_paint',         name: 'War Paint',          description: 'All attacks deal +4 damage.',                      rarity: 'uncommon', trigger: 'PASSIVE',         effect: 'BONUS_ATTACK_FLAT',   value: 4,    color: '#c0392b', synergies: ['molten_egg', 'iron', 'fire', 'steel', 'cursed_tome'] },
  { id: 'stone_calendar',    name: 'Stone Calendar',     description: 'Start each turn with 5 Block.',                    rarity: 'uncommon', trigger: 'START_TURN',      effect: 'START_TURN_BLOCK',    value: 5,    color: '#3498db', synergies: ['anchor', 'orichalcum', 'booming_shield', 'block'] },
  { id: 'mango',             name: 'Mango',              description: 'Apply 2 Poison when an attack lands.',             rarity: 'uncommon', trigger: 'ON_ATTACK_HIT',   effect: 'POISON_ON_HIT',       value: 2,    color: '#58d68d', synergies: ['dead_branch', 'venom', 'toxic', 'plague', 'poison'] },
  { id: 'booming_shield',    name: 'Booming Shield',     description: 'All Block dice gain +3.',                          rarity: 'uncommon', trigger: 'PASSIVE',         effect: 'BONUS_BLOCK_FLAT',    value: 3,    color: '#2980b9', synergies: ['anchor', 'stone_calendar', 'orichalcum', 'block'] },
  { id: 'giants_belt',       name: "Giant's Belt",       description: 'Maximum HP +8. Heal 8 HP.',                        rarity: 'uncommon', trigger: 'PASSIVE',         effect: 'MAX_HP_UP',           value: 8,    color: '#2ecc71', synergies: ['meditation_stone', 'happy_flower', 'burning_blood'] },
  // ── Uncommon (clean land) ───────────────────────────────────────────────────
  { id: 'steady_hand',       name: 'Steady Hand',        description: 'Any die that lands without hitting anything adds +4 to its effect.', rarity: 'uncommon', trigger: 'PASSIVE', effect: 'CLEAN_LAND_BONUS', value: 4, color: '#f0c040', synergies: ['phantom', 'egyptian'] },
  // ── Rare ────────────────────────────────────────────────────────────────────
  { id: 'vampiric_blade',    name: 'Vampiric Blade',     description: 'Heal for 25% of attack damage dealt.',             rarity: 'rare',     trigger: 'ON_ATTACK_HIT',   effect: 'LIFE_STEAL',          value: 0.25, color: '#8e44ad', synergies: ['burning_blood', 'leech', 'happy_flower'] },
  { id: 'cursed_tome',       name: 'Cursed Tome',        description: 'All attacks deal 1.5× damage.',                   rarity: 'rare',     trigger: 'PASSIVE',         effect: 'ATTACK_MULTIPLIER',   value: 1.5,  color: '#9b59b6', synergies: ['war_paint', 'viking', 'steel', 'expose', 'rock'] },
  { id: 'piercing_lance',    name: 'Piercing Lance',     description: 'All attacks ignore enemy block.',                  rarity: 'rare',     trigger: 'PASSIVE',         effect: 'PIERCE_ALL',          value: 1,    color: '#e74c3c', synergies: ['rock', 'cursed_tome', 'pierce'] },
  // ── Rare (bumper) ───────────────────────────────────────────────────────────
  { id: 'spiked_bumper',     name: 'Spiked Bumper',      description: 'When a die hits the enemy bumper, deal its max face value as damage (with material and rune effects).', rarity: 'rare', trigger: 'ON_HIT_BUMPER', effect: 'MAX_FACE_DAMAGE', value: 1, color: '#e74c3c', synergies: ['viking', 'steel', 'cursed'] },
  // ── Boss ────────────────────────────────────────────────────────────────────
  { id: 'vulnerable_heart',  name: 'Vulnerable Heart',   description: 'The enemy always takes 50% more damage.',          rarity: 'boss',     trigger: 'PASSIVE',         effect: 'ENEMY_WEAKENED',      value: 1,    color: '#ff4488', synergies: ['expose', 'weaken', 'cursed', 'cursed_tome', 'thorned_armor'] },
  // ── Custom-exclusive ─────────────────────────────────────────────────────────
  { id: 'blood_harvest',     name: 'Blood Harvest',      description: 'No maximum HP. Every point of damage you deal siphons into your health. Start with 15 HP.', rarity: 'rare', trigger: 'PASSIVE', effect: 'SIPHON_HP', value: 1, color: '#cc2244', exclusive: 'custom' },
];

// ─── Effect type registry (documentation / for sheet authors) ─────────────────
// Paste this table as a second sheet tab so designers know what each effect does.
export const EFFECT_TYPES = {
  // Passive (always on)
  BONUS_ATTACK_FLAT:  'Add value to all attack/pierce/bomb/leech damage',
  BONUS_BLOCK_FLAT:   'Add value to all block die output',
  ATTACK_MULTIPLIER:  'Multiply all attack output by value (e.g. 1.5 = +50%)',
  BLOCK_MULTIPLIER:   'Multiply all block output by value',
  PIERCE_ALL:         'All attacks ignore enemy block',
  ENEMY_WEAKENED:     'Enemy permanently takes 50% more damage each turn',
  MAX_HP_UP:          'Increase max HP by value and heal for that amount immediately',
  // Start of turn
  START_TURN_BLOCK:   'Gain value Block at the start of each turn',
  START_TURN_HEAL:    'Heal value HP at the start of each turn',
  // On die settle
  HEAL_ON_SETTLE:     'Heal value HP each time any player die settles',
  // On attack landing
  POISON_ON_HIT:      'Apply value Poison stacks to enemy when an attack deals damage',
  LIFE_STEAL:         'Heal for (value × damage dealt) — e.g. value 0.25 = 25%',
  // On block die
  HEAL_ON_BLOCK:      'Heal value HP when a block die activates',
  // On taking damage
  THORNS:             'Deal value damage to enemy when the player takes damage',
  // On kill
  HEAL_ON_KILL:       'Heal value HP when the enemy is defeated',
  // Clean landing (die settles without any collision)
  CLEAN_LAND_BONUS:   'Add value to effect when the die lands without hitting anything',
  // On hitting enemy bumper
  MAX_FACE_DAMAGE:    'Deal the die\'s max face value as damage (material + rune effects) when it hits the enemy bumper',
};

// ─── Loader ───────────────────────────────────────────────────────────────────

let _cache = null;

function _parseCSVLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"')               inQ = !inQ;
    else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
    else                           cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

function _parseCSV(csv) {
  return csv.split('\n').slice(1)
    .map(l => l.trim()).filter(Boolean)
    .map(line => {
      const [id, name, description, rarity, trigger, effect, rawValue, color] = _parseCSVLine(line);
      const value = parseFloat(rawValue);
      if (!id || !effect) return null;
      return { id, name: name || id, description: description || '', rarity: rarity || 'common',
               trigger, effect, value: isNaN(value) ? 0 : value, color: color || '#ffffff' };
    })
    .filter(Boolean);
}

export async function loadRelics() {
  if (_cache) return _cache;
  if (SHEET_CSV_URL) {
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = _parseCSV(await res.text());
      if (parsed.length > 0) {
        console.log(`Loaded ${parsed.length} relics from sheet.`);
        _cache = parsed;
        return _cache;
      }
    } catch (e) {
      console.warn('Relic sheet unavailable, using fallback:', e.message);
    }
  }
  _cache = FALLBACK_RELICS;
  return _cache;
}

export function getRelics() {
  return _cache ?? FALLBACK_RELICS;
}
