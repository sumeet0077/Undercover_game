# Game Logic & Win Scenarios

This document explains the exact logic rules used by the `GameManager` to determine when the game ends and who wins. It specifically covers how **The Sigma** (Undercover) and **The Glitch** (Mr. White) interact.

## 🧠 Core Rule: The "Bad" Team
In the code, **The Sigma** and **The Glitch** are effectively on the same team for the purpose of *ending* the game. They share the goal of eliminating the Civilians (The Pack).

- **Team Good (The Pack)** = `CIVILIAN`
- **Team Bad (The Imposters)** = `UNDERCOVER` + `MR_WHITE`

## 🏆 Win Conditions

The game checks for a winner after every elimination.

### 1. The Pack Wins (Civilians)
**Condition**: All Imposters are eliminated.
- `Alive Bad Team == 0`

### 2. The Imposters Win (Sigmas / Glitch)
**Condition**: The Imposters outnumber or stalemate the Civilians.
- Rule A: `Alive Bad Team > Alive Good Team` (Overwhelming force)
- Rule B: `Alive Bad Team == Alive Good Team` AND `Alive Good Team == 1` (1v1 Stalemate Breaker)
    - *Note: In a 1v1, the Imposter wins immediately because the Civilian cannot vote them out alone.*

### 3. Game Continues
**Condition**: Any other ratio (e.g., 2 Good vs 2 Bad).
- *Reason*: If it is 2 vs 2, the Good team still has a voting chance if they coordinate perfectly (or if confusion happens). The game lets them play.

---

## 🧪 Scenarios & Combinations

Here is how specific setups play out based on these rules.

### Scenario A: Standard (1 Sigma)
**Setup**: 3 Players (1 Sigma, 2 Civilians)
1.  **Start**: 1 Bad vs 2 Good. Game ON.
2.  **Vote**: Civilians eliminate Sigma.
    - Result: 0 Bad vs 2 Good. **PACK WINS**.
3.  **Vote**: They eliminate a Civilian instead.
    - Result: 1 Bad vs 1 Good. **SIGMA WINS** (1v1 Rule).

### Scenario B: The Glitch Solo
**Setup**: 3 Players (1 Glitch, 2 Civilians)
- Logic is identical to Scenario A. The Glitch is counted exactly like a Sigma for win/loss math.
- **Difference**: The Glitch has no word, so they are harder to detect (or easier if they guess wrong).

### Scenario C: Sigma + Glitch (The Duo)
**Setup**: 5 Players (1 Sigma, 1 Glitch, 3 Civilians)
- Team Bad: 2
- Team Good: 3

**Path 1: Bad Guys Dominate**
1.  Vote 1: A Civilian is eliminated.
    - Count: 2 Bad vs 2 Good.
    - Result: **Game Continues**.
2.  Vote 2: Another Civilian is eliminated.
    - Count: 2 Bad vs 1 Good.
    - Result: **IMPOSTERS WIN** (Bad > Good).

**Path 2: The Pack Strikes Back**
1.  Vote 1: The Glitch is eliminated.
    - Count: 1 Bad (Sigma) vs 3 Good.
    - Result: **Game Continues**.
2.  Vote 2: The Sigma is eliminated.
    - Count: 0 Bad vs 3 Good.
    - Result: **PACK WINS**.

### Scenario D: The "Chaos" Draw (2v2)
**Setup**: 4 Remaining (1 Sigma, 1 Glitch, 2 Civilians)
- Logic checks: `2 Bad vs 2 Good`.
- Is Bad > Good? No.
- Is 1v1? No.
- **Result**: Game Continues.
- *Why?* Theoretically, the 2 Civilians *could* figure it out and vote together. If the Bad guys split their votes or vote for each other by mistake, the Civilians can still win.

## 📝 Functional Logic (Code Reference)

```javascript
// server/gameManager.js
checkWinCondition(room) {
    const aliveCivilians = room.players.filter(p => p.isAlive && p.role === 'CIVILIAN').length;
    
    // Glitch and Sigma count as ONE force
    const aliveUndercovers = room.players.filter(p => p.isAlive && (p.role === 'UNDERCOVER' || p.role === 'MR_WHITE')).length;

    // 1. Pack Victory
    if (aliveUndercovers === 0) return 'CIVILIANS';

    // 2. Imposter Victory (Majority)
    if (aliveUndercovers > aliveCivilians) return 'UNDERCOVERS';
    
    // 3. Imposter Victory (1v1)
    if (aliveUndercovers === aliveCivilians && aliveCivilians === 1) return 'UNDERCOVERS';

    // 4. Continue
    return null;
}
```
