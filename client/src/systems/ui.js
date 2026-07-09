// ui.js — Componentes visuales estilo juego para OfiChaos

export function createButton(scene, x, y, text, callback, style = {}) {
  const width = style.width || 200;
  const height = style.height || 50;
  const bgColor = style.bgColor || 0x4c1d95;
  const bgHover = style.bgHover || 0x6d28d9;
  const textColor = style.textColor || '#ffffff';
  const fontSize = style.fontSize || '18px';
  const radius = style.radius || 16;

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.28);
  shadow.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 6, width, height, radius);

  const bg = scene.add.graphics();
  const draw = (color, lift = 0) => {
    bg.clear();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(x - width / 2, y - height / 2 - lift, width, height, radius);
    bg.lineStyle(3, 0xffffff, 0.72);
    bg.strokeRoundedRect(x - width / 2, y - height / 2 - lift, width, height, radius);
    bg.lineStyle(2, 0x000000, 0.22);
    bg.strokeRoundedRect(x - width / 2 + 4, y - height / 2 + 4 - lift, width - 8, height - 8, Math.max(8, radius - 4));
  };
  draw(bgColor);

  const hit = scene.add.zone(x, y, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });
  const label = scene.add.text(x, y - 1, text, {
    fontSize,
    color: textColor,
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5);

  hit.on('pointerover', () => { draw(bgHover, 2); label.y = y - 3; });
  hit.on('pointerout', () => { draw(bgColor, 0); label.y = y - 1; });
  hit.on('pointerdown', callback);

  const destroyGraphics = bg.destroy.bind(bg);
  bg.destroy = () => {
    if (hit.active) hit.destroy();
    if (shadow.active) shadow.destroy();
    destroyGraphics();
  };

  return { bg, label, hit, shadow };
}

export function createPanel(scene, x, y, w, h, bgColor = 0x1e293b, style = {}) {
  const radius = style.radius || 22;
  const panel = scene.add.graphics();
  panel.fillStyle(0x000000, 0.22);
  panel.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 8, w, h, radius);
  panel.fillStyle(bgColor, style.alpha ?? 0.92);
  panel.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  panel.lineStyle(style.strokeWidth || 3, style.strokeColor || 0xfbbf24, style.strokeAlpha ?? 0.38);
  panel.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  panel.lineStyle(2, 0xffffff, 0.12);
  panel.strokeRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, Math.max(10, radius - 6));
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
