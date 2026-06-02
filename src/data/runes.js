export const RUNES = {
  viking:  { id: 'viking',  rarity: 'uncommon', label: 'Viking',  sym: 'VIK', color: '#e8c97a', desc: 'This face triggers twice.',                                    synergies: ['steel', 'cursed_tome', 'war_paint', 'spiked_bumper', 'trojan'] },
  egyptian:{ id: 'egyptian',rarity: 'uncommon', label: 'Egyptian', sym: 'EGY', color: '#f0c040', desc: 'Triggers effect, then rerolls.',                               synergies: ['steady_hand', 'phantom', 'trojan'] },
  trojan:  { id: 'trojan',  rarity: 'rare',     label: 'Trojan',  sym: 'TRJ', color: '#cc8844', desc: 'Triggers this face + opposite face.',                          synergies: ['viking', 'egyptian'] },
  greek:   { id: 'greek',   rarity: 'uncommon', label: 'Greek',   sym: 'GRK', color: '#88aaff', desc: 'Blasts all other dice away.',                                  synergies: ['cosmic', 'glass'] },
  cosmic:  { id: 'cosmic',  rarity: 'uncommon', label: 'Cosmic',  sym: 'COS', color: '#cc88ff', desc: 'Pulls all other dice inward.',                                 synergies: ['greek', 'glass'] },
  venom:   { id: 'venom',   rarity: 'common',   label: 'Venom',   sym: 'VNM', color: '#58d68d', desc: 'Applies 3 poison stacks to the enemy.',                        synergies: ['poison', 'toxic', 'plague', 'mango', 'dead_branch'] },
  weaken:  { id: 'weaken',  rarity: 'common',   label: 'Weaken',  sym: 'WKN', color: '#9b59b6', desc: 'Weakens the enemy — they deal half damage this turn.',          synergies: ['expose', 'vulnerable_heart', 'cursed', 'thorned_armor'] },
  expose:  { id: 'expose',  rarity: 'uncommon', label: 'Expose',  sym: 'EXP', color: '#e67e22', desc: 'Exposes the enemy — they take 50% more damage this turn.',      synergies: ['weaken', 'vulnerable_heart', 'cursed', 'cursed_tome'] },
  toxic:   { id: 'toxic',   rarity: 'uncommon', label: 'Toxic',   sym: 'TOX', color: '#2ecc71', desc: 'Applies 5 poison stacks to the enemy.',                        synergies: ['poison', 'venom', 'plague', 'mango', 'dead_branch'] },
  plague:  { id: 'plague',  rarity: 'rare',     label: 'Plague',  sym: 'PLG', color: '#1a8a40', desc: 'Doubles the enemy\'s current poison stacks.',                  synergies: ['poison', 'venom', 'toxic', 'mango'] },
};

export const MATERIALS = {
  iron:    { id: 'iron',    rarity: 'common',   label: 'Iron',    sym: 'IRN', color: '#8899aa', desc: '+1 to all effect values.',                                      synergies: ['molten_egg', 'war_paint', 'fire', 'attack'] },
  steel:   { id: 'steel',   rarity: 'uncommon', label: 'Steel',   sym: 'STL', color: '#bbccdd', desc: '\xd72 to all effect values.',                                  synergies: ['viking', 'cursed_tome', 'war_paint', 'spiked_bumper', 'uranium'] },
  glass:   { id: 'glass',   rarity: 'uncommon', label: 'Glass',   sym: 'GLS', color: '#aaddff', desc: 'Shatters on first die contact, destroying both.',              synergies: ['greek', 'cosmic'] },
  uranium: { id: 'uranium', rarity: 'rare',     label: 'Uranium', sym: 'URA', color: '#88ff44', desc: 'Culls the top half of faces and doubles rolled values.',        synergies: ['steel', 'cursed_tome'] },
  fire:    { id: 'fire',    rarity: 'common',   label: 'Fire',    sym: 'FIR', color: '#ff6622', desc: '+3 to all damage values.',                                      synergies: ['molten_egg', 'war_paint', 'iron', 'attack'] },
  rock:    { id: 'rock',    rarity: 'uncommon', label: 'Rock',    sym: 'ROK', color: '#997755', desc: 'All damage ignores block.',                                     synergies: ['piercing_lance', 'cursed_tome', 'pierce'] },
  phantom: { id: 'phantom', rarity: 'uncommon', label: 'Phantom', sym: 'PHN', color: '#ccaaff', desc: 'Doubles the effect if the die lands without hitting anything.', synergies: ['steady_hand', 'egyptian'] },
  cursed:  { id: 'cursed',  rarity: 'uncommon', label: 'Cursed',  sym: 'CRS', color: '#ff44bb', desc: 'Hitting the enemy bumper applies Vulnerable.',                 synergies: ['expose', 'weaken', 'vulnerable_heart', 'spiked_bumper'] },
};

// Opposite face index pairs for the t-net layout (0=top 1=left 2=center 3=right 4=lower 5=bottom)
export const OPPOSITE_FACE = { 0: 5, 1: 3, 2: 4, 3: 1, 4: 2, 5: 0 };

export const RUNE_KEYS     = Object.keys(RUNES);
export const MATERIAL_KEYS = Object.keys(MATERIALS);
