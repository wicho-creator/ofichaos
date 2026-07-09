// ui.js — Funciones de UI para crear botones y paneles en Phaser

export function createButton(scene, x, y, text, callback, style = {}) {
  const width = style.width || 200;
  const height = style.height || 50;
  const bgColor = style.bgColor || 0x4c1d95;
  const bgHover = style.bgHover || 0x6d28d9;
  const textColor = style.textColor || '#ffffff';
  const fontSize = style.fontSize || '18px';

  const bg = scene.add.rectangle(x, y, width, height, bgColor).setStrokeStyle(2, 0xffffff);
  const label = scene.add.text(x, y, text, { fontSize, color: textColor, fontStyle: 'bold' }).setOrigin(0.5);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(bgHover));
  bg.on('pointerout', () => bg.setFillStyle(bgColor));
  bg.on('pointerdown', callback);
  return { bg, label };
}

export function createPanel(scene, x, y, w, h, bgColor = 0x1e293b) {
  const panel = scene.add.rectangle(x, y, w, h, bgColor, 0.9).setStrokeStyle(2, 0x475569);
  return panel;
}

export function createText(scene, x, y, text, style = {}) {
  return scene.add.text(x, y, text, {
    fontSize: style.fontSize || '14px',
    color: style.color || '#e0e0e0',
    fontStyle: style.bold ? 'bold' : 'normal',
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
