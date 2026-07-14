## 2026-07-14T02:03:56Z
You are teamwork_preview_worker. Your working directory is `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/worker_e2e_1/`.
Your task is to implement the E2E test suite for the OfiChaos project.

Follow these instructions:
1. Create your `BRIEFING.md` and `progress.md` in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/worker_e2e_1/`.
2. Review the requirements in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/ORIGINAL_REQUEST.md` and the test plan in `/Users/luisdeleon/AIWorkspace/games/ofichaos/TEST_INFRA.md`.
3. Implement the E2E test suite under `tests/e2e.test.js` (and any other files in `tests/`).
4. Since we are in CODE_ONLY network mode and cannot download external browser binaries (like Playwright/Puppeteer), you must use Node's native `test` and `assert` modules (no mocha/chai needed) to write:
   - Extensive socket-level integration tests (Tiers 1, 2, and 4) simulating multiple clients (joining, lobby start, roles, movement, tasks, meeting/voting, sabotages, cooldowns, win conditions, and cheats).
   - Mock frontend tests (Tier 3) that load/verify the layout math, interaction ranges, and collision boundaries of the client-side system functions (e.g. by mocking Phaser's APIs or importing and testing the functions in `client/src/systems/` and `client/src/scenes/` directly).
5. Ensure the tests assert the correct behavior for identified bugs/gaps, such as:
   - Lack of player coordinates verification on `task:complete`.
   - Lack of player velocity/speed checks (teleporting).
   - Lack of enforcement for `suspendedUntil` (movement lock) and `abilityBlockedUntil` (sabotage block).
   These tests will initially FAIL on the current codebase, which is expected!
6. Run the tests using a terminal command (e.g., `node tests/e2e.test.js` or `node --test tests/e2e.test.js`) and document the output.
7. Write `TEST_READY.md` in the project root with the test runner command and coverage summary.
8. Write your handoff report to `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/worker_e2e_1/handoff.md`.
9. Send a message to parent (Recipient: 99d08cd1-a041-46b6-9a4e-49b13be744c5) when finished.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
