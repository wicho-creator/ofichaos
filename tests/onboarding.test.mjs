import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoleBriefing } from '../client/src/systems/onboarding.js';

const cases = [
  ['empleado', 'EMPLEADO', 'Completa tareas', 'Busca una zona amarilla'],
  ['jefe', 'JEFE', 'Sabotea', 'Mézclate con el equipo'],
  ['lamebotas', 'LAMEBOTAS', 'Protege al Jefe', 'Finge trabajar']
];

for (const [role, label, mission, firstStep] of cases) {
  test(`briefing ${role} explica misión y primer paso`, () => {
    const briefing = getRoleBriefing(role, 'Objetivo privado de prueba');
    assert.equal(briefing.label, label);
    assert.match(briefing.mission, new RegExp(mission, 'i'));
    assert.match(briefing.firstStep, new RegExp(firstStep, 'i'));
    assert.equal(briefing.secondaryObjective, 'Objetivo privado de prueba');
  });
}

test('rol desconocido usa una presentación segura', () => {
  assert.deepEqual(getRoleBriefing('desconocido'), {
    label: 'EMPLEADO',
    mission: 'Completa tareas y mantén la oficina funcionando.',
    firstStep: 'Busca una zona amarilla y presiona E para trabajar.',
    secondaryObjective: 'Observa, trabaja y no reveles tu rol.'
  });
});
