export function sabotageMenuLayout(width, height, role, requestedPage = 0) {
  const panelW = Math.min(430, width - 24);
  const panelH = Math.min(500, height - 28);
  const panelX = width / 2;
  const panelY = height / 2;
  const top = panelY - panelH / 2;
  const veryCompact = height < 350;
  const compactLamebotas = role === 'lamebotas' && height < 560;
  const page = veryCompact
    ? Math.min(Math.max(requestedPage, 0), 2)
    : compactLamebotas ? Math.min(Math.max(requestedPage, 0), 1) : 0;
  const targets = [];
  const full = (id, y, height = 44) => targets.push({ id, x: panelX, y, width: panelW - 40, height });
  const grid = (id, index, startY) => {
    const gap = 10;
    const buttonW = (panelW - 50 - gap) / 2;
    const column = index % 2;
    targets.push({
      id,
      x: panelX + (column ? 1 : -1) * (buttonW + gap) / 2,
      y: startY + Math.floor(index / 2) * 48,
      width: buttonW,
      height: 44
    });
  };

  if (veryCompact) {
    const actions = role === 'lamebotas'
      ? ['fake', 'false-report', 'block-task', ...Array.from({ length: 8 }, (_, index) => `zone-${index}`)]
      : [...Array.from({ length: 8 }, (_, index) => `zone-${index}`), 'close-door'];
    actions.slice(page * 4, page * 4 + 4).forEach((id, index) => grid(id, index, top + 70));
    if (page > 0) grid('back', 0, top + 166);
    if (page < 2) grid('next', 1, top + 166);
  } else if (compactLamebotas && page === 0) {
    ['fake', 'false-report', 'block-task'].forEach((id, index) => full(id, top + 72 + index * 48));
    full('zones-page', top + 222);
  } else {
    const zonesStart = role === 'lamebotas' ? top + 70 : top + 80;
    if (role === 'lamebotas' && !compactLamebotas) {
      ['fake', 'false-report', 'block-task'].forEach((id, index) => full(id, top + 76 + index * 50));
      for (let index = 0; index < 8; index++) grid(`zone-${index}`, index, top + 246);
    } else {
      for (let index = 0; index < 8; index++) grid(`zone-${index}`, index, zonesStart);
    }
    if (compactLamebotas) full('back', top + 272);
    if (role === 'jefe') full('close-door', zonesStart + 4 * 48, 48);
  }

  full('cancel', panelY + panelH / 2 - 26);
  return { panelX, panelY, panelW, panelH, top, page, veryCompact, compactLamebotas, targets };
}
