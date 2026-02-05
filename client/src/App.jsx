import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import ErrorBoundary from './components/ErrorBoundary';

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity, // Keep trying
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
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
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    // Immediate check
    setIsConnected(socket.connected);

    socket.on('connect', () => {
      setMyId(socket.id);
      setIsConnected(true);
      setConnectionError('');

      // Attempt Rejoin
      const savedRoom = localStorage.getItem('uc_roomId');
      const savedName = localStorage.getItem('uc_getName');
      if (savedRoom && savedName) {
        console.log("Attempting rejoin for:", savedName, savedRoom);
        socket.emit('rejoin_game', { roomId: savedRoom, playerName: savedName });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('rejoin_failed', (err) => {
      console.log("Rejoin failed:", err);
      localStorage.removeItem('uc_roomId');
      localStorage.removeItem('uc_getName');
      setGameState('LANDING');
      setRoom(null);
    });

    socket.on('connect_error', (err) => {
      console.error("Connection error:", err);
      setIsConnected(false);
      // Only show intrusive error if not yet playing. If playing, user will just see disconnected badge.
      if (gameState === 'LANDING') {
        setConnectionError(`Connection Failed: ${err.message}. Check Server URL.`);
      }
    });

    socket.on('room_created', ({ roomId, room }) => {
      const rId = room ? room.id : roomId;
      // Save for reconnection
      localStorage.setItem('uc_roomId', rId);
      localStorage.setItem('uc_getName', playerName);

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

    socket.on('update_votes', ({ votes }) => {
      // App handles room state updates centrally
      setRoom(prev => {
        if (!prev) return prev;
        // Merge votes into room state
        return { ...prev, votes: votes || prev.votes };
      });
    });

    // --- NEW HANDLERS ---
    socket.on('room_destroyed', () => {
      alert("The host has ended the game.");
      localStorage.removeItem('uc_roomId');
      localStorage.removeItem('uc_getName');
      setRoom(null);
      setGameState('LANDING');
    });

    socket.on('left_room_success', () => {
      localStorage.removeItem('uc_roomId');
      localStorage.removeItem('uc_getName');
      setRoom(null);
      setGameState('LANDING');
    });

    socket.on('player_joined', ({ player }) => {
      setRoom(prev => {
        if (!prev) return null; // Should not happen if in lobby
        // Check for duplicate
        if (prev.players.some(p => p.id === player.id)) return prev;
        return { ...prev, players: [...prev.players, player] };
      });
    });

    // ATOMIC SYNC
    socket.on('full_sync', ({ room }) => {
      // One update to rule them all
      setRoom(room);
      setGameState(current => {
        if (room.status === 'PLAYING') return 'PLAYING';
        if (room.status === 'LOBBY') return 'LOBBY';
        return current;
      });
    });

    // HEARTBEAT
    // HEARTBEAT & LATENCY
    // Only ping if tab is visible to prevent throttling/battery drain
    const pingInterval = setInterval(() => {
      if (socket.connected && document.visibilityState === 'visible') {
        const start = Date.now();
        socket.volatile.emit('ping', () => {
          setLatency(Date.now() - start);
        });
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('rejoin_failed'); // Cleanup
      socket.off('connect_error');
      socket.off('room_created');
      socket.off('room_update');
      socket.off('your_info');
      socket.off('error');
      socket.off('game_started');
      socket.off('room_destroyed');
      socket.off('update_votes'); // Clean up
      socket.off('left_room_success');
      socket.off('full_sync'); // New
    };
  }, [playerName]);

  // VISIBILITY SYNC
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket.connected && room) {
        console.log("App visible -> Syncing...");
        socket.emit('request_sync', { roomId: room.id });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [room]);

  const createRoom = () => {
    if (!playerName) return setError("Enter name first!");
    setError('');
    // Store immediately (optimistic) or wait for success? 
    // Wait for success in 'room_created'. But we need playerName state there. 
    // Actually, 'room_created' listener uses closed-over state if not careful, but we used localStorage there.
    localStorage.setItem('uc_getName', playerName); // Save name intended
    socket.emit('create_room', { playerName });
  };

  const joinRoom = (roomId) => {
    if (!playerName) return setError("Enter name first!");
    setError('');
    localStorage.setItem('uc_getName', playerName); // Save name intended
    socket.emit('join_room', { roomId, playerName });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        {error && (
          <div className="fixed top-4 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
            {error}
          </div>
        )}

        {gameState === 'LANDING' && (
          // ... (content preserved implicitly by tool, but I need to be careful. I will wrap the WHOLE return)
          // Actually, easier to wrap inside the div? No, ErrorBoundary should be top level to catch div errors too.
          // But div has key styles. Using ErrorBoundary as root is fine.

          <div className="max-w-md w-full space-y-8 text-center flex flex-col items-center">
            {/* ... LANDING CONTENT ... */}
            {/* Connection Status Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono transition-colors ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isConnected ? `● CONNECTED (${latency}ms)` : '○ DISCONNECTED'}
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

            <img
              src="/logo.png"
              alt="SigmaBluff Logo"
              className="w-48 md:w-64 h-auto drop-shadow-2xl mb-8 hover:scale-105 transition-transform duration-300"
            />
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
                  onClick={() => joinRoom(document.getElementById('roomCodeInput').value.toUpperCase())}
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
    </ErrorBoundary>
  );
}

export default App;
