# OfiChaos — Test Infrastructure Status

This file confirms that the E2E test suite has been successfully implemented and is ready for execution.

## 1. Test Runner Command

To execute the entire E2E test suite, run the following command in the project root:

```bash
node --test tests/e2e.test.js
```

## 2. Test Suite Summary

The test suite is written using Node.js's native `test` and `assert` modules (no third-party test runners or heavy browser installations required). It performs extensive in-process Socket.IO client simulations and client-side system unit/math mock tests:

*   **Tier 1 (Core Server State & Single-Player Mechanics)**: Room creation, code generation, name sanitization, lobby bounds, host migration, movement broadcast, meetings, secret role assignment, objectives, and cooldowns.
*   **Tier 2 (Multiplayer Integration & Happy-Path Workflows)**: Startup player validation, meeting cycles, employee victory conditions, boss victory conditions, burnout activation/recovery, lamebotas fake tasks/false reports, and door lockouts.
*   **Tier 3 (UI, Physics & Client Interactivity)**: Direct imports and mock assertions of the client-side helper modules (Phaser scene layouts, interaction distance bounds, task overlays, and responsive scaling).
*   **Tier 4 (Adversarial, Security & Network Failure Resistance)**: Host dropouts mid-game, invalid vote rejects, coordinate checks, and anti-cheat validation.

## 3. Coverage & Execution Summary

Upon running the tests on the current codebase, the following results are obtained:

*   **Total Executed**: 53 tests
*   **Passed**: 49 tests
*   **Failed (Expected Gaps/Bugs)**: 4 tests

### Detailed Failure Backlog (Identified Gaps)

The 4 failing tests assert the **correct/intended** security behaviors of the system, which are currently unimplemented or buggy in the MVP codebase:

1.  **TC-T2-19 (Voting tie skip)**: The server incorrectly sanctions the first player in the iteration during a tie, rather than skipping the sanctions and returning to the playing phase.
2.  **TC-T4-02 (Anti-Cheat: Speed checking)**: The server currently accepts teleports and impossible velocity updates without speed limits validation.
3.  **TC-T4-05 (Anti-Cheat: Task distance validation)**: The server accepts `task:complete` emissions regardless of the player's physical coordinates on the map.
4.  **TC-T4-04 (Sanctions enforcement)**: The server does not restrict player coordinates updates or ability triggers while a player's `suspendedUntil` or `abilityBlockedUntil` sanctions are active.
