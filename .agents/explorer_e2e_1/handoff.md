# Handoff Report — E2E Test Infrastructure & Case Inventory Design

This report outlines the observations, logical inferences, caveats, and conclusions made during the exploration of the OfiChaos codebase, along with a guide on how to verify the designed test infrastructure.

---

## 1. Observation

During our technical exploration of the `/Users/luisdeleon/AIWorkspace/games/ofichaos/` codebase, we directly observed the following files and structural patterns:

1.  **Missing Sanction & Suspension Enforcement**:
    *   In `server/gameState.js:313`, the server sets a player's suspension duration:
        ```javascript
        p.suspendedUntil = Date.now() + 30000;
        ```
    *   In `server/gameState.js:317`, the server sets an ability block duration:
        ```javascript
        p.abilityBlockedUntil = Date.now() + 30000;
        ```
    *   A system-wide search (`grep_search`) for both properties across all files in the `server/` directory confirmed they are never evaluated.
    *   Specifically, `canUseAbility` in `server/index.js` (lines 354–362) only verifies standard cooldown structures via `sabotage.checkCooldown(player, ability)`, ignoring the `abilityBlockedUntil` constraint.
    *   Similarly, `movePlayer` in `server/roomManager.js` (lines 103–119) locks movement only if the global game phase is `meeting` or `voting`:
        ```javascript
        // No permitir movimiento si está en burnout o reunión o suspendido
        if (room.gameState && room.gameState.phase === 'meeting') return p;
        if (room.gameState && room.gameState.phase === 'voting') return p;
        ```
        It fails to evaluate `suspendedUntil`.

2.  **No Server-Side Distance Validation for Tasks**:
    *   In `server/roomManager.js:121–141`, the `completeTask` function processes the player's completion emit. It checks if the room is active, if the task is completed/blocked, and if the player is in burnout:
        ```javascript
        function completeTask(code, playerId, taskId) {
          const room = rooms[code];
          if (!room || !room.gameState) return { error: 'No hay partida activa' };
          const task = room.gameState.taskStates.find((t) => t.id === taskId);
          if (!task || task.completed) return { error: 'Tarea no disponible' };
          if (task.blockedUntil && Date.now() < task.blockedUntil) return { error: 'Tarea bloqueada temporalmente por sabotaje' };
          const p = room.players[playerId];
          if (!p) return { error: 'Jugador no encontrado' };
          if (p.burnoutUntil && Date.now() < p.burnoutUntil) return { error: 'En burnout' };

          task.completed = true;
          // ...
        ```
    *   No geometric check is conducted to confirm if the player's server-side coordinates `(p.x, p.y)` are within the task zone or within the interaction distance threshold (`getTaskInteractionDistance()`).

3.  **No Server-Side Speed Verification (Teleport Cheat Vulnerability)**:
    *   In `server/roomManager.js` (lines 103–119), `movePlayer` immediately accepts coordinates `x` and `y` transmitted by the client, without verifying the distance delta from the player's last recorded position.

4.  **Client-Side Event Wrappers**:
    *   `client/src/systems/networking.js` contains a thin wrapper that emits socket events directly:
        ```javascript
        export function completeTask(taskId) {
          socket.emit('task:complete', { taskId });
        }
        ```

5.  **Exposed Game Reference**:
    *   `client/src/main.js` (line 30) binds the Phaser instance to the global window:
        ```javascript
        window.game = game; // debug
        ```

---

## 2. Logic Chain

1.  Because `window.game` is bound to the global window context in `client/src/main.js`, we can utilize browser automation frameworks like Playwright to inspect active Phaser scenes (`window.game.scene.keys.GameScene`) and verify the coordinates of DOM/canvas elements for R1 (Responsive HUD) and R2 (Collisions).
2.  Because the server process receives arbitrary coordinate moves in `player:move` and processes `task:complete` events without asserting position bounds or checking the distance to the task zone center, there is a risk of client-side spoofing.
3.  Because the sanction penalties (`abilityBlockedUntil` and `suspendedUntil`) are computed and written to player state but never verified in the socket event controllers or movement loops, players who receive two sanctions can still move, and players with blocked abilities can still trigger sabotages.
4.  Therefore, our E2E design requires a **dual-runner architecture**:
    *   *Socket integration tests* to simulate multiple concurrent players and assert state logic (including catching the missing sanctions enforcement and distance validation bugs).
    *   *Headless browser tests* to resize the viewport, interact with the canvas/DOM container, and verify visual/HUD positioning.

---

## 3. Caveats

*   **Arcade Physics Emulation**: The server has no concept of map geography or obstacles. All physical collisions (desks, walls) are resolved locally on the client (Phaser Arcade Physics) before transmitting updated coordinates to the server. Our E2E tests for collisions must run inside a headless browser (Tier 3) rather than raw socket emitters.
*   **Demo State**: The server has a demo/mock initialization branch in index.js, but for proper integration testing, tests should spawn a clean server instance.

---

## 4. Conclusion

We have designed a robust E2E test infrastructure that addresses both client-side rendering/physics and server-side state machines.
*   The **test philosophy, architecture, and case inventory** are documented in `/Users/luisdeleon/AIWorkspace/games/ofichaos/TEST_INFRA.md`.
*   We designed **60 detailed test cases** divided across 4 tiers:
    *   **Tier 1: Core Server State (25 Cases)**
    *   **Tier 2: Multiplayer Integration (25 Cases)**
    *   **Tier 3: UI, Physics & Interactivity (5 Cases)**
    *   **Tier 4: Adversarial & Cheat Resistance (5 Cases)**
*   The inventory includes specific assertions to verify the identified bugs (missing sanctions enforcement and missing server-side distance checks), ensuring the test suite will immediately flag these issues once implemented.

---

## 5. Verification Method

To verify the test design documents:
1.  **Inspect the Design Document**: Read and review the complete inventory and runner layout at:
    `/Users/luisdeleon/AIWorkspace/games/ofichaos/TEST_INFRA.md`
2.  **Verify Code Paths**: Compare the observations in this report with the codebase:
    *   Check `server/gameState.js:313` and `server/gameState.js:317` to verify where sanction timers are set.
    *   Check `server/index.js` and `server/roomManager.js` to confirm they are never read.
    *   Check `server/roomManager.js:121` to verify the lack of coordinates distance check during task completion.
