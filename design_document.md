# Dicemore — Game Design Document

**Version:** 1.0 (Prototype — Reflects Built State)
**Genre:** Roguelike Dice-Builder

> Sections marked **[PLANNED]** describe intended future design not yet implemented in the prototype. All other sections describe mechanics that are built and working.

---

## 1. Concept Overview

Dicemore is a roguelike dice-building game in which players collect, upgrade, and manipulate a set of custom dice rather than a deck of cards. Each die has a **type** that determines its effect — attack, block, pierce, copy, or special — and its rolled value scales that effect. Players can modify die types, upgrade sides, attach runes, and apply materials between battles. Combat is resolved by physically throwing dice across a 2D play surface using tap-and-drag, where two physics bumpers (the player character and the enemy) act as pinball-style obstacles. Player dice queue their effects and fire sequentially once they settle. Enemies reveal their intent at the start of each turn — a preview of what they plan to do — and the player must decide how to respond.

---

## 2. Core Fantasy

The player is an adventurer whose power comes from fate itself — the ability to shape, throw, and redirect chance. A master of the dice doesn't just accept what they roll; they aim their throws, bank dice off bumpers, and navigate the physics of the rolling surface to push dice toward favorable outcomes. When the enemy reveals their intent, the master reads it and decides how to respond — land a heavy strike before their block activates, build defense against an incoming attack, or chain dice collisions for reroll bonuses.

---

## 3. Visual Layout

### 3.1 Screen Structure

The game is designed portrait-first. The screen is **400 × 700 px** and divided into three zones:

```
┌────────────────────────┐  ← y=0
│  Phase · Message · RT  │  ← minimal header (~80px)
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

- **Header:** Phase label, battle message, reroll token count.
- **Rolling Surface:** Full physics space. Both the player bumper (bottom-center) and the enemy bumper (upper half) live here.
- **Footer:** Solid opaque strip. Contains unthrown player dice as tap/drag cards. Once all dice have been thrown and the effect queue has fully resolved, the **Commit** button fills the footer.
- **Effect Queue Panel:** A column of cards on the left edge of the rolling surface that shows queued player die effects. Cards are always visible. The active card pulses when its effect fires, then slides off to the left.

### 3.2 Player Character

The player is represented as a **gold circle bumper** fixed at the bottom-center of the rolling surface. The player's current **HP** is displayed to the right of the bumper. The player's current **Block** is displayed to the left, hidden entirely when block is 0.

### 3.3 Enemy Character

The enemy is represented as a **colored circle bumper** in the upper half of the rolling surface. The enemy's current HP and intent symbol are displayed within/beside the bumper. Tapping the enemy bumper opens a popup with a full description of the current intent.

**Enemy bumper movement:** The enemy repositions to a random location within the upper half of the surface at the start of each new turn.

### 3.4 Hand Tray (Footer)

The hand tray shows only **unthrown** player dice as cards. When a die is thrown, its card disappears and remaining cards re-center. Cards can be **drag-reordered** horizontally. Tapping a card opens its die inspector.

Once all dice have been thrown and the effect queue is fully resolved, the **Commit** button appears.

---

## 4. Dice System

### 4.1 What a Die Is

Each player die has:

- A **type** — determines what effect it produces on settle (see 4.2).
- A **face count** (sides) — d6 base, upgradeable to d8, d10, d12, d20.
- A **rolled value** — displayed as `floor(faceIndex / 2) + 1`. Pairs of physical faces share the same displayed value: d6 shows [1, 1, 2, 2, 3, 3]. d8 shows [1, 1, 2, 2, 3, 3, 4, 4].
- An optional **Rune** attached to a specific face index.
- An optional **Material** applied to the whole die.
- A **culledFaces** list — face slot indices that have been permanently removed via the Cull upgrade.

### 4.2 Player Die Types

| Type       | Sym | Color     | Effect on Settle                                                                                                    |
| ---------- | --- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| **Attack** | ATK | `#ff4444` | Deal damage equal to rolled value. Reduced by enemy block.                                                          |
| **Block**  | BLK | `#3498db` | Gain block equal to rolled value.                                                                                   |
| **Pierce** | PRC | `#ff9900` | Deal damage equal to rolled value. Bypasses enemy block entirely.                                                   |
| **Copy**   | CPY | `#cc88ff` | Mimics the last player die type it physically touched. If it never touched another player die, deals 1 weak attack. |
| **Leech**  | LCH | `#aa44ff` | Deals piercing damage and heals the player for every point drained. Available as a boss reward or via the Custom builder. |
| **Poison** | PSN | `#58d68d` | Stacks poison on the enemy — they take damage each turn and it decays slowly. Available as a boss reward or via the Custom builder. |
| **Hex**    | HEX | `#9b59b6` | Curses the enemy this turn, halving all damage they deal when they commit. Available as a boss reward or via the Custom builder. |
| **Bomb**   | BOM | `#ff6622` | Deals double damage — but the explosion recoils back onto the player. Available as a boss reward or via the Custom builder. |

### 4.3 Sides Progression

```
d6 → d8 → d10 → d12 → d20
```

Base dice start at d6. Because face values are halved-and-paired, the effective value range is:

| Sides | Value range |
| ----- | ----------- |
| d6    | 1 – 3       |
| d8    | 1 – 4       |
| d10   | 1 – 5       |
| d12   | 1 – 6       |
| d20   | 1 – 10      |

### 4.4 Starting Dice (Class-Based)

Players choose a class during setup. All preset class dice start without runes or materials.

| Class         | Dice                               | Starting Relic       | Notes                        |
| ------------- | ---------------------------------- | -------------------- | ---------------------------- |
| **Fighter**   | d6 ATK, d6 BLK, d6 PRC             | Player's choice      |                              |
| **Magician**  | d6 ATK, d6 BLK, d6 CPY             | Player's choice      |                              |
| **Alchemist** | d6 ATK, d6 BLK, d4 PSN             | Player's choice      | Poison die starts at d4      |
| **Brute**     | d6 ATK, d6 BLK                     | Spiked Bumper (auto) | Skips relic selection screen |
| **Custom**    | Player picks count (2–5) and types | Player's choice      |                              |

### 4.5 Die Inspector

Tapping any live die on the rolling surface, or tapping a tray card, opens the face inspector. The inspector:

- Displays the die as an **unfolded die net** for d6 — a lowercase 't' shape. For dice with more than 6 sides, faces are displayed in a compact centered grid (4 columns).
- Face values are displayed as `floor(faceIndex / 2) + 1` in the die's type color. The active face is highlighted.
- If a rune is attached to a face, that face cell has a **gold border** and a small rune symbol.
- **Pick Up** button appears at the bottom if a reroll token is available and the die is live on the surface.
- Throwing is disabled while the inspector is open.

### 4.6 Bumper Contacts

- A player die striking the **enemy bumper** → deals 1 HP damage to the enemy and rerolls the die.
- A player die striking the **player bumper** → grants 1 block and rerolls the die.
- These effects apply in addition to the die's normal queued effect on settle.

---

## 5. Turn Structure

### 5.1 Phase Overview

Each combat turn proceeds in four phases: **PREP → ENEMY_ROLL → PLAYER_ROLL → COMMIT**.

### 5.2 Preparation (PREP)

Enemy repositions to a new random location. Player status effects tick down (Frail, Vulnerable each decrease by 1). Player block and enemy block reset (but see §7 for pending enemy block).

### 5.3 Enemy Roll Phase (ENEMY_ROLL)

1. Enemy poison ticks (if any stacks are active): enemy takes damage equal to stack count, then stack count decreases by 1.
2. The enemy draws their **intent** for this turn from a weighted pool.
3. If the intent contains a **block** component, that value is stored as _pending_ and will activate at the start of the _next_ turn (see §7).
4. **Obstacle dice** — a number of blank physics dice (equal to `obstacleCount` for this enemy) are thrown into the rolling surface as obstacles. They have no effect on settle, but physically block and redirect player dice.

### 5.4 Player Rolling Phase (PLAYER_ROLL)

**Throwing:** The player taps and drags from anywhere on the screen to aim, then releases to throw. Drag direction and distance set throw angle and velocity. A faint aim line shows the projected direction.

**One die at a time.** The player cannot throw a second die until the first die's effect has fully resolved through the queue.

**Tap vs. drag distinction:** Input is only registered as a throw (or a bumper tap) if the pointer travels more than 14 px from its down position. Shorter movements are treated as taps — opening the inspector (on a die card) or toggling the intent popup (on the enemy bumper).

**Effect queue:** When a player die settles, its effect is added to the **effect queue** rather than firing immediately. Once all dice settle, the queue processes automatically:

1. The queued card pulses on-screen.
2. The effect executes (damage, block, etc.).
3. The card slides off to the left and is destroyed.
4. The next card fires, and so on.
5. When the queue is empty, `_throwLocked` is released and the player can throw their next die.

If a rune effect causes dice to start moving (Greek, Cosmic, Egyptian), the queue **pauses** until all dice re-settle.

**Mid-turn victory:** If enemy HP reaches 0 during the rolling phase, the battle ends immediately.

**Reroll Token (1 per battle):** Lets the player pick up one settled die from the surface and throw it again. Accessible via the die inspector.

**Commit button:** Appears once all dice are thrown and the effect queue is empty.

### 5.5 Commit Phase (COMMIT)

Enemy acts on their intent:

- **Attack:** deals damage to the player, reduced by current player block. Frail reduces player block effectiveness by 25%. Vulnerable increases player damage taken by 25%.
- **Block:** (see §7 — pending block activates next turn, not now).
- **Strength:** adds permanently to enemy's attack damage for the rest of the battle.
- **Vulnerable / Frail:** applies status to player (3-turn duration).
- **Multi:** processes a list of sub-intents in order.

Block resets to 0 at end of commit. All obstacle dice cleared. If player HP reaches 0 → game over. Otherwise next turn begins.

---

## 6. Effect Queue Visual

Queue cards appear in a vertical column on the left side of the rolling surface. Each card:

- Mirrors the die that produced it: type color border, type symbol (ATK/BLK/etc.), and rolled value.
- Shows a small rune symbol in the corner if a rune triggered on that settle.
- Pulses (scale bounce) when it is the active firing card.
- Slides off to the left and fades after firing. Remaining cards slide up to fill the gap.

---

## 7. Enemy Block Mechanic

Enemy block uses a **one-turn delay** ("casting" model):

- When the enemy draws a **block** intent, the value is stored as _pending block_ — it does **not** activate this turn.
- At the **start of the following turn** (in PREP), the pending block value becomes the active `enemyBlock`.
- While active, enemy block absorbs player Attack damage per hit. Pierce bypasses it entirely.
- The block shield visually displays beside the enemy bumper as an arc with the remaining value.
- `enemyBlock` resets to 0 at the start of each new turn (replaced by whatever new pending block, if any, was queued).

This means: on a block turn, the player can attack the enemy freely. On the _next_ turn, when the enemy is attacking, it sits behind the block it cast last turn.

---

## 8. Enemy System

### 8.1 Intent System

At the start of each turn the enemy draws one intent from a weighted pool defined per enemy. Intent types:

| Type         | Effect                                                                       |
| ------------ | ---------------------------------------------------------------------------- |
| `attack`     | Deals `value` damage to player at commit.                                    |
| `block`      | Queues `value` block, activates next turn.                                   |
| `strength`   | Adds `value` to enemy's permanent strength (stacks, lasts the whole battle). |
| `vulnerable` | Applies Vulnerable to player for 3 turns (+25% damage taken).                |
| `frail`      | Applies Frail to player for 3 turns (−25% block effectiveness).              |
| `multi`      | Processes an array of sub-intents in sequence.                               |

The intent is displayed inside the enemy bumper and in a detail popup (tap enemy to open).

### 8.2 Enemy Roster

Enemies are fought in the following fixed sequence:

| #   | Key                | Name           | Tier     | HP  | Obstacles |
| --- | ------------------ | -------------- | -------- | --- | --------- |
| —   | `training_dummy`   | Training Dummy | tutorial | 10  | 0         |
| 1   | `red_louse`        | Red Louse      | minion   | 18  | 1         |
| 2   | `cultist`          | Cultist        | minion   | 16  | 1         |
| 3   | `jaw_worm`         | Jaw Worm       | minion   | 28  | 1         |
| 4   | `spike_slime`      | Spike Slime    | standard | 36  | 2         |
| 5   | `green_louse`      | Green Louse    | standard | 28  | 2         |
| 6   | `fungal_beast`     | Fungal Beast   | standard | 44  | 2         |
| 7   | `gremlin_nob`      | Gremlin Nob    | elite    | 56  | 3         |
| 8   | `lagavulin`        | Lagavulin      | elite    | 68  | 3         |
| 9   | `bronze_automaton` | Automaton      | elite    | 60  | 3         |
| 10  | `slime_lord`       | Slime Lord     | elite    | 92  | 4         |
| 11  | `hexaghost`        | Hexaghost      | boss     | 104 | 4         |

The Training Dummy is used only in the tutorial and is not part of the normal run sequence.

### 8.3 Enemy Strength

Enemy Strength stacks accumulate permanently over the course of a battle. Each Strength point adds directly to all attack damage the enemy deals for the rest of the fight.

### 8.4 Enemy Bumper Behavior

Any die that strikes the enemy bumper is deflected with an additive velocity kick and rerolled. When a **player die** strikes the enemy bumper, the enemy also takes 1 HP damage (plus any Spiked Bumper relic bonus).

---

## 9. Status Effects

| Effect         | Applies To | Duration         | Mechanic                                                                          |
| -------------- | ---------- | ---------------- | --------------------------------------------------------------------------------- |
| **Frail**      | Player     | 3 turns          | Player's block is 25% less effective.                                             |
| **Vulnerable** | Player     | 3 turns          | Player takes 25% more damage from enemy attacks.                                  |
| **Strength**   | Enemy      | Rest of battle   | Enemy attack damage permanently increased per stack.                              |
| **Poison**     | Enemy      | Decays each turn | Enemy takes damage equal to stack count per turn; count decreases by 1 each tick. |
| **Weakened**   | Enemy      | 1 turn           | Enemy deals less damage.                                                          |

Status effect durations are displayed as counters on the player status bar (e.g. `FRAIL ×2`). Tapping the player bumper opens a popup with descriptions of all active statuses.

---

## 10. Upgrade Screen

After each battle victory the player enters the Upgrade Screen. Three upgrade options are presented as cards. The player picks one, or skips.

### 10.1 Upgrade Pool

| Type              | Description                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Add Rune**      | Add a rune to a specific face of a chosen die. Face is picked on a second screen.                                                      |
| **Cull a Face**   | Permanently remove all faces showing a chosen value from a die. Cannot remove the last remaining value. Warns if a rune would be lost. |
| **Increase Tier** | Advance one die to the next tier: d6→d8→d10→d12→d20. (25% chance to appear, only if any die is below max tier.)                        |
| **Add Material**  | Apply a material to a chosen die.                                                                                                      |

Pool construction: one Add Rune is always included; the second slot is Add Rune or Cull (50/50); the third slot is Tier upgrade (if available, 25% chance), another Cull (if no Cull yet), or Material.

### 10.2 Boss Reward

After defeating an elite/boss enemy, the standard upgrade screen is replaced by a **Boss Reward** screen: choose one special die to add to your bag (Leech, Poison, Hex, or Bomb).

### 10.3 Between-Battle Flow

The run progresses through the BATTLE_SEQUENCE in order. Between each battle the upgrade screen appears. The run ends after defeating Hexaghost, or earlier if the player's HP reaches 0.

**[PLANNED]** Full roguelike map structure (branching paths, multiple floors, event nodes, rest nodes, shop nodes) is a future feature.

---

## 11. Relics

Players select one relic at setup (before the first battle). Brute skips selection and always starts with Spiked Bumper.

### 11.1 Relic List

| Name                | Rarity   | Trigger         | Effect                                                               |
| ------------------- | -------- | --------------- | -------------------------------------------------------------------- |
| Burning Blood       | common   | ON_KILL         | Heal 4 HP when you defeat an enemy.                                  |
| Anchor              | common   | START_TURN      | Start each turn with 3 Block.                                        |
| Molten Egg          | common   | PASSIVE         | All attacks deal +2 damage.                                          |
| Happy Flower        | common   | ON_SETTLE       | Heal 1 HP each time any die settles.                                 |
| Dead Branch         | common   | ON_ATTACK_HIT   | Apply 1 Poison when an attack lands.                                 |
| Meditation Stone    | common   | START_TURN      | Heal 1 HP at the start of each turn.                                 |
| Philosopher's Stone | uncommon | ON_BLOCK        | Heal 2 HP when a block die activates.                                |
| Thorned Armor       | uncommon | ON_DAMAGE_TAKEN | Deal 3 damage to the enemy when you take damage.                     |
| Orichalcum          | uncommon | PASSIVE         | All Block amounts are doubled.                                       |
| War Paint           | uncommon | PASSIVE         | All attacks deal +4 damage.                                          |
| Stone Calendar      | uncommon | START_TURN      | Start each turn with 5 Block.                                        |
| Mango               | uncommon | ON_ATTACK_HIT   | Apply 2 Poison when an attack lands.                                 |
| Booming Shield      | uncommon | PASSIVE         | All Block dice gain +3.                                              |
| Giant's Belt        | uncommon | PASSIVE         | Maximum HP +8. Heal 8 HP immediately.                                |
| Steady Hand         | uncommon | PASSIVE         | Any die that lands without hitting anything adds +4 to its effect.   |
| Vampiric Blade      | rare     | ON_ATTACK_HIT   | Heal for 25% of attack damage dealt.                                 |
| Cursed Tome         | rare     | PASSIVE         | All attacks deal 1.5× damage.                                        |
| Piercing Lance      | rare     | PASSIVE         | All attacks ignore enemy block.                                      |
| Spiked Bumper       | rare     | ON_HIT_BUMPER   | When a die hits the enemy bumper, deal its max face value as damage. |
| Vulnerable Heart    | boss     | PASSIVE         | The enemy always takes 50% more damage.                              |

Relics are loaded from a Google Sheets CSV at startup if a URL is configured; otherwise the fallback list above is used.

---

## 12. Runes & Materials

Each player die can carry at most **one Rune** and at most **one Material**.

### 12.1 Runes

A Rune attaches to a **specific face index** of a die. It triggers only when the die settles on that face.

| Rune         | Symbol | Effect                                                                             |
| ------------ | ------ | ---------------------------------------------------------------------------------- |
| **Viking**   | VIK    | This face triggers twice.                                                          |
| **Egyptian** | EGY    | Triggers the face effect, then the die immediately rerolls with a random velocity. |
| **Trojan**   | TRJ    | Triggers this face, then also triggers the numerically opposite face index.        |
| **Greek**    | GRK    | Blasts all other dice away from this die (radial velocity kick).                   |
| **Cosmic**   | COS    | Pulls all other dice inward toward this die.                                       |

**Trojan opposite-face formula:** `oppositeIdx = (sides - 1) - currentIdx`.

**Runes that cause movement (Greek, Cosmic, Egyptian) pause the effect queue** until all dice re-settle.

### 12.2 Materials

A Material modifies all effects from that die regardless of which face is active.

| Material    | Symbol | Effect                                                                    |
| ----------- | ------ | ------------------------------------------------------------------------- |
| **Iron**    | IRN    | +1 to all numeric effect values.                                          |
| **Steel**   | STL    | ×2 to all numeric effect values.                                          |
| **Glass**   | GLS    | Shatters on first die-to-die contact, destroying both dice involved.      |
| **Uranium** | URA    | Any die this one contacts has its values halved for the rest of the turn. |
| **Fire**    | FIR    | +3 to all damage values specifically.                                     |
| **Rock**    | ROK    | All damage from this die ignores enemy block.                             |

**Value modifier order:** Iron (+1) → Steel (×2) → Fire (+3, damage only) → Uranium halving (if debuffed).

---

## 13. Physics

### 13.1 Dice Physics Bodies

All dice use **circular physics bodies** (radius = 20 px). This ensures corner-catching energy loss does not occur on wall bounces.

### 13.2 Velocity-Driven Animation

While a die is in motion, its displayed value cycles randomly. The cycle interval is driven by current speed and angular velocity:

```
motion   = speed + angularVelocity × 20
interval = max(40 ms, 250 ms / motion)
```

A die is considered settled when `motion < SETTLE_VEL`.

### 13.3 Physics Constants

| Constant           | Value | Purpose                                          |
| ------------------ | ----- | ------------------------------------------------ |
| `DIE_FRICTION`     | 0.5   | Surface friction — generates spin on contact     |
| `DIE_FRICTION_AIR` | 0.036 | Air drag — controls velocity decay over time     |
| `DIE_BOUNCE`       | 0.75  | Restitution on die bodies                        |
| `SETTLE_VEL`       | 0.4   | px/frame threshold — below this a die is settled |
| `MAX_THROW_SPEED`  | 20    | Max throw velocity cap                           |
| Wall restitution   | 0.85  | Wall bounciness                                  |
| Wall friction      | 0.0   | Walls have no friction                           |

### 13.4 Bumper Kick Formula

```
nvx = velocity.x × 0.5 + (dx / len) × BUMPER_KICK_SPEED
nvy = velocity.y × 0.5 + (dy / len) × BUMPER_KICK_SPEED
```

`dx/dy` is the outward direction from bumper center to die center. `BUMPER_KICK_SPEED = 9`. Result capped at `MAX_THROW_SPEED`.

### 13.5 Spawn Grace Periods

- **Player dice:** ignore the player bumper for 400 ms after being thrown.
- **Enemy (obstacle) dice:** ignore the enemy bumper for 400 ms after being spawned.

---

## 14. Player Stats

| Stat             | Description                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **HP**           | Max 30 (base; Giant's Belt relic raises this). Reaching 0 ends the run. Displayed to the right of the player bumper.             |
| **Block**        | Resets each turn. Reduces incoming enemy damage at Commit. Hidden when 0. Accumulated via Block dice and player bumper contacts. |
| **Reroll Token** | 1 per battle. Lets the player pick up one settled die and rethrow it. Cannot be used while queue is active or die is in-flight.  |

---

## 15. Tutorial

An interactive tutorial battle is available from the Setup screen. It uses the Training Dummy enemy and guides the player through 8 panels:

0. Welcome — overview of the game goal.
1. Your Enemy — the HP arc and enemy bumper explained.
2. Enemy Intent — introduces the intent symbol; gates until the player taps the enemy to open the detail popup, then dismisses it.
3. Throwing Dice — explains tap-and-drag throwing; auto-advances to step 4.
4. Rerolls — explains die-on-die collision reroll mechanic; unlocks throwing on dismiss.
5. Nice Throw! — fires after first die settles; explains ATK and BLK values.
6. Commit — appears after all dice thrown and queue resolves.
7. Enemy Turn — appears when the enemy acts.
8. You've got it! — closing panel; ends tutorial mode.

On tutorial victory, the player proceeds to SetupScene. On tutorial death, the tutorial restarts.

---

## 16. Platform & Input

### 16.1 Primary Platform — Mobile (iOS / Android)

**Throwing a die:** Tap and drag from anywhere on screen. Drag direction and distance set throw angle and velocity. A faint aim line appears. Release fires the die. Disabled while inspector is open or queue is active.

**Inspecting a die:** Tap any live die (on surface or in tray). Close with ✕ or the dim overlay.

**Enemy intent detail:** Tap the enemy bumper circle to open/close the intent popup.

**Player status detail:** Tap the player bumper to open a status popup describing all active effects.

**Reordering the tray:** Drag a tray card horizontally. Cards swap at midpoint crossing.

### 16.2 Secondary Platform — Web Browser

Mouse input mirrors touch: click-and-drag to aim and throw, click to inspect.

---

## 17. **[PLANNED]** Map and Run Structure

The full roguelike run structure is not yet implemented. The current prototype is a linear sequence of 11 battles with upgrades between each.

**Planned structure:** A branching path map spanning multiple floors. Node types: Battle, Elite, Boss, Rest, Shop, Event. Gold drops from battles; spent at shops.

---

## 18. Tone and Aesthetic Direction

- **Visual style:** Minimalist dark UI with glowing dice. Dice are the visual centerpiece.
- **Tone:** Dark fantasy adjacent but not grim. Wry and self-aware.
- **Audio:** [PLANNED] Physically satisfying dice crack on impact. Bumper flash on contact is the current visual feedback cue.
- **Camera:** Static portrait view. [PLANNED] Subtle screen shake on heavy impacts.

---

## 19. Design Decisions Log

### 19.1 Resolved Decisions

| Question                       | Decision                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Throw mechanic**             | Tap and drag from anywhere on screen; aim line originates from the player bumper in the drag direction. Release fires. Tap vs. drag is disambiguated by a 14 px threshold — shorter movements are always taps, never accidental throws.                        |
| **Die face model**             | Die TYPE determines effect; die NUMBER scales it. Faces are paired: d6 shows [1,1,2,2,3,3]. This halves effective value ceiling, creating tighter value ranges and making upgrades feel meaningful without runaway numbers.                                    |
| **One die at a time**          | Only one player die can be on the surface at once. Reduces ambiguity and makes the effect queue readable.                                                                                                                                                      |
| **Effect queue**               | Player die effects queue on settle and fire sequentially. Queue pauses if any die starts moving (rune effects).                                                                                                                                                |
| **Enemy intent system**        | Replaces the old die-face-token system. Each enemy has a weighted pool of intents drawn each turn. Intent is previewed to the player at the start of their turn, giving them information to respond to rather than discovering the enemy's action at end-turn. |
| **Enemy block casting delay**  | Block intent queues as pending block — activates at the start of the _next_ turn. This means the player can freely attack through the enemy on a block turn, then must deal with the shield on the attack turn.                                                |
| **Enemy strength persistence** | Strength stacks last the whole battle (not just one turn). Cultist-type enemies become increasingly dangerous over time.                                                                                                                                       |
| **Player debuff duration**     | Frail and Vulnerable last 3 turns. Long enough to be threatening; short enough to plan around.                                                                                                                                                                 |
| **Class design**               | Four preset classes (Fighter, Magician, Alchemist, Brute) plus Custom. Each class has a distinct dice loadout. Brute gets Spiked Bumper baked in and skips relic selection to maintain a focused identity.                                                     |
| **Cull upgrade**               | Culling removes all face slots sharing the same displayed value (both siblings). The last remaining value group is protected and cannot be culled. Warns if a rune would be destroyed.                                                                         |
| **Boss reward**                | Defeating an elite/boss replaces the normal upgrade screen with a choice of one special die (Leech, Poison, Hex, Bomb). These dice have unique effects unavailable through normal play.                                                                        |
| **Enemy block design**         | See "Enemy block casting delay" above.                                                                                                                                                                                                                         |
| **Mid-turn victory**           | If enemy HP hits 0 during the rolling phase, the battle ends immediately.                                                                                                                                                                                      |
| **Trojan rune opposite face**  | Uses formula `(sides - 1) - idx`. Works for any die size.                                                                                                                                                                                                      |
| **Copy die default**           | If a Copy die never physically touches another player die, it deals 1 weak attack rather than doing nothing.                                                                                                                                                   |
| **Physics body shape**         | Circular, not square. Square bodies caused excessive energy loss at wall contacts.                                                                                                                                                                             |
| **Hot zones**                  | Removed. The Forge / Bastion / Nullfield zones were tested and cut — added visual noise without meaningful decisions.                                                                                                                                          |

### 19.2 Open Questions

1. **Block carry-over** — Should player block carry over if the enemy deals no damage? Currently resets to 0 regardless.

2. **Enemy bumper on enemy dice** — Enemy dice currently do not deal damage when hitting the player bumper. Should they?

3. **Reroll token refresh** — Once per battle vs. once per turn?

4. **Copy die and runes** — If a Copy die mimics Attack, does the Copy die's own rune still check its face index for trigger? Currently yes.

5. **Queue card count cap** — No limit on how many cards can stack in the queue (e.g. many Egyptian re-settles). Should there be a visual cap?

6. **Relic mid-run rewards** — Currently relics are only obtained at setup. Should additional relics be available as run rewards (e.g. after boss kills)?
