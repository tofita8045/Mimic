# Mimic — a fully on-chain "Human or AI?" game on GenLayer

> 🐍 **Intelligent Contract:** [`contracts/mimic.py`](./contracts/mimic.py)
> ([raw source](https://raw.githubusercontent.com/tofita8045/Mimic/main/contracts/mimic.py)
> · [Studio import URL](https://studio.genlayer.com/contracts?import=https://raw.githubusercontent.com/tofita8045/Mimic/main/contracts/mimic.py))
>
> 🌐 **Frontend:** [`app/`](./app) — Vite + React + TypeScript + `genlayer-js`

Each round, one short sentence appears on screen. It was either picked at random from a
curated bank of human-written one-liners stored on-chain, or freshly written by an LLM
at round start. You guess: **HUMAN** or **AI**. Score and the global leaderboard live
entirely in the Intelligent Contract — no off-chain backend.

## What makes this a real GenLayer Intelligent Contract

The contract at [`contracts/mimic.py`](./contracts/mimic.py) uses the GenLayer SDK
exactly as the docs prescribe:

| GenLayer feature | Where in `mimic.py` |
|---|---|
| `gl.Contract` base class | `class Mimic(gl.Contract)` |
| `@gl.public.write` methods | `start_round`, `make_guess` |
| `@gl.public.view` methods | `get_my_round`, `get_score`, `get_leaderboard`, `get_bank_size` |
| `gl.message.sender_address` | identifies the player on every call |
| `gl.nondet.exec_prompt` | LLM call inside the leader function |
| `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` | persona coin-flip + AI sentence generation, with consensus on a structurally valid JSON output |
| `gl.vm.UserError` | rejects invalid guesses / states |
| Persistent storage with `TreeMap`, `DynArray`, `i32`, `Address`, `@allow_storage @dataclass` | `rounds`, `scores`, `players`, `human_bank`, `Round` |

## Project layout

```
mimic/
├── contracts/
│   └── mimic.py         # Intelligent Contract — the GenLayer SDK code
├── app/                 # Vite + React + TypeScript + genlayer-js frontend
├── .kiro/specs/mimic/   # design + requirements + tasks (Kiro spec)
└── README.md
```

## 1) Deploy the contract in GenLayer Studio

1. Open https://studio.genlayer.com (Studionet has a built-in 💧 faucet).
2. Connect any EIP-1193 wallet (Rabby / MetaMask / OKX…) and fund it via the faucet.
3. Sidebar → **Contracts** → **+ New Contract** → **Add From File** and pick
   [`contracts/mimic.py`](./contracts/mimic.py). Or paste the raw file contents.
4. **Constructor Inputs** is empty — `__init__` takes no arguments.
5. Click **Deploy**. Copy the contract address.

## 2) Run the frontend

```bash
cd app
npm install
npm run dev
```

Open http://127.0.0.1:5173, connect your wallet, paste the contract address into the
setup banner, and play.

## How a round works

`start_round` makes one LLM call that decides everything for the round in one shot:
- flip a fair coin to pick the secret persona (`"human"` or `"ai"`),
- if `"human"`: pick a random index into the on-chain bank of human-written one-liners,
- if `"ai"`: write a fresh, original one-liner.

Validators don't have to reproduce the exact text — they accept any structurally valid
JSON with `persona ∈ {"human","ai"}`, a valid bank index, or a non-empty AI sentence.
This is the standard `gl.vm.run_nondet_unsafe` pattern from the GenLayer docs for
non-deterministic / random output.

`make_guess` reveals the persona, scores the round (+10 if correct, −5 if wrong), and
updates the leaderboard. State (rounds, scores, players, the bank) lives in contract
storage (`TreeMap` / `DynArray`).

## Notes

- Network: **Studionet** (`https://studio.genlayer.com/api`, chain ID 61999).
- The 60-second timer is enforced in the UI (UX). No on-chain timer is needed: each
  round is one decision — `start_round`, then `make_guess`.
- Wallet-agnostic: any EIP-1193 injected provider works.
- All write transactions are signed by the user's wallet — no private key in the app.

## License

MIT.
