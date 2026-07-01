// Persists lifetime player stats to localStorage. Independent of the resumable
// run save (SaveManager) — stats survive across runs, deaths, and Dice Duel matches.
const KEY = 'dicemore:stats:v1';

const DEFAULTS = {
  runsStarted: 0,
  battlesWon: 0,
  bossKills: 0,
  deaths: 0,
  diceDuelMatches: 0,
  diceThrown: 0,
  maxFaceLanded: 0,
  totalBlockGained: 0,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(stats) {
  try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch { /* storage unavailable */ }
}

const StatsManager = {
  get() { return read(); },

  recordRunStart() {
    const s = read();
    s.runsStarted++;
    write(s);
  },

  recordBattleWin({ isBoss = false } = {}) {
    const s = read();
    s.battlesWon++;
    if (isBoss) s.bossKills++;
    write(s);
  },

  recordRunEnd() {
    const s = read();
    s.deaths++;
    write(s);
  },

  recordDiceDuelMatchEnd() {
    const s = read();
    s.diceDuelMatches++;
    write(s);
  },

  recordDiceThrown(count = 1) {
    const s = read();
    s.diceThrown += count;
    write(s);
  },

  recordDieLanded(faceValue) {
    const s = read();
    s.maxFaceLanded = Math.max(s.maxFaceLanded, faceValue);
    write(s);
  },

  recordBlockGained(amount) {
    if (amount <= 0) return;
    const s = read();
    s.totalBlockGained += amount;
    write(s);
  },
};

export default StatsManager;
