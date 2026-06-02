import { W, PLAYER_MAX_HP } from '../constants.js';

export default class RelicManager {
  constructor(scene) {
    this.scene  = scene;
    this.active = [];
  }

  addRelic(relic) {
    this.active.push({ ...relic });
  }

  // ── Passive getters (called inside damage / block calculations) ─────────────

  getAttackBonus()   { return this._sum('BONUS_ATTACK_FLAT'); }
  getBlockBonus()    { return this._sum('BONUS_BLOCK_FLAT'); }

  getAttackMultiplier() { return this._product('ATTACK_MULTIPLIER'); }
  getBlockMultiplier()  { return this._product('BLOCK_MULTIPLIER'); }

  isPierceAll()          { return this._has('PIERCE_ALL'); }
  isEnemyPassiveWeakened() { return this._has('ENEMY_WEAKENED'); }
  getCleanLandBonus()    { return this._sum('CLEAN_LAND_BONUS'); }
  hasSiphon()            { return this._has('SIPHON_HP'); }

  onSiphonDamage(damage) {
    if (!this.hasSiphon() || damage <= 0) return;
    const s = this.scene;
    s.playerHp += damage;
    s._refreshStatusUI();
    s._floatText(W / 2, 575, `+${damage}`, '#cc2244');
  }

  // ── Triggers (called by BattleScene at key moments) ─────────────────────────

  onStartTurn() {
    const s = this.scene;

    // Restore enemy-weakened passive each turn (resets to false in _startTurn)
    if (this.isEnemyPassiveWeakened()) s.enemyWeakened = true;

    this._each('START_TURN', 'START_TURN_BLOCK', r => {
      s.block += r.value;
      s._refreshStatusUI();
      s._floatText(W / 2, 575, `+${r.value} BLK`, '#3498db');
    });

    this._each('START_TURN', 'START_TURN_HEAL', r => {
      if (s.playerHp >= s.playerMaxHp) return;
      const amt = Math.min(r.value, s.playerMaxHp - s.playerHp);
      s.playerHp += amt;
      s._refreshStatusUI();
      s._flashHeal(amt);
    });
  }

  onSettle(dieRef) {
    if (!dieRef.isPlayer) return;
    const s = this.scene;

    this._each('ON_SETTLE', 'HEAL_ON_SETTLE', r => {
      if (s.playerHp >= s.playerMaxHp) return;
      const amt = Math.min(r.value, s.playerMaxHp - s.playerHp);
      s.playerHp += amt;
      s._refreshStatusUI();
      s._flashHeal(amt);
    });
  }

  onAttackHit(damage) {
    const s = this.scene;

    this._each('ON_ATTACK_HIT', 'POISON_ON_HIT', r => {
      s.enemyPoisonStacks += r.value;
      s._refreshEnemyCharacter();
      s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `☠ +${r.value}`, '#58d68d');
    });

    this._each('ON_ATTACK_HIT', 'LIFE_STEAL', r => {
      if (s.playerHp >= s.playerMaxHp) return;
      const heal = Math.max(1, Math.floor(damage * r.value));
      const amt  = Math.min(heal, s.playerMaxHp - s.playerHp);
      s.playerHp += amt;
      s._refreshStatusUI();
      s._flashHeal(amt);
    });
  }

  onBlock(amount) {
    const s = this.scene;

    this._each('ON_BLOCK', 'HEAL_ON_BLOCK', r => {
      if (s.playerHp >= s.playerMaxHp) return;
      const amt = Math.min(r.value, s.playerMaxHp - s.playerHp);
      s.playerHp += amt;
      s._refreshStatusUI();
      s._flashHeal(amt);
    });
  }

  onDamageTaken(damage) {
    if (damage <= 0) return;
    const s = this.scene;

    this._each('ON_DAMAGE_TAKEN', 'THORNS', r => {
      const dmg = r.value;
      s.enemyHp = Math.max(0, s.enemyHp - dmg);
      s._addToPot(dmg);
      s._refreshEnemyCharacter();
      s._flashEnemyDamage(dmg);
      s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `THORNS ${dmg}`, '#aaaaaa');
      s._siphonHeal(dmg);
      if (s.enemyHp <= 0) s._triggerVictory();
    });
  }

  onHitBumper(dieRef) {
    if (!dieRef.isPlayer) return;
    const s = this.scene;
    this._each('ON_HIT_BUMPER', 'MAX_FACE_DAMAGE', () => {
      s._applyMaxFaceDamage(dieRef);
    });
  }

  onKill() {
    const s = this.scene;

    this._each('ON_KILL', 'HEAL_ON_KILL', r => {
      if (s.playerHp >= s.playerMaxHp) return;
      const amt = Math.min(r.value, s.playerMaxHp - s.playerHp);
      s.playerHp += amt;
      s._refreshStatusUI();
      s._flashHeal(amt);
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  _each(trigger, effect, fn) {
    this.active.filter(r => r.trigger === trigger && r.effect === effect).forEach(fn);
  }

  _sum(effect) {
    return this.active
      .filter(r => r.trigger === 'PASSIVE' && r.effect === effect)
      .reduce((s, r) => s + r.value, 0);
  }

  _product(effect) {
    return this.active
      .filter(r => r.trigger === 'PASSIVE' && r.effect === effect)
      .reduce((p, r) => p * r.value, 1);
  }

  _has(effect) {
    return this.active.some(r => r.trigger === 'PASSIVE' && r.effect === effect);
  }
}
