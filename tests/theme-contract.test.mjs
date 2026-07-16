import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, MIN_PLAYERS, endLayout, gameHudLayout, lobbyLayout, meetingLayout } from '../client/src/systems/theme.js';

const screens = [[360, 640], [390, 844], [1280, 720]];

test('theme contract keeps approved semantic colors and minimum party size', () => {
  assert.equal(COLORS.primary, 0x2563eb);
  assert.equal(COLORS.task, 0xf6c344);
  assert.equal(COLORS.ink, 0x172554);
  assert.equal(MIN_PLAYERS, 4);
});

test('lobby and end cards plus actions fit target viewports', () => {
  for (const [width, height] of screens) {
    const lobby = lobbyLayout(width, height);
    const end = endLayout(width, height, 12);
    for (const layout of [lobby, end]) {
      const left = layout.card.x - layout.card.width / 2;
      const right = layout.card.x + layout.card.width / 2;
      const top = layout.card.y - layout.card.height / 2;
      const bottom = layout.card.y + layout.card.height / 2;
      assert.ok(left >= 0 && right <= width, `${width}x${height}: horizontal clipping`);
      assert.ok(top >= 0 && bottom <= height, `${width}x${height}: vertical clipping`);
    }
    assert.ok(end.actionsY + 26 <= height, `${width}x${height}: actions clipped`);
    assert.ok(lobby.maxRows >= 2);
  }
});

test('mobile game HUD respects safe areas and keeps controls separated', () => {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    const hud = gameHudLayout(width, height);
    assert.equal(hud.mobile, true);
    for (const point of [hud.dpad, hud.actions]) {
      assert.ok(point.x >= hud.safe && point.x <= width - hud.safe, `${width}: control x outside safe area`);
      assert.ok(point.y >= hud.safe && point.y <= height - hud.safe, `${height}: control y outside safe area`);
    }
    assert.ok(hud.dpad.x - 42 - 22 >= hud.safe, `${width}: d-pad exceeds left safe area`);
    assert.ok(hud.dpad.y + 42 + 22 <= height - hud.safe, `${height}: d-pad exceeds bottom safe area`);
    assert.ok(hud.actions.x + 28 <= width - hud.safe, `${width}: action exceeds right safe area`);
    assert.ok(hud.actions.y + 28 <= height - hud.safe, `${height}: action exceeds bottom safe area`);
    assert.ok(hud.dpad.x + 90 < hud.actions.x - 55, `${width}: touch clusters overlap`);
    assert.ok(hud.header.width <= width - hud.safe * 2);
    assert.equal(hud.showRolePanel, false);
    assert.equal(hud.showTaskList, false);
  }
  const desktop = gameHudLayout(1280, 720);
  assert.equal(desktop.mobile, false);
  assert.equal(desktop.showRolePanel, true);
  assert.equal(desktop.showTaskList, true);
});

test('meeting layout fits chat, four candidates and actions at target viewports', () => {
  for (const [width, height] of screens) {
    const layout = meetingLayout(width, height, 4);
    const left = layout.panel.x - layout.panel.width / 2;
    const top = layout.panel.y - layout.panel.height / 2;
    assert.ok(left >= layout.safe && top >= layout.safe, `${width}x${height}: panel starts outside safe area`);
    assert.ok(left + layout.panel.width <= width - layout.safe, `${width}x${height}: panel exceeds right safe area`);
    assert.ok(top + layout.panel.height <= height - layout.safe, `${width}x${height}: panel exceeds bottom safe area`);
    assert.ok(layout.chat.width >= 300 && layout.chat.height >= 96);
    assert.ok(layout.cards.width >= 150 && layout.cards.height >= 50);
    assert.ok(layout.visiblePlayers >= 4);
    assert.ok(layout.skip.y + layout.skip.height / 2 <= top + layout.panel.height - 12);
  }
  assert.equal(meetingLayout(390, 844, 4).mobile, true);
  assert.equal(meetingLayout(1280, 720, 4).mobile, false);
});
