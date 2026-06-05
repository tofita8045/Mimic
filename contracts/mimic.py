# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" guessing game on GenLayer.
#
# Storage is TreeMap[str, str] only (no DynArray, no TreeMap.items()), which is
# what the Studio schema loader accepts. The set of players is kept as a single
# newline-separated string under a reserved key in `meta`.
from genlayer import *

import json


class Mimic(gl.Contract):
    rounds: TreeMap[str, str]    # player -> JSON {persona, sentence, resolved, correct, guess}
    stats: TreeMap[str, str]     # player -> "wins,losses"
    meta: TreeMap[str, str]      # "players" -> "addr1\naddr2\n..."

    def __init__(self) -> None:
        self.rounds = TreeMap()
        self.stats = TreeMap()
        self.meta = TreeMap()

    @gl.public.write
    def start_round(self, player: str, seed: str) -> None:
        if player not in self.stats:
            self.stats[player] = "0,0"
            roster = self.meta.get("players", "")
            if roster == "":
                self.meta["players"] = player
            else:
                self.meta["players"] = roster + "\n" + player

        bank = [
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
        ]
        n = len(bank)

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
            f'Player seed for flavor (do not include literally): {seed}. '
            'Output JSON only, no prose, no code fences.'
        )

        def nondet() -> str:
            return gl.nondet.exec_prompt(prompt).replace("```json", "").replace("```", "").strip()

        raw = gl.eq_principle.prompt_comparative(
            nondet,
            "Both responses must agree on the persona (human or ai).",
        )
        data = json.loads(raw)

        persona = data["persona"]
        if persona == "human":
            idx = data["index"]
            if idx < 0 or idx >= n:
                idx = 0
            sentence = bank[idx]
        else:
            persona = "ai"
            sentence = str(data["ai_sentence"]).strip()
            if len(sentence) < 5:
                sentence = "Honestly, I'm just here vibing and pretending to be human."

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
        if state["resolved"]:
            raise Exception("Already resolved.")

        correct = normalized == state["persona"]
        state["guess"] = normalized
        state["correct"] = correct
        state["resolved"] = True
        self.rounds[player] = json.dumps(state)

        parts = self.stats.get(player, "0,0").split(",")
        wins = int(parts[0])
        losses = int(parts[1])
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
        revealed = ""
        if state["resolved"]:
            revealed = state["persona"]
        out = {
            "active": True,
            "sentence": state["sentence"],
            "resolved": state["resolved"],
            "correct": state["correct"],
            "guess": state["guess"],
            "persona": revealed,
        }
        return json.dumps(out)

    @gl.public.view
    def get_score(self, player: str) -> int:
        parts = self.stats.get(player, "0,0").split(",")
        return int(parts[0]) * 10 - int(parts[1]) * 5

    @gl.public.view
    def get_stats(self, player: str) -> str:
        return self.stats.get(player, "0,0")

    @gl.public.view
    def get_leaderboard(self) -> str:
        roster = self.meta.get("players", "")
        if roster == "":
            return "[]"
        addresses = roster.split("\n")
        rows = []
        i = 0
        while i < len(addresses):
            addr = addresses[i]
            parts = self.stats.get(addr, "0,0").split(",")
            wins = int(parts[0])
            losses = int(parts[1])
            score = wins * 10 - losses * 5
            short = addr[:6] + "..." + addr[-4:] if len(addr) > 10 else addr
            rows.append({"player": short, "address": addr, "wins": wins, "losses": losses, "score": score})
            i = i + 1
        # Manual sort by score desc (no lambda).
        a = 1
        while a < len(rows):
            b = a
            while b > 0 and rows[b]["score"] > rows[b - 1]["score"]:
                tmp = rows[b]
                rows[b] = rows[b - 1]
                rows[b - 1] = tmp
                b = b - 1
            a = a + 1
        return json.dumps(rows)
