# Mimic

A fully on-chain **Human or AI?** game on **GenLayer**. Chat with a stranger for a few
seconds, then guess: real human, or an AI mimicking one? Your score and the global
leaderboard live entirely in an Intelligent Contract — no off-chain backend.

The opponent is the contract itself. At the start of each round it secretly picks a
persona (`"human"` or `"ai"`) via an LLM coin-flip, then replies in character. Validators
reach consensus on the qualitative LLM output through GenLayer's Equivalence Principle.

Built on the real GenLayer SDK:
- Frontend: `genlayer-js` (TypeScript) + React + Vite, **wallet-agnostic** (Rabby,
  MetaMask, OKX, Coinbase — anything injecting `window.ethereum`).
- Contract: Python on GenVM, using `gl.nondet.exec_prompt`,
  `gl.eq_principle.prompt_non_comparative`, and `gl.vm.run_nondet_unsafe`.

## Project layout

```
mimic/
├── contracts/
│   └── mimic.py              # Intelligent Contract (deploy this in GenLayer Studio)
├── app/                      # Vite + React + TypeScript + genlayer-js
│   └── src/...
├── .kiro/specs/...           # design + requirements + tasks
└── README.md
```

## 1) Deploy the contract in GenLayer Studio

1. Open https://studio.genlayer.com (Studionet has a built-in 💧 faucet).
2. Connect your wallet (Rabby / MetaMask / OKX…) and fund it with the faucet.
3. Sidebar → **Contracts** → **+ New Contract** → **Add From File** → pick
   `contracts/mimic.py`. Or paste the file contents directly.
4. **Constructor Inputs** is empty — `__init__` takes no args.
5. Click **Deploy**. Copy the contract address.

## 2) Run the frontend

```bash
cd app
npm install
npm run dev
```

Open http://127.0.0.1:5173, connect your wallet, paste the contract address, and play.

## How it works

- `start_game` creates a session and uses an LLM coin-flip
  (`gl.vm.run_nondet_unsafe`) to pick the secret persona (`"human"` or `"ai"`).
  Validators accept any structurally valid output (`persona ∈ {"human","ai"}`).
- `send_message` generates one in-character opponent reply via
  `gl.eq_principle.prompt_non_comparative` so validators reach consensus on the
  qualitative LLM output without all having to reproduce it.
- `make_guess` reveals the persona, scores the round (+10 / −5), and updates the
  leaderboard. All state lives in contract storage (`TreeMap` / `DynArray`).

## Notes

- Network: **Studionet** (`https://studio.genlayer.com/api`, chain ID 61999).
- The 60-second timer is enforced in the UI (UX). The on-chain guard is `max_turns`
  (default 8 opponent replies) — `gl.message` exposes no block timestamp.
- Wallet-agnostic: any EIP-1193 injected provider works.
- All write transactions are signed by the user's wallet — no private key in the app.

## License

MIT.
