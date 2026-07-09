# OfiChaos — Handoff para siguiente agente

## Estado actual
- **MVP completo y deployado** en https://ofichaos.onrender.com
- **Repo público:** https://github.com/wicho-creator/ofichaos
- **Carpeta local:** `/home/nas/AIWorkspace/games/ofichaos`
- **Stack:** Phaser 3.80 + Node.js + Express + Socket.IO
- **Deploy:** Render.com free tier (oregon), auto-deploy desde `main`
- **Verificado:** smoke test 4 clientes WebSocket en producción (PASS)

## Documentación del proyecto
- `README.md` — instalación, cómo jugar, roles, mapa, pendientes v2
- `DOCS.md` — arquitectura, eventos Socket.IO, config Phaser, limitaciones
- `HANDOFF.md` — este archivo

## Credenciales
**No están en el repo.** Ver `WichosBrain/APIS.md` (GitHub PAT, Render API Key, Owner ID, Service ID).

## Cómo correr local
```bash
cd /home/nas/AIWorkspace/games/ofichaos
PORT=3456 npm run dev   # puerto 3000 ocupado por Hermes
```

## Cómo deployar
```bash
cd /home/nas/AIWorkspace/games/ofichaos
git add -A && git commit -m "cambio" && git push origin main
# Render auto-deploya en ~30 seg
```

## Limitaciones conocidas (prioridades para v2)
1. Sin persistencia (salas se pierden al reiniciar servidor)
2. Free tier sleep (Render duerme tras 15 min inactivo)
3. Sprites placeholder (círculos, no pixel art)
4. Minijuegos simples (barra de progreso, clicks)
5. Cámara fija (no sigue al jugador)
6. Sin colisiones con mobiliario
7. Sistema de puntos simplificado
8. Objetivos secundarios no se verifican automáticamente
9. Sabotajes del lamebotas NO implementados (fakeTask, falseReport, blockTask)
10. Reportar sabotaje del empleado NO implementado

## Top 3 prioridades v2
1. **Implementar sabotajes del lamebotas** — fakeTask, falseReport, blockTask tienen definición en `roles.js` pero no eventos socket ni botones en el cliente
2. **Verificación de objetivos secundarios** — se asignan 8 posibles pero nunca se comprueba cumplimiento para puntos
3. **Cámara que sigue al jugador** + zoom — estructural, cambia la UX completa del GameScene

## Arquitectura clave
- **Estado en RAM** — `roomManager.js` mantiene `rooms{}` con todo el estado. No hay DB.
- **Game loop** — `setInterval` cada 1 seg en `server/index.js` (tick de timer, burnout, victoria, reunión)
- **Roles** — `roles.js assignRoles()`: 1 jefe (≥4 jugadores) + 1 lamebotas (≥5) + resto empleados
- **Transiciones** — `gameState.js` maneja playing → meeting → voting → playing
- **Plugin DOM** — `client/src/main.js` requiere `dom: { createContainer: true }` para inputs HTML en Phaser
- **Phaser desde CDN** — `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
- **Socket.IO cliente** — servido por Express desde `/socket.io/socket.io.js`

## Convenciones
- Commits en español, prefijos: `feat:`, `fix:`, `docs:`, `security:`
- PORT default 3000, usar 3456 local (Hermes ocupa 3000)
- Credenciales NUNCA en el repo — solo en `WichosBrain/APIS.md`
- Smoke test: crear 4 clientes socket.io, sala, `game:start`, verificar roles + tareas + reunión
