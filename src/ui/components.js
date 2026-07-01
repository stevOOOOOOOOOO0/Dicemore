// Shared Phaser draw-factories for the Devil's Parlor system. Pure functions — no scene state.
import { W, H, FONT_DISPLAY } from '../constants.js';
import { DIE_TYPES } from '../data/dice.js';
import { COLORS, TYPE, RADIUS, BUTTON_VARIANTS, hexNum } from './theme.js';

// Rectangular button: Graphics for the rounded fill+stroke, a transparent Rectangle for the
// hit area (Graphics objects can't be made interactive with a rect hit zone directly), text label.
export function makeButton(scene, x, y, w, h, opts = {}) {
  const { variant = 'primary', label = '', accent, onTap, depth } = opts;
  const v = BUTTON_VARIANTS[variant];
  const strokeColor = v.strokeColor ?? accent;
  const textColor = v.textColor ?? accent;
  const textHoverColor = v.textHoverColor ?? textColor;

  const g = scene.add.graphics();
  const redraw = (hover) => {
    g.clear();
    g.fillStyle(hexNum(hover ? v.bgHover : v.bg), 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, RADIUS.soft);
    if (v.stroke) {
      g.lineStyle(v.strokeWidth, hexNum(strokeColor), v.strokeAlpha);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, RADIUS.soft);
    }
  };
  redraw(false);

  const txt = scene.add.text(x, y, label, { ...v.label, color: textColor }).setOrigin(0.5);
  const hit = scene.add.rectangle(x, y, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });

  if (depth != null) { g.setDepth(depth); txt.setDepth(depth + 1); hit.setDepth(depth + 2); }

  hit.on('pointerover', () => { redraw(true); txt.setColor(textHoverColor); });
  hit.on('pointerout',  () => { redraw(false); txt.setColor(textColor); });
  if (onTap) hit.on('pointerdown', onTap);

  return { g, txt, hit, setLabel: s => txt.setText(s) };
}

// Flat bordered panel — the repeated card/panel fill pattern. Returns the Graphics object.
export function makePanel(scene, x, y, w, h, opts = {}) {
  const {
    fill = COLORS.panelVoid, fillAlpha = 1,
    stroke = COLORS.inkGhost, strokeWidth = 1.5, strokeAlpha = 0.7,
    radius = RADIUS.soft, depth,
  } = opts;
  const g = scene.add.graphics();
  if (depth != null) g.setDepth(depth);
  g.fillStyle(hexNum(fill), fillAlpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  if (strokeWidth > 0) {
    g.lineStyle(strokeWidth, hexNum(stroke), strokeAlpha);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }
  return g;
}

// Dim-overlay + panel + optional title. Returns { container, contentY, destroy }.
// contentY is the y-coordinate just below the title (or panel top) to start placing content.
export function makeModal(scene, opts = {}) {
  const {
    w = 280, h = 200, title, depth = 90, dimAlpha = 0.70,
    panelFill = COLORS.panelVoid, panelStroke = COLORS.inkGhost,
    closeOnDimTap = true, onClose,
  } = opts;

  const container = scene.add.container(0, 0).setDepth(depth);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, dimAlpha).setInteractive();
  container.add(dim);

  const panel = makePanel(scene, W / 2, H / 2, w, h, {
    fill: panelFill, fillAlpha: 0.98, stroke: panelStroke, strokeWidth: 2,
  });
  container.add(panel);

  let contentY = H / 2 - h / 2 + 24;
  if (title) {
    const t = scene.add.text(W / 2, contentY, title, TYPE.header).setOrigin(0.5, 0);
    container.add(t);
    contentY += 36;
  }

  const destroy = () => container.destroy();
  if (closeOnDimTap) {
    dim.on('pointerdown', () => { destroy(); if (onClose) onClose(); });
  }

  return { container, contentY, destroy };
}

// Auto-centering row of status pills. items: [{ label, color }]. Returns a Container (destroy() to clear).
export function makeStatusPillRow(scene, x, y, items, opts = {}) {
  const container = scene.add.container(x, y);
  if (!items || !items.length) return container;

  const { height = 18, gap = 5, fontSize = 12, depth } = opts;
  if (depth != null) container.setDepth(depth);

  const pills = items.map(it => {
    const txt = scene.add.text(0, 0, it.label, {
      fontFamily: 'system-ui, sans-serif', fontSize: `${fontSize}px`, fontStyle: 'bold', color: it.color,
    }).setOrigin(0.5);
    const pw = txt.width + 14;
    const bg = scene.add.graphics();
    bg.fillStyle(hexNum(it.color), 0.20);
    bg.fillRoundedRect(-pw / 2, -height / 2, pw, height, RADIUS.soft);
    bg.lineStyle(1.5, hexNum(it.color), 0.75);
    bg.strokeRoundedRect(-pw / 2, -height / 2, pw, height, RADIUS.soft);
    return { bg, txt, pw };
  });

  const totalW = pills.reduce((s, p) => s + p.pw, 0) + gap * (pills.length - 1);
  let cursor = -totalW / 2;
  pills.forEach(p => {
    const px = cursor + p.pw / 2;
    p.bg.setPosition(px, 0);
    p.txt.setPosition(px, 0);
    container.add([p.bg, p.txt]);
    cursor += p.pw + gap;
  });

  return container;
}

// Geometric die-shape iconography (not physics dice — used in class cards, inspectors, etc).
// d4 -> triangle, d6 -> square, d8 -> diamond; other side counts fall back to a circle.
export function drawDieShape(gfx, px, py, S, dieType, sides) {
  const colorStr = DIE_TYPES[dieType]?.color ?? '#777777';
  const c = hexNum(colorStr);
  gfx.fillStyle(c, 0.18);
  gfx.lineStyle(1.5, c, 0.85);

  if (sides === 4) {
    const pts = [px, py - S * 0.58, px - S * 0.52, py + S * 0.42, px + S * 0.52, py + S * 0.42];
    gfx.fillTriangle(...pts);
    gfx.strokeTriangle(...pts);
  } else if (sides === 6) {
    const h = S * 0.46;
    gfx.fillRect(px - h, py - h, h * 2, h * 2);
    gfx.strokeRect(px - h, py - h, h * 2, h * 2);
  } else if (sides === 8) {
    const hw = S * 0.46, hh = S * 0.58;
    const pts = [{ x: px, y: py - hh }, { x: px + hw, y: py }, { x: px, y: py + hh }, { x: px - hw, y: py }];
    gfx.fillPoints(pts, true);
    gfx.strokePoints(pts, true);
  } else {
    gfx.fillCircle(px, py, S * 0.46);
    gfx.strokeCircle(px, py, S * 0.46);
  }
}

// Physics-body bumper: glow ring + base fill + outline ring. Clears and redraws onto the given Graphics.
export function drawBumper(gfx, x, y, r, color, opts = {}) {
  const { fill = COLORS.panelVoid, fillAlpha = 0.92, ringAlpha = 0.90, glowAlpha = 0.30, clear = true } = opts;
  if (clear) gfx.clear();
  const c = hexNum(color);
  gfx.lineStyle(4, c, glowAlpha);
  gfx.strokeCircle(x, y, r + 4);
  gfx.fillStyle(hexNum(fill), fillAlpha);
  gfx.fillCircle(x, y, r);
  gfx.lineStyle(2, c, ringAlpha);
  gfx.strokeCircle(x, y, r);
}

// Floating damage/heal/status text — rises and fades, self-destroys.
export function floatText(scene, x, y, msg, color, opts = {}) {
  const { fontSize = 20, rise = 36, duration = 700, depth = 95 } = opts;
  const txt = scene.add.text(x, y, msg, {
    fontFamily: FONT_DISPLAY, fontSize: `${fontSize}px`, fontStyle: 'bold', color,
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(depth);
  scene.tweens.add({
    targets: txt, y: y - rise, alpha: 0, duration, ease: 'Sine.Out',
    onComplete: () => txt.destroy(),
  });
  return txt;
}

// Cross-fade phase-text update: fade out, swap text, fade in. Tracks its own tween on the object.
export function setPhaseText(scene, textObj, str, opts = {}) {
  const { outDuration = 80, inDuration = 160 } = opts;
  const prev = textObj.getData('xfTween');
  if (prev) prev.stop();
  const tw = scene.tweens.add({
    targets: textObj, alpha: 0, duration: outDuration,
    onComplete: () => {
      textObj.setText(str);
      scene.tweens.add({ targets: textObj, alpha: 1, duration: inDuration });
    },
  });
  textObj.setData('xfTween', tw);
}
