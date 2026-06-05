# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" game built on GenLayer.
from genlayer import *


@allow_storage
@dataclass
class Session:
    player: Address
    persona: str        # "human" | "ai" — secret until resolved
    transcript: str
    turns: u8
    resolved: bool
    correct: bool
    guess: str          # "human" | "ai" | "" before guessing


class Mimic(gl.Contract):
    sessions: TreeMap[Address, Session]
    scores: TreeMap[Address, i32]
    players: DynArray[Address]
    max_turns: u8

    def __init__(self) -> None:
        self.max_turns = u8(8)

    # ---- write: begin a new round --------------------------------------------
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
            # Persona stays secret until the round is resolved.
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

    # ---- internal: secret persona via LLM coin-flip --------------------------
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
