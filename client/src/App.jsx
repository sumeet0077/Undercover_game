import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
  transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
  reconnectionAttempts: 5,
  timeout: 60000, // Increased to 60s for Render cold starts
});

function App() {
  const [gameState, setGameState] = useState('LANDING'); // LANDING, LOBBY, PLAYING
  const [room, setRoom] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [myId, setMyId] = useState('');
  const [roleInfo, setRoleInfo] = useState(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    // Immediate check
    setIsConnected(socket.connected);

    socket.on('connect', () => {
      setMyId(socket.id);
      setIsConnected(true);
      setConnectionError('');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error("Connection error:", err);
      setIsConnected(false);
      setConnectionError(`Connection Failed: ${err.message}. Check Server URL.`);
    });

    socket.on('room_created', ({ roomId, room }) => {
      setRoom(room || { id: roomId, players: [{ name: playerName, id: socket.id, isHost: true }] });
      setGameState('LOBBY');
    });

    socket.on('room_update', (roomData) => {
      setRoom(roomData);
      setGameState(current => {
        if (roomData.status === 'PLAYING') return 'PLAYING';
        if (roomData.status === 'LOBBY') return 'LOBBY';
        if (current === 'LANDING') return 'LOBBY';
        return current;
      });
    });

    socket.on('your_info', (info) => {
      setRoleInfo(info);
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    socket.on('game_started', () => {
      setGameState('PLAYING');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room_created');
      socket.off('room_update');
      socket.off('your_info');
      socket.off('error');
      socket.off('game_started');
    };
  }, []);

  const createRoom = () => {
    if (!playerName) return setError("Enter name first!");
    setError('');
    socket.emit('create_room', { playerName });
  };

  const joinRoom = (roomId) => {
    if (!playerName) return setError("Enter name first!");
    setError('');
    socket.emit('join_room', { roomId, playerName });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {error && (
        <div className="fixed top-4 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
          {error}
        </div>
      )}

      {gameState === 'LANDING' && (
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Connection Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono transition-colors ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
            {!isConnected && (
              <span className="text-[10px] opacity-70">
                ({import.meta.env.VITE_SERVER_URL || 'localhost:3000'})
              </span>
            )}
          </div>
          {connectionError && (
            <div className="text-xs text-red-400 bg-red-900/30 p-2 rounded">
              Server Error: {connectionError}
            </div>
          )}

          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-8">
            UNDERCOVER
          </h1>
          <div className="space-y-4 bg-card p-8 rounded-2xl shadow-2xl border border-gray-700">
            <input
              type="text"
              placeholder="Your Name"
              className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            <button
              onClick={createRoom}
              className="w-full bg-primary hover:bg-violet-600 text-white font-bold py-3 px-4 rounded-lg transition-all"
            >
              Create New Room
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-card text-gray-400">Or join existing</span></div>
            </div>
            <div className="flex gap-2">
              <input
                id="roomCodeInput"
                type="text"
                placeholder="Room Code"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <button
                onClick={() => joinRoom(document.getElementById('roomCodeInput').value)}
                className="bg-secondary hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'LOBBY' && room && (
        <Lobby room={room} socket={socket} myId={myId} />
      )}

      {gameState === 'PLAYING' && room && (
        <GameRoom room={room} socket={socket} myId={myId} roleInfo={roleInfo} />
      )}
    </div>
  );
}

export default App;
