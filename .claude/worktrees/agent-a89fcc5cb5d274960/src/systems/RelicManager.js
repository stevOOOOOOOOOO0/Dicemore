import { W } from '../constants.js';

export default class RelicManager {
  constructor(scene, bus) {
    this.scene  = scene;
    this.bus    = bus;
    this.active = [];
  }

  addRelic(relic) {
    this.active.push({ ...relic });
    if (relic.trigger && relic.trigger !== 'PASSIVE') {
      this.bus.on(relic.trigger, `relic_${relic.id}`, (payload) => this._resolve(relic, payload));
    }
  }

  // Called at turn start to apply always-on passive state (e.g. enemy-weakened flag).
  applyPassives() {
    if (this.isEnemyPassiveWeakened()) this.scene.enemyWeakened = true;
  }

  // ── Passive getters (queried inline during resolution chain) ─────────────────

  getAttackBonus()         { return this._sum('BONUS_ATTACK_FLAT'); }
  getBlockBonus()          { return this._sum('BONUS_BLOCK_FLAT'); }
  getAttackMultiplier()    { return this._product('ATTACK_MULTIPLIER'); }
  getBlockMultiplier()     { return this._product('BLOCK_MULTIPLIER'); }
  isPierceAll()            { return this._has('PIERCE_ALL'); }
  isEnemyPassiveWeakened() { return this._has('ENEMY_WEAKENED'); }
  getCleanLandBonus()      { return this._sum('CLEAN_LAND_BONUS'); }
  hasSiphon()              { return this._has('SIPHON_HP'); }

  onSiphonDamage(damage) {
    if (!this.hasSiphon() || damage <= 0) return;
    const s = this.scene;
    s.playerHp = Math.min(s.playerMaxHp, s.playerHp + damage);
    s._refreshStatusUI();
    s._floatText(W / 2, 575, `+${damage}`, '#cc2244');
  }

  // ── Effect resolver ──────────────────────────────────────────────────────────

  _resolve(relic, payload) {
    const s = this.scene;
    switch (relic.effect) {

      case 'HEAL_ON_KILL':
      case 'START_TURN_HEAL': {
        if (s.playerHp >= s.playerMaxHp) return;
        const amt = Math.min(relic.value, s.playerMaxHp - s.playerHp);
        s.playerHp += amt;
        s._refreshStatusUI();
        s._flashHeal(amt);
        break;
      }

      case 'START_TURN_BLOCK': {
        s.block += relic.value;
        s._refreshStatusUI();
        s._floatText(W / 2, 575, `+${relic.value} BLK`, '#3498db');
        break;
      }

      case 'HEAL_ON_SETTLE': {
        if (!payload.die?.isPlayer) return;
        if (s.playerHp >= s.playerMaxHp) return;
        const amt = Math.min(relic.value, s.playerMaxHp - s.playerHp);
        s.playerHp += amt;
        s._refreshStatusUI();
        s._flashHeal(amt);
        break;
      }

      case 'POISON_ON_HIT': {
        s.enemyPoisonStacks += relic.value;
        s._refreshEnemyCharacter();
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `☠ +${relic.value}`, '#58d68d');
        break;
      }

      case 'LIFE_STEAL': {
        const dmg  = payload.amount ?? 0;
        if (dmg <= 0 || s.playerHp >= s.playerMaxHp) return;
        const heal = Math.max(1, Math.floor(dmg * relic.value));
        const amt  = Math.min(heal, s.playerMaxHp - s.playerHp);
        s.playerHp += amt;
        s._refreshStatusUI();
        s._flashHeal(amt);
        break;
      }

      case 'HEAL_ON_BLOCK': {
        if (s.playerHp >= s.playerMaxHp) return;
        const amt = Math.min(relic.value, s.playerMaxHp - s.playerHp);
        s.playerHp += amt;
        s._refreshStatusUI();
        s._flashHeal(amt);
        break;
      }

      case 'THORNS': {
        const dmg = relic.value;
        s.enemyHp = Math.max(0, s.enemyHp - dmg);
        s._addToPot(dmg);
        s._refreshEnemyCharacter();
        s._flashEnemyDamage(dmg);
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `THORNS ${dmg}`, '#aaaaaa');
        s._siphonHeal(dmg);
        if (s.enemyHp <= 0) s._triggerVictory();
        break;
      }

      case 'MAX_FACE_DAMAGE': {
        if (payload.die?.isPlayer) s._applyMaxFaceDamage(payload.die);
        break;
      }

      case 'MAX_HP_UP': {
        s.playerMaxHp += relic.value;
        const heal = Math.min(relic.value, s.playerMaxHp - s.playerHp);
        if (heal > 0) { s.playerHp += heal; s._refreshStatusUI(); }
        break;
      }

      case 'PICKPOCKET_THUMB': {
        if ((payload.die?.data?.type) !== 'poison') return;
        s.enemyPoisonStacks += relic.value;
        s._refreshEnemyCharacter();
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `☠ +${relic.value} THUMB`, '#58d68d');
        break;
      }

      case 'VENOM_CLOCK': {
        if (s.enemyPoisonStacks < 3) return;
        const dmg = relic.value;
        s.enemyHp = Math.max(0, s.enemyHp - dmg);
        s._addToPot(dmg);
        s._refreshEnemyCharacter();
        s._flashEnemyDamage(dmg);
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `VCLK -${dmg}`, '#2ecc71');
        if (s.enemyHp <= 0) s._triggerVictory();
        break;
      }

      case 'PLAGUE_DOCTOR': {
        s.enemyPoisonStacks += relic.value;
        s._refreshEnemyCharacter();
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `☠ +${relic.value} DOC`, '#1a8a40');
        break;
      }

      case 'TORMENTOR_RING': {
        if (payload.target !== 'enemy') return;
        const dmg = relic.value;
        s.enemyHp = Math.max(0, s.enemyHp - dmg);
        s._addToPot(dmg);
        s._refreshEnemyCharacter();
        s._flashEnemyDamage(dmg);
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `RING ${dmg}`, '#9b59b6');
        if (s.enemyHp <= 0) s._triggerVictory();
        break;
      }

      case 'AMPLIFIER_STONE': {
        if (s._countEnemyStatuses() >= 2) {
          s.statusDamageBonus = true;
          s._floatText(s.enemyPos.x, s.enemyPos.y - 50, 'AMP +25%', '#cc88ff');
        }
        break;
      }

      case 'LODESTONE_HEART': {
        const dA = payload.dieA, dB = payload.dieB;
        if (!dA?.isPlayer || !dB?.isPlayer) return;
        dA._valueBonus = (dA._valueBonus ?? 0) + relic.value;
        dB._valueBonus = (dB._valueBonus ?? 0) + relic.value;
        break;
      }

      case 'DEAD_MANS_FUSE': {
        if (!payload.die?.isPlayer) return;
        const dmg = relic.value;
        s.enemyHp = Math.max(0, s.enemyHp - dmg);
        s._addToPot(dmg);
        s._refreshEnemyCharacter();
        s._flashEnemyDamage(dmg);
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `FUSE ${dmg}`, '#cc4400');
        s.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die: payload.die });
        s._siphonHeal(dmg);
        if (s.enemyHp <= 0) s._triggerVictory();
        break;
      }

      case 'OVERKILL_CHARM': {
        if (!payload.die?.isPlayer) return;
        if (s.playerHp >= s.playerMaxHp) return;
        const amt = Math.min(relic.value, s.playerMaxHp - s.playerHp);
        s.playerHp += amt;
        s._refreshStatusUI();
        s._flashHeal(amt);
        break;
      }

      case 'SHRAPNEL_VEST': {
        if (!payload.die?.isPlayer) return;
        s._addTempDieToTray('attack', 4);
        s._floatText(W / 2, 575, '+d4 VEST', '#bb8866');
        break;
      }

      case 'CANNONBALL': {
        if (s._cannonballUsed) return;
        if (!payload.dieA?.isPlayer && !payload.dieB?.isPlayer) return;
        s._cannonballUsed = true;
        const dmg = relic.value;
        s.enemyHp = Math.max(0, s.enemyHp - dmg);
        s._addToPot(dmg);
        s._refreshEnemyCharacter();
        s._flashEnemyDamage(dmg);
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `CANNON ${dmg}`, '#ff8800');
        s.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die: payload.dieA ?? payload.dieB });
        s._siphonHeal(dmg);
        if (s.enemyHp <= 0) s._triggerVictory();
        break;
      }

      case 'IRON_FOREARM': {
        if (!payload.die?.isPlayer) return;
        s._nextThrowSpeedBonus = (s._nextThrowSpeedBonus ?? 0) + relic.value;
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `ARM +${relic.value} SPD`, '#aabbcc');
        break;
      }

      case 'LUCKY_COIN': {
        if (!payload.die?.isPlayer || s._luckyCoinUsed) return;
        const active = s._getActiveFaceIndices(payload.die.data);
        if (!active.length) return;
        const maxVal = Math.floor(Math.max(...active) / 2) + 1;
        const curVal = Math.floor((payload.die.data.currentFaceIdx ?? 0) / 2) + 1;
        if (curVal < maxVal) return;
        s._luckyCoinUsed = true;
        s._addToEffectQueue(payload.die);
        if (!s._queueActive) s._startQueue();
        s._floatText(s.enemyPos.x, s.enemyPos.y - 70, 'LUCKY COIN ×2!', '#f0c040');
        break;
      }

      case 'DEVILS_CONTRACT': {
        const cost = 2;
        s.playerHp = Math.max(0, s.playerHp - cost);
        s._refreshStatusUI();
        s._flashDamage(cost);
        s.turnAttackBonus += relic.value;
        s._floatText(W / 2, 575, `CONTRACT -${cost} HP / +${relic.value} ATK`, '#c0392b');
        s.bus.emit('ON_DAMAGE_TAKEN', { amount: cost });
        if (s.playerHp <= 0) s.time.delayedCall(800, () => s._gameOver());
        break;
      }

      case 'SPEED_LOADER': {
        s._addTempDieToTray('attack', 4);
        s._floatText(W / 2, 575, '+d4 ATK', '#ff6622');
        break;
      }

      case 'COUNTING_KNIFE': {
        const n = payload.die?._settleOrder ?? 0;
        if (n <= 0 || !payload.die?.isPlayer) return;
        const dmg = s._hitEnemyBlock(n);
        if (dmg > 0) {
          s.enemyHp = Math.max(0, s.enemyHp - dmg);
          s._addToPot(dmg);
          s._refreshEnemyCharacter();
          s._flashEnemyDamage(dmg);
          s.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die: payload.die });
          s._siphonHeal(dmg);
          if (s.enemyHp <= 0) s._triggerVictory();
        }
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `KNIFE ×${n} = ${dmg}`, '#e74c3c');
        break;
      }

      case 'PAPER_CUT': {
        s.enemyPoisonStacks += relic.value;
        s._refreshEnemyCharacter();
        s._floatText(s.enemyPos.x, s.enemyPos.y - 50, `☠ +${relic.value} CUT`, '#cc2222');
        break;
      }

      case 'RUNE_RESONANCE': {
        if (s.playerHp >= s.playerMaxHp) return;
        const amt = Math.min(relic.value, s.playerMaxHp - s.playerHp);
        s.playerHp += amt;
        s._refreshStatusUI();
        s._flashHeal(amt);
        break;
      }

      case 'DESTROY_ECHO': {
        if (!payload.die?.isPlayer) return;
        s._applyMaxFaceDamage(payload.die);
        break;
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

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
