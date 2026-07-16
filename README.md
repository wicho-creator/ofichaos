# OfiChaos

Party game web de deducción social para cuatro personas. Tres Empleados completan encargos y reparan crisis mientras un Jefe secreto finge colaborar y sabotea una oficina caricaturesca.

## Ejecutar localmente

```bash
npm install
npm start
```

Abre `http://localhost:3000`. Para usar otro puerto:

```bash
PORT=3456 npm start
```

1. Una persona crea la sala y comparte el código.
2. Otras tres personas se unen desde navegadores independientes.
3. El host inicia la partida.
4. Cada cliente recibe su rol y objetivo de forma privada.
5. Muévete con WASD/flechas o D-pad táctil, acércate a una estación y completa su minijuego.
6. Reporta crisis, discute y vota durante las reuniones.

**Probar sala demo** permite recorrer el mapa y la interfaz sin cuatro clientes.

## Arquitectura

| Capa | Responsabilidad |
|---|---|
| Phaser 3 | Render, input, HUD, paneles y predicción local |
| Node.js + Express | Servir cliente y proceso de juego |
| Socket.IO | Transporte multijugador |
| Servidor en memoria | Autoridad de salas, fases, movimiento, tareas, sabotajes y victoria |

```text
shared/world-data.js            mapa, zonas, paredes, puertas, obstáculos y estaciones
shared/minigames.js             reducers deterministas de los cinco minijuegos
server/index.js                 trust boundary Socket.IO
server/roomManager.js           salas, movimiento y sesiones autoritativas de tareas
server/worldCollision.js        colisión de segmentos y línea de interacción
server/projections.js           proyecciones públicas, privadas y finales
client/src/scenes/GameScene.js  mundo, reconciliación y lifecycle de paneles
client/src/systems/             red, UI, mundo, minijuegos y layouts
```

El cliente presenta y predice; el servidor decide. `shared/` es la fuente común para geometría y reducers que deben coincidir en navegador y Node.

## Integridad y autoridad

- Los snapshots públicos no incluyen roles, objetivos privados ni cooldowns ajenos.
- `game:role` y `game:private` se envían solo al socket propietario.
- El servidor valida fase, tipos, límites, velocidad, colisiones, proximidad y línea de interacción.
- Una tarea requiere `task:start` y un token de sesión; `task:complete` directo falla de forma cerrada.
- Reunión, fin de partida, burnout, bloqueo, puerta, pérdida de acceso o tarea ya completada invalidan sesiones activas.
- Los sabotajes validan IDs, rol, objetivo y proximidad antes de mutar estado o consumir cooldown.

## Verificación

```bash
npm test
npm run check
git diff HEAD --check
```

La suite usa `node:test` y cubre Socket.IO, autoridad, payloads hostiles, proyecciones, colisiones, sesiones, lifecycle y layouts. El gate de runtime adicional usa cuatro Chrome aislados y la matriz `390×844`, `360×640`, `640×390`, `568×320` y `360×300`.

Detalles:

- [`PROJECT.md`](PROJECT.md): mapa del código y contratos.
- [`DOCS.md`](DOCS.md): autoridad, protocolo y límites técnicos.
- [`TEST_INFRA.md`](TEST_INFRA.md): estrategia y comandos de QA.
- [`TEST_READY.md`](TEST_READY.md): último resultado verificado.
- [`PRODUCT.md`](PRODUCT.md) y [`DESIGN.md`](DESIGN.md): producto y dirección visual.

## Alcance

Incluye una oficina `1200×900`, cinco minijuegos, sabotajes, moral/burnout, puertas, reunión, votación, victoria y revancha. No incluye cuentas, persistencia, matchmaking ni escalado horizontal; las salas viven en RAM de una sola instancia.

## Licencia

MIT
