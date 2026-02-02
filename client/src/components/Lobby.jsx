import React from 'react';
import { Users, Play, Copy } from 'lucide-react';

const Lobby = ({ room, socket, myId }) => {
    const isHost = room?.players?.find(p => p.id === myId)?.isHost;
    const [ucCount, setUcCount] = React.useState(1);
    const [mrWhiteCount, setMrWhiteCount] = React.useState(0);
    const [showRole, setShowRole] = React.useState(false);
    const [codeCopied, setCodeCopied] = React.useState(false);

    const copyCode = () => {
        navigator.clipboard.writeText(room.id);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const startGame = () => {
        socket.emit('start_game', { roomId: room.id, config: { ucCount, mrWhiteCount, showRole } });
    };

    return (
        <div className="max-w-4xl w-full">
            <div className="flex justify-between items-center mb-12">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">LOBBY</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => confirm("Leave room?") && socket.emit('leave_room', { roomId: room.id })}
                            className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded border border-red-800"
                        >
                            LEAVE
                        </button>
                        {isHost && (
                            <button
                                onClick={() => confirm("End game for everyone?") && socket.emit('end_game', { roomId: room.id })}
                                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-bold"
                            >
                                END ROOM
                            </button>
                        )}
                    </div>
                </div>
                <div
                    onClick={copyCode}
                    className="bg-card px-6 py-3 rounded-full flex items-center gap-3 cursor-pointer hover:bg-slate-700 transition-colors border border-gray-700"
                >
                    <span className="text-gray-400">ROOM CODE:</span>
                    <span className="text-2xl font-mono font-bold tracking-widest text-white min-w-[100px] text-center">
                        {codeCopied ? <span className="text-green-400">COPIED!</span> : room.id}
                    </span>
                    <Copy size={18} className="text-gray-400" />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                {room?.players?.map((player) => (
                    <div key={player.id} className="aspect-square bg-card rounded-2xl flex flex-col items-center justify-center border border-gray-700 shadow-xl relative animate-in fade-in zoom-in duration-300">
                        <div className="bg-gradient-to-br from-primary to-secondary w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                            {player.name[0].toUpperCase()}
                        </div>
                        <div className="font-bold text-lg">{player.name}</div>
                        {player.isHost && (
                            <span className="absolute top-2 right-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold">HOST</span>
                        )}
                    </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-800/50 rounded-2xl flex items-center justify-center border border-dashed border-gray-700">
                        <Users className="text-gray-600" size={32} />
                    </div>
                ))}
            </div>

            {isHost && (
                <div className="mb-8 p-6 bg-slate-800/50 rounded-2xl border border-gray-700 w-full max-w-lg mx-auto">
                    <h3 className="text-xl font-bold mb-4 text-center">Game Configuration</h3>

                    <div className="mb-4">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-300">Undercovers</span>
                            <span className="font-bold text-primary">{ucCount}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={Math.max(1, room.players.length - 2)}
                            value={ucCount}
                            onChange={e => setUcCount(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-300">Mr. White</span>
                            <span className="font-bold text-secondary">{mrWhiteCount}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={Math.max(0, room.players.length - ucCount - 2)}
                            value={mrWhiteCount}
                            onChange={e => setMrWhiteCount(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                    </div>

                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-gray-300">Show Role Labels</span>
                        <button
                            onClick={() => setShowRole(!showRole)}
                            className={`px-3 py-1 rounded-full font-bold text-xs transition-colors ${showRole ? 'bg-green-600' : 'bg-gray-600'}`}
                        >
                            {showRole ? 'VISIBLE' : 'HIDDEN'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">If hidden, players only see their word (except Mr. White).</p>
                </div>
            )}

            {isHost && (
                <div className="flex justify-center">
                    <button
                        onClick={startGame}
                        disabled={room.players.length < 3}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-xl font-bold py-4 px-12 rounded-2xl shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3"
                    >
                        <Play fill="currentColor" /> START GAME
                    </button>
                </div>
            )}
            {isHost && room.players.length < 3 && (
                <p className="text-center mt-4 text-gray-500">Need at least 3 players to start.</p>
            )}
            {!isHost && (
                <div className="text-center text-xl animate-pulse text-gray-400">
                    Waiting for host to start...
                </div>
            )}
        </div>
    );
};

export default Lobby;
