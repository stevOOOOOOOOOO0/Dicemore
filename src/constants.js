export const W = 400;
export const H = 700;

// Layout
export const SURFACE_TOP    = 80;
export const SURFACE_BOTTOM = 640;
export const SURFACE_LEFT   = 0;
export const SURFACE_RIGHT  = 400;
export const SURFACE_MID_Y  = (SURFACE_TOP + SURFACE_BOTTOM) / 2;
export const DIE_STRIP_Y    = 670;  // solid footer strip below surface

export const DIE_SIZE = 44;
export const WALL_T   = 24;

// Physics
export const DIE_FRICTION     = 0.5;
export const DIE_FRICTION_AIR = 0.027;
export const DIE_BOUNCE       = 0.85;
export const SETTLE_VEL       = 0.4;   // px/frame — below this = settled
export const MAX_THROW_SPEED  = 20;

// Game
export const PLAYER_MAX_HP = 30; // base value — relics can increase the per-run effective max

// Typography
export const FONT_DISPLAY = '"Cinzel", serif';
