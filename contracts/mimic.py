# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Step 3: add DynArray[str] with 15 appends in __init__.
from genlayer import *


class Mimic(gl.Contract):
    counter: u256
    wins: TreeMap[str, u256]
    bank: DynArray[str]

    def __init__(self) -> None:
        self.counter = u256(0)
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
    def bump(self) -> None:
        self.counter = u256(self.counter + 1)

    @gl.public.write
    def add_win(self, player: str) -> None:
        if not (player in self.wins):
            self.wins[player] = u256(0)
        self.wins[player] = u256(self.wins[player] + 1)

    @gl.public.view
    def get_counter(self) -> int:
        return int(self.counter)

    @gl.public.view
    def get_wins(self, player: str) -> int:
        if not (player in self.wins):
            return 0
        return int(self.wins[player])

    @gl.public.view
    def get_bank_size(self) -> int:
        return len(self.bank)

    @gl.public.view
    def get_bank_at(self, idx: int) -> str:
        if idx < 0 or idx >= len(self.bank):
            return ""
        return self.bank[idx]
