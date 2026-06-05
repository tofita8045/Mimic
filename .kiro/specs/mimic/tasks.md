# Implementation Plan — Human or AI?

## Overview

Build the GenLayer Intelligent Contract first, then a minimal React + genlayer-js frontend
that connects MetaMask, talks to a deployed contract on Studionet, and shows the chat
loop, guess flow, and the public leaderboard. The user deploys the contract in GenLayer
Studio (or via the deploy script) and pastes the resulting address into the app.

## Tasks

- [ ] 1. Write the Intelligent Contract `contracts/human_or_ai.py`
  - Storage: `Session` dataclass + `sessions`/`scores`/`players`/`max_turns`.
  - Methods: `start_game`, `send_message`, `make_guess`, `get_my_session`, `get_score`, `get_leaderboard`.
  - Use `gl.vm.run_nondet_unsafe` for the persona coin-flip and `gl.eq_principle.prompt_non_comparative` for opponent replies.
  - _Validates: Requirements 1, 2, 3, 4_

- [ ] 2. Scaffold the frontend (Vite + React + TypeScript + genlayer-js)
  - `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`.
  - _Validates: Requirement 5_

- [ ] 3. SDK helpers `src/genlayer.ts` and contract wrapper `src/contract.ts`
  - `createClient({ chain: studionet })`, `connectWallet`, typed read/write wrappers.
  - Contract address read from `localStorage` so the user can paste it after deploy.
  - _Validates: Requirements 5.1, 5.2, 5.3_

- [ ] 4. UI components
  - WalletBar (connect, address, score), GameScreen (transcript, input, 60s timer,
    turns/max_turns, guess buttons), ResultCard (persona reveal, correct/wrong, delta),
    Leaderboard (sorted from `get_leaderboard`).
  - _Validates: Requirements 1, 2, 3, 4_

- [ ] 5. Run the dev server and verify the UI renders end-to-end
  - With no deployed address, show a setup banner; once an address is set, all read paths work.
  - _Validates: Requirement 5_

## Task Dependency Graph

```
1 (contract) ────────────────┐
                             ├─▶ 5 (preview)
2 (scaffold) ─▶ 3 (sdk) ─▶ 4 (ui) ┘
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4"] },
    { "wave": 4, "tasks": ["5"] }
  ]
}
```

- Task 1 is independent (Python contract).
- Tasks 2 → 3 → 4 are sequential (scaffold, then SDK helpers, then UI on top of helpers).
- Task 5 depends on Task 4 and benefits from Task 1 being deployed, but the preview can
  run with a stub address before deploy.

## Notes

- Target network: **Studionet** (`https://studio.genlayer.com/api`, chain ID 61999), built-in 💧 faucet.
- The contract is deployed by the user in GenLayer Studio (paste the file from `contracts/`)
  and the resulting address is saved in the app via the setup banner.
- The 60-second timer is enforced client-side (UX); the on-chain guard is `max_turns`.
- All write transactions are signed by the user's MetaMask wallet — no private key in the app.
