# Dicemore — Game Design Document

**Version:** pre-alpha-beta-0.14
**Genre:** Roguelike Dice-Builder

> Sections marked **[PLANNED]** describe intended future design not yet implemented. All other sections describe mechanics that are built and working.

---

## 1. Concept Overview

Dicemore is a roguelike dice-building game set in a western-themed underground dice gambling championship. Everyone in the championship is cheating. The player is a newcomer working their way up the bracket against increasingly slimy opponents. Players collect, upgrade, and manipulate a set of custom dice rather than a deck of cards. Each die has a **type** that determines its effect, and its rolled value scales that effect. Players can attach brands (runes) and apply materials to dice between battles. Combat is resolved by physically throwing dice across a 2D play surface using tap-and-drag, where two physics bumpers act as pinball-style obstacles. Player dice queue their effects and fire sequentially once they settle. At the start of each turn enemies throw their own dice onto the rolling surface; those dice settle via the same physics as the player's, and the player can physically interact with them — knocking an attack die to a lower value, or risking a boost.

---

## 2. Core Fantasy

The player is a con-artist at a rigged dice table, whose power comes from their ability to shape, throw, and redirect fate itself. A master of the dice doesn't just accept what they roll — they aim their throws, bank dice off bumpers, chain collisions for reroll bonuses, and apply brands that bend the rules. When the enemy throws their dice, the master reads the table — nudge their attack die into a lower value, risk pushing their block die higher, or ignore it entirely and focus on dealing damage before the enemy's dice settle.

---

## 3. Visual Layout

### 3.1 Screen Structure

The game is designed portrait-first. The screen is **400 × 700 px** and divided into three zones:

```
┌────────────────────────┐  ← y=0
│  Phase · Message       │  ← minimal header (~80px)
├────────────────────────┤  ← SURFACE_TOP
│                        │
│  [Enemy bumper]  HP    │
│                        │
│    DICE ROLLING        │
│       SURFACE          │  ← physics space
│                        │
│ BLK [Player bumper] HP │
│                        │
├────────────────────────┤  ← SURFACE_BOTTOM
│  [D1] [D2] [D3] ···    │  ← footer / tray
└────────────────────────┘  ← y=700
```

- **Header:** Phase label, battle message, HP display (`current / max`).
- **Rolling Surface:** Full physics space. Both the player bumper (bottom-center) and the enemy bumper (upper half) live here.
- **Footer:** Solid opaque strip. Contains unthrown player dice as tap/drag cards. Once all dice have been thrown and the effect queue has fully resolved, the **Commit** button fills the footer.
- **Effect Queue Panel:** A column of cards on the left edge of the rolling surface showing queued player die effects. The active card pulses when its effect fires, then slides off to the left.

### 3.2 Player Character

The player is represented as a **gold circle bumper** fixed at the bottom-center of the rolling surface. HP is displayed to the right as `current / max`. Block is displayed to the left, hidden when block is 0.

### 3.3 Enemy Character

The enemy is a **colored circle bumper** in the upper half. HP displays beside it. Tapping the enemy bumper opens the **web view** — thin lines are drawn from the enemy bumper to each of their dice currently on the surface, and each die is highlighted with its type label and current value. Tapping anywhere else closes the view. The enemy repositions to a random location within the upper half at the start of each new turn.

### 3.4 Hand Tray (Footer)

Shows only **unthrown** player dice as cards. When a die is thrown, its card disappears and remaining cards re-center. Cards can be **drag-reordered** horizontally. Tapping a card opens the die inspector. Temporary dice (from Frenzy Brand, Speed Loader, etc.) appear here and are removed at the start of the next turn.

---

## 4. Dice System

### 4.1 What a Die Is

Each player die has:

- A **type** — determines what effect it produces on settle (see 4.2).
- A **face count** (sides) — d6 base, upgradeable to d8, d10, d12, d20.
- A **rolled value** — displayed as `floor(faceIndex / 2) + 1`. Pairs of physical faces share the same displayed value: d6 shows [1, 1, 2, 2, 3, 3].
- An optional **Brand** attached to a specific face index (triggers only when that face lands).
- An optional **Material** applied to the whole die.
- A **culledFaces** list — face slot indices permanently removed via the Cull service at the shop.

### 4.2 Player Die Types

| Type           | Sym | Color     | Effect on Settle                                                                                                        |
| -------------- | --- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Steal**      | STE | `#ff4444` | Deal damage equal to rolled value. Reduced by enemy block.                                                              |
| **Protect**    | PRO | `#3498db` | Gain block equal to rolled value.                                                                                       |
| **Buff**       | BUF | `#ff9900` | Add rolled value to `cleanBonus` — a flat bonus applied to all other dice this turn. Resets at turn end.                |
| **Copy**       | CPY | `#cc88ff` | Mimics the last player die type it physically touched. If it never touched another player die, deals 1 weak steal.      |
| **Pickpocket** | PKP | `#58d68d` | Stacks poison on the enemy — they take damage at the start of each enemy roll phase and the stack decays by 1 per tick. |

### 4.3 Sides Progression

```
d6 → d8 → d10 → d12 → d20
```

| Sides | Value range |
| ----- | ----------- |
| d6    | 1 – 3       |
| d8    | 1 – 4       |
| d10   | 1 – 5       |
| d12   | 1 – 6       |
| d20   | 1 – 10      |

### 4.4 Starting Classes

Players choose a class at setup. All preset class dice start without brands or materials. Damage persists between fights — HP does not reset after a battle.

| Class            | In-Game Name           | Dice                               | Starting Chip      | Notes                              |
| ---------------- | ---------------------- | ---------------------------------- | ------------------ | ---------------------------------- |
| **Dice Slinger** | The card sharp         | d6 STE, d6 BUF, d6 PRO             | Lucky Coin         |                                    |
| **Illusionist**  | Master of misdirection | d6 STE, d6 CPY, d6 PRO             | Steady Hand        |                                    |
| **Pickpocket**   | Lifts chips undetected | d6 STE, d4 PKP, d6 PRO             | Pickpocket's Thumb | Poison die starts at d4            |
| **The Muscle**   | Built like a brick     | d8 PRO, d8 PRO                     | Stone Calendar     |                                    |
| **The Drifter**  | Custom build           | Player picks count (2–5) and types | Player's choice    | Shown as separate button at bottom |

### 4.5 Die Inspector

Tapping any live die on the rolling surface, or tapping a tray card, opens the face inspector. The inspector displays the die as an unfolded net (d6) or a compact 4-column grid (larger dice). Face values display in the die's type color. Active face is highlighted. Faces with a brand attached have a **gold border** and small brand symbol. Throwing is disabled while the inspector is open.

### 4.6 Bumper Contacts

- A player die striking the **enemy bumper** → deals 1 HP damage to the enemy and rerolls the die.
- A player die striking the **player bumper** → rerolls the die.
- These apply in addition to the die's normal queued effect on settle.

---

## 5. Turn Structure

### 5.1 Phase Overview

Each combat turn proceeds in four phases: **PREP → ENEMY_ROLL → PLAYER_ROLL → COMMIT**.

### 5.2 Preparation (PREP)

- Turn counter increments.
- Player block resets to 0 (base — Fortress Brand and Hoarder relics may add persistent block).
- `cleanBonus` resets to 0.
- Status durations tick down: player Frail and Vulnerable each decrease by 1.
- Enemy Weakened and enemy Vulnerable reset to false.
- Pending enemy block becomes active `enemyBlock`.
- Per-turn flags reset: `statusDamageBonus`, `_suppressPoisonDecay`, `_cannonballUsed`, `_luckyCoinUsed`, `_nextThrowSpeedBonus`, `_ashenActive`, etc.
- Enemy repositions to a new random location.
- `ON_TURN_START` fires — relic effects like Stone Calendar, Speed Loader, and Devil's Contract resolve here.

### 5.3 Enemy Roll Phase (ENEMY_ROLL)

1. Enemy poison ticks: enemy takes damage equal to stack count. If `_suppressPoisonDecay` is false, stack count decreases by 1.
2. **Enemy dice are thrown** — each die in the enemy's `enemyDice` config is auto-thrown onto the surface with a randomised angle and force. They use the same physics bodies as player dice and settle by the same `SETTLE_VEL` threshold.
3. **Obstacle dice** — blank physics dice equal to `obstacleCount` for this enemy are thrown onto the surface. No effect on settle; purely physical blockers. Each is spawned with `sides: 6`.

### 5.4 Player Rolling Phase (PLAYER_ROLL)

**Throwing:** Tap and drag from anywhere on screen. Drag direction/distance set throw angle and velocity. A faint aim line shows the projected direction. The drag can originate on top of dice, bumpers, or status text — it will not accidentally tap those elements.

**Effect queue:** When a player die settles, its effect is added to the effect queue. Queue processes automatically: card pulses → effect executes → card slides off → next card fires. The queue pauses if any die starts moving (brand effects). `_throwLocked` prevents a new throw while the queue is active.

**Settle tracking:** When a player die settles, `playerSettleCount` increments and `_settleOrder` is stamped on the dieRef. Used by Swarm Brand, Counting Knife, etc.

**Omen override:** If `_omenValue` is set when a die settles, that die's face is overridden to the closest matching value before queuing.

**Mid-turn victory:** If enemy HP reaches 0 during the rolling phase, the battle ends immediately.

### 5.5 Commit Phase (COMMIT)

Each settled enemy die resolves by type, using its **settled face value** as the magnitude:

- **Attack (ATK):** deals settled value as damage, reduced by player block.
- **Block (BLK):** stores settled value as pending block; activates at start of next turn.
- **Strength (STR):** adds settled value permanently to enemy strength.
- **Vulnerable (VUL):** applies Vulnerable to the player for settled value turns (+50% damage taken).
- **Frail (FRL):** applies Frail to the player for settled value turns (player dice deal half damage).

Enemy dice are cleared from the surface after all effects resolve. After enemy acts, `ON_TURN_END` fires. Obstacle dice are cleared. If player HP reaches 0 → game over.

---

## 6. Effect Queue Visual

Queue cards appear in a vertical column on the left side of the rolling surface. Each card shows the type symbol (STE/BLK/etc.) and rolled value. A small brand symbol appears in the corner if a brand triggered. Cards pulse (scale bounce) when active, then slide off left. Remaining cards shift up to fill the gap.

---

## 7. Enemy Block Mechanic

Enemy block uses a **one-turn delay** ("casting" model):

- When an enemy block die settles, its value is stored as pending block — does not activate this turn.
- At the start of the following turn (PREP), pending block becomes active `enemyBlock`.
- While active, `enemyBlock` absorbs player Steal damage. Pierce and Rock material bypass it entirely.
- The block shield displays beside the enemy bumper as an arc with the remaining value.
- `enemyBlock` resets to 0 at the start of each new turn.

---

## 8. Enemy System

### 8.1 Enemy Dice

Each enemy carries a set of **enemy dice** — 1 to 4 dice depending on tier. At the start of ENEMY_ROLL, all enemy dice are auto-thrown onto the rolling surface with randomised angles and forces. They use identical physics bodies to player dice (circular, radius 20 px, same constants) and settle by the same `SETTLE_VEL` threshold.

During PLAYER_ROLL, enemy dice are live on the table. Player dice can physically collide with them, rerolling them on contact. This is the core player agency point: aim to knock an attack die to a lower value, but risk boosting it or triggering a block die instead.

At COMMIT, each settled enemy die resolves its effect (type + face value). Enemy dice are then cleared from the surface.

Because enemy dice share the same architecture as player dice, they can carry upgrades and brands in future iterations using the same systems.

### 8.2 Enemy Die Types

| Type         | Sym | Effect on Commit                                                                    |
| ------------ | --- | ----------------------------------------------------------------------------------- |
| `attack`     | ATK | Deal settled value as damage to player, reduced by block.                           |
| `block`      | BLK | Store settled value as pending block; activates at start of next turn.              |
| `strength`   | STR | Add settled value permanently to enemy strength.                                    |
| `vulnerable` | VUL | Apply Vulnerable to player for settled value turns (+50% damage taken).             |
| `frail`      | FRL | Apply Frail to player for settled value turns (player dice deal half damage).        |

### 8.3 Web View (Tap Enemy)

Tapping the enemy bumper during PLAYER_ROLL opens the **web view**: thin lines are drawn from the enemy bumper to each of the enemy's live dice on the surface. Each die is highlighted and shows its type label (ATK / BLK / etc.) and current face value. Tapping anywhere else closes the view. The web view is purely cosmetic — it does not pause the game or block throwing.

### 8.4 Visual Differentiation

Enemy dice use a warm red/orange palette distinct from player dice. The die's type symbol is visible on the face at all times, and the current value animates while the die is in motion (same spin-display logic as player dice).

### 8.5 Enemy Roster

Dice values updated to double the original — enemy dice sides were too weak at the original scale.

| #   | Key                | Name             | Tier     | HP  | Obstacles | Enemy Dice                            | Ability            |
| --- | ------------------ | ---------------- | -------- | --- | --------- | ------------------------------------- | ------------------ |
| —   | `training_dummy`   | The Greenhorn    | tutorial | 14  | 0         | 1× d8 ATK                            | —                  |
| 1   | `red_louse`        | Two-Bit Hank     | minion   | 26  | 1         | 1× d12 ATK                           | —                  |
| 2   | `cultist`          | Snake Eyes Sally | minion   | 24  | 1         | 1× d12 ATK, 1× d8 FRL               | —                  |
| 3   | `jaw_worm`         | The Dandy        | minion   | 42  | 1         | 1× d16 ATK                           | —                  |
| 4   | `spike_slime`      | The Reverend     | standard | 52  | 2         | 1× d16 ATK, 1× d12 BLK              | —                  |
| 5   | `green_louse`      | Mad-Eye McGee    | standard | 44  | 2         | 2× d12 ATK                           | —                  |
| 6   | `fungal_beast`     | The Widow        | standard | 62  | 2         | 1× d16 ATK, 1× d12 STR              | —                  |
| 7   | `gremlin_nob`      | The Baron        | elite    | 80  | 3         | 1× d20 ATK, 1× d12 STR              | —                  |
| 8   | `lagavulin`        | Iron Iris        | elite    | 96  | 3         | 1× d20 ATK, 1× d16 BLK              | —                  |
| 9   | `bronze_automaton` | The House        | elite    | 86  | 3         | 2× d16 ATK, 1× d12 BLK              | —                  |
| 10  | `slime_lord`       | The House (TBD)  | elite    | 130 | 4         | 2× d20 ATK, 1× d14 STR              | —                  |
| 11  | `hexaghost`        | The Devil        | boss     | 150 | 4         | 2× d20 ATK, 1× d16 BLK, 1× d12 STR | —                  |

The Greenhorn is used only in the tutorial and uses the Dice Slinger class loadout.

### 8.6 Enemy Strength & Vulnerable

Enemy Strength stacks accumulate permanently during a battle. Enemy Vulnerable (`enemyVulnerable`) makes the enemy take 50% more damage from Steal dice, resets each turn. Enemy Weakened (`enemyWeakened`) halves enemy attack damage, resets each turn.

### 8.7 Enemy Passive Abilities

Enemies can carry one or more **passive abilities** that modify the physics rules or player mechanics for the duration of that enemy's turn. Abilities are declared in `faces.js` under the `abilities` array on an enemy definition and are applied at the start of `ENEMY_ROLL`, then torn down after `_clearSurface()`.

Each ability entry has an `id` and an optional `value`. A list of teardown callbacks (`_abilityCleanup[]`) is flushed at the end of each turn so no state leaks between rounds.

#### Ability IDs

| ID                  | Effect                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bouncy_bumpers`    | Sets enemy bumper restitution to 2.0 for the turn. Player dice rocket off the bumper unpredictably. The bumper is no longer a reliable aiming target.               |
| `sticky_walls`      | Sets wall friction to maximum and restitution to 0. Dice that hit a wall crawl to a stop instead of bouncing. Kills wall-ball strategies entirely.                  |
| `glass_curse`       | All player dice on the tray are flagged as Glass for the turn. They shatter and trigger twice on their first physical contact with any other die or bumper.          |
| `obstacle_buff`     | Each time any die (player or enemy) contacts an obstacle die this turn, the enemy gains `+value` Strength permanently.                                              |
| `contact_drain`     | Every time a player die contacts anything (die, wall, or bumper), its `_valueBonus` decreases by 1. Dice that collide a lot settle significantly weaker.            |
| `bumper_enrage`     | Each time a player die contacts the enemy bumper this turn, the enemy permanently gains `+value` Strength. The standard chip-damage payoff is reversed into a risk. |
| `flat_reduction`    | Reduces every player die's settled value by `value` before its effect fires. Flat, not percentage — predictable and readable.                                       |
| `bullet_throws`     | Overrides the minimum throw speed to a high value. Every throw goes fast regardless of gesture length. Difficult to aim precisely; dice careen unpredictably.       |
| `weak_throws`       | Caps the maximum throw speed at half normal. Dice barely reach the enemy bumper. Pairs poorly with featherlight upgrades.                                           |

#### Suggested enemy alternatives using abilities

Each of the following is a named alternate version of an existing roster slot, selectable via a future branching map. The player would see one or the other per run, not both.

| Replaces           | Alt key              | Alt name      | Ability            | Design note                                                                              |
| ------------------ | -------------------- | ------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `cultist`          | `witch`              | The Hex       | `bumper_enrage`    | Punishes the instinct to aim for the bumper; turns a reward loop into a liability.       |
| `spike_slime`      | `shatter_slime`      | The Smashball | `glass_curse`      | Slime theme, destroys player dice on contact rather than debuffing stats.                |
| `green_louse`      | `swarm`              | The Pack      | `contact_drain`    | Two dice = lots of collisions = lots of drain. Rewards clean, minimal-contact throws.    |
| `fungal_beast`     | `mycelium`           | The Tangle    | `obstacle_buff`    | Obstacles feel like mycelium tendrils; hitting them feeds the beast.                     |
| `gremlin_nob`      | `pinball_nob`        | Pinball Pete  | `bouncy_bumpers`   | Elite-tier chaos. Every round is structurally different. High-skill ceiling to play around. |
| `lagavulin`        | `tar_giant`          | Tar Molly     | `sticky_walls`     | Slow and oppressive. Shuts down wall-bounce and featherlight strategies.                 |
| `bronze_automaton` | `artillery_bot`      | The Gatling   | `bullet_throws`    | Forces the player to deal with their own uncontrollable speed. Chaotic table state.      |
| `jaw_worm`         | `void_worm`          | The Maw       | `flat_reduction`   | Simple, readable debuff as the first non-trivial minion.                                 |

#### Implementation sketch

```
faces.js:
  abilities: [{ id: 'bouncy_bumpers', duration: 'turn' }]
  abilities: [{ id: 'obstacle_buff',  value: 2 }]

BattleScene.js:
  _enemyRollPhase():
    (this.enemyDef.abilities ?? []).forEach(ab => this._applyEnemyAbility(ab))

  _applyEnemyAbility(ab):
    switch ab.id:
      'bouncy_bumpers' → enemyBumperBody.restitution = 2.0
                         _abilityCleanup.push(() => reset)
      'sticky_walls'   → wallBodies.forEach(b => b.friction = 8, b.restitution = 0)
                         _abilityCleanup.push(() => reset)
      'glass_curse'    → playerDice.forEach(d => d._cursedGlass = true)
      'obstacle_buff'  → _obstacleBuffPerHit = ab.value
                         _abilityCleanup.push(() => reset)
      ... etc.

  _clearSurface():
    _abilityCleanup.forEach(fn => fn())
    _abilityCleanup = []
```

Abilities that modify the collision handler (`obstacle_buff`, `contact_drain`, `bumper_enrage`) read a flag set by `_applyEnemyAbility` rather than checking the ability list directly, so the collision handler stays a simple flag check rather than an array scan per-collision.

---

## 9. Status Effects

| Effect         | Applies To | Duration         | Mechanic                                                                                                                 |
| -------------- | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Frail**      | Player     | 3 turns          | Player's dice deal half damage.                                                                                          |
| **Distracted** | Player     | Stacking turns   | Player takes 50% more damage per stack from enemy attacks.                                                               |
| **Poison**     | Player     | Decays per turn  | Player takes damage equal to stack count at start of PLAYER_ROLL; decreases by 1 per tick.                               |
| **Strength**   | Enemy      | Rest of battle   | Enemy attack damage permanently increased per stack.                                                                     |
| **Weakened**   | Enemy      | 1 turn           | Enemy deals half damage. Resets at PREP.                                                                                 |
| **Vulnerable** | Enemy      | 1 turn           | Enemy takes 50% more damage from Steal. Resets at PREP.                                                                  |
| **Poison**     | Enemy      | Decays per turn  | Enemy takes damage equal to stack count at start of ENEMY_ROLL; decreases by 1 per tick (unless Slow Drip Brand active). |
| **Cracked**    | Any die    | Next settle only | Die's effect value is halved on next settle. Clears after firing.                                                        |

Status effect durations display as counters on the player status bar. Tapping the player bumper opens a popup describing all active statuses.

---

## 10. Upgrade Screen

After each battle victory the player enters the Upgrade Screen. Three **Brand** options are presented as cards drawn via the Lottery System. The player picks one, or skips.

### 10.1 Brand Pool

All available brands are pooled and drawn via the Lottery System (see §13). Draw count: 3. The player selects a brand, then chooses which die to place it on, and which face index.

### 10.2 Heal Option

A flat heal of `floor(playerMaxHp * 0.2)` HP is available as a footer button on the upgrade screen.

### 10.3 Between-Battle Flow

After every 3rd battle, the upgrade screen routes to the **Shop Select** screen instead of directly back to battle. The player is presented with 2 of 3 available shops (randomised) and picks one to visit.

---

## 11. Shop System

Every 3 battles (after the upgrade screen), the player visits a shop. Two of the three available shops are shown at random; the player picks one or skips back to the next battle.

### 11.1 The Three Shops

| Shop               | Tab 1: Brands | Tab 2: Section   | Tab 3: Special |
| ------------------ | ------------- | ---------------- | -------------- |
| Trench Coat Guy    | 10 brands     | 4 Chips (relics) | Cull a Face    |
| The Witch's Corner | 10 brands     | Rune Management  | Cull a Face    |
| The Forge          | 10 brands     | 4 Materials      | Cull a Face    |

### 11.2 Gold

- Player earns 10g per battle victory, added to `playerGold`.
- Gold is persistent across the run and visible only in shop scenes.
- Gold is spent to purchase brands (15g), chips/materials (30g), or cull services.

### 11.3 Brand Tab

10 brands drawn via Lottery System from the full brand pool. Purchasing (15g) prompts the player to choose a die and face to place the brand on.

### 11.4 Chip Tab (Trench Coat Guy)

4 relics/chips drawn via Lottery System. Purchasing (30g) immediately applies the chip effect.

### 11.5 Materials Tab (The Forge)

4 materials drawn via Lottery System. Purchasing (30g) applies the material to a chosen die. Uranium culls the top half of face slots on application.

### 11.6 Rune Management Tab (The Witch's Corner)

Costs 50g to unlock per visit. Once unlocked, the player can freely:

- **Remove** a brand from a face (it goes to the witch's inventory for this visit).
- **Move** a brand to another face on any die.
- **Place** a brand from inventory onto an empty face.

The witch maintains a cross-visit rune inventory (`witchRunes`) — brands removed in one visit remain available in later visits.

### 11.7 Cull a Face

Available at all three shops. Base cost 10g, +5g per prior paid cull this run (`cullCount`). Permanently removes all face slots sharing a chosen value from a selected die. Cannot cull the last remaining value group.

---

## 12. Chips (Relics)

Chips are passive or triggered effects carried through the run. One chip is granted at class selection. Additional chips can be bought at Trench Coat Guy's shop. Chips register handlers on the EventBus and fire when their trigger condition is met.

### 12.1 Chip List

| Name                 | Rarity   | Trigger                 | Effect                                                                      |
| -------------------- | -------- | ----------------------- | --------------------------------------------------------------------------- |
| Burning Blood        | common   | ON_KILL                 | Heal 4 HP when you defeat an enemy.                                         |
| Meditation Stone     | common   | ON_TURN_START           | Heal 1 HP at the start of each turn.                                        |
| Pickpocket's Thumb   | common   | ON_SETTLE               | Whenever a Pickpocket die settles, apply 1 extra poison stack.              |
| Stone Calendar       | uncommon | ON_TURN_START           | Start each turn with 5 block.                                               |
| Venom Clock          | uncommon | ON_TURN_START           | If the enemy has 3+ poison stacks at turn start, deal 2 damage.             |
| Orichalcum           | uncommon | PASSIVE                 | All block amounts are doubled.                                              |
| Steady Hand          | uncommon | PASSIVE                 | Dice that land without hitting anything deal +4 bonus effect.               |
| Tormentor's Ring     | uncommon | ON_STATUS_APPLIED       | Each time a status is applied to the enemy, deal 1 damage.                  |
| Plague Doctor's Coat | uncommon | ON_DAMAGE_TAKEN         | When the player takes damage, apply 2 poison stacks to the enemy.           |
| Rune Resonance       | uncommon | ON_RUNE_TRIGGER         | Heal 1 HP each time a brand fires.                                          |
| Spiked Bumper        | uncommon | ON_CONTACT_BUMPER_ENEMY | When a die hits the enemy bumper, deal its max face value as bonus damage.  |
| Cannonball           | uncommon | ON_CONTACT_DIE          | The first die-to-die collision each turn deals 3 bonus damage.              |
| Iron Forearm         | uncommon | ON_CONTACT_BUMPER_ENEMY | Each time a die hits the enemy bumper, your next throw gains +2 speed.      |
| Lucky Coin           | uncommon | ON_SETTLE               | Once per turn, when a die rolls its max face value, its effect fires twice. |
| Speed Loader         | uncommon | ON_TURN_START           | Start each turn with one extra d4 Steal die in the tray.                    |
| Counting Knife       | uncommon | ON_SETTLE               | The Nth die to settle this turn deals +N damage.                            |
| Paper Cut            | uncommon | ON_DAMAGE_DEALT         | Each time damage is dealt, apply 1 poison stack to the enemy.               |
| Lodestone Heart      | uncommon | ON_CONTACT_DIE          | Each time two player dice collide, both gain +1 to their next effect.       |
| Dead Man's Fuse      | uncommon | ON_DIE_DESTROYED        | When any player die is destroyed, deal 4 damage to the enemy.               |
| Overkill Charm       | uncommon | ON_DIE_DESTROYED        | When a player die is destroyed, heal 2 HP.                                  |
| Shrapnel Vest        | rare     | ON_DIE_DESTROYED        | When a player die is destroyed, spawn one d4 Steal die in the tray.         |
| Amplifier Stone      | rare     | ON_TURN_START           | If the enemy has 2+ status effects, all damage is +25% this turn.           |
| The Devil's Contract | rare     | ON_TURN_START           | Lose 2 HP. All dice deal +3 damage this turn.                               |

---

## 13. Brands (Runes) and Materials

Each player die can carry at most **one Brand** per face and at most **one Material** for the whole die.

### 13.1 How Brands Work

A Brand attaches to a **specific face index**. It fires only when the die settles on that face (trigger `ON_FACE`), except **Chain Reaction Brand** which fires `ON_DIE_DESTROYED`. Brand handlers receive a context object: `{ scene, die, value, faceIdx, playerX, playerY }`.

Some brand effects are complex enough to require new per-turn or per-die state tracked in BattleScene. See §13.4 for the state table.

### 13.2 Brand List by Archetype

#### Poison

| Brand           | Sym | Rarity   | Effect                                                  |
| --------------- | --- | -------- | ------------------------------------------------------- |
| Seeping Brand   | SEP | common   | Apply poison stacks equal to rolled value.              |
| Festering Brand | FST | uncommon | Double the enemy's current poison stack count.          |
| Miasma Brand    | MIA | uncommon | Apply Frail (Weakened) to the enemy for 1 turn.         |
| Slow Drip Brand | DRP | uncommon | Enemy poison stacks do not decay this turn.             |
| Virulent Brand  | VRL | rare     | Apply poison stacks equal to turns elapsed this battle. |

#### Status

| Brand           | Sym | Rarity   | Effect                                                     |
| --------------- | --- | -------- | ---------------------------------------------------------- |
| Hex Brand       | HEX | common   | Apply Vulnerable to the enemy — they take 50% more damage. |
| Weaken Brand    | WKN | common   | Apply Frail to the enemy — they deal half damage.          |
| Amplify Brand   | AMP | uncommon | All status durations on the enemy are extended by 1.       |
| Wither Brand    | WTH | uncommon | Reduce the enemy's block by the rolled value.              |
| Contagion Brand | CON | rare     | Each status on the enemy deals 1 damage immediately.       |

#### Hoarder

| Brand          | Sym | Rarity   | Effect                                                     |
| -------------- | --- | -------- | ---------------------------------------------------------- |
| Fortress Brand | FRT | uncommon | Gain block equal to rolled value.                          |
| Absorb Brand   | ABS | uncommon | Convert half of current block into HP.                     |
| Sentinel Brand | SNT | uncommon | If current block exceeds 5, this die's effect fires twice. |
| Bulwark Brand  | BLW | common   | Apply Frail to the enemy and gain 2 block.                 |
| Patience Brand | PAT | uncommon | Gain 1 block per turn elapsed this battle, up to 6.        |

#### Generic

| Brand         | Sym | Rarity   | Effect                                                                     |
| ------------- | --- | -------- | -------------------------------------------------------------------------- |
| Echo Brand    | ECH | rare     | This face's effect fires a second time at full value.                      |
| Surge Brand   | SRG | common   | Add +2 to this face's effect.                                              |
| Rebound Brand | RBD | uncommon | After effect resolves, this die relaunches toward the nearest bumper.      |
| Mirror Brand  | MIR | uncommon | Copy the previous die's effect in the queue at half value.                 |
| Anchor Brand  | ANC | common   | This die's value cannot be changed by other effects this turn (no reroll). |

#### Shiv

| Brand             | Sym | Rarity   | Effect                                                              |
| ----------------- | --- | -------- | ------------------------------------------------------------------- |
| Flurry Brand      | FLR | uncommon | This die's effect fires a second time at half value (minimum 1).    |
| Needlepoint Brand | NPT | common   | Deal up to 2 damage ignoring enemy block.                           |
| Frenzy Brand      | FRZ | uncommon | Add a d4 Steal die to the tray for this turn only.                  |
| Bleed Brand       | BLD | uncommon | Apply 1 poison stack per point of damage this die dealt.            |
| Swarm Brand       | SWM | rare     | Deal 1 extra damage per die that settled before this one this turn. |

#### Gambler

| Brand              | Sym | Rarity   | Effect                                                                        |
| ------------------ | --- | -------- | ----------------------------------------------------------------------------- |
| Devil's Luck Brand | DVL | uncommon | Simulate a reroll. If the new value is higher, deal the difference as damage. |
| Double Down Brand  | DBL | rare     | On max face: double the effect. On min face: shows BUST (cancel deferred).    |
| Snake Eyes Brand   | SNK | uncommon | Simulate 2 more rolls. Apply the best result as a bonus.                      |
| Omen Brand         | OMN | uncommon | The next die to settle this turn uses this die's rolled value.                |
| House Cut Brand    | HSC | uncommon | Deal damage equal to rolled value, then lose that many HP.                    |

#### Impact

| Brand           | Sym | Rarity   | Effect                                                                           |
| --------------- | --- | -------- | -------------------------------------------------------------------------------- |
| Shockwave Brand | SHK | uncommon | Push all dice within 80px away. Force scales with rolled value.                  |
| Tremor Brand    | TRM | uncommon | Deal bonus damage equal to the number of bumper contacts this throw.             |
| Crater Brand    | CRT | rare     | The first die this die contacted is destroyed. Its effect still resolves.        |
| Ricochet Brand  | RCT | uncommon | After effect resolves, this die relaunches toward the last bumper it hit.        |
| Hairline Brand  | HLN | uncommon | Every die this die contacted this throw gains Cracked — half damage next settle. |

#### Destruction

| Brand                | Sym | Rarity   | Effect                                                                                            |
| -------------------- | --- | -------- | ------------------------------------------------------------------------------------------------- |
| Martyrdom Brand      | MRT | uncommon | Destroy this die. All other player dice on the board gain +2 to their next rolled value.          |
| Splinter Brand       | SPL | uncommon | Destroy this die. Spawn two d4 Steal dice in the tray.                                            |
| Chain Reaction Brand | CRC | rare     | **ON_DIE_DESTROYED**: when this die is destroyed by any cause, deal its max face value as damage. |
| Ashen Brand          | ASH | uncommon | Destroy this die. The next die thrown this turn triggers its brand twice.                         |
| Rubble Brand         | RBL | uncommon | Destroy one obstacle die on the board. Gain block equal to its size (d6=3, d8=4…).                |

#### Manipulator

| Brand              | Sym | Rarity   | Effect                                                                            |
| ------------------ | --- | -------- | --------------------------------------------------------------------------------- |
| Lodestone Brand    | LDS | uncommon | Pull all other dice toward this die at moderate force. Contacts cause rerolls.    |
| Repulsor Brand     | RPL | uncommon | Push all dice away. Closer dice are hit harder (proximity-scaled force).          |
| Puppeteer Brand    | PPT | rare     | Teleport a random die to the throw origin and re-launch it in a random direction. |
| Gravity Well Brand | GWL | uncommon | Pin this die in place for 3 seconds. Any die that contacts it is rerolled.        |
| Conductor Brand    | CDT | rare     | All dice rerolled this turn gain +1 to their next effect.                         |

### 13.3 Materials

Materials modify all effects from that die regardless of which face is active. Physics properties are always active; passive effects trigger per-effect.

| Material | Sym | Rarity   | Physics                          | Passive Effect                                                           |
| -------- | --- | -------- | -------------------------------- | ------------------------------------------------------------------------ |
| Iron     | IRN | common   | Heavy, low bounce, high friction | +1 to all numeric effect values.                                         |
| Fire     | FIR | common   | Light, medium bounce             | +3 to all damage values (applied post-multiply).                         |
| Steel    | STL | uncommon | Very heavy, very low bounce      | ×2 to all numeric effect values.                                         |
| Glass    | GLS | uncommon | Very light, very high bounce     | Shatters on first die-to-die contact — both dice destroyed.              |
| Rock     | ROK | uncommon | Very heavy, very low bounce      | All damage from this die ignores enemy block.                            |
| Phantom  | PHN | uncommon | Weightless, passes through dice  | Only bumpers register collision. Doubles effect if no contact on settle. |
| Uranium  | URA | rare     | Extremely heavy, no bounce       | Culls top half of face slots on apply. Doubles rolled values.            |
| Cursed   | CRS | uncommon | Medium weight                    | Hitting the enemy bumper applies Vulnerable to the enemy.                |

**Value modifier resolution order:** Base value → +all Deltas (Iron +1) → ×all Multipliers (Steel ×2) → +post-multiply Deltas (Fire +3 damage) → Status modifiers → Enemy Block → Final value.

### 13.4 Per-Turn Brand State (BattleScene)

The following flags are managed in BattleScene to support complex brand interactions:

| Flag                   | Reset     | Used By                                              |
| ---------------------- | --------- | ---------------------------------------------------- |
| `turnCount`            | Never     | Virulent Brand, Patience Brand (counts turns)        |
| `statusDamageBonus`    | PREP      | Amplifier Stone chip (+25% damage when 2+ statuses)  |
| `_suppressPoisonDecay` | PREP      | Slow Drip Brand (prevents poison tick decay)         |
| `_prevQueueEffect`     | PREP      | Mirror Brand (copies previous die effect)            |
| `_currQueueEffect`     | per-entry | Mirror Brand, Bleed Brand (reads current die result) |
| `playerSettleCount`    | PREP      | Counting Knife, Swarm Brand                          |
| `turnAttackBonus`      | PREP      | Devil's Contract (+3 per turn)                       |
| `_cannonballUsed`      | PREP      | Cannonball chip (once-per-turn)                      |
| `_luckyCoinUsed`       | PREP      | Lucky Coin chip (once-per-turn)                      |
| `_nextThrowSpeedBonus` | per-throw | Iron Forearm chip                                    |
| `_ashenActive`         | consumed  | Ashen Brand (stamps \_runeDouble on next throw)      |
| `_omenValue`           | consumed  | Omen Brand (overrides next settling die's face)      |

---

## 14. Lottery System

The Lottery System controls what items appear in the upgrade screen and shop.

### 14.1 Ticket Formula

```
tickets = RARITY_TICKETS[item.rarity] + synergy_bonus
```

| Rarity   | Base Tickets |
| -------- | ------------ |
| common   | 4            |
| uncommon | 3            |
| rare     | 2            |

The synergy bonus is +1 per item in the player's current loadout that appears in the item's `synergies` array. Items with 0 tickets are excluded from the pool.

### 14.2 Draw Behavior

Items are drawn without replacement from the pool. Each draw removes all tickets for the drawn item, then resamples the remaining pool. The draw count is fixed per context (3 for upgrade screen, 10 for shop brands, 4 for shop chips/materials).

---

## 15. Event Bus (Trigger System)

All triggered effects in the game are routed through an `EventBus` instance (`scene.bus`). BattleScene emits events at fixed points; chips register handlers when added to the player's loadout; brands emit events when they fire.

### 15.1 Trigger Reference

| Trigger                    | When it fires                                                   |
| -------------------------- | --------------------------------------------------------------- |
| `ON_TURN_START`            | Start of PREP phase, after status decrements                    |
| `ON_TURN_END`              | After enemy acts, before next turn begins                       |
| `ON_SETTLE`                | When any player die stops moving and is added to the queue      |
| `ON_FACE`                  | When a brand fires (the face that carries it has landed)        |
| `ON_RUNE_TRIGGER`          | Same as ON_FACE — separate hook for relics to track brand fires |
| `ON_CONTACT_DIE`           | Die-to-die physical collision                                   |
| `ON_CONTACT_BUMPER_ENEMY`  | Player die strikes enemy bumper                                 |
| `ON_CONTACT_BUMPER_PLAYER` | Die strikes player bumper                                       |
| `ON_DAMAGE_DEALT`          | Damage successfully applied to enemy                            |
| `ON_DAMAGE_TAKEN`          | Damage successfully applied to player                           |
| `ON_BLOCK_GAINED`          | Player gains any amount of block                                |
| `ON_STATUS_APPLIED`        | A status is applied to any target                               |
| `ON_DIE_DESTROYED`         | A player die is removed from play by any cause                  |
| `ON_KILL`                  | Enemy HP reaches 0                                              |
| `ON_QUEUE_FIRE`            | Just before an effect queue entry resolves                      |

---

## 16. Physics

### 16.1 Dice Physics Bodies

All dice use **circular physics bodies** (radius = 20 px).

### 16.2 Velocity-Driven Animation

While a die is in motion, its displayed value cycles randomly. Interval driven by `motion = speed + angularVelocity × 20`. A die is settled when `motion < SETTLE_VEL`.

### 16.3 Physics Constants

| Constant           | Value | Purpose                                          |
| ------------------ | ----- | ------------------------------------------------ |
| `DIE_FRICTION`     | 0.5   | Surface friction                                 |
| `DIE_FRICTION_AIR` | 0.036 | Air drag                                         |
| `DIE_BOUNCE`       | 0.75  | Restitution on die bodies                        |
| `SETTLE_VEL`       | 0.4   | px/frame threshold — below this a die is settled |
| `MAX_THROW_SPEED`  | 20    | Max throw velocity cap                           |
| Wall restitution   | 0.85  | Wall bounciness                                  |

### 16.4 Bumper Kick Formula

```
nvx = velocity.x × 0.5 + (dx / len) × BUMPER_KICK_SPEED
nvy = velocity.y × 0.5 + (dy / len) × BUMPER_KICK_SPEED
```

`BUMPER_KICK_SPEED = 9`. Result capped at `MAX_THROW_SPEED`.

---

## 17. Player Stats

| Stat      | Description                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------- |
| **HP**    | Max 30 (base). Displayed as `current / max` beside player bumper. Damage persists between fights. |
| **Block** | Resets each turn (base). Reduces incoming enemy damage at Commit. Hidden when 0.                  |
| **Gold**  | Earned 10g per battle victory. Spent at shops. Displayed only in shop scenes.                     |

---

## 18. Tutorial

An interactive tutorial battle is available from the Setup screen. It uses The Greenhorn enemy and the **Dice Slinger** class loadout (STE d6, BUF d6, PRO d6). The tutorial guides the player through 8 panels covering throwing, bumper contacts, intent, the commit phase, and the between-turn structure.

---

## 19. Platform & Input

### 19.1 Primary Platform — Mobile (iOS / Android)

- **Throwing a die:** Tap and drag from anywhere on screen. Drag direction and distance set throw angle and velocity. Release fires. Can originate on dice, bumpers, or status text without triggering tap actions — tap vs. drag disambiguated by a 14 px movement threshold.
- **Inspecting a die:** Tap any live die (on surface or in tray). Close with ✕ or the dim overlay.
- **Enemy intent detail:** Tap the enemy bumper circle to open/close the intent popup.
- **Player status detail:** Tap the player bumper to open a status popup.
- **Reordering the tray:** Drag a tray card horizontally. Cards swap at midpoint crossing.

### 19.2 Secondary Platform — Web Browser

Mouse input mirrors touch.

---

## 20. **[PLANNED]** Map and Run Structure

The full roguelike run structure is not yet implemented. The current prototype is a linear sequence of 11 battles with upgrade screens and shops between them.

**Planned structure:** A branching path map spanning multiple floors — Battle, Elite, Boss, Rest, Shop, Event nodes. Gold drops from battles; spent at shops.

---

## 21. **[PLANNED]** The Ante System

Every turn, both the player and opponent pay an ante to the house. Ante size is fixed per blind table tier:

- **Small Blind:** 10 chips/turn
- **Medium Blind:** 20 chips/turn
- **Big Blind:** 30 chips/turn

If either player's money pool falls below the current ante, they automatically bust. This creates a ticking clock that punishes passive play.

---

## 22. **[PLANNED]** Blind Table System

After each fight the player chooses their next table (replaces current linear sequence):

| Table        | Difficulty | Ante/turn | Reward   |
| ------------ | ---------- | --------- | -------- |
| Small Blind  | Easy       | 10 chips  | Low      |
| Medium Blind | Standard   | 20 chips  | Standard |
| Big Blind    | Tough      | 30 chips  | High     |

---

## 23. Tone and Aesthetic Direction

- **Visual style:** Minimalist dark UI with glowing dice. Dice are the visual centerpiece.
- **Setting:** Western gambling championship. Every opponent is a cheater. The Devil runs the event.
- **Tone:** Wry, self-aware, darkly comic.
- **Audio:** [PLANNED] Physically satisfying dice crack on impact.
- **Camera:** Static portrait view. [PLANNED] Subtle screen shake on heavy impacts.

---

## 24. Design Decisions Log

### 24.1 Resolved Decisions

| Question                          | Decision                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Throw mechanic**                | Tap and drag from anywhere; 14 px threshold separates tap from throw. Drag can start on top of dice or bumpers without triggering their tap actions.                           |
| **Die face model**                | TYPE determines effect; NUMBER scales it. Faces are paired: d6 shows [1,1,2,2,3,3]. Tighter value ranges make upgrades feel meaningful.                                        |
| **One die at a time**             | Only one player die on the surface at once (plus obstacle dice). Reduces ambiguity and keeps the queue readable.                                                               |
| **Effect queue**                  | Player die effects queue on settle and fire sequentially. Queue pauses if any die starts moving.                                                                               |
| **Enemy block casting delay**     | Block intent stores as pending block — activates at the start of the next turn. Player can attack freely on a block turn; faces the shield on the attack turn.                 |
| **HP persistence between fights** | Player HP does not reset between battles. Damage is permanent until healed at the upgrade screen or via chips/brands. Creates tension in longer runs.                          |
| **Upgrade screen = brands only**  | The upgrade screen offers only 3 brands drawn via Lottery System. Materials, relics, and cull are exclusively shop services. Cleaner separation of concerns.                   |
| **Shop every 3 battles**          | After battles 3, 6, 9, etc., the upgrade screen routes to a shop visit instead of directly to the next battle.                                                                 |
| **Shop choice**                   | 2 of 3 shops are shown at random each visit. Player picks one or skips. Shops re-randomise each visit.                                                                         |
| **Cull cost escalation**          | Base 10g, +5g per prior paid cull in the run (`cullCount`). Balances the power of value concentration against gold economy.                                                    |
| **Witch rune inventory**          | Brands removed at the Witch persist in `witchRunes` across visits, creating a cross-run inventory management layer.                                                            |
| **Brand trigger architecture**    | All brand effects are registered in `RUNE_HANDLERS` (RuneRegistry.js) and called from `_applyRuneEffect`. Chain Reaction Brand is the only exception — fires ON_DIE_DESTROYED. |
| **Temp tray dice**                | Speed Loader, Frenzy Brand, Shrapnel Vest spawn temp dice into the tray with `_temp: true`. They are cleaned up in `_resetTray()` at the start of the next turn.               |
| **Buff die design**               | The Pierce die was redesigned as the Buff (BUF) die: adds its rolled value to `cleanBonus`, a flat bonus applied to all other dice that turn. Does not directly deal damage.   |
| **Copy die default**              | If a Copy die never physically touches another player die, it deals 1 weak steal rather than doing nothing.                                                                    |
| **Physics body shape**            | Circular, not square. Square bodies caused excessive energy loss at wall contacts.                                                                                             |
| **Enemy intent → enemy dice**     | Replaced the static weighted-intent system with fully physical enemy dice. Enemy dice land on the table at turn start; the player can physically nudge them before COMMIT.      |

### 24.2 Open Questions

1. **Block carry-over** — Should player block carry over if the enemy deals no damage? Currently resets to 0 regardless.
2. **Double Down cancellation** — Double Down Brand should cancel the die's base effect on minimum face, but the base effect fires before the brand. Requires pre-effect architecture change to implement properly.
3. **Reroll token refresh** — Once per battle vs. once per turn? Currently once per battle.
4. **Copy die and brands** — If a Copy die mimics Steal, does the Copy die's own brand still check its face index? Currently yes.
5. **House Cut governor** — Lexicon notes this may be HP-positive in short fights. Needs playtesting.
6. **Obstacle object variety** — Each opponent should have unique obstacle objects per the western theme. Currently all obstacles are generic dice.
7. **Enemy die upgrade potential** — Enemy dice use the same architecture as player dice. Should harder enemies have brands or materials on their dice? No mechanic planned yet.
8. **Enemy bumper damage guard** — Enemy combat dice hitting their own bumper no longer deal chip damage to the enemy (guarded by `isPlayer` check). Was this the right call?
9. **Player agency vs. randomness** — Enemy dice values are random on each throw. Should players be able to see the range (die size) in the web view? Currently only the current face and type are shown.
