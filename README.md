# 🎮 OfiChaos
### El caos de la oficina — Juego multijugador online

> **🚀 Jugar ahora:** https://ofichaos.onrender.com
> **📦 Código:** https://github.com/wicho-creator/ofichaos

OfiChaos es un juego tipo *Among Us* ambientado en una oficina tóxica y cómica. Los jugadores reciben roles secretos (Empleado, Jefe, Lamebotas), completan tareas, sabotean, convocan reuniones y votan para ganar.

**Documentación técnica completa:** ver `DOCS.md`

---

## 🛠️ Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | **Phaser.js 3.80** (2D top-down) |
| Backend | **Node.js + Express** |
| Multiplayer | **Socket.IO** |

---

## 📦 Instalación

```bash
# 1. Clonar o descargar el proyecto
cd ofichaos

# 2. Instalar dependencias
npm install

# 3. Ejecutar el servidor
npm run dev
# o: PORT=3456 npm run dev (si el puerto 3000 está ocupado)
```

El servidor levanta por defecto en `http://localhost:3000`.
Si el puerto está ocupado, usar `PORT=3456 npm run dev`.

---

## ▶️ Cómo jugar localmente

1. Abrir `http://localhost:3000` (o el puerto configurado) en el navegador.
2. Escribir un nombre y hacer click en **Crear sala**.
3. Compartir el código de sala (5 letras) con otros jugadores.
4. Los demás abren la misma URL, escriben su nombre, ingresan el código y hacen click en **Unirse**.
5. Cuando haya **mínimo 4 jugadores**, el host (creador de la sala) puede hacer click en **Iniciar partida**.
6. Cada jugador recibe un **rol secreto** y un **objetivo secundario** en pantalla.
7. Moverse con **WASD** o las **flechas**.
8. Hacer click en una zona cercana para iniciar una tarea.
9. El Jefe y Lamebotas pueden sabotear con el botón 💀. Las habilidades tienen cooldown para evitar spam.
10. Los empleados pueden reportar sabotajes cercanos con 🚨; esto convoca reunión si el reporte es válido.
11. Cualquier empleado puede convocar una reunión con el botón 📋 (una vez por partida).
12. En la reunión: chatear (60 seg), luego votar (20 seg).
13. El jugador más votado recibe una sanción.

---

## 🗓️ Roles del MVP

### Empleado 🟢
- **Objetivo:** Completar tareas y descubrir al Jefe o Lamebotas.
- **Habilidades:** Hacer tareas, reportar sabotaje, convocar reunión (1x por partida).

### Jefe 🔴
- **Objetivo:** Evitar que los empleados completen el 80% de tareas antes de que acabe el tiempo.
- **Habilidades:** Sabotear zona, asignar tarea extra, bajar moral, cerrar puerta.

### Lamebotas 🟡
- **Objetivo:** Ayudar al Jefe sin ser descubierto.
- **Habilidades:** Fingir tarea, crear reporte falso, bloquear tarea y sabotear zonas.

### Cooldowns y reportes
- Las habilidades muestran su cooldown en el HUD.
- `fakeTask`, `falseReport` y `blockTask` ya tienen eventos reales de Socket.IO.
- Un empleado puede reportar un sabotaje activo/cercano para abrir una reunión.

---

## 🗺️ Mapa de la oficina

El mapa incluye 8 zonas conectadas:

| Zona | Tarea |
|------|-------|
| Recepción | Imprimir reporte |
| Cubículos | Responder correos |
| Sala de Juntas | — |
| Cocina | Preparar café |
| Archivo | Ordenar archivos |
| Oficina del Jefe | — |
| Recursos Humanos | — |
| Servidor / IT | Arreglar WiFi |

---

## 😊 Sistema de moral

Cada jugador empieza con **100 de moral**.

| Baja | Sube |
|------|------|
| Saboteado (-15) | Completar tarea (+5) |
| Tarea extra (-10) | Recibir ayuda |
| Fallar tarea | Sobrevivir reunión |
| Acusado en reunión (-20) | |

**Burnout:** Si la moral llega a 0, el jugador entra en burnout por 20 segundos (movimiento lento, sin tareas).

---

## 🏆 Condiciones de victoria

| Quién gana | Cuándo |
|------------|--------|
| **Empleados** | Completan 80% de tareas antes del tiempo |
| **Jefe** | El tiempo acaba y tareas < 80% |
| **Jefe** | 50% de empleados en burnout |
| **Lamebotas** | El Jefe gana Y el lamebotas no fue sancionado 2 veces |

---

## ⏱️ Duración

- Partida: **8 minutos**
- Reunión (discusión): **60 segundos**
- Votación: **20 segundos**

---

## 📁 Estructura del proyecto

```
ofichaos/
├── server/
│   ├── index.js          # Servidor Express + Socket.IO
│   ├── roomManager.js    # Salas privadas con código
│   ├── gameState.js      # Estado de partida, moral, victoria
│   ├── roles.js          # Asignación de roles y objetivos
│   ├── tasks.js          # Definición de tareas y zonas
│   └── sabotage.js       # Lógica de sabotajes
├── client/
│   ├── index.html        # HTML base
│   └── src/
│       ├── main.js              # Config de Phaser
│       ├── scenes/
│       │   ├── LobbyScene.js    # Crear/unirse a sala, lobby
│       │   ├── GameScene.js     # Mapa, movimiento, tareas, HUD
│       │   ├── MeetingScene.js  # Chat y votación
│       │   └── EndScene.js      # Pantalla final
│       └── systems/
│           ├── player.js        # Sprites de jugadores
│           ├── tasks.js         # Definición de tareas (cliente)
│           ├── ui.js            # Botones y paneles en Phaser
│           └── networking.js    # Wrapper de Socket.IO
├── package.json
└── README.md
```

---

## 📜 Pendientes para versión 2

- [ ] **Roles adicionales:** Pasante, Integrista, Dinosaurio.
- [ ] **Minijuegos reales** en lugar de barras de progreso (con perplejidad real).
- [x] **Sprites básicos mejorados** en lugar de círculos simples (personajes placeholder con rol visual).
- [ ] **Colisiones** entre jugadores y mobiliario del mapa.
- [x] **Cámara** que sigue al jugador + zoom.
- [ ] **Registro/Login** con persistencia de perfil.
- [ ] **Estadísticas y ranking** entre partidas.
- [ ] **Persistencia de salas** para reconexión tras desconexión.
- [ ] **Bots IA** para llenar salas con <4 jugadores.
- [ ] **Mapas múltiples** (varias oficinas seleccionables).
- [ ] **Sistema de skins** personalizables.
- [ ] **Animaciones de sprites** (caminar, hacer tarea, sabotear).
- [ ] **Efectos de sonido** y música de oficina.
- [ ] **Notificaciones push** de sabotajes en pantalla.
- [x] **Cooldown indicator visual** en botones de habilidad.
- [x] **Verificación de objetivo secundario** al final/payload de estado.
- [ ] **Sistema de puntos completo** (actualmente simplificado en MVP).
- [ ] **Tests automatizados** de lógica de juego (jest).
- [ ] **Deploy en producción** (glitch/Render/Fly.io con Redis para salas).
- [ ] **PWA mobile-first** para jugar desde celular.
- [ ] **Spectator mode** para jugadores sancionados/suspendidos.
- [ ] **Tareas cooperativas** (2+ jugadores necesarias).
- [ ] **Eventos aleatorios** (corte de luz, fiesta sorpresa, inspector).

---

## 📄 Licencia

MIT — Hecho con 💜 para divertirse con amigos.

