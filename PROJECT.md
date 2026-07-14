# Project: OfiChaos MVP Completion

## Architecture
OfiChaos is a multiplayer game consisting of:
- **Server**: Node.js + Express + Socket.IO. Handles game state in RAM, lobby management, game loops, player positions, task validation, sabotage events, and meeting/voting phases.
- **Client**: Phaser 3 HTML5 game engine. Communicates with server via Socket.IO, renders the 2D office layout, handles player input (keyboard/mouse/mobile controls), displays the HUD overlays, and hosts interactive mini-games for tasks.

## Code Layout
- `server/`: Server-side game logic
  - `server/index.js`: Main server entry and Socket.IO events
  - `server/roomManager.js`: Room creation, joining, and player actions
  - `server/gameState.js`: Game lifecycle, points, voting, and win conditions
  - `server/roles.js`: Role definitions and secondary objectives
  - `server/tasks.js`: Task definitions and server task state
  - `server/sabotage.js`: Cooldowns, sabotage activation, and effects
- `client/`: Frontend codebase
  - `client/index.html`: Base entry point loading Phaser and Socket.IO client
  - `client/src/main.js`: Phaser configuration and scene bootstrapper
  - `client/src/scenes/`: Phaser scenes
    - `LobbyScene.js`: Name input, lobby setup, player roster, and start game button
    - `GameScene.js`: 2D office map rendering, movement, task range checks, HUD, and task/sabotage overlays
    - `MeetingScene.js`: Interactive meeting chat and voting UI cards
    - `EndScene.js`: Victory status, player roles list, task count, and final scores
  - `client/src/systems/`: Subsystems
    - `player.js`: Character sprite creation, rendering, and animations
    - `tasks.js`: Client-side task definitions mirroring server
    - `ui.js`: Visual helper utilities for button/panel creation
    - `networking.js`: Socket.IO emission helper functions

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite | Implement opaque-box E2E test suite (Tiers 1-4) & infrastructure in `tests/e2e.test.js` | None | DONE |
| 2 | Responsive UI/HUD (R1) | Reposition and scale HUD elements dynamically on viewport resize (down to 375x667), fixing overlaps and clipping | M1 | DONE |
| 3 | Collisions & Map (R2) | Implement static colliders for office map; add Phaser Arcade physics for local player; add server-side speed validation (Anti-Cheat) | M2 | DONE |
| 4 | Task Mini-games (R3) | Replace progress bars with Cables, Reaction, and Sequence mini-games; add server-side task distance verification (Anti-Cheat) | M3 | DONE |
| 5 | Sprites & Polish (R4) | Upgrade circles to animated character sprites (idle/walking animation cycles), polish office map visuals | M4 | DONE |
| 6 | Sabotage & Meetings UX (R5) | Flashing warning banner; improve meeting chat/voting UX and UI cards; fix voting tie-breaker bug; enforce suspended/blocked sanctions | M5 | DONE |
| 7 | Final E2E Pass & Hardening | Verify 100% E2E test pass, execute Phase 2 adversarial coverage tests | M6 | DONE |



## Interface Contracts
### Player Movement & Collision
- **Client player position updates**: Sent via `player:move` event payload `{ x, y }`.
- **Server coordinate updates**: Relayed to other clients via `player:moved` payload `{ playerId, x, y }`.
- **Wall/Obstacle Collisions**: Handled locally on the client using static physics groups and player physics body. Server accepts updated (already resolved) coordinates.

### Task Interaction
- **Client triggers mini-game**: Client verifies the player is within `getTaskInteractionDistance()` from the task center before showing the mini-game.
- **Client completes mini-game**: Emits `task:complete` payload `{ taskId }`.
- **Server broadcasts completion**: Relays `task:completed` payload `{ taskId, completedBy, playerName }` and updates global game state.
