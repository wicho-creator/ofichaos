// player.js — Utilidades de jugador en el cliente

export const PLAYER_COLORS = {
  empleado: 0x4ade80,
  jefe: 0xef4444,
  lamebotas: 0xfacc15,
  unknown: 0x60a5fa
};

const ROLE_EMOJI = { empleado: '💼', jefe: '👔', lamebotas: '⭐', unknown: '🙂' };

export function createPlayerSprite(scene, player, isLocal) {
  const role = player.role || 'unknown';
  const color = isLocal ? 0x60a5fa : PLAYER_COLORS[role] || PLAYER_COLORS.unknown;
  const shadow = scene.add.ellipse(player.x, player.y + 18, 42, 12, 0x000000, 0.35);
  const body = scene.add.circle(player.x, player.y, 20, color, 0.95);
  body.setStrokeStyle(isLocal ? 4 : 3, isLocal ? 0xffffff : 0x111827);
  const face = scene.add.circle(player.x, player.y - 5, 12, 0xfff7ed, 1);
  const badge = scene.add.text(player.x, player.y - 5, ROLE_EMOJI[role] || ROLE_EMOJI.unknown, {
    fontSize: '16px'
  }).setOrigin(0.5);
  const label = scene.add.text(player.x, player.y - 34, player.name || '?', {
    fontSize: '12px',
    color: '#ffffff',
    fontStyle: 'bold',
    backgroundColor: '#00000066',
    padding: { x: 4, y: 2 }
  }).setOrigin(0.5);
  const burnoutGlow = scene.add.circle(player.x, player.y, 28, 0xff4444, 0.0);
  burnoutGlow.setStrokeStyle(2, 0xff0000, 0);
  const container = scene.add.container(0, 0, [shadow, burnoutGlow, body, face, badge, label]);
  return { container, shadow, body, face, badge, label, burnoutGlow, player };
}

export function updatePlayerSprite(sprite, player) {
  if (!sprite || !player) return;
  sprite.container.x = player.x;
  sprite.container.y = player.y;
  sprite.label.setText(player.name || '?');
  const role = player.role || 'unknown';
  sprite.badge.setText(ROLE_EMOJI[role] || ROLE_EMOJI.unknown);
  if (player.burnout) {
    sprite.burnoutGlow.setFillStyle(0xff4444, 0.22);
    sprite.burnoutGlow.setStrokeStyle(3, 0xff0000, 0.7);
    sprite.container.setAlpha(0.7);
  } else {
    sprite.burnoutGlow.setFillStyle(0xff4444, 0.0);
    sprite.burnoutGlow.setStrokeStyle(2, 0xff0000, 0);
    sprite.container.setAlpha(1);
  }
}
