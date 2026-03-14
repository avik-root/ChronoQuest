class MatchEngine {
    constructor() {
        this.activeMatches = new Map(); // roomId -> matchState
    }

    startMatch(room) {
        const matchState = {
            roomId: room.id,
            startTime: Date.now(),
            teams: {},
            globalAnomalies: [],
            status: 'active'
        };

        // Initialize team states for the match
        for (const [teamId, teamData] of Object.entries(room.teams)) {
            if (teamData.members.length > 0) {
                matchState.teams[teamId] = {
                    progress: 0,
                    score: 0,
                    stability: 100,
                    currentTask: 'fix_timeline_node_1'
                };
            }
        }

        this.activeMatches.set(room.id, matchState);
        return matchState;
    }

    getMatch(roomId) {
        return this.activeMatches.get(roomId);
    }

    updateTeamProgress(roomId, teamId, progressDelta) {
        const match = this.getMatch(roomId);
        if (!match || match.status !== 'active') return;

        const team = match.teams[teamId];
        if (team) {
            team.progress += progressDelta;
            if (team.progress >= 100) {
                team.progress = 100;
                this.endMatch(roomId, teamId);
            }
        }
    }

    endMatch(roomId, winningTeamId) {
        const match = this.getMatch(roomId);
        if (match) {
            match.status = 'completed';
            match.winner = winningTeamId;
            match.endTime = Date.now();
            // In a real app, this should trigger a DB save to history.json
        }
    }
}

module.exports = new MatchEngine();
