// Persists the resumable solo-run state to localStorage so a session survives a reload.
// Shape mirrors BattleScene's init(data) fields exactly — see BattleScene.init().
const KEY = 'dicemore:save:v1';

const SaveManager = {
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  },
  exists() {
    try { return localStorage.getItem(KEY) !== null; } catch { return false; }
  },
};

export default SaveManager;
