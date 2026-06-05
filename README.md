# Mimic

A fully on-chain **Human or AI?** guessing game on **GenLayer**.

Each round, one short sentence appears on screen. It was either picked at random from a
curated bank of human-written one-liners, or freshly written by an LLM at round start.
You have 60 seconds to call it: **HUMAN** or **AI**. Your score and the global
leaderboard live entirely in an Intelligent Contract — no off-chain backend.

Built on the real GenLayer SDK:
- **Frontend:** `genlayer-js` (TypeScript) + React + Vite. Wallet-agnostic — works with
  any EIP-1193 provider (Rabby, MetaMask, OKX, Coinbase, etc.).
- **Contract:** Python on GenVM, using `gl.nondet.exec_prompt` and
  `gl.vm.run_nondet_unsafe` for the persona coin-flip + LLM sentence generation, with
  validators reaching consensus on a structurally valid JSON output.

## Project layout

```
mimic/
├── contracts/
│   └── mimic.py              # Intelligent Contract (deploy this in GenLayer Studio)
├── app/                      # Vite + React + TypeScript + genlayer-js
│   └── src/...
├── .kiro/specs/mimic/...     # design + requirements + tasks
└── README.md
```

## 1) Deploy the contract in GenLayer Studio

1. Open https://studio.genlayer.com (Studionet has a built-in 💧 faucet).
2. Connect your wallet (Rabby / MetaMask / OKX…) and fund it from the faucet.
3. Sidebar → **Contracts** → **+ New Contract** → **Add From File** → pick
   `contracts/mimic.py`. Or paste the file contents directly.
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

## How it works

- `start_round` makes one LLM call that decides everything for this round:
  - flip a fair coin to pick the secret persona (`"human"` or `"ai"`),
  - if `"human"`: pick a random index into the on-chain bank of human-written one-liners,
  - if `"ai"`: write a fresh, original one-liner.
  Validators don't need to reproduce the exact text — they accept any structurally valid
  JSON with `persona ∈ {"human","ai"}`, a valid bank index, or a non-empty AI sentence.
  This is the standard `gl.vm.run_nondet_unsafe` pattern from the GenLayer docs.
- `make_guess` reveals the persona, scores the round (+10 if correct, −5 if wrong), and
  updates the leaderboard. State (rounds, scores, players, the human bank) lives in
  contract storage (`TreeMap` / `DynArray`).

## Notes

- Network: **Studionet** (`https://studio.genlayer.com/api`, chain ID 61999).
- The 60-second timer is enforced in the UI (UX). No on-chain timer is needed because
  each round is just one decision — `start_round` then `make_guess`.
- Wallet-agnostic: any EIP-1193 injected provider works.
- All write transactions are signed by the user's wallet — no private key in the app.

## License

MIT.
