# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" guessing game on GenLayer.
#
# All view methods return scalar types (int / bool / str). Aggregate state is
# returned as JSON-encoded strings to keep the schema parser happy.
from genlayer import *

import json


class Mimic(gl.Contract):
    bank: DynArray[str]
    rounds: TreeMap[str, str]    # player -> JSON {"persona","sentence","resolved","correct","guess"}
    wins: TreeMap[str, u256]
    losses: TreeMap[str, u256]
    players: DynArray[str]

    def __init__(self) -> None:
        self.bank.append("I told my plant a joke. It didn't leaf an impression.")
        self.bank.append("I'm reading a book on anti-gravity. It's impossible to put down.")
        self.bank.append("Why don't scientists trust atoms? They make up everything.")
        self.bank.append("Parallel lines have so much in common. It's a shame they'll never meet.")
        self.bank.append("My wallet is like an onion. Opening it makes me cry.")
        self.bank.append("I used to play piano by ear, now I use my hands.")
        self.bank.append("Time flies like an arrow. Fruit flies like a banana.")
        self.bank.append("I'm on a seafood diet. I see food and I eat it.")
        self.bank.append("Why did the scarecrow win an award? He was outstanding in his field.")
        self.bank.append("My boss told me to have a good day, so I went home.")
        self.bank.append("I tried to sue the airline for losing my luggage. I lost my case.")
        self.bank.append("The early bird gets the worm, but the second mouse gets the cheese.")
        self.bank.append("I have a fear of speed bumps. I am slowly getting over it.")
        self.bank.append("Did you hear about the claustrophobic astronaut? He just needed space.")
        self.bank.append("I told my wife she draws her eyebrows too high. She looked surprised.")

    @gl.public.write
    def start_round(self, player: str, seed: str) -> None:
        if not (player in self.wins):
            self.wins[player] = u256(0)
            self.losses[player] = u256(0)
            self.players.append(player)

        n = len(self.bank)
        prompt = (
            'You run a "Human or AI?" guessing game.\n'
            'Flip a fair coin to pick a persona, then return ONLY JSON in this exact shape:\n'
            '{"persona": "human" or "ai", "index": <int>, "ai_sentence": <string>}\n'
            'Rules:\n'
            '- persona is picked randomly with about 50/50 probability.\n'
            f'- If persona is "human": index is a random integer from 0 to {n - 1} inclusive, '
            'and ai_sentence is the empty string "".\n'
            '- If persona is "ai": write a short, witty, original one-liner '
            '(max 25 words, plain English, no quotes, no labels, no emojis), '
            'and set index to 0.\n'
            f'- Player flavor seed (do not include literally): {seed}\n'
            '- Output JSON only, no prose, no code fences.'
        )

        def call():
            r = gl.nondet.exec_prompt(prompt)
            return r.replace("```json", "").replace("```", "").strip()

        result = gl.eq_principle.prompt_comparative(
            call,
            "Both responses must agree on the persona (human or ai).",
        )
        data = json.loads(result)
        persona = data.get("persona", "")
        sentence = ""
        if persona == "human":
            idx = data.get("index", 0)
            if not isinstance(idx, int) or idx < 0 or idx >= n:
                idx = 0
            sentence = self.bank[idx]
        elif persona == "ai":
            s = data.get("ai_sentence", "")
            if not isinstance(s, str) or len(s.strip()) < 5:
                raise Exception("LLM returned invalid ai_sentence")
            sentence = s.strip()
        else:
            raise Exception("LLM returned invalid persona")

        state = {
            "persona": persona,
            "sentence": sentence,
            "resolved": False,
            "correct": False,
            "guess": "",
        }
        self.rounds[player] = json.dumps(state)

    @gl.public.write
    def make_guess(self, player: str, guess: str) -> None:
        normalized = guess.strip().lower()
        if normalized != "human" and normalized != "ai":
            raise Exception('guess must be "human" or "ai"')
        if not (player in self.rounds):
            raise Exception("No active round. Call start_round first.")

        state = json.loads(self.rounds[player])
        if state.get("resolved"):
            raise Exception("Already resolved.")

        secret = state.get("persona", "")
        correct = normalized == secret

        state["guess"] = normalized
        state["correct"] = correct
        state["resolved"] = True
        self.rounds[player] = json.dumps(state)

        if correct:
            self.wins[player] = u256(int(self.wins[player]) + 1)
        else:
            self.losses[player] = u256(int(self.losses[player]) + 1)

    # ── views: only scalar returns ─────────────────────────────────────────

    @gl.public.view
    def get_my_round(self, player: str) -> str:
        """Returns the round state as JSON (or '{"active": false}' when none)."""
        if not (player in self.rounds):
            return '{"active": false}'
        state = json.loads(self.rounds[player])
        revealed = state.get("persona", "") if state.get("resolved") else ""
        out = {
            "active": True,
            "sentence": state.get("sentence", ""),
            "resolved": bool(state.get("resolved", False)),
            "correct": bool(state.get("correct", False)),
            "guess": state.get("guess", ""),
            "persona": revealed,
        }
        return json.dumps(out)

    @gl.public.view
    def get_score(self, player: str) -> int:
        if not (player in self.wins):
            return 0
        w = int(self.wins[player])
        l = int(self.losses[player])
        return w * 10 - l * 5

    @gl.public.view
    def get_wins(self, player: str) -> int:
        if not (player in self.wins):
            return 0
        return int(self.wins[player])

    @gl.public.view
    def get_losses(self, player: str) -> int:
        if not (player in self.losses):
            return 0
        return int(self.losses[player])

    @gl.public.view
    def has_active_round(self, player: str) -> bool:
        if not (player in self.rounds):
            return False
        state = json.loads(self.rounds[player])
        return not bool(state.get("resolved", False))

    @gl.public.view
    def get_player_count(self) -> int:
        return len(self.players)

    @gl.public.view
    def get_player_at(self, idx: int) -> str:
        """Read one entry of `players` by index. Frontend pages through this to build the
        leaderboard. Returns '' if the index is out of range."""
        if idx < 0 or idx >= len(self.players):
            return ""
        return self.players[idx]

    @gl.public.view
    def get_bank_size(self) -> int:
        return len(self.bank)
