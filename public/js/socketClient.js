const socket = io();

const socketManager = {
    loginUser: (username, password) => {
        socket.emit('agent:login', { username, password });
    },

    registerUser: (username, password) => {
        socket.emit('agent:register', { username, password });
    },
    
    createRoom: () => {
        socket.emit('room:create', { name: `${state.username}'s Session` });
    },

    joinByCode: (code) => {
        socket.emit('room:joinByCode', code);
    },

    joinRoom: (roomId) => {
        socket.emit('room:join', roomId);
    },

    kickNode: (roomId, targetId) => {
        socket.emit('room:kick', { roomId, targetId });
    },

    banNode: (roomId, targetId) => {
        socket.emit('room:ban', { roomId, targetId });
    },

    shuffleTeams: (roomId) => {
        socket.emit('room:shuffleTeams', { roomId });
    },

    setTeamMode: (roomId, mode) => {
        socket.emit('room:setTeamMode', { roomId, mode });
    },

    changeTeam: (roomId, teamId) => {
        socket.emit('room:changeTeam', { roomId, teamId });
    },

    toggleReady: (roomId) => {
        socket.emit('room:ready', { roomId });
    },

    startMatch: (roomId) => {
        socket.emit('match:start', roomId);
    },

    sendProgress: (roomId, teamId, amount) => {
        socket.emit('game:progress', { roomId, teamId, amount });
    }
};

// Event Listeners
socket.on('connect', () => {
    console.log('Connected to ChronoQuest Core Server.');
});

socket.on('disconnect', () => {
    console.warn('Disconnected from server. Retrying...');
});

// Auth Events
socket.on('agent:registered', (data) => {
    const msgEl = document.getElementById('auth-message');
    if (msgEl) {
        msgEl.innerText = data.message;
        msgEl.className = 'text-success';
        msgEl.style.color = 'var(--success)';
    }
});

socket.on('agent:loggedIn', (data) => {
    state.username = data.username;
    
    // Save credentials (this would normally be a token, but we are using plaintext for dev)
    const name = document.getElementById('username')?.value;
    const pass = document.getElementById('password')?.value;
    if (name && pass) {
        localStorage.setItem('chronoquest_user', name);
        localStorage.setItem('chronoquest_pass', pass);
    }
    
    if (typeof switchView !== 'undefined') switchView('lobby');
});

// Lobby Events
socket.on('lobby:rooms', (roomList) => {
    if (typeof uiManager !== 'undefined') uiManager.renderLobby(roomList);
});

socket.on('room:joined', (roomData) => {
    if (typeof uiManager !== 'undefined') uiManager.renderRoom(roomData, socket.id);
});

socket.on('room:update', (roomData) => {
    if (typeof uiManager !== 'undefined') uiManager.renderRoom(roomData, socket.id);
});

socket.on('room:kicked', (data) => {
    alert(`DISCONNECTED: ${data.message}`);
    state.currentRoom = null;
    state.myTeamId = null;
    if (typeof switchView !== 'undefined') switchView('lobby');
});

// Game Events
socket.on('match:started', (matchData) => {
    if (typeof uiManager !== 'undefined') uiManager.startGame(matchData);
});

socket.on('game:update', (matchData) => {
    if (typeof uiManager !== 'undefined') uiManager.updateGame(matchData);
});

socket.on('game:over', (matchData) => {
    if (typeof uiManager !== 'undefined') uiManager.endGame(matchData);
});

socket.on('error', (err) => {
    const authMsg = document.getElementById('auth-message');
    if (authMsg && document.getElementById('login-view').classList.contains('active')) {
        authMsg.innerText = err.message;
        authMsg.style.color = 'var(--danger)';
    } else {
        alert(`System Error: ${err.message}`);
    }
});

// Ping Interval
setInterval(() => {
    const start = Date.now();
    socket.emit('ping', () => {
        const latency = Date.now() - start;
        const pingDisplay = document.getElementById('ping-display');
        if (pingDisplay) pingDisplay.innerText = `Ping: ${latency} ms`;
    });
}, 2000);
