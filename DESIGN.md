---
name: Dicemore
description: Underground dice roguelike where physics settles what theory starts
colors:
  midnight-base: "#111122"
  battle-surface: "#13192e"
  header-deep: "#0e2a42"
  card-dark: "#0d0d1c"
  panel-void: "#080f1c"
  gold-primary: "#f0c040"
  gold-warm: "#d4a820"
  blue-edge: "#1a4a7a"
  ink-primary: "#ddeeff"
  ink-secondary: "#8aaabb"
  ink-muted: "#5a7a8a"
  ink-ghost: "#2a3848"
  die-attack: "#ff4444"
  die-block: "#3498db"
  die-buff: "#ff9900"
  die-copy: "#cc88ff"
  die-poison: "#58d68d"
  intent-loaded: "#e67e22"
  intent-hustle: "#bb44cc"
  intent-rattle: "#1abc9c"
  danger-pulse: "#ff1100"
  confirm-green: "#27ae60"
typography:
  display:
    fontFamily: '"Cinzel", serif'
    fontSize: "38px"
    fontWeight: 700
    letterSpacing: "6px"
    lineHeight: 1.1
  header:
    fontFamily: '"Cinzel", serif'
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "3px"
    lineHeight: 1.2
  title:
    fontFamily: '"Cinzel", serif'
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "2px"
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "1px"
    lineHeight: 1
rounded:
  none: "0px"
  soft: "4px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "#131320"
    textColor: "#f0c040"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "#1e2840"
    textColor: "#f0c040"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-confirm:
    backgroundColor: "#163824"
    textColor: "#aaffaa"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-confirm-hover:
    backgroundColor: "#27ae60"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  class-card:
    backgroundColor: "#0d0d1c"
    rounded: "{rounded.none}"
    padding: "16px"
    height: "108px"
---

# Design System: Dicemore

## 1. Overview

**Creative North Star: "The Devil's Parlor"**

Dicemore is set in an underground western gambling championship where The Devil runs the event and everyone cheats. The UI is the Parlor's interior: near-black surfaces tinted toward deep navy, gold serif lettering that declares the stakes, and a physics surface where dice do not care about your plans. The aesthetic lives exactly where PRODUCT.md places it — somewhere between a backroom séance and a neon-lit casino floor — and every design decision must serve both poles simultaneously: ceremonial (Cinzel, gold, restraint) and alive (physics, animation, red danger pulses).

This is not a bright mobile game. It is not a generic dark UI. It is a specific kind of dark: the dark of a room where serious things happen under low, deliberate light. Every pixel of contrast is earned. Every animation has a job. Numbers feel heavy because the game is playing for keeps.

The references PRODUCT.md names — Balatro and Slay the Spire — share one property: their UI cannot be moved to another game. A Balatro card interface is unmistakably Balatro. A Slay the Spire energy orb belongs nowhere else. Dicemore's gold Cinzel headers, die-shape visual language, and tonal depth stack must earn the same recognition.

The system explicitly rejects:
- Soft pastels, rounded bubbly UI, or "safe stakes" energy — this game has teeth.
- Generic free-to-play mobile conventions — no bright primaries, no coin-pop animations, no progression noise.
- Any UI element that could belong to a different game without feeling wrong.

**Key Characteristics:**
- Dark-first backgrounds (near-black with blue hue lean) at every layer
- Cinzel for display type; system sans for body — contrast axis, not similarity axis
- Stroke-not-fill interactions: dark fill with colored stroke; fill floods on hover
- Mechanical color: die types own their colors permanently — never decorative use
- Flat geometry; circles only for functional physics bodies (bumpers, relic indicators)
- Camera fades on all scene transitions; within-scene steps crossfade at 160/220ms
- Header strip (y=0–80) reserved permanently for phase/status/navigation

## 2. Colors: The Parlor Palette

Dark navy foundations lit by gold, with a closed set of mechanic colors that carry meaning across every screen.

### Primary
- **Parlor Gold** (`#f0c040`): The canonical accent. Used for the DICEMORE hero title, the POT counter, and step-header text. Its rarity is the point — the only color that reads as "the house" at a glance.
- **Player Gold** (`#d4a820`): Warmer, slightly more muted gold applied to the player bumper and player HP indicator. Distinct from Parlor Gold — signals "yours" vs "the house's."

### Secondary
- **Edge Blue** (`#1a4a7a`): A 2px divider line separating the header strip from the battle surface. It does not fill surfaces; it marks thresholds.
- **Confirm Green** (`#27ae60`): Reserved for commit-to-action buttons — Begin Battle, End Turn, Next →. Never used for decoration. Floods the button fill on hover.

### Tertiary (Die Mechanic Colors)
A closed set. These five colors carry mechanical meaning across die symbols, class card shapes, status pills, and intent text. They do not appear in decorative contexts.

- **Attack** (`#ff4444`): Red. Deal damage. Enemy intent variant: `#e74c3c`.
- **Block** (`#3498db`): Blue. Absorb damage. (Shared between die type and intent.)
- **Buff** (`#ff9900`): Orange. Amplifies all dice this turn.
- **Copy** (`#cc88ff`): Lavender. Mirrors what it touches mid-air.
- **Poison** (`#58d68d`): Green. Stacks damage over time.

Enemy status intents use their own slightly-muted variants: Loaded (`#e67e22`), Hustle (`#bb44cc`), Rattle (`#1abc9c`). These live in the intent display only and are not used for die shapes.

### Neutral
- **Midnight Base** (`#111122`): Root background, HomeScene and SetupScene. Near-black with a blue lean — not pure black.
- **Battle Surface** (`#13192e`): The physics arena. Slightly lighter than midnight base.
- **Header Deep** (`#0e2a42`): The 80px header strip. Distinctly blue, signaling status/nav territory separate from the arena.
- **Card Dark** (`#0d0d1c`): Default card and list item fill.
- **Panel Void** (`#080f1c`): Modal and picker panel fill. Deepest background layer.
- **Ink Primary** (`#ddeeff`): HP numbers, die values, large numerical displays. Light blue-white to stay on palette.
- **Ink Secondary** (`#8aaabb`): Back buttons, nav arrows, active descriptor text.
- **Ink Muted** (`#5a7a8a`): Phase text, mode descriptors, sub-labels. Readable, recessive.
- **Ink Ghost** (`#2a3848`): Version string, placeholder labels. Intentionally near-invisible.

### Named Rules

**The Closed Mechanic Rule.** The five die mechanic colors are permanent and exclusive. They appear on die symbols, class card shapes, and status pills — nowhere else. A new die type added to the game gets a new color in the same family; that color never appears in decorative contexts. Break this rule and the visual language stops working.

**The One Gold Rule.** Parlor Gold (`#f0c040`) touches ≤ 3 elements per screen. It signals "the house" — the title, the pot, the header. Its power comes from its rarity. Do not apply it to interactive elements that need to communicate anything other than Dicemore's identity.

**The Danger Signal Rule.** `#ff1100` is used exclusively as the critical-HP danger pulse overlay (alpha ≤ 0.10, 700ms yoyo animation). Its association with mortal danger must not be diluted by any decorative use.

## 3. Typography

**Display Font:** Cinzel, weight 700 (Google Fonts, preloaded in BootScene)
**Body Font:** system-ui, sans-serif (device default, weight 400/700)

**Character:** Cinzel's classical Roman letterforms give every header the gravity of an inscription on a stone wall. It is theatrical without being whimsical — it announces wagers, not whimsy. Paired against the device's system sans-serif for body and label text, the contrast is intentional and maximal: Cinzel declares, system-ui informs. The fonts must never feel similar.

Cinzel is preloaded via `document.fonts.load('bold 16px "Cinzel"')` in BootScene before HomeScene renders. No flash of wrong font on first load.

### Hierarchy

- **Display** (Cinzel 700, 38px, letterSpacing 6px): DICEMORE hero title only. One element per session. Rises into frame on entrance animation; this is its motion role.
- **Header** (Cinzel 700, 20–22px, letterSpacing 3px): Step titles (CHOOSE YOUR CLASS, HOW MANY DICE?), modal titles, class card names. The primary decision-making tier.
- **Title** (Cinzel 700, 17px, letterSpacing 2px): Enemy names, sub-section labels, content titles inside cards. Below headers, above body.
- **Body** (system-ui 400, 12–15px): Class subtitles, relic/upgrade descriptions, tutorial copy. Wordwrapped at `cardW − 24px` inside cards.
- **Label** (system-ui 700, 10–13px, letterSpacing 1px): Rarity badges (COMMON / RARE / BOSS), status pill text, intent hint text, small numerical indicators.

### Named Rules

**The Three Spacings Rule.** letterSpacing in this system has exactly three valid values: `0` (body/small text), `3` (all Cinzel headers and buttons), `6` (the hero DICEMORE title only). No other values. Intermediate values (1, 2, 4, 5) visible in current code are legacy and should be unified on the next polish pass.

**The Cinzel Ceiling Rule.** Cinzel is prohibited below 14px. The letterforms collapse at small sizes. Any text below 14px uses system-ui only.

## 4. Elevation

This system is **flat by default, dim-on-modal**. Surfaces are distinguished by fill darkness alone — no drop shadows, no blur, no glow on static elements. The z-axis is expressed in one dimension: fill color value.

The depth stack, darkest to lightest:
1. `#080f1c` — modal/picker panels (deepest, opened on top)
2. `#0d0d1c` — cards and list items
3. `#111122` — root background (HomeScene, SetupScene)
4. `#13192e` — battle surface (physics arena)
5. `#0e2a42` — header strip (blue-tinted, not lighter — separated by hue shift)

Modal dim overlays (`0x000000` at 0.65–0.70 alpha, full canvas) are the sole exception. When a picker, popup, or confirmation dialog opens, the world behind dims to black. This is elevation-by-occlusion, not elevation-by-shadow — the system stays flat while still creating clear focus hierarchy.

The enemy bumper outer glow ring (`lineStyle(4, enemyColor, 0.30)`, 1100ms yoyo pulse) is also an exception: a functional glow that marks an interactive physics body. It is not decorative.

### Named Rules

**The Flat-By-Default Rule.** Surfaces at rest cast no shadows. Hover states use fill-color lightening (`setFillStyle`), not shadow elevation. Add drop shadows and the game starts looking like a web app.

**The Dim-Not-Blur Rule.** Modals occlude via `0x000000` at 0.65–0.70 alpha. No blur, no backdrop-filter. The performance budget belongs to Matter.js physics simulation.

## 5. Components

### Buttons

Buttons in Dicemore are rectangular and geometric. The current implementation uses 0px border-radius. The chosen design direction is **tactile but softer**, targeting 4px radius in a future polish pass — enough softness to feel touchable on a phone without losing the flat authority of the rectangle.

**Primary Action Button** (gold variant — SOLO, DICE DUEL):
- Shape: Rectangle (0px radius; 4px target), 240×52px
- Fill: `#131320`, `#1e2840` on hover
- Stroke: 2px at button's accent color (`#f0c040` for SOLO, `#00ccff` for DICE DUEL), alpha 0.90
- Label: Cinzel 22px 700, letterSpacing 3, accent color
- Tap: Camera fadeOut 180ms → camerafadeoutcomplete → scene start

**Confirm Button** (green variant — Begin Battle, End Turn, Next →):
- Fill: `#163824`, `#27ae60` on hover (fill floods the button — aggressive confirmation signal)
- Stroke: 1.5px `#27ae60` at 0.90
- Label: system-ui 17px 700, letterSpacing 2, `#aaffaa`

**Quit/Destructive Button** (QUIT in confirm dialog):
- Fill: `#1a0a08`, no hover treatment — certainty required
- Label: Cinzel 14px 700, `#ee6644`

**Secondary/Ghost Button** (The Drifter — build custom, Skip →):
- Fill: `#0a0a14`, `#141424` on hover
- Stroke: 1px `#2a3a5a` at 0.70
- Label: system-ui 14px, `#5a7a8a`

### Die Shapes

The visual signature of this system. Die types are drawn as geometric shapes via Phaser Graphics — not text labels, not icons.

- **d4:** Upward triangle. Apex at `py − S×0.58`, base corners at `py + S×0.42`, width `±S×0.52`
- **d6:** Square. Side `S×0.92`, centered on `(px, py)`
- **d8:** Diamond (vertical rhombus). Width `±S×0.46`, height `±S×0.58`

All shapes: fill at die's mechanic color alpha 0.18; stroke 1.5px at die's mechanic color alpha 0.85. `S = 26px` in class cards. This formula must extend to any new die sizes added (d10 → pentagon, d12 → hexagon, d20 → star polygon).

### Class Cards

Full-width horizontal cards (360×108px) for class selection.

- Fill: Unique tint per class (`#130e08` Dice Slinger, `#100a18` Illusionist, `#081208` Pickpocket, `#130808` The Muscle)
- Stroke: 2px, class color at 0.65 alpha
- Hover: `bgHover` — slightly lighter than `bgColor`
- Internal layout (top to bottom, anchor point at `cy`): class title (22px Cinzel, `cy − 42`) → subtitle (12px body, `cy − 22`, wordWrap) → die shapes (`cy + 2`) → relic pill (`cy + 30`, 170×22px) → tap cue (`cy + 47`, 13px, `#4a6878`)
- Corner radius: 0px now; 4px with the soft-radius pass

### Enemy Cards

Narrow vertical cards (108×220px) for enemy selection.

- Fill: `#131320`; stroke 1.5px at enemy color, alpha 0.55
- HP number: 36px, `#ddeeff`, centered. The largest number on screen — it should feel like a bet.
- Intent chips: 16×14px rectangles with rarity-colored strokes, 3-character label below

### List Items

Used in rune/relic/upgrade scrollable lists (360×96px).

- Fill: `#0d0d1c` (unselected), `#1a1a3a` (selected)
- Stroke: 1.5px rarity-colored (`common=#556677`, `uncommon=#2471a3`, `rare=#6c3483`, `boss=#922b21`)
- Left bar: 4px wide, full-height, item's own color at 0.55–0.80 alpha. The only edge accent permitted (≤4px keeps it below the side-stripe ban).
- Typography: name 15px bold in item color; rarity 11px uppercase `#445566`; description 12px `#8899aa` wordwrapped

### Status Pills

Small labeled states on player and enemy bumpers.

- Fill: mechanic color at 0.20 alpha; stroke 1.5px at mechanic color 0.75 alpha
- Height: 18px (player), 16px (enemy); padding 7px horizontal
- Label: 11px–13px bold, mechanic color
- Multiple pills: spaced 5px apart (player), 4px (enemy), centered on bumper

### Modal Panels

Confirmation dialogs, relic popups, intent popups, how-to-play.

- Fill: `#080f1c` at 0.92–0.98 alpha
- Stroke: 1.5–2px colored by context (quit `#445566`, intent: enemy color, relic: rarity color, tutorial `#2255aa`)
- Dim overlay: `0x000000` at 0.65–0.70 alpha, covers full 400×700 canvas
- Close: tap dim anywhere (dismiss) or explicit labeled button. Never a ✕ icon alone.
- Corner radius: 0px now; 4px with the soft-radius pass

### The Enemy Bumper (Signature Component)

The central physics body and the game's defining visual element.

- **Outer glow ring:** 4px stroke at enemy color 0.30 alpha; pulses 1100ms yoyo repeat-∞ — marks the interactive physics body
- **Base circle:** R=26px, fill `#080814` at 0.92
- **HP fill:** Circular chord segment, floods from bottom up proportional to remaining HP, enemy color at 0.60 alpha
- **Ring outline:** 2px at enemy color 0.90 alpha, on top of HP fill
- **Intent text:** Cinzel 11px 700, white, stroke 3px black. Hint line 9px below in same color.
- **Pop animation:** On intent change — 1.10× scale yoyo 120ms Sine.Out. Draws eye to the new threat.

## 6. Do's and Don'ts

### Do:
- **Do** use Cinzel only for display text ≥14px. Below that size, always system-ui.
- **Do** keep Parlor Gold (`#f0c040`) to ≤3 elements per screen. Its rarity is its power.
- **Do** use camera fades (180–350ms black) on every scene transition. Instant cuts read as prototype.
- **Do** reserve die mechanic colors (attack red, block blue, buff orange, copy lavender, poison green) exclusively for mechanical contexts — die symbols, class card shapes, status pills, intent text. Never decorative.
- **Do** express depth through fill darkness only: `#080f1c` → `#0d0d1c` → `#13192e` → `#111122`. No drop shadows.
- **Do** use the dim overlay (`0x000000` at 0.65 alpha) when a modal or picker opens.
- **Do** verify HP numbers, die values, and damage text hit ≥4.5:1 contrast on their background. Ink Primary (`#ddeeff`) on Card Dark (`#0d0d1c`) comfortably passes.
- **Do** accompany every color-coded indicator with a type label (ATK/BLK/STR). Color is never the sole differentiator.
- **Do** use the danger pulse (`#ff1100`, alpha ≤ 0.10, 700ms Sine.InOut yoyo) exclusively for critical HP. One signal, one meaning.
- **Do** extend the die-shape convention (triangle/square/diamond/fill–stroke formula) to any new die type added. Visual language only works if it's complete.

### Don't:
- **Don't** use soft pastels, rounded bubbly elements, or "safe stakes" energy. Per PRODUCT.md: this game has teeth. Any element that could appear in a friendly casual puzzle game is wrong for Dicemore.
- **Don't** add coin-pop animations, bright primary colors, or in-your-face progression noise. Dicemore is not a generic free-to-play mobile game.
- **Don't** ship a UI element that could belong to a different game without feeling wrong. Every choice — font, color, shape — must be defensible as specifically Dicemore.
- **Don't** use `#ff1100` (danger red) for anything except the critical-HP overlay. Diluting the signal teaches players to ignore it.
- **Don't** add drop shadows to surfaces. The depth system is tonal only. A drop shadow reads as web app, not underground parlor.
- **Don't** use letterSpacing values outside 0 (body), 3 (Cinzel headers/buttons), or 6 (DICEMORE hero title only).
- **Don't** add border-radius greater than 4px to buttons or cards. 12px radius belongs in a different game entirely.
- **Don't** put decorative animation on informational state changes. The danger pulse means danger; the intent pop means intent changed. Repurposing them for delight destroys the signal.
- **Don't** add a new die type to the game without assigning it a dedicated color that appears across all surfaces (die symbol, class card shape, status pill, intent). Half-implemented visual language is worse than none.
- **Don't** render die types as text labels (BUF d4, CPY d4) on class cards. The geometric shape language exists to replace those labels. Reintroducing text is a regression.
