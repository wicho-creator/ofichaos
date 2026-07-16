# OfiChaos — Handoff

## Estado actual

- Proyecto canónico: `/Users/luisdeleon/AIWorkspace/games/ofichaos`.
- Rama de trabajo: `feat/ofichaos-minigames-map-pass`.
- Base/producción actual: `6986346` en <https://ofichaos.onrender.com>.
- La rama incorpora mapa compartido, colisión autoritativa, cinco minijuegos, sesiones de tarea, hardening Socket.IO, privacidad, lifecycle y responsive compacto.
- No asumir que producción contiene estos cambios hasta confirmar commit, push y deploy.

## Para retomar

```bash
cd /Users/luisdeleon/AIWorkspace/games/ofichaos
git status --short --branch
npm test
npm run check
git diff HEAD --check
```

Lee en este orden:

1. `README.md` — ejecución y resumen.
2. `PROJECT.md` — mapa del código y contratos.
3. `DOCS.md` — autoridad y protocolo.
4. `TEST_INFRA.md` — gates.
5. `TEST_READY.md` — último freeze.

## Invariantes que no deben relajarse

- El cliente nunca completa tareas por sí solo.
- Movimiento, tareas y habilidades requieren fase `playing`.
- Los IDs externos se validan por tipo y allowlist antes de mutar estado.
- Cooldown/estadística se consumen solo después de éxito.
- Cualquier pérdida de acceso invalida el token de tarea.
- Reporte requiere heartbeat continuo; no acredita gaps largos.
- Roles, objetivos y cooldowns ajenos no salen en proyecciones públicas.
- Reunión, resize y shutdown destruyen paneles/holds y callbacks pendientes.
- Cliente y servidor comparten `shared/world-data.js` y `shared/minigames.js`.

## Operación Git

`.hermes/` y `.impeccable/` son artefactos locales y no se versionan. Los harnesses y perfiles de Chrome viven en `/tmp`. No usar `git add -A` sin revisar `git status`; stagear explícitamente producto, tests y documentos.

Commits usan prefijos convencionales (`feat:`, `fix:`, `docs:`, `test:`). Push y deploy son pasos separados y requieren decisión explícita.

## Alcance pendiente conocido

- persistencia/reconexión de salas;
- escalado horizontal;
- balance con partidas humanas;
- arte/audio final y accesibilidad DOM/lector de pantalla para UI canvas;
- automatizar en CI los harnesses Chrome/CDP hoy mantenidos fuera del repo.
