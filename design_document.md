# Dicemore — Game Design Document

**Version:** 0.3 (Prototype — Reflects Built State)
**Genre:** Roguelike Dice-Builder

> Sections marked **[PLANNED]** describe intended future design not yet implemented in the prototype. All other sections describe mechanics that are built and working.

---

## 1. Concept Overview

Dicemore is a roguelike dice-building game in which players collect, upgrade, and manipulate a set of custom dice rather than a deck of cards. Each die face is an action — attack, defend, heal, buff — and players can modify those faces between battles. Combat is resolved by physically rolling dice across a 2D play surface, where two physics bumpers (the player character and the enemy character) act as pinball-style obstacles. Dice colliding with the enemy bumper deal damage in real time; dice colliding with the player's own bumper generate block. Enemies roll their own dice from their bumper position at the start of each turn, making the rolling area a shared, contested space.

---

## 2. Core Fantasy

The player is an adventurer whose power comes from fate itself — the ability to shape, throw, and redirect chance. A master of the dice doesn't just accept what they roll; they aim their throws, bank dice off bumpers, and navigate the physics of the rolling surface to push dice toward favorable outcomes. When the enemy rolls their own dice from across the board, the master reads the momentum, decides whether to let a die bounce off their own bumper for block, or drive it hard into the enemy for damage.

---

## 3. Visual Layout

### 3.1 Screen Structure

The game is designed portrait-first. The screen is **400 × 700 px** and divided into three zones:

```
┌────────────────────────┐  ← y=0
│  Phase · Round · RT    │  ← minimal header (80px)
├────────────────────────┤  ← y=80  (SURFACE_TOP)
│                        │
│  [Enemy bumper]  HP    │
│                        │
│    DICE ROLLING        │
│       SURFACE          │  ← physics space, 560px tall
│                        │
│  [Player bumper] HP    │
│                        │
├────────────────────────┤  ← y=640 (SURFACE_BOTTOM)
│  [D1] [D2] [D3] ···   │  ← solid footer / tray (60px)
└────────────────────────┘  ← y=700
```

- **Header (0–80 px):** Phase label, round counter, reroll token count. No HP or block displayed here — those live beside the character bumpers on the surface.
- **Rolling Surface (80–640 px):** The full physics space. Both the player bumper (bottom-center) and the enemy bumper (variable position, upper half) live here. Dice cannot physically reach below y=640 — the footer is a solid wall.
- **Footer (640–700 px):** Solid opaque strip. Contains the hand tray (unthrown player dice as tap/drag cards). The Commit button appears as a floating overlay at the top of the surface when the player has thrown all dice.

### 3.2 Player Character

The player is represented as a **gold circle bumper** fixed at the bottom-center of the rolling surface (`x=200, y=605`). The player's HP and block totals are displayed as text directly beside this bumper. The bumper is a static physics body (radius 22) — any die that strikes it is deflected with an additive velocity kick and immediately rerolled.

### 3.3 Enemy Character

The enemy is represented as a **colored circle bumper** that moves to a random position in the upper portion of the rolling surface at the start of each battle. The enemy's HP bar and HP counter are displayed beside the bumper. Enemy dice are spawned from the enemy bumper's position and thrown outward. Like the player bumper, the enemy bumper deflects any die that strikes it with a velocity kick and rerolls it.

**Enemy bumper movement:** The enemy repositions to a new random x/y within the upper half of the surface each time a new enemy is introduced. Its position is fixed for the duration of that encounter.

### 3.4 Hand Tray (Footer)

The hand tray displays all unthrown player dice as tap cards in the footer strip. Cards can be **drag-reordered** within the tray by holding and dragging to a new position (swap triggers at midpoint crossing). The leftmost card is the active die. Tapping a card in the tray opens the die inspector.

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

| Token         | Sym  | Effect                                           | Value |
| ------------- | ---- | ------------------------------------------------ | ----- |
| **Blank**     | `--` | No effect.                                       | —     |
| **Strike**    | ATK  | Deal damage to the enemy.                        | 3     |
| **Strike 2**  | ATK2 | Deal damage to the enemy.                        | 6     |
| **Cleave**    | CLV  | Deal damage to all enemies.                      | 3     |
| **Pierce**    | PRC  | Deal damage, ignores enemy block.                | 6     |
| **Defend**    | DEF  | Gain block.                                      | 2     |
| **Defend 2**  | DEF2 | Gain block.                                      | 4     |
| **Brace**     | BRC  | Gain block.                                      | 4     |
| **Mend**      | MND  | Restore HP.                                      | 4     |
| **Chaos**     | CHS  | Reroll this die immediately upon landing.        | —     |

**Enemy-only tokens:**

| Token       | Sym | Effect              | Value |
| ----------- | --- | ------------------- | ----- |
| **Atk 1**   | `1` | Deal damage.        | 3     |
| **Atk 2**   | `2` | Deal damage.        | 5     |
| **Atk 3**   | `3` | Deal damage.        | 8     |
| **Block**   | BLK | Gain enemy block.   | 3     |
| **Buff**    | BUF | Buff enemy damage.  | 3     |
| **Blank**   | `--`| No effect.          | —     |

### 4.3 Starter Dice

The player begins each run with three d6s:

```
Die 1: Blank, Blank, Defend, Defend, Strike, Cleave
Die 2: Blank, Strike, Strike, Defend, Mend, Cleave
Die 3: Blank, Blank, Strike, Strike, Cleave, Defend
```

### 4.4 Die Inspector

Holding any die (tray card or live die on the surface) for **200 ms** opens the face inspector. The inspector displays the die as an **unfolded die net** — a lowercase 't' shape showing all 6 faces in their net positions:

```
      [ top  ]
[left][center][right]
      [lower ]
      [bottom]
```

For dice with a face count other than 6, faces are displayed in a grid fallback. The inspector closes on finger/pointer release.

---

## 5. Turn Structure

Each combat turn proceeds in four phases:

**1. Preparation Phase (PREP)**

- Player reviews their dice pool in the hand tray.
- Phase label updates to indicate whose turn it is.
- The Commit button is not yet visible.

**2. Enemy Roll Phase (ENEMY_ROLL)**

- Enemy dice are automatically spawned from the enemy bumper's position and thrown outward with random velocity.
- Each enemy die has a **400 ms grace period** on spawn during which it ignores collision with the enemy bumper (so it isn't immediately deflected back on spawn).
- Enemy dice settle on the surface showing their face results.

**3. Player Rolling Phase (PLAYER_ROLL)**

- The active die in the hand tray is the player's next throw.
- The player **drags anywhere on the rolling surface** to aim from a fixed origin at the bottom-center of the screen (the player bumper position). Drag direction and distance set throw velocity and angle.
- Each thrown die has a **400 ms grace period** during which it ignores collision with the player bumper (so it isn't immediately deflected on spawn).
- **Real-time combat during rolling:** collisions are resolved the moment they occur, not deferred to Commit.
  - A player die striking the **enemy bumper** → deals 1 damage to the enemy immediately and rerolls the die.
  - A player die striking the **player bumper** → grants 1 block immediately and rerolls the die.
  - *(Enemy dice do not deal damage on bumper contact — only at Commit.)*
- The **Commit** button appears floating at the top of the surface once all player dice have been thrown.
- The **Reroll Token** (1 per battle) lets the player pick up one settled die from the surface and throw it again. The pickup button appears in the inspector when the token is available.

**4. Commit Phase (COMMIT)**

- The player presses Commit. All dice on the surface are read.
- Player dice resolve: Defend/Brace/Mend apply first, then Strike/Cleave/Pierce.
- Enemy dice resolve: attacks deal damage reduced by the player's accumulated block.
- Block resets to 0 after enemy attacks resolve.
- All dice are cleared from the surface.
- **If the enemy HP reaches 0:** the battle ends and the player proceeds to the Upgrade Screen.
- **If the player HP reaches 0:** run ends (game over).
- Otherwise the next turn begins.

---

## 6. Hot Zones

Hot zones are fixed for the duration of a battle. Three zones are implemented in the prototype:

| Zone Name     | Visual      | Effect on player die landing here                     |
| ------------- | ----------- | ----------------------------------------------------- |
| **Forge**     | Orange glow | Damage tokens deal +1 damage.                         |
| **Bastion**   | Blue glow   | Defend tokens grant +1 block.                         |
| **Nullfield** | Grey static | The die's face is negated entirely this turn.         |

Hot zones apply to any die resting fully inside the zone boundary at Commit, player or enemy. Enemy dice in Forge deal +1 damage; enemy dice in Nullfield are negated.

**[PLANNED]** Additional hot zones from the original design (Echo, Fracture, Convergence) are not yet implemented.

---

## 7. Dice Building and Upgrades

### 7.1 Upgrade Screen

After each battle victory the player enters the Upgrade Screen. The player may:

- **Select one face** on any die in their pool.
- **Select a replacement token** from the full list of player tokens.
- **Apply** to swap that face, or **Skip** to leave the pool unchanged.

Only one upgrade is permitted per battle. The upgrade is applied before the next battle begins.

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

The enemy bumper acts as a pinball obstacle. Any die that strikes it is deflected with an additive velocity kick (50% of current velocity retained + outward kick speed) and rerolled. When a **player die** strikes the enemy bumper, the enemy takes 1 HP damage in addition to the physics deflection.

**[PLANNED]** Multiple simultaneous enemies, enemy line positioning, and enemy intent previews are future features.

### 8.4 **[PLANNED]** Status Effects

Status effects applied by enemy dice (Brittle, Slick, Weighty, Cursed Face) are designed but not yet implemented.

---

## 9. Physics

### 9.1 Dice Physics Bodies

All dice use **circular physics bodies** (radius = `DIE_SIZE / 2 - 2 = 20 px`) rather than square bodies. This ensures corner-catching energy loss does not occur on wall bounces — dice retain their velocity through wall contacts.

### 9.2 Physics Constants

| Constant            | Value  | Purpose                                           |
| ------------------- | ------ | ------------------------------------------------- |
| `DIE_FRICTION`      | 0.5    | Surface friction — generates spin on contact      |
| `DIE_FRICTION_AIR`  | 0.036  | Air drag — controls velocity decay over time      |
| `DIE_BOUNCE`        | 0.75   | Restitution on die bodies                         |
| `SETTLE_VEL`        | 0.4    | px/frame — below this a die is considered settled |
| `MAX_THROW_SPEED`   | 20     | Max throw velocity cap                            |
| Wall restitution    | 0.85   | Wall bounciness                                   |
| Wall friction       | 0.0    | Walls have no friction (no energy loss)           |

### 9.3 Bumper Kick Formula

When any die collides with a bumper, velocity is replaced by:

```
nvx = velocity.x * 0.5 + (dx / len) * BUMPER_KICK_SPEED
nvy = velocity.y * 0.5 + (dy / len) * BUMPER_KICK_SPEED
```

Where `dx/dy` is the outward direction from bumper center to die center, and `BUMPER_KICK_SPEED = 9`. The result is capped at `MAX_THROW_SPEED`. This preserves 50% of existing velocity (so a die grazing the side of a bumper keeps some of its original trajectory) while adding an outward kick.

### 9.4 Spawn Grace Periods

To prevent newly thrown or spawned dice from immediately colliding with the bumper they originated from:

- **Player dice:** ignore the player bumper (`category 0x0002`) for **400 ms** after being thrown.
- **Enemy dice:** ignore the enemy bumper (`category 0x0004`) for **400 ms** after being spawned.

---

## 10. Player Stats

| Stat              | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| **HP**            | Max 30. Reaching 0 ends the run. Displayed beside the player bumper.        |
| **Block**         | Resets each turn. Reduces incoming enemy damage. Accumulated during rolling via bumper contacts and face resolution. |
| **Reroll Token**  | 1 per battle (does not refresh between turns). Lets the player pick up a settled die and throw it again. |

**[PLANNED]** Gold, character classes, and relics are future features.

---

## 11. Design Decisions Log

### 11.1 Resolved Decisions

| Question | Decision |
|---|---|
| **Throw origin** | Fixed at the player bumper position (bottom-center). The player drags anywhere on the surface to aim from that origin. |
| **Real-time vs deferred damage** | Bumper collisions deal damage and block in real time during the rolling phase. Only face-value damage (strike, defend, etc.) defers to Commit. |
| **Collision resolution** | Any die colliding with a bumper is rerolled immediately and deflected with additive velocity. Die-to-die collisions cause rerolls with momentum transfer. |
| **Hot zone permanence** | Zones are fixed for the entire battle. They do not shift between turns. |
| **Throw count per turn** | Player throws all dice in their pool every turn. The Reroll Token (1 per battle) allows one extra throw as a resource. |
| **Die inspector trigger** | 200 ms hold on any die. Inspector shows an unfolded die net (lowercase 't' shape). Closes on pointer release. |
| **Physics body shape** | Circular, not square. Square bodies caused excessive energy loss at wall contacts due to corner-catching. Circular bodies bounce cleanly. |
| **Bumper force method** | `setVelocity` (direct override), not `applyForce`. Guarantees a consistent outward kick regardless of incoming angle. |
| **Enemy visibility** | Single enemy per battle shown as a physics bumper with HP displayed beside it. Full transparency: player can inspect any die at any time. |

### 11.2 Open Questions

1. **Airtime** — Should there be an intentional mechanic to deliberately launch a die over a hot zone, or should airtime remain purely physics-emergent? Recommend letting physics drive this and evaluating in playtesting.

2. **Block carry-over** — Should block accumulated from bumper contacts (during rolling) carry over if the enemy hasn't attacked yet, or should it only count at Commit? Currently accumulates in real time.

3. **Enemy bumper damage on enemy die contact** — Currently only player dice deal damage when hitting the enemy bumper. Should enemy dice deal damage when hitting the player bumper? Currently they do not.

---

## 12. Platform & Input

### 12.1 Primary Platform — Mobile (iOS / Android)

**Throwing a die (Touch):**
- The active die in the tray is ready to throw.
- The player **presses and drags** anywhere on the rolling surface to aim from the fixed throw origin. Drag direction sets throw angle; drag distance sets velocity.
- A faint aim guide shows the projected throw direction while dragging.
- On release the die is launched.

**Inspecting a die (Touch):**
- **Hold** any die (tray card or live die on the surface) for **200 ms** to open the face inspector.
- The inspector shows the unfolded die net.
- **Release** to close the inspector.

**Reordering the tray (Touch):**
- Hold a tray card and drag horizontally to reorder. Cards swap when the dragged card crosses the midpoint of an adjacent card.

### 12.2 Secondary Platform — Web Browser

Mouse input mirrors touch: click-and-drag to aim and throw, click-hold to open the inspector.

**[PLANNED]** Keyboard shortcuts and landscape layout are future additions.

---

## 13. **[PLANNED]** Map and Run Structure

The full roguelike run structure is not yet implemented. The current prototype is a linear sequence of three battles (Grunt → Soldier → Captain).

**Planned structure:** A branching path map (similar in spirit to Slay the Spire) spanning 3 floors plus a final boss. Node types: Battle, Elite, Boss, Rest, Shop, Event. Gold drops from battles; gold is spent at shops for dice, tokens, or relics.

---

## 14. **[PLANNED]** Character Classes

Three starting classes are planned:

| Class         | Starting Dice                       | Starting Relic                                               |
| ------------- | ----------------------------------- | ------------------------------------------------------------ |
| **Warden**    | 2× balanced d6s, 1× defend-heavy d6 | "Steadfast" — first Defend token each turn grants +1 block   |
| **Gambler**   | 3× d6s with 2 Chaos faces each      | "Lucky Streak" — after a Chaos reroll, +1 to numeric value   |
| **Tactician** | 1× d8 (pre-configured), 2× d4s      | "Positioning" — Strike tokens also deal 1 splash to position 2 |

---

## 15. Tone and Aesthetic Direction

- **Visual style:** Minimalist dark UI with glowing dice. Dice are the visual centerpiece — warm gold for player, dark crimson for enemies.
- **Tone:** Dark fantasy adjacent but not grim. Wry and self-aware.
- **Audio:** Physically satisfying dice crack on impact. Bumper flash on contact is the current visual feedback cue; audio equivalents are planned.
- **Camera:** Static portrait view. Subtle screen shake on heavy impacts is planned.
