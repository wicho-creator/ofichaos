// roles.js — Definición de roles, habilidades y objetivos secundarios

const ROLES = {
  EMPLEADO: {
    id: 'empleado',
    name: 'Empleado',
    color: 0x4ade80, // verde
    description: 'Completa tareas y descubre al jefe o lamebotas.',
    abilities: {
      doTask: true,
      reportSabotage: true,
      callMeeting: { perGame: 1 }
    }
  },
  JEFE: {
    id: 'jefe',
    name: 'Jefe',
    color: 0xef4444, // rojo
    description: 'Evita que los empleados completen las tareas antes de que acabe el tiempo.',
    abilities: {
      sabotageZone: { cooldown: 30000 },
      assignExtraTask: { cooldown: 45000 },
      lowerMorale: { cooldown: 40000 },
      closeDoor: { cooldown: 35000 }
    }
  },
  LAMEBOTAS: {
    id: 'lamebotas',
    name: 'Lamebotas',
    color: 0xfacc15, // amarillo
    description: 'Ayuda al jefe sin ser descubierto.',
    abilities: {
      fakeTask: true,
      falseReport: { cooldown: 30000 },
      blockTask: { cooldown: 25000, duration: 5000 }
    }
  }
};

const SECONDARY_OBJECTIVES = [
  { id: 'tasks_uninterrupted', text: 'Completar 3 tareas sin ser interrumpido' },
  { id: 'meeting_no_votes', text: 'Participar en una reunión y no recibir votos' },
  { id: 'cause_sanction', text: 'Hacer que otro jugador sea sancionado' },
  { id: 'kitchen_task', text: 'Completar una tarea en la cocina' },
  { id: 'no_burnout', text: 'Sobrevivir toda la partida sin burnout' },
  { id: 'accuse_correct', text: 'Acusar correctamente a un saboteador' },
  { id: 'help_coworker', text: 'Ayudar a otro jugador a completar una tarea' },
  { id: 'avoid_boss', text: 'Evitar estar cerca del jefe por 2 minutos' }
];

/**
 * Asigna roles a los jugadores de una sala.
 * - 1 Jefe si hay >= 4 jugadores
 * - 1 Lamebotas si hay >= 5 jugadores
 * - El resto Empleados
 * Cada jugador recibe un objetivo secundario aleatorio.
 * @param {string[]} playerIds - Array de IDs de jugador
 * @returns {Object} mapa playerId -> { role, secondaryObjective }
 */
function assignRoles(playerIds) {
  const assignments = {};
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

  let jefeCount = playerIds.length >= 4 ? 1 : 0;
  let lamebotasCount = playerIds.length >= 5 ? 1 : 0;

  for (let i = 0; i < shuffled.length; i++) {
    const pid = shuffled[i];
    let role;
    if (i < jefeCount) {
      role = ROLES.JEFE.id;
    } else if (i < jefeCount + lamebotasCount) {
      role = ROLES.LAMEBOTAS.id;
    } else {
      role = ROLES.EMPLEADO.id;
    }

    const secondaryObjective =
      SECONDARY_OBJECTIVES[Math.floor(Math.random() * SECONDARY_OBJECTIVES.length)];

    assignments[pid] = {
      role,
      secondaryObjective: secondaryObjective.id,
      secondaryObjectiveText: secondaryObjective.text,
      abilityCooldowns: {},
      meetingCalled: false,
      sanctions: 0
    };
  }

  return assignments;
}

module.exports = { ROLES, SECONDARY_OBJECTIVES, assignRoles };
