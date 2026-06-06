# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Mimic — Human or AI?
=====================

A fully on-chain "Human or AI?" chat game on GenLayer (humanornot.io style).

Each round you pay a small entry fee, then chat with a stranger. The stranger is
secretly either role-played by an LLM as a *human*, or as an *AI assistant*. After
chatting you guess HUMAN or AI.

GenLayer features used:
- @gl.public.write.payable          -> entry fee on start_round
- gl.message.sender_address / value -> player identity + fee
- gl.vm.run_nondet_unsafe(...)       -> secret persona pick + opponent replies,
                                        with validators reaching consensus
- gl.vm.UserError                    -> input / state validation
- TreeMap[Address, ...] / DynArray   -> per-player state + leaderboard
"""
from genlayer import *


# ---- Constants ------------------------------------------------------------

WIN_DELTA: int = 10
LOSS_DELTA: int = 5
ENTRY_FEE_WEI: int = 10**14          # 0.0001 GEN
MAX_MESSAGES: int = 6                # player messages per round (bounds LLM cost)
MAX_REPLY_LEN: int = 400


class Mimic(gl.Contract):
    # Per-player round state.
    secret: TreeMap[Address, str]        # "human" | "ai" (hidden until resolved)
    transcript: TreeMap[Address, str]    # JSON list of {"role","text"}
    msg_count: TreeMap[Address, u256]    # number of player messages so far
    resolved: TreeMap[Address, u256]     # 0 active, 1 resolved
    correct: TreeMap[Address, u256]      # 0 wrong, 1 correct
    guess: TreeMap[Address, str]         # "" | "human" | "ai"

    # Counters.
    wins: TreeMap[Address, u256]
    losses: TreeMap[Address, u256]

    players: DynArray[Address]

    total_rounds: u256
    total_fees_wei: u256

    def __init__(self) -> None:
        self.total_rounds = u256(0)
        self.total_fees_wei = u256(0)

    # ---- Start a round (pay fee + pick secret persona) -------------------

    @gl.public.write.payable
    def start_round(self, seed: str) -> None:
        if int(gl.message.value) < ENTRY_FEE_WEI:
            raise gl.vm.UserError(f"Entry fee is {ENTRY_FEE_WEI} wei (0.0001 GEN)")

        sender = gl.message.sender_address
        self.total_fees_wei = u256(int(self.total_fees_wei) + int(gl.message.value))

        if int(self.wins.get(sender, u256(0))) == 0 and int(self.losses.get(sender, u256(0))) == 0 and self.secret.get(sender, "") == "":
            self.players.append(sender)
            self.wins[sender] = u256(0)
            self.losses[sender] = u256(0)

        # LLM coin-flip for the secret persona (validators agree on structure).
        prompt = (
            'Flip a fair coin for a "Human or AI?" game. '
            'Return ONLY JSON: {"persona": "human"} or {"persona": "ai"}. '
            'Pick randomly, about 50/50. '
            f'Seed (for flavor, do not echo): {seed}'
        )

        def leader_fn() -> dict:
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            return isinstance(data, dict) and data.get("persona") in ("human", "ai")

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        persona = str(verdict["persona"])
        if persona != "human" and persona != "ai":
            persona = "human"

        self.secret[sender] = persona
        self.transcript[sender] = "[]"
        self.msg_count[sender] = u256(0)
        self.resolved[sender] = u256(0)
        self.correct[sender] = u256(0)
        self.guess[sender] = ""

        self.total_rounds = u256(int(self.total_rounds) + 1)

    # ---- Send a chat message (opponent replies via LLM) ------------------

    @gl.public.write
    def send_message(self, text: str) -> None:
        sender = gl.message.sender_address

        persona = self.secret.get(sender, "")
        if persona == "":
            raise gl.vm.UserError("No active round. Call start_round() first.")
        if int(self.resolved.get(sender, u256(0))) == 1:
            raise gl.vm.UserError("Round already resolved.")
        if int(self.msg_count.get(sender, u256(0))) >= MAX_MESSAGES:
            raise gl.vm.UserError("Message limit reached. Make your guess.")

        clean = text.strip()[:300]
        if len(clean) == 0:
            raise gl.vm.UserError("Empty message.")

        history = self.transcript.get(sender, "[]")

        if persona == "human":
            style = (
                "You are a real human stranger in a casual text chat. Reply briefly and "
                "informally in 1-2 short sentences, lowercase is fine, occasional typo is "
                "fine. Sound natural, NEVER say you are an AI or a bot."
            )
        else:
            style = (
                "You are a friendly AI assistant in a text chat. Reply clearly and politely "
                "in 1-2 short sentences, in a neutral, helpful, well-structured tone."
            )

        prompt = (
            f"{style}\n\n"
            f"Conversation so far (JSON list of role/text): {history}\n\n"
            f"The stranger just said: {clean}\n\n"
            "Write ONLY your next chat reply text, nothing else, no labels, no quotes."
        )

        def leader_fn() -> str:
            r = gl.nondet.exec_prompt(prompt)
            return r.strip()

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            val = leader_result.calldata
            return isinstance(val, str) and len(val.strip()) > 0

        reply = str(gl.vm.run_nondet_unsafe(leader_fn, validator_fn)).strip()
        reply = reply.replace("\\", " ").replace('"', "'")[:MAX_REPLY_LEN]

        # Append player + opponent messages to the transcript (manual JSON build,
        # avoids json.dumps edge-cases in GenVM and keeps the schema simple).
        prev = history
        if prev == "" or prev == "[]":
            inner = ""
        else:
            inner = prev[1:-1]  # strip surrounding [ ]
        safe_player = clean.replace("\\", " ").replace('"', "'")
        new_items = (
            '{"role":"you","text":"' + safe_player + '"},'
            '{"role":"them","text":"' + reply + '"}'
        )
        if inner == "":
            updated = "[" + new_items + "]"
        else:
            updated = "[" + inner + "," + new_items + "]"

        self.transcript[sender] = updated
        self.msg_count[sender] = u256(int(self.msg_count.get(sender, u256(0))) + 1)

    # ---- Guess + score ----------------------------------------------------

    @gl.public.write
    def make_guess(self, guess: str) -> None:
        sender = gl.message.sender_address

        normalized = guess.strip().lower()
        if normalized != "human" and normalized != "ai":
            raise gl.vm.UserError('guess must be "human" or "ai"')

        persona = self.secret.get(sender, "")
        if persona == "":
            raise gl.vm.UserError("No active round.")
        if int(self.resolved.get(sender, u256(0))) == 1:
            raise gl.vm.UserError("Round already resolved.")

        is_correct = normalized == persona
        self.guess[sender] = normalized
        self.correct[sender] = u256(1) if is_correct else u256(0)
        self.resolved[sender] = u256(1)

        if is_correct:
            self.wins[sender] = u256(int(self.wins.get(sender, u256(0))) + 1)
        else:
            self.losses[sender] = u256(int(self.losses.get(sender, u256(0))) + 1)

    # ---- Views (scalar returns only) -------------------------------------

    @gl.public.view
    def get_active(self, player_hex: str) -> bool:
        addr = Address(player_hex)
        return self.secret.get(addr, "") != ""

    @gl.public.view
    def get_resolved(self, player_hex: str) -> bool:
        addr = Address(player_hex)
        return int(self.resolved.get(addr, u256(0))) == 1

    @gl.public.view
    def get_transcript(self, player_hex: str) -> str:
        addr = Address(player_hex)
        return self.transcript.get(addr, "[]")

    @gl.public.view
    def get_msg_count(self, player_hex: str) -> int:
        addr = Address(player_hex)
        return int(self.msg_count.get(addr, u256(0)))

    @gl.public.view
    def get_max_messages(self) -> int:
        return MAX_MESSAGES

    @gl.public.view
    def get_persona_revealed(self, player_hex: str) -> str:
        addr = Address(player_hex)
        if int(self.resolved.get(addr, u256(0))) != 1:
            return ""
        return self.secret.get(addr, "")

    @gl.public.view
    def get_guess(self, player_hex: str) -> str:
        addr = Address(player_hex)
        return self.guess.get(addr, "")

    @gl.public.view
    def get_correct(self, player_hex: str) -> bool:
        addr = Address(player_hex)
        return int(self.correct.get(addr, u256(0))) == 1

    @gl.public.view
    def get_wins(self, player_hex: str) -> int:
        addr = Address(player_hex)
        return int(self.wins.get(addr, u256(0)))

    @gl.public.view
    def get_losses(self, player_hex: str) -> int:
        addr = Address(player_hex)
        return int(self.losses.get(addr, u256(0)))

    @gl.public.view
    def get_score(self, player_hex: str) -> int:
        addr = Address(player_hex)
        w = int(self.wins.get(addr, u256(0)))
        l = int(self.losses.get(addr, u256(0)))
        return w * WIN_DELTA - l * LOSS_DELTA

    @gl.public.view
    def get_entry_fee(self) -> int:
        return ENTRY_FEE_WEI

    @gl.public.view
    def get_total_rounds(self) -> int:
        return int(self.total_rounds)

    @gl.public.view
    def get_player_count(self) -> int:
        return len(self.players)

    @gl.public.view
    def get_leaderboard(self) -> list:
        out: list = []
        for addr in self.players:
            w = int(self.wins.get(addr, u256(0)))
            l = int(self.losses.get(addr, u256(0)))
            out.append((str(addr), w, l, w * WIN_DELTA - l * LOSS_DELTA))
        return out
