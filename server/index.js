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

    socket.on('disconnect', () => {
        gameManager.handleDisconnect(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
