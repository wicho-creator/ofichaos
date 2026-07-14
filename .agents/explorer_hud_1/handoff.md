# Handoff Report: GameScene HUD Responsive Design Strategy

## 1. Observation

Direct observations from the `ofichaos` codebase regarding layout structure, scaling, and viewport handling:

*   **File Path**: `/Users/luisdeleon/AIWorkspace/games/ofichaos/client/src/scenes/GameScene.js`
    *   **Scale Event Listening**: The file does not register or handle `resize` events (e.g. `this.scale.on('resize', ...)` is completely absent).
    *   **Static Canvas Fractions**: At creation time, `createHUD()` reads viewport bounds and calculates static layout coordinates:
        ```javascript
        139:     const w = this.scale.width;
        140:     const h = this.scale.height;
        ...
        159:     const roleY = compact ? h - 126 : h - 154;
        ...
        171:     const statusX = compact ? w - 205 : w - 215;
        ```
    *   **Fixed Scroll Factors**: The HUD elements are fixed to the viewport using a fragile slicing trick that marks all children created during `createHUD` as scroll-static:
        ```javascript
        55:     const worldChildCount = this.children.list.length;
        56:     this.createHUD();
        57:     this.children.list.slice(worldChildCount).forEach((child) => child.setScrollFactor?.(0));
        ```
    *   **Morale Bar Scaling Bug**: In `updateHUD()`, the bar's fill width is hardcoded to a scale factor of `230` instead of using the actual designed width (`compact ? 146 : 168`):
        ```javascript
        370:       this.moraleFill.width = Math.max(0, 230 * (moralePct / 100));
        ```
    *   **Task Panel Layout**: In `openTaskPanel()`, elements are positioned at absolute center coordinates `panelX = w / 2` and `panelY = h / 2` at the moment of opening, but cannot adapt dynamically if the screen is resized mid-task.
    *   **Sabotage Menu Width**: The sabotage menu panel has a hardcoded width of `410` (line 600), which exceeds narrow portrait screens (such as 375x667).
    *   **Floating Text Clipping**: In `showFloatingText()`, text is centered but has no `wordWrap` width defined (line 634-640), causing it to clip on narrow viewports.

*   **File Path**: `/Users/luisdeleon/AIWorkspace/games/ofichaos/client/src/systems/ui.js`
    *   **Vector Drawing Coordinates**: The helper functions `createPanel()` and `createButton()` draw shapes at absolute coordinates on the graphics buffer rather than drawing from an origin of `(0,0)` and positioning using `graphics.x` and `graphics.y`:
        ```javascript
        53:   panel.fillStyle(0x000000, 0.22);
        54:   panel.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 8, w, h, radius);
        ```
    *   **Non-interactive Redraw**: Buttons and panels returned do not expose any method to redraw or reposition themselves dynamically (lines 47 and 61).

*   **File Path**: `/Users/luisdeleon/AIWorkspace/games/ofichaos/tests/e2e.test.js`
    *   **HUD Test Cases**: Contains tests validating GameScene HUD components like task overlays and scale math under Mock scenes:
        ```javascript
        1200: test('TC-T3-01: HUD responsive adjustments layout math', async () => { ... });
        1215: test('TC-T3-03: Interactive task overlays panel verification', async () => { ... });
        ```

## 2. Logic Chain

1. **Window resizing behaves incorrectly**: Because `client/src/main.js` configures the game scale mode as `Phaser.Scale.RESIZE`, the canvas automatically stretches or shrinks when the browser window changes dimensions. However, because `GameScene.js` does not listen for `resize` events, the HUD elements remain at their original coordinate calculations. If the window shrinks, elements drift off-screen or overlap.
2. **Standard elements overlap on narrow screens (e.g. 375x667)**: On a 375px wide viewport:
    * The left Role Panel (width 270) and right Status Panel (width 294) combined require 564px of space, which causes them to overlap.
    * The mobile D-pad (base X = 82, width ~120px) overlaps the bottom-left Role Panel (center X = 205, extending to X = 70).
    * The action panel (width 228) and action buttons centered at `w/2` overlap all of the above.
3. **Graphics buffers prevent simple coordinate translation**: Because `createPanel` and `createButton` render vectors directly at offset coordinates in the local graphics context, setting `graphics.x` or `graphics.y` shifts them relative to the pre-rendered offsets. This makes it impossible to reposition or resize these components dynamically without redrawing.
4. **Conclusion**: Exposing progressive resize and redraw capabilities in `ui.js` (`drawPanel` and `setPositionAndSize`) allows the scene to adjust coordinates. Implementing a `resize` listener and separating HUD creation from HUD positioning allows the scene to reposition desktop layouts dynamically and stack/reorganize components for mobile portrait screens.

## 3. Caveats

*   **Minigame State Preservation**: Redrawing the `activeTaskPanel` requires caching the current interactive state (like sequence step or click count) on the panel object. Recreating the panel completely would lose progress, so updating individual component positions using the new redraw helpers is chosen.
*   **Performance Overhead**: While the `resize` callback runs frequently during active window resizing, rendering graphics clear/draw commands for ~20 UI components is well within Phaser's performance budget (taking <1ms) and has no impact on frame rate.
*   **Resolution and Zoom**: Changes in camera zoom (based on aspect ratios) could impact click/touch bounds on game items if bounds are not updated. The D-pad hit zones must have their sizes updated manually during resize.

## 4. Conclusion

A responsive layout strategy must be implemented by:
1. **Enhancing `ui.js`**:
    * Expose a `drawPanel(px, py, pw, ph)` method on panels.
    * Expose a `setPositionAndSize(px, py, pw, ph)` method on buttons.
2. **Refactoring `GameScene.js`**:
    * Binding the `resize` event in `create()`.
    * Moving layout math from `createHUD()` into a dedicated `repositionHUD(w, h)` method.
    * Adding a mobile portrait layout (`w < 600`) where:
        * The **Role Panel** (top-left) and **Status Panel** (top-right) stack below the header.
        * The **D-pad** stays on the bottom-left.
        * The **Action Buttons** cluster on the bottom-right (large primary action button, smaller secondary buttons grouped around it).
    * Handling open task panels and sabotage menus inside `repositionActivePanels()`.

The changes are captured in `responsive_hud.patch` in this folder.

## 5. Verification Method

To verify the responsive layout logic:
1. Run the test suite using:
   ```bash
   node tests/e2e.test.js
   ```
2. Verify that test `TC-T3-01` and `TC-T3-03` pass successfully.
3. Apply the proposed patch `responsive_hud.patch` using:
   ```bash
   git apply .agents/explorer_hud_1/responsive_hud.patch
   ```
4. Perform manual resize verification in a browser:
   * Open the game in dev mode: `npm run dev`.
   * Drag the browser window or use Chrome DevTools Device Mode to inspect sizes like 375x667 (iPhone SE), 768x1024 (iPad), and 1920x1080 (Desktop).
   * Ensure that Role Panel text, moral bars, D-pads, and Action buttons never overlap, are fully visible, and remain functional.
