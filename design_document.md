# Dicemore — Game Design Document

**Version:** 0.7 (Prototype — Reflects Built State)
**Genre:** Roguelike Dice-Builder

> Sections marked **[PLANNED]** describe intended future design not yet implemented in the prototype. All other sections describe mechanics that are built and working.

---

## 1. Concept Overview

Dicemore is a roguelike dice-building game in which players collect, upgrade, and manipulate a set of custom dice rather than a deck of cards. Each die has a **type** that determines its effect — attack, block, pierce, or copy — and its rolled number scales that effect. Players can modify die types, upgrade sides, and attach runes and materials between battles. Combat is resolved by physically rolling dice across a 2D play surface, where two physics bumpers (the player character and the enemy character) act as pinball-style obstacles. Player dice queue their effects and fire sequentially once all dice have settled, making every throw deliberate and readable. Enemies roll their own dice at the start of each turn and those results are held until the player ends their turn.

---

## 2. Core Fantasy

The player is an adventurer whose power comes from fate itself — the ability to shape, throw, and redirect chance. A master of the dice doesn't just accept what they roll; they aim their throws, bank dice off bumpers, and navigate the physics of the rolling surface to push dice toward favorable outcomes. When the enemy rolls their own dice from across the board, the master reads the momentum and decides how to respond — land a heavy strike, build block, or pick up a bad roll and try again.

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
- **Footer:** Solid opaque strip. Contains unthrown player dice as tap/drag cards. Once all dice have been thrown and the effect queue has fully resolved, the **End Turn** button fills the footer.
- **Effect Queue Panel:** A column of cards on the left edge of the rolling surface that shows queued player die effects. Cards are always visible. The active card pulses when its effect fires, then slides off to the left.

### 3.2 Player Character

The player is represented as a **gold circle bumper** fixed at the bottom-center of the rolling surface. The player's current **HP** is displayed to the right of the bumper. The player's current **Block** is displayed to the left, hidden entirely when block is 0.

### 3.3 Enemy Character

The enemy is represented as a **colored circle bumper** in the upper half of the rolling surface. HP bar and HP counter are displayed beside the bumper. Enemy dice are spawned from the enemy bumper's position and thrown outward with random velocity.

**Enemy bumper movement:** The enemy repositions to a random location within the upper half of the surface at the start of each new turn.

### 3.4 Hand Tray (Footer)

The hand tray shows only **unthrown** player dice as cards. When a die is thrown, its card disappears and remaining cards re-center. Cards can be **drag-reordered** horizontally. The leftmost card is always the next die to be thrown. Tapping a card opens its die inspector.

Once all dice have been thrown and the effect queue is fully resolved, the **End Turn** button slides up to fill the footer.

---

## 4. Dice System

### 4.1 What a Die Is

Each player die has:

- A **type** — determines what effect it produces on settle (see 4.2).
- A **face count** (sides) — currently d6 base, upgradeable to d8, d10, d12, d20.
- A **rolled value** — a number from 1 to N (where N is the face count) that scales the effect magnitude.
- An optional **Rune** attached to a specific face index.
- An optional **Material** applied to the whole die.

There are no face tokens on player dice. The face simply shows a number. Die type is the identity; number is the scale.

Enemy dice are different: they still use face token arrays (ATK, BLK, BUFF, blank).

### 4.2 Player Die Types

| Type       | Sym  | Color      | Effect on Settle                                                   |
| ---------- | ---- | ---------- | ------------------------------------------------------------------ |
| **Attack** | ATK  | `#ff4444`  | Deal damage equal to rolled value. Reduced by enemy block.         |
| **Block**  | BLK  | `#3498db`  | Gain block equal to rolled value.                                  |
| **Pierce** | PRC  | `#ff9900`  | Deal damage equal to rolled value. Bypasses enemy block entirely.  |
| **Copy**   | CPY  | `#cc88ff`  | Mimics the last player die type it physically touched. If it never touched another player die, deals 1 weak attack (subject to block). |

### 4.3 Sides Progression

```
d6 → d8 → d10 → d12 → d20
```

Base dice start at d6. Each upgrade step increases the maximum rolled value by that increment.

### 4.4 Starting Dice (Class-Based)

Players choose a class during setup. All preset class dice start without runes or materials.

| Class        | Dice                             |
| ------------ | -------------------------------- |
| **Fighter**  | d6 ATK, d6 BLK, d6 PRC          |
| **Magician** | d6 ATK, d6 BLK, d6 CPY          |
| **Custom**   | Player chooses count and types   |

The **Custom** path asks the player to pick how many dice (2–5) and then assign a type (ATK/BLK/PRC/CPY) to each slot.

### 4.5 Die Inspector

Tapping any live die on the rolling surface, or tapping a tray card, opens the face inspector. The inspector:

- Displays the die as an **unfolded die net** for d6 — a lowercase 't' shape:
  ```
        [ 1 ]
  [ 2 ][ 3 ][ 4 ]
        [ 5 ]
        [ 6 ]
  ```
- For dice with more than 6 sides, faces are displayed in a compact centered grid (4 columns, rows centered independently).
- Face numbers are shown in the die's type color. The active face (last rolled) is highlighted with full brightness.
- If a rune is attached to a face, that face cell has a **gold border** and a small rune symbol in the corner.
- **Pick Up** button appears at the bottom if a reroll token is available and the die is a player die on the surface. Using it returns the die to the tray.
- Throwing is disabled while the inspector is open.

### 4.6 Enemy Die Faces

Enemy dice use the original face token system (unchanged):

| Token     | Sym  | Effect                                                      | Value |
| --------- | ---- | ----------------------------------------------------------- | ----- |
| Atk 1     | ATK  | Deal damage at end of turn.                                 | 3     |
| Atk 2     | ATK  | Deal damage at end of turn.                                 | 5     |
| Atk 3     | ATK  | Deal damage at end of turn.                                 | 8     |
| Block     | BLK  | Active shield — absorbs player attack damage while showing. | 3     |
| Buff      | BUF  | Adds to enemy damage at end of turn.                        | 3     |
| Blank     | `--` | No effect.                                                  | —     |

---

## 5. Turn Structure

### 5.1 Phase Overview

Each combat turn proceeds in four phases: **PREP → ENEMY_ROLL → PLAYER_ROLL → COMMIT**.

### 5.2 Preparation (PREP)

Enemy repositions to a new random location. Player reviews their dice in the tray.

### 5.3 Enemy Roll Phase (ENEMY_ROLL)

Enemy dice are automatically spawned from the enemy bumper and thrown outward with random velocity. Each enemy die has a **400 ms grace period** on spawn during which it ignores collision with the enemy bumper. Enemy dice settle on the surface — their results are held until End Turn.

### 5.4 Player Rolling Phase (PLAYER_ROLL)

**One die at a time.** Only one player die may be on the rolling surface at once. The player cannot throw a second die until the first die's effect has fully resolved through the queue.

**Throwing:** The player drags anywhere on the rolling surface to aim from the fixed throw origin at the player bumper. Drag direction and distance set throw angle and velocity. A faint aim line shows the projected direction. Release fires the die.

**Effect queue:** When a player die settles, its effect is added to the **effect queue** rather than firing immediately. Once all dice (player and enemy) have settled, the queue begins processing automatically:

1. The queued card pulses on-screen to signal firing.
2. The die's effect executes (damage, block, etc.).
3. After a brief hold, the card slides off to the left and is destroyed.
4. The next card in the queue fires, and so on.
5. When the queue is empty, `_throwLocked` is released and the player can throw their next die.

If a rune effect causes dice to start moving (Greek, Cosmic, Egyptian), the queue **pauses** until all dice re-settle. Any dice that re-settle during the pause add new entries to the queue, which then also fire in sequence.

**Bumper contacts during rolling:**

- A player die striking the **enemy bumper** → deals 1 HP damage to the enemy and rerolls.
- A player die striking the **player bumper** → grants 1 block and rerolls.

**Mid-turn victory:** If enemy HP reaches 0 during the rolling phase, the battle ends immediately.

**Reroll Token (1 per battle):** Lets the player pick up one settled die from the surface and throw it again. Accessible via the die inspector. Cannot be used while the queue is active or a die is in-flight.

**End Turn button:** Appears once all dice are thrown and the effect queue is empty.

### 5.5 Commit Phase (COMMIT)

Enemy dice on the surface are read:

- Enemy damage dice total their values. Buff dice add to the total.
- Total enemy damage is reduced by player's accumulated block. Remainder is applied to player HP.
- Block resets to 0.
- All dice cleared from the surface.
- If player HP reaches 0 → game over. Otherwise next turn begins.

---

## 6. Effect Queue Visual

Queue cards appear in a vertical column on the left side of the rolling surface, one below the other. Each card:

- Mirrors the die that produced it: same type color border, type symbol (ATK/BLK/etc.), and rolled value.
- Shows a small rune symbol in the corner if a rune triggered on that settle.
- Remains visible (fully on-screen) while waiting.
- Pulses (scale bounce) when it is the active firing card.
- Slides off to the left and fades out after firing.
- Remaining cards slide up to fill the gap.

---

## 7. Enemy Block Mechanic

While an enemy die is showing a `BLK` face and is settled on the surface, it acts as an **active per-hit shield**:

- Each Attack die's damage is reduced by the sum of all active `BLK` values from settled enemy dice.
- Pierce bypasses this shield entirely.
- The shield is active as long as the die remains settled on that face. A radiating blue pulse animation plays while active.

---

## 8. Upgrade Screen

After each battle victory the player enters the Upgrade Screen. Three random upgrade options are presented as cards. The player picks one, or skips.

### 8.1 Upgrade Pool (per die in player's pool)

| Type            | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| **Upgrade Sides** | Advance one die to the next tier: d6→d8→d10→d12→d20.                  |
| **Add Rune**    | Add a random rune to a specific face of a die that has no rune yet.      |
| **Swap Rune**   | Replace an existing rune with a different random rune on a random face.  |
| **Add Material**  | Apply a random material to a die that has no material yet.             |
| **Swap Material** | Replace an existing material with a different random material.         |

Plus one additional option drawn from the global pool:

| Type       | Description                                        |
| ---------- | -------------------------------------------------- |
| **Add Die** | Add a new d6 of a random type to the player's bag. |

All options are shuffled and only 3 are shown per upgrade screen. The player's current HP carries over into the next battle.

### 8.2 Between-Battle Flow

**Grunt → Upgrade → Soldier → Upgrade → Captain**

After defeating the Captain the run ends.

**[PLANNED]** Full roguelike map structure (branching paths, multiple floors, event nodes, rest nodes, shop nodes) is a future feature.

---

## 9. Runes & Materials

Each player die can carry at most **one Rune** and at most **one Material**. Both are optionally assigned in the SetupScene before the first battle, and can be changed or added via the Upgrade Screen.

### 9.1 Runes

A Rune attaches to a **specific face index** of a die. It triggers only when the die settles on that face index.

| Rune         | Symbol | Effect                                                                              |
| ------------ | ------ | ----------------------------------------------------------------------------------- |
| **Viking**   | VIK    | This face triggers twice.                                                           |
| **Egyptian** | EGY    | Triggers the face effect, then the die immediately rerolls with a random velocity.  |
| **Trojan**   | TRJ    | Triggers this face, then also triggers the numerically opposite face index.         |
| **Greek**    | GRK    | Blasts all other dice away from this die (radial velocity kick).                    |
| **Cosmic**   | COS    | Pulls all other dice inward toward this die.                                        |

**Trojan opposite-face formula:** `oppositeIdx = (sides - 1) - currentIdx`. Works for any die size.

**Runes that cause movement (Greek, Cosmic, Egyptian) pause the effect queue** until all dice re-settle.

### 9.2 Materials

A Material modifies all effects from that die, regardless of which face is active.

| Material    | Symbol | Effect                                                                     |
| ----------- | ------ | -------------------------------------------------------------------------- |
| **Iron**    | IRN    | +1 to all numeric effect values.                                           |
| **Steel**   | STL    | ×2 to all numeric effect values.                                           |
| **Glass**   | GLS    | Shatters on first die-to-die contact, destroying both dice involved.       |
| **Uranium** | URA    | Any die this one contacts has its values halved for the rest of the turn.  |
| **Fire**    | FIR    | +3 to all damage values specifically.                                      |
| **Rock**    | ROK    | All damage from this die ignores enemy block.                              |

**Value modifier order:** Iron (+1) → Steel (×2) → Fire (+3, damage only) → Uranium halving (if debuffed).

### 9.3 Setup Flow (Rune & Material Assignment)

In SetupScene, after choosing a class and dice configuration, the player enters the rune/material step. Each die is shown as a row with two slots:

- **Rune slot** — tap to open the rune picker. After selecting a rune, a face picker (T-net for d6, grid for others) opens to assign the rune to a specific face. Face numbers shown in the die's type color.
- **Material slot** — tap to open the material picker. Tap the same material again to remove it.

Both slots are optional for all dice. Preset class dice start with no runes or materials.

---

## 10. Enemies

### 10.1 Enemy Sequence (Prototype)

| Enemy       | Tier     | HP  | Dice | Color     |
| ----------- | -------- | --- | ---- | --------- |
| **Grunt**   | Minion   | 14  | 1    | `#e74c3c` |
| **Soldier** | Standard | 22  | 2    | `#c0392b` |
| **Captain** | Elite    | 30  | 3    | `#922b21` |

### 10.2 Enemy Dice Configurations

**Grunt (1 die):**
```
e_atk1, e_atk1, e_atk2, e_blank, e_blank, e_blk
```

**Soldier (2 dice):**
```
Die 1: e_atk1, e_atk2, e_atk2, e_blk,  e_blank, e_buff
Die 2: e_atk1, e_atk1, e_blank, e_blank, e_blk,  e_blk
```

**Captain (3 dice):**
```
Die 1: e_atk2, e_atk2, e_atk3, e_blk,  e_buff,  e_blank
Die 2: e_atk1, e_atk2, e_atk2, e_blk,  e_blk,   e_blank
Die 3: e_atk1, e_atk1, e_atk2, e_blank, e_blank, e_blk
```

### 10.3 Enemy Bumper Behavior

Any die that strikes the enemy bumper is deflected with an additive velocity kick and rerolled. When a **player die** strikes the enemy bumper, the enemy also takes 1 HP damage.

**[PLANNED]** Multiple simultaneous enemies, enemy line positioning, and enemy intent previews are future features.

---

## 11. Physics

### 11.1 Dice Physics Bodies

All dice use **circular physics bodies** (radius = 20 px). This ensures corner-catching energy loss does not occur on wall bounces.

### 11.2 Velocity-Driven Animation

While a die is in motion, its displayed value cycles randomly. The cycle interval is driven by current speed and angular velocity:

```
motion = speed + angularVelocity * 20
interval = max(40ms, 250ms / motion)
```

A die is considered settled when `motion < SETTLE_VEL`.

### 11.3 Physics Constants

| Constant           | Value | Purpose                                            |
| ------------------ | ----- | -------------------------------------------------- |
| `DIE_FRICTION`     | 0.5   | Surface friction — generates spin on contact       |
| `DIE_FRICTION_AIR` | 0.036 | Air drag — controls velocity decay over time       |
| `DIE_BOUNCE`       | 0.75  | Restitution on die bodies                          |
| `SETTLE_VEL`       | 0.4   | px/frame threshold — below this a die is settled   |
| `MAX_THROW_SPEED`  | 20    | Max throw velocity cap                             |
| Wall restitution   | 0.85  | Wall bounciness                                    |
| Wall friction      | 0.0   | Walls have no friction                             |

### 11.4 Bumper Kick Formula

```
nvx = velocity.x * 0.5 + (dx / len) * BUMPER_KICK_SPEED
nvy = velocity.y * 0.5 + (dy / len) * BUMPER_KICK_SPEED
```

`dx/dy` is the outward direction from bumper center to die center. `BUMPER_KICK_SPEED = 9`. Result capped at `MAX_THROW_SPEED`.

### 11.5 Spawn Grace Periods

- **Player dice:** ignore the player bumper for 400 ms after being thrown.
- **Enemy dice:** ignore the enemy bumper for 400 ms after being spawned.

---

## 12. Player Stats

| Stat             | Description                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **HP**           | Max 30. Reaching 0 ends the run. Displayed to the right of the player bumper.                                                    |
| **Block**        | Resets each turn. Reduces incoming enemy damage at End Turn. Hidden when 0. Accumulated via Block dice and bumper contacts.       |
| **Reroll Token** | 1 per battle. Lets the player pick up one settled die and rethrow it. Cannot be used while queue is active or die is in-flight.  |

**[PLANNED]** Gold, relics are future features.

---

## 13. Design Decisions Log

### 13.1 Resolved Decisions

| Question                         | Decision                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Throw mechanic**               | Slingshot-style. Drag anywhere on the surface; aim line originates from the player bumper in the opposite direction of drag. Release fires. Minimum drag of ~20 px required to prevent accidental throws.                                                                                                               |
| **Die face model**               | Die TYPE determines effect; die NUMBER scales it. Removed per-face action tokens on player dice. Faces are just numbers 1–N. Simpler to understand, easier to upgrade, cleaner progression.                                                                                                                            |
| **One die at a time**            | Only one player die can be on the surface at once. Reduces ambiguity, makes the effect queue readable, and makes individual throws feel more deliberate.                                                                                                                                                                |
| **Effect queue**                 | Player die effects are queued and fired sequentially after all dice settle (including enemy dice), rather than firing immediately on settle. Makes the connection between throw and outcome legible. Queue pauses if any die starts moving (rune effects).                                                               |
| **Player die resolution timing** | Player dice queue effects on settle; queue fires after all dice are still. Enemy dice still defer to End Turn. Encourages real-time engagement with each throw while keeping the outcome readable.                                                                                                                       |
| **Cascade on re-knock**          | If a settled die is knocked back into motion, it re-applies its face effect when it re-settles (adds a new queue entry). Creates emergent chain reactions.                                                                                                                                                              |
| **Enemy block design**           | Enemy `BLK` acts as an active per-attack shield while the die is settled on that face. Pierce bypasses it entirely.                                                                                                                                                                                                     |
| **Mid-turn victory**             | If enemy HP hits 0 during the rolling phase, the battle ends immediately.                                                                                                                                                                                                                                               |
| **Trojan rune opposite face**    | Uses formula `(sides - 1) - idx` rather than a lookup table. Works for any die size.                                                                                                                                                                                                                                   |
| **Copy die default**             | If a Copy die never physically touches another player die, it deals 1 weak attack (subject to block) rather than doing nothing. Gives the die a floor of usefulness.                                                                                                                                                   |
| **Base die size**                | d6. Starting dice are clean d6s with no runes or materials regardless of class.                                                                                                                                                                                                                                         |
| **Upgrade screen**               | 3 random options per upgrade screen (shuffled from per-die pool + add-die option). Player picks one or skips. Removes the face-by-face replacement screen entirely; upgrades now modify die properties (sides, rune, material) rather than individual faces.                                                           |
| **Physics body shape**           | Circular, not square. Square bodies caused excessive energy loss at wall contacts.                                                                                                                                                                                                                                      |
| **Hot zones**                    | Removed. The Forge / Bastion / Nullfield zones were tested and cut — added visual noise without meaningful decision-making.                                                                                                                                                                                              |

### 13.2 Open Questions

1. **Block carry-over** — Should block carry over into the next turn if the enemy deals no damage? Currently resets to 0 regardless.

2. **Enemy bumper damage on enemy die contact** — Currently only player dice deal damage on enemy bumper contact. Should enemy dice deal damage when hitting the player bumper?

3. **Reroll token refresh** — Once per battle vs. once per turn?

4. **Copy die and runes** — If a Copy die mimics an Attack die, does the Copy die's rune still use the Copy die's own face index to check for trigger? Currently yes.

5. **Queue card count cap** — No limit on how many cards can stack in the queue (e.g. many Egyptian re-settles). Should there be a visual cap?

---

## 14. Platform & Input

### 14.1 Primary Platform — Mobile (iOS / Android)

**Throwing a die:** Touch and hold anywhere on the rolling surface. Drag away from the touch point — aim line appears in the opposite direction. Release to launch. Disabled while inspector is open or queue is active.

**Inspecting a die:** Tap any live die on the surface or any tray card. Close with ✕ or the dim overlay.

**Reordering the tray:** Drag a tray card horizontally. Cards swap at midpoint crossing.

### 14.2 Secondary Platform — Web Browser

Mouse input mirrors touch: click-and-drag to aim and throw, click to inspect.

**[PLANNED]** Keyboard shortcuts and landscape layout are future additions.

---

## 15. **[PLANNED]** Map and Run Structure

The full roguelike run structure is not yet implemented. The current prototype is a linear sequence of three battles (Grunt → Soldier → Captain).

**Planned structure:** A branching path map spanning 3 floors plus a final boss. Node types: Battle, Elite, Boss, Rest, Shop, Event. Gold drops from battles; gold spent at shops.

---

## 16. Tone and Aesthetic Direction

- **Visual style:** Minimalist dark UI with glowing dice. Dice are the visual centerpiece — warm gold for player, dark crimson for enemies.
- **Tone:** Dark fantasy adjacent but not grim. Wry and self-aware.
- **Audio:** [PLANNED] Physically satisfying dice crack on impact. Bumper flash on contact is the current visual feedback cue.
- **Camera:** Static portrait view. [PLANNED] Subtle screen shake on heavy impacts.
