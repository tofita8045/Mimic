<div align="center">

# 🕵️ Mimic — Human or AI?

**A fully on-chain "Human or AI?" chat game built on [GenLayer](https://genlayer.com).**

Chat with a stranger. It's secretly either a human-style persona or an AI — guess which.
Every reply is computed on-chain by GenLayer's AI validators. Your score and the global
leaderboard live entirely in an Intelligent Contract. No backend.

</div>

---

## 🎮 How it works

1. **Connect your wallet** — MetaMask, OKX, Rabby, Coinbase, or any EIP-1193 wallet
   (detected automatically via EIP-6963).
2. **Play a round** — `start_round` is payable and charges a tiny entry fee
   (**0.0001 GEN**). The contract secretly picks a persona (`human` or `ai`) via LLM
   consensus.
3. **Chat** — send messages; the "stranger" replies in character. Replies are real
   on-chain transactions, so each takes a few seconds to settle.
4. **Guess** — call it **HUMAN** or **AI**. Correct = **+10**, wrong = **−5**.
5. **Leaderboard** — every player is ranked publicly by score.

---

## 🧠 Why GenLayer

GenLayer is an AI-native blockchain: validator nodes run LLMs and reach **Optimistic
Democracy** consensus on non-deterministic results. Mimic uses that directly — the secret
persona and every chat reply are produced by an LLM *inside the contract* and agreed on by
validators. The "answer" is on-chain the whole time; you just can't see it until you guess.

| GenLayer feature | Where it's used in [`contracts/mimic.py`](./contracts/mimic.py) |
|---|---|
| `gl.Contract` | `class Mimic(gl.Contract)` |
| `@gl.public.write.payable` + `gl.message.value` | entry fee on `start_round` |
| `gl.message.sender_address` | identifies the player |
| `gl.nondet.exec_prompt` | the LLM call (persona + replies) |
| `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` | validator consensus on LLM output |
| `gl.vm.UserError` | input / state validation |
| `TreeMap[Address, …]`, `DynArray[Address]`, `u256` | on-chain game state + leaderboard |

---

## 🌐 Network & deployment

- **Network:** GenLayer **Studionet** — `https://studio.genlayer.com/api` · chain ID `61999`
- **Deployed contract:** [`0xEBDCa401A7ABc0161BBda43311d65c14a92b0590`](https://explorer-studio.genlayer.com)
- **Faucet:** use the 💧 button in the Studio account selector to fund your wallet with test GEN.

---

## 🛠️ Tech stack

- **Contract:** Python Intelligent Contract on GenVM ([`contracts/mimic.py`](./contracts/mimic.py))
- **Frontend:** React + TypeScript + Vite
- **SDK:** [`genlayer-js`](https://www.npmjs.com/package/genlayer-js) for reads, writes, and wallet integration

```
mimic/
├── contracts/
│   └── mimic.py              # the GenLayer Intelligent Contract
└── app/                      # React + Vite frontend
    └── src/
        ├── App.tsx           # game flow & state
        ├── genlayer.ts       # wallet discovery (EIP-6963) + client setup
        ├── contract.ts       # typed contract wrappers
        └── components/       # ChatScreen, ResultScreen, Leaderboard, …
```

---

## 🚀 Run locally

```bash
cd app
npm install
npm run dev
```

Open the printed URL, connect a wallet on Studionet, fund it from the faucet, and play.

---

## 📜 License

[MIT](./LICENSE)
