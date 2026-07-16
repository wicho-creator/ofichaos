(function exposeMinigames(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OFICHAOS_MINIGAMES = api;
})(globalThis, () => {
  const COPY = Object.freeze({
    cafe: Object.freeze({ target: Object.freeze([0.42, 0.58]) }),
    archivos: Object.freeze({ order: Object.freeze([1, 2, 3, 4]) }),
    correos: Object.freeze({
      items: Object.freeze([
        Object.freeze({ id: 'cliente', subject: 'Cliente pide fecha de entrega', action: 'responder' }),
        Object.freeze({ id: 'spam', subject: 'Ganaste una impresora gratis', action: 'archivar' }),
        Object.freeze({ id: 'jefe', subject: 'Jefe solicita avance del proyecto', action: 'responder' })
      ])
    }),
    wifi: Object.freeze({
      connectors: Object.freeze([
        Object.freeze({ id: 'A', label: 'A', color: 0xd83a4a, pattern: '●' }),
        Object.freeze({ id: 'B', label: 'B', color: 0xf6c344, pattern: '▲' }),
        Object.freeze({ id: 'C', label: 'C', color: 0x22c55e, pattern: '■' }),
        Object.freeze({ id: 'D', label: 'D', color: 0x2563eb, pattern: '◆' })
      ])
    })
  });

  function createMinigameState(task) {
    if (!task?.id || !task.mechanic) throw new TypeError('Tarea de minijuego inválida');
    const base = { taskId: task.id, mechanic: task.mechanic, completed: false, mistakes: 0 };
    if (task.mechanic === 'timing') return { ...base, attempts: 0, target: COPY.cafe.target };
    if (task.mechanic === 'order') return { ...base, index: 0, order: COPY.archivos.order };
    if (task.mechanic === 'triage') return { ...base, index: 0, items: COPY.correos.items };
    if (task.mechanic === 'hold') return { ...base, active: false, elapsed: 0, holdMs: task.holdMs };
    if (task.mechanic === 'match') return { ...base, connectors: COPY.wifi.connectors, matches: [] };
    throw new TypeError(`Mecánica desconocida: ${task.mechanic}`);
  }

  function reduceMinigame(state, action) {
    if (!state || state.completed || !action?.type) return state;
    if (state.mechanic === 'timing' && action.type === 'stop') {
      const position = Number(action.position);
      const hit = Number.isFinite(position) && position >= state.target[0] && position <= state.target[1];
      return { ...state, attempts: state.attempts + 1, completed: hit };
    }
    if (state.mechanic === 'order' && action.type === 'pick') {
      if (action.value !== state.order[state.index]) return { ...state, index: 0, mistakes: state.mistakes + 1 };
      const index = state.index + 1;
      return { ...state, index, completed: index === state.order.length };
    }
    if (state.mechanic === 'triage' && action.type === 'choose') {
      if (action.value !== state.items[state.index]?.action) return { ...state, mistakes: state.mistakes + 1 };
      const index = state.index + 1;
      return { ...state, index, completed: index === state.items.length };
    }
    if (state.mechanic === 'hold') {
      if (action.type === 'hold') return { ...state, active: Boolean(action.active) };
      if (action.type === 'tick' && state.active) {
        const elapsed = Math.min(state.holdMs, state.elapsed + Math.max(0, Number(action.delta) || 0));
        return { ...state, elapsed, completed: elapsed >= state.holdMs };
      }
    }
    if (state.mechanic === 'match' && action.type === 'connect') {
      const valid = state.connectors.some(({ id }) => id === action.from) && action.from === action.to;
      if (!valid) return { ...state, mistakes: state.mistakes + 1 };
      if (state.matches.includes(action.from)) return state;
      const matches = [...state.matches, action.from];
      return { ...state, matches, completed: matches.length === state.connectors.length };
    }
    return state;
  }

  function nextMinigameState(state, action, authoritative = false) {
    return authoritative ? state : reduceMinigame(state, action);
  }

  return Object.freeze({ createMinigameState, nextMinigameState, reduceMinigame });
});
