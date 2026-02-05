import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../providers/game_provider.dart';
import '../core/theme.dart';
import 'lobby_screen.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _roomController = TextEditingController();
  bool _isJoining = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final name = context.read<GameProvider>().playerName;
      if (name.isNotEmpty) {
        _nameController.text = name;
      }
    });
  }

  void _createRoom() async {
    final gameProvider = context.read<GameProvider>();
    if (_nameController.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your name')));
        return;
    }
    await gameProvider.setPlayerName(_nameController.text.trim());
    gameProvider.createRoom();
  }

  void _joinRoom() async {
    final gameProvider = context.read<GameProvider>();
    if (_nameController.text.trim().isEmpty) {
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter your name')));
         return;
    }
    if (_roomController.text.trim().isEmpty) {
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter Room ID')));
         return;
    }
    await gameProvider.setPlayerName(_nameController.text.trim());
    gameProvider.joinRoom(_roomController.text.trim().toUpperCase());
  }

  @override
  Widget build(BuildContext context) {
    final gameProvider = context.watch<GameProvider>();

    if (gameProvider.room != null) {
       WidgetsBinding.instance.addPostFrameCallback((_) {
         Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LobbyScreen()));
       });
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(gameProvider.isConnected ? Icons.wifi : Icons.wifi_off, 
              color: gameProvider.isConnected ? Colors.green : Colors.red),
            onPressed: () {
               ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(gameProvider.isConnected ? 'Connected to Server' : 'Disconnected from Server')));
            },
          )
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('SIGMA\nBLUFF', 
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -2,
                  height: 0.9,
                ),
              ).animate().fadeIn().scale(),
              
              TextButton.icon(
                onPressed: () async {
                  final result = await context.read<GameProvider>().checkServerHealth();
                  if (context.mounted) {
                    showDialog(context: context, builder: (c) => AlertDialog(
                      title: const Text('Connection Test', style: TextStyle(color: Colors.black)),
                      content: Text(result, style: const TextStyle(color: Colors.black)),
                      actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('OK'))],
                    ));
                  }
                },
                icon: const Icon(Icons.bolt, color: Colors.white54, size: 16),
                label: const Text('Test Connectivity', style: TextStyle(color: Colors.white54, fontSize: 12)),
              ),
              
              const SizedBox(height: 32),

              TextField(
                controller: _nameController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Your Agent Name',
                  filled: true,
                  fillColor: AppTheme.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.person, color: Colors.white70),
                  labelStyle: const TextStyle(color: Colors.white70),
                ),
              ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.2),

              const SizedBox(height: 24),

              if (_isJoining) ...[
                TextField(
                  controller: _roomController,
                  style: const TextStyle(color: Colors.white),
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    labelText: 'Room Code',
                    filled: true,
                    fillColor: AppTheme.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.key, color: Colors.white70),
                    labelStyle: const TextStyle(color: Colors.white70),
                  ),
                ).animate().fadeIn().slideY(begin: 0.2),
                const SizedBox(height: 24),
              ],

              if (gameProvider.isLoading)
                const CircularProgressIndicator()
              else ...[
                if (_isJoining)
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() => _isJoining = false), 
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.white),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
                          ),
                          child: const Text('Back', style: TextStyle(color: Colors.white)),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _joinRoom, 
                          child: const Text('Join Mission'),
                        ),
                      ),
                    ],
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                       ElevatedButton(
                         onPressed: _createRoom,
                         child: const Text('CREATE MISSION'),
                       ),
                       const SizedBox(height: 16),
                       OutlinedButton(
                         onPressed: () => setState(() => _isJoining = true),
                         style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppTheme.primary),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
                          ),
                         child: const Text('JOIN MISSION', style: TextStyle(color: AppTheme.primary)),
                       ),
                    ],
                  ),
              ].animate(interval: 100.ms).fadeIn(delay: 400.ms),
              
              if (gameProvider.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Text(gameProvider.errorMessage!, 
                    style: const TextStyle(color: AppTheme.undercover),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
