import 'dart:async';
import 'dart:io';
import 'package:flutter_tts/flutter_tts.dart';

class TtsService {
  // Singleton pattern
  static final TtsService instance = TtsService._internal();

  factory TtsService() {
    return instance;
  }

  TtsService._internal();

  final FlutterTts _flutterTts = FlutterTts();
  bool _isInitialized = false;
  bool _isSpeaking = false;
  final List<String> _queue = [];
  Timer? _retryTimer;

  /// Initialize TTS engine and "warm up" on Android
  Future<void> init() async {
    if (_isInitialized) return;

    try {
      print("[TTS] Initializing...");
      
      // Basic Setup
      await _flutterTts.setLanguage("en-US");
      await _flutterTts.setSpeechRate(0.5); // Slower for clarity
      await _flutterTts.setVolume(1.0);
      await _flutterTts.setPitch(1.0);

      // Crucial for serialized playback
      await _flutterTts.awaitSpeakCompletion(true);

      // Setup Listeners
      _flutterTts.setStartHandler(() {
        print("[TTS] Started playing");
        _isSpeaking = true;
      });

      _flutterTts.setCompletionHandler(() {
        print("[TTS] Completed");
        _isSpeaking = false;
        _processQueue(); // Play next
      });

      _flutterTts.setErrorHandler((msg) {
        print("[TTS] Error: $msg");
        _isSpeaking = false;
        // On error, wait small delay then try next
        Future.delayed(const Duration(milliseconds: 500), _processQueue);
      });

      // Voice Selection (Heuristic preference for Female voice)
      try {
        var voices = await _flutterTts.getVoices;
        if (voices != null && voices is List) {
           final voice = voices.firstWhere((v) {
              final name = v['name'].toString().toLowerCase();
              return name.contains('female') || 
                     name.contains('samantha') ||
                     name.contains('en-us-x-sfg');
           }, orElse: () => null);
           
           if (voice != null) {
             await _flutterTts.setVoice({"name": voice["name"], "locale": voice["locale"]});
             print("[TTS] Set voice to: ${voice['name']}");
           }
        }
      } catch (e) {
        print("[TTS] Voice selection failed: $e");
      }

      _isInitialized = true;

      // ANDROID WARMUP: Bind the service immediately
      if (Platform.isAndroid) {
        print("[TTS] Warming up Android engine...");
        // Speak silence. specific syntax for some engines, or just empty space.
        // " " is usually sufficient to trigger binding without audible noise.
        await _flutterTts.speak(" "); 
      }

    } catch (e) {
      print("[TTS] Init failed: $e");
    }
  }

  /// Add message to queue and play if idle
  Future<void> speak(String text) async {
    if (text.trim().isEmpty) return;
    
    // If not initialized, try to init (lazy loading fallback)
    if (!_isInitialized) await init();

    print("[TTS] Queued: $text");
    _queue.add(text);
    _processQueue();
  }

  void _processQueue() async {
    if (_isSpeaking || _queue.isEmpty) return;

    final text = _queue.removeAt(0);
    _isSpeaking = true;

    try {
      print("[TTS] Speaking: $text");
      // On some older Androids, speak returns 1 (success) or 0 (fail).
      // awaitSpeakCompletion(true) makes this Future wait until done.
      var result = await _flutterTts.speak(text);
      if (result == 0) {
         // 0 often means "Service not bound" on first try.
         // Retry once after delay.
         print("[TTS] Speak returned 0. Retrying...");
         await Future.delayed(const Duration(milliseconds: 500));
         await _flutterTts.speak(text);
      }
    } catch (e) {
      print("[TTS] Speak exception: $e");
      _isSpeaking = false;
      _processQueue(); // Skip to next
    }
  }

  Future<void> stop() async {
    _queue.clear();
    _isSpeaking = false;
    await _flutterTts.stop();
  }
}
