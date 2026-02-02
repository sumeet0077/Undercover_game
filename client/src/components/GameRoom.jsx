import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Send, User } from 'lucide-react';
import { playWinSound } from '../utils/sound';
import clsx from 'clsx';

const GameRoom = ({ room, socket, myId, roleInfo }) => {
    // const [roleInfo, setRoleInfo] = useState(null); // Moved to App.jsx
    const [showRole, setShowRole] = useState(false);
    const [inputDesc, setInputDesc] = useState('');
    const [descriptions, setDescriptions] = useState([]);
    const [turnId, setTurnId] = useState('');
    const [phase, setPhase] = useState('DESCRIPTION'); // DESCRIPTION, VOTING, GAMEOVER
    const [voteCount, setVoteCount] = useState(0);
    const [totalVoteCount, setTotalVoteCount] = useState(0);
    const [eliminatedInfo, setEliminatedInfo] = useState(null);
    const [gameResult, setGameResult] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [typingInfo, setTypingInfo] = useState(null);

    const me = room?.players?.find(p => p.id === myId);
    if (!me) return <div className="text-center mt-20 text-red-500">Error: Player data missing. Please rejoin.</div>;

    // ... (lines 22-109 omitted from diff for brevity, assume unchanged or handled)

    // Handle re-sync of descriptions if room data has it
    useEffect(() => {
        if (room?.descriptions) setDescriptions(room.descriptions);
        if (room?.players?.[room.currentTurnIndex]?.id) setTurnId(room.players[room.currentTurnIndex].id);
        if (room?.phase) setPhase(room.phase);
    }, [room]);

    // ...

    {/* MAIN GAME AREA */ }
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* LEFT: PLAYERS LIST & VOTING */}
        <div className="col-span-1 space-y-3">
            <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider">Players</h3>
            {room?.players?.map(p => {
                const isMyTurn = turnId === p.id;
                const canVote = phase === 'VOTING' && me.isAlive && p.isAlive && p.id !== myId;

                return (
                    <div
                        key={p.id}
                        onClick={() => canVote && castVote(p.id)}
                        className={clsx(
                            "p-3 rounded-xl flex items-center justify-between transition-all border",
                            p.isAlive ? "bg-card border-gray-700" : "bg-red-900/20 border-red-900/50 opacity-60 grayscale",
                            isMyTurn && phase === 'DESCRIPTION' && "ring-2 ring-primary bg-primary/10",
                            canVote && "cursor-pointer hover:bg-red-500/20 hover:border-red-500"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={clsx(
                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                                p.isAlive ? "bg-slate-700" : "bg-red-950 text-red-500 line-through"
                            )}>
                                {p.name[0]}
                            </div>
                            <div>
                                <div className="font-bold text-sm">{p.name}</div>
                                <div className="text-xs text-gray-500">
                                    {!p.isAlive ? 'DEAD' : (isMyTurn && phase === 'DESCRIPTION' ? 'DESCRIBING...' : 'ALIVE')}
                                </div>
                            </div>
                        </div>
                        {canVote && <div className="text-xs bg-red-500 text-white px-2 py-1 rounded">VOTE</div>}
                    </div>
                );
            })}

            {/* ... */}
        </div>

        {/* MIDDLE/RIGHT: GAME FEED */}
        <div className="col-span-1 md:col-span-2 bg-slate-800/50 rounded-2xl border border-gray-700 p-6 flex flex-col h-[500px]">
            {/* ... header ... */}

            {/* FEED */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {descriptions?.map((desc, i) => (
                    <div key={i} className="flex gap-3 animate-in slide-in-from-left-2 duration-300">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                            {desc.name[0]}
                        </div>
                        <div className="bg-card p-3 rounded-r-xl rounded-bl-xl text-sm border border-gray-700">
                            <span className="font-bold text-primary block text-xs mb-1">{desc.name}</span>
                            {desc.text}
                        </div>
                    </div>
                ))}
                {(!descriptions || descriptions.length === 0) && phase === 'DESCRIPTION' && (
                    <div className="text-center text-gray-500 italic mt-10">No descriptions yet...</div>
                )}
            </div>

            {/* INPUT AREA */}
            {/* ... */}
            {phase === 'DESCRIPTION' && turnId !== myId && (
                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-center text-gray-500 text-sm flex justify-center items-center gap-2">
                    {typingInfo && typingInfo.isTyping && typingInfo.playerId === turnId ? (
                        <>
                            <span className="animate-pulse">✍️</span>
                            <span className="text-primary font-bold animate-pulse">
                                {room?.players?.find(p => p.id === turnId)?.name || 'Player'} is typing...
                            </span>
                        </>
                    ) : (
                        "Waiting for active player..."
                    )}
                </div>
            )}
        </div>
    </div>

    {/* OVERLAY: ELIMINATION / GAME OVER */ }
    {
        eliminatedInfo && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in">
                <div className="bg-card p-8 rounded-2xl max-w-sm w-full text-center border border-gray-600 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-4 text-white">
                        {eliminatedInfo.result === 'Tie' ? 'TIE - NO ELIMINATION' :
                            eliminatedInfo.result === 'Skipped' ? 'VOTE SKIPPED' : 'ELIMINATED'}
                    </h2>
                    {eliminatedInfo.eliminated && (
                        <div className="mb-6">
                            <div className="text-6xl mb-4">💀</div>
                            <div className="text-2xl font-bold text-red-500 mb-2">{eliminatedInfo.eliminated.name}</div>
                            <div className="text-gray-400">was a <span className="text-white font-bold">{eliminatedInfo.eliminated.role}</span></div>
                        </div>
                    )}
                    <div className="text-gray-500 text-sm animate-pulse">Next round starting soon...</div>
                </div>
            </div>
        )
    }

    {
        gameResult && (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-in zoom-in duration-300">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-3xl max-w-2xl w-full text-center border border-gray-600 shadow-2xl">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-8">
                        {gameResult.winners} WIN!
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-h-[400px] overflow-y-auto">
                        {gameResult.allRoles.map(p => (
                            <div key={p.id} className="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center">
                                <span className="font-bold text-lg">{p.name}</span>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400">ROLE</div>
                                    <div className={clsx(
                                        "font-bold",
                                        p.role === 'CIVILIAN' ? "text-green-400" : "text-red-400"
                                    )}>{p.role}</div>
                                    <div className="text-xs text-gray-500">{p.word}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => socket.emit('return_to_lobby', { roomId: room.id })}
                        className="mt-8 bg-white text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform"
                    >
                        RETURN TO LOBBY
                    </button>
                </div>
            </div>
        )
    }

    {/* FLOATING REACTIONS LAYER (Pointer events none allows clicking through) */ }
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map(r => (
            <div
                key={r.id}
                className="absolute bottom-20 text-4xl animate-float"
                style={{ left: `${r.left}%` }}
            >
                {r.emoji}
            </div>
        ))}
    </div>

    {/* REACTION BAR */ }
    <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-gray-700 p-2 flex justify-center gap-4 z-40">
        {['😂', '🤔', '😡', '👏', '👻', '👎'].map(emoji => (
            <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform p-2"
            >
                {emoji}
            </button>
        ))}
    </div>

        </div >
    );
};

export default GameRoom;
