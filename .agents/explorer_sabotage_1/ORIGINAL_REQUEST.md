## 2026-07-13T20:37:12Z
You are teamwork_preview_explorer. Your working directory is `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_sabotage_1/`.
Your task is to design the visual feedback for sabotages and polish the meetings/voting screen UX.

Follow these instructions:
1. Create your `BRIEFING.md` and `progress.md` in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_sabotage_1/`.
2. Inspect `client/src/scenes/GameScene.js` (specifically where sabotages are handled, such as `sabotage:triggered` and `updateHUD()`).
3. Design a visual warning system for active sabotages:
   - Create a red full-screen overlay graphics object (`this.sabotageOverlay`) in `GameScene.js` with depth so it overlays the screen (but not the HUD headers).
   - When a sabotage is active (`activeSabotages` list in `gameState` has items), trigger a repeating pulsing alpha tween on this overlay (e.g. flashing red warning) and show a prominent warning text banner at the top of the HUD stating the zone and task under sabotage.
   - When sabotages are cleared, stop the tween and hide the overlay/banner.
4. Inspect `client/src/scenes/MeetingScene.js`. Design a clean, visual meeting layout:
   - Visual division: Left side for discussion chat, right side for voting cards.
   - Discussion chat: A scrollable panel that displays message lines with username colors.
   - Voting cards: Group each player in a card (with a nice background panel, user's name, role emoji badge, and a button to vote for them). Clicking vote sends the vote emission.
   - Skip vote: A distinct skip card/button at the bottom.
   - Timer: A clear progress indicator showing the phase (Discussion vs Voting) and the countdown.
   - Results panel: A clean overlay or popup displaying vote tallies and who was sanctioned once the voting ends.
5. Document your findings, layout designs, and proposed code changes in a handoff report at `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_sabotage_1/handoff.md`.
6. Once finished, send a message to parent (Recipient: 99d08cd1-a041-46b6-9a4e-49b13be744c5) stating that your handoff is ready.
