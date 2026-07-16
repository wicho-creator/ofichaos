// theme.js — Tokens y geometría compartida para las pantallas sociales de OfiChaos.
export const COLORS = Object.freeze({
  primary: 0x2563eb,
  primaryLight: 0x60a5fa,
  ink: 0x172554,
  border: 0x15203a,
  background: 0xdbeafe,
  surface: 0xf8fafc,
  white: 0xffffff,
  muted: 0x64748b,
  neutral: 0xcbd5e1,
  sabotage: 0xf05a5a,
  sabotageAccessible: 0xd83a4a,
  task: 0xf6c344,
  success: 0x22c55e,
  disabled: 0x94a3b8
});

export const CSS_COLORS = Object.freeze(
  Object.fromEntries(Object.entries(COLORS).map(([key, value]) => [key, `#${value.toString(16).padStart(6, '0')}`]))
);

export const FONT = Object.freeze({
  display: 'ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif',
  body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
});

export const SPACE = Object.freeze({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 });
export const RADIUS = Object.freeze({ sm: 8, md: 12, lg: 16 });
export const MIN_PLAYERS = 4;

export function gameHudLayout(width, height) {
  const mobile = width < 600;
  const safe = mobile ? 18 : 24;
  return Object.freeze({
    mobile,
    safe,
    header: Object.freeze({
      x: width / 2,
      y: mobile ? 38 : 46,
      width: mobile ? width - safe * 2 : Math.min(690, width - 120),
      height: mobile ? 58 : height < 700 ? 56 : 68
    }),
    dpad: Object.freeze({ x: safe + 66, y: height - safe - 66 }),
    actions: Object.freeze({ x: width - safe - 52, y: height - safe - 52 }),
    showRolePanel: !mobile,
    showTaskList: !mobile
  });
}

export function meetingLayout(width, height, playerCount = 4) {
  const mobile = width < 760;
  const short = height < 700;
  const safe = width < 400 ? 12 : 16;
  const panelWidth = mobile ? width - safe * 2 : Math.min(960, width - safe * 2);
  const panelHeight = mobile ? height - safe * 2 : Math.min(680, height - safe * 2);
  const panel = Object.freeze({ x: width / 2, y: height / 2, width: panelWidth, height: panelHeight });
  const top = panel.y - panel.height / 2;
  const left = panel.x - panel.width / 2;
  const titleY = top + (mobile ? 24 : 34);
  const timer = Object.freeze({
    x: panel.x,
    y: top + (mobile ? 62 : 76),
    width: panel.width - (mobile ? 32 : 80),
    height: 10
  });

  if (mobile) {
    const chatHeight = short ? 112 : 176;
    const chatTop = top + 96;
    const chat = Object.freeze({ x: panel.x, y: chatTop + chatHeight / 2, width: panel.width - 32, height: chatHeight });
    const input = Object.freeze({ x: panel.x, y: chatTop + chatHeight + 28, width: chat.width, height: 44 });
    const gapX = 8;
    const gapY = 8;
    const cardWidth = (panel.width - 24 - gapX) / 2;
    const cardHeight = short ? 58 : 64;
    const cardsTop = input.y + input.height / 2 + 20;
    const cards = Object.freeze({
      x: left + 12 + cardWidth / 2,
      y: cardsTop + cardHeight / 2,
      width: cardWidth,
      height: cardHeight,
      gapX,
      gapY,
      columns: 2
    });
    const rows = Math.ceil(Math.min(playerCount, 4) / 2);
    const skipY = cardsTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + 24;
    return Object.freeze({
      mobile,
      short,
      safe,
      panel,
      titleY,
      timer,
      chat,
      input,
      cards,
      visiblePlayers: Math.min(playerCount, 4),
      skip: Object.freeze({ x: panel.x, y: skipY, width: panel.width - 36, height: 42 })
    });
  }

  const contentTop = top + 126;
  const columnWidth = (panel.width - 92) / 2;
  const chat = Object.freeze({ x: left + 32 + columnWidth / 2, y: contentTop + 196, width: columnWidth, height: 360 });
  const input = Object.freeze({ x: chat.x, y: chat.y + chat.height / 2 + 32, width: columnWidth, height: 46 });
  const cardWidth = (columnWidth - 14) / 2;
  const cards = Object.freeze({
    x: panel.x + 14 + cardWidth / 2,
    y: contentTop + 42,
    width: cardWidth,
    height: 76,
    gapX: 14,
    gapY: 14,
    columns: 2
  });
  return Object.freeze({
    mobile,
    short,
    safe,
    panel,
    titleY,
    timer,
    chat,
    input,
    cards,
    visiblePlayers: Math.min(playerCount, 4),
    skip: Object.freeze({ x: panel.x + panel.width / 4, y: top + panel.height - 54, width: columnWidth, height: 42 })
  });
}

export function lobbyLayout(width, height) {
  const mobile = width < 680;
  const short = height < 700;
  const margin = width < 400 ? 12 : 16;
  const cardWidth = Math.min(mobile ? width - margin * 2 : 600, 600);
  const cardTop = mobile ? (short ? 82 : 112) : 116;
  const naturalBottom = cardTop + (short ? 544 : mobile ? 620 : 620);
  const cardBottom = Math.min(height - margin, naturalBottom);
  const formY = cardTop + (short ? 54 : 66);
  const infoY = mobile ? formY + (short ? 298 : 335) : cardTop + (short ? 280 : 310);
  const listY = infoY + (short ? 36 : 42);
  return {
    mobile,
    short,
    margin,
    centerX: width / 2,
    brandY: mobile ? 22 : 28,
    card: { x: width / 2, y: (cardTop + cardBottom) / 2, width: cardWidth, height: cardBottom - cardTop },
    formY,
    infoY,
    listY,
    maxRows: Math.max(2, Math.min(12, Math.floor((cardBottom - listY - 72) / 24)))
  };
}

export function endLayout(width, height, playerCount = 4) {
  const mobile = width < 680;
  const short = height < 700;
  const margin = width < 400 ? 12 : 16;
  const cardTop = mobile ? 72 : 88;
  const cardBottomMax = height - margin;
  const cardWidth = Math.min(mobile ? width - margin * 2 : 680, 680);
  const rowHeight = short ? 29 : 34;
  const titleY = cardTop + (short ? 24 : 32);
  const resultY = cardTop + (short ? 54 : 70);
  const reasonY = cardTop + (short ? 126 : 138);
  const listY = cardTop + (short ? 170 : 192);
  const maxActionsY = cardBottomMax - (short ? 32 : 36);
  const availableRows = Math.max(2, Math.floor((maxActionsY - listY - 68) / rowHeight));
  const visibleRows = Math.min(playerCount, availableRows);
  const naturalActionsY = listY + 54 + visibleRows * rowHeight + 42;
  const actionsY = Math.min(maxActionsY, naturalActionsY);
  const cardBottom = Math.min(cardBottomMax, actionsY + 42);
  return {
    mobile,
    short,
    margin,
    centerX: width / 2,
    brandY: 18,
    card: { x: width / 2, y: (cardTop + cardBottom) / 2, width: cardWidth, height: cardBottom - cardTop },
    titleY,
    resultY,
    reasonY,
    listY,
    rowHeight,
    visibleRows,
    actionsY
  };
}

export function drawOfficeBackdrop(scene, width, height, mood = 'lobby') {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.background).fillRect(0, 0, width, height);
  const floorY = Math.round(height * 0.68);
  g.fillStyle(mood === 'defeat' ? 0xfbd5d5 : 0xbfdcf7).fillRect(0, floorY, width, height - floorY);
  g.lineStyle(3, COLORS.ink, 0.14).lineBetween(0, floorY, width, floorY);

  // Silueta procedural de oficina: ventanas, archivadores y escritorios exagerados.
  const unit = Math.max(72, Math.min(132, width / 4));
  for (let x = -unit * 0.25; x < width + unit; x += unit * 1.35) {
    g.fillStyle(COLORS.white, 0.46).fillRoundedRect(x, floorY - unit * 1.35, unit, unit * 0.72, 10);
    g.lineStyle(3, COLORS.ink, 0.1).strokeRoundedRect(x, floorY - unit * 1.35, unit, unit * 0.72, 10);
    g.lineBetween(x + unit / 2, floorY - unit * 1.35, x + unit / 2, floorY - unit * 0.63);
    g.fillStyle(COLORS.ink, 0.1).fillRoundedRect(x - 12, floorY + unit * 0.14, unit * 1.2, unit * 0.28, 8);
    g.fillStyle(COLORS.primary, 0.12).fillRoundedRect(x + 10, floorY - 12, unit * 0.56, unit * 0.25, 6);
    g.fillStyle(COLORS.task, 0.35).fillCircle(x + unit * 0.78, floorY + 2, 10);
  }
  return g;
}

export function drawPanel(scene, box) {
  const g = scene.add.graphics();
  const left = box.x - box.width / 2;
  const top = box.y - box.height / 2;
  g.fillStyle(COLORS.ink, 0.18).fillRoundedRect(left + 6, top + 7, box.width, box.height, RADIUS.lg);
  g.fillStyle(COLORS.white).fillRoundedRect(left, top, box.width, box.height, RADIUS.lg);
  g.lineStyle(3, COLORS.border, 1).strokeRoundedRect(left, top, box.width, box.height, RADIUS.lg);
  return g;
}

export function textStyle(size, color = CSS_COLORS.ink, bold = false, align = 'left') {
  return { fontFamily: FONT.body, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', align };
}
