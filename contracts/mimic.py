# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" guessing game on GenLayer.
#
# Modeled on the proven contract structure: TreeMap[str, str] storage only,
# explicit TreeMap() init, no DynArray, no appends in __init__. The human-written
# sentence bank is a module-level tuple, indexed directly (not stored on-chain).
#
# Optimistic Democracy: AI validators reach consensus on the LLM JSON output
# (gl.eq_principle.prompt_comparative + json parse).
from genlayer import *

import json


# Human-written one-liners. Module-level tuple (immutable), accessed by index.
HUMAN_BANK = (
    "I told my plant a joke. It didn't leaf an impression.",
    "I'm reading a book on anti-gravity. It's impossible to put down.",
    "Why don't scientists trust atoms? They make up everything.",
    "Parallel lines have so much in common. It's a shame they'll never meet.",
    "My wallet is like an onion. Opening it makes me cry.",
    "I used to play piano by ear, now I use my hands.",
    "Time flies like an arrow. Fruit flies like a banana.",
    "I'm on a seafood diet. I see food and I eat it.",
    "Why did the scarecrow win an award? He was outstanding in his field.",
    "My boss told me to have a good day, so I went home.",
    "I tried to sue the airline for losing my luggage. I lost my case.",
    "The early bird gets the worm, but the second mouse gets the cheese.",
    "I have a fear of speed bumps. I am slowly getting over it.",
    "Did you hear about the claustrophobic astronaut? He just needed space.",
    "I told my wife she draws her eyebrows too high. She looked surprised.",
)


class Mimic(gl.Contract):
    rounds: TreeMap[str, str]    # player -> JSON {persona, sentence, resolved, correct, guess}
    stats: TreeMap[str, str]     # player -> "wins,losses"

    def __init__(self) -> None:
        self.rounds = TreeMap()
        self.stats = TreeMap()

    @gl.public.write
    def start_round(self, player: str, seed: str) -> None:
        if player not in self.stats:
            self.stats[player] = "0,0"

        n = len(HUMAN_BANK)
        prompt = (
            'You run a "Human or AI?" guessing game. '
            'Flip a fair coin to pick a persona, then return ONLY JSON in this exact shape: '
            '{"persona": "human" or "ai", "index": <int>, "ai_sentence": <string>} '
            'Rules: '
            'persona is picked randomly with about 50/50 probability. '
            f'If persona is "human": index is a random integer from 0 to {n - 1} inclusive, '
            'and ai_sentence is the empty string "". '
            'If persona is "ai": write a short, witty, original one-liner '
            '(max 25 words, plain English, no quotes, no labels, no emojis), and set index to 0. '
            f'Player flavor seed (do not include literally): {seed}. '
            'Output JSON only, no prose, no code fences.'
        )

        def check():
            r = gl.nondet.exec_prompt(prompt)
            return r.replace("```json", "").replace("```", "").strip()

        result = gl.eq_principle.prompt_comparative(
            check,
            "Both responses must agree on the persona (human or ai).",
        )
        data = json.loads(result)
        persona = data.get("persona", "")
        sentence = ""
        if persona == "human":
            idx = data.get("index", 0)
            if not isinstance(idx, int) or idx < 0 or idx >= n:
                idx = 0
            sentence = HUMAN_BANK[idx]
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
        if player not in self.rounds:
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

        parts = self.stats.get(player, "0,0").split(",")
        wins = int(parts[0])
        losses = int(parts[1]) if len(parts) > 1 else 0
        if correct:
            wins = wins + 1
        else:
            losses = losses + 1
        self.stats[player] = f"{wins},{losses}"

    @gl.public.view
    def get_my_round(self, player: str) -> str:
        if player not in self.rounds:
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
    def get_stats(self, player: str) -> str:
        return self.stats.get(player, "0,0")

    @gl.public.view
    def get_score(self, player: str) -> int:
        parts = self.stats.get(player, "0,0").split(",")
        wins = int(parts[0])
        losses = int(parts[1]) if len(parts) > 1 else 0
        return wins * 10 - losses * 5

    @gl.public.view
    def get_leaderboard(self) -> str:
        """Leaderboard as a JSON string, sorted by score desc."""
        rows = []
        for k, v in self.stats.items():
            parts = v.split(",")
            wins = int(parts[0])
            losses = int(parts[1]) if len(parts) > 1 else 0
            score = wins * 10 - losses * 5
            short = k[:6] + "..." + k[-4:] if len(k) > 10 else k
            rows.append({
                "player": short,
                "address": k,
                "wins": wins,
                "losses": losses,
                "score": score,
            })
        rows.sort(key=lambda x: -x["score"])
        return json.dumps(rows[:50])

    @gl.public.view
    def get_bank_size(self) -> int:
        return len(HUMAN_BANK)
