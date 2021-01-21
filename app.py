from flask import Flask, render_template, g, request, redirect
from flask_socketio import SocketIO, join_room, emit
from flask_static_compress import FlaskStaticCompress

from functools import partial
from random import choice

from game import JustOne

app = Flask(__name__)
socketio = SocketIO(app)
compress = FlaskStaticCompress(app)

GAMES = {}  # Map of game name to JustOne object.
SESSIONS = {}  # Map of session id to [player name, JustOne game] tuple.

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<game_name>')
def show_game(game_name):
    canonical_game_name = get_canonical_game_name(game_name)
    if (canonical_game_name) is not None:
        return redirect('/{}'.format(canonical_game_name), code=302)
    g.game_name = game_name
    return render_template('game.html')

def get_canonical_game_name(game_name):
    for canonical_game_name in GAMES.keys():
        if canonical_game_name.lower() == game_name.lower() and canonical_game_name != game_name:
            return canonical_game_name
    return None

def make_game(game_name):
    game_ready_callback = partial(on_game_ready, game_name)
    clue_submitted_callback = partial(on_clue_submitted, game_name)
    guess_resolved_callback = partial(on_guess_resolved, game_name)
    return JustOne(game_name, game_ready_callback, clue_submitted_callback, guess_resolved_callback)

def get_game(game_name):
    if game_name not in GAMES:
        GAMES[game_name] = make_game(game_name)
    return GAMES[game_name]

def get_game_for_session(request):
    return SESSIONS[request.sid][1]

def notify_players_updated(game):
    player_list = list(game.players)
    player_list.sort()
    socketio.emit('players updated', \
        {'players': player_list, 'game_started': game.game_started}, include_self=True, to=game.game_name)

def on_game_ready(game_name, secret_word, guesser):
    game = get_game(game_name)
    socketio.emit('started', {'guesser': game.guesser, 'secret_word': game.secret_word}, to=game_name)
    on_clue_submitted(game_name, game.get_cluers(), game.clues)

def on_clue_submitted(game_name, cluers, clues):
    if len(cluers) == 0:
        return
    game = get_game(game_name)
    if not game.game_started:
        return
    cluers.sort()
    sorted_clues = []
    all_clues_submitted = True
    for cluer in cluers:
        if cluer not in clues:
            all_clues_submitted = False
            sorted_clues.append('')
        else:
            sorted_clues.append(clues[cluer])
    if all_clues_submitted:
        if game.approver is None:
            game.approver = choice(cluers) if len(cluers) > 0 else None
        socketio.emit('reveal clues', \
            {'players': cluers, 'clues': sorted_clues, 'approver': game.approver}, to=game_name)
    else:
        socketio.emit('clues updated', \
            {'players': cluers, 'clues': sorted_clues, \
             'guesser': game.guesser, 'secret_word': game.secret_word}, to=game_name)

def on_clues_approved(game_name, approved_clues):
    game = get_game(game_name)
    socketio.emit('guessing', \
        {'approved_clues': approved_clues, 'guesser': game.guesser}, include_sender=True, to=game_name)

def on_guess_resolved(game_name, guess, guesser, maybe_secret_word):
    correct = maybe_secret_word is None
    socketio.emit('guess resolved', \
        {'guesser': guesser, 'guess': guess, 'correct': correct, 'secret_word': maybe_secret_word}, to=game_name)

def garbage_collect_games():
    to_delete = set()
    for game in GAMES.items():
        if len(game[1].players) == 0:
            to_delete.add(game[0])
    for game_name in to_delete:
        del GAMES[game_name]

@socketio.on('join')
def handle_connected(data):
    user = data['user']
    game_name = data['game_name']
    join_room(game_name)
    game = get_game(game_name)
    game.add_player(user)
    if request.sid in SESSIONS:
        get_game_for_session(request).remove_player(user)
    SESSIONS[request.sid] = [user, game]
    notify_players_updated(game)
    if game.game_started:
        on_game_ready(game_name, game.secret_word, game.guesser)
    if len(game.approved_clues) > 0:
        on_clues_approved(game_name, game.approved_clues)

@socketio.on('name updated')
def handle_name_updated(data):
    old = data['old']
    new = data['new']
    SESSIONS[request.sid][0] = new
    game = get_game_for_session(request)
    game.remove_player(old)
    game.add_player(new)
    notify_players_updated(game)

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in SESSIONS:
        game = get_game_for_session(request)
        game.remove_player(SESSIONS[request.sid][0])
        del SESSIONS[request.sid]
        notify_players_updated(game)
        if game.game_started and len(game.approved_clues) == 0:
            on_clue_submitted(game.game_name, game.get_cluers(), game.clues)
    garbage_collect_games()

@socketio.on('start')
def handle_start(data):
    guesser = data['guesser']
    game_name = data['game_name']
    game = get_game(game_name)
    game.on_game_ready(guesser)

@socketio.on('end')
def handle_end(data):
    game_name = data['game_name']
    get_game(game_name).end()
    socketio.emit('ended', to=game_name)
    garbage_collect_games()

@socketio.on('submit clue')
def handle_submit_clue(data):
    game_name = data['game_name']
    cluer_name = data['cluer_name']
    clue = data['clue']
    game = get_game(game_name)
    game.add_clue(cluer_name, clue)

@socketio.on('unsubmit clue')
def handle_unsubmit_clue(data):
    game_name = data['game_name']
    cluer_name = data['cluer_name']
    game = get_game(game_name)
    game.remove_clue(cluer_name)

@socketio.on('clues approved')
def handle_clues_approved(data):
    approved_clues = data['approved_clues']
    game_name = data['game_name']
    game = get_game(game_name)
    game.approved_clues = approved_clues
    on_clues_approved(game_name, approved_clues)

@socketio.on('submit guess')
def handle_submit_guess(data):
    guess = data['guess']
    game_name = data['game_name']
    guesser = data['guesser']
    game = get_game(game_name)
    game.resolve_guess(guess, guesser)

if __name__ == '__main__':
    socketio.run(app, debug=False)