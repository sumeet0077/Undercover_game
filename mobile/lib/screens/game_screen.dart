import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:audioplayers/audioplayers.dart';
import '../providers/game_provider.dart';
import '../core/theme.dart';
import 'landing_screen.dart';
import 'lobby_screen.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with WidgetsBindingObserver {
  final TextEditingController _descController = TextEditingController();
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _hasPlayedGameOverSound = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _audioPlayer.dispose();
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

    // Handle Win Sounds
    if (gameProvider.gameResult != null && !_hasPlayedGameOverSound) {
      _hasPlayedGameOverSound = true;
      final winners = gameProvider.gameResult!['winners'];
      final isCivilianWin = winners == 'CIVILIANS';
      // Play sound
      _audioPlayer.play(AssetSource('sounds/${isCivilianWin ? 'civilian_win.wav' : 'undercover_win.wav'}'));
    } else if (gameProvider.gameResult == null) {
      _hasPlayedGameOverSound = false;
    }

    if (room == null || room.status == 'LOBBY') {
       WidgetsBinding.instance.addPostFrameCallback((_) {
         Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => 
            room == null ? const LandingScreen() : const LobbyScreen()));
       });
       return const SizedBox();
    }

    // Determine content based on Phase
    Widget content;
    String title;

    switch (room.phase) {
      case 'DESCRIPTION':
        title = 'DESCRIBE YOUR WORD';
        content = _buildDescriptionPhase(context, gameProvider);
        break;
      case 'VOTING':
        title = 'VOTE TO ELIMINATE';
        content = _buildVotingPhase(context, gameProvider);
        break;
      case 'GAMEOVER':
        title = 'MISSION REPORT';
        content = _buildGameOver(context, gameProvider);
        break;
      default:
        title = 'UNKNOWN PHASE';
        content = const Center(child: Text('Waiting...'));
    }

    final me = room.players.firstWhere((p) => p.id == gameProvider.socketId, orElse: () => room.players.first);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: me.isHost ? IconButton(
          icon: const Icon(Icons.close, color: Colors.red),
          onPressed: () {
            showDialog(
              context: context,
              builder: (_) => AlertDialog(
                backgroundColor: AppTheme.surface,
                title: const Text('End Game?', style: TextStyle(color: Colors.white)),
                content: const Text('This will end the game for everyone.', style: TextStyle(color: Colors.white70)),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                  TextButton(
                    onPressed: () {
                      gameProvider.endGame();
                      Navigator.pop(context);
                    },
                    child: const Text('END GAME', style: TextStyle(color: Colors.red)),
                  ),
                ],
              ),
            );
          },
        ) : null,
        actions: [
          // Role Reveal Toggle or Info
           IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => _showRoleDialog(context, gameProvider),
          ),
          IconButton(
            icon: const Icon(Icons.exit_to_app, color: Colors.white70),
            onPressed: () {
              showDialog(
                context: context, 
                builder: (c) => AlertDialog(
                  title: const Text('Leave Game?', style: TextStyle(color: Colors.black)),
                  content: const Text('Are you sure you want to leave the running game?', style: TextStyle(color: Colors.black)),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
                    TextButton(onPressed: () {
                      Navigator.pop(c);
                      gameProvider.leaveRoom();
                    }, child: const Text('Leave', style: TextStyle(color: Colors.red))),
                  ],
                )
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          // Main Content
          SafeArea(
            child: Column(
              children: [
                // Top Bar: Round & Players Alive
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('ROUND ${room.round}', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                      Text('${room.players.where((p) => p.isAlive).length} Agents Alive', style: TextStyle(color: Colors.white70)),
                    ],
                  ),
                ),
                
                // Re-roll button for Host in Description Phase
                 if (room.phase == 'DESCRIPTION' && me.isHost)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                         onPressed: () => gameProvider.reshuffleWords(),
                         icon: const Icon(Icons.refresh, size: 16, color: Colors.orange),
                         label: const Text('Re-roll Words', style: TextStyle(color: Colors.orange, fontSize: 12)),
                      ),
                    ),
                  ),
                
                Expanded(child: content),
              ],
            ),
          ),

          // Elimination Popup Overlay
          if (gameProvider.eliminatedInfo != null)
            Container(
              color: Colors.black.withValues(alpha: 0.85),
              child: Center(
                child: Container(
                  margin: const EdgeInsets.all(32),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        gameProvider.eliminatedInfo!['result'] == 'Tie' ? 'TIE - NO ELIMINATION' :
                        gameProvider.eliminatedInfo!['result'] == 'Skipped' ? 'VOTE SKIPPED' : 'ELIMINATED',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      if (gameProvider.eliminatedInfo!['eliminated'] != null) ...[
                        const SizedBox(height: 16),
                        const Text('💀', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 8),
                        Text(
                          gameProvider.eliminatedInfo!['eliminated']['name'] ?? '',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.red),
                        ),
                        Text(
                          'was a ${gameProvider.eliminatedInfo!['eliminated']['role'] ?? 'Unknown'}',
                          style: const TextStyle(color: Colors.white70),
                        ),
                      ],
                      const SizedBox(height: 16),
                      const Text('Next round starting soon...', style: TextStyle(color: Colors.white38, fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),

          // Floating Reactions Layer
          ...gameProvider.reactions.map((r) => Positioned(
            bottom: 80,
            left: (r['left'] as int).toDouble(),
            child: Text(r['emoji'] ?? '🔥', style: const TextStyle(fontSize: 32))
                .animate()
                .fadeIn()
                .slideY(begin: 0, end: -2, duration: 1500.ms)
                .fadeOut(delay: 1000.ms),
          )),

          // Game Over Overlay
          if (gameProvider.gameResult != null)
            Container(
              color: Colors.black.withValues(alpha: 0.9),
              child: SafeArea(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${gameProvider.gameResult!['winners']} WIN!',
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.amber,
                          ),
                        ).animate().scale(duration: 300.ms),
                        const SizedBox(height: 24),
                        Expanded(
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: (gameProvider.gameResult!['allRoles'] as List?)?.length ?? 0,
                            itemBuilder: (context, index) {
                              final player = (gameProvider.gameResult!['allRoles'] as List)[index];
                              final isUndercover = player['role'] == 'UNDERCOVER';
                              return Container(
                                margin: const EdgeInsets.symmetric(vertical: 4),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.surface.withValues(alpha: 0.5),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(player['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16)),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          player['role'] ?? '',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: isUndercover ? Colors.red : Colors.green,
                                          ),
                                        ),
                                        Text(player['word'] ?? '', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => gameProvider.returnToLobby(gameProvider.room!.id),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
                            ),
                            child: const Text('RETURN TO LOBBY', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showReactionPicker(BuildContext context, GameProvider provider) {
    final emojis = ['😂', '🤔', '😡', '👏', '👻', '👎', '❤️', '🔥'];
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Wrap(
          alignment: WrapAlignment.center,
          spacing: 16,
          runSpacing: 16,
          children: emojis.map((emoji) => GestureDetector(
            onTap: () {
              provider.sendReaction(emoji);
              Navigator.pop(context);
            },
            child: Text(emoji, style: const TextStyle(fontSize: 32)),
          )).toList(),
        ),
      ),
    );
  }

  Widget _buildDescriptionPhase(BuildContext context, GameProvider provider) {
    final room = provider.room!;
    final currentPlayer = room.currentPlayer;
    final isMyTurn = currentPlayer?.id == provider.socketId;

    return Column(
      children: [
        // Role Card (Mini)
        Container(
          width: double.infinity,
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [AppTheme.surface, AppTheme.background]),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white12),
          ),
          child: Column(
            children: [
              Text('YOUR WORD', style: TextStyle(color: AppTheme.textMuted, fontSize: 10, letterSpacing: 1.5)),
              const SizedBox(height: 4),
              Text(provider.myWord ?? '???', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
            ],
          ),
        ),

        const Divider(color: Colors.white10),

         // History + Current Descriptions
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Previous Rounds History
              ...room.previousRounds.asMap().entries.map((entry) {
                final roundIdx = entry.key;
                final roundDescs = entry.value;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          const Expanded(child: Divider(color: Colors.white24)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text('ROUND ${roundIdx + 1}', style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                          const Expanded(child: Divider(color: Colors.white24)),
                        ],
                      ),
                    ),
                    ...roundDescs.map((desc) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.surface.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Text('${desc['name']}:', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white54)),
                          const SizedBox(width: 8),
                          Text('${desc['text']}', style: const TextStyle(color: Colors.white54)),
                        ],
                      ),
                    )),
                  ],
                );
              }),
              
              // Current Round Separator
              if (room.previousRounds.isNotEmpty && room.descriptions.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Expanded(child: Divider(color: AppTheme.primary.withValues(alpha: 0.5))),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text('CURRENT ROUND', style: TextStyle(color: AppTheme.primary, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                      Expanded(child: Divider(color: AppTheme.primary.withValues(alpha: 0.5))),
                    ],
                  ),
                ),
              
              // Current Round Descriptions
              ...room.descriptions.map((desc) => Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                     Text('${desc['name']}:', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                     const SizedBox(width: 8),
                     Text('${desc['text']}', style: const TextStyle(color: Colors.white)),
                  ],
                ),
              ).animate().fadeIn().slideX(begin: 0.1)),
            ],
          ),
        ),

        // Turn Indicator / Input
        Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: isMyTurn 
          ? Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.emoji_emotions_outlined, color: Colors.white54),
                  onPressed: () => _showReactionPicker(context, provider),
                ),
                Expanded(
                  child: TextField(
                    controller: _descController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'Describe...',
                      filled: true,
                      fillColor: Colors.black26,
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(24))),
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.arrow_upward, color: AppTheme.primary),
                  onPressed: () {
                    if (_descController.text.isNotEmpty) {
                      provider.submitDescription(_descController.text.trim());
                      _descController.clear();
                    }
                  },
                ),
              ],
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                 const CircularProgressIndicator.adaptive(),
                 const SizedBox(width: 16),
                 Text('Waiting for ${currentPlayer?.name}...', style: const TextStyle(color: Colors.white70)),
              ],
            ),
        ),
      ],
    );
  }

  Widget _buildVotingPhase(BuildContext context, GameProvider provider) {
    final room = provider.room!;
    final me = room.players.firstWhere((p) => p.id == provider.socketId, orElse: () => room.players[0]);
    final hasVoted = room.votes.containsKey(provider.socketId);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
               const Text('Who is the Undercover?', style: TextStyle(color: Colors.white70)),
               Container(
                 padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                 decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(8)),
                 child: Text(
                   '${room.votes.length}/${room.players.where((p) => p.isAlive).length} Voted',
                   style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                 ),
               )
            ],
          ), 
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(16),
             gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.0,
              ),
            itemCount: room.players.length,
            itemBuilder: (context, index) {
              final player = room.players[index];
              // final isTarget = player.isAlive; // Unused
              final voteCount = room.votes.values.where((v) => v == player.id).length;
              final isSelected = hasVoted && room.votes[provider.socketId] == player.id;
              
              if (!player.isAlive) {
                 return Opacity(
                   opacity: 0.5,
                   child: Container(
                      decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
                      alignment: Alignment.center,
                      child: Column(children: [
                        Text(player.avatar, style: const TextStyle(fontSize: 40)),
                        Text(player.name, style: const TextStyle(decoration: TextDecoration.lineThrough)),
                        const Text('ELIMINATED', style: TextStyle(color: Colors.red, fontSize: 10)),
                      ]),
                   ),
                 );
              }

              final canVote = !hasVoted && me.isAlive && player.id != provider.socketId;

              return GestureDetector(
                onTap: canVote ? () => provider.submitVote(player.id) : null,
                child: Container(
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.primary.withValues(alpha: 0.2) : AppTheme.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppTheme.primary : Colors.transparent, width: 2
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Badge(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        label: Text('$voteCount'),
                        isLabelVisible: voteCount > 0,
                        backgroundColor: AppTheme.secondary,
                        child: Text(player.avatar, style: const TextStyle(fontSize: 40)),
                      ),
                      const SizedBox(height: 8),
                      Text(player.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      // Show VOTED if this player has cast their vote
                      if (room.votes.containsKey(player.id))
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('✓ VOTED', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                        )
                    ],
                  ),
                ).animate().scale(duration: 200.ms),
              );
            },
          ),
        ),
        if (!hasVoted && me.isAlive)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                   onPressed: () => provider.submitVote('SKIP'),
                   style: OutlinedButton.styleFrom(
                     side: const BorderSide(color: Colors.grey),
                     padding: const EdgeInsets.symmetric(vertical: 16),
                   ),
                   child: const Text('SKIP VOTE', style: TextStyle(color: Colors.grey)),
                ),
              ),
            ),

        if (!me.isAlive)
          Container(
             padding: const EdgeInsets.all(16),
             color: Colors.red.withValues(alpha: 0.2),
             width: double.infinity,
             child: const Text('YOU ARE ELIMINATED. SPECTATING.', textAlign: TextAlign.center, style: TextStyle(color: Colors.red)),
          ),
      ],
    );
  }

  Widget _buildGameOver(BuildContext context, GameProvider provider) {
    // We could show winners here based on last room state
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('MISSION ACCOMPLISHED', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primary)),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => provider.returnToLobby(provider.room!.id), // Oops, need to implement returnToLobby in provider or just leave
            child: const Text('RETURN TO BASE'),
          ),
          const SizedBox(height: 32),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.room!.players.length,
              itemBuilder: (context, index) {
                final p = provider.room!.players[index];
                return Card(
                  color: AppTheme.surface,
                  child: ListTile(
                    leading: Text(p.avatar, style: const TextStyle(fontSize: 24)),
                    title: Text(p.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    subtitle: Text(p.word ?? 'Unknown', style: const TextStyle(color: Colors.white70)),
                    trailing: Text(p.role ?? 'Unknown', 
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: p.role == 'CIVILIAN' ? Colors.greenAccent : Colors.redAccent
                      )
                    ),
                  ),
                );
              },
            ),
          )
        ],
      ),
    );
  }

  void _showRoleDialog(BuildContext context, GameProvider provider) {
    showDialog(
      context: context, 
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('TOP SECRET', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('ROLE: ${provider.myRole ?? "Unknown"}', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            Text('WORD: ${provider.myWord ?? "???"}', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      )
    );
  }
}
