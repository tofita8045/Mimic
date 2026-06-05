# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" guessing game built on GenLayer.
#
# Each round the contract shows the player a short, funny one-liner. The line was
# either picked from a curated bank of human-written sentences, OR freshly generated
# by an LLM at round start. The player has to tell which.
#
# Persona selection (and, for AI rounds, the sentence itself) is non-deterministic, so
# we use `gl.vm.run_nondet_unsafe` with a leader/validator pair to reach consensus on a
# structurally valid JSON output, exactly as recommended in the GenLayer docs for
# random / LLM-generated values.
from genlayer import *


@allow_storage
@dataclass
class Round:
    player: Address
    persona: str        # "human" | "ai" — secret until resolved
    sentence: str       # the one-liner shown to the player
    resolved: bool
    correct: bool
    guess: str          # "human" | "ai" | "" before guessing


# A small bank of human-written funny one-liners. These are deterministic strings
# stored on-chain at deploy time so validators can verify any "human" pick by index.
HUMAN_BANK: list[str] = [
    "I told my plant a joke. It didn't leaf an impression.",
    "I'm reading a book on anti-gravity. It's impossible to put down.",
    "Why don't scientists trust atoms? They make up everything.",
    "Parallel lines have so much in common. It's a shame they'll never meet.",
    "My wallet is like an onion. Opening it makes me cry.",
    "I used to play piano by ear, now I use my hands.",
    "I was going to look for my missing watch, but I could never find the time.",
    "Time flies like an arrow. Fruit flies like a banana.",
    "I'm on a seafood diet. I see food and I eat it.",
    "I'd tell you a chemistry joke but I know I wouldn't get a reaction.",
    "I named my dog 5 miles so I can tell people I walk 5 miles every day.",
    "My therapist says I have a preoccupation with revenge. We'll see about that.",
    "I told my wife she was drawing her eyebrows too high. She looked surprised.",
    "Why did the scarecrow win an award? Because he was outstanding in his field.",
    "I asked the librarian if they had any books about paranoia. She whispered, 'they're right behind you'.",
    "My boss told me to have a good day, so I went home.",
    "I tried to sue the airline for losing my luggage. I lost my case.",
    "The early bird might get the worm, but the second mouse gets the cheese.",
    "I have a fear of speed bumps. I'm slowly getting over it.",
    "Did you hear about the claustrophobic astronaut? He just needed a little space.",
]


class Mimic(gl.Contract):
    human_bank: DynArray[str]
    rounds: TreeMap[Address, Round]
    scores: TreeMap[Address, i32]
    players: DynArray[Address]

    def __init__(self) -> None:
        # Seed the deterministic bank of human-written sentences.
        for line in HUMAN_BANK:
            self.human_bank.append(line)

    # ---- write: begin a new round --------------------------------------------
    @gl.public.write
    def start_round(self) -> None:
        player = gl.message.sender_address

        # Register first-time players for the leaderboard.
        if player not in self.scores:
            self.scores[player] = i32(0)
            self.players.append(player)

        n = len(self.human_bank)

        # One LLM call decides everything for this round:
        # - flip a fair coin to pick persona,
        # - if "human": choose a random index into the bank,
        # - if "ai": write a fresh funny one-liner.
        # Validators check structure, not exact text — the standard pattern from the
        # GenLayer docs for non-deterministic / random output.
        def leader_fn():
            return gl.nondet.exec_prompt(
                'You are running a "Human or AI?" guessing game.\n'
                'Flip a fair coin to pick a persona, then return ONLY JSON in this exact shape:\n'
                '{"persona": "human" | "ai", '
                '"index": <integer in [0, ' + str(n - 1) + ']>, '
                '"ai_sentence": <string>}\n\n'
                'Rules:\n'
                f'- "persona" must be picked randomly with ~50/50 probability.\n'
                f'- If persona is "human": "index" is a random integer in [0, {n - 1}] '
                f'  and "ai_sentence" is the empty string "".\n'
                '- If persona is "ai": write a short, witty, original one-liner joke or '
                '  observation in "ai_sentence" (max 25 words, plain English, no quotes, '
                '  no emojis, no labels). "index" must be 0.\n'
                '- Output JSON only, no prose, no code fences.',
                response_format='json',
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
            persona = data.get('persona')
            if persona not in ('human', 'ai'):
                return False
            if persona == 'human':
                idx = data.get('index')
                return isinstance(idx, int) and 0 <= idx < n
            # persona == 'ai'
            s = data.get('ai_sentence')
            return isinstance(s, str) and 5 < len(s.strip()) <= 280

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        persona = result['persona']
        if persona == 'human':
            sentence = self.human_bank[result['index']]
        else:
            sentence = result['ai_sentence'].strip()

        self.rounds[player] = Round(
            player=player,
            persona=persona,
            sentence=sentence,
            resolved=False,
            correct=False,
            guess='',
        )

    # ---- write: guess & score ------------------------------------------------
    @gl.public.write
    def make_guess(self, guess: str) -> None:
        normalized = guess.strip().lower()
        if normalized not in ('human', 'ai'):
            raise gl.vm.UserError('guess must be "human" or "ai"')

        player = gl.message.sender_address
        round_ = self.rounds.get(player)
        if round_ is None:
            raise gl.vm.UserError('No active round. Call start_round first.')
        if round_.resolved:
            raise gl.vm.UserError('Already resolved.')

        correct = normalized == round_.persona
        round_.guess = normalized
        round_.correct = correct
        round_.resolved = True
        self.rounds[player] = round_

        delta = i32(10) if correct else i32(-5)
        self.scores[player] = i32(self.scores[player] + delta)

    # ---- views ----------------------------------------------------------------
    @gl.public.view
    def get_my_round(self, player: Address) -> dict:
        r = self.rounds.get(player)
        if r is None:
            return {'active': False}
        return {
            'active': True,
            'sentence': r.sentence,
            'resolved': r.resolved,
            'correct': r.correct,
            'guess': r.guess,
            # Persona stays secret until the round is resolved.
            'persona': r.persona if r.resolved else '',
        }

    @gl.public.view
    def get_score(self, player: Address) -> int:
        return int(self.scores.get(player, i32(0)))

    @gl.public.view
    def get_leaderboard(self) -> list:
        board = []
        for addr in self.players:
            board.append({'player': str(addr), 'score': int(self.scores[addr])})
        board.sort(key=lambda row: row['score'], reverse=True)
        return board

    @gl.public.view
    def get_bank_size(self) -> int:
        return len(self.human_bank)
