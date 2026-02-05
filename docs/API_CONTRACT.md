# SigmaBluff Socket.IO API Contract
**Version:** 1.0.0
**Server Endpoint:** `<VITE_SERVER_URL>`

## 🔄 Connection Flow
1.  **Connect:** Client connects via `socket.io-client`.
2.  **Rejoin:** On `connect`, emit `rejoin_game` with `{ roomId, playerName }` if stored locally.

---

## 📤 Client Emits (Actions)

| Event | Payload | Description |
| :--- | :--- | :--- |
| `create_room` | `{ playerName }` | Create a new lobby. |
| `join_room` | `{ roomId, playerName }` | Join an existing lobby. |
| `rejoin_game` | `{ roomId, playerName }` | Attempt to reconnect after disconnect/refresh. |
| `start_game` | `{ roomId, config: { ucCount, mrWhiteCount, showRole } }` | Host only. Starts the game. |
| `submit_description` | `{ roomId, description }` | Submit word description (Phase: DESCRIPTION). |
| `submit_vote` | `{ roomId, targetId }` | Vote for a player or 'SKIP' (Phase: VOTING). |
| `typing_start` | `{ roomId }` | Notify others that typing began. |
| `typing_stop` | `{ roomId }` | Notify others that typing stopped. |
| `send_reaction` | `{ roomId, emoji }` | Send a floating emoji reaction. |
| `reshuffle_words` | `{ roomId }` | Host only. Reroll words mid-game. |
| `leave_room` | `{ roomId }` | Player leaves the lobby or game. |
| `end_game` | `{ roomId }` | Host only. Destroy room and kick everyone. |
| `return_to_lobby` | `{ roomId }` | Return to lobby after Game Over. |
| `request_sync` | `{ roomId }` | Request full room state (useful for mobile app resume). |

---

## 📥 Server Emits (Listeners)

### Room & Game State
| Event | Payload | Description |
| :--- | :--- | :--- |
| `room_created` | `{ roomId, room }` | Acknowledgment of room creation. |
| `room_update` | `room` (Object) | **CRITICAL.** The full source of truth. Sync local state to this object. |
| `game_started` | `{ status, phase, currentTurn }` | Game has begun. Switch UI to Game Screen. |
| `your_info` | `{ role, word }` | Private message with player's secret role/word. |
| `phase_change` | `{ phase }` | 'DESCRIPTION' -> 'VOTING' -> 'GAMEOVER'. |
| `next_turn` | `{ currentTurn }` | Socket ID of the player whose turn it is. |
| `new_round` | `{ phase, currentTurn }` | New round started (Descriptions cleared). |
| `game_over` | `{ winners, allRoles }` | Game ended. Show results screen. |
| `room_destroyed` | `null` | Host ended game. Reset to Landing. |

### Real-time Feed
| Event | Payload | Description |
| :--- | :--- | :--- |
| `update_descriptions` | `[ { playerId, name, text } ]` | List of descriptions for current round. |
| `update_votes` | `{ count, total, votes: { voterId: targetId } }` | Real-time voting progress. |
| `voting_result` | `{ result, eliminated: { name, role } }` | Outcome of voting (Eliminated/Tie/Skipped). |
| `player_typing` | `{ playerId, isTyping }` | Show/hide typing indicator bubbles. |
| `receive_reaction` | `{ emoji, id }` | Show floating reaction animation. |
| `notification` | `{ message }` | Show toast/alert message. |
| `error` | `message` (String) | Show error toast. |

---

## 🧩 Data Structures

### Room Object
```javascript
{
  id: "ABCD",
  status: "LOBBY" | "PLAYING" | "GAMEOVER",
  phase: "DESCRIPTION" | "VOTING",
  players: [
    { id, name, isHost, isAlive, avatar }
  ],
  currentTurnIndex: 0,
  descriptions: [],
  votes: { "socketId1": "targetId1" },
  round: 1,
  previousRounds: [ [] ] // History
}
```
