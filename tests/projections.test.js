const test = require('node:test');
const assert = require('node:assert/strict');
const { projectTick } = require('../server/projections');

test('projectTick sincroniza sabotajes activos con allowlist pública', () => {
  const room = {
    players: { ana: { id: 'ana', x: 10, y: 20, morale: 90 } },
    gameState: {
      timeRemaining: 1000,
      taskStates: [],
      activeSabotages: [{
        type: 'close_door', doorId: 'cocina-este', zoneId: 'cocina', expires: 12345,
        saboteurId: 'secreto', cooldownUntil: 99999, affected: ['ana']
      }]
    }
  };

  assert.deepEqual(projectTick(room).activeSabotages, [
    { type: 'close_door', doorId: 'cocina-este', zoneId: 'cocina', taskId: undefined, expires: 12345 }
  ]);
});
