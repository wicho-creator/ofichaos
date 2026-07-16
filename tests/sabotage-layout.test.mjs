import test from 'node:test';
import assert from 'node:assert/strict';
import { sabotageMenuLayout } from '../client/src/systems/sabotage-layout.js';

for (const [width, height] of [[640, 390], [360, 390], [390, 844], [568, 320], [360, 300]]) {
  for (const role of ['jefe', 'lamebotas']) {
    const pages = height < 350 ? [0, 1, 2] : role === 'lamebotas' && height < 560 ? [0, 1] : [0];
    for (const page of pages) {
      test(`menú ${role} página ${page} cabe en ${width}x${height}`, () => {
        const layout = sabotageMenuLayout(width, height, role, page);
        const top = layout.panelY - layout.panelH / 2;
        const bottom = layout.panelY + layout.panelH / 2;
        for (const target of layout.targets) {
          assert.ok(target.height >= 44, `${target.id}: objetivo táctil menor de 44px`);
          assert.ok(target.y - target.height / 2 >= top, `${target.id}: sale por arriba`);
          assert.ok(target.y + target.height / 2 <= bottom, `${target.id}: sale por abajo`);
        }
        assert.ok(top >= 0 && bottom <= height, 'panel fuera del viewport');
      });
    }
  }
}
