export const RUNES = {
  viking:  { id: 'viking',  label: 'Viking',  sym: 'VIK', color: '#e8c97a', desc: 'This face triggers twice.' },
  egyptian:{ id: 'egyptian',label: 'Egyptian', sym: 'EGY', color: '#f0c040', desc: 'Triggers effect, then rerolls.' },
  trojan:  { id: 'trojan',  label: 'Trojan',  sym: 'TRJ', color: '#cc8844', desc: 'Triggers this face + opposite face.' },
  greek:   { id: 'greek',   label: 'Greek',   sym: 'GRK', color: '#88aaff', desc: 'Blasts all other dice away.' },
  cosmic:  { id: 'cosmic',  label: 'Cosmic',  sym: 'COS', color: '#cc88ff', desc: 'Pulls all other dice inward.' },
};

export const MATERIALS = {
  iron:    { id: 'iron',    label: 'Iron',    sym: 'IRN', color: '#8899aa', desc: '+1 to all effect values.' },
  steel:   { id: 'steel',   label: 'Steel',   sym: 'STL', color: '#bbccdd', desc: '\xd72 to all effect values.' },
  glass:   { id: 'glass',   label: 'Glass',   sym: 'GLS', color: '#aaddff', desc: 'Shatters on first die contact, destroying both.' },
  uranium: { id: 'uranium', label: 'Uranium', sym: 'URA', color: '#88ff44', desc: 'Contacted dice have their values halved.' },
  fire:    { id: 'fire',    label: 'Fire',    sym: 'FIR', color: '#ff6622', desc: '+3 to all damage values.' },
  rock:    { id: 'rock',    label: 'Rock',    sym: 'ROK', color: '#997755', desc: 'All damage ignores block.' },
};

// Opposite face index pairs for the t-net layout (0=top 1=left 2=center 3=right 4=lower 5=bottom)
export const OPPOSITE_FACE = { 0: 5, 1: 3, 2: 4, 3: 1, 4: 2, 5: 0 };

export const RUNE_KEYS     = Object.keys(RUNES);
export const MATERIAL_KEYS = Object.keys(MATERIALS);
