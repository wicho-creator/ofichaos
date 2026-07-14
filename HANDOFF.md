# OfiChaos — Handoff para siguiente agente

## Estado actual
- **MVP jugable y deployado** en https://ofichaos.onrender.com
- **Repo público:** https://github.com/wicho-creator/ofichaos
- **Carpeta local:** `/home/nas/AIWorkspace/games/ofichaos`
- **Stack:** Phaser 3.80 + Node.js + Express + Socket.IO
- **Deploy:** Render.com free tier (oregon), auto-deploy desde `main`
- **Verificado:** smoke test multi-cliente en producción (PASS)
- **Ojo:** la UI/HUD del `GameScene` sigue teniendo problemas responsivos en viewports bajos; está mejor que al inicio, pero **NO está resuelto del todo**.

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

## Limitaciones conocidas / foco pendiente
1. Sin persistencia (salas se pierden al reiniciar servidor)
2. Free tier sleep (Render duerme tras 15 min inactivo)
3. Sprites placeholder (mejorados, pero todavía no son arte final)
4. Minijuegos simples (barra de progreso, clicks)
5. **UI/HUD responsivo incompleto:** en pantallas bajas siguen apareciendo recortes/traslapes del HUD sobre el mapa o bordes del viewport
6. Sin colisiones con mobiliario
7. Sistema de puntos simplificado
8. Objetivos secundarios ya se verifican, pero siguen simplificados
9. Sabotajes del lamebotas ya existen, pero falta pulido/balance
10. Reportar sabotaje del empleado ya existe, pero la UX visual sigue verde

## Top 3 prioridades reales al retomar
1. **Arreglar UI/HUD responsive del GameScene** — el problema principal actual; revisar layout con `this.scale.width/height`, zoom/cámara y overlays fijos
2. **Pulir interacción de tasks** — ya existe workaround con tecla `E` y botón azul `🛠`, pero el click/UX todavía no es suficientemente robusto
3. **Pulido visual general** — pasar de prototipo funcional a UI realmente limpia/mobile-friendly

## Arquitectura clave
- **Estado en RAM** — `roomManager.js` mantiene `rooms{}` con todo el estado. No hay DB.
- **Game loop** — `setInterval` cada 1 seg en `server/index.js` (tick de timer, burnout, victoria, reunión)
- **Roles** — `roles.js assignRoles()`: 1 jefe (≥4 jugadores) + 1 lamebotas (≥5) + resto empleados
- **Transiciones** — `gameState.js` maneja playing → meeting → voting → playing
- **Plugin DOM** — `client/src/main.js` requiere `dom: { createContainer: true }` para inputs HTML en Phaser
- **Phaser desde CDN** — `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
- **Socket.IO cliente** — servido por Express desde `/socket.io/socket.io.js`

## Estado específico del bug de UI (importante)
- El HUD se movió varias veces para sacar traslapes del mapa, pero en producción todavía puede verse mal según el viewport.
- En pantallas bajas, el combo `camera zoom + overlays fijos + Phaser RESIZE` sigue generando recortes o invasión visual.
- Se agregó un workaround funcional para tasks:
  - tecla `E`
  - botón azul `🛠`
  - rango de interacción más permisivo en viewport bajo
- Esto hace el juego más usable, pero **no corrige de raíz** el layout.

## Últimos commits relevantes
- `571437f` — `fix: compactar hud y acceso a tareas`
- `1c0b966` — `fix: separar hud del mapa`
- `449eb83` — `style: redondear UI estilo juego`

## Convenciones
- Commits en español, prefijos: `feat:`, `fix:`, `docs:`, `security:`
- PORT default 3000, usar 3456 local (Hermes ocupa 3000)
- Credenciales NUNCA en el repo — solo en `WichosBrain/APIS.md`
- Smoke test: crear 4+ clientes socket.io, sala, `game:start`, verificar roles + tareas + reunión
