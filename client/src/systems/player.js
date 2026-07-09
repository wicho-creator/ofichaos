// player.js — Utilidades de jugador en el cliente

export const PLAYER_COLORS = {
  empleado: 0x4ade80,
  jefe: 0xef4444,
  lamebotas: 0xfacc15,
  unknown: 0x60a5fa
};

export function createPlayerSprite(scene, player, isLocal) {
  const color = isLocal ? 0x60a5fa : PLAYER_COLORS.unknown;
  const circle = scene.add.circle(player.x, player.y, 18, color, 0.8);
  circle.setStrokeStyle(3, 0xffffff);
  const label = scene.add.text(player.x, player.y - 28, player.name || '?', {
    fontSize: '12px',
    color: '#e0e0e0',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  // Halo de burnout
  const burnoutGlow = scene.add.circle(player.x, player.y, 22, 0xff4444, 0.0);
  burnoutGlow.setStrokeStyle(2, 0xff0000, 0);

  const container = scene.add.container(0, 0, [burnoutGlow, circle, label]);

  return { container, circle, label, burnoutGlow, player };
}

export function updatePlayerSprite(sprite, player) {
  if (!sprite || !player) return;
  sprite.container.x = player.x;
  sprite.container.y = player.y;
  sprite.label.setText(player.name || '?');

  if (player.burnout) {
    sprite.burnoutGlow.setFillStyle(0xff4444, 0.2);
    sprite.burnoutGlow.setStrokeStyle(2, 0xff0000, 0.5);
  } else {
    sprite.burnoutGlow.setFillStyle(0xff4444, 0.0);
    sprite.burnoutGlow.setStrokeStyle(2, 0xff0000, 0);
  }
}
