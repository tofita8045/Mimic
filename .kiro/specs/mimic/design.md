# Design — Human or AI? (GenLayer game)

## Overview

**Human or AI?** is a single-player, fully on-chain game inspired by ChatRoulette /
Turing-test party games. Each round the player is matched with an **opponent** that is
powered by a GenLayer Intelligent Contract. The opponent secretly behaves either like a
**human** or like an **AI assistant**. After a short chat (60s, enforced client-side),
the player guesses *Human* or *AI*. The contract reveals the secret persona, updates the
player's score, and ranks everyone on a public, on-chain leaderboard.

This is the **Option A** architecture we agreed on: there is no real-time human↔human
matchmaking. The opponent is always the LLM, but its *persona* is hidden and randomized,
so the guess stays meaningful. Everything — opponent replies, the secret persona, the
verdict, the score, and the leaderboard — lives on GenLayer. No off-chain backend.

### Why GenLayer fits this

GenLayer's whole pitch is *trustless subjective decision-making*: validator nodes running
diverse LLMs reach consensus on non-deterministic outputs via the **Equivalence Principle**.
This game leans on exactly that:

| Game mechanic | GenLayer capability used |
|---|---|
| Opponent generates believable chat replies | `gl.nondet.exec_prompt` inside an equivalence-principle block |
| Secret persona (human/ai) chosen fairly per round | `gl.vm.run_nondet_unsafe` (LLM coin-flip, validators check structure) |
| Persistent sessions, scores, leaderboard | `DynArray`, `TreeMap`, `Address` storage |
| Tamper-proof verdict & scoring | Deterministic on-chain logic, multi-validator consensus |

## Goals / Non-goals

**Goals**
- A complete, deployable Intelligent Contract (`HumanOrAI`) using the real GenLayer SDK.
- A minimal but clean web frontend using `genlayer-js` (v1.1.x) + MetaMask, targeting Studionet.
- Real read/write/deploy flows exactly as documented in the GenLayer docs.
- A public leaderboard read straight from contract state.

**Non-goals (Option A scope)**
- Real-time human↔human matchmaking or WebSocket chat relay (off-chain, out of scope).
- Token staking / wagering on rounds (could be a later milestone).
- On-chain enforcement of the 60-second timer (no block-timestamp is exposed in
  `gl.message`; the timer is a UX concern enforced in the frontend — see Edge Cases).

## Architecture

GenLayer runs as two layers; we interact only through the GenLayer RPC.

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React + Vite + genlayer-js)                      │
│   • MetaMask wallet connect                                │
│   • createClient({ chain: studionet, account })            │
│   • readContract  → leaderboard, session state             │
│   • writeContract → start_game / send_message / make_guess │
└───────────────────────────┬──────────────────────────────┘
                            │  GenLayer RPC (https://studio.genlayer.com/api)
                            ▼
┌──────────────────────────────────────────────────────────┐
│  GenLayer network                                          │
│   GenVM executes HumanOrAI (Python Intelligent Contract)   │
│    • exec_prompt → opponent replies (LLM)                  │
│    • run_nondet_unsafe → secret persona coin-flip          │
│    • Optimistic Democracy: validators reach consensus      │
└──────────────────────────────────────────────────────────┘
```

### Network

Target **Studionet** (zero setup, built-in faucet). From the docs:

| Setting | Value |
|---|---|
| GenLayer RPC | `https://studio.genlayer.com/api` |
| Chain ID | 61999 |
| Currency | GEN |
| Faucet | 💧 button in the Studio account selector |

`genlayer-js` exposes this as `studionet` from `genlayer-js/chains`. Switching to
`localnet` later is a one-line change.

## Game Flow

```
Player                Frontend                     HumanOrAI contract
  │  Connect wallet ──▶ eth_requestAccounts
  │  Start ──────────▶ writeContract(start_game) ─▶ pick secret persona (LLM coin-flip)
  │                                                  store Session{player, persona, ...}
  │  ◀── view get_my_session (persona HIDDEN)
  │  Type msg ───────▶ writeContract(send_message) ▶ append player msg
  │                                                  exec_prompt → opponent reply (persona-styled)
  │                                                  append reply, turns += 1
  │  ◀── view get_my_session (transcript updated)
  │      (repeat until guess or 60s timer)
  │  Guess H/AI ─────▶ writeContract(make_guess) ──▶ compare guess vs persona
  │                                                  score += (+10 correct / -5 wrong)
  │                                                  resolved = true, REVEAL persona
  │  ◀── view get_my_session (persona revealed, correct?)
  │  ◀── view get_leaderboard
```

## Data Models

The data models live in contract storage. Persistent fields must be class-level, typed,
and use GenVM storage types (`DynArray`/`TreeMap`, sized ints, `Address`). Custom records
use `@allow_storage` + `@dataclass`.

### `Session` record

| Field | Type | Notes |
|---|---|---|
| `player` | `Address` | wallet that started the round |
| `persona` | `str` | `"human"` or `"ai"` — secret until `resolved` |
| `transcript` | `str` | chat log, `"P: ...\nO: ...\n"` |
| `turns` | `u8` | opponent replies generated so far |
| `resolved` | `bool` | guess has been made |
| `correct` | `bool` | was the guess correct |
| `guess` | `str` | `"human"`/`"ai"`/`""` before guessing |

### Contract-level state

| Field | Type | Notes |
|---|---|---|
| `sessions` | `TreeMap[Address, Session]` | one active/last session per player |
| `scores` | `TreeMap[Address, i32]` | cumulative score (may be negative) |
| `players` | `DynArray[Address]` | everyone who has ever played |
| `max_turns` | `u8` | on-chain cap on opponent replies per round |

## Components and Interfaces

The system has three components: the **Intelligent Contract** (`HumanOrAI`), the
**deploy script** (`genlayer-js`), and the **React frontend** (`genlayer-js` + MetaMask).

### Intelligent Contract (`contracts/human_or_ai.py`)

#### Storage model

Persistent fields must be class-level, typed, and use GenVM storage types
(`DynArray`/`TreeMap`, sized ints, `Address`). Custom records use `@allow_storage` +
`@dataclass`.

```python
@allow_storage
@dataclass
class Session:
    player: Address
    persona: str        # "human" | "ai"  — secret until resolved
    transcript: str     # full chat log, "P: ...\nO: ...\n"
    turns: u8           # number of opponent replies so far
    resolved: bool      # guess has been made
    correct: bool       # was the guess correct
    guess: str          # "human" | "ai" | "" before guessing
```

Contract-level state:

```python
class HumanOrAI(gl.Contract):
    sessions: TreeMap[Address, Session]   # one active/last session per player
    scores: TreeMap[Address, i32]         # cumulative score (can go negative)
    players: DynArray[Address]            # everyone who has ever played (for leaderboard)
    max_turns: u8                         # on-chain guard (e.g. 8 opponent replies)
```

### Non-determinism strategy

Two distinct patterns, both straight from the docs:

1. **Secret persona coin-flip** — `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`.
   The leader asks the LLM for a JSON `{"persona": "human"|"ai"}`; validators accept on
   *structure* (one of the two valid values), not exact match. The leader's value becomes
   the stored secret. This mirrors the docs' randomness/JSON example, which explicitly
   warns *not* to use `strict_eq` for random/LLM output.

2. **Opponent reply generation** — `gl.eq_principle.prompt_non_comparative(...)`.
   Qualitative text where validators judge the leader's reply against criteria
   (in-character, on-topic, short) rather than reproducing it. This is the documented
   convenience wrapper for qualitative LLM outputs.

### Method surface

| Method | Decorator | Purpose |
|---|---|---|
| `__init__` | (private) | init maps, `max_turns` |
| `start_game()` | `@gl.public.write` | create session, pick secret persona, register player |
| `send_message(text)` | `@gl.public.write` | append player msg, generate opponent reply |
| `make_guess(guess)` | `@gl.public.write` | resolve, score, reveal persona |
| `get_my_session()` | `@gl.public.view` | current session; persona hidden until resolved |
| `get_score(addr)` | `@gl.public.view` | a player's cumulative score |
| `get_leaderboard()` | `@gl.public.view` | players + scores for the UI |

### Reference implementation (real SDK)

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

import json
import typing


@allow_storage
@dataclass
class Session:
    player: Address
    persona: str        # "human" | "ai" (secret until resolved)
    transcript: str
    turns: u8
    resolved: bool
    correct: bool
    guess: str


class HumanOrAI(gl.Contract):
    sessions: TreeMap[Address, Session]
    scores: TreeMap[Address, i32]
    players: DynArray[Address]
    max_turns: u8

    def __init__(self) -> None:
        self.max_turns = u8(8)

    # ---- write: begin a round -------------------------------------------------
    @gl.public.write
    def start_game(self) -> None:
        player = gl.message.sender_address

        # Register first-time players for the leaderboard
        if player not in self.scores:
            self.scores[player] = i32(0)
            self.players.append(player)

        persona = self._pick_persona()

        self.sessions[player] = Session(
            player=player,
            persona=persona,
            transcript="",
            turns=u8(0),
            resolved=False,
            correct=False,
            guess="",
        )

    # ---- write: one chat turn -------------------------------------------------
    @gl.public.write
    def send_message(self, text: str) -> None:
        player = gl.message.sender_address
        session = self.sessions.get(player)
        if session is None:
            raise gl.vm.UserError("No active game. Call start_game first.")
        if session.resolved:
            raise gl.vm.UserError("This round is already resolved.")
        if session.turns >= self.max_turns:
            raise gl.vm.UserError("Turn limit reached. Make your guess.")

        history = session.transcript
        persona = session.persona

        def opponent_reply() -> str:
            if persona == "human":
                style = (
                    "You are a real human stranger in a casual chat. Reply briefly and "
                    "informally (1-2 short sentences). Use everyday tone, the occasional "
                    "typo or lowercase, and do NOT sound like an AI assistant. Never admit "
                    "to being an AI."
                )
            else:
                style = (
                    "You are a helpful AI assistant in a chat. Reply clearly and politely "
                    "in 1-2 sentences, in the neutral, well-structured tone typical of an "
                    "AI assistant."
                )
            prompt = (
                f"{style}\n\n"
                f"Conversation so far:\n{history}\n\n"
                f"The stranger just said: {text}\n\n"
                "Write only your next chat reply, nothing else."
            )
            return gl.nondet.exec_prompt(prompt).strip()

        reply = gl.eq_principle.prompt_non_comparative(
            opponent_reply,
            input=text,
            task="Generate the opponent's next chat reply",
            criteria=(
                "The reply must be a short, in-character chat message (1-2 sentences), "
                "stay on topic, and contain no system text, labels, or JSON."
            ),
        )

        session.transcript = f"{history}P: {text}\nO: {reply}\n"
        session.turns = u8(session.turns + 1)
        self.sessions[player] = session

    # ---- write: resolve & score ----------------------------------------------
    @gl.public.write
    def make_guess(self, guess: str) -> None:
        normalized = guess.strip().lower()
        if normalized not in ("human", "ai"):
            raise gl.vm.UserError('guess must be "human" or "ai"')

        player = gl.message.sender_address
        session = self.sessions.get(player)
        if session is None:
            raise gl.vm.UserError("No active game.")
        if session.resolved:
            raise gl.vm.UserError("Already resolved.")

        correct = normalized == session.persona
        session.guess = normalized
        session.correct = correct
        session.resolved = True
        self.sessions[player] = session

        delta = i32(10) if correct else i32(-5)
        self.scores[player] = i32(self.scores[player] + delta)

    # ---- views ----------------------------------------------------------------
    @gl.public.view
    def get_my_session(self, player: Address) -> dict:
        session = self.sessions.get(player)
        if session is None:
            return {"active": False}
        return {
            "active": True,
            "transcript": session.transcript,
            "turns": int(session.turns),
            "max_turns": int(self.max_turns),
            "resolved": session.resolved,
            "correct": session.correct,
            "guess": session.guess,
            # Persona stays secret until the round is resolved
            "persona": session.persona if session.resolved else "",
        }

    @gl.public.view
    def get_score(self, player: Address) -> int:
        return int(self.scores.get(player, i32(0)))

    @gl.public.view
    def get_leaderboard(self) -> list:
        board = []
        for addr in self.players:
            board.append({"player": str(addr), "score": int(self.scores[addr])})
        board.sort(key=lambda row: row["score"], reverse=True)
        return board

    # ---- internal: secret persona via LLM coin-flip ---------------------------
    def _pick_persona(self) -> str:
        def leader_fn():
            return gl.nondet.exec_prompt(
                'Flip a fair coin. Return ONLY JSON: {"persona": "human"} or '
                '{"persona": "ai"}. Pick randomly with ~50/50 probability.',
                response_format="json",
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            return isinstance(data, dict) and data.get("persona") in ("human", "ai")

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return result["persona"]
```

> Notes grounded in the docs:
> - `gl.message.sender_address` identifies the player (the wallet that signed the tx).
> - `strict_eq` is intentionally avoided for LLM output; we use `run_nondet_unsafe`
>   (structure-validated) and `prompt_non_comparative` (criteria-validated) instead.
> - Views take `player: Address` explicitly so the frontend can read any account's
>   session/score without sending a tx.

## Frontend Design

Stack: **React + TypeScript + Vite**, single SDK dependency `genlayer-js`. The browser
wallet (MetaMask) signs every write/deploy; we never hold a private key.

### Client setup (real SDK)

```typescript
// src/genlayer.ts
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { GenLayerClient } from "genlayer-js/types";

export function makeClient(account: `0x${string}`): GenLayerClient<any> {
  return createClient({ chain: studionet, account }) as GenLayerClient<any>;
}

export async function connectWallet(): Promise<`0x${string}`> {
  if (!(window as any).ethereum) throw new Error("Install MetaMask to play.");
  const accounts: string[] = await (window as any).ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts[0] as `0x${string}`;
}

export { TransactionStatus, studionet };
```

### Write flow (documented pattern)

```typescript
// Switch wallet network first (required before writing with a browser wallet)
await client.connect("studionet");

const txHash = await client.writeContract({
  address: contractAddress,
  functionName: "send_message",
  args: [text],
  value: 0n,
});

await client.waitForTransactionReceipt({
  hash: txHash,
  status: TransactionStatus.ACCEPTED, // faster than FINALIZED for gameplay
});
```

### Read flow (documented pattern)

```typescript
const session = await client.readContract({
  address: contractAddress,
  functionName: "get_my_session",
  args: [playerAddress],
});

const leaderboard = await client.readContract({
  address: contractAddress,
  functionName: "get_leaderboard",
  args: [],
});
```

### Deploy script (documented pattern)

```typescript
// deploy/001_human_or_ai.ts
import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash, TransactionStatus, GenLayerClient,
  DecodedDeployData, GenLayerChain,
} from "genlayer-js/types";
import { testnetBradbury } from "genlayer-js/chains";

export default async function main(client: GenLayerClient<any>) {
  const code = new Uint8Array(
    readFileSync(path.resolve(process.cwd(), "contracts/human_or_ai.py"))
  );

  await client.initializeConsensusSmartContract();

  const tx = await client.deployContract({ code, args: [] });
  const receipt = await client.waitForTransactionReceipt({
    hash: tx as TransactionHash,
    retries: 200,
  });

  if (
    receipt.statusName !== TransactionStatus.ACCEPTED &&
    receipt.statusName !== TransactionStatus.FINALIZED
  ) {
    throw new Error(`Deployment failed: ${JSON.stringify(receipt)}`);
  }

  const address =
    (client.chain as GenLayerChain).id !== testnetBradbury.id
      ? receipt.data.contract_address
      : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;

  console.log("HumanOrAI deployed at:", address);
  return address;
}
```

### UI components

- **WalletBar** — connect button, shows address + current score.
- **GameScreen** — chat transcript, message input, a 60s countdown (client-side),
  turn counter (`turns / max_turns`), and the *Guess Human / Guess AI* buttons.
- **ResultCard** — after `make_guess`: reveals the secret persona, correct/wrong, score delta.
- **Leaderboard** — sorted table from `get_leaderboard`, highlights the connected wallet.

## Project Structure

```
human-or-ai-game/
├── contracts/
│   └── human_or_ai.py            # Intelligent Contract
├── deploy/
│   └── 001_human_or_ai.ts        # genlayer-js deploy script
├── app/
│   ├── index.html
│   ├── package.json              # genlayer-js + react + vite
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── genlayer.ts           # client + wallet helpers
│       ├── contract.ts           # address + typed read/write wrappers
│       └── components/
│           ├── WalletBar.tsx
│           ├── GameScreen.tsx
│           ├── ResultCard.tsx
│           └── Leaderboard.tsx
└── README.md                     # setup, deploy, play
```

## Scoring Rules

- Correct guess: **+10**
- Wrong guess: **−5**
- Score is cumulative per wallet (`i32`, may go negative).
- Leaderboard sorts by score descending, read directly from contract state.

## Correctness Properties

### Property 1: Persona secrecy holds until resolution
For any session where `resolved == false`, every view path returns `persona == ""`. The
secret persona is only observable after `make_guess` flips `resolved` to true.

**Validates: Requirements 1.4, 3.4**

### Property 2: Score reflects guess correctness
After `make_guess`, `correct == (guess == persona)` and the score delta applied is exactly
`+10` when `correct` is true, otherwise `-5`.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: One verdict per round
A session transitions to `resolved == true` at most once. Any `make_guess` or `send_message`
call on an already-resolved session is rejected.

**Validates: Requirements 2.4, 3.6**

### Property 4: Bounded LLM cost per round
`turns` never exceeds `max_turns`. `send_message` is rejected once the cap is reached.

**Validates: Requirements 2.5**

### Property 5: Leaderboard completeness and uniqueness
Every address that ever called `start_game` appears exactly once in `players`, and
`get_leaderboard` returns exactly one row per such address.

**Validates: Requirements 1.3, 4.1, 4.2**

### Property 6: Consensus validity of non-deterministic output
Persona selection accepts only structurally valid LLM output (`persona ∈ {"human","ai"}`),
and opponent replies are accepted only if they satisfy the `prompt_non_comparative` criteria.

**Validates: Requirements 1.2, 2.1, 2.2**

## Error Handling

Contract-side (raises `gl.vm.UserError`, surfaced to the client):

| Condition | Method | Behavior |
|---|---|---|
| No active session | `send_message`, `make_guess` | `UserError("No active game…")` |
| Session already resolved | `send_message`, `make_guess` | `UserError("…already resolved")` |
| Turn cap reached | `send_message` | `UserError("Turn limit reached…")` |
| Invalid guess value | `make_guess` | `UserError('guess must be "human" or "ai"')` |

Frontend-side (documented `genlayer-js` error patterns):

- Wallet missing → prompt to install MetaMask.
- `user rejected` → surface a soft "transaction cancelled" message, keep state.
- `insufficient funds` → point the user to the 💧 faucet in the Studio account selector.
- Wrong chain → SDK throws; we always call `client.connect("studionet")` before writes.
- `waitForTransactionReceipt` timeout → retry with backoff (documented retry pattern).

## Security & Edge Cases

- **Persona secrecy**: `get_my_session` returns `persona = ""` until `resolved`, so a
  client cannot read the answer before guessing.
- **Turn limit**: `max_turns` caps LLM calls per round (cost + anti-stall). Frontend's
  60s timer is UX-only; the on-chain guard is the turn count, because `gl.message` exposes
  no block timestamp.
- **Prompt injection**: opponent prompts wrap user text and instruct "write only your next
  reply"; criteria in `prompt_non_comparative` reject system text/JSON leakage. We never
  let user text change the persona or scoring logic.
- **Double-resolve / no-session**: guarded with `gl.vm.UserError`.
- **Re-start**: calling `start_game` again overwrites the player's session with a fresh
  persona (previous score is preserved).
- **Wrong wallet network**: SDK throws if the wallet chain ≠ client chain; we always call
  `client.connect("studionet")` before writes.

## Testing Strategy

- **Contract**: deploy to Studionet (or localnet) and exercise
  `start_game → send_message → make_guess`, asserting score deltas and persona reveal.
  LLM/web calls are mocked in unit tests per the docs' mocking guidance.
- **Frontend**: manual playthrough on Studionet with a funded wallet (💧 faucet),
  verifying read-after-write refreshes and leaderboard ordering.

## Open Questions

1. Cumulative score vs. best-streak score for the leaderboard? (Design assumes cumulative.)
2. Should `start_game` be blocked while an unresolved session exists, or allowed to
   overwrite? (Design currently overwrites.)
3. Add a small GEN wager per round later (uses `@gl.public.write.payable` + `gl.message.value`)?
```
