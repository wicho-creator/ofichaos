import { createPanel } from './ui.js';
import { createMinigameState, nextMinigameState } from './minigames.js';

const COLORS = Object.freeze({ ink: 0x172554, primary: 0x2563eb, task: 0xf6c344, success: 0x22c55e, danger: 0xd83a4a, surface: 0xf8fafc, muted: 0x64748b });

export const shouldTickHold = (authoritative, holding, state) => authoritative ? holding : state.active;
export const shouldCancelMinigameOnResize = (fromWidth, fromHeight, toWidth, toHeight) => fromWidth !== toWidth || fromHeight !== toHeight;

export function bindHoldLifecycle(windowTarget, documentTarget, release) {
  const blur = () => release();
  const visibility = () => documentTarget.hidden && release();
  windowTarget.addEventListener('blur', blur);
  documentTarget.addEventListener('visibilitychange', visibility);
  return () => {
    windowTarget.removeEventListener('blur', blur);
    documentTarget.removeEventListener('visibilitychange', visibility);
  };
}

export function minigameLayout(screenWidth, screenHeight, mechanic) {
  const width = Math.min(480, screenWidth - 24);
  const height = Math.min(390, screenHeight - 28);
  const compact = height < 350;
  const cancel = { x: 0, y: height / 2 - 30, width: Math.min(180, width - 80), height: 44 };
  const controls = [];
  if (mechanic === 'timing' || mechanic === 'hold') {
    controls.push({ x: 0, y: compact ? 52 : mechanic === 'timing' ? 76 : 78, width: Math.min(mechanic === 'timing' ? 220 : 260, width - (mechanic === 'timing' ? 70 : 56)), height: compact ? 44 : 52 });
  } else if (mechanic === 'order') {
    const positions = compact ? [[-45, 2], [45, 2], [-45, 54], [45, 54]] : [[-84, 0], [28, 0], [-28, 62], [84, 62]];
    controls.push(...positions.map(([x, y]) => ({ x, y, width: 76, height: compact ? 44 : 52 })));
  } else if (mechanic === 'triage') {
    const buttonWidth = compact ? Math.min(136, (width - 48) / 2) : 146;
    const x = buttonWidth / 2 + 8;
    controls.push({ x: -x, y: compact ? 50 : 92, width: buttonWidth, height: compact ? 44 : 52 });
    controls.push({ x, y: compact ? 50 : 92, width: buttonWidth, height: compact ? 44 : 52 });
  } else if (mechanic === 'match') {
    if (compact) {
      const buttonWidth = Math.min(82, (width - 64) / 4);
      const step = buttonWidth + 8;
      const xs = [-1.5, -0.5, 0.5, 1.5].map((factor) => factor * step);
      controls.push(...xs.map((x) => ({ x, y: 2, width: buttonWidth, height: 44 })));
      controls.push(...xs.map((x) => ({ x, y: 54, width: buttonWidth, height: 44 })));
    } else {
      const ys = [-48, 1, 50, 99];
      controls.push(...ys.map((y) => ({ x: -104, y, width: 82, height: 44 })));
      controls.push(...ys.map((y) => ({ x: 104, y, width: 82, height: 44 })));
    }
  }
  return {
    width,
    height,
    compact,
    controls,
    cancel,
    header: {
      eyebrow: -height / 2 + (compact ? 18 : 25),
      title: -height / 2 + (compact ? 40 : 55),
      instruction: -height / 2 + (compact ? 64 : 86),
      status: -height / 2 + (compact ? 94 : 120)
    }
  };
}

function addButton(scene, container, x, y, width, labelText, activate, options = {}) {
  const height = options.height || 52;
  const color = options.color || COLORS.primary;
  const shadow = scene.add.rectangle(x + 3, y + 5, width, height, COLORS.ink, 0.25).setOrigin(0.5);
  const bg = scene.add.rectangle(x, y, width, height, color).setOrigin(0.5)
    .setStrokeStyle(3, 0xffffff, 0.9).setInteractive({ useHandCursor: true });
  const label = scene.add.text(x, y, labelText, {
    fontSize: options.fontSize || '15px', color: options.textColor || '#ffffff', fontStyle: 'bold', align: 'center'
  }).setOrigin(0.5);
  container.add([shadow, bg, label]);

  let enabled = true;
  const draw = (fill = color, lift = 0) => {
    bg.setFillStyle(fill).setPosition(x, y - lift);
    label.setPosition(x, y - lift);
  };
  bg.on('pointerover', () => enabled && draw(options.hover || COLORS.ink, 2));
  bg.on('pointerout', () => enabled && draw());
  bg.on('pointerdown', () => enabled && activate());

  return {
    bg,
    label,
    setLabel(text) { label.setText(text); },
    setSelected(selected) { bg.setStrokeStyle(selected ? 4 : 3, selected ? COLORS.task : 0xffffff, 1); },
    setEnabled(next) {
      enabled = next;
      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.setAlpha(1); label.setAlpha(1); shadow.setAlpha(1);
      } else {
        bg.disableInteractive();
        bg.setAlpha(0.55); label.setAlpha(0.7); shadow.setAlpha(0.35);
      }
    }
  };
}

export function createMinigamePanel(scene, task, { authoritative = false, onAction = () => {}, onComplete, onCancel }) {
  let state = createMinigameState(task);
  let pending = false;
  let destroyed = false;
  const cleanups = [];
  const timers = [];
  const tweens = [];
  const initialWidth = scene.scale.width;
  const initialHeight = scene.scale.height;
  const layout = minigameLayout(initialWidth, initialHeight, task.mechanic);
  const { width, height } = layout;
  const container = scene.add.container(scene.scale.width / 2, scene.scale.height / 2).setScrollFactor(0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, COLORS.ink, 0.82).setInteractive();
  const panel = createPanel(scene, 0, 0, width, height, COLORS.surface, { strokeColor: COLORS.ink, strokeAlpha: 1, radius: 18 });
  const eyebrow = scene.add.text(0, layout.header.eyebrow, task.stationLabel, {
    fontSize: '11px', color: '#64748b', fontStyle: 'bold', letterSpacing: 1
  }).setOrigin(0.5);
  const title = scene.add.text(0, layout.header.title, task.name, {
    fontSize: scene.scale.width < 420 ? '20px' : '24px', color: '#172554', fontStyle: 'bold'
  }).setOrigin(0.5);
  const instruction = scene.add.text(0, layout.header.instruction, task.instruction, {
    fontSize: '13px', color: '#475569', align: 'center', wordWrap: { width: width - 40 }
  }).setOrigin(0.5);
  const status = scene.add.text(0, layout.header.status, '', {
    fontSize: '12px', color: '#172554', fontStyle: 'bold', align: 'center', wordWrap: { width: width - 40 }
  }).setOrigin(0.5);
  container.add([shade, panel, eyebrow, title, instruction, status]);

  const setStatus = (text, color = '#172554') => status.setText(text).setColor(color);
  const finish = () => {
    if (pending || destroyed) return;
    pending = true;
    setStatus('Trabajo terminado · validando con la sala…', '#157a36');
    controls.forEach((control) => control.setEnabled?.(false));
    onComplete(task.id);
  };
  const dispatch = (action) => {
    const previous = state;
    state = nextMinigameState(state, action, authoritative);
    render(previous, action);
    if (authoritative) {
      Promise.resolve(onAction(action)).then((result) => {
        if (!destroyed && result?.state && !result.completed) {
          const optimistic = state;
          state = result.state;
          render(optimistic, action);
        }
      });
      return;
    }
    onAction(action);
    if (!previous.completed && state.completed) finish();
  };
  const controls = [];
  let render = () => {};

  if (task.mechanic === 'timing') {
    const track = scene.add.rectangle(0, 5, Math.min(300, width - 70), 28, 0xcbd5e1).setStrokeStyle(3, COLORS.ink);
    const target = scene.add.rectangle(0, 5, track.width * (state.target[1] - state.target[0]), 28, COLORS.success, 0.9);
    const needle = scene.add.rectangle(-track.width / 2, 5, 10, 42, COLORS.ink);
    container.add([track, target, needle]);
    const tween = scene.tweens.add({ targets: needle, x: track.width / 2, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    tweens.push(tween);
    const stop = () => dispatch({ type: 'stop', position: (needle.x + track.width / 2) / track.width });
    const box = layout.controls[0];
    const button = addButton(scene, container, box.x, box.y, box.width, 'DETENER AGUJA', stop, { height: box.height, color: COLORS.primary });
    controls.push(button);
    render = (previous) => {
      if (state.attempts > previous.attempts && !state.completed) setStatus('Fuera de la franja. Intenta otra vez.', '#b42318');
      if (state.completed) tween.stop();
    };
    cleanups.push(bindKeys(scene, ({ code, type, repeat }) => !repeat && type === 'down' && ['Space', 'Enter'].includes(code) && stop()));
  } else if (task.mechanic === 'order') {
    const buttons = state.order.map((value, index) => {
      const box = layout.controls[index];
      const button = addButton(scene, container, box.x, box.y, box.width, String(value), () => dispatch({ type: 'pick', value }), { height: box.height, color: 0x475569, fontSize: '20px' });
      controls.push(button);
      return button;
    });
    render = (previous) => {
      buttons.forEach((button, index) => {
        const done = index < state.index;
        button.bg.setFillStyle(done ? COLORS.success : 0x475569);
        button.setEnabled(!done && !pending);
      });
      if (state.mistakes > previous.mistakes) setStatus('Orden incorrecto · vuelve a comenzar.', '#b42318');
      else setStatus(`${state.index}/4 carpetas ordenadas`);
    };
    render(state);
    cleanups.push(bindKeys(scene, ({ code, type, repeat }) => {
      if (repeat || type !== 'down' || !/^Digit[1-4]$/.test(code)) return;
      dispatch({ type: 'pick', value: Number(code.at(-1)) });
    }));
  } else if (task.mechanic === 'triage') {
    const card = scene.add.rectangle(0, layout.compact ? 0 : 14, width - 58, layout.compact ? 52 : 92, 0xffffff).setStrokeStyle(3, COLORS.ink);
    const subject = scene.add.text(0, layout.compact ? -5 : -4, '', { fontSize: layout.compact ? '12px' : '14px', color: '#172554', fontStyle: 'bold', align: 'center', wordWrap: { width: width - 90 } }).setOrigin(0.5);
    const progress = scene.add.text(0, layout.compact ? 15 : 39, '', { fontSize: '11px', color: '#64748b' }).setOrigin(0.5);
    container.add([card, subject, progress]);
    const choose = (value) => dispatch({ type: 'choose', value });
    const [respondBox, archiveBox] = layout.controls;
    const respond = addButton(scene, container, respondBox.x, respondBox.y, respondBox.width, 'R · RESPONDER', () => choose('responder'), { height: respondBox.height, color: COLORS.primary, fontSize: '12px' });
    const archive = addButton(scene, container, archiveBox.x, archiveBox.y, archiveBox.width, 'A · ARCHIVAR', () => choose('archivar'), { height: archiveBox.height, color: 0x475569, fontSize: '12px' });
    controls.push(respond, archive);
    render = (previous) => {
      const item = state.items[state.index];
      subject.setText(item?.subject || 'Bandeja procesada');
      progress.setText(`${Math.min(state.index + 1, state.items.length)} de ${state.items.length}`);
      if (state.mistakes > previous.mistakes) setStatus('Esa decisión no corresponde. Revisa el asunto.', '#b42318');
      else setStatus('R para responder · A para archivar');
    };
    render(state);
    cleanups.push(bindKeys(scene, ({ code, type, repeat }) => {
      if (repeat || type !== 'down') return;
      if (code === 'KeyR') choose('responder');
      if (code === 'KeyA') choose('archivar');
    }));
  } else if (task.mechanic === 'hold') {
    const barWidth = width - 72;
    const track = scene.add.rectangle(0, 8, barWidth, 28, 0xcbd5e1).setStrokeStyle(3, COLORS.ink);
    const fill = scene.add.rectangle(-barWidth / 2, 8, 0, 28, COLORS.success).setOrigin(0, 0.5);
    container.add([track, fill]);
    let holding = false;
    const hold = (active) => {
      holding = active;
      dispatch({ type: 'hold', active });
    };
    const box = layout.controls[0];
    const button = addButton(scene, container, box.x, box.y, box.width, 'MANTÉN PRESIONADO', () => {}, { height: box.height, color: COLORS.primary, fontSize: '13px' });
    controls.push(button);
    button.bg.removeAllListeners('pointerdown');
    button.bg.on('pointerdown', () => !pending && hold(true));
    button.bg.on('pointerup', () => hold(false));
    button.bg.on('pointerout', () => hold(false));
    const timer = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => !pending && shouldTickHold(authoritative, holding, state) && dispatch({ type: 'tick', delta: 50 })
    });
    timers.push(timer);
    render = () => {
      fill.width = barWidth * (state.elapsed / state.holdMs);
      button.setLabel(state.active ? 'IMPRIMIENDO… NO SUELTES' : 'MANTÉN PRESIONADO');
      button.bg.setFillStyle(state.active ? COLORS.success : COLORS.primary);
      setStatus(`${Math.round((state.elapsed / state.holdMs) * 100)}% impreso`);
    };
    render();
    cleanups.push(bindKeys(scene, ({ code, type, repeat }) => {
      if (code !== 'Space') return;
      if (type === 'down' && !repeat) hold(true);
      if (type === 'up') hold(false);
    }));
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      cleanups.push(bindHoldLifecycle(window, document, () => holding && hold(false)));
    }
  } else if (task.mechanic === 'match') {
    const lineGraphics = scene.add.graphics();
    container.add(lineGraphics);
    const right = [...state.connectors].reverse();
    const leftBoxes = layout.controls.slice(0, 4);
    const rightBoxes = layout.controls.slice(4);
    const leftButtons = new Map();
    const rightButtons = new Map();
    let selected = null;
    state.connectors.forEach((connector, index) => {
      const box = leftBoxes[index];
      const left = addButton(scene, container, box.x, box.y, box.width, `${index + 1} · ${connector.pattern}${connector.label}`, () => {
        selected = connector.id;
        render(state);
      }, { height: box.height, color: connector.color, textColor: connector.id === 'B' ? '#172554' : '#ffffff', fontSize: layout.compact ? '11px' : '13px' });
      leftButtons.set(connector.id, left); controls.push(left);
    });
    right.forEach((connector, index) => {
      const box = rightBoxes[index];
      const rightButton = addButton(scene, container, box.x, box.y, box.width, `${String.fromCharCode(65 + index)} · ${connector.pattern}${connector.label}`, () => {
        if (!selected) return setStatus('Primero elige un cable de la izquierda.', '#b42318');
        dispatch({ type: 'connect', from: selected, to: connector.id });
        selected = null;
      }, { height: box.height, color: connector.color, textColor: connector.id === 'B' ? '#172554' : '#ffffff', fontSize: layout.compact ? '11px' : '13px' });
      rightButtons.set(connector.id, { button: rightButton, index }); controls.push(rightButton);
    });
    render = (previous) => {
      lineGraphics.clear();
      leftButtons.forEach((button, id) => {
        const matched = state.matches.includes(id);
        button.setSelected(selected === id);
        button.setEnabled(!matched && !pending);
        rightButtons.get(id).button.setEnabled(!matched && !pending);
        if (matched) {
          const leftIndex = state.connectors.findIndex((connector) => connector.id === id);
          const rightIndex = rightButtons.get(id).index;
          const connector = state.connectors[leftIndex];
          const from = leftBoxes[leftIndex];
          const to = rightBoxes[rightIndex];
          lineGraphics.lineStyle(5, connector.color, 0.9).lineBetween(from.x, from.y, to.x, to.y);
        }
      });
      if (state.mistakes > previous.mistakes) setStatus('Conectores distintos. Usa también símbolo y letra.', '#b42318');
      else setStatus(`${state.matches.length}/4 conexiones · 1–4 y luego A–D`);
    };
    render(state);
    cleanups.push(bindKeys(scene, ({ code, type, repeat }) => {
      if (repeat || type !== 'down') return;
      if (/^Digit[1-4]$/.test(code)) {
        selected = state.connectors[Number(code.at(-1)) - 1].id;
        render(state);
      }
      if (/^Key[A-D]$/.test(code) && selected) {
        const connector = right[code.charCodeAt(3) - 65];
        dispatch({ type: 'connect', from: selected, to: connector.id });
        selected = null;
      }
    }));
  }

  const cancelBox = layout.cancel;
  const cancel = addButton(scene, container, cancelBox.x, cancelBox.y, cancelBox.width, 'ESC · CANCELAR', () => onCancel(), { height: cancelBox.height, color: 0x475569, fontSize: '12px' });
  controls.push(cancel);
  cleanups.push(bindKeys(scene, ({ code, type, repeat }) => !repeat && type === 'down' && code === 'Escape' && onCancel()));

  return {
    taskId: task.id,
    task,
    get pending() { return pending; },
    get state() { return state; },
    resize(screenWidth, screenHeight) {
      if (shouldCancelMinigameOnResize(initialWidth, initialHeight, screenWidth, screenHeight)) return onCancel();
      container.setPosition(screenWidth / 2, screenHeight / 2);
      shade.setSize(screenWidth, screenHeight);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cleanups.forEach((cleanup) => cleanup());
      timers.forEach((timer) => timer.remove(false));
      tweens.forEach((tween) => tween.stop());
      container.destroy(true);
    }
  };
}

function bindKeys(scene, handler) {
  const down = (event) => handler({ code: event.code, type: 'down', repeat: event.repeat });
  const up = (event) => handler({ code: event.code, type: 'up', repeat: event.repeat });
  scene.input.keyboard.on('keydown', down);
  scene.input.keyboard.on('keyup', up);
  return () => {
    scene.input.keyboard.off('keydown', down);
    scene.input.keyboard.off('keyup', up);
  };
}
