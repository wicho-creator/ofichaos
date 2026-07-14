// ui.js — Componentes visuales estilo juego para OfiChaos

export function createButton(scene, x, y, text, callback, style = {}) {
  let width = style.width || 200;
  let height = style.height || 50;
  const bgColor = style.bgColor || 0x4c1d95;
  const bgHover = style.bgHover || 0x6d28d9;
  const textColor = style.textColor || '#ffffff';
  const fontSize = style.fontSize || '18px';
  const radius = style.radius || 16;

  const shadow = scene.add.graphics();
  const bg = scene.add.graphics();
  const hit = scene.add.zone(x, y, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });
  const label = scene.add.text(x, y - 1, text, {
    fontSize,
    color: textColor,
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5);

  const drawShadow = (w, h) => {
    shadow.clear();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, radius);
  };

  const drawBg = (color, w, h, lift = 0) => {
    bg.clear();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2 - lift, w, h, radius);
    bg.lineStyle(3, 0xffffff, 0.72);
    bg.strokeRoundedRect(-w / 2, -h / 2 - lift, w, h, radius);
    bg.lineStyle(2, 0x000000, 0.22);
    bg.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4 - lift, w - 8, h - 8, Math.max(8, radius - 4));
  };

  const setPositionAndSize = (px, py, pw, ph) => {
    width = pw !== undefined ? pw : width;
    height = ph !== undefined ? ph : height;

    shadow.x = px;
    shadow.y = py;
    drawShadow(width, height);

    bg.x = px;
    bg.y = py;
    drawBg(bgColor, width, height, 0);

    if (hit.setPosition) {
      hit.setPosition(px, py);
    } else {
      hit.x = px;
      hit.y = py;
    }

    if (hit.setSize) {
      hit.setSize(width, height);
    } else {
      hit.w = width;
      hit.h = height;
    }

    if (label.setPosition) {
      label.setPosition(px, py - 1);
    } else {
      label.x = px;
      label.y = py - 1;
    }
  };

  setPositionAndSize(x, y, width, height);

  hit.on('pointerover', () => { drawBg(bgHover, width, height, 2); label.y = hit.y - 3; });
  hit.on('pointerout', () => { drawBg(bgColor, width, height, 0); label.y = hit.y - 1; });
  hit.on('pointerdown', callback);

  const destroyGraphics = bg.destroy.bind(bg);
  bg.destroy = () => {
    if (hit.active) hit.destroy();
    if (shadow.active) shadow.destroy();
    destroyGraphics();
  };

  return { bg, label, hit, shadow, setPositionAndSize };
}

export function createPanel(scene, x, y, w, h, bgColor = 0x1e293b, style = {}) {
  const radius = style.radius || 22;
  const panel = scene.add.graphics();

  panel.drawPanel = (px, py, pw, ph) => {
    panel.clear();
    panel.x = px;
    panel.y = py;
    panel.fillStyle(0x000000, 0.22);
    panel.fillRoundedRect(-pw / 2 + 6, -ph / 2 + 8, pw, ph, radius);
    panel.fillStyle(bgColor, style.alpha ?? 0.92);
    panel.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, radius);
    panel.lineStyle(style.strokeWidth || 3, style.strokeColor || 0xfbbf24, style.strokeAlpha ?? 0.38);
    panel.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, radius);
    panel.lineStyle(2, 0xffffff, 0.12);
    panel.strokeRoundedRect(-pw / 2 + 6, -ph / 2 + 6, pw - 12, ph - 12, Math.max(10, radius - 6));
  };

  panel.drawPanel(x, y, w, h);
  return panel;
}

export function createText(scene, x, y, text, style = {}) {
  return scene.add.text(x, y, text, {
    fontSize: style.fontSize || '14px',
    color: style.color || '#e0e0e0',
    fontStyle: style.bold ? 'bold' : 'normal',
    align: style.align || 'left',
    wordWrap: { width: style.wrap || 300 }
  }).setOrigin(style.origin || 0);
}

export function updateBar(scene, x, y, width, height, percent, bgColor, fillColor) {
  const bg = scene.add.rectangle(x, y, width, height, bgColor).setStrokeStyle(1, 0x334155);
  const fill = scene.add.rectangle(
    x - width / 2 + (width * percent) / 200,
    y,
    width * (percent / 100),
    height,
    fillColor
  );
  fill.setOrigin(0.5);
  return { bg, fill };
}
