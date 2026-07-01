# Product

## Register

product

## Users

Two overlapping audiences playing on the same device:

- **Casual mobile players** — pick-up-and-play in short sessions, need instant readability, playing with thumbs on a portrait phone screen. Low tolerance for unclear feedback.
- **Dedicated roguelike fans** — comfortable with dense stat readouts, play long sessions, want to read every number and understand every interaction. Will notice if the UI lies or hides information.

Both must feel served. Clarity wins when they conflict.

## Product Purpose

Dicemore is a portrait-first mobile roguelike where players physically throw dice across a 2D physics surface to deal damage, block, and apply status effects. The game is set in an underground western gambling championship where everyone cheats and The Devil runs the event. Players build a dice loadout across a run of 14 escalating encounters.

Success looks like: a player picking up the game on their phone, understanding what's happening within seconds, and staying for the strategy.

## Brand Personality

**Occult. Theatrical. Dangerous.**

Wry and darkly comic — the game knows it's rigged and winks at you about it. Tension is ever-present but never without personality. The aesthetic lives somewhere between a backroom séance and a neon-lit casino floor.

References: **Balatro** (neon-on-black, numbers that feel exciting, theatrical presentation) + **Slay the Spire** (functional dark roguelike clarity, readable under pressure, moody without being muddy).

## Anti-references

- **Friendly casual puzzle games** — no soft pastels, no rounded bubbly UI, no "safe" stakes energy. This game has teeth.
- **Generic free-to-play mobile** — no bright primaries, no coin-pop animations, no in-your-face progression noise.
- Any UI that could belong to a different game without feeling wrong.

## Design Principles

1. **Every number must feel significant.** HP, dice values, damage — each should feel weighted. Numbers are the game; they should never feel like noise.
2. **Clarity under pressure.** Players are throwing dice and reading fast. Hierarchy and contrast are non-negotiable. No mystery damage, no hidden state.
3. **Danger is visible.** The UI should look like something is at stake — dark, high-contrast, with presence. Not menacing for its own sake, but never casual.
4. **Theatrical restraint.** Flair is earned, not scattered. A single dramatic moment lands harder than constant spectacle.
5. **Thumb-native first.** Designed for portrait, 400×700px canvas, finger-sized touch targets. Physics feedback replaces haptics — visual impact must do that work.

## Accessibility & Inclusion

- WCAG AA contrast for all text legible during gameplay (HP numbers, die values, status labels)
- Reduced motion: no animation-only information — all state changes must be readable without animation
- Color is never the sole differentiator — type labels (ATK/BLK/STR) accompany color coding
- Portrait-only layout; no landscape support needed at this stage
