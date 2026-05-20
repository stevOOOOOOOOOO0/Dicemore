# Dicemore — Game Design Document

**Version:** 0.4 (Prototype — Reflects Built State)
**Genre:** Roguelike Dice-Builder

> Sections marked **[PLANNED]** describe intended future design not yet implemented in the prototype. All other sections describe mechanics that are built and working.

---

## 1. Concept Overview

Dicemore is a roguelike dice-building game in which players collect, upgrade, and manipulate a set of custom dice rather than a deck of cards. Each die face is an action — attack, defend, heal — and players can modify those faces between battles. Combat is resolved by physically rolling dice across a 2D play surface, where two physics bumpers (the player character and the enemy character) act as pinball-style obstacles. Player dice resolve their effects the moment they settle, making every throw feel immediately consequential. Enemies roll their own dice at the start of each turn and those results are held until the player ends their turn.

---

## 2. Core Fantasy

The player is an adventurer whose power comes from fate itself — the ability to shape, throw, and redirect chance. A master of the dice doesn't just accept what they roll; they aim their throws, bank dice off bumpers, and navigate the physics of the rolling surface to push dice toward favorable outcomes. When the enemy rolls their own dice from across the board, the master reads the momentum and decides how to respond — land a heavy strike, build block, or pick up a bad roll and try again.

---

## 3. Visual Layout

### 3.1 Screen Structure

The game is designed portrait-first. The screen is **400 × 700 px** and divided into three zones:

```
┌────────────────────────┐  ← y=0
│  Phase · Message · RT  │  ← minimal header (80px)
├────────────────────────┤  ← y=80  (SURFACE_TOP)
│                        │
│  [Enemy bumper]  HP    │
│                        │
│    DICE ROLLING        │
│       SURFACE          │  ← physics space, 560px tall
│                        │
│  BLK  [Player bumper]  HP │
│                        │
├────────────────────────┤  ← y=640 (SURFACE_BOTTOM)
│  [D1] [D2] [D3] ···   │  ← footer / tray (60px)
└────────────────────────┘  ← y=700
```

- **Header (0–80 px):** Phase label, battle message, reroll token count.
- **Rolling Surface (80–640 px):** The full physics space. Both the player bumper (bottom-center) and the enemy bumper (upper half) live here. Dice cannot physically reach below y=640 — the footer is a solid wall.
- **Footer (640–700 px):** Solid opaque strip. Contains unthrown player dice as tap/drag cards. Once all dice have been thrown and settled, the **End Turn** button fills the footer.

### 3.2 Player Character

The player is represented as a **gold circle bumper** fixed at the bottom-center of the rolling surface (`x=200, y=605`). The player's current **HP** is displayed to the right of the bumper. The player's current **Block** is displayed to the left, and is hidden entirely when block is 0.

### 3.3 Enemy Character

The enemy is represented as a **colored circle bumper** positioned in the upper half of the rolling surface. The enemy's HP bar and HP counter are displayed beside the bumper. Enemy dice are spawned from the enemy bumper's position and thrown outward with random velocity.

**Enemy bumper movement:** The enemy repositions to a random x/y within the upper half of the surface when a new enemy is introduced. Its position is fixed for the duration of that encounter.

### 3.4 Hand Tray (Footer)

The hand tray shows only **unthrown** player dice as cards in the footer strip. When a die is thrown, its card disappears from the tray immediately and the remaining cards re-center. Cards can be **drag-reordered** by dragging horizontally — cards swap positions when the dragged card crosses the midpoint of an adjacent card. The leftmost card is always the next die to be thrown. Tapping a card opens its die inspector.

Once all dice have been thrown and settled, the **End Turn** button slides up to fill the footer.

---

## 4. Dice System

### 4.1 What a Die Is

Each die is a physical object in the rolling space with:

- A **face count** (6-sided in the current prototype).
- **Editable faces**, each containing one action token (see Section 4.2).
- A **circular physics body** (radius 20) so it bounces cleanly off walls and other dice without corner-catching energy loss.
- A **visual identity** — player dice are gold/warm-toned; enemy dice are dark crimson.

### 4.2 Face Actions

Each face holds one action token. The full set of implemented tokens:

**Player tokens:**

| Token        | Sym  | Effect                            | Value |
| ------------ | ---- | --------------------------------- | ----- |
| **Blank**    | `--` | No effect.                        | —     |
| **Strike**   | ATK  | Deal damage to the front enemy.   | 5     |
| **Strike 2** | ATK2 | Deal damage to the front enemy.   | 8     |
| **Cleave**   | CLV  | Deal damage to all enemies.       | 3     |
| **Pierce**   | PRC  | Deal damage, bypasses enemy block.| 6     |
| **Defend**   | DEF  | Gain block.                       | 2     |
| **Defend 2** | DEF2 | Gain block.                       | 4     |
| **Brace**    | BRC  | Gain block.                       | 4     |
| **Mend**     | MND  | Restore HP.                       | 4     |

**Enemy-only tokens:**

| Token     | Sym  | Effect                                             | Value |
| --------- | ---- | -------------------------------------------------- | ----- |
| **Atk 1** | ATK  | Deal damage at end of turn.                        | 3     |
| **Atk 2** | ATK  | Deal damage at end of turn.                        | 5     |
| **Atk 3** | ATK  | Deal damage at end of turn.                        | 8     |
| **Block** | BLK  | Active shield — absorbs player attack damage while showing. | 3 |
| **Buff**  | BUF  | Adds to enemy damage at end of turn.               | 3     |
| **Blank** | `--` | No effect.                                         | —     |

### 4.3 Starter Dice

The player begins each run with three d6s:

```
Die 1: Blank, Blank, Defend, Defend, Strike, Cleave
Die 2: Blank, Strike, Strike, Defend, Mend,  Cleave
Die 3: Blank, Blank, Strike, Strike, Cleave, Defend
```

### 4.4 Die Inspector

Tapping any live die on the rolling surface, or tapping any card in the hand tray, opens the face inspector. The inspector:

- Displays the die as an **unfolded die net** — a lowercase 't' shape showing all 6 faces in their net positions:
  ```
        [ top  ]
  [left][center][right]
        [lower ]
        [bottom]
  ```
- For dice with a face count other than 6, faces are displayed in a compact grid.
- **Dims the background** behind the panel while open.
- Stays open indefinitely. Close it with the **✕** button in the top-right corner, or by tapping the dim overlay.
- **Throwing dice is disabled** while the inspector is open. The player must close the panel before the game will register a new throw.
- If a reroll token is available and the tapped die is a player die on the surface, a **Pick Up** button appears at the bottom of the inspector. Using it returns the die to the tray and spends the token.

---

## 5. Turn Structure

Each combat turn proceeds in four phases:

**1. Preparation Phase (PREP)**

- Player reviews their dice pool in the hand tray.
- Phase label updates to indicate whose turn it is.

**2. Enemy Roll Phase (ENEMY_ROLL)**

- Enemy dice are automatically spawned from the enemy bumper's position and thrown outward with random velocity.
- Each enemy die has a **400 ms grace period** on spawn during which it ignores collision with the enemy bumper.
- Enemy dice settle on the surface showing their face results. Those results are held and resolved when the player ends their turn.

**3. Player Rolling Phase (PLAYER_ROLL)**

- The player **drags anywhere on the rolling surface** to aim from the fixed throw origin at the player bumper position. Drag direction and distance set throw angle and velocity. A faint aim line shows the projected throw direction while dragging.
- Each thrown die has a **400 ms grace period** during which it ignores collision with the player bumper.
- **Player dice resolve immediately on settle.** The moment a player die comes to rest, its face effect fires:
  - **Strike / Cleave / Pierce** — deals damage to the enemy immediately. Enemy block (from settled `BLK` faces) reduces the damage of Strike and Cleave but not Pierce.
  - **Defend / Brace** — adds to the player's block total immediately.
  - **Mend** — restores player HP immediately.
  - **Blank** — no effect.
- **Cascade:** If a die is knocked back into motion after having already settled and applied its effect, it will reroll and re-apply a new face effect when it settles again.
- **Mid-turn victory:** If the enemy's HP reaches 0 during the rolling phase, the battle ends immediately without needing to press End Turn.
- **Bumper contacts during rolling:**
  - A player die striking the **enemy bumper** → deals 1 damage to the enemy and rerolls.
  - A player die striking the **player bumper** → grants 1 block and rerolls.
- The **End Turn** button appears in the footer once all dice are thrown and all dice have settled.
- The **Reroll Token** (1 per battle) lets the player pick up one settled die from the surface and throw it again. Opened via the die inspector.

**4. End Turn / Commit Phase (COMMIT)**

- The player presses End Turn. Enemy dice on the surface are read.
- Enemy damage dice total their values. Buff dice add to the total.
- Total enemy damage is reduced by the player's accumulated block. Remaining damage is applied to player HP.
- Block resets to 0.
- All dice are cleared from the surface.
- **If the player HP reaches 0:** run ends (game over).
- Otherwise the next turn begins.

---

## 6. Enemy Block Mechanic

The enemy `BLK` face works differently from the player's block. While an enemy die is showing a `BLK` face and is settled on the surface, it acts as an **active per-hit shield**:

- Each player attack (Strike, Cleave) has its damage reduced by the sum of all active `BLK` values from settled enemy dice.
- Pierce bypasses this shield entirely.
- The shield is active as long as the die remains settled on that face. If the die is knocked and rerolls, the shield may change or disappear.
- A radiating blue pulse animation plays on the die while its shield is active.

---

## 7. Dice Building and Upgrades

### 7.1 Upgrade Screen

After each battle victory the player enters the Upgrade Screen. The player may:

- **Select one face** on any die in their pool (displayed as unfolded die nets).
- **Select a replacement token** from the full list of player tokens.
- **Apply** to swap that face, or **Skip** to leave the pool unchanged.

Only one upgrade is permitted per battle. The upgrade is applied before the next battle begins. The player's current HP carries over into the next battle.

### 7.2 Between-Battle Flow

The battle sequence is fixed in the prototype: **Grunt → Upgrade → Soldier → Upgrade → Captain**. After defeating the Captain the run ends.

**[PLANNED]** Full roguelike map structure (branching paths, multiple floors, event nodes, rest nodes, shop nodes) is a future feature.

### 7.3 Pool Size

**[PLANNED]** Pool size cap mechanics are not yet implemented. The player has exactly 3 dice for the full prototype run.

---

## 8. Enemies

### 8.1 Enemy Sequence (Prototype)

Three enemies appear in order across a single run:

| Enemy       | Tier     | HP | Dice Count | Color     |
| ----------- | -------- | -- | ---------- | --------- |
| **Grunt**   | Minion   | 14 | 1          | `#e74c3c` |
| **Soldier** | Standard | 22 | 2          | `#c0392b` |
| **Captain** | Elite    | 30 | 3          | `#922b21` |

### 8.2 Enemy Dice Configurations

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

### 8.3 Enemy Bumper Behavior

The enemy bumper acts as a pinball obstacle. Any die that strikes it is deflected with an additive velocity kick and rerolled. When a **player die** strikes the enemy bumper, the enemy takes 1 HP damage in addition to the physics deflection.

**[PLANNED]** Multiple simultaneous enemies, enemy line positioning, and enemy intent previews are future features.

---

## 9. Physics

### 9.1 Dice Physics Bodies

All dice use **circular physics bodies** (radius = 20 px) rather than square bodies. This ensures corner-catching energy loss does not occur on wall bounces — dice retain their velocity through wall contacts.

### 9.2 Velocity-Driven Animation

While a die is in motion, its face cycles through random faces. The **cycle interval** is driven by the die's current speed and angular velocity:

```
motion = speed + angularVelocity * 20
interval = max(40ms, 250ms / motion)
```

Fast-moving dice cycle rapidly; slowing dice visibly "click" into place. A die is considered settled when `motion < SETTLE_VEL`.

### 9.3 Physics Constants

| Constant           | Value | Purpose                                            |
| ------------------ | ----- | -------------------------------------------------- |
| `DIE_FRICTION`     | 0.5   | Surface friction — generates spin on contact       |
| `DIE_FRICTION_AIR` | 0.036 | Air drag — controls velocity decay over time       |
| `DIE_BOUNCE`       | 0.75  | Restitution on die bodies                          |
| `SETTLE_VEL`       | 0.4   | px/frame — below this a die is considered settled  |
| `MAX_THROW_SPEED`  | 20    | Max throw velocity cap                             |
| Wall restitution   | 0.85  | Wall bounciness                                    |
| Wall friction      | 0.0   | Walls have no friction                             |

### 9.4 Bumper Kick Formula

When any die collides with a bumper, velocity is replaced by:

```
nvx = velocity.x * 0.5 + (dx / len) * BUMPER_KICK_SPEED
nvy = velocity.y * 0.5 + (dy / len) * BUMPER_KICK_SPEED
```

Where `dx/dy` is the outward direction from bumper center to die center, and `BUMPER_KICK_SPEED = 9`. The result is capped at `MAX_THROW_SPEED`.

### 9.5 Spawn Grace Periods

- **Player dice:** ignore the player bumper for **400 ms** after being thrown.
- **Enemy dice:** ignore the enemy bumper for **400 ms** after being spawned.

---

## 10. Player Stats

| Stat             | Description                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **HP**           | Max 30. Reaching 0 ends the run. Displayed to the right of the player bumper.                      |
| **Block**        | Resets each turn. Reduces incoming enemy damage at End Turn. Displayed to the left of the player bumper; hidden when 0. Accumulated during rolling via bumper contacts and Defend/Brace face effects. |
| **Reroll Token** | 1 per battle. Lets the player pick up one settled die and throw it again. Accessed via die inspector. |

**[PLANNED]** Gold, character classes, and relics are future features.

---

## 11. Design Decisions Log

### 11.1 Resolved Decisions

| Question | Decision |
|---|---|
| **Throw origin** | Fixed at the player bumper position (bottom-center). The player drags anywhere on the surface to aim from that origin. |
| **Player die resolution timing** | Player dice resolve immediately on settle, not deferred to End Turn. Encourages real-time engagement with each throw. Enemy dice still defer to End Turn. |
| **Cascade on re-knock** | If a settled die is knocked back into motion, it re-applies its face effect when it re-settles. Creates emergent chain reactions. |
| **Enemy block design** | Enemy `BLK` acts as an active per-attack shield while the die is settled on that face, not a one-time buffer at End Turn. This makes positioning of enemy dice matter during the rolling phase. Pierce bypasses it entirely. |
| **Mid-turn victory** | If enemy HP hits 0 during the rolling phase, the battle ends immediately. No need to press End Turn. |
| **Collision resolution** | Any die colliding with a bumper is rerolled immediately and deflected with additive velocity. Die-to-die collisions cause rerolls with momentum transfer. |
| **Throw count per turn** | Player throws all dice in their pool every turn. The Reroll Token (1 per battle) allows one extra throw. |
| **Die inspector trigger** | Tap any live die on the surface or any tray card to open the inspector. It stays open indefinitely. Close with ✕ or the dim overlay. Throwing is disabled while the inspector is open. |
| **Tray card visibility** | Cards disappear from the tray when thrown. Remaining cards re-center. The End Turn button replaces the tray in the footer once all dice are thrown and settled. |
| **Hot zones** | Removed. The Forge / Bastion / Nullfield zones were tested during prototyping and cut — they added visual noise without contributing meaningfully to decision-making. |
| **Physics body shape** | Circular, not square. Square bodies caused excessive energy loss at wall contacts. Circular bodies bounce cleanly. |
| **Bumper force method** | `setVelocity` (direct override), not `applyForce`. Guarantees a consistent outward kick regardless of incoming angle. |

### 11.2 Open Questions

1. **Block carry-over** — Should block accumulated during rolling carry over into the next turn if the enemy deals no damage? Currently it resets to 0 regardless.

2. **Enemy bumper damage on enemy die contact** — Currently only player dice deal damage when hitting the enemy bumper. Should enemy dice deal damage when hitting the player bumper? Currently they do not.

3. **Reroll token refresh** — Should the Reroll Token refresh between turns (within the same battle), or remain once-per-battle? Currently once per battle.

---

## 12. Platform & Input

### 12.1 Primary Platform — Mobile (iOS / Android)

**Throwing a die:**
- Press and drag anywhere on the rolling surface to aim from the fixed throw origin. Drag direction sets angle; drag distance sets velocity. A faint aim line shows the projected throw direction.
- Release to launch.
- Throwing is disabled while the die inspector is open.

**Inspecting a die:**
- Tap any live die on the rolling surface to open its inspector panel.
- Tap any card in the hand tray to inspect that die's faces.
- Close with the ✕ button or by tapping the dim overlay.

**Reordering the tray:**
- Drag a tray card horizontally. Cards swap at midpoint crossing.

### 12.2 Secondary Platform — Web Browser

Mouse input mirrors touch: click-and-drag to aim and throw, click to inspect.

**[PLANNED]** Keyboard shortcuts and landscape layout are future additions.

---

## 13. **[PLANNED]** Map and Run Structure

The full roguelike run structure is not yet implemented. The current prototype is a linear sequence of three battles (Grunt → Soldier → Captain).

**Planned structure:** A branching path map (similar in spirit to Slay the Spire) spanning 3 floors plus a final boss. Node types: Battle, Elite, Boss, Rest, Shop, Event. Gold drops from battles; gold is spent at shops for dice, tokens, or relics.

---

## 14. **[PLANNED]** Character Classes

Three starting classes are planned:

| Class         | Starting Dice                        | Starting Relic                                                |
| ------------- | ------------------------------------ | ------------------------------------------------------------- |
| **Warden**    | 2× balanced d6s, 1× defend-heavy d6  | "Steadfast" — first Defend token each turn grants +1 block    |
| **Gambler**   | 3× high-variance d6s                 | "Lucky Streak" — after a bumper reroll, +1 to numeric value   |
| **Tactician** | 1× d8 (pre-configured), 2× d4s       | "Positioning" — Strike tokens also deal 1 splash to position 2 |

---

## 15. Tone and Aesthetic Direction

- **Visual style:** Minimalist dark UI with glowing dice. Dice are the visual centerpiece — warm gold for player, dark crimson for enemies.
- **Tone:** Dark fantasy adjacent but not grim. Wry and self-aware.
- **Audio:** Physically satisfying dice crack on impact is planned. Bumper flash on contact is the current visual feedback cue.
- **Camera:** Static portrait view. Subtle screen shake on heavy impacts is planned.
