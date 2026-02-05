# SigmaBluff Project Context
**Brand Name:** SigmaBluff (One word for brand, "Sigma Bluff" for SEO)

## 🎨 Branding & Design
*   **Theme:** "Cool, Independent, Mastermind." Dark mode, neon accents, sleek UI.
*   **Colors (from Web Client):**
    *   **Background:** Dark Slate/Black (`#0f172a` / `bg-slate-900`)
    *   **Primary:** Violet/Purple (`#8b5cf6` / `text-primary`)
    *   **Secondary:** Pink/Rose (`#ec4899`)
    *   **Accents:** Cyan (Civilian), Red (Undercover/Eliminated), Orange (Mr. White).
*   **Typography:** Modern Sans-serif (Inter/Roboto).

## 🎮 Game Rules Summary
1.  **Roles:**
    *   **Civilian:** Knows the major word. Goal: Find the Undercover.
    *   **Undercover:** Knows a slightly different minor word. Goal: Blend in.
    *   **Mr. White:** Knows NO word. Goal: Guess the civilian word correctly.
2.  **Flow:**
    *   **Description Phase:** Players take turns giving 1-word/short descriptions.
    *   **Voting Phase:** Players discuss and vote to eliminate someone.
    *   **Result:** Majority vote eliminates. Ties/Skips move to next round.
3.  **Win Conditions (Updated v1.0.0):**
    *   **Civilians Win:** If NO Undercovers/Mr.Whites are alive.
    *   **Undercovers Win:** If `Undercovers > Civilians`.
    *   **1v1:** Undercover wins instantly.
    *   **2v2 (Tie):** Game **CONTINUES** (This is a custom rule fix).

## 📂 Project Structure
*   `server/`: Node.js + Socket.IO Backend.
*   `client/`: React Web Client.
*   `mobile/`: **(Your Workspace)** Flutter/Dart Client.

## 🛠️ Critical Logic Notes for Mobile Dev
*   **Rejoin Handling:** The server migrates updated socket IDs automatically, but the client MUST send `rejoin_game` on app resume/restart.
*   **State Sync:** Use `room_update` as the absolute source of truth. Do not rely solely on incremental events (`phase_change`), always check `room.phase`.
*   **Typing Indicators:** Mobile keyboards can be tricky. Send `typing_start` on focus and `typing_stop` on blur/submit.
