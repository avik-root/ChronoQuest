const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // For development purposes
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Utils
const dbClient = require('./utils/dbClient');
const RoomManager = require('./game/RoomManager');
const MatchEngine = require('./game/MatchEngine');

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // ----- PING/PONG -----
    socket.on('ping', (callback) => {
        if (typeof callback === 'function') callback();
    });

    // ----- AUTH EVENTS -----
    socket.on('agent:register', async (data) => {
        try {
            const db = await dbClient.readJSON('accounts.json');
            if (db.users.find(u => u.username === data.username)) {
                return socket.emit('error', { message: 'Username already exists. Try logging in.' });
            }
            db.users.push({ username: data.username, password: data.password });
            await dbClient.writeJSON('accounts.json', db);
            socket.emit('agent:registered', { message: 'Account created successfully. Please Link now.' });
        } catch (e) {
            console.error(e);
            socket.emit('error', { message: 'Database error registering account.' });
        }
    });

    socket.on('agent:login', async (data) => {
        try {
            const db = await dbClient.readJSON('accounts.json');
            const user = db.users.find(u => u.username === data.username && u.password === data.password);
            
            if (user) {
                socket.username = user.username;
                socket.emit('agent:loggedIn', { username: user.username });
                socket.emit('lobby:rooms', RoomManager.getAllRooms());
            } else {
                socket.emit('error', { message: 'Invalid Agent Name or Password.' });
            }
        } catch (e) {
            console.error(e);
            socket.emit('error', { message: 'Database error reading account.' });
        }
    });

    socket.on('room:create', (data) => {
        console.log(`DEBUG [${socket.id}] EMITTED room:create`, data);
        const room = RoomManager.createRoom(socket.id, socket.username, data.name || `${socket.username}'s Room`);
        socket.join(room.id);
        io.emit('lobby:rooms', RoomManager.getAllRooms());
        socket.emit('room:joined', room);
    });

    socket.on('room:joinByCode', (code) => {
        console.log(`DEBUG [${socket.id}] EMITTED room:joinByCode WITH CODE:`, code);
        if (!socket.username) return;
        const room = RoomManager.getRoomByCode(code.toUpperCase());
        if (room && room.status === 'waiting') {
            if (RoomManager.checkBan(room, socket.username)) {
                return socket.emit('error', { message: 'You have been banned from this session.' });
            }
            RoomManager.addPlayerToRoom(room, socket.id, socket.username);
            RoomManager.assignTeam(room, socket.id, 1); // Default to Team 1
            socket.join(room.id);
            io.to(room.id).emit('room:update', room);
        } else {
            socket.emit('error', { message: 'Session code invalid or session full/started.' });
        }
    });

    socket.on('room:changeTeam', (data) => {
        const room = RoomManager.getRoom(data.roomId);
        if (room) {
            RoomManager.assignTeam(room, socket.id, data.teamId);
            io.to(data.roomId).emit('room:update', room);
        }
    });

    socket.on('room:ready', (data) => {
        const room = RoomManager.getRoom(data.roomId);
        if (room) {
            const player = room.players[socket.id];
            if (player) {
                player.isReady = !player.isReady;
                io.to(data.roomId).emit('room:update', room);
            }
        }
    });

    socket.on('match:start', (roomId) => {
        const room = RoomManager.getRoom(roomId);
        if (room && room.host === socket.id) {
            room.status = 'in_game';
            const match = MatchEngine.startMatch(room);
            io.to(roomId).emit('match:started', match);
            io.emit('lobby:rooms', RoomManager.getAllRooms());
        }
    });

    // ----- GAME EVENTS -----
    socket.on('game:progress', (data) => {
        const { roomId, teamId, amount } = data;
        MatchEngine.updateTeamProgress(roomId, teamId, amount);
        const match = MatchEngine.getMatch(roomId);
        if (match) {
            io.to(roomId).emit('game:update', match);
            if (match.status === 'completed') {
                io.to(roomId).emit('game:over', match);
            }
        }
    });

    // ----- HOST ACTIONS -----
    socket.on('room:kick', (data) => {
        const room = RoomManager.getRoom(data.roomId);
        if (room && room.host === socket.id && data.targetId !== socket.id) {
            const kickedName = RoomManager.kickPlayer(room, data.targetId, false);
            if (kickedName) {
                io.to(data.targetId).emit('room:kicked', { message: 'You were kicked from the session.' });
                const targetSocket = io.sockets.sockets.get(data.targetId);
                if (targetSocket) targetSocket.leave(data.roomId);
                
                io.to(data.roomId).emit('room:update', room);
                io.emit('lobby:rooms', RoomManager.getAllRooms());
            }
        }
    });

    socket.on('room:ban', (data) => {
        const room = RoomManager.getRoom(data.roomId);
        if (room && room.host === socket.id && data.targetId !== socket.id) {
            const bannedName = RoomManager.kickPlayer(room, data.targetId, true);
            if (bannedName) {
                io.to(data.targetId).emit('room:kicked', { message: 'You have been BANNED from the session.' });
                const targetSocket = io.sockets.sockets.get(data.targetId);
                if (targetSocket) targetSocket.leave(data.roomId);
                
                io.to(data.roomId).emit('room:update', room);
                io.emit('lobby:rooms', RoomManager.getAllRooms());
            }
        }
    });

    socket.on('room:setTeamMode', (data) => {
        const room = RoomManager.getRoom(data.roomId);
        if (room && room.host === socket.id) {
            RoomManager.setTeamMode(room, data.mode);
            io.to(data.roomId).emit('room:update', room);
        }
    });

    socket.on('room:shuffleTeams', (data) => {
        const room = RoomManager.getRoom(data.roomId);
        if (room && room.host === socket.id) {
            RoomManager.shuffleTeams(room);
            io.to(data.roomId).emit('room:update', room);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Handle removing user from rooms if they disconnect
        for (const [roomId, room] of RoomManager.rooms.entries()) {
            if (room.players[socket.id]) {
                const player = room.players[socket.id];
                if (player.teamId) {
                    const team = room.teams[player.teamId];
                    team.members = team.members.filter(id => id !== socket.id);
                }
                delete room.players[socket.id];
                // If host leaves, handle room destruction or migration (simplified: notify others)
                io.to(roomId).emit('room:update', room);
                if (Object.keys(room.players).length === 0) {
                    RoomManager.rooms.delete(roomId);
                }
                io.emit('lobby:rooms', RoomManager.getAllRooms());
            }
        }
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`ChronoQuest Server running on port ${PORT}`);
});
