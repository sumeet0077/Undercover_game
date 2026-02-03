import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Send, Smile, CheckCircle2 } from 'lucide-react';
import { playWinSound, playRoleSound } from '../utils/sound';
import clsx from 'clsx';

const GameRoom = ({ room, socket, myId, roleInfo }) => {
    // const [roleInfo, setRoleInfo] = useState(null); // Moved to App.jsx
    const [showRole, setShowRole] = useState(false);
    const [inputDesc, setInputDesc] = useState('');
    const [descriptions, setDescriptions] = useState([]);
    const [history, setHistory] = useState([]); // Previous rounds
    const [turnId, setTurnId] = useState('');
    const [phase, setPhase] = useState('DESCRIPTION'); // DESCRIPTION, VOTING, GAMEOVER
    const [voteCount, setVoteCount] = useState(0);
    const [totalVoteCount, setTotalVoteCount] = useState(0);
    const [eliminatedInfo, setEliminatedInfo] = useState(null);
    const [gameResult, setGameResult] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [typingInfo, setTypingInfo] = useState(null);
    const [reactions, setReactions] = useState([]);
    const [showReactions, setShowReactions] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleReaction = (emoji) => {
        socket.emit('send_reaction', { roomId: room.id, emoji });
        setShowReactions(false);
    };

    const me = room?.players?.find(p => p.id === myId);

    // Auto-clear typing after 3 seconds of silence (fixes stuck bubbles)
    useEffect(() => {
        if (!typingInfo?.isTyping) return;
        const timer = setTimeout(() => {
            setTypingInfo(null);
        }, 3000);
        return () => clearTimeout(timer);
    }, [typingInfo]);

    // Robust Turn Check: ID match OR Name match (handles socket ID shifts on rejoin)
    const turnPlayer = room?.players?.find(p => p.id === turnId);
    const isMyTurn = turnId === myId || (me && turnPlayer && me.name === turnPlayer.name);



    useEffect(() => {
        socket.on('update_descriptions', (descs) => {
            setDescriptions(descs);
            setTimeout(scrollToBottom, 100);
        });

        socket.on('next_turn', ({ currentTurn }) => {
            setTurnId(currentTurn);
            setTimeout(scrollToBottom, 100);
        });

        socket.on('phase_change', ({ phase: newPhase }) => {
            setPhase(newPhase);
            setShowReactions(false);
        });

        socket.on('game_started', ({ currentTurn, phase }) => {
            setTurnId(currentTurn);
            setPhase(phase);
            setDescriptions([]);
            setHistory([]);
            setVoteCount(0);
            setEliminatedInfo(null);
            setGameResult(null);
        });

        socket.on('update_votes', ({ count, total }) => {
            setVoteCount(count);
            setTotalVoteCount(total);
            // Room votes updated via parent 'room' prop from App.jsx
        });

        socket.on('voting_result', ({ result, eliminated }) => {
            setEliminatedInfo({ result, eliminated }); // Show popup or banner

            if (eliminated) {
                playRoleSound(eliminated.role);
            }

            // Clear after delay if not game over
            setTimeout(() => {
                setEliminatedInfo(null);
            }, 5000);
        });

        socket.on('vote_confirmed', ({ targetId }) => {
            setHasVoted(true);
        });

        socket.on('player_typing', ({ playerId, isTyping }) => {
            setTypingInfo({ playerId, isTyping, timestamp: Date.now() });
            if (isTyping) scrollToBottom();
        });

        socket.on('new_round', ({ phase, currentTurn }) => {
            setPhase(phase);
            setTurnId(currentTurn);
            setDescriptions([]);
            // History update happens via room_update or we can rely on local append, 
            // but relying on room sync is safer if we implement it. 
            // For now, let's rely on 'room_update' which sends the full room object including history.
            setVoteCount(0);
            setHasVoted(false);
        });

        socket.on('game_over', ({ winners, allRoles }) => {
            setGameResult({ winners, allRoles });
            setPhase('GAMEOVER');
            playWinSound(winners);
        });

        socket.on('notification', ({ message }) => {
            alert(message);
        });

        socket.on('receive_reaction', ({ emoji, id }) => {
            const reaction = { id, emoji, left: Math.random() * 80 + 10 };
            setReactions(prev => [...prev, reaction]);
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== id));
            }, 2000);
        });

        return () => {
            socket.off('update_descriptions');
            socket.off('next_turn');
            socket.off('phase_change');
            socket.off('game_started');
            socket.off('update_votes');
            socket.off('vote_confirmed');
            socket.off('voting_result');
            socket.off('new_round');
            socket.off('game_over');
            socket.off('notification');
            socket.off('player_typing');
            socket.off('receive_reaction');
        }
    }, [socket]);

    // Handle re-sync
    useEffect(() => {
        if (room?.descriptions) setDescriptions(room.descriptions);
        if (room?.previousRounds) setHistory(room.previousRounds);
        if (room?.players?.[room.currentTurnIndex]?.id) setTurnId(room.players[room.currentTurnIndex].id);
        if (room?.phase) setPhase(room.phase);
    }, [room]);


    const submitDesc = () => {
        if (!inputDesc.trim()) return;
        socket.emit('submit_description', { roomId: room.id, description: inputDesc });
        setInputDesc('');
        // Keep focus? Mobile keyboard might stay up.
        // inputRef.current?.focus(); 
    };

    const castVote = (targetId) => {
        if (phase !== 'VOTING') return;
        if (!me.isAlive) return;
        if (hasVoted) return;
        socket.emit('submit_vote', { roomId: room.id, targetId });
    };

    // Scroll handling for mobile keyboard
    const handleInputFocus = () => {
        socket.emit('typing_start', { roomId: room.id });
        // Delay to allow keyboard to pop
        setTimeout(() => {
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scrollToBottom();
        }, 300);
    };

    if (!room || !me || !roleInfo) return <div className="text-center mt-20 text-gray-400 animate-pulse">Loading game data... (v1.2)</div>;

    return (
        <div className="max-w-4xl w-full flex flex-col items-center">

            {/* TOP BAR: ROLE REVEAL & EXIT */}
            <div className="w-full flex flex-col md:flex-row justify-between items-center bg-card p-4 rounded-xl mb-6 border border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-gray-400 text-sm">YOU ARE</span>
                        <div className="font-bold text-xl">{me.name}</div>
                    </div>
                    {/* EXIT BUTTONS */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => confirm("Leave game?") && socket.emit('leave_room', { roomId: room.id })}
                            className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded border border-red-800"
                        >
                            Leave
                        </button>
                        {me.isHost && (
                            <button
                                onClick={() => confirm("End game for everyone?") && socket.emit('end_game', { roomId: room.id })}
                                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-bold"
                            >
                                END GAME
                            </button>
                        )}
                    </div>
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
                    <div className="flex justify-between items-center">
                        <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider">Players</h3>
                        {phase === 'VOTING' && (
                            <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-primary">
                                {voteCount}/{totalVoteCount} VOTED
                            </span>
                        )}
                    </div>
                    {room?.players?.map(p => {
                        const isMyTurn = turnId === p.id;
                        const canVote = phase === 'VOTING' && me.isAlive && p.isAlive && p.id !== myId;
                        const hasVoted = room.votes && room.votes[p.id];

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
                                <div className="flex items-center gap-2">
                                    {phase === 'VOTING' && hasVoted && (
                                        <div className="text-xs bg-slate-700 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                                            <CheckCircle2 size={12} /> VOTED
                                        </div>
                                    )}
                                    {canVote && <div className="text-xs bg-red-500 text-white px-2 py-1 rounded">VOTE</div>}
                                </div>
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

                {/* MIDDLE/RIGHT: GAME FEED (History + Current) */}
                <div className="col-span-1 md:col-span-2 bg-slate-800/50 rounded-2xl border border-gray-700 p-6 flex flex-col h-[500px]">

                    {/* HEADER */}
                    <div className="border-b border-gray-700 pb-4 mb-4 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">
                                {phase === 'DESCRIPTION' ? `Round ${room.round || 1}` : phase === 'VOTING' ? 'Voting' : 'Game Over'}
                            </h2>
                            <p className="text-gray-400 text-sm">
                                {phase === 'DESCRIPTION' ? "Listen carefully." : "Who is the imposter?"}
                            </p>
                        </div>
                        {me.isHost && phase !== 'GAMEOVER' && (
                            <button
                                onClick={() => {
                                    if (confirm("Change words?")) socket.emit('reshuffle_words', { roomId: room.id });
                                }}
                                className="text-xs bg-slate-700 px-3 py-1 rounded text-orange-300 border border-slate-600"
                            >
                                🔄 RE-ROLL
                            </button>
                        )}
                    </div>

                    {/* FEED SCROLL AREA */}
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">

                        {/* HISTORY */}
                        {history.map((roundDescs, rIdx) => (
                            <div key={`round-${rIdx}`} className="opacity-70">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px bg-gray-700 flex-1"></div>
                                    <span className="text-xs font-bold text-gray-500 tracking-widest">ROUND {rIdx + 1}</span>
                                    <div className="h-px bg-gray-700 flex-1"></div>
                                </div>
                                <div className="space-y-2">
                                    {roundDescs.map((desc, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                                                {desc.name[0]}
                                            </div>
                                            <div className="bg-slate-800 p-2 rounded-r-lg rounded-bl-lg text-xs border border-gray-700/50">
                                                <span className="font-bold text-gray-400 block text-[10px] mb-0.5">{desc.name}</span>
                                                {desc.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* CURRENT ROUND */}
                        {descriptions.length > 0 && (
                            <div className="space-y-4">
                                {history.length > 0 && (
                                    <div className="flex items-center gap-2 mb-2 mt-4">
                                        <div className="h-px bg-primary/30 flex-1"></div>
                                        <span className="text-xs font-bold text-primary tracking-widest">CURRENT ROUND</span>
                                        <div className="h-px bg-primary/30 flex-1"></div>
                                    </div>
                                )}
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
                            </div>
                        )}

                        {descriptions.length === 0 && history.length === 0 && phase === 'DESCRIPTION' && (
                            <div className="text-center text-gray-500 italic mt-10">Start describing...</div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* SPACER */}
            <div className="h-32 w-full"></div>

            {/* BOTTOM DOCK */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur border-t border-gray-700 z-50 flex flex-col pb-safe">

                {/* 1. REACTIONS OVERLAY (Conditional) */}
                {showReactions && (
                    <div className="absolute bottom-20 left-4 bg-slate-800 border border-gray-600 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom-2 flex gap-2 overflow-x-auto max-w-[90vw]">
                        {['😂', '🤔', '😡', '👏', '👻', '👎', '❤️', '🔥'].map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleReaction(emoji)}
                                className="text-2xl hover:scale-125 transition-transform p-1 active:scale-95"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* 2. MAIN INPUT BAR */}
                <div className="p-3 flex items-end gap-2 w-full max-w-4xl mx-auto">

                    {/* REACTION TOGGLE */}
                    <button
                        onClick={() => setShowReactions(!showReactions)}
                        className={clsx(
                            "p-3 rounded-xl transition-all shadow-lg active:scale-95 border",
                            showReactions ? "bg-primary text-white border-primary" : "bg-slate-800 text-gray-300 border-gray-600 hover:bg-slate-700"
                        )}
                    >
                        <Smile size={24} />
                    </button>

                    {/* TEXT INPUT (Only if my turn) - OR PLACEHOLDER */}
                    {phase === 'DESCRIPTION' && isMyTurn && me.isAlive ? (
                        <div className="flex-1 flex gap-2 animate-in fade-in">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Describe your word..."
                                className="flex-1 bg-slate-800 border-2 border-primary rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-accent"
                                value={inputDesc}
                                onChange={e => setInputDesc(e.target.value)}
                                onFocus={handleInputFocus}
                                onBlur={() => socket.emit('typing_stop', { roomId: room.id })}
                                onKeyDown={e => e.key === 'Enter' && submitDesc()}
                                maxLength={200}
                                autoFocus
                            />
                            <button
                                onClick={submitDesc}
                                className="bg-gradient-to-r from-primary to-violet-600 text-white p-3 rounded-xl font-bold shadow-lg active:scale-95"
                            >
                                <Send size={24} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 bg-slate-900/50 border border-gray-700 rounded-xl p-3 text-center text-gray-500 text-sm">
                            {phase === 'DESCRIPTION' ? (
                                turnId !== myId ? `${room?.players?.find(p => p.id === turnId)?.name || 'Someone'} is thinking...` : "You are eliminated."
                            ) : "Voting in progress..."}
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

            {/* FLOATING REACTIONS LAYER (Pointer events none allows clicking through) */}
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

        </div>
    );
};

export default GameRoom;
