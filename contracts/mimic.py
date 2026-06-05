# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# Step 2: counter + a TreeMap[str, u256] + str argument writes/views.
from genlayer import *


class Mimic(gl.Contract):
    counter: u256
    wins: TreeMap[str, u256]

    def __init__(self) -> None:
        self.counter = u256(0)

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
