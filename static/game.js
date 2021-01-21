const game_name = location.pathname.substr(1);
var game_started = false;
var clues_submitted = false;
var is_guesser = false;

// Get name from cookie
function getName() {
    const value = `; ${document.cookie}`;
    const parts = value.split('; name=');
    var name = Math.random().toString().slice(2, 10);
    if (parts.length === 2)
        name = parts.pop().split(';').shift();
    setNameCookie(name);
    return name;
}

function setNameCookie(name) {
    document.cookie = `name=${name}; max-age=2592000`
}

function updateName() {
    const name = document.getElementById('txtName').value;
    socket.emit('name updated', {old: getName(), new: name});
    setNameCookie(name);
}

function playNotification() {
    if (!getNotifyPref()) return;
    var audio = document.getElementById('audio');
    audio.play();
}

// Get notification preference from cookie
function getNotifyPref() {
    const value = `; ${document.cookie}`;
    const parts = value.split('; notify=');
    var notify = '0';
    if (parts.length === 2)
        notify = parts.pop().split(';').shift();
    return notify === '1';
}

function setNotifyPref(notify) {
    document.cookie = `notify=${notify ? '1' : '0'}; max-age=2592000`;
}

document.addEventListener('DOMContentLoaded', () => {
    var txtName = document.getElementById('txtName');
    txtName.value = getName();
    txtName.addEventListener('keyup', (e) => {
        const btnUpdateName = document.getElementById('btnUpdateName');
        btnUpdateName.disabled = !txtName.value;
        if (e.keyCode === 13) {
            e.preventDefault();
            btnUpdateName.click();
        }
    });
    var txtClue = document.getElementById('txtClue');
    txtClue.addEventListener('keyup', (e) => {
        const btnSubmitClue = document.getElementById('btnSubmitClue');
        btnSubmitClue.disabled = !txtClue.value;
        btnSubmitClue.hidden = !txtClue.value;
        const btnUnsubmitClue = document.getElementById('btnUnsubmitClue');
        btnUnsubmitClue.hidden = !btnSubmitClue.hidden;
        if (e.keyCode === 13) {
            e.preventDefault();
            btnSubmitClue.click();
        }
    });
    var txtGuess = document.getElementById('txtGuess');
    txtGuess.addEventListener('keyup', (e) => {
        const btnSubmitGuess = document.getElementById('btnSubmitGuess');
        btnSubmitGuess.disabled = !txtGuess.value;
        if (e.keyCode === 13) {
            e.preventDefault();
            btnSubmitGuess.click();
        }
    });
    var chkNotify = document.getElementById('chkNotify');
    chkNotify.checked = getNotifyPref();
    chkNotify.addEventListener('click', (e) => {
        setNotifyPref(chkNotify.checked);
    });
});

var socket = io();
socket.on('connect', () => {
    socket.emit('join', {user: getName(), game_name: game_name});
    document.title = game_name;
    document.querySelector('h2').innerHTML = `Game: ${game_name}`;
    document.body.style.background = 'White';
});

socket.on('disconnect', () => {
    document.title = `[DISCONNECTED]`;
    document.querySelector('h2').innerHTML = '[DISCONNECTED]';
    document.body.style.background = 'LightGray';
});

function updateStartButtonDisabledState() {
    var radios = document.getElementsByName('player');
    document.getElementById('btnStart').disabled = game_started || !getGuesser() || (radios.length < 2);
}

socket.on('players updated', (data) => {
    game_started = data.game_started;
    document.getElementById('btnEnd').disabled = !game_started;
    var dispList = document.getElementById('playerList');
    dispList.innerHTML = '';
    data.players.forEach((player, index) => {
        var radio = document.createElement('input');
        radio.setAttribute('type', 'radio');
        radio.setAttribute('name', 'player');
        const id = `player_${index}`;
        radio.setAttribute('id', id);
        radio.setAttribute('value', player);
        radio.onclick = updateStartButtonDisabledState;
        dispList.appendChild(radio);
        var label = document.createElement('label');
        label.setAttribute('for', id);
        label.innerHTML = player;
        dispList.appendChild(label);
        var br = document.createElement('br');
        dispList.appendChild(br);
    })
    updateStartButtonDisabledState();
    disablePlayerRadios();
});

function checkGuesserRadio(guesser) {
    if (!game_started)
        return;
    var radios = document.getElementsByName('player');
    for (var i = 0, length = radios.length; i < length; ++i) {
        radios[i].checked = radios[i].value === guesser;
    }
}

function getGuesser() {
    var radios = document.getElementsByName('player');
    for (var i = 0, length = radios.length; i < length; ++i) {
        if (radios[i].checked)
            return radios[i].value;
    }
}

function disablePlayerRadios() {
    if (!game_started)
        return;
    var radios = document.getElementsByName('player');
    radios.forEach(radio => radio.disabled = true);
}

function end() {
    socket.emit('end', {game_name: game_name});
}

socket.on('ended', () => {
    window.scrollTo(0, 0);
    location.reload();
});

function start() {
    socket.emit('start', {guesser: getGuesser(), game_name: game_name});
}

function displayGameInfo(secret_word, guesser) {
    var disp = `Give a clue to <span style="background-color:Violet">${guesser}</span> for the secret word:<div style="text-align:center;background-color:LightGreen;width:min(100%,500px)">${secret_word}</div>`;
    if (getName() === guesser) {
        is_guesser = true;
        disp = '<div style="text-align:center;background-color:Violet;width:min(100%,500px)">You are the guesser!</div>';
    }
    document.getElementById('gameInfo').innerHTML = disp;
    document.getElementById('gameInfo').scrollIntoView(true);

    if (!is_guesser) {
        document.getElementById('txtClue').hidden = false;
        document.getElementById('btnSubmitClue').hidden = !document.getElementById('btnUnsubmitClue').hidden;
    }
}

socket.on('started', (data) => {
    game_started = true;
    document.getElementById('btnUpdateName').disabled = true;
    document.getElementById('txtName').disabled = true;
    document.getElementById('guesserStatus').innerHTML = `${data.guesser} is the guesser.`;
    checkGuesserRadio(data.guesser);
    disablePlayerRadios();
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnEnd').disabled = false;
    displayGameInfo(data.secret_word, data.guesser);
});

function submitClue() {
    var clue_word = document.getElementById('txtClue').value;
    socket.emit('submit clue', {cluer_name: getName(), clue: clue_word, game_name: game_name});
    document.getElementById('btnSubmitClue').hidden = true;
    document.getElementById('btnUnsubmitClue').hidden = false;
}

function unsubmitClue() {
    socket.emit('unsubmit clue', {cluer_name: getName(), game_name: game_name});
    document.getElementById('btnSubmitClue').hidden = false;
    document.getElementById('btnSubmitClue').disabled = true;
    document.getElementById('txtClue').value = '';
    document.getElementById('btnUnsubmitClue').hidden = true;
}

function displayCluesTable(players, clues, hide_clues) {
    const num_players = players.length;
    var e = document.getElementById('clueTable');
    e.innerHTML = '';
    for (var i = 0; i < num_players; ++i) {
        let row = e.insertRow();
        let player_cell = row.insertCell();
        let player_text = document.createTextNode(players[i]);
        player_cell.append(player_text);
        let clue_cell = row.insertCell();
        let clue = clues[i] ? (hide_clues ? '✅ submitted' : '✏️ ' + clues[i]) : '📝 waiting...';
        if (players[i] === getName() && clues[i] && hide_clues)
            clue = `${clue}: ${clues[i]}`
        let clue_text = document.createTextNode(clue);
        clue_cell.append(clue_text);
    }
}

socket.on('clues updated', (data) => {
    if (clues_submitted) {
        document.getElementById('btnSubmitApprovedClues').hidden = true;
        document.getElementById('approvingTable').innerHTML = '';
        document.getElementById('approvingStatus').innerHTML = '';
        clues_submitted = false;
    }
    displayCluesTable(data.players, data.clues, true);
    displayGameInfo(data.secret_word, data.guesser);
});

socket.on('reveal clues', (data) => {
    clues_submitted = true;
    displayCluesTable(data.players, data.clues, is_guesser);
    if (!data.approver || !data.players.includes(data.approver))
        socket.emit('clues approved', {approved_clues: data.clues, game_name: game_name});
    const is_approver = data.approver === getName();
    document.getElementById('approvingStatus').innerHTML =
        is_approver ? 'Please approve clues:' : `${data.approver} is approving clues...`;
    if (is_approver) {
        playNotification();
        displayApprovingTable(data.clues.sort((a, b) => {
            return a.localeCompare(b, 'en', {sensitivity: 'base'});
        }));
        document.getElementById('approvingStatus').scrollIntoView(true);
    }
    document.getElementById('btnSubmitClue').hidden = true;
    document.getElementById('btnUnsubmitClue').hidden = true;
    document.getElementById('txtClue').disabled = true;
})

function displayApprovingTable(clues) {
    document.getElementById('btnSubmitApprovedClues').hidden = false;
    var dispList = document.getElementById('approvingTable');
    dispList.innerHTML = '';
    clues.forEach((clue, index) => {
        var checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.setAttribute('name', 'clue');
        const id = `clue_${index}`;
        checkbox.setAttribute('id', id);
        checkbox.setAttribute('value', clue);
        const unique = (index === 0 || clues[index - 1].toLowerCase() != clue.toLowerCase()) &&
                       (index === clues.length - 1 || clues[index + 1].toLowerCase() != clue.toLowerCase());
        checkbox.checked = unique;
        var label = document.createElement('label');
        label.setAttribute('for', id);
        label.innerHTML = clue;
        checkbox.onclick = () => strikeClue(checkbox, label);
        dispList.appendChild(checkbox);
        dispList.appendChild(label);
        strikeClue(checkbox, label);
        var br = document.createElement('br');
        dispList.appendChild(br);
    });
}

function strikeClue(checkbox, label) {
    label.style.textDecorationLine = checkbox.checked ? 'none' : 'line-through';
}

function submitApprovedClues() {
    const checkboxes = Array.from(document.getElementsByName('clue'));
    const approved_clues = checkboxes.filter(c => c.checked).map(c => c.value);
    approved_clues.sort((a, b) => {
        return a.localeCompare(b, 'en', {sensitivity: 'base'});
    });
    socket.emit('clues approved', {approved_clues: approved_clues, game_name: game_name});
}

socket.on('guessing', (data) => {
    document.getElementById('approvingStatus').innerHTML = 'Approved clues:';
    document.getElementById('approvingStatus').scrollIntoView(true);
    document.getElementById('btnSubmitApprovedClues').hidden = true;
    document.getElementById('clueTable').hidden = true;
    const clue_list = document.getElementById('approvingTable');
    clue_list.innerHTML = '';
    const ul = document.createElement('ul');
    data.approved_clues.forEach((clue) => {
        const li = document.createElement('li');
        li.innerHTML = clue;
        ul.appendChild(li);
    });
    clue_list.appendChild(ul);

    is_guesser = data.guesser === getName();
    if (is_guesser) {
        playNotification();
        document.getElementById('gameInfo').innerHTML = '<div style="text-align:center;background-color:Violet;width:min(100%,500px)">You are the guesser!</div>';
        document.getElementById('txtGuess').scrollIntoView(true);
        document.getElementById('txtGuess').hidden = false;
        document.getElementById('btnSubmitGuess').hidden = false;
    }
});

function submitGuess() {
    var guess_word = document.getElementById('txtGuess').value;
    socket.emit('submit guess', {guess: guess_word, guesser: getName(), game_name: game_name});
    document.getElementById('btnSubmitGuess').disabled = true;
}

socket.on('guess resolved', (data) => {
    const correct_string = data.correct ? 'correct!' : `not correct. The word was "${data.secret_word}".`;
    const disp = `${data.correct ? '✔️' : '❌'} ${data.guesser} guessed "${data.guess}", which is ${correct_string}`;
    document.getElementById('gameOutcome').innerHTML = disp;
    document.getElementById('btnNewRound').hidden = false;
});
