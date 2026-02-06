# Elimination Messages Logic

This document details exactly how the "Eliminated" screen messages are constructed on both Mobile and Web clients, following the recent grammar fixes.

## 📱 Mobile App (`GameScreen.dart`)

The mobile app uses a clean, centered card design to show the elimination result.

### Code Snippet
```dart
Column(
  mainAxisSize: MainAxisSize.min,
  children: [
    // 1. Header (ELIMINATED / SKIPPED / TIE)
    Text(
      gameProvider.eliminatedInfo!['result'] == 'Tie' ? 'TIE - NO ELIMINATION' :
      gameProvider.eliminatedInfo!['result'] == 'Skipped' ? 'VOTE SKIPPED' : 'ELIMINATED',
      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
    ),
    
    // 2. Player Details (Only if someone died)
    if (gameProvider.eliminatedInfo!['eliminated'] != null) ...[
      const SizedBox(height: 16),
      const Text('💀', style: TextStyle(fontSize: 48)), // Skull Icon
      const SizedBox(height: 8),
      
      // Player Name (Red)
      Text(
        gameProvider.eliminatedInfo!['eliminated']['name'] ?? '',
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.red),
      ),
      
      // Role Reveal (Grammar Fixed)
      // Format: "was [RoleName]"
      Text(
        'was ${_getRoleDisplayName(gameProvider.eliminatedInfo!['eliminated']['role'] ?? 'Unknown')}',
        style: const TextStyle(color: Colors.white70),
      ),
    ],
  ],
)
```

### Output Examples
| Scenario | Displayed Text |
| :--- | :--- |
| **Civilian Dies** | **ELIMINATED**<br>💀<br>**Sumeet**<br>was The Pack |
| **Undercover Dies** | **ELIMINATED**<br>💀<br>**Rahul**<br>was The Sigma |
| **Mr. White Dies** | **ELIMINATED**<br>💀<br>**Whitey**<br>was The Glitch |

---

## 🌐 Website (`GameRoom.jsx`)

The website uses a similar overlay logic but with HTML/Tailwind styling.

### Code Snippet
```jsx
// Header
<h2 className="text-4xl font-black text-red-500 mb-6 drop-shadow-lg tracking-widest">
    {eliminatedInfo.result === 'Tie' ? 'TIE' : 
     eliminatedInfo.result === 'Skipped' ? 'VOTE SKIPPED' : 'ELIMINATED'}
</h2>

// Details
{eliminatedInfo.eliminated && (
    <div className="mb-6">
        <div className="text-6xl mb-4">💀</div>
        {/* Player Name */}
        <div className="text-2xl font-bold text-red-500 mb-2">{eliminatedInfo.eliminated.name}</div>
        
        {/* Role Reveal (Grammar Fixed) */}
        <div className="text-gray-400">
            was <span className="text-white font-bold">{eliminatedInfo.eliminated.role}</span>
        </div>
    </div>
)}
```

### Output Examples
- **"Sumeet" (Civilian)** -> "Sumeet... was CIVILIAN" (or mapped role name)
- **"Agent" (Undercover)** -> "Agent... was UNDERCOVER" 

*Note: The web client currently displays the raw Role String (e.g., "CIVILIAN", "UNDERCOVER", "MR_WHITE") unless checking specific mapping logic. The Mobile app maps these to "The Pack", "The Sigma", "The Glitch".*

## 🛠 Server Data Source (`gameManager.js`)
The server sends this raw payload:
```json
{
  "result": "Eliminated",
  "eliminated": {
    "name": "PlayerName",
    "role": "CIVILIAN" // or "UNDERCOVER", "MR_WHITE"
  }
}
```
Client responsible for formatting "CIVILIAN" -> "The Pack".
