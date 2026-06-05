# Requirements Document

## Introduction

**Human or AI?** is a single-player, fully on-chain game on GenLayer. A player is matched
with an opponent powered by a GenLayer Intelligent Contract that secretly behaves like a
**human** or an **AI**. After a short chat, the player guesses which it was. The contract
reveals the secret persona, scores the guess, and ranks players on a public on-chain
leaderboard. All game logic (opponent replies, secret persona, verdict, scoring,
leaderboard) runs on GenLayer using the real SDK — no off-chain backend.

## Requirements

### Requirement 1: Start a game round
**User Story:** As a player, I want to start a new round, so that I get a fresh opponent
with a hidden persona to chat with.

#### Acceptance Criteria
1. WHEN a player calls `start_game` THEN the system SHALL create a session owned by the
   caller's address with an empty transcript and zero turns.
2. WHEN a session is created THEN the system SHALL pick a secret persona of `"human"` or
   `"ai"` using a non-deterministic LLM coin-flip reaching validator consensus.
3. WHEN a first-time player calls `start_game` THEN the system SHALL register the player in
   the leaderboard set with an initial score of 0.
4. WHILE a round is unresolved THE system SHALL NOT expose the secret persona through any
   read path.

### Requirement 2: Chat with the opponent
**User Story:** As a player, I want to exchange messages with the opponent, so that I can
gather clues about whether it is human or AI.

#### Acceptance Criteria
1. WHEN a player calls `send_message` with text THEN the system SHALL append the player
   message and generate one opponent reply in the session's secret persona style.
2. WHERE the persona is `"human"` THE opponent reply SHALL use an informal human tone; WHERE
   the persona is `"ai"` THE reply SHALL use a neutral AI-assistant tone.
3. IF there is no active session THEN the system SHALL reject `send_message` with a user error.
4. IF the session is already resolved THEN the system SHALL reject `send_message` with a user error.
5. WHILE `turns` is greater than or equal to `max_turns` THE system SHALL reject further
   `send_message` calls with a user error.

### Requirement 3: Guess and scoring
**User Story:** As a player, I want to guess Human or AI and see the result, so that my
score reflects how well I detect AI.

#### Acceptance Criteria
1. WHEN a player calls `make_guess` with `"human"` or `"ai"` THEN the system SHALL mark the
   session resolved and record whether the guess equals the secret persona.
2. WHEN a guess is correct THEN the system SHALL add 10 to the player's cumulative score.
3. WHEN a guess is wrong THEN the system SHALL subtract 5 from the player's cumulative score.
4. WHEN a session is resolved THEN the system SHALL reveal the secret persona on read paths.
5. IF the guess value is not `"human"` or `"ai"` THEN the system SHALL reject it with a user error.
6. IF the session is already resolved THEN the system SHALL reject another `make_guess` with a user error.

### Requirement 4: Public leaderboard
**User Story:** As a player, I want a public leaderboard, so that I can compete with others.

#### Acceptance Criteria
1. WHEN `get_leaderboard` is called THEN the system SHALL return exactly one row per player
   that has ever started a game.
2. WHEN `get_leaderboard` is called THEN the system SHALL return rows sorted by score descending.
3. WHEN `get_score` is called with an address THEN the system SHALL return that address's
   cumulative score (0 if never played).

### Requirement 5: Wallet-based play via genlayer-js
**User Story:** As a player, I want to use my browser wallet, so that I sign transactions
without exposing a private key.

#### Acceptance Criteria
1. WHEN the app loads THEN the system SHALL let the player connect a MetaMask wallet and
   create a `genlayer-js` client bound to that address on Studionet.
2. WHEN the player performs a write action THEN the system SHALL call `client.connect` for
   the target network before sending the transaction.
3. WHEN a write transaction is sent THEN the system SHALL wait for the receipt before
   refreshing on-chain reads.
4. IF the wallet is missing, on the wrong chain, or the user rejects a transaction THEN the
   system SHALL surface a clear, actionable message.

## Glossary

- **Intelligent Contract**: a Python smart contract on GenLayer that can call LLMs and the
  web, extending `gl.Contract`.
- **Persona**: the secret behavior of the opponent in a round, either `"human"` or `"ai"`.
- **Session**: a single round of play owned by one player address (transcript, turns, persona, result).
- **Equivalence Principle**: GenLayer's mechanism for validators to reach consensus on
  non-deterministic (LLM/web) outputs.
- **Studionet**: GenLayer's hosted development network (RPC `https://studio.genlayer.com/api`, chain ID 61999).
- **genlayer-js**: the official TypeScript SDK used by the frontend to read/write/deploy contracts.
- **Turn**: one player message plus one opponent reply within a session.
