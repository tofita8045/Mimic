# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Mimic — a fully on-chain "Human or AI?" guessing game built on GenLayer.
# Uses the GenLayer SDK: gl.Contract, gl.public.write/view, gl.message.sender_address,
# gl.nondet.exec_prompt, gl.eq_principle.prompt_non_comparative, gl.vm.UserError.
from genlayer import *

import json


class Mimic(gl.Contract):
    # Persistent storage (typed; no `list`/`dict`).
    bank: DynArray[str]
    sentence_for: TreeMap[Address, str]
    persona_for: TreeMap[Address, str]   # "human" | "ai"
    resolved_for: TreeMap[Address, bool]
    correct_for: TreeMap[Address, bool]
    guess_for: TreeMap[Address, str]     # "human" | "ai" | ""
    scores: TreeMap[Address, i32]
    players: DynArray[Address]

    def __init__(self) -> None:
        # Seed a small on-chain bank of human-written one-liners.
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
    def start_round(self, seed: str) -> None:
        """Begin a new round for the caller. `seed` is any short string the player types
        to flavor randomness (e.g. their nickname or a topic)."""
        player = gl.message.sender_address

        if not (player in self.scores):
            self.scores[player] = i32(0)
            self.players.append(player)

        n = len(self.bank)

        def leader_fn() -> str:
            prompt = (
                'You run a "Human or AI?" guessing game.\n'
                'Flip a fair coin to pick a persona, then return ONLY JSON in this shape:\n'
                '{"persona": "human" or "ai", "index": <int>, "ai_sentence": <string>}\n'
                'Rules:\n'
                '- persona is picked randomly with about 50/50 probability.\n'
                f'- If persona is "human": index is a random integer from 0 to {n - 1}, '
                '  and ai_sentence is the empty string "".\n'
                '- If persona is "ai": write a short, witty, original one-liner '
                '  (max 25 words, plain English, no quotes, no labels) in ai_sentence, '
                '  and set index to 0.\n'
                f'- Player seed (for flavor only, not literal): {seed}\n'
                '- Output JSON only, no prose, no code fences.'
            )
            return gl.nondet.exec_prompt(prompt, response_format='json')

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
                return isinstance(s, str) and len(s.strip()) > 5
            return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        persona = result['persona']
        if persona == 'human':
            sentence = self.bank[result['index']]
        else:
            sentence = result['ai_sentence'].strip()

        self.persona_for[player] = persona
        self.sentence_for[player] = sentence
        self.resolved_for[player] = False
        self.correct_for[player] = False
        self.guess_for[player] = ''

    @gl.public.write
    def make_guess(self, guess: str) -> None:
        normalized = guess.strip().lower()
        if normalized != 'human' and normalized != 'ai':
            raise gl.vm.UserError('guess must be "human" or "ai"')

        player = gl.message.sender_address
        if not (player in self.persona_for):
            raise gl.vm.UserError('No active round. Call start_round first.')
        if self.resolved_for[player]:
            raise gl.vm.UserError('Already resolved.')

        secret = self.persona_for[player]
        correct = normalized == secret

        self.guess_for[player] = normalized
        self.correct_for[player] = correct
        self.resolved_for[player] = True

        if correct:
            self.scores[player] = i32(self.scores[player] + i32(10))
        else:
            self.scores[player] = i32(self.scores[player] - i32(5))

    @gl.public.view
    def get_my_round(self, player: Address) -> str:
        """Returns the round state as a JSON string. Persona is hidden until resolved."""
        if not (player in self.persona_for):
            return json.dumps({'active': False})
        resolved = self.resolved_for[player]
        revealed = self.persona_for[player] if resolved else ''
        return json.dumps({
            'active': True,
            'sentence': self.sentence_for[player],
            'resolved': resolved,
            'correct': self.correct_for[player],
            'guess': self.guess_for[player],
            'persona': revealed,
        })

    @gl.public.view
    def get_score(self, player: Address) -> int:
        return int(self.scores.get(player, i32(0)))

    @gl.public.view
    def get_leaderboard(self) -> str:
        """Returns the leaderboard as a JSON string (sorted by score desc)."""
        rows = []
        for addr in self.players:
            rows.append({'player': str(addr), 'score': int(self.scores[addr])})
        # Insertion sort by score desc.
        i = 1
        while i < len(rows):
            j = i
            while j > 0 and rows[j]['score'] > rows[j - 1]['score']:
                rows[j], rows[j - 1] = rows[j - 1], rows[j]
                j -= 1
            i += 1
        return json.dumps(rows)

    @gl.public.view
    def get_bank_size(self) -> int:
        return len(self.bank)
