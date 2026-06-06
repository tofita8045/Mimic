# Mimic — a fully on-chain "Human or AI?" game on GenLayer

> 🐍 **Intelligent Contract:** [`contracts/mimic.py`](./contracts/mimic.py)
> · deployed on **Studionet** at `0xE7B778a52d0891549A3105d1633F1087d351afa5`
>
> 🌐 **Frontend:** [`app/`](./app) — Vite + React + TypeScript + `genlayer-js`. Connect any
> wallet (MetaMask, OKX, Rabby, Coinbase…) via EIP-6963.

Each round, one short one-liner appears on screen. It was either picked at random from a
curated bank of human-written sentences, or freshly written by an LLM at round start. You
guess: **HUMAN** or **AI**. Score and the global leaderboard live entirely in the
Intelligent Contract — no off-chain backend.

## How to play

1. **Connect a wallet** — MetaMask, OKX, Rabby, Coinbase, or any EIP-1193 wallet. The app
   detects installed wallets via EIP-6963 and lets you pick one.
2. **Play a round** — `start_round` is payable and charges a small entry fee
   (**0.0001 GEN**). The contract picks a secret persona via LLM consensus and shows you a
   one-liner.
3. **Guess** HUMAN or AI. Correct = +10, wrong = −5. Play again pays the fee again.
4. The **leaderboard** is public and ranks every player by score.

## What makes this a real GenLayer Intelligent Contract

The contract at [`contracts/mimic.py`](./contracts/mimic.py) uses the GenLayer SDK:

| GenLayer feature | Where in `mimic.py` |
|---|---|
| `gl.Contract` base class | `class Mimic(gl.Contract)` |
| `@gl.public.write` methods | `start_round`, `make_guess` |
| `@gl.public.view` methods | `get_active`, `get_resolved`, `get_sentence`, `get_persona_revealed`, `get_guess`, `get_correct`, `get_score`, `get_leaderboard`, … |
| `gl.message.sender_address` | identifies the player on every write |
| `gl.message.value` + `@gl.public.write.payable` | the entry fee on `start_round` |
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
- `start_round` is payable (0.0001 GEN). On Studionet, fund your wallet with the 💧 faucet.
- Connect any EIP-1193 wallet — MetaMask, OKX, Rabby, Coinbase, etc.

## License

MIT.
