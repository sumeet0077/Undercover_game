import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/game_provider.dart';
import 'screens/landing_screen.dart';
import 'core/theme.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => GameProvider()),
      ],
      child: const SigmaBluffApp(),
    ),
  );
}

class SigmaBluffApp extends StatelessWidget {
  const SigmaBluffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SigmaBluff',
      theme: AppTheme.darkTheme,
      home: const LandingScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
