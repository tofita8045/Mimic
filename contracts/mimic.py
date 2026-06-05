# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" guessing game built on GenLayer.
from genlayer import *


@allow_storage
@dataclass
class Round:
    persona: str
    sentence: str
    resolved: bool
    correct: bool
    guess: str


class Mimic(gl.Contract):
    human_bank: DynArray[str]
    rounds: TreeMap[Address, Round]
    scores: TreeMap[Address, i32]
    players: DynArray[Address]

    def __init__(self) -> None:
        # Seed a small bank of human-written one-liners, one append per line.
        self.human_bank.append("I told my plant a joke. It didn't leaf an impression.")
        self.human_bank.append("I'm reading a book on anti-gravity. It's impossible to put down.")
        self.human_bank.append("Why don't scientists trust atoms? They make up everything.")
        self.human_bank.append("Parallel lines have so much in common. It's a shame they'll never meet.")
        self.human_bank.append("My wallet is like an onion. Opening it makes me cry.")
        self.human_bank.append("I used to play piano by ear, now I use my hands.")
        self.human_bank.append("I was going to look for my missing watch, but I could never find the time.")
        self.human_bank.append("Time flies like an arrow. Fruit flies like a banana.")
        self.human_bank.append("I'm on a seafood diet. I see food and I eat it.")
        self.human_bank.append("I'd tell you a chemistry joke but I know I wouldn't get a reaction.")
        self.human_bank.append("I named my dog 5 miles so I can tell people I walk 5 miles every day.")
        self.human_bank.append("My therapist says I have a preoccupation with revenge. We will see about that.")
        self.human_bank.append("Why did the scarecrow win an award? Because he was outstanding in his field.")
        self.human_bank.append("My boss told me to have a good day, so I went home.")
        self.human_bank.append("I tried to sue the airline for losing my luggage. I lost my case.")
        self.human_bank.append("The early bird might get the worm, but the second mouse gets the cheese.")
        self.human_bank.append("I have a fear of speed bumps. I'm slowly getting over it.")
        self.human_bank.append("Did you hear about the claustrophobic astronaut? He just needed a little space.")
        self.human_bank.append("I told my wife she was drawing her eyebrows too high. She looked surprised.")
        self.human_bank.append("Time is what keeps everything from happening at once. So far, so good.")

    @gl.public.write
    def start_round(self) -> None:
        player = gl.message.sender_address

        if player not in self.scores:
            self.scores[player] = i32(0)
            self.players.append(player)

        n = len(self.human_bank)
        max_index = n - 1

        def leader_fn():
            return gl.nondet.exec_prompt(
                'You run a "Human or AI?" guessing game. Flip a fair coin to pick a persona, '
                'then return ONLY JSON with this shape: '
                '{"persona": "human" or "ai", "index": <int>, "ai_sentence": <string>}. '
                'Rules: '
                'persona must be picked randomly with about 50/50 probability. '
                f'If persona is "human": index is a random integer between 0 and {max_index} inclusive, '
                'and ai_sentence is the empty string "". '
                'If persona is "ai": write a short, witty, original one-liner joke or observation '
                'in ai_sentence (max 25 words, plain English, no quotes, no emojis, no labels), '
                'and set index to 0. '
                'Output JSON only, no prose, no code fences.',
                response_format='json',
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
            persona = data.get('persona')
            if persona == 'human':
                idx = data.get('index')
                return isinstance(idx, int) and 0 <= idx < n
            if persona == 'ai':
                s = data.get('ai_sentence')
                return isinstance(s, str) and 5 < len(s.strip()) <= 280
            return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        persona = result['persona']
        if persona == 'human':
            sentence = self.human_bank[result['index']]
        else:
            sentence = result['ai_sentence'].strip()

        self.rounds[player] = Round(
            persona=persona,
            sentence=sentence,
            resolved=False,
            correct=False,
            guess='',
        )

    @gl.public.write
    def make_guess(self, guess: str) -> None:
        normalized = guess.strip().lower()
        if normalized != 'human' and normalized != 'ai':
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

        if correct:
            self.scores[player] = i32(self.scores[player] + i32(10))
        else:
            self.scores[player] = i32(self.scores[player] - i32(5))

    @gl.public.view
    def get_my_round(self, player: Address):
        r = self.rounds.get(player)
        if r is None:
            return {
                'active': False,
                'sentence': '',
                'resolved': False,
                'correct': False,
                'guess': '',
                'persona': '',
            }
        revealed = r.persona if r.resolved else ''
        return {
            'active': True,
            'sentence': r.sentence,
            'resolved': r.resolved,
            'correct': r.correct,
            'guess': r.guess,
            'persona': revealed,
        }

    @gl.public.view
    def get_score(self, player: Address) -> int:
        return int(self.scores.get(player, i32(0)))

    @gl.public.view
    def get_leaderboard(self):
        rows = []
        for addr in self.players:
            rows.append({'player': str(addr), 'score': int(self.scores[addr])})
        # Insertion sort by score desc — small list, one entry per player.
        i = 1
        while i < len(rows):
            j = i
            while j > 0 and rows[j]['score'] > rows[j - 1]['score']:
                rows[j], rows[j - 1] = rows[j - 1], rows[j]
                j -= 1
            i += 1
        return rows

    @gl.public.view
    def get_bank_size(self) -> int:
        return len(self.human_bank)
