class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> roomData
    }

    createRoom(hostId, hostName, roomName, isPrivate = false, password = '') {
        const roomId = this.generateRoomId();
        const roomCode = this.generateRoomCode();
        const room = {
            id: roomId,
            code: roomCode,
            name: roomName,
            host: hostId,
            isPrivate,
            password,
            teamMode: 'choose', // 'choose' or 'shuffle'
            banned: [],
            teams: this.initializeTeams(10),
            status: 'waiting', // waiting, starting, in_game
            players: {} // socketId -> { name, teamId, isReady, role }
        };

        // Add host to Team 1
        this.addPlayerToRoom(room, hostId, hostName);
        this.assignTeam(room, hostId, 1);

        this.rooms.set(roomId, room);
        return room;
    }

    initializeTeams(count) {
        const teams = {};
        for (let i = 1; i <= count; i++) {
            teams[i] = {
                id: i,
                name: `Team ${i}`,
                members: [], // max 2
                isLocked: false
            };
        }
        return teams;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getAllRooms() {
        // Return room info but only for waiting/public ones (unless getting all codes)
        const publicRooms = [];
        for (const [id, room] of this.rooms.entries()) {
            if (room.status === 'waiting' && !room.isPrivate) {
                publicRooms.push({
                    id: room.id,
                    code: room.code,
                    name: room.name,
                    playerCount: Object.keys(room.players).length,
                    host: room.players[room.host]?.name
                });
            }
        }
        return publicRooms;
    }

    getRoomByCode(code) {
        for (const [id, room] of this.rooms.entries()) {
            if (room.code === code) return room;
        }
        return null;
    }

    checkBan(room, playerName) {
        return room.banned.includes(playerName);
    }

    kickPlayer(room, playerId, ban = false) {
        const player = room.players[playerId];
        if (player) {
            if (ban && !room.banned.includes(player.name)) room.banned.push(player.name);
            if (player.teamId) {
                const team = room.teams[player.teamId];
                team.members = team.members.filter(id => id !== playerId);
            }
            delete room.players[playerId];
            return player.name;
        }
        return null;
    }

    shuffleTeams(room) {
        if (room.teamMode !== 'shuffle') return;

        // Collect all non-host players
        const allPlayers = Object.keys(room.players);
        
        // Randomize
        let m = allPlayers.length, t, i;
        while (m) {
            i = Math.floor(Math.random() * m--);
            t = allPlayers[m];
            allPlayers[m] = allPlayers[i];
            allPlayers[i] = t;
        }

        // Clear teams
        for (const id of Object.keys(room.teams)) {
            room.teams[id].members = [];
        }

        // Reassign uniformly
        let teamIdx = 1;
        let c = 0;
        for (const pid of allPlayers) {
            if (room.teams[teamIdx].members.length >= 2) {
                teamIdx++;
            }
            if (teamIdx > Object.keys(room.teams).length) break;
            room.teams[teamIdx].members.push(pid);
            room.players[pid].teamId = teamIdx;
            c++;
        }
    }

    setTeamMode(room, mode) {
        if (mode === 'shuffle' || mode === 'choose') {
            room.teamMode = mode;
        }
    }

    addPlayerToRoom(room, playerId, playerName) {
        room.players[playerId] = {
            name: playerName,
            teamId: null,
            isReady: false,
            role: null
        };
    }

    assignTeam(room, playerId, teamId) {
        const player = room.players[playerId];
        if (!player) return false;

        // Remove from current team if any
        if (player.teamId) {
            const oldTeam = room.teams[player.teamId];
            oldTeam.members = oldTeam.members.filter(id => id !== playerId);
        }

        // Add to new team
        const newTeam = room.teams[teamId];
        if (newTeam && newTeam.members.length < 2 && !newTeam.isLocked) {
            newTeam.members.push(playerId);
            player.teamId = teamId;
            return true;
        }
        return false;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    generateRoomCode() {
        // Generate a unique 6 Character string code for joining
        let code;
        let isUnique = false;
        
        while (!isUnique) {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
            // Check against existing rooms
            let exists = false;
            for (const room of this.rooms.values()) {
                if (room.code === code) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                isUnique = true;
            }
        }
        
        return code;
    }
}

module.exports = new RoomManager();
