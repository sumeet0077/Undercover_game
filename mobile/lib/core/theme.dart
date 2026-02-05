import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color background = Color(0xFF0F172A);
  static const Color primary = Color(0xFF8B5CF6);
  static const Color secondary = Color(0xFFEC4899);
  
  static const Color civilian = Colors.cyan;
  static const Color undercover = Color(0xFFEF4444); // Red-500
  static const Color mrWhite = Color(0xFFF97316); // Orange-500
  static const Color surface = Color(0xFF1E293B); // Slate-800
  static const Color textMain = Colors.white;
  static const Color textMuted = Color(0xFF94A3B8); // Slate-400

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: secondary,
        surface: surface,
        // background: background, // Deprecated
        error: undercover,
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme).copyWith(
        bodyLarge: const TextStyle(color: textMain),
        bodyMedium: const TextStyle(color: textMain),
        titleLarge: const TextStyle(color: textMain, fontWeight: FontWeight.bold),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        ),
      ),
    );
  }
}
