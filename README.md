# OfiChaos

Party game web de deducción social para cuatro personas. Tres Empleados trabajan, reparan crisis y reúnen pistas mientras un Jefe secreto finge colaborar y sabotea una oficina caricaturesca.

## Jugar localmente

```bash
npm install
npm start
```

Abre `http://localhost:3000`. Para usar otro puerto:

```bash
PORT=3456 npm start
```

1. Una persona crea la sala y comparte el código de cinco caracteres.
2. Otras tres personas se unen desde sus navegadores.
3. El host inicia cuando hay al menos cuatro jugadores.
4. Cada cliente recibe un briefing privado con su rol, misión y primer paso.
5. Muévete con WASD/flechas o los controles táctiles. Acércate a una estación para trabajar o reparar.
6. Observa sabotajes y cambios de moral; convoca una reunión para discutir y votar.
7. Completa la cuota antes del cierre o permite que el caos y el burnout den la victoria al Jefe.

El botón **Probar sala demo** permite recorrer el mapa y probar la interfaz sin reunir cuatro clientes.

## Integridad de la deducción

- Los snapshots compartidos nunca contienen roles, objetivos privados ni cooldowns ajenos.
- `game:role` entrega el briefing solo al socket propietario.
- `game:private` entrega únicamente los cooldowns del jugador local.
- Apariencia, color, chat y tarjetas de reunión son neutrales respecto del rol.
- Los roles se revelan únicamente en la pantalla final.

## Dirección visual

Oficina 2D luminosa, caótica y legible: azul eléctrico para identidad, coral para crisis, amarillo para tareas y verde para progreso. El sabotaje altera el borde y el mundo sin ocultar el mapa. Los layouts se recomponen para escritorio y móvil; no son un dashboard reducido.

Los contratos completos viven en:

- [`PRODUCT.md`](PRODUCT.md): propósito, usuarios y principios.
- [`DESIGN.md`](DESIGN.md): tokens, layouts, componentes y reglas visuales.

## Arquitectura

| Capa | Tecnología |
|---|---|
| Cliente | Phaser 3 + DOM accesible para formularios/chat |
| Servidor | Node.js + Express |
| Multiplayer | Socket.IO |
| Persistencia | En memoria; una instancia de servidor |

Piezas principales:

```text
client/src/scenes/       Lobby, juego, reunión y final
client/src/systems/      red, jugadores, UI, onboarding, tema y mundo
server/index.js          transporte y validación Socket.IO
server/projections.js    estado público, privado y final
server/roomManager.js    salas y acciones autoritativas
server/gameState.js      fases, votación, moral y victoria
tests/                   E2E, lifecycle, layouts, mundo y victoria
```

`world.js` es la fuente cliente única de límites, zonas, obstáculos y búsqueda de estaciones. El servidor conserva la autoridad sobre movimiento, tareas, sabotajes, reuniones, votos y victoria.

## Verificación

```bash
npm test
```

También pueden ejecutarse por separado:

```bash
node --test tests/e2e.test.js
node --test tests/victory_verification.test.js
node --test tests/client-lifecycle.test.mjs tests/onboarding.test.mjs tests/theme-contract.test.mjs tests/world-layout.test.mjs
```

La revisión responsive cubre escritorio, `390×844` y `360×640`. El gate de integración abre cuatro contextos aislados de Chrome y verifica crear/unirse/iniciar, privacidad de roles, reunión, chat, cuatro votos, reanudación y final sin errores de consola.

## Alcance actual

Incluye una oficina, cuatro jugadores, tareas, sabotajes, moral/burnout, reunión, votación, sanciones, condiciones de victoria y revancha. No incluye cuentas, ranking, skins, múltiples mapas, reconexión persistente ni escalado horizontal de salas.

## Licencia

MIT
