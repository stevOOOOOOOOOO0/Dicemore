import Phaser from 'phaser';

// Each handler receives: { scene, die, value, faceIdx, playerX, playerY, context? }
// context === 'bumper' when fired from _applyMaxFaceDamage (spiked bumper hit)
export const RUNE_HANDLERS = {

  // ── POISON ──────────────────────────────────────────────────────────────────

  seeping_brand: ({ scene, die, value }) => {
    scene.enemyPoisonStacks += value;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `SEP ☠+${value}`, '#58d68d');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'poison', amount: value });
  },

  festering_brand: ({ scene, die }) => {
    if (scene.enemyPoisonStacks <= 0) {
      scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'FST: no stacks', '#2ecc71');
      return;
    }
    const added = scene.enemyPoisonStacks;
    scene.enemyPoisonStacks *= 2;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `FST ☠×2 (+${added})`, '#2ecc71');
  },

  miasma_brand: ({ scene, die }) => {
    scene.enemyWeakened = true;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'MIA FRAIL', '#27ae60');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'frail', amount: 1 });
  },

  slow_drip_brand: ({ scene, die }) => {
    scene._suppressPoisonDecay = true;
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'DRP no decay', '#1a8a40');
  },

  virulent_brand: ({ scene, die }) => {
    const stacks = scene.turnCount ?? 0;
    if (stacks <= 0) {
      scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'VRL: 0', '#0e5c2b');
      return;
    }
    scene.enemyPoisonStacks += stacks;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `VRL ☠+${stacks}`, '#0e5c2b');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'poison', amount: stacks });
  },

  // ── STATUS ──────────────────────────────────────────────────────────────────

  hex_brand: ({ scene, die }) => {
    scene.enemyVulnerable = true;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'HEX exposed', '#9b59b6');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'vulnerable', amount: 1 });
  },

  weaken_brand: ({ scene, die }) => {
    scene.enemyWeakened = true;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'WKN frailed', '#8e44ad');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'frail', amount: 1 });
  },

  amplify_brand: ({ scene, die }) => {
    let extended = 0;
    if (scene.enemyPoisonStacks > 0) { scene.enemyPoisonStacks += 1; extended++; }
    if (scene.enemyWeakened)          extended++;
    if (scene.enemyVulnerable)        extended++;
    scene._refreshEnemyCharacter();
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `AMP ×${extended}`, '#cc88ff');
  },

  wither_brand: ({ scene, die, value }) => {
    const before  = scene.enemyBlock;
    scene.enemyBlock = Math.max(0, scene.enemyBlock - value);
    const reduced = before - scene.enemyBlock;
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `WTH -${reduced} BLK`, '#7d3c98');
    scene._refreshEnemyCharacter();
  },

  contagion_brand: ({ scene, die }) => {
    const count = scene._countEnemyStatuses();
    if (count <= 0) {
      scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, 'CON: 0', '#5b2c6f');
      return;
    }
    const dmg = scene._hitEnemyBlock(count);
    if (dmg > 0) {
      scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
      scene._addToPot(dmg);
      scene._refreshEnemyCharacter();
      scene._flashEnemyDamage(dmg);
      scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
      scene._siphonHeal(dmg);
    }
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `CON ${dmg}`, '#5b2c6f');
    if (scene.enemyHp <= 0) scene._triggerVictory();
  },

  // ── HOARDER ─────────────────────────────────────────────────────────────────

  fortress_brand: ({ scene, die, value }) => {
    scene.block += value;
    scene._refreshStatusUI();
    scene._flashDieImpact(die, `+${value} FRT`, '#3498db');
    scene.bus.emit('ON_BLOCK_GAINED', { amount: value });
  },

  absorb_brand: ({ scene, die }) => {
    const convert = Math.floor(scene.block / 2);
    if (convert <= 0) {
      scene._floatText(die.img.x, die.img.y - 32, 'ABS: no block', '#2980b9');
      return;
    }
    scene.block -= convert;
    const healed = Math.min(convert, scene.playerMaxHp - scene.playerHp);
    if (healed > 0) {
      scene.playerHp += healed;
      scene._flashHeal(healed);
    }
    scene._refreshStatusUI();
    scene._floatText(die.img.x, die.img.y - 32, `ABS +${healed} HP`, '#2980b9');
  },

  sentinel_brand: ({ scene, die }) => {
    if (scene.block > 5) {
      scene._floatText(die.img.x, die.img.y - 44, 'SNT ×2', '#1abc9c');
      scene.time.delayedCall(120, () => scene._applyDieFaceImmediate(die, true));
    } else {
      scene._floatText(die.img.x, die.img.y - 44, `SNT: ${scene.block}/5`, '#16a085');
    }
  },

  bulwark_brand: ({ scene, die }) => {
    scene.enemyWeakened = true;
    scene.block += 2;
    scene._refreshEnemyCharacter();
    scene._refreshStatusUI();
    scene._floatText(die.img.x, die.img.y - 32, 'BLW frail +2', '#16a085');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'frail', amount: 1 });
    scene.bus.emit('ON_BLOCK_GAINED', { amount: 2 });
  },

  patience_brand: ({ scene, die }) => {
    const amount = Math.min(6, scene.turnCount ?? 0);
    if (amount <= 0) {
      scene._floatText(die.img.x, die.img.y - 32, 'PAT: 0', '#148f77');
      return;
    }
    scene.block += amount;
    scene._refreshStatusUI();
    scene._flashDieImpact(die, `+${amount} PAT`, '#148f77');
    scene.bus.emit('ON_BLOCK_GAINED', { amount });
  },

  // ── MANIPULATOR ─────────────────────────────────────────────────────────────

  lodestone_brand: ({ scene, die }) => {
    const ox = die.img.x, oy = die.img.y;
    let pulled = 0;
    scene.allDice.forEach(d => {
      if (d === die || !d.img?.active || !d.img.body) return;
      const dx = d.img.x - ox, dy = d.img.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, {
        x: -(dx / len) * 7,
        y: -(dy / len) * 7,
      });
      scene._rerollDie(d);
      pulled++;
    });
    scene._floatText(die.img.x, die.img.y - 44, `LDS ×${pulled}`, '#4488ff');
  },

  repulsor_brand: ({ scene, die }) => {
    const MAX_RANGE = 200, MAX_SPEED = 16;
    const ox = die.img.x, oy = die.img.y;
    let pushed = 0;
    scene.allDice.forEach(d => {
      if (d === die || !d.img?.active || !d.img.body) return;
      const dx = d.img.x - ox, dy = d.img.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      const spd = Math.max(0, MAX_SPEED * (1 - len / MAX_RANGE));
      if (spd <= 0) return;
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, {
        x: (dx / len) * spd,
        y: (dy / len) * spd,
      });
      scene._rerollDie(d);
      pushed++;
    });
    scene._floatText(die.img.x, die.img.y - 44, `RPL ×${pushed}`, '#88aaff');
  },

  puppeteer_brand: ({ scene, die, playerX, playerY }) => {
    const candidates = scene.allDice.filter(d => d !== die && d.img?.active && d.img.body);
    if (candidates.length === 0) {
      scene._floatText(die.img.x, die.img.y - 44, 'PPT: none', '#cc88ff');
      return;
    }
    const obstacles = candidates.filter(d => d.data.isObstacle);
    const target    = obstacles.length > 0
      ? obstacles[Phaser.Math.Between(0, obstacles.length - 1)]
      : candidates[Phaser.Math.Between(0, candidates.length - 1)];
    Phaser.Physics.Matter.Matter.Body.setPosition(target.img.body, { x: playerX, y: playerY });
    target.img.setPosition(playerX, playerY);
    if (target.lbl)    target.lbl.setPosition(playerX, playerY);
    if (target.valLbl) target.valLbl.setPosition(playerX, playerY);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    Phaser.Physics.Matter.Matter.Body.setVelocity(target.img.body, {
      x: Math.cos(angle) * 8, y: Math.sin(angle) * 8,
    });
    scene._rerollDie(target);
    scene._floatText(playerX, playerY - 32, 'PPT!', '#cc88ff');
  },

  gravity_well_brand: ({ scene, die }) => {
    if (!die.img?.active || !die.img.body) return;
    die._gravityWell = true;
    Phaser.Physics.Matter.Matter.Body.setStatic(die.img.body, true);
    scene._floatText(die.img.x, die.img.y - 44, 'GWL pinned', '#3399ff');
    scene.time.delayedCall(3000, () => {
      if (!die.img?.active || !die.img.body) return;
      Phaser.Physics.Matter.Matter.Body.setStatic(die.img.body, false);
      die._gravityWell = false;
    });
  },

  conductor_brand: ({ scene, die }) => {
    let boosted = 0;
    scene.allDice.forEach(d => {
      if (d !== die && d._wasRerolled) {
        d._valueBonus = (d._valueBonus ?? 0) + 1;
        boosted++;
      }
    });
    scene._floatText(die.img.x, die.img.y - 44, `CDT +1 ×${boosted}`, '#88ddff');
  },

  // ── DESTRUCTION ─────────────────────────────────────────────────────────────

  martyrdom_brand: ({ scene, die }) => {
    scene.playerDice.forEach(d => {
      if (d !== die) d._valueBonus = (d._valueBonus ?? 0) + 2;
    });
    scene._floatText(die.img.x, die.img.y - 44, 'MRT +2 all', '#cc4400');
    scene._shatterDie(die);
  },

  splinter_brand: ({ scene, die }) => {
    scene._floatText(die.img.x, die.img.y - 44, 'SPL ×2 d4', '#ff6600');
    scene._shatterDie(die);
    scene._addTempDieToTray('attack', 4);
    scene._addTempDieToTray('attack', 4);
  },

  chain_reaction_brand: ({ scene, die, value }) => {
    const dmg = scene._hitEnemyBlock(value);
    if (dmg > 0) {
      scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
      scene._addToPot(dmg);
      scene._refreshEnemyCharacter();
      scene._flashEnemyDamage(dmg);
      scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
      scene._siphonHeal(dmg);
      if (scene.enemyHp <= 0) scene._triggerVictory();
    }
    scene._floatText(scene.enemyPos.x, scene.enemyPos.y - 50, `CRC ${dmg}`, '#ff4400');
  },

  ashen_brand: ({ scene, die }) => {
    scene._ashenActive = true;
    scene._floatText(die.img.x, die.img.y - 44, 'ASH ×2 next', '#bb8866');
    scene._shatterDie(die);
  },

  rubble_brand: ({ scene, die }) => {
    const obstacle = scene.allDice.find(d => !d.isPlayer && d.data.isObstacle);
    if (!obstacle) {
      scene._floatText(die.img.x, die.img.y - 44, 'RBL: no target', '#997755');
      return;
    }
    const sides = obstacle.data.sides ?? 6;
    const blk   = Math.floor(sides / 2);
    scene._shatterDie(obstacle);
    scene.block += blk;
    scene._refreshStatusUI();
    scene._flashDieImpact(die, `+${blk} RBL`, '#997755');
    scene.bus.emit('ON_BLOCK_GAINED', { amount: blk });
  },

  // ── IMPACT ──────────────────────────────────────────────────────────────────

  shockwave_brand: ({ scene, die, value }) => {
    const RADIUS = 80;
    const speed  = value * 3;
    const ox = die.img.x, oy = die.img.y;
    let pushed = 0;
    scene.allDice.forEach(d => {
      if (d === die || !d.img?.active || !d.img.body) return;
      const dx = d.img.x - ox, dy = d.img.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      if (len > RADIUS) return;
      Phaser.Physics.Matter.Matter.Body.setVelocity(d.img.body, { x: (dx/len)*speed, y: (dy/len)*speed });
      scene._rerollDie(d);
      pushed++;
    });
    scene._floatText(die.img.x, die.img.y - 44, `SHK ×${pushed}`, '#e74c3c');
  },

  tremor_brand: ({ scene, die }) => {
    const contacts = die._bumperContactCount ?? 0;
    if (contacts <= 0) {
      scene._floatText(die.img.x, die.img.y - 44, 'TRM: 0', '#ff4444');
      return;
    }
    const dmg = scene._hitEnemyBlock(contacts);
    if (dmg > 0) {
      scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
      scene._addToPot(dmg);
      scene._refreshEnemyCharacter();
      scene._flashEnemyDamage(dmg);
      scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
      scene._siphonHeal(dmg);
      if (scene.enemyHp <= 0) scene._triggerVictory();
    }
    scene._floatText(die.img.x, die.img.y - 44, `TRM ×${contacts} = ${dmg}`, '#ff4444');
  },

  crater_brand: ({ scene, die }) => {
    const target = die._firstContactedDie;
    if (!target || !scene.allDice.includes(target)) {
      scene._floatText(die.img.x, die.img.y - 44, 'CRT: miss', '#ff8800');
      return;
    }
    scene._floatText(die.img.x, die.img.y - 44, 'CRATER!', '#ff8800');
    scene._shatterDie(target);
  },

  ricochet_brand: ({ scene, die }) => {
    const bx = die._lastBumperX ?? scene.enemyPos.x;
    const by = die._lastBumperY ?? scene.enemyPos.y;
    scene.time.delayedCall(150, () => {
      if (!die.img?.active || !die.img.body) return;
      const dx = bx - die.img.x, dy = by - die.img.y;
      const len = Math.hypot(dx, dy) || 1;
      Phaser.Physics.Matter.Matter.Body.setVelocity(die.img.body, { x: (dx/len)*4, y: (dy/len)*4 });
      scene._rerollDie(die);
      scene._floatText(die.img.x, die.img.y - 32, 'RCT ↩', '#ff6644');
    });
  },

  hairline_brand: ({ scene, die }) => {
    const contacts = die._contactedDice;
    if (!contacts || contacts.size === 0) {
      scene._floatText(die.img.x, die.img.y - 44, 'HLN: miss', '#ffaaaa');
      return;
    }
    let cracked = 0;
    for (const target of contacts) {
      if (scene.allDice.includes(target)) { target._cracked = true; cracked++; }
    }
    scene._floatText(die.img.x, die.img.y - 44, `HLN CRACK ×${cracked}`, '#ffaaaa');
  },

  // ── GAMBLER ─────────────────────────────────────────────────────────────────

  devils_luck_brand: ({ scene, die, value }) => {
    const active  = scene._getActiveFaceIndices(die.data);
    const newIdx  = active[Phaser.Math.Between(0, active.length - 1)];
    const newVal  = Math.floor(newIdx / 2) + 1;
    const diff    = newVal - value;
    if (diff > 0) {
      const dmg = scene._hitEnemyBlock(diff);
      if (dmg > 0) {
        scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
        scene._addToPot(dmg);
        scene._refreshEnemyCharacter();
        scene._flashEnemyDamage(dmg);
        scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
        scene._siphonHeal(dmg);
        if (scene.enemyHp <= 0) scene._triggerVictory();
      }
      scene._floatText(die.img.x, die.img.y - 44, `DVL +${diff}`, '#f39c12');
    } else {
      scene._floatText(die.img.x, die.img.y - 44, `DVL →${newVal}`, '#7f6000');
    }
  },

  double_down_brand: ({ scene, die, value }) => {
    const active = scene._getActiveFaceIndices(die.data);
    const maxVal = Math.floor(Math.max(...active) / 2) + 1;
    const minVal = Math.floor(Math.min(...active) / 2) + 1;
    if (value >= maxVal) {
      scene._floatText(die.img.x, die.img.y - 44, 'DBL ×2!', '#e67e22');
      scene.time.delayedCall(120, () => scene._applyDieFaceImmediate(die, true));
    } else if (value <= minVal) {
      scene._floatText(die.img.x, die.img.y - 44, 'DBL BUST', '#7f3010');
    } else {
      scene._floatText(die.img.x, die.img.y - 44, `DBL ${value}/${maxVal}`, '#7f6000');
    }
  },

  snake_eyes_brand: ({ scene, die, value }) => {
    const active  = scene._getActiveFaceIndices(die.data);
    const roll = () => Math.floor(active[Phaser.Math.Between(0, active.length - 1)] / 2) + 1;
    const best    = Math.max(value, roll(), roll());
    const bonus   = best - value;
    if (bonus > 0) {
      const type = die._mimicType ?? die.data.type;
      if (type === 'attack' || type === 'bomb' || type === 'leech') {
        const dmg = scene._hitEnemyBlock(bonus);
        if (dmg > 0) {
          scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
          scene._addToPot(dmg);
          scene._refreshEnemyCharacter();
          scene._flashEnemyDamage(dmg);
          scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
          scene._siphonHeal(dmg);
          if (scene.enemyHp <= 0) scene._triggerVictory();
        }
      } else if (type === 'block') {
        scene.block += bonus;
        scene._refreshStatusUI();
        scene.bus.emit('ON_BLOCK_GAINED', { amount: bonus });
      } else if (type === 'pierce') {
        scene.cleanBonus += bonus;
        scene._refreshPlayerPills();
      } else if (type === 'poison') {
        scene.enemyPoisonStacks += bonus;
        scene._refreshEnemyCharacter();
      }
      scene._floatText(die.img.x, die.img.y - 44, `SNK ${value}→${best}`, '#d4ac0d');
    } else {
      scene._floatText(die.img.x, die.img.y - 44, `SNK ${value} best`, '#d4ac0d');
    }
  },

  omen_brand: ({ scene, die, value }) => {
    scene._omenValue = value;
    scene._floatText(die.img.x, die.img.y - 44, `OMN →${value}`, '#f0c040');
  },

  house_cut_brand: ({ scene, die, value }) => {
    const dmg = scene._hitEnemyBlock(value);
    if (dmg > 0) {
      scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
      scene._addToPot(dmg);
      scene._refreshEnemyCharacter();
      scene._flashEnemyDamage(dmg);
      scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
      scene._siphonHeal(dmg);
      if (scene.enemyHp <= 0) scene._triggerVictory();
    }
    scene.playerHp = Math.max(0, scene.playerHp - value);
    scene._refreshStatusUI();
    scene._flashDamage(value);
    scene.bus.emit('ON_DAMAGE_TAKEN', { amount: value });
    scene._floatText(die.img.x, die.img.y - 44, `HSC ${dmg}/-${value}`, '#c0392b');
    if (scene.playerHp <= 0) scene.time.delayedCall(800, () => scene._gameOver());
  },

  // ── SHIV ────────────────────────────────────────────────────────────────────

  flurry_brand: ({ scene, die, value }) => {
    const halfVal = Math.max(1, Math.floor(value / 2));
    const type    = die._mimicType ?? die.data.type;
    if (type === 'attack' || type === 'bomb' || type === 'leech') {
      const raw = Math.floor(halfVal * scene.relicManager.getAttackMultiplier());
      const dmg = die.data.material === 'rock' || scene.relicManager.isPierceAll()
        ? raw : scene._hitEnemyBlock(raw);
      if (dmg > 0) {
        scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
        scene._addToPot(dmg);
        scene._refreshEnemyCharacter();
        scene._flashEnemyDamage(dmg);
        scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
        scene._siphonHeal(dmg);
        if (scene.enemyHp <= 0) scene._triggerVictory();
      }
    } else if (type === 'block') {
      scene.block += halfVal;
      scene._refreshStatusUI();
      scene.bus.emit('ON_BLOCK_GAINED', { amount: halfVal });
    } else if (type === 'pierce') {
      scene.cleanBonus += halfVal;
      scene._refreshPlayerPills();
    } else if (type === 'poison') {
      scene.enemyPoisonStacks += halfVal;
      scene._refreshEnemyCharacter();
    }
    scene._floatText(die.img.x, die.img.y - 44, `FLR ½${halfVal}`, '#ff6622');
  },

  needlepoint_brand: ({ scene, die, value }) => {
    const dmg = Math.min(2, value);
    scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
    scene._addToPot(dmg);
    scene._refreshEnemyCharacter();
    scene._flashEnemyDamage(dmg);
    scene._floatText(die.img.x, die.img.y - 44, `NPT ${dmg}`, '#ff4444');
    scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
    scene._siphonHeal(dmg);
    if (scene.enemyHp <= 0) scene._triggerVictory();
  },

  frenzy_brand: ({ scene, die }) => {
    scene._addTempDieToTray('attack', 4);
    scene._floatText(die.img.x, die.img.y - 44, 'FRZ +d4', '#ff8800');
  },

  bleed_brand: ({ scene, die }) => {
    const curr = scene._currQueueEffect;
    if (!curr || curr.type !== 'attack') {
      scene._floatText(die.img.x, die.img.y - 44, 'BLD: no dmg', '#cc2222');
      return;
    }
    const stacks = Math.max(1, curr.value);
    scene.enemyPoisonStacks += stacks;
    scene._refreshEnemyCharacter();
    scene._floatText(die.img.x, die.img.y - 44, `BLD ☠+${stacks}`, '#cc2222');
    scene.bus.emit('ON_STATUS_APPLIED', { target: 'enemy', status: 'poison', amount: stacks });
  },

  swarm_brand: ({ scene, die }) => {
    const before = Math.max(0, (die._settleOrder ?? 1) - 1);
    if (before === 0) {
      scene._floatText(die.img.x, die.img.y - 44, 'SWM: 0', '#ff2244');
      return;
    }
    const dmg = scene._hitEnemyBlock(before);
    if (dmg > 0) {
      scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
      scene._addToPot(dmg);
      scene._refreshEnemyCharacter();
      scene._flashEnemyDamage(dmg);
      scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
      scene._siphonHeal(dmg);
      if (scene.enemyHp <= 0) scene._triggerVictory();
    }
    scene._floatText(die.img.x, die.img.y - 44, `SWM ×${before} = ${dmg}`, '#ff2244');
  },

  // ── GENERIC ─────────────────────────────────────────────────────────────────

  echo_brand: ({ scene, die }) => {
    scene._floatText(die.img.x, die.img.y - 44, 'ECH ×2', '#f0c040');
    scene.time.delayedCall(120, () => scene._applyDieFaceImmediate(die, true));
  },

  surge_brand: ({ scene, die }) => {
    const type   = die._mimicType ?? die.data.type;
    const bonus  = 2;
    if (type === 'attack' || type === 'bomb' || type === 'leech') {
      const dmg = scene._hitEnemyBlock(bonus);
      if (dmg > 0) {
        scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
        scene._addToPot(dmg);
        scene._refreshEnemyCharacter();
        scene._flashEnemyDamage(dmg);
        scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
        scene._siphonHeal(dmg);
        if (scene.enemyHp <= 0) scene._triggerVictory();
      }
    } else if (type === 'block') {
      scene.block += bonus;
      scene._refreshStatusUI();
      scene.bus.emit('ON_BLOCK_GAINED', { amount: bonus });
    } else if (type === 'pierce') {
      scene.cleanBonus += bonus;
      scene._refreshPlayerPills();
    } else if (type === 'poison') {
      scene.enemyPoisonStacks += bonus;
      scene._refreshEnemyCharacter();
    }
    scene._floatText(die.img.x, die.img.y - 44, `SRG +${bonus}`, '#e8c97a');
  },

  rebound_brand: ({ scene, die, playerX, playerY }) => {
    scene.time.delayedCall(200, () => {
      if (!die.img?.active || !die.img.body) return;
      const de  = Math.hypot(die.img.x - scene.enemyPos.x, die.img.y - scene.enemyPos.y);
      const dp  = Math.hypot(die.img.x - playerX, die.img.y - playerY);
      const tx  = de < dp ? scene.enemyPos.x : playerX;
      const ty  = de < dp ? scene.enemyPos.y : playerY;
      const dx  = tx - die.img.x;
      const dy  = ty - die.img.y;
      const len = Math.hypot(dx, dy) || 1;
      Phaser.Physics.Matter.Matter.Body.setVelocity(die.img.body, {
        x: (dx / len) * 5,
        y: (dy / len) * 5,
      });
      scene._rerollDie(die);
      scene._floatText(die.img.x, die.img.y - 32, 'RBD ↩', '#f39c12');
    });
  },

  mirror_brand: ({ scene, die }) => {
    const prev = scene._prevQueueEffect;
    if (!prev) {
      scene._floatText(die.img.x, die.img.y - 44, 'MIR: none', '#bdc3c7');
      return;
    }
    const halfVal = Math.max(1, Math.floor(prev.value / 2));
    if (prev.type === 'attack') {
      const dmg = scene._hitEnemyBlock(halfVal);
      if (dmg > 0) {
        scene.enemyHp = Math.max(0, scene.enemyHp - dmg);
        scene._addToPot(dmg);
        scene._refreshEnemyCharacter();
        scene._flashEnemyDamage(dmg);
        scene.bus.emit('ON_DAMAGE_DEALT', { amount: dmg, die });
        scene._siphonHeal(dmg);
        if (scene.enemyHp <= 0) scene._triggerVictory();
      }
    } else if (prev.type === 'block') {
      scene.block += halfVal;
      scene._refreshStatusUI();
      scene.bus.emit('ON_BLOCK_GAINED', { amount: halfVal });
    } else if (prev.type === 'pierce') {
      scene.cleanBonus += halfVal;
      scene._refreshPlayerPills();
    } else if (prev.type === 'poison') {
      scene.enemyPoisonStacks += halfVal;
      scene._refreshEnemyCharacter();
    }
    scene._floatText(die.img.x, die.img.y - 44, `MIR ½${halfVal}`, '#bdc3c7');
  },

  anchor_brand: ({ scene, die }) => {
    die._anchored = true;
    scene._floatText(die.img.x, die.img.y - 44, 'ANC locked', '#95a5a6');
  },
};
