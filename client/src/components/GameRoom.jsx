import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Send, User } from 'lucide-react';
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

    const me = room.players.find(p => p.id === myId);

    if (!me) return <div className="text-center mt-20 text-red-500">Error: Player data missing. Please rejoin.</div>;

    useEffect(() => {
        // socket.on('your_info', (info) => { setRoleInfo(info); }); // Handled in App.jsx

        socket.on('update_descriptions', (descs) => {
            setDescriptions(descs);
        });

        socket.on('next_turn', ({ currentTurn }) => {
            setTurnId(currentTurn);
        });

        socket.on('phase_change', ({ phase: newPhase }) => {
            setPhase(newPhase);
        });

        socket.on('game_started', ({ currentTurn, phase }) => {
            setTurnId(currentTurn);
            setPhase(phase);
            setDescriptions([]);
            setVoteCount(0);
            setEliminatedInfo(null);
            setGameResult(null);
        });

        socket.on('update_votes', ({ count, total }) => {
            setVoteCount(count);
            setTotalVoteCount(total);
        });

        socket.on('voting_result', ({ result, eliminated }) => {
            setEliminatedInfo({ result, eliminated }); // Show popup or banner

            // Clear after delay if not game over
            setTimeout(() => {
                setEliminatedInfo(null);
            }, 5000);
        });

        socket.on('vote_confirmed', ({ targetId }) => {
            setHasVoted(true);
        });

        socket.on('player_typing', ({ playerId, isTyping }) => {
            setTypingInfo({ playerId, isTyping });
        });

        socket.on('new_round', ({ phase, currentTurn }) => {
            setPhase(phase);
            setTurnId(currentTurn);
            setDescriptions([]);
            setVoteCount(0);
            setHasVoted(false);
        });

        socket.on('game_over', ({ winners, allRoles }) => {
            setGameResult({ winners, allRoles });
            setPhase('GAMEOVER');
        });

        return () => {
            // socket.off('your_info');
            socket.off('update_descriptions');
            socket.off('next_turn');
            socket.off('phase_change');
            socket.off('game_started');
            socket.off('update_votes');
            socket.off('vote_confirmed');
            socket.off('voting_result');
            socket.off('new_round');
            socket.off('game_over');
        }
    }, [socket]);

    // Handle re-sync. Simplification: if we rejoin, we might not know if we voted.
    // Ideally server sends this info. For now, assume false on reload (limitation).

    // Handle re-sync of descriptions if room data has it
    useEffect(() => {
        if (room.descriptions) setDescriptions(room.descriptions);
        if (room.players[room.currentTurnIndex]?.id) setTurnId(room.players[room.currentTurnIndex].id);
        if (room.phase) setPhase(room.phase);
    }, [room]);


    const submitDesc = () => {
        if (!inputDesc.trim()) return;
        socket.emit('submit_description', { roomId: room.id, description: inputDesc });
        setInputDesc('');
    };

    const castVote = (targetId) => {
        if (phase !== 'VOTING') return;
        if (!me.isAlive) return;
        if (hasVoted) return;
        socket.emit('submit_vote', { roomId: room.id, targetId });
    };

    if (!roleInfo) return <div className="text-center mt-20">Loading game data...</div>;

    return (
        <div className="max-w-4xl w-full flex flex-col items-center">

            {/* TOP BAR: ROLE REVEAL */}
            <div className="w-full flex justify-between items-center bg-card p-4 rounded-xl mb-6 border border-gray-700">
                <div>
                    <span className="text-gray-400 text-sm">YOU ARE</span>
                    <div className="font-bold text-xl">{me.name}</div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowRole(!showRole)}
                        className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-full font-mono flex items-center gap-2 select-none"
                    >
                        {showRole ? (
                            <>
                                <Eye size={18} />
                                <span className={clsx("font-bold", roleInfo.word ? "text-primary" : "text-gray-200")}>
                                    {roleInfo.word || "UNKNOWN"}
                                    {(!room.config || room.config.showRole || roleInfo.role === 'MR_WHITE')
                                        ? ` (${roleInfo.role})`
                                        : ''}
                                </span>
                            </>
                        ) : (
                            <>
                                <EyeOff size={18} /> TAP TO REVEAL
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* MAIN GAME AREA */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* LEFT: PLAYERS LIST & VOTING */}
                <div className="col-span-1 space-y-3">
                    <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider">Players</h3>
                    {room.players.map(p => {
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

                    {/* SKIP VOTE BUTTON */}
                    {phase === 'VOTING' && me.isAlive && !hasVoted && (
                        <button
                            onClick={() => castVote('SKIP')}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-gray-300 font-bold py-3 rounded-xl border border-dashed border-gray-500 transition-colors"
                        >
                            🚫 SKIP VOTE
                        </button>
                    )}
                    {phase === 'VOTING' && hasVoted && (
                        <div className="text-center p-3 bg-green-900/30 border border-green-900 rounded-xl text-green-400 font-bold">
                            ✅ VOTE SUBMITTED
                        </div>
                    )}
                </div>

                {/* MIDDLE/RIGHT: GAME FEED */}
                <div className="col-span-1 md:col-span-2 bg-slate-800/50 rounded-2xl border border-gray-700 p-6 flex flex-col h-[500px]">

                    {/* HEADER */}
                    <div className="border-b border-gray-700 pb-4 mb-4 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">{phase === 'DESCRIPTION' ? 'Description Phase' : phase === 'VOTING' ? 'Voting Phase' : 'Game Over'}</h2>
                            <p className="text-gray-400 text-sm">
                                {phase === 'DESCRIPTION' ? "Listen carefully to everyone's clues." : "Who is the imposter? Vote now!"}
                            </p>
                        </div>
                        {phase === 'VOTING' && (
                            <div className="text-right">
                                <div className="text-2xl font-bold">{voteCount}/{totalVoteCount}</div>
                                <div className="text-xs text-gray-500">VOTES CAST</div>
                            </div>
                        )}
                    </div>

                    {/* FEED */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {descriptions.map((desc, i) => (
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
                        {descriptions.length === 0 && phase === 'DESCRIPTION' && (
                            <div className="text-center text-gray-500 italic mt-10">No descriptions yet...</div>
                        )}
                    </div>

                    {/* INPUT AREA */}
                    {phase === 'DESCRIPTION' && turnId === myId && me.isAlive && (
                        <div className="mt-4 flex gap-2">
                            <input
                                type="text"
                                placeholder="Describe your word..."
                                className="flex-1 bg-slate-900 border border-gray-600 rounded-lg px-4 focus:outline-none focus:border-primary"
                                value={inputDesc}
                                onChange={e => setInputDesc(e.target.value)}
                                onFocus={() => socket.emit('typing_start', { roomId: room.id })}
                                onBlur={() => socket.emit('typing_stop', { roomId: room.id })}
                                onKeyDown={e => e.key === 'Enter' && submitDesc()}
                                maxLength={200}
                                autoFocus
                            />
                            <button
                                onClick={submitDesc}
                                className="bg-primary hover:bg-violet-600 text-white p-3 rounded-lg transition-colors"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    )}
                    {phase === 'DESCRIPTION' && turnId !== myId && (
                        <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-center text-gray-500 text-sm flex justify-center items-center gap-2">
                            {typingInfo && typingInfo.isTyping && typingInfo.playerId === turnId ? (
                                <>
                                    <span className="animate-pulse">✍️</span>
                                    <span className="text-primary font-bold animate-pulse">
                                        {room.players.find(p => p.id === turnId)?.name || 'Player'} is typing...
                                    </span>
                                </>
                            ) : (
                                "Waiting for active player..."
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* OVERLAY: ELIMINATION / GAME OVER */}
            {eliminatedInfo && (
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
            )}

            {gameResult && (
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
            )}

        </div>
    );
};

export default GameRoom;
