// proposed_player.js — Clean programmatic sprite textures, animations and physics integration
// Proposed rewrite for client/src/systems/player.js

export const PLAYER_COLORS = {
  empleado: 0x4ade80,
  jefe: 0xef4444,
  lamebotas: 0xfacc15,
  unknown: 0x60a5fa
};

const ROLE_EMOJI = { empleado: '💼', jefe: '👔', lamebotas: '⭐', unknown: '🙂' };

/**
 * Draws a single frame of the office worker onto an HTML5 Canvas context.
 * Represents body (suit), V-neck shirt, necktie, head (skin, hair, eyes), and moving legs/arms.
 */
function drawWorkerFrame(ctx, w, h, colorStr, frameType) {
  // Clear canvas for transparency
  ctx.clearRect(0, 0, w, h);

  // Position references relative to 64x64 canvas
  let headX = 32;
  let headY = 18;
  let headR = 10;

  let bodyX = 32;
  let bodyY = 38;
  let bodyW = 24;
  let bodyH = 18;

  // Head/Body bobbing during walking frames
  if (frameType === 'walk1' || frameType === 'walk2') {
    headY += 2;
    bodyY += 1;
  }

  // --- 1. LEGS AND FEET (Drawn behind the body) ---
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1e293b'; // Dark blue-gray pants

  if (frameType === 'idle') {
    // Left Leg
    ctx.beginPath();
    ctx.moveTo(26, bodyY + 6);
    ctx.lineTo(26, bodyY + 20);
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(38, bodyY + 6);
    ctx.lineTo(38, bodyY + 20);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#0f172a'; // Black/dark shoes
    ctx.beginPath();
    ctx.arc(24, bodyY + 20, 3, 0, Math.PI * 2); // left shoe
    ctx.arc(40, bodyY + 20, 3, 0, Math.PI * 2); // right shoe
    ctx.fill();

  } else if (frameType === 'walk1') {
    // Left leg forward/left
    ctx.beginPath();
    ctx.moveTo(26, bodyY + 6);
    ctx.lineTo(20, bodyY + 20);
    ctx.stroke();

    // Right leg back/right
    ctx.beginPath();
    ctx.moveTo(38, bodyY + 6);
    ctx.lineTo(42, bodyY + 18);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(18, bodyY + 20, 3, 0, Math.PI * 2);
    ctx.arc(44, bodyY + 18, 3, 0, Math.PI * 2);
    ctx.fill();

  } else if (frameType === 'walk2') {
    // Left leg back/left
    ctx.beginPath();
    ctx.moveTo(26, bodyY + 6);
    ctx.lineTo(22, bodyY + 18);
    ctx.stroke();

    // Right leg forward/right
    ctx.beginPath();
    ctx.moveTo(38, bodyY + 6);
    ctx.lineTo(44, bodyY + 20);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(20, bodyY + 18, 3, 0, Math.PI * 2);
    ctx.arc(46, bodyY + 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- 2. TORSO (Suit Jacket) ---
  ctx.fillStyle = colorStr;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;

  ctx.beginPath();
  const rx = bodyX - bodyW / 2;
  const ry = bodyY - bodyH / 2;
  if (ctx.roundRect) {
    ctx.roundRect(rx, ry, bodyW, bodyH, 5);
  } else {
    ctx.rect(rx, ry, bodyW, bodyH);
  }
  ctx.fill();
  ctx.stroke();

  // --- 3. SHIRT COLLAR & TIE ---
  // V-Neck White Shirt
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(bodyX - 4, ry);
  ctx.lineTo(bodyX + 4, ry);
  ctx.lineTo(bodyX, ry + 6);
  ctx.closePath();
  ctx.fill();

  // Red Tie
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(bodyX - 1.5, ry + 4);
  ctx.lineTo(bodyX + 1.5, ry + 4);
  ctx.lineTo(bodyX + 2.5, ry + 13);
  ctx.lineTo(bodyX, ry + 16);
  ctx.lineTo(bodyX - 2.5, ry + 13);
  ctx.closePath();
  ctx.fill();

  // --- 4. ARMS (Side coat sleeves) ---
  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  if (frameType === 'idle') {
    // Left arm down
    ctx.beginPath();
    ctx.moveTo(bodyX - bodyW / 2 + 1, ry + 4);
    ctx.lineTo(bodyX - bodyW / 2 - 2, ry + 14);
    ctx.stroke();

    // Right arm down
    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW / 2 - 1, ry + 4);
    ctx.lineTo(bodyX + bodyW / 2 + 2, ry + 14);
    ctx.stroke();
  } else if (frameType === 'walk1') {
    // Left arm back, right arm forward
    ctx.beginPath();
    ctx.moveTo(bodyX - bodyW / 2 + 1, ry + 4);
    ctx.lineTo(bodyX - bodyW / 2 - 4, ry + 11);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW / 2 - 1, ry + 4);
    ctx.lineTo(bodyX + bodyW / 2 + 5, ry + 13);
    ctx.stroke();
  } else if (frameType === 'walk2') {
    // Left arm forward, right arm back
    ctx.beginPath();
    ctx.moveTo(bodyX - bodyW / 2 + 1, ry + 4);
    ctx.lineTo(bodyX - bodyW / 2 - 5, ry + 13);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW / 2 - 1, ry + 4);
    ctx.lineTo(bodyX + bodyW / 2 + 4, ry + 11);
    ctx.stroke();
  }

  // --- 5. HEAD ---
  ctx.fillStyle = '#ffedd5'; // Light peach skin tone
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // --- 6. EYES & HAIR ---
  // Dark blue-black eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(headX - 3.5, headY - 1, 1.5, 0, Math.PI * 2);
  ctx.arc(headX + 3.5, headY - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Slate-gray hair on top
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(headX, headY, headR, Math.PI * 1.15, Math.PI * 1.85);
  ctx.closePath();
  ctx.fill();
}

/**
 * Ensures all programmatic texture frames and animations exist in the Phaser texture/animation managers.
 */
export function setupPlayerTexturesAndAnims(scene) {
  const colorMap = {
    local: '#60a5fa',      // Bright blue
    empleado: '#4ade80',   // Green
    jefe: '#ef4444',       // Red
    lamebotas: '#facc15',   // Yellow
    unknown: '#60a5fa'     // Default blue
  };

  const w = 64;
  const h = 64;

  Object.entries(colorMap).forEach(([key, color]) => {
    const idleKey = `player_${key}_idle`;
    const walk1Key = `player_${key}_walk1`;
    const walk2Key = `player_${key}_walk2`;

    // 1. Create Texture Canvas frames if not already registered
    const makeFrame = (frameKey, frameType) => {
      if (!scene.textures.exists(frameKey)) {
        const canvasTex = scene.textures.createCanvas(frameKey, w, h);
        drawWorkerFrame(canvasTex.context, w, h, color, frameType);
        canvasTex.refresh();
      }
    };

    makeFrame(idleKey, 'idle');
    makeFrame(walk1Key, 'walk1');
    makeFrame(walk2Key, 'walk2');

    // 2. Create Animations
    const idleAnimKey = `anim_${key}_idle`;
    const walkAnimKey = `anim_${key}_walk`;

    if (!scene.anims.exists(idleAnimKey)) {
      scene.anims.create({
        key: idleAnimKey,
        frames: [{ key: idleKey }],
        frameRate: 1,
        repeat: 0
      });
    }

    if (!scene.anims.exists(walkAnimKey)) {
      scene.anims.create({
        key: walkAnimKey,
        frames: [
          { key: walk1Key },
          { key: idleKey },
          { key: walk2Key },
          { key: idleKey }
        ],
        frameRate: 8,
        repeat: -1
      });
    }
  });
}

/**
 * Creates the client-side player container representing the office worker.
 */
export function createPlayerSprite(scene, player, isLocal) {
  const role = player.role || 'unknown';
  const animKeySuffix = isLocal ? 'local' : role;

  // Initialize textures & animations dynamically
  setupPlayerTexturesAndAnims(scene);

  // Components: shadow, character sprite, badge text, name label, and burnout glow
  const shadow = scene.add.ellipse(0, 22, 38, 10, 0x000000, 0.3);
  
  const charSprite = scene.add.sprite(0, 0, `player_${animKeySuffix}_idle`);
  charSprite.play(`anim_${animKeySuffix}_idle`);

  // Role Emoji Badge (drawn slightly above head)
  const badge = scene.add.text(0, -22, ROLE_EMOJI[role] || ROLE_EMOJI.unknown, {
    fontSize: '14px'
  }).setOrigin(0.5);

  // Player Name Label (drawn further above head)
  const label = scene.add.text(0, -38, player.name || '?', {
    fontSize: '11px',
    color: '#ffffff',
    fontStyle: 'bold',
    backgroundColor: '#00000077',
    padding: { x: 5, y: 2 }
  }).setOrigin(0.5);

  // Burnout Glow effect
  const burnoutGlow = scene.add.circle(0, 4, 30, 0xff4444, 0.0);
  burnoutGlow.setStrokeStyle(2, 0xff0000, 0);

  const container = scene.add.container(player.x, player.y, [shadow, burnoutGlow, charSprite, badge, label]);

  // physics container setups (centered collision shape)
  if (isLocal) {
    scene.physics.add.existing(container);
    container.body.setCircle(18, -18, -12); // Fit collider snugly on body feet base
    container.body.setCollideWorldBounds(true);
  }

  return { 
    container, 
    shadow, 
    charSprite, 
    badge, 
    label, 
    burnoutGlow, 
    player, 
    isLocal,
    prevX: player.x,
    prevY: player.y
  };
}

/**
 * Updates player sprite position, text values, burnout indicators, flipX, and walking animations.
 */
export function updatePlayerSprite(sprite, player, isLocal) {
  if (!sprite || !player) return;

  // Sync server position if remote
  if (!isLocal) {
    sprite.container.x = player.x;
    sprite.container.y = player.y;
  }

  sprite.label.setText(player.name || '?');
  const role = player.role || 'unknown';
  sprite.badge.setText(ROLE_EMOJI[role] || ROLE_EMOJI.unknown);

  // Determine movement velocity direction
  let vx = 0;
  let vy = 0;
  if (isLocal && sprite.container.body) {
    vx = sprite.container.body.velocity.x;
    vy = sprite.container.body.velocity.y;
  } else {
    // Remote client interpolation movement delta calculation
    const prevX = sprite.prevX !== undefined ? sprite.prevX : player.x;
    const prevY = sprite.prevY !== undefined ? sprite.prevY : player.y;
    vx = player.x - prevX;
    vy = player.y - prevY;
    sprite.prevX = player.x;
    sprite.prevY = player.y;
  }

  const isMoving = Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5;
  const animKeySuffix = isLocal ? 'local' : role;

  if (sprite.charSprite) {
    if (isMoving) {
      sprite.charSprite.play(`anim_${animKeySuffix}_walk`, true);
      // Flip texture depending on horizontal walking direction
      if (vx < -0.5) {
        sprite.charSprite.setFlipX(true);
      } else if (vx > 0.5) {
        sprite.charSprite.setFlipX(false);
      }
    } else {
      sprite.charSprite.play(`anim_${animKeySuffix}_idle`, true);
    }
  }

  // Handle burnout glow state visual overlays
  if (player.burnout) {
    sprite.burnoutGlow.setFillStyle(0xff4444, 0.2);
    sprite.burnoutGlow.setStrokeStyle(3, 0xff0000, 0.65);
    sprite.container.setAlpha(0.75);
  } else {
    sprite.burnoutGlow.setFillStyle(0xff4444, 0.0);
    sprite.burnoutGlow.setStrokeStyle(2, 0xff0000, 0);
    sprite.container.setAlpha(1.0);
  }
}
