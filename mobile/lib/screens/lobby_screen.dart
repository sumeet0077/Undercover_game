import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../providers/game_provider.dart';
import '../core/theme.dart';
import 'game_screen.dart';
import 'landing_screen.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> with WidgetsBindingObserver {
  int _ucCount = 1;
  int _mrWhiteCount = 0;
  bool _showRole = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      context.read<GameProvider>().requestSync();
    }
  }

  @override
  Widget build(BuildContext context) {
    final gameProvider = context.watch<GameProvider>();
    final room = gameProvider.room;

    // Navigation to GameScreen if game started
    if (room != null && (room.status == 'PLAYING' || room.status == 'GAMEOVER')) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const GameScreen()));
      });
    }

    // Back to Landing if room destroyed or left
    if (room == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LandingScreen()));
      });
      return const SizedBox(); // Empty while navigating
    }

    final isHost = room.players.firstWhere((p) => p.id == gameProvider.socketId, orElse: () => room.players.first).isHost;
    // Note: socketId might need to be compared carefully. 
    // Usually backend sends `isHost` boolean on the player object. 
    // And `socketId` in provider.
    



    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Lobby'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: () {
               gameProvider.requestSync();
               ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Syncing data...'), duration: Duration(seconds: 1)));
            },
          ),
          if (isHost)
            IconButton(
              icon: const Icon(Icons.delete_forever, color: Colors.red),
              tooltip: 'End Room',
              onPressed: () {
                 showDialog(
                  context: context, 
                  builder: (c) => AlertDialog(
                    title: const Text('End Room?', style: TextStyle(color: Colors.black)),
                    content: const Text('This will disband the lobby for everyone.', style: TextStyle(color: Colors.black)),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
                      TextButton(onPressed: () {
                        Navigator.pop(c);
                        gameProvider.endGame();
                      }, child: const Text('END ROOM', style: TextStyle(color: Colors.red))),
                    ],
                  )
                );
              },
            ),
          IconButton(
            key: const Key('exit_lobby_button'),
            icon: const Icon(Icons.exit_to_app, color: Colors.white70), // Changed from Red to White if not host, or just standard exit
            tooltip: 'Leave Lobby',
            onPressed: () {
              showDialog(
                context: context, 
                builder: (c) => AlertDialog(
                  title: const Text('Leave Lobby?', style: TextStyle(color: Colors.black)),
                  content: const Text('Are you sure you want to leave?', style: TextStyle(color: Colors.black)),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
                    TextButton(onPressed: () {
                      Navigator.pop(c); // Close dialog
                      gameProvider.leaveRoom(); // Then leave
                    }, child: const Text('Leave', style: TextStyle(color: Colors.red))),
                  ],
                )
              );
            },
          )
        ],
      ),
      body: Column(
        children: [
          // Room Code
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Text('ROOM CODE', style: TextStyle(color: AppTheme.textMuted, fontSize: 12, letterSpacing: 1.5)),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: room.id));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Room Code Copied!')));
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(room.id, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, letterSpacing: 2, color: Colors.white)),
                      const SizedBox(width: 8),
                      const Icon(Icons.copy, size: 20, color: AppTheme.primary),
                    ],
                  ),
                ),
              ],
            ),
          ).animate().fadeIn().scale(),

          // Players Grid
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.8,
              ),
              itemCount: room.players.length,
              itemBuilder: (context, index) {
                final player = room.players[index];
                return Container(
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: player.isHost ? Border.all(color: AppTheme.primary) : null,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(player.avatar, style: const TextStyle(fontSize: 32)),
                      const SizedBox(height: 8),
                      Text(player.name, 
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                      if (player.isHost)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text('HOST', style: TextStyle(color: AppTheme.primary, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                ).animate().fadeIn(delay: (index * 50).ms).slideY(begin: 0.2);
              },
            ),
          ),

          // Host Controls
          if (isHost) ...[
            Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Sigma', style: TextStyle(color: Colors.white, fontSize: 16)),
                      Row(
                        children: [
                          IconButton(onPressed: () => setState(() => _ucCount = (_ucCount > 0) ? _ucCount - 1 : 0), icon: const Icon(Icons.remove_circle_outline)),
                          Text('$_ucCount', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                          IconButton(onPressed: () => setState(() => _ucCount++), icon: const Icon(Icons.add_circle_outline)),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Glitch', style: TextStyle(color: Colors.white, fontSize: 16)),
                      Row(
                        children: [
                          IconButton(onPressed: () => setState(() => _mrWhiteCount = (_mrWhiteCount > 0) ? _mrWhiteCount - 1 : 0), icon: const Icon(Icons.remove_circle_outline)),
                          Text('$_mrWhiteCount', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                          IconButton(onPressed: () => setState(() => _mrWhiteCount++), icon: const Icon(Icons.add_circle_outline)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Show Roles?', style: TextStyle(color: Colors.white, fontSize: 16)),
                      Switch.adaptive(
                        value: _showRole,
                        onChanged: (val) => setState(() => _showRole = val),
                        activeTrackColor: AppTheme.primary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'If off, players only see their word.',
                    style: TextStyle(color: Colors.white38, fontSize: 12, fontStyle: FontStyle.italic),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        if (room.players.length < 3) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Need at least 3 players to start!'),
                              backgroundColor: Colors.red,
                            )
                          );
                          return;
                        }
                        gameProvider.startGame(_ucCount, _mrWhiteCount, _showRole);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                      ),
                      child: const Text('START MISSION', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 1)),
                    ),
                  ),
                ],
              ),
            ).animate().slideY(begin: 1, duration: 400.ms),
          ] else 
            Padding(
              padding: const EdgeInsets.all(24),
              child: const Text('Waiting for host to start...', 
                style: TextStyle(color: AppTheme.textMuted, fontStyle: FontStyle.italic)
              ).animate().fadeIn(),
            ),
        ],
      ),
    );
  }
}
