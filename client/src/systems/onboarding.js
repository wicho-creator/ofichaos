const BRIEFINGS = {
  empleado: {
    label: 'EMPLEADO',
    mission: 'Completa tareas y mantén la oficina funcionando.',
    firstStep: 'Busca una zona amarilla y presiona E para trabajar.'
  },
  jefe: {
    label: 'JEFE',
    mission: 'Sabotea la oficina sin dejar que te descubran.',
    firstStep: 'Mézclate con el equipo y usa sabotajes cuando nadie mire.'
  },
  lamebotas: {
    label: 'LAMEBOTAS',
    mission: 'Protege al Jefe, confunde al equipo y desvía sospechas.',
    firstStep: 'Finge trabajar y crea una coartada antes de sabotear.'
  }
};

export function getRoleBriefing(role, secondaryObjective) {
  const briefing = BRIEFINGS[role] || BRIEFINGS.empleado;
  return {
    ...briefing,
    secondaryObjective: secondaryObjective || 'Observa, trabaja y no reveles tu rol.'
  };
}
