# OfiChaos — Infraestructura de pruebas

## Gate canónico versionado

```bash
npm test
npm run check
git diff HEAD --check
```

`npm test` usa únicamente `node:test`/`assert` y agrupa:

- `tests/e2e.test.js`: sala, fases, transporte y flujos multijugador;
- `tests/victory_verification.test.js`: condiciones de victoria;
- `tests/socket-payloads.test.js`: payloads/ACK hostiles contra servidor hijo;
- `tests/task-access.test.js` y `tests/task-sessions.test.js`: acceso, tokens, cadencias y reducers autoritativos;
- `tests/doors.test.js`: colisiones, puertas, sabotajes e invalidaciones;
- `tests/projections.test.js`: privacidad y allowlists;
- `tests/client-lifecycle.test.mjs`: listeners, reuniones y callbacks tardíos;
- `tests/minigames.test.mjs`: reducers, layouts, hold, blur y resize;
- contratos de onboarding, tema, mundo y layout de sabotajes.

## Gates de runtime

No se añade Playwright/Puppeteer al proyecto. Los harnesses de QA usan Chrome instalado y CDP con perfiles temporales fuera del repo.

### Cuatro clientes

Abrir cuatro Chrome aislados y verificar por transporte real:

1. crear/unirse/iniciar;
2. roles privados y snapshots públicos;
3. movimiento, colisión y reconciliación;
4. tarea remota rechazada y tarea legítima completada;
5. sabotaje/puerta;
6. reunión, chat, cuatro votos y reanudación;
7. final de partida;
8. cero errores de consola.

### Responsive

Viewports obligatorios:

- `390×844`;
- `360×640`;
- `640×390`;
- `568×320`;
- `360×300`.

Los cinco paneles deben probarse en los dos tamaños compactos. Cada objetivo táctil debe medir al menos `44×44 px`, permanecer dentro del viewport y no solaparse con controles incompatibles. El resize con panel abierto debe cancelarlo y reconstruir geometría al reabrir.

### Lifecycle sostenido

Para Reporte:

- mantener presionado envía heartbeats periódicos;
- `keyup`, `pointerup`, `pointerout`, `window.blur`, `visibilitychange`, reunión y shutdown liberan el hold;
- un gap largo no acredita tiempo retroactivo;
- destruir panel elimina listeners, timer y tween.

## Regla RED→GREEN

Todo hallazgo adversarial se convierte primero en una regresión que falla por la razón esperada. Después del fix:

1. focal GREEN;
2. suite completa;
3. checks;
4. runtime afectado;
5. revisión independiente del diff exacto.

Cualquier cambio posterior invalida el dictamen previo y exige una revisión nueva.
