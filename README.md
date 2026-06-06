# Mimic — a fully on-chain "Human or AI?" game on GenLayer

> 🐍 **Intelligent Contract:** [`contracts/mimic.py`](./contracts/mimic.py)
> · deployed on **Studionet** at `0x56E39F008e29ecd45D2b76F330AEb3AE992B66Ad`
>
> 🌐 **Frontend:** [`app/`](./app) — Vite + React + TypeScript + `genlayer-js`. No wallet
> extension required: the app uses a local burner account and signs transactions directly.

Each round, one short one-liner appears on screen. It was either picked at random from a
curated bank of human-written sentences, or freshly written by an LLM at round start. You
guess: **HUMAN** or **AI**. Score and the global leaderboard live entirely in the
Intelligent Contract — no off-chain backend.

## Why there's no "connect wallet" button

Players just open the page and play. On first load the app creates a **local burner
account** (a fresh key stored in `localStorage`) and signs every transaction with
`genlayer-js` directly. This means:

- ✅ Works in any browser — no MetaMask, no snap, no OKX/Rabby extension needed.
- ✅ Zero-click onboarding.
- ✅ On Studionet (no gas), the burner can transact immediately.

Use **New identity** in the top bar to start fresh with a new local account.

## What makes this a real GenLayer Intelligent Contract

The contract at [`contracts/mimic.py`](./contracts/mimic.py) uses the GenLayer SDK:

| GenLayer feature | Where in `mimic.py` |
|---|---|
| `gl.Contract` base class | `class Mimic(gl.Contract)` |
| `@gl.public.write` methods | `start_round`, `make_guess` |
| `@gl.public.view` methods | `get_active`, `get_resolved`, `get_sentence`, `get_persona_revealed`, `get_guess`, `get_correct`, `get_score`, `get_leaderboard`, … |
| `gl.message.sender_address` | identifies the player on every write |
| `gl.nondet.exec_prompt` | the LLM call (inside the leader function) |
| `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` | persona coin-flip + AI sentence generation, with validator consensus on a structurally valid JSON output |
| `gl.vm.UserError` | rejects invalid guesses / states |
| Persistent storage: `TreeMap[Address, …]`, `DynArray[Address]`, `u256` | rounds, scores, players |

## Project layout

```
mimic/
├── contracts/
│   └── mimic.py         # Intelligent Contract — the GenLayer SDK code
├── app/                 # Vite + React + TypeScript + genlayer-js frontend
├── .kiro/specs/mimic/   # design + requirements + tasks (Kiro spec)
└── README.md
```

## Run the frontend

```bash
cd app
npm install
npm run dev
```

Open http://127.0.0.1:5173 and play. The contract is already deployed on Studionet, so
there's nothing to set up.

## How a round works

`start_round` makes one LLM call inside GenLayer's Optimistic Democracy consensus that
decides everything for the round:
- flip a fair coin to pick the secret persona (`"human"` or `"ai"`),
- if `"human"`: pick a random index into the on-chain bank of human-written one-liners,
- if `"ai"`: write a fresh, original one-liner.

Validators independently re-run the prompt and accept the leader's verdict only when the
JSON is structurally valid and the personas agree.

`make_guess` reveals the persona, scores the round (+10 if correct, −5 if wrong), and
updates the leaderboard. Because writes trigger an LLM consensus round, they take a little
time to finalize — the UI shows a "thinking" state while waiting.

## Notes

- Network: **Studionet** (`https://studio.genlayer.com/api`, chain ID 61999).
- The 60-second round timer is a UI element (UX); the contract itself is single-decision.
- All transactions are signed locally by the burner account — no private key leaves the browser.

## License

MIT.
