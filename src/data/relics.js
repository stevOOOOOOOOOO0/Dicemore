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
  { id: 'burning_blood',      name: 'Burning Blood',       description: 'Heal 4 HP when you defeat an enemy.',                              rarity: 'common',   trigger: 'ON_KILL',           effect: 'HEAL_ON_KILL',      value: 4,    color: '#e74c3c', synergies: ['meditation_stone', 'rune_resonance'] },
  { id: 'meditation_stone',   name: 'Meditation Stone',    description: 'Heal 1 HP at the start of each turn.',                             rarity: 'common',   trigger: 'ON_TURN_START',     effect: 'START_TURN_HEAL',   value: 1,    color: '#27ae60', synergies: ['burning_blood', 'rune_resonance'] },
  { id: 'pickpockets_thumb',  name: "Pickpocket's Thumb",  description: 'Whenever a poison die settles, apply 1 extra poison stack.',       rarity: 'common',   trigger: 'ON_SETTLE',         effect: 'PICKPOCKET_THUMB',  value: 1,    color: '#58d68d', synergies: ['seeping_brand', 'festering_brand', 'venom_clock'] },
  // ── Uncommon ────────────────────────────────────────────────────────────────
  { id: 'stone_calendar',     name: 'Stone Calendar',      description: 'Start each turn with 5 block.',                                    rarity: 'uncommon', trigger: 'ON_TURN_START',     effect: 'START_TURN_BLOCK',  value: 5,    color: '#3498db', synergies: ['orichalcum', 'sentinel_brand', 'fortress_brand'] },
  { id: 'venom_clock',        name: 'Venom Clock',         description: 'If the enemy has 3+ poison stacks at turn start, deal 2 damage.',  rarity: 'uncommon', trigger: 'ON_TURN_START',     effect: 'VENOM_CLOCK',       value: 2,    color: '#2ecc71', synergies: ['seeping_brand', 'festering_brand', 'pickpockets_thumb'] },
  { id: 'orichalcum',         name: 'Orichalcum',          description: 'All block amounts are doubled.',                                   rarity: 'uncommon', trigger: 'PASSIVE',           effect: 'BLOCK_MULTIPLIER',  value: 2,    color: '#16a085', synergies: ['stone_calendar', 'fortress_brand', 'sentinel_brand'] },
  { id: 'steady_hand',        name: 'Steady Hand',         description: 'Dice that land without hitting a wall or bumper deal +4 bonus effect. Bouncing off other player dice is fine.',    rarity: 'uncommon', trigger: 'PASSIVE',           effect: 'CLEAN_LAND_BONUS',  value: 4,    color: '#f0c040', synergies: ['phantom', 'anchor_brand'] },
  { id: 'tormentors_ring',    name: "Tormentor's Ring",    description: 'Each time a status is applied to the enemy, deal 1 damage.',       rarity: 'uncommon', trigger: 'ON_STATUS_APPLIED', effect: 'TORMENTOR_RING',    value: 1,    color: '#9b59b6', synergies: ['hex_brand', 'weaken_brand', 'seeping_brand'] },
  { id: 'plague_doctors_coat',name: "Plague Doctor's Coat",description: 'When you take damage, apply 2 poison stacks to the enemy.',        rarity: 'uncommon', trigger: 'ON_DAMAGE_TAKEN',   effect: 'PLAGUE_DOCTOR',     value: 2,    color: '#1a8a40', synergies: ['seeping_brand', 'festering_brand', 'venom_clock'] },
  { id: 'rune_resonance',     name: 'Rune Resonance',      description: 'Heal 1 HP each time a rune fires.',                               rarity: 'uncommon', trigger: 'ON_RUNE_TRIGGER',   effect: 'RUNE_RESONANCE',    value: 1,    color: '#e8c97a', synergies: ['echo_brand', 'sentinel_brand', 'festering_brand'] },
  { id: 'lodestone_heart',    name: 'Lodestone Heart',     description: 'Each time two player dice collide, both gain +1 to their next effect.',      rarity: 'uncommon', trigger: 'ON_CONTACT_DIE',   effect: 'LODESTONE_HEART',   value: 1,    color: '#4488ff', synergies: ['lodestone_brand', 'repulsor_brand', 'conductor_brand'] },
  { id: 'dead_mans_fuse',     name: "Dead Man's Fuse",     description: 'When any player die is destroyed, deal 4 damage to the enemy.',              rarity: 'uncommon', trigger: 'ON_DIE_DESTROYED', effect: 'DEAD_MANS_FUSE',    value: 4,    color: '#cc4400', synergies: ['chain_reaction_brand', 'martyrdom_brand', 'splinter_brand'] },
  { id: 'overkill_charm',     name: 'Overkill Charm',      description: 'When a player die is destroyed, heal 2 HP.',                                   rarity: 'uncommon', trigger: 'ON_DIE_DESTROYED', effect: 'OVERKILL_CHARM',    value: 2,    color: '#ff6600', synergies: ['martyrdom_brand', 'splinter_brand', 'ashen_brand'] },
  { id: 'shrapnel_vest',      name: 'Shrapnel Vest',       description: 'When a player die is destroyed, spawn one d4 ATK die in the tray.',             rarity: 'rare',     trigger: 'ON_DIE_DESTROYED', effect: 'SHRAPNEL_VEST',     value: 1,    color: '#bb8866', synergies: ['splinter_brand', 'counting_knife', 'speed_loader'] },
  { id: 'spiked_bumper',      name: 'Spiked Bumper',       description: 'When a die hits the enemy bumper, deal its max face value as bonus damage.', rarity: 'uncommon', trigger: 'ON_CONTACT_BUMPER_ENEMY', effect: 'MAX_FACE_DAMAGE',   value: 1,    color: '#e74c3c', synergies: ['tremor_brand', 'ricochet_brand', 'iron_forearm'] },
  { id: 'cannonball',         name: 'Cannonball',          description: 'The first die-to-die collision each turn deals 3 bonus damage.',              rarity: 'uncommon', trigger: 'ON_CONTACT_DIE',         effect: 'CANNONBALL',        value: 3,    color: '#ff8800', synergies: ['shockwave_brand', 'crater_brand', 'hairline_brand'] },
  { id: 'iron_forearm',       name: 'Iron Forearm',        description: 'Each time a die hits the enemy bumper, your next throw gets +2 speed.',       rarity: 'uncommon', trigger: 'ON_CONTACT_BUMPER_ENEMY', effect: 'IRON_FOREARM',      value: 2,    color: '#aabbcc', synergies: ['tremor_brand', 'ricochet_brand', 'spiked_bumper'] },
  { id: 'lucky_coin',         name: 'Lucky Coin',          description: 'Once per turn, when a die rolls its max face value, its effect fires twice.', rarity: 'uncommon', trigger: 'ON_SETTLE',     effect: 'LUCKY_COIN',        value: 1,    color: '#f0c040', synergies: ['double_down_brand', 'snake_eyes_brand', 'devils_luck_brand'] },
  { id: 'devils_contract',    name: "The Devil's Contract", description: 'At the start of each turn, lose 2 HP. All dice deal +3 damage this turn.',    rarity: 'rare',     trigger: 'ON_TURN_START', effect: 'DEVILS_CONTRACT',   value: 3,    color: '#c0392b', synergies: ['house_cut_brand', 'devils_luck_brand', 'burning_blood'] },
  { id: 'speed_loader',       name: 'Speed Loader',        description: 'Start each turn with one extra d4 ATK die in the tray.',            rarity: 'uncommon', trigger: 'ON_TURN_START',     effect: 'SPEED_LOADER',      value: 1,    color: '#ff6622', synergies: ['frenzy_brand', 'swarm_brand', 'counting_knife'] },
  { id: 'counting_knife',     name: 'Counting Knife',      description: 'The Nth die to settle this turn deals +N damage.',                   rarity: 'uncommon', trigger: 'ON_SETTLE',         effect: 'COUNTING_KNIFE',    value: 1,    color: '#e74c3c', synergies: ['frenzy_brand', 'flurry_brand', 'speed_loader', 'swarm_brand'] },
  { id: 'paper_cut',          name: 'Paper Cut',           description: 'Each time damage is dealt, apply 1 poison stack to the enemy.',      rarity: 'uncommon', trigger: 'ON_DAMAGE_DEALT',   effect: 'PAPER_CUT',         value: 1,    color: '#cc2222', synergies: ['bleed_brand', 'needlepoint_brand', 'festering_brand'] },
  // ── Rare ────────────────────────────────────────────────────────────────────
  { id: 'amplifier_stone',    name: 'Amplifier Stone',     description: 'If the enemy has 2+ status effects, all damage is +25% this turn.',rarity: 'rare',     trigger: 'ON_TURN_START',     effect: 'AMPLIFIER_STONE',   value: 1.25, color: '#cc88ff', synergies: ['hex_brand', 'weaken_brand', 'seeping_brand', 'tormentors_ring'] },
  { id: 'destroy_echo',       name: 'Destroy Echo',        description: 'Whenever any player die is destroyed, deal damage equal to its highest face value.', rarity: 'rare',     trigger: 'ON_DIE_DESTROYED', effect: 'DESTROY_ECHO',      value: 1,    color: '#ff6633', synergies: ['glass', 'bulletproof_glass', 'dead_mans_fuse'] },
  { id: 'bumper_decoy',       name: 'Bumper Decoy',        description: 'Two fake enemy bumpers appear that look identical but have no hitbox. Hitting the real one deals +5 bonus damage.', rarity: 'uncommon', trigger: 'PASSIVE', effect: 'BUMPER_DECOY', value: 5, color: '#ffee00', synergies: ['spiked_bumper', 'iron_forearm'] },
  { id: 'double_bumper',      name: 'Double Bumper',       description: '[PLANNED] On round start, create a second bumper. Hitting it deals damage and bounces contacted dice.', rarity: 'rare', trigger: 'ON_TURN_START', effect: 'DOUBLE_BUMPER', value: 1, color: '#ffee00', synergies: ['spiked_bumper', 'bumper_decoy'] },
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
