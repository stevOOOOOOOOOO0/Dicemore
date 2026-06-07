export const RUNES = {
  // ── POISON ──────────────────────────────────────────────────────────────────
  seeping_brand:   { id: 'seeping_brand',   rarity: 'common',   label: 'Seeping Brand',   sym: 'SEP', color: '#58d68d', desc: 'Apply poison stacks equal to rolled value.',                        synergies: ['festering_brand', 'slow_drip_brand', 'pickpockets_thumb', 'venom_clock'] },
  festering_brand: { id: 'festering_brand', rarity: 'uncommon', label: 'Festering Brand', sym: 'FST', color: '#2ecc71', desc: 'Double the enemy\'s current poison stack count.',                   synergies: ['seeping_brand', 'virulent_brand', 'venom_clock', 'pickpockets_thumb'] },
  miasma_brand:    { id: 'miasma_brand',    rarity: 'uncommon', label: 'Miasma Brand',    sym: 'MIA', color: '#27ae60', desc: 'Apply Frail to the enemy for 1 turn.',                              synergies: ['seeping_brand', 'weaken_brand', 'bulwark_brand'] },
  slow_drip_brand: { id: 'slow_drip_brand', rarity: 'uncommon', label: 'Slow Drip Brand', sym: 'DRP', color: '#1a8a40', desc: 'Enemy poison stacks do not decay this turn.',                       synergies: ['seeping_brand', 'festering_brand', 'virulent_brand'] },
  virulent_brand:  { id: 'virulent_brand',  rarity: 'rare',     label: 'Virulent Brand',  sym: 'VRL', color: '#0e5c2b', desc: 'Apply poison stacks equal to turns elapsed this battle.',           synergies: ['slow_drip_brand', 'festering_brand', 'patience_brand'] },

  // ── STATUS ──────────────────────────────────────────────────────────────────
  hex_brand:       { id: 'hex_brand',       rarity: 'common',   label: 'Hex Brand',       sym: 'HEX', color: '#9b59b6', desc: 'Apply Vulnerable to the enemy — they take 50% more damage.',      synergies: ['weaken_brand', 'contagion_brand', 'amplify_brand', 'tormentors_ring'] },
  weaken_brand:    { id: 'weaken_brand',    rarity: 'common',   label: 'Weaken Brand',    sym: 'WKN', color: '#8e44ad', desc: 'Apply Frail to the enemy — they deal half damage.',                 synergies: ['hex_brand', 'bulwark_brand', 'amplify_brand', 'tormentors_ring'] },
  amplify_brand:   { id: 'amplify_brand',   rarity: 'uncommon', label: 'Amplify Brand',   sym: 'AMP', color: '#cc88ff', desc: 'All status durations on the enemy are extended by 1.',             synergies: ['hex_brand', 'weaken_brand', 'slow_drip_brand'] },
  wither_brand:    { id: 'wither_brand',    rarity: 'uncommon', label: 'Wither Brand',    sym: 'WTH', color: '#7d3c98', desc: 'Reduce the enemy\'s block by the rolled value.',                   synergies: ['hex_brand', 'contagion_brand'] },
  contagion_brand: { id: 'contagion_brand', rarity: 'rare',     label: 'Contagion Brand', sym: 'CON', color: '#5b2c6f', desc: 'Each status on the enemy deals 1 damage immediately.',             synergies: ['hex_brand', 'weaken_brand', 'seeping_brand', 'tormentors_ring'] },

  // ── HOARDER ─────────────────────────────────────────────────────────────────
  fortress_brand:  { id: 'fortress_brand',  rarity: 'uncommon', label: 'Fortress Brand',  sym: 'FRT', color: '#3498db', desc: 'Gain block equal to rolled value.',                                synergies: ['sentinel_brand', 'absorb_brand', 'orichalcum', 'stone_calendar'] },
  absorb_brand:    { id: 'absorb_brand',    rarity: 'uncommon', label: 'Absorb Brand',    sym: 'ABS', color: '#2980b9', desc: 'Convert half your current block into HP.',                         synergies: ['fortress_brand', 'sentinel_brand', 'orichalcum'] },
  sentinel_brand:  { id: 'sentinel_brand',  rarity: 'uncommon', label: 'Sentinel Brand',  sym: 'SNT', color: '#1abc9c', desc: 'If current block exceeds 5, this die\'s effect fires twice.',      synergies: ['fortress_brand', 'absorb_brand', 'stone_calendar', 'orichalcum'] },
  bulwark_brand:   { id: 'bulwark_brand',   rarity: 'common',   label: 'Bulwark Brand',   sym: 'BLW', color: '#16a085', desc: 'Apply Frail to the enemy and gain 2 block.',                       synergies: ['fortress_brand', 'weaken_brand', 'sentinel_brand'] },
  patience_brand:  { id: 'patience_brand',  rarity: 'uncommon', label: 'Patience Brand',  sym: 'PAT', color: '#148f77', desc: 'Gain 1 block per turn elapsed this battle, up to 6.',              synergies: ['fortress_brand', 'sentinel_brand', 'virulent_brand'] },

  // ── MANIPULATOR ─────────────────────────────────────────────────────────────
  lodestone_brand:  { id: 'lodestone_brand',  rarity: 'uncommon', label: 'Lodestone Brand',  sym: 'LDS', color: '#4488ff', desc: 'Pull all other dice toward this die. Dice that contact it are rerolled.',          synergies: ['gravity_well_brand', 'conductor_brand', 'lodestone_heart'] },
  repulsor_brand:   { id: 'repulsor_brand',   rarity: 'uncommon', label: 'Repulsor Brand',   sym: 'RPL', color: '#88aaff', desc: 'Push all dice away. Closer dice are hit harder.',                                  synergies: ['shockwave_brand', 'conductor_brand', 'lodestone_heart'] },
  puppeteer_brand:  { id: 'puppeteer_brand',  rarity: 'rare',     label: 'Puppeteer Brand',  sym: 'PPT', color: '#cc88ff', desc: 'Teleport a random die to the throw origin and re-launch it in a random direction.',synergies: ['lodestone_brand', 'conductor_brand'] },
  gravity_well_brand:{ id: 'gravity_well_brand', rarity: 'uncommon', label: 'Gravity Well Brand', sym: 'GWL', color: '#3399ff', desc: 'Pin this die in place for 3 seconds. Any die that contacts it is rerolled.', synergies: ['lodestone_brand', 'conductor_brand', 'tremor_brand'] },
  conductor_brand:  { id: 'conductor_brand',  rarity: 'rare',     label: 'Conductor Brand',  sym: 'CDT', color: '#88ddff', desc: 'All dice rerolled this turn gain +1 to their next effect.',                       synergies: ['lodestone_brand', 'gravity_well_brand', 'lodestone_heart'] },

  // ── DESTRUCTION ─────────────────────────────────────────────────────────────
  martyrdom_brand:     { id: 'martyrdom_brand',     rarity: 'uncommon', label: 'Martyrdom Brand',     sym: 'MRT', color: '#cc4400', desc: 'Destroy this die. All other player dice gain +2 to their next rolled value.',           synergies: ['splinter_brand', 'chain_reaction_brand', 'dead_mans_fuse', 'overkill_charm'] },
  splinter_brand:      { id: 'splinter_brand',      rarity: 'uncommon', label: 'Splinter Brand',      sym: 'SPL', color: '#ff6600', desc: 'Destroy this die. Spawn two d4 ATK dice in the tray.',                                  synergies: ['martyrdom_brand', 'chain_reaction_brand', 'shrapnel_vest', 'counting_knife'] },
  chain_reaction_brand:{ id: 'chain_reaction_brand',rarity: 'rare',     label: 'Chain Reaction Brand',sym: 'CRC', color: '#ff4400', desc: 'When this die is destroyed by any cause, deal damage equal to its max face value.',     trigger: 'ON_DIE_DESTROYED', synergies: ['martyrdom_brand', 'splinter_brand', 'dead_mans_fuse', 'glass'] },
  ashen_brand:         { id: 'ashen_brand',         rarity: 'uncommon', label: 'Ashen Brand',         sym: 'ASH', color: '#bb8866', desc: 'Destroy this die. The next die thrown this turn triggers its rune twice.',             synergies: ['martyrdom_brand', 'echo_brand', 'dead_mans_fuse'] },
  rubble_brand:        { id: 'rubble_brand',         rarity: 'uncommon', label: 'Rubble Brand',        sym: 'RBL', color: '#997755', desc: 'Destroy one obstacle die on the board. Gain block equal to its size.',                  synergies: ['fortress_brand', 'sentinel_brand', 'dead_mans_fuse'] },

  // ── IMPACT ──────────────────────────────────────────────────────────────────
  shockwave_brand: { id: 'shockwave_brand', rarity: 'uncommon', label: 'Shockwave Brand', sym: 'SHK', color: '#e74c3c', desc: 'Push all dice within 80px away. Force scales with rolled value.',       synergies: ['tremor_brand', 'ricochet_brand', 'cannonball'] },
  tremor_brand:    { id: 'tremor_brand',    rarity: 'uncommon', label: 'Tremor Brand',    sym: 'TRM', color: '#ff4444', desc: 'Deal bonus damage equal to the number of bumper contacts this throw.',  synergies: ['ricochet_brand', 'shockwave_brand', 'spiked_bumper', 'iron_forearm'] },
  crater_brand:    { id: 'crater_brand',    rarity: 'rare',     label: 'Crater Brand',    sym: 'CRT', color: '#ff8800', desc: 'The first die this die contacted is destroyed. Its effect still fires.', synergies: ['hairline_brand', 'shockwave_brand'] },
  ricochet_brand:  { id: 'ricochet_brand',  rarity: 'uncommon', label: 'Ricochet Brand',  sym: 'RCT', color: '#ff6644', desc: 'After effect resolves, this die relaunches toward the last bumper it hit.', synergies: ['tremor_brand', 'shockwave_brand', 'iron_forearm'] },
  hairline_brand:  { id: 'hairline_brand',  rarity: 'uncommon', label: 'Hairline Brand',  sym: 'HLN', color: '#ffaaaa', desc: 'Every die this die contacted this throw gains Cracked — half damage next settle.', synergies: ['crater_brand', 'shockwave_brand'] },

  // ── GAMBLER ─────────────────────────────────────────────────────────────────
  devils_luck_brand: { id: 'devils_luck_brand', rarity: 'uncommon', label: "Devil's Luck Brand", sym: 'DVL', color: '#f39c12', desc: 'Reroll this die. If higher, deal bonus damage equal to the difference.',  synergies: ['snake_eyes_brand', 'double_down_brand', 'lucky_coin'] },
  double_down_brand: { id: 'double_down_brand', rarity: 'rare',     label: 'Double Down Brand',  sym: 'DBL', color: '#e67e22', desc: 'On max face: double the effect. On min face: effect is cancelled.',       synergies: ['snake_eyes_brand', 'devils_luck_brand', 'lucky_coin'] },
  snake_eyes_brand:  { id: 'snake_eyes_brand',  rarity: 'uncommon', label: 'Snake Eyes Brand',   sym: 'SNK', color: '#d4ac0d', desc: 'Reroll this die 2 more times. Apply the best result as a bonus.',         synergies: ['devils_luck_brand', 'double_down_brand', 'lucky_coin'] },
  omen_brand:        { id: 'omen_brand',         rarity: 'uncommon', label: 'Omen Brand',         sym: 'OMN', color: '#f0c040', desc: 'The next die to settle this turn uses this die\'s rolled value instead.', synergies: ['snake_eyes_brand', 'double_down_brand'] },
  house_cut_brand:   { id: 'house_cut_brand',    rarity: 'uncommon', label: 'House Cut Brand',    sym: 'HSC', color: '#c0392b', desc: 'Deal damage equal to rolled value. Then lose that many HP.',              synergies: ['devils_luck_brand', 'snake_eyes_brand', 'devils_contract'] },

  // ── SHIV ────────────────────────────────────────────────────────────────────
  flurry_brand:    { id: 'flurry_brand',    rarity: 'uncommon', label: 'Flurry Brand',    sym: 'FLR', color: '#ff6622', desc: 'This die\'s effect fires a second time at half value (min 1).',   synergies: ['frenzy_brand', 'swarm_brand', 'counting_knife', 'speed_loader'] },
  needlepoint_brand:{ id: 'needlepoint_brand', rarity: 'common', label: 'Needlepoint Brand', sym: 'NPT', color: '#ff4444', desc: 'Deal damage up to 2, ignoring enemy block.',                  synergies: ['frenzy_brand', 'bleed_brand', 'paper_cut'] },
  frenzy_brand:    { id: 'frenzy_brand',    rarity: 'uncommon', label: 'Frenzy Brand',    sym: 'FRZ', color: '#ff8800', desc: 'Add a d4 ATK die to the tray for this turn only.',               synergies: ['flurry_brand', 'swarm_brand', 'counting_knife', 'speed_loader'] },
  bleed_brand:     { id: 'bleed_brand',     rarity: 'uncommon', label: 'Bleed Brand',     sym: 'BLD', color: '#cc2222', desc: 'Apply 1 poison stack per point of damage dealt by this die.',    synergies: ['needlepoint_brand', 'frenzy_brand', 'paper_cut', 'festering_brand'] },
  swarm_brand:     { id: 'swarm_brand',     rarity: 'rare',     label: 'Swarm Brand',     sym: 'SWM', color: '#ff2244', desc: 'Deal 1 extra damage per die that settled before this one.',      synergies: ['frenzy_brand', 'flurry_brand', 'speed_loader', 'counting_knife'] },

  // ── GENERIC ─────────────────────────────────────────────────────────────────
  echo_brand:      { id: 'echo_brand',      rarity: 'rare',     label: 'Echo Brand',      sym: 'ECH', color: '#f0c040', desc: 'This face\'s effect fires a second time at full value.',           synergies: ['surge_brand', 'sentinel_brand', 'festering_brand'] },
  surge_brand:     { id: 'surge_brand',     rarity: 'common',   label: 'Surge Brand',     sym: 'SRG', color: '#e8c97a', desc: 'Add +2 to this face\'s effect.',                                  synergies: ['echo_brand', 'fortress_brand'] },
  rebound_brand:   { id: 'rebound_brand',   rarity: 'uncommon', label: 'Rebound Brand',   sym: 'RBD', color: '#f39c12', desc: 'After effect resolves, this die relaunches toward the nearest bumper.', synergies: ['echo_brand'] },
  mirror_brand:    { id: 'mirror_brand',    rarity: 'uncommon', label: 'Mirror Brand',    sym: 'MIR', color: '#bdc3c7', desc: 'Copy the previous die\'s effect at half value.',                   synergies: ['echo_brand', 'surge_brand'] },
  anchor_brand:    { id: 'anchor_brand',    rarity: 'common',   label: 'Anchor Brand',    sym: 'ANC', color: '#95a5a6', desc: 'This die\'s value cannot be changed by other effects this turn.',  synergies: ['fortress_brand', 'steady_hand'] },
};

export const MATERIALS = {
  iron:    { id: 'iron',    rarity: 'common',   label: 'Iron',    sym: 'IRN', color: '#8899aa', desc: '+1 to all effect values.',                                    synergies: ['fire', 'surge_brand', 'echo_brand'] },
  fire:    { id: 'fire',    rarity: 'common',   label: 'Fire',    sym: 'FIR', color: '#ff6622', desc: '+3 to all damage values.',                                    synergies: ['iron', 'hex_brand', 'surge_brand'] },
  steel:   { id: 'steel',   rarity: 'uncommon', label: 'Steel',   sym: 'STL', color: '#bbccdd', desc: '×2 to all effect values.',                                   synergies: ['iron', 'echo_brand', 'sentinel_brand'] },
  glass:   { id: 'glass',   rarity: 'uncommon', label: 'Glass',   sym: 'GLS', color: '#aaddff', desc: 'Shatters on first die contact, destroying both.',             synergies: ['seeping_brand', 'contagion_brand'] },
  rock:    { id: 'rock',    rarity: 'uncommon', label: 'Rock',    sym: 'ROK', color: '#997755', desc: 'All damage ignores enemy block.',                              synergies: ['wither_brand', 'hex_brand'] },
  phantom: { id: 'phantom', rarity: 'uncommon', label: 'Phantom', sym: 'PHN', color: '#ccaaff', desc: 'Passes through dice. Only bumpers register collision.',        synergies: ['anchor_brand'] },
  uranium: { id: 'uranium', rarity: 'rare',     label: 'Uranium', sym: 'URA', color: '#88ff44', desc: 'Culls top half of faces and doubles rolled values.',           synergies: ['echo_brand', 'surge_brand'] },
  cursed:  { id: 'cursed',  rarity: 'uncommon', label: 'Cursed',  sym: 'CRS', color: '#ff44bb', desc: 'Hitting the enemy bumper applies Vulnerable.',                synergies: ['hex_brand', 'contagion_brand'] },
};

// Opposite face index pairs for the t-net layout
export const OPPOSITE_FACE = { 0: 5, 1: 3, 2: 4, 3: 1, 4: 2, 5: 0 };

export const RUNE_KEYS     = Object.keys(RUNES);
export const MATERIAL_KEYS = Object.keys(MATERIALS);
