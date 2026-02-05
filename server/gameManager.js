import { v4 as uuidv4 } from 'uuid';
import { WORD_PAIRS } from './words.js';

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> roomState
    }

    createRoom(hostName, socketId) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const player = {
            id: socketId,
            name: hostName,
            isHost: true,
            role: null,
            word: null,
            isAlive: true,
            avatar: Math.floor(Math.random() * 10)
        };

        const roomState = {
            id: roomId,
            players: [player],
            status: 'LOBBY', // LOBBY, PLAYING, VOTING, GAMEOVER
            phase: null, // DESCRIPTION, VOTING
            currentTurnIndex: 0,
            descriptions: [],
            votes: {},
            aiPlayers: [], // Future proofing
            wordPair: null,
            round: 1,
            winners: null,
            skippedCount: 0,
            previousRounds: []
        };

        this.rooms.set(roomId, roomState);
        return roomId;
    }

    joinRoom(roomId, playerName, socketId) {
        roomId = roomId.toUpperCase(); // Case insensitive
        const room = this.rooms.get(roomId);
        if (!room) return { error: "Room not found" };
        if (room.status !== 'LOBBY' && room.status !== 'GAMEOVER') return { error: "Game already started" };
        if (room.players.find(p => p.name === playerName)) return { error: "Name taken" };

        const player = {
            id: socketId,
            name: playerName,
            isHost: false,
            role: null,
            word: null,
            isAlive: true,
            inLobby: true, // New joiners always in lobby view
            avatar: Math.floor(Math.random() * 10)
        };

        room.players.push(player);
        return { room };
    }

    rejoinGame(roomId, playerName, newSocketId) {
        roomId = roomId.toUpperCase(); // Case insensitive
        const room = this.rooms.get(roomId);
        if (!room) return { error: "Room not found" };

        const player = room.players.find(p => p.name === playerName);
        if (!player) return { error: "Player not found in this room" };

        const oldId = player.id;
        player.id = newSocketId;
        player.isAlive = true; // Mark as alive if they were marked dead by disconnect (optional choice)

        // MIGRATE VOTES (If in Voting phase)
        // This prevents crashes where a vote targets an Old Socket ID that no longer exists in players array
        if (room.votes) {
            const newVotes = {};
            for (const [voterId, targetId] of Object.entries(room.votes)) {
                const newVoterId = (voterId === oldId) ? newSocketId : voterId;
                const newTargetId = (targetId === oldId) ? newSocketId : targetId;
                newVotes[newVoterId] = newTargetId;
            }
            room.votes = newVotes;
        }

        return { room, player };
    }

    startGame(roomId, config) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.players.length < 3) return { error: "Need at least 3 players" };

        // Assign Roles
        const players = room.players;
        const playerCount = players.length;

        let undercoverCount = config?.ucCount !== undefined ? config.ucCount : 1;
        let mrWhiteCount = config?.mrWhiteCount !== undefined ? config.mrWhiteCount : 0;

        // Validation (basic)
        if (undercoverCount + mrWhiteCount >= playerCount) {
            // Fallback if config is broken
            undercoverCount = 1;
            mrWhiteCount = 0;
        }

        const roles = [];
        for (let i = 0; i < undercoverCount; i++) roles.push('UNDERCOVER');
        for (let i = 0; i < mrWhiteCount; i++) roles.push('MR_WHITE');
        while (roles.length < playerCount) roles.push('CIVILIAN');

        // Shuffle roles
        roles.sort(() => Math.random() - 0.5);

        // Pick words
        const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
        // Randomize which word is Civilian vs Undercover to avoid pattern
        const swap = Math.random() > 0.5;
        const civilianWord = swap ? pair[0] : pair[1];
        const undercoverWord = swap ? pair[1] : pair[0];

        // Assign to players
        players.forEach((p, index) => {
            p.role = roles[index];
            p.isAlive = true;
            if (p.role === 'CIVILIAN') p.word = civilianWord;
            else if (p.role === 'UNDERCOVER') p.word = undercoverWord;
            else p.word = null; // Mr. White
            p.inLobby = false; // Reset for everyone
        });

        // Randomize turn order for the game
        const startPlayerIndex = Math.floor(Math.random() * players.length);

        room.status = 'PLAYING';
        room.phase = 'DESCRIPTION';
        room.currentTurnIndex = startPlayerIndex;
        room.wordPair = pair;
        room.descriptions = [];
        room.turnOrder = this.getAlivePlayersIndices(room, startPlayerIndex);
        room.config = config; // Store config for UI (role hiding)

        this.io.to(roomId).emit('game_started', {
            status: room.status,
            phase: room.phase,
            currentTurn: room.players[room.turnOrder[0]].id
        });
        this.io.to(roomId).emit('full_sync', { room }); // ATOMIC SYNC: Replaces room_update

        // Send individual info
        players.forEach(p => {
            this.io.to(p.id).emit('your_info', {
                role: p.role,
                word: p.word
            });
        });

        return room;
    }

    rerollWords(roomId, hostId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: "Room not found" };

        const host = room.players.find(p => p.id === hostId);
        if (!host || !host.isHost) return { error: "Only host can reshuffle" };

        if (room.status !== 'PLAYING') return { error: "Game not in progress" };

        // Logic similar to startGame word picking
        const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
        const swap = Math.random() > 0.5;
        const civilianWord = swap ? pair[0] : pair[1];
        const undercoverWord = swap ? pair[1] : pair[0];

        // Update words for everyone based on EXISTING roles
        room.players.forEach(p => {
            if (p.role === 'CIVILIAN') p.word = civilianWord;
            else if (p.role === 'UNDERCOVER') p.word = undercoverWord;
            // Mr. White stays null
        });

        // FULL RESTART LOGIC
        room.wordPair = pair;
        room.descriptions = []; // Reset descriptions
        room.votes = {}; // Clear votes
        room.phase = 'DESCRIPTION';
        room.round = 1; // Reset round
        room.previousRounds = []; // Clear history
        room.skippedCount = 0;

        // Randomize turn order again for fairness
        const startPlayerIndex = Math.floor(Math.random() * room.players.length);
        room.currentTurnIndex = startPlayerIndex;
        room.turnOrder = this.getAlivePlayersIndices(room, startPlayerIndex);

        // 1. Send Individual Info update
        room.players.forEach(p => {
            this.io.to(p.id).emit('your_info', {
                role: p.role,
                word: p.word
            });
        });

        // 2. Notify Room (Clears feed, resets round)
        // We use full_sync to ensure client gets the 'round: 1' and empty history
        this.io.to(roomId).emit('full_sync', { room });

        // Also emit specific events for UI triggers
        this.io.to(roomId).emit('game_started', {
            status: room.status,
            phase: room.phase,
            currentTurn: room.players[room.turnOrder[0]].id
        });

        this.io.to(roomId).emit('notification', { message: "🔄 Host re-rolled! New words, new game!" });

        return { success: true };
    }

    getAlivePlayersIndices(room, startIndex = 0) {
        const indices = [];
        for (let i = 0; i < room.players.length; i++) {
            const idx = (startIndex + i) % room.players.length;
            if (room.players[idx].isAlive) {
                indices.push(idx);
            }
        }
        return indices;
    }

    submitDescription(roomId, playerId, description) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const currentPlayerIdx = room.turnOrder[0];
        if (currentPlayerIdx === undefined) return; // Safety

        const currentPlayer = room.players[currentPlayerIdx];

        const sender = room.players.find(p => p.id === playerId);
        if (!sender) return; // Ignore if sender not in room

        // Validate turn: Check ID OR Name (handle rejoin edge cases)
        if (currentPlayer.id !== playerId && currentPlayer.name !== sender.name) return { error: "Not your turn" };

        room.descriptions.push({
            playerId,
            name: currentPlayer.name,
            text: description
        });

        // Advance turn
        room.turnOrder.shift(); // Remove current player from head

        if (room.turnOrder.length === 0) {
            // Round of descriptions over
            room.phase = 'VOTING';
            room.votes = {};
            this.io.to(roomId).emit('phase_change', { phase: 'VOTING' });
            this.io.to(roomId).emit('room_update', room); // SYNC APP STATE (Prevent reversion)
        } else {
            room.currentTurnIndex = room.turnOrder[0]; // Update for state sync
            this.io.to(roomId).emit('next_turn', { currentTurn: room.players[room.currentTurnIndex].id });
            this.io.to(roomId).emit('full_sync', { room }); // ATOMIC SYNC: Ensure mobile gets the update
        }

        this.io.to(roomId).emit('update_descriptions', room.descriptions);
    }

    submitVote(roomId, voterId, targetId) {
        const room = this.rooms.get(roomId);
        if (!room || room.phase !== 'VOTING') return;

        // Check if voter is alive
        const voter = room.players.find(p => p.id === voterId);
        if (!voter || !voter.isAlive) return;

        // Check if already voted
        if (room.votes[voterId]) return;

        // Record vote
        room.votes[voterId] = targetId;

        // Check if all alive players voted
        const aliveCount = room.players.filter(p => p.isAlive).length;
        const votesCast = Object.keys(room.votes).length;

        this.io.to(roomId).emit('update_votes', {
            count: votesCast,
            total: aliveCount,
            votes: room.votes // Send who has voted
        });
        this.io.to(roomId).emit('full_sync', { room }); // ATOMIC SYNC
        this.io.to(voterId).emit('vote_confirmed', { targetId }); // Feedback to user

        if (votesCast >= aliveCount) {
            this.resolveVoting(roomId);
        }
    }

    resolveVoting(roomId) {
        const room = this.rooms.get(roomId);

        // Tally votes
        const voteCounts = {};
        let skipCount = 0;

        Object.values(room.votes).forEach(targetId => {
            if (targetId === 'SKIP') {
                skipCount++;
            } else {
                voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
            }
        });

        // Find max
        let maxVotes = 0;
        let eliminatedId = null;
        let tie = false;

        Object.entries(voteCounts).forEach(([id, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                eliminatedId = id;
                tie = false;
            } else if (count === maxVotes) {
                tie = true;
            }
        });

        // Logic: Skip leads if skipCount >= maxVotes (skip wins ties)
        if (skipCount >= maxVotes && skipCount > 0) {
            this.io.to(roomId).emit('voting_result', { result: 'Skipped', eliminated: null });
        } else if (tie) {
            this.io.to(roomId).emit('voting_result', { result: 'Tie', eliminated: null });
        } else {
            const eliminatedPlayer = room.players.find(p => p.id === eliminatedId);

            if (!eliminatedPlayer) {
                console.error(`CRITICAL: Eliminated player not found! ID: ${eliminatedId}. Skipping elimination.`);
                this.io.to(roomId).emit('voting_result', { result: 'Skipped', eliminated: null });
            } else {
                eliminatedPlayer.isAlive = false;
                this.io.to(roomId).emit('voting_result', {
                    result: 'Eliminated',
                    eliminated: { name: eliminatedPlayer.name, role: eliminatedPlayer.role }
                });
                this.io.to(roomId).emit('room_update', room); // Sync dead status
            }
        }

        // Check Win Condition
        const winner = this.checkWinCondition(room);
        if (winner) {
            room.status = 'GAMEOVER';
            room.winners = winner;
            this.io.to(roomId).emit('game_over', { winners: winner, allRoles: room.players });
        } else {
            // Start next round
            // 0. Archive descriptions to history
            if (room.descriptions.length > 0) {
                room.previousRounds.push([...room.descriptions]);
            }

            // Reset descriptions and votes
            room.phase = 'DESCRIPTION';
            room.descriptions = [];
            room.votes = {};
            room.round++;

            // Next starting player is next alive player after the one who started last time
            // Simple rotation: Just get all alive players
            room.turnOrder = this.getAlivePlayersIndices(room, (room.currentTurnIndex + 1) % room.players.length);
            room.currentTurnIndex = room.turnOrder[0]; // Update for next round logic

            // Delay slightly for UI to show voting result
            setTimeout(() => {
                this.io.to(roomId).emit('full_sync', { room }); // SYNC HISTORY & STATE
                this.io.to(roomId).emit('new_round', {
                    phase: 'DESCRIPTION',
                    currentTurn: room.players[room.currentTurnIndex].id
                });
            }, 5000);
        }
    }

    checkWinCondition(room) {
        const aliveCivilians = room.players.filter(p => p.isAlive && p.role === 'CIVILIAN').length;
        const aliveUndercovers = room.players.filter(p => p.isAlive && (p.role === 'UNDERCOVER' || p.role === 'MR_WHITE')).length;

        if (aliveUndercovers === 0) {
            return 'CIVILIANS';
        }
        // Undercovers win if they equal or outnumber civilians (standard rules often say 1:1 is win for UC)
        if (aliveUndercovers > aliveCivilians) {
            return 'UNDERCOVERS';
        }
        // Special Case: 1v1 (or 1v1v1 etc) - If it's down to 1 Civilian and 1 Undercover, Undercover wins (stalemate breaker)
        // But if it's 2v2, we let them play (maybe they vote incorrectly)
        if (aliveUndercovers === aliveCivilians && aliveCivilians === 1) {
            return 'UNDERCOVERS';
        }

        // If 2v2 (U==C && C>1), we return null (Game Continues) as per user request
        return null;
    }

    returnToLobby(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // 1. Mark THIS player as in lobby
        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.inLobby = true;
            player.role = null;
            player.word = null;
            player.isAlive = true;
        }

        // 2. Check if EVERYONE is in lobby (or just reset if everyone left?)
        // If all players have inLobby=true, we can reset the room status fully to LOBBY
        const allInLobby = room.players.every(p => p.inLobby);

        if (allInLobby) {
            // Full Reset
            room.status = 'LOBBY';
            room.phase = null;
            room.currentTurnIndex = 0;
            room.descriptions = [];
            room.votes = {};
            room.wordPair = null;
            room.round = 1;
            room.winners = null;
            room.skippedCount = 0;
            room.previousRounds = [];
            room.turnOrder = [];

            // Clean flags
            room.players.forEach(p => {
                p.inLobby = false; // Reset flag for next game
                p.avatar = Math.floor(Math.random() * 10);
            });
        }

        // Notify all
        this.io.to(roomId).emit('room_update', room);
    }

    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: "Room not found" };

        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return { error: "Player not found" };

        const player = room.players[playerIndex];

        // 1. LOBBY: Remove player completely
        if (room.status === 'LOBBY') {
            room.players.splice(playerIndex, 1);

            // If room empty, delete it
            if (room.players.length === 0) {
                this.rooms.delete(roomId);
                return { left: true, roomEmpty: true };
            }

            // If Host left, assign new host (first player)
            if (player.isHost) {
                room.players[0].isHost = true;
            }

            this.io.to(roomId).emit('room_update', room);
            return { left: true };
        }

        // 2. PLAYING: Mark as dead/disconnected
        else {
            player.isAlive = false;
            this.io.to(roomId).emit('player_disconnected', player.name);
            this.io.to(roomId).emit('room_update', room);
            return { left: true };
        }
    }

    destroyRoom(roomId, hostId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: "Room not found" };

        const host = room.players.find(p => p.id === hostId);
        if (!host || !host.isHost) return { error: "Only host can end game" };

        // Delete room
        this.rooms.delete(roomId);

        // Notify everyone to clear state
        this.io.to(roomId).emit('room_destroyed');

        // Disconnect all sockets from room channel
        this.io.in(roomId).socketsLeave(roomId);

        return { success: true };
    }

    handleDisconnect(socketId) {
        // Find room logic...
        for (const [roomId, room] of this.rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socketId);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];

                // NEW BEHAVIOR:
                // If in LOBBY, do NOT remove them. 
                // This allows them to reconnect (e.g. mobile tab switch).
                // They can only be removed by explicit 'leave_room' event or if host ends room.

                if (room.status === 'LOBBY') {
                    // Optional: Mark them as disconnected visually? 
                    // For now, let's just keep them.
                    console.log(`Player ${player.name} disconnected from Lobby ${roomId} but kept for reconnection.`);
                } else {
                    // In Game: Mark as dead/disconnected
                    // Determine if game needs to end
                    player.isAlive = false; // Kill them
                    this.io.to(roomId).emit('player_disconnected', player.name);
                }
            }
        }
    }
}

export default GameManager;
