import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import GameManager from './gameManager.js';

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('Undercover Server is Running!');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // allow all for dev
        methods: ["GET", "POST"]
    }
});

const gameManager = new GameManager(io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ playerName }) => {
        const roomId = gameManager.createRoom(playerName, socket.id);
        const room = gameManager.rooms.get(roomId);
        socket.join(roomId);
        socket.emit('room_created', { roomId, room });
    });

    socket.on('join_room', ({ roomId, playerName }) => {
        const result = gameManager.joinRoom(roomId, playerName, socket.id);
        if (result.error) {
            socket.emit('error', result.error);
        } else {
            socket.join(roomId);
            io.to(roomId).emit('room_update', result.room);
            io.to(roomId).emit('room_created', { roomId, room: result.room }); // To specific user
        }
    });

    socket.on('rejoin_game', ({ roomId, playerName }) => {
        const result = gameManager.rejoinGame(roomId, playerName, socket.id);
        if (result.error) {
            socket.emit('rejoin_failed', result.error);
        } else {
            const { room, player } = result;
            socket.join(roomId);

            // 1. Send specific player info
            if (player.role) {
                socket.emit('your_info', { role: player.role, word: player.word });
            }

            // 2. Send room state
            // BROADCAST to everyone so they know this player has a new ID
            io.to(roomId).emit('room_update', room);

            // 3. If game is running, sync game state
            if (room.status === 'PLAYING' || room.status === 'GAMEOVER') {
                socket.emit('game_started', {
                    currentTurn: room.players[room.currentTurnIndex]?.id,
                    phase: room.phase
                });
                socket.emit('update_descriptions', room.descriptions);
                socket.emit('update_votes', {
                    count: Object.keys(room.votes).length,
                    total: room.players.filter(p => p.isAlive).length
                });
            }
        }
    });

    socket.on('start_game', ({ roomId, config }) => {
        const room = gameManager.startGame(roomId, config);
        if (room) {
            io.to(roomId).emit('room_update', room);
        }
    });

    socket.on('submit_description', ({ roomId, description }) => {
        gameManager.submitDescription(roomId, socket.id, description);
    });

    socket.on('submit_vote', ({ roomId, targetId }) => {
        gameManager.submitVote(roomId, socket.id, targetId);
    });

    socket.on('return_to_lobby', ({ roomId }) => {
        gameManager.returnToLobby(roomId);
    });

    socket.on('reshuffle_words', ({ roomId }) => {
        const result = gameManager.rerollWords(roomId, socket.id);
        if (result.error) socket.emit('error', result.error);
    });

    socket.on('typing_start', ({ roomId }) => {
        socket.to(roomId).emit('player_typing', { playerId: socket.id, isTyping: true });
    });

    socket.on('typing_stop', ({ roomId }) => {
        socket.to(roomId).emit('player_typing', { playerId: socket.id, isTyping: false });
    });

    // --- NEW HANDLERS ---

    socket.on('request_sync', ({ roomId }) => {
        // Reuse rejoin logic's refresh part basically
        const room = gameManager.rooms.get(roomId);
        if (room && (room.status === 'PLAYING' || room.status === 'GAMEOVER')) {
            socket.emit('game_started', {
                currentTurn: room.players[room.currentTurnIndex]?.id,
                phase: room.phase
            });
            socket.emit('update_descriptions', room.descriptions);
            socket.emit('update_votes', {
                count: Object.keys(room.votes).length,
                total: room.players.filter(p => p.isAlive).length
            });
        }
    });

    socket.on('leave_room', ({ roomId }) => {
        gameManager.leaveRoom(roomId, socket.id);
        socket.leave(roomId);
        socket.emit('left_room_success'); // Ack to client
    });

    socket.on('end_game', ({ roomId }) => {
        gameManager.destroyRoom(roomId, socket.id);
    });

    socket.on('send_reaction', ({ roomId, emoji }) => {
        // Broadcast to everyone including sender
        io.to(roomId).emit('receive_reaction', { emoji, id: Math.random() }); // Simple ID for React key
    });

    socket.on('disconnect', () => {
        gameManager.handleDisconnect(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
