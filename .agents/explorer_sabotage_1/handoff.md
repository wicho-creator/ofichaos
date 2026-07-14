# Handoff Report: Sabotage Visual Warnings & Meetings UX Polish

## 1. Observation
- **Sabotages & HUD in `GameScene.js`**:
  - The socket listeners for sabotages like `sabotage:triggered` are registered in `setupSocketListeners()` starting at line 627.
  - Active sabotages are stored in `gameState.activeSabotages` on the server and synced to `this.gameState` on `game:update` (line 560) and `game:tick` (line 566).
  - The HUD is updated inside `updateHUD(gs)` (starting at line 694), which calculates the current status of parameters like the game timer, tasks percent, and player morale.
  - All HUD elements are created in `createHUD()` (starting at line 218) and positioned dynamically in `repositionHUD(w, h)` (starting at line 311).
  - HUD elements currently do not specify their rendering depth, placing them at the default depth of `0`. Floating text overlays use depth `9999` (line 1225).
- **Meetings in `MeetingScene.js`**:
  - The meeting layout is initialized in `create(data)` (lines 16-66), using a simple single-column layout centered on a 700x600 background panel.
  - Chat log entries are appended as raw strings joined by newlines into a single flat `Phaser.GameObjects.Text` object (`this.chatArea` at line 28). This text object does not support formatted colors or scrollbars.
  - Voting cards are created dynamically inside `showVotingUI()` (lines 102-124) by rendering one button per other player under `Votar: [playerName]` (line 111) and a single `Skip` button (line 119). Buttons are not grouped visually and lack role styling.
  - The phase timer counts down locally inside `MeetingScene.js` using an approximate timer event (lines 58-65) with a static label, rather than calculating and showing the specific countdown based on phase durations (`MEETING_DURATION = 60000` at `server/gameState.js:8` and `VOTING_DURATION = 20000` at `server/gameState.js:9`).
  - Results are displayed by appending raw multiline text to the central `votingArea` text label (lines 126-139).
- **Phaser Setup**:
  - `client/src/main.js` configures `dom: { createContainer: true }` (lines 18-20), enabling HTML/DOM elements inside the game canvas wrapper.

---

## 2. Logic Chain
- **Active Sabotages Warnings**:
  - By creating a full-screen red warning overlay graphics object (`this.sabotageOverlay`) at depth `50` and setting the depth of all main HUD panel elements to `100`, we ensure the flashing warning overlay is drawn behind the HUD headers but in front of player sprites, obstacles, tasks, and the floor map.
  - Placing a warning banner `this.sabotageBanner` at depth `101` and positioning it at `headerY + headerH/2 + 18` allows it to be displayed prominently below the HUD header panel, dynamically aligning itself on resize.
  - Running a pulsing alpha tween (`alpha: 0.28`, `yoyo: true`, `repeat: -1`) on the overlay whenever `activeSabotages` contains elements, and stopping it when empty, provides real-time ambient panic styling.
- **Polished Meeting UI**:
  - Increasing the main panel dimensions to 900x640 provides enough room to implement a visual 2-column layout: Left column for chat and input, Right column for player cards.
  - Using a styled HTML `div` as a DOM element for the chat area provides native text wrapping, scrollbar overflow handling, and HTML coloring. We can check the sending player's role in the client-synced `players` map to apply role-specific colors (`#ef4444` for jefe, `#facc15` for lamebotas, `#4ade80` for empleado) directly to username span tags.
  - Standardizing players inside visual card rectangles (Phaser container grouping) featuring player name, role emoji badge (e.g. `👔 Jefe`, `🤡 Lamebotas`, `🛠 Empleado`), and dynamic button behaviors based on phase/state creates a clean UI.
  - Adding a progress bar overlay with a ratio mapping (`ratio = secondsLeft / duration`) provides a beautiful and direct visualization of time remaining.
  - Showing results inside a distinct modal panel (depth `2001`) with a dark background backdrop (depth `2000`) avoids overlapping UI elements and clearly displays sanction outcomes with positive/negative color cards (e.g. red for suspension, green for tie/no-sanction).

---

## 3. Caveats
- The server does not emit periodic timer state ticks during meeting and voting phases. Thus, the client relies on a synchronized local timer countdown starting at 60s (discussion phase) and resetting to 20s (voting phase). This aligns with the server state machine ticks since both start simultaneously and decrement by 1000ms.
- To prevent memory/DOM leakage, all DOM-injected containers must be explicitly destroyed in the scene's `shutdown` listener.

---

## 4. Conclusion
The UX of the active sabotages and meeting phases can be fully polished by applying:
1. `proposed_GameScene.patch` to add the ambient warning overlay (depth 50), warning banner (depth 101), and HUD panels depth elevation (depth 100) inside `client/src/scenes/GameScene.js`.
2. `proposed_MeetingScene.js` as a complete replacement for `client/src/scenes/MeetingScene.js` to build the 2-column chat/voting layout, role-colored chat text, card grid layout, countdown progress bar, and results popup modal.

---

## 5. Verification Method
- **Test Suit Verification**:
  - Run the test suite using `node --test tests/e2e.test.js` to ensure the core state transition machinery remains fully functional.
- **Manual Visual Verification**:
  - Launch the game client and trigger a meeting. Verify:
    - Left column displays messages scrollable, matching player role colors.
    - Right column renders cards for all active players, including role emoji badges.
    - Voting buttons are disabled/hidden during discussion phase and enabled during voting phase.
    - Timer progress bar decreases smoothly and updates colors depending on the phase.
    - Sanction results are presented inside a modal panel with a dark background.
    - Active sabotages trigger a flashing red overlay behind HUD headers and display warning details in a banner below the top header.
