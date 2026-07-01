// Devil's Parlor design tokens — single source of truth, ported from DESIGN.md / .impeccable/design.json.
// Keep DESIGN.md in sync after changing values here.
import { FONT_DISPLAY } from '../constants.js';

export const COLORS = {
  goldPrimary:   '#f0c040', // Parlor Gold — the house. ≤3 elements per screen (One Gold Rule).
  goldWarm:      '#d4a820', // Player Gold — "yours"
  midnightBase:  '#111122', // root bg: Home/Setup
  battleSurface: '#13192e', // physics arena
  headerDeep:    '#0e2a42', // header strip
  cardDark:      '#0d0d1c', // cards/list items
  panelVoid:     '#080f1c', // modal/picker panels — deepest layer
  blueEdge:      '#1a4a7a', // 2px threshold divider only
  confirmGreen:  '#27ae60',
  inkPrimary:    '#ddeeff', // HP numbers, die values
  inkSecondary:  '#8aaabb', // nav/back, active descriptors
  inkMuted:      '#5a7a8a', // phase text, sub-labels
  inkGhost:      '#2a3848', // version string, placeholders
  dieAttack:     '#ff4444',
  dieBlock:      '#3498db',
  dieBuff:       '#ff9900',
  dieCopy:       '#cc88ff',
  diePoison:     '#58d68d',
  intentLoaded:  '#e67e22',
  intentHustle:  '#bb44cc',
  intentRattle:  '#1abc9c',
  dangerPulse:   '#ff1100', // critical-HP overlay only (Danger Signal Rule)
};

// Typography hierarchy. letterSpacing fixed to the Three Spacings Rule: 0 / 3 / 6 only.
// title/label corrected here from legacy 2/1 to 3/0 per DESIGN.md's own next-pass note.
export const TYPE = {
  display: { fontFamily: FONT_DISPLAY, fontSize: '38px', fontStyle: 'bold', letterSpacing: 6 },
  header:  { fontFamily: FONT_DISPLAY, fontSize: '20px', fontStyle: 'bold', letterSpacing: 3 },
  title:   { fontFamily: FONT_DISPLAY, fontSize: '17px', fontStyle: 'bold', letterSpacing: 3 },
  body:    { fontFamily: 'system-ui, sans-serif', fontSize: '13px', letterSpacing: 0 },
  label:   { fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', letterSpacing: 0 },
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };

export const RADIUS = { none: 0, soft: 4 };

export const MOTION = {
  sceneFadeIn: 320,
  sceneFadeOut: 190,
  stepFadeOut: 160,
  stepFadeIn: 220,
  titleEntrance: 700,
  dangerPulse: 700,
  intentPop: 120,
  phaseCrossfadeOut: 80,
  phaseCrossfadeIn: 160,
  bumperFlash: 55,
  commitEntrance: 280,
  bumperGlow: 1100,
};

// Buttons: rectangular, flat fill + colored stroke, fill floods on hover.
export const BUTTON_VARIANTS = {
  primary: {
    bg: '#131320', bgHover: '#1e2840',
    stroke: true, strokeWidth: 2, strokeAlpha: 0.90, // strokeColor = accent param
    label: { fontFamily: FONT_DISPLAY, fontSize: '22px', fontStyle: 'bold', letterSpacing: 3 },
  },
  confirm: {
    bg: '#163824', bgHover: '#27ae60',
    stroke: true, strokeColor: COLORS.confirmGreen, strokeWidth: 1.5, strokeAlpha: 0.90,
    label: { fontFamily: 'system-ui, sans-serif', fontSize: '17px', fontStyle: 'bold', letterSpacing: 0 },
    textColor: '#aaffaa', textHoverColor: '#ffffff',
  },
  destructive: {
    bg: '#1a0a08', bgHover: '#1a0a08', stroke: false,
    label: { fontFamily: FONT_DISPLAY, fontSize: '14px', fontStyle: 'bold', letterSpacing: 3 },
    textColor: '#ee6644',
  },
  ghost: {
    bg: '#0a0a14', bgHover: '#141424',
    stroke: true, strokeColor: '#2a3a5a', strokeWidth: 1, strokeAlpha: 0.70,
    label: { fontFamily: 'system-ui, sans-serif', fontSize: '14px', letterSpacing: 0 },
    textColor: '#5a7a8a',
  },
};

export function hexNum(c) {
  return typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
}
