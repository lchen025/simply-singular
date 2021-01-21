from enum import Enum, auto
from random import choice


class JustOne:

    @staticmethod
    def get_secret_word(corpus_file):
        corpus = ['null']
        with open('wordlists/' + corpus_file) as f:
            corpus = f.read().splitlines()
        return choice(corpus)

    def __init__(self, game_name, \
                 game_ready_callback, clue_submitted_callback, guess_resolved_callback, \
                 corpus='wordlist2000.txt'):
        self.players = set()
        self.clues = {}  # Map of player name to clue given.
        self.approved_clues = []
        self.game_name = game_name
        self.secret_word = self.get_secret_word(corpus)
        self.game_started = False
        self.guesser = None
        self.approver = None
        # Callbacks
        self.game_ready_callback = game_ready_callback
        self.clue_submitted_callback = clue_submitted_callback
        self.guess_resolved_callback = guess_resolved_callback

    def add_player(self, player_name):
        self.players.add(player_name)

    def remove_player(self, player_name):
        if player_name in self.players:
            self.players.remove(player_name)

    def on_game_ready(self, guesser):
        self.guesser = guesser
        self.game_started = True
        self.game_ready_callback(self.secret_word, self.guesser)

    def add_clue(self, cluer_name, clue):
        self.clues[cluer_name] = clue
        self.clue_submitted_callback(self.get_cluers(), self.clues)

    def remove_clue(self, cluer_name):
        if cluer_name in self.clues:
            del self.clues[cluer_name]
        self.clue_submitted_callback(self.get_cluers(), self.clues)

    def resolve_guess(self, guess, guesser):
        correct = ''.join(c for c in guess.lower() if c.isalnum()) == \
                  ''.join(c for c in self.secret_word.lower() if c.isalnum())
        self.guess_resolved_callback(guess, guesser, self.secret_word if not correct else None)

    def get_cluers(self):
        return list(self.players.difference({self.guesser}))

    def end(self):
        self.players = set()
        self.clues = {}
        self.approved_clues = []
        self.guesser = None
        self.approver = None
        self.game_started = False