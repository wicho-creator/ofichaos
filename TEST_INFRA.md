# OfiChaos — E2E Test Infrastructure & Case Inventory

This document outlines the End-to-End (E2E) testing philosophy, architecture, test runner design, and a comprehensive test case inventory for the OfiChaos MVP completion.

---

## 1. Test Philosophy

To verify the multiplayer stability and game client responsiveness of OfiChaos, our E2E testing strategy separates concerns into two distinct execution runners:

1. **Backend & State Integration Runner (Socket-Level)**:
   - **Type**: Headless multi-client simulation.
   - **Core Loop**: Simulates multiplayer lobby creations, room joining, game start, role assignments, real-time client state updates, movement throttling, task validations, cooldown checks, meeting/chat phases, votingTallies, and win/loss evaluations.
   - **Rationale**: Game state is held fully in server RAM. A socket-level integration test suite validates multiplayer state machines without the overhead of browser rendering.

2. **Frontend Interactivity & Layout Runner (Browser-Level)**:
   - **Type**: Headless browser automation (via Playwright or Puppeteer).
   - **Core Loop**: Loads the Phaser client, resizes the viewport to stress responsive layout constraints (R1), simulates player inputs to test Arcade Physics boundaries (R2), triggers minigame interfaces (R3), monitors sprite transitions (R4), and tests overlays (R5).
   - **Rationale**: Layout correctness, button clickability, Phaser engine scene swaps, and local physics collisions cannot be verified through raw socket emissions.

---

## 2. Test Architecture & Runner Design

### 2.1 Socket Integration Test Runner (Node.js + Mocha + Socket.io-Client)

The socket runner programmatically launches the server, intercepts socket emissions, manages a pool of mock client sockets, and asserts server-side game state correctness.

#### Design Architecture
- **Server Orchestrator**: Starts the server on a dedicated testing port (e.g., `3458`) before test suite execution, and kills the process on completion.
- **Client Factory**: Spawns multiple `socket.io-client` instances using independent connections and maps their event handlers.
- **Promise-Based Sync Helpers**:
  - `once(socket, event, timeout)`: Wraps event listeners in Promises to block test execution until a server response or timeout.
  - `connectClients(count)`: Returns an array of connected sockets.
  - `createAndJoinLobby(clients, hostName, clientNames)`: Automated sequence for setting up a lobby and returning the room code.
  - `waitForState(client, predicateFn, timeout)`: Periodically evaluates incoming `game:update` payloads until the condition is met.

#### Code Runner Design Blueprint (Skeleton)
```javascript
const { expect } = require('chai');
const { io } = require('socket.io-client');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

// Test utilities
const TEST_PORT = 3458;
const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;

const once = (socket, event, timeout = 5000) => 
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

describe('OfiChaos Socket Integration Test Suite', () => {
  let serverInstance;
  let ioServer;

  before(async () => {
    // Programmatic server start
    const app = express();
    const server = http.createServer(app);
    ioServer = new Server(server);
    // Mock or load actual server handlers
    require('./server/index.js'); // Assuming index exports or runs on process.env.PORT
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  });

  after((done) => {
    ioServer.close();
    serverInstance.close(done);
  });

  it('TC-T2-01: Should transition lobby to playing state upon game:start', async () => {
    const clients = [];
    for (let i = 0; i < 4; i++) {
      const socket = io(TEST_URL, { transports: ['websocket'], forceNew: true });
      clients.push(socket);
      await once(socket, 'connect');
    }

    // Host creates room
    clients[0].emit('room:create', { name: 'Host' });
    const created = await once(clients[0], 'room:created');
    const roomCode = created.code;

    // Join remaining players
    for (let i = 1; i < 4; i++) {
      clients[i].emit('room:join', { code: roomCode, name: `Player_${i}` });
      await once(clients[i], 'room:joined');
    }

    // Setup started listeners
    const startedPromises = clients.map(s => once(s, 'game:started'));

    // Start game
    clients[0].emit('game:start');
    const startedPayloads = await Promise.all(startedPromises);

    expect(startedPayloads[0].phase).to.equal('playing');
    expect(startedPayloads[0].players.length).to.equal(4);

    // Cleanup
    clients.forEach(s => s.close());
  });
});
```

---

### 2.2 Frontend Interactivity Test Runner (Playwright + Phaser Inspector)

The frontend runner spawns headless browsers running the Phaser game, hooks into the exposed `window.game` instance, and triggers input actions.

#### Design Architecture
- **Browser instances**: Launch 4 parallel page contexts to test local client response and network synchronization.
- **Phaser Inspection Bridge**:
  - Exposes hooks to evaluate active scene key: `window.game.scene.getScenes(true)[0].scene.key`.
  - Queries active HUD coordinates: `window.game.scene.keys.GameScene.timerText.x`.
  - Inspects active task panels: `window.game.scene.keys.GameScene.activeTaskPanel`.
  - Simulates keyboard inputs directly on Phaser's input system to verify movement collisions.

#### UI Assertion Mechanics (Layout Testing)
```javascript
// Example Playwright assertion for Responsive HUD (R1)
async function verifyHUDResponsiveness(page, width, height) {
  await page.setViewportSize({ width, height });
  // Wait for Phaser resize logic
  await page.waitForTimeout(200);
  
  const hudLayout = await page.evaluate(() => {
    const gameScene = window.game.scene.keys.GameScene;
    if (!gameScene || !gameScene.sys.isActive()) return null;
    
    // Retrieve positions of key components
    return {
      timerX: gameScene.timerText.x,
      timerY: gameScene.timerText.y,
      moraleX: gameScene.moraleBar.x,
      moraleY: gameScene.moraleBar.y,
      screenWidth: gameScene.scale.width,
      screenHeight: gameScene.scale.height
    };
  });
  
  // Assert no overlap or out-of-screen coordinate values
  expect(hudLayout.timerY).toBeLessThan(100);
  expect(hudLayout.moraleX).toBeGreaterThan(hudLayout.screenWidth - 400);
}
```

---

## 3. Feature Inventory

The OfiChaos E2E testing suite validates the following 5 key features (R1–R5):

*   **R1: Responsive UI/HUD**: Repositioning and scaling of top timers, task lists, role displays, moral progress meters, action buttons, and mobile joystick overlays. Layout bounds verification down to 375x667.
*   **R2: Physics/Collisions**: Arcade Physics execution, static obstacle blocking (walls, desks, chairs, server racks), coordinate clamps on map margins (1200x900), and speed limit checks.
*   **R3: Tasks/Minigames**: Interaction distance bounds verification (`getTaskInteractionDistance()`), click events, cable alignment sequences, progress bar duration intervals, lamebotas block triggers, and employee progress ticks.
*   **R4: Character Polish**: Sprite layout updates, walk/idle state swaps based on coordinate deltas, texture flipping (direction facing), and floating warning/alert animations.
*   **R5: Sabotages/Meetings**: Saboteur cooldown management, zone-wide morale drops, door lockouts, false alerts, emergency meetings transitions, voting counts, skips, sanctions, ability blocks, and suspensions.

---

## 4. E2E Test Cases Inventory (60 Cases)

### 4.1 Tier 1: Core Server State & Single-Player Mechanics (25 Cases)

| Case ID | Feature | Objective | Prerequisites | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-T1-01** | R5 | Room creation code gen | Server running | Client emits `room:create` with name 'P1' | Server returns `room:created` payload with 5-letter uppercase room code, player ID, and assigns player as host. |
| **TC-T1-02** | R5 | Name sanitization | Server running | Client emits `room:create` with name 'VeryLongNameExceedingLimit' | Server slices name to 12 characters max and defaults empty names to 'Jugador'. |
| **TC-T1-03** | R5 | Room joining success | Room created | Client 2 emits `room:join` with valid code | Server returns `room:joined` event to Client 2 and broadcasts updated `room:update` to all room members. |
| **TC-T1-04** | R5 | Room joining limit | Room created with 12 clients joined | Client 13 emits `room:join` with code | Server rejects with `error:message` stating "Sala llena". |
| **TC-T1-05** | R5 | Host migration | Lobby with Host (P1) and P2 | Host disconnects from lobby | Server processes disconnect, assigns P2 as host, and broadcasts updated `room:update` payload. |
| **TC-T1-06** | R2 | Movement broadcast | Game started | Client emits `player:move` with coordinates `{x: 200, y: 300}` | Server records player position in memory and broadcasts `player:moved` to all other room clients. |
| **TC-T1-07** | R2/R5 | Move block in meeting | Game in meeting phase | Client emits `player:move` | Server ignores movement updates, keeping player at pre-meeting coordinates. |
| **TC-T1-08** | R2/R5 | Move block in voting | Game in voting phase | Client emits `player:move` | Server ignores movement updates, keeping player coordinates locked. |
| **TC-T1-09** | R2 | Coordinate boundary clamping | Game started | Client emits `player:move` with `{x: 1300, y: -50}` | Client engine clamps positions within `20` and `1180` for X, and `20` and `880` for Y. |
| **TC-T1-10** | R3 | Tasks initialization | Game started | Wait for initial `game:started` payload | `taskStates` array contains 5 defined tasks (cafe, archivos, correos, reporte, wifi) with `completed: false` and `completedBy: null`. |
| **TC-T1-11** | R3 | Task completion state | Game started, task 'cafe' active | Client emits `task:complete` with `{taskId: 'cafe'}` | Server sets `cafe` task to `completed: true`, sets `completedBy` to player's ID, and increments `tasksCompleted`. |
| **TC-T1-12** | R3 | Tasks percent calculation | Game started | 2 of 5 tasks are completed by players | `taskPercent` in global payload returns exactly `40` (percent rounded). |
| **TC-T1-13** | R3 | Task morale gain | Game started, player morale at 80 | Player emits `task:complete` | Player's morale increases to 85. Capped at 100 on subsequent completes. |
| **TC-T1-14** | R4/R5 | Role assignment: 4 players | Lobby with 4 players | Host emits `game:start` | Exactly 1 player receives 'jefe' role, 3 receive 'empleado', 0 receive 'lamebotas'. |
| **TC-T1-15** | R4/R5 | Role assignment: 5 players | Lobby with 5 players | Host emits `game:start` | Exactly 1 player receives 'jefe', 1 receives 'lamebotas', and 3 receive 'empleado'. |
| **TC-T1-16** | R4 | Objectives assignment | Game started | Check initial player states | Every player is assigned a random `secondaryObjective` with matching descriptive instruction text. |
| **TC-T1-17** | R5 | Private role emissions | Game started | Listen to private socket channels | Each client receives their own secret role via `game:role` event; no other client receives it. |
| **TC-T1-18** | R5 | Emergency meeting trigger | Game started, emergency call available | Client emits `meeting:call` | Server updates phase to 'meeting', sets `meetingActive: true`, and assigns `meetingTimer` to 60000ms. |
| **TC-T1-19** | R5 | Emergency meeting limit | Meeting ended | Client emits `meeting:call` a second time | Server rejects with `error:message` stating "Ya usaste tu reunión" (limit 1 meeting per game). |
| **TC-T1-20** | R5 | Voting phase transition | Game in meeting phase | Wait 60 seconds (or simulate tick expiration) | Phase transitions to 'voting', setting `votingTimer` to 20000ms. |
| **TC-T1-21** | R5 | Meeting chat relay | Game in meeting phase | Client emits `meeting:chat` with message | Server broadcasts message to all clients in the room via `meeting:chat` event. |
| **TC-T1-22** | R5 | Sabotage trigger (Zone) | Game started, Jefe cooldown ready | Jefe client emits `sabotage:zone` with `{zoneId: 'cocina'}` | Server adds zone sabotage to active sabotages list, sets expires to +20s, and broadcasts event. |
| **TC-T1-23** | R5 | Ability cooldown initialization | Game started | Client triggers ability | Player's `abilityCooldowns` object receives timestamp matching ability cooldown duration. |
| **TC-T1-24** | R5 | Ability cooldown enforcement | Cooldown active | Client emits `sabotage:zone` before cooldown timestamp | Server rejects with `error:message` stating "Habilidad en cooldown". |
| **TC-T1-25** | R5 | Direct morale damage | Game started | Jefe emits `sabotage:morale` targeting Client 2 | Client 2's morale decreases by exactly 20. |

---

### 4.2 Tier 2: Multiplayer Integration & Happy-Path Workflows (25 Cases)

| Case ID | Feature | Objective | Prerequisites | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-T2-01** | R5 | Lobby startup check | Lobby with 4 clients | Host emits `game:start` | Server broadcasts `game:started` payload to all clients, transitions room status to playing. |
| **TC-T2-02** | R5 | Start player validation | Lobby with 3 clients | Host emits `game:start` | Server rejects start with error stating "Se necesitan mínimo 4 jugadores". |
| **TC-T2-03** | R5 | Full meeting cycle | Game started | Call meeting, wait 60s, cast votes, wait 20s | Game transitions playing -> meeting -> voting -> playing automatically. |
| **TC-T2-04** | R5 | Periodic tick updates | Game started | Run game loop loop timer ticks | Server broadcasts `game:tick` every 1s containing remaining time, task completion rate, and player coords. |
| **TC-T2-05** | R3 | Employee victory trigger | Game started, completion at 60% | Player completes remaining tasks to hit 80% | Server transitions game phase to 'ended', sets winners to 'empleados', and calculates final points. |
| **TC-T2-06** | R3 | Tasks completion scoring | Game ended | Read final point values | Final scores show +10 points per completed task for employees. |
| **TC-T2-07** | R3 | Task blocking sabotage | Game started, task 'archivos' active | Lamebotas emits `sabotage:block_task` for 'archivos' | Task state receives `blockedUntil` timestamp. Any client attempts to complete task fail with block error. |
| **TC-T2-08** | R3 | Reject double complete | Task 'reporte' already completed | Client emits `task:complete` for 'reporte' | Server rejects task completion, returns "Tarea no disponible" error. |
| **TC-T2-09** | R5 | Burnout state activation | Player morale drops to 0 | Jefe uses `sabotage:morale` on player with 20 morale | Player enters burnout, `burnoutUntil` is set to +20s, and player is added to `burnedOutPlayers` set. |
| **TC-T2-10** | R2 | Burnout movement penalty | Player in burnout | Player moves WASD keys | Player coordinates are restricted to 50% displacement speed in room manager. |
| **TC-T2-11** | R3 | Burnout task lockout | Player in burnout | Player emits `task:complete` | Server rejects completion, returning "En burnout" error. |
| **TC-T2-12** | R5 | Burnout automatic recovery | Burnout timer expires (+20s) | Let 20s pass in game ticks | Player is removed from `burnedOutPlayers`, morale is restored to 30, and movement/tasks normalize. |
| **TC-T2-13** | R5 | Boss win by timeout | Game started, tasks < 80% | Simulates time remaining expiring to 0 | Server transitions phase to 'ended', sets winners to 'jefe', and determines lamebotas winners. |
| **TC-T2-14** | R5 | Boss win by burnout rate | Game started, 4 players (3 employees) | Jefe causes burnout on 2 of the 3 employees | Burnout percentage hit >= 50%. Server ends game immediately, declaring 'jefe' as winner. |
| **TC-T2-15** | R5 | Lamebotas win condition | Jefe wins, Lamebotas has 1 sanction | Game ends with Jefe victory | End payload includes Lamebotas player ID in `lamebotasWinners`. |
| **TC-T2-16** | R5 | Meeting skip resolution | Voting phase active | All players vote 'skip' | Voting ends, no sanctions applied, game returns to playing. |
| **TC-T2-17** | R5 | Sanction 1: Ability Block | Voting phase active | Player receives majority votes (1st offense) | Player receives sanction: `sanctions` count is 1, morale drops by 20, and `abilityBlockedUntil` is set to +30s. |
| **TC-T2-18** | R5 | Sanction 2: Suspension | Voting phase active, player has 1 sanction | Player receives majority votes (2nd offense) | Player receives sanction: `sanctions` count is 2, morale drops, and `suspendedUntil` is set to +30s. |
| **TC-T2-19** | R5 | Voting tie skip | Voting phase active | P1 receives 2 votes, P2 receives 2 votes | Voting ends in a tie. No sanction is applied, game returns to playing. |
| **TC-T2-20** | R5 | Lamebotas fake task morale | Lamebotas joined | Lamebotas emits `sabotage:fake_task` | Lamebotas' morale increases by +5, fake task count increments, and objective statuses update. |
| **TC-T2-21** | R5 | Lamebotas false report | Lamebotas joined | Lamebotas emits `sabotage:false_report` | Morale of all other players drops by 8, and active false report sabotage is added. |
| **TC-T2-22** | R5 | Zone sabotage morale loss | Jefe triggers zone sabotage in 'cocina' | Player 2 (employee) is in 'cocina' during trigger | Player 2's morale drops by 15. Non-employees or players outside 'cocina' are unaffected. |
| **TC-T2-23** | R5 | Door lockout expiration | Jefe closes door in 'archivo' | Wait 15 seconds | Door closed active sabotage expires and is cleaned up, allowing movement into 'archivo'. |
| **TC-T2-24** | R5 | Report sabotage action | Zone sabotage active in 'cocina' | Employee in 'cocina' emits `sabotage:report` | Active sabotage is reported, meeting starts, and `sabotage:reported` broadcast is sent to all. |
| **TC-T2-25** | R5 | Cooldown updates on ticks | Ability on cooldown | Game ticks decrease time | Active player cooldown values decrease proportionally until reaching 0 (ready). |

---

### 4.3 Tier 3: UI, Physics & Client Interactivity (5 Cases)

| Case ID | Feature | Objective | Prerequisites | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-T3-01** | R1 | HUD responsive adjustments | Client loaded in browser | Playwright resizes screen to mobile (375x667), then desktop (1920x1080) | Top info panel, moral meter, tasks list, and action buttons scale and reposition dynamically without overlaps. |
| **TC-T3-02** | R2 | Obstacle collider blocking | Client inside GameScene | Playwright inputs movement keys towards a desk bounding box | Bounding box halts player position, preventing coordinates from advancing through the obstacle. |
| **TC-T3-03** | R3 | Interactive task overlays | Client inside GameScene, player near kitchen | Playwright clicks on 'Cocina' task zone or presses 'E' key | Phaser opens interactive cable task UI overlay panel; clicking cancel destroys overlay items. |
| **TC-T3-04** | R4 | Character animation direction | Client inside GameScene | Playwright holds 'A' (left), then releases | Player sprite transitions from idle to walk animation, shifts texture flip to face left, and returns to idle when stopped. |
| **TC-T3-05** | R5 | Meeting scene overlays | Meeting called | Transition client to MeetingScene | Layout switches to Meeting Scene displaying scrollable chat UI cards, name lists, and clickable skip/vote buttons. |

---

### 4.4 Tier 4: Adversarial, Security & Network Failure Resistance (5 Cases)

| Case ID | Feature | Objective | Prerequisites | Steps | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-T4-01** | R5 | Mid-game host migration | Game active, 4 players | Host client disconnects | Server migrates host permissions, broadcasts updated game state, and remaining clients continue game uninterrupted. |
| **TC-T4-02** | R2 | Anti-Cheat: Speed checking | Game active | Client emits `player:move` with coordinates indicating impossible speed (teleportation) | Server detects illegal velocity delta, rejects coordinates update, and resets player to last valid position. |
| **TC-T4-03** | R5 | Invalid voting rejects | Voting phase active | P1 emits `vote:cast` for P2 twice, or targeting non-existent P99 | Server registers only the first vote and rejects invalid target votes, returning error. |
| **TC-T4-04** | R5 | Sanctions enforcement | Voting finished, player suspended | Player emits movement keys or triggers abilities during suspension | **[KNOWN BUG WORKAROUND / TEST VERIFICATION]** Server must reject player movement and ability triggers while `suspendedUntil` or `abilityBlockedUntil` is active. |
| **TC-T4-05** | R3 | Anti-Cheat: Task distance validation | Game active | Client emits `task:complete` for 'wifi' while coordinates are at recepction (far distance) | Server checks distance between player coordinate and task zone center, rejecting completion with out-of-bounds error. |

---

## 5. Implementation Roadmap & Execution Command

To execute the completed test suite in subsequent milestones, the package configuration will be updated to support the following scripts:

```json
"scripts": {
  "test:socket": "mocha tests/socket/**/*.test.js --timeout 15000",
  "test:ui": "playwright test tests/ui/**/*.spec.js",
  "test": "npm run test:socket && npm run test:ui"
}
```

This layout separates the lightweight, high-speed socket integration assertions from the browser rendering assertions, allowing developers to run fast state checks before committing code.
