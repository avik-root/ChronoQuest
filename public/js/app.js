// Global State
const state = {
    username: null,
    currentRoom: null,
    currentMatch: null,
    myTeamId: null
};

// DOM Elements
const views = {
    login: document.getElementById('login-view'),
    lobby: document.getElementById('lobby-view'),
    room: document.getElementById('room-view'),
    game: document.getElementById('game-view')
};

const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnRegister = document.getElementById('btn-register');
const authMessage = document.getElementById('auth-message');
const roomListEl = document.getElementById('room-list');
const btnCreateRoom = document.getElementById('btn-create-room');
const joinCodeInput = document.getElementById('join-code');
const btnJoinCode = document.getElementById('btn-join-code');
const btnReady = document.getElementById('btn-ready');
const btnStart = document.getElementById('btn-start');
const btnFixAnomaly = document.getElementById('btn-fix-anomaly');
const btnBackLobby = document.getElementById('btn-back-lobby');
const hostControlsPanel = document.getElementById('host-controls');
const teamModeSelect = document.getElementById('team-mode-select');
const btnShuffle = document.getElementById('btn-shuffle');

// Initialize app
function init() {
    setupEventListeners();
    
    // Check for existing session
    const savedName = localStorage.getItem('chronoquest_user');
    const savedPass = localStorage.getItem('chronoquest_pass');
    if (savedName && savedPass) {
        // Auto-login
        usernameInput.value = savedName;
        passwordInput.value = savedPass;
        socketManager.loginUser(savedName, savedPass);
    }
}

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    btnRegister.addEventListener('click', handleRegister);
    
    btnCreateRoom.addEventListener('click', () => {
        socketManager.createRoom();
    });

    btnJoinCode.addEventListener('click', () => {
        const code = joinCodeInput.value.trim().toUpperCase();
        if (code.length === 6) socketManager.joinByCode(code);
    });

    teamModeSelect.addEventListener('change', (e) => {
        if (state.currentRoom) socketManager.setTeamMode(state.currentRoom.id, e.target.value);
    });

    btnShuffle.addEventListener('click', () => {
        if (state.currentRoom) socketManager.shuffleTeams(state.currentRoom.id);
    });

    btnReady.addEventListener('click', () => {
        if (state.currentRoom) {
            socketManager.toggleReady(state.currentRoom.id);
        }
    });

    btnStart.addEventListener('click', () => {
        if (state.currentRoom) {
            socketManager.startMatch(state.currentRoom.id);
        }
    });

    btnFixAnomaly.addEventListener('click', () => {
        if (state.currentMatch && state.myTeamId) {
            socketManager.sendProgress(state.currentMatch.roomId, state.myTeamId, 5);
        }
    });

    btnBackLobby.addEventListener('click', () => {
        document.getElementById('game-over-overlay').style.display = 'none';
        
        const statusText = document.getElementById('system-status');
        if (statusText) {
            statusText.innerText = 'SYSTEM STATUS: TIMELINE STABLE';
            statusText.className = 'status-nominal';
        }
        
        switchView('lobby');
    });

    // Logout logic
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('chronoquest_user');
            localStorage.removeItem('chronoquest_pass');
            state.username = null;
            state.currentRoom = null;
            state.currentMatch = null;
            state.myTeamId = null;
            usernameInput.value = '';
            passwordInput.value = '';
            switchView('login');
        });
    }
}

function handleLogin(e) {
    e.preventDefault();
    const name = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (name && pass) {
        socketManager.loginUser(name, pass);
    }
}

function handleRegister() {
    const name = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    
    // Password standard validation
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passRegex.test(pass)) {
        alert("Registration Failed:\nPassword must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.");
        return;
    }
    
    if (name && pass) {
        socketManager.registerUser(name, pass);
    }
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
}

// Global functions for inline HTML calls
window.joinTeam = function(teamId) {
    if (state.currentRoom) {
        socketManager.changeTeam(state.currentRoom.id, teamId);
    }
};

window.joinRoom = function(roomId) {
    socketManager.joinRoom(roomId);
};

window.kickPlayer = function(playerId) {
    if (state.currentRoom) socketManager.kickNode(state.currentRoom.id, playerId);
};

window.banPlayer = function(playerId) {
    if (state.currentRoom) socketManager.banNode(state.currentRoom.id, playerId);
};

// UI Render methods exposed for socket client
const uiManager = {
    renderLobby: (rooms) => {
        roomListEl.innerHTML = '';
        if (rooms.length === 0) {
            roomListEl.innerHTML = '<p class="text-muted">No active sessions found.</p>';
            return;
        }

        rooms.forEach(room => {
            const div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `
                <div>
                    <strong>${room.name}</strong>
                    <span class="text-muted" style="margin-left: 10px;">Host: ${room.host} | Players: ${room.playerCount}/20</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="joinRoom('${room.id}')">Join</button>
            `;
            roomListEl.appendChild(div);
        });
    },

    renderRoom: (roomData, socketId) => {
        state.currentRoom = roomData;
        document.getElementById('room-title').innerText = roomData.name;
        document.getElementById('room-code-display').innerText = roomData.code;

        // Render Teams
        [1, 2].forEach(teamId => {
            const teamBox = document.getElementById(`team-${teamId}-members`);
            teamBox.innerHTML = '';
            
            const teamMembers = roomData.teams[teamId]?.members || [];
            teamMembers.forEach(memberId => {
                const player = roomData.players.get ? roomData.players.get(memberId) : roomData.players[memberId];
                if (player) {
                    if (memberId === socketId) state.myTeamId = teamId;
                    
                    const div = document.createElement('div');
                    div.className = 'member-item';
                    
                    const isHost = roomData.host === socketId;
                    const notMe = memberId !== socketId;
                    const hostTools = isHost && notMe ? `
                        <div style="display:inline-block; margin-left:10px;">
                            <button class="kick-btn" onclick="kickPlayer('${memberId}')" title="Kick">🥾</button>
                            <button class="ban-btn" onclick="banPlayer('${memberId}')" title="Ban">🔨</button>
                        </div>
                    ` : '';

                    div.innerHTML = `
                        <span>${player.name} ${memberId === roomData.host ? '👑' : ''}</span>
                        <div>
                            <span class="${player.isReady ? 'status-ready' : 'status-waiting'}">
                                ${player.isReady ? 'READY' : 'WAITING'}
                            </span>
                            ${hostTools}
                        </div>
                    `;
                    teamBox.appendChild(div);
                }
            });
        });

        // Try getting my player info to set button text
        const me = roomData.players[socketId];
        if (me) {
            btnReady.innerText = me.isReady ? 'UNREADY' : 'READY UP';
            btnReady.className = me.isReady ? 'btn btn-secondary' : 'btn btn-primary';
        }

        // Host controls
        if (roomData.host === socketId) {
            btnStart.style.display = 'inline-block';
            hostControlsPanel.style.display = 'block';
            teamModeSelect.value = roomData.teamMode;
        } else {
            btnStart.style.display = 'none';
            hostControlsPanel.style.display = 'none';
        }

        switchView('room');
    },

    startGame: (matchData) => {
        state.currentMatch = matchData;
        
        // Reset progress bars
        document.getElementById('my-progress-fill').style.width = '0%';
        document.getElementById('enemy-progress-fill').style.width = '0%';
        document.getElementById('game-over-overlay').style.display = 'none';

        const statusText = document.getElementById('system-status');
        if (statusText) {
            statusText.innerText = 'CRITICAL ALERT: TIMELINE UNSTABLE';
            statusText.className = 'status-critical';
        }

        switchView('game');
    },

    updateGame: (matchData) => {
        state.currentMatch = matchData;
        
        const myTeam = matchData.teams[state.myTeamId];
        const enemyTeamId = state.myTeamId == 1 ? 2 : 1;
        const enemyTeam = matchData.teams[enemyTeamId];

        if (myTeam) {
            document.getElementById('my-progress-fill').style.width = `${myTeam.progress}%`;
        }
        if (enemyTeam) {
            document.getElementById('enemy-progress-fill').style.width = `${enemyTeam.progress}%`;
        }
    },

    endGame: (matchData) => {
        state.currentMatch = null;
        document.getElementById('game-over-text').innerText = 
            matchData.winner == state.myTeamId ? 'MISSION SUCCESS! TIMELINE STABILIZED!' : 'MISSION FAILED. TACHYON OVERLOAD.';
        document.getElementById('game-over-text').style.color = 
            matchData.winner == state.myTeamId ? 'var(--success)' : 'var(--danger)';
        document.getElementById('game-over-overlay').style.display = 'flex';

        const statusText = document.getElementById('system-status');
        if (statusText) {
            statusText.innerText = matchData.winner == state.myTeamId ? 'SYSTEM STATUS: TIMELINE STABILIZED' : 'CRITICAL ALERT: TIMELINE COLLAPSED';
            statusText.className = matchData.winner == state.myTeamId ? 'status-nominal' : 'status-critical';
        }
    }
};

// Start app
document.addEventListener('DOMContentLoaded', init);
