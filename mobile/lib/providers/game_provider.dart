import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:io' as io;
import 'dart:async'; // For Timer
import '../models/room.dart';
import '../models/player.dart';

import '../services/socket_service.dart';
import '../core/constants.dart';

class GameProvider extends ChangeNotifier {
  final SocketService _socketService = SocketService();
  
  Room? _room;
  String _playerName = '';
  String? _myRole;
  String? _myWord;
  bool _isLoading = false;
  String? _errorMessage;

  // New state for feature parity
  Map<String, dynamic>? _eliminatedInfo;
  String? _typingPlayerId;
  bool _isTyping = false;
  final List<Map<String, dynamic>> _reactions = [];
  Map<String, dynamic>? _gameResult;

  Room? get room => _room;
  String get playerName => _playerName;
  String? get myRole => _myRole;
  String? get myWord => _myWord;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  
  // New getters
  Map<String, dynamic>? get eliminatedInfo => _eliminatedInfo;
  String? get typingPlayerId => _typingPlayerId;
  bool get isTyping => _isTyping;
  List<Map<String, dynamic>> get reactions => _reactions;
  Map<String, dynamic>? get gameResult => _gameResult;
  
  bool get isConnected => _socketService.isConnected;
  String? get socketId => _socketService.socketId;
  int _latency = 0;
  int get latency => _latency;
  Timer? _latencyTimer;

  GameProvider() {
    _socketService.initSocket();
    _initSocketListeners();
    _loadLocalState();
  }

  void _loadLocalState() async {
    final prefs = await SharedPreferences.getInstance();
    _playerName = prefs.getString('playerName') ?? '';
    String? lastRoomId = prefs.getString('lastRoomId');
    
    if (lastRoomId != null && _playerName.isNotEmpty) {
      // Attempt rejoin logic if needed, or just let the user click "Rejoin"
      notifyListeners();
    }
  }

  Future<void> setPlayerName(String name) async {
    _playerName = name;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('playerName', name);
    notifyListeners();
  }

  void _initSocketListeners() {
    _socketService.on(AppConstants.onRoomUpdate, (data) {
      if (data != null) {
        _room = Room.fromJson(data);
        _isLoading = false;
        notifyListeners();
      }
    });

    // 0. Full Sync (Atomic Update) - The preferred way to sync
    _socketService.on('full_sync', (data) {
       if (data != null && data['room'] != null) {
          _room = Room.fromJson(data['room']);
          // We could use data['timestamp'] to correct drift if needed
          _isLoading = false;
          notifyListeners();
       }
    });

    // Fix: Listen for descriptions specifically for realtime updates
    _socketService.on(AppConstants.onUpdateDescriptions, (data) {
      if (_room != null && data is List) {
        List<Map<String, dynamic>> descs = data.map((i) => Map<String, dynamic>.from(i)).toList();
        _room = _room!.copyWith(descriptions: descs);
        notifyListeners();
      }
    });

    _socketService.on(AppConstants.onRoomCreated, (data) {
       if (data['roomId'] != null) {
         _saveRoomId(data['roomId']);
       }
       // Fix: Update room state immediately
       if (data['room'] != null) {
         _room = Room.fromJson(data['room']);
         _isLoading = false;
         notifyListeners();
       }
    });

    _socketService.on(AppConstants.onYourInfo, (data) {
      _myRole = data['role'];
      _myWord = data['word'];
      // Clear game over state when new game starts
      _gameResult = null;
      _eliminatedInfo = null;
      notifyListeners();
    });
    

    
    // Auto-Rejoin on Connection/Reconnection
    _socketService.on('connect', (_) {
      _errorMessage = null;
      _isLoading = false;
      notifyListeners();
      _startHeartbeat(); // Start latency check
      if (_room != null || (_playerName.isNotEmpty == true)) {
         rejoinGame(); 
      }
    });

    _socketService.on('reconnect', (_) {
       if (_room != null || (_playerName.isNotEmpty == true)) {
         rejoinGame(); 
      }
    });

    _socketService.on('connect_error', (data) {
      _errorMessage = 'Connection Error: $data';
      _isLoading = false;
      notifyListeners();
    });

    _socketService.on('connect_timeout', (data) {
      _errorMessage = 'Connection Timeout';
      _isLoading = false;
      notifyListeners();
    });

    _socketService.on(AppConstants.onError, (data) {
      _errorMessage = data.toString();
      _isLoading = false;
      notifyListeners();
      // Clear error after 3 seconds
      Future.delayed(const Duration(seconds: 3), () {
        _errorMessage = null;
        notifyListeners();
      });
    });

    _socketService.on('disconnect', (_) {
       _stopHeartbeat();
       notifyListeners();
    });

    // Elimination Popup
    _socketService.on(AppConstants.onVotingResult, (data) {
      _eliminatedInfo = data;
      notifyListeners();
      // Auto-clear after 4 seconds
      Future.delayed(const Duration(seconds: 4), () {
        _eliminatedInfo = null;
        notifyListeners();
      });
    });

    // Typing Indicator
    _socketService.on(AppConstants.onPlayerTyping, (data) {
      _typingPlayerId = data['playerId'];
      _isTyping = data['isTyping'] ?? false;
      notifyListeners();
      // Auto-clear after 3 seconds of silence
      if (_isTyping) {
        Future.delayed(const Duration(seconds: 3), () {
          _isTyping = false;
          _typingPlayerId = null;
          notifyListeners();
        });
      }
    });

    // Floating Reactions
    _socketService.on(AppConstants.onReceiveReaction, (data) {
      final reaction = {
        'id': data['id'], 
        'emoji': data['emoji'], 
        'left': (DateTime.now().millisecondsSinceEpoch % 80) + 10
      };
      _reactions.add(reaction);
      notifyListeners();
      // Auto-remove after 2 seconds
      Future.delayed(const Duration(seconds: 2), () {
        _reactions.removeWhere((r) => r['id'] == reaction['id']);
        notifyListeners();
      });
    });

    // Game Over - Show winners and roles
    _socketService.on(AppConstants.onGameOver, (data) {
      _gameResult = {
        'winners': data['winners'],
        'allRoles': data['allRoles'],
      };
      _eliminatedInfo = null; // Clear any elimination popup
      notifyListeners();
    });

    // --- ROBUSTNESS & PARITY LISTENERS ---

    // 1. Notification (Server Messages)
    _socketService.on(AppConstants.onNotification, (data) {
      // Show as error message temporarily (or use a separate toast channel if UI supported it)
      // For now, setting _errorMessage triggers the red banner/toast in UI
      _errorMessage = data['message'];
      notifyListeners();
      Future.delayed(const Duration(seconds: 3), () {
        if (_errorMessage == data['message']) {
          _errorMessage = null;
          notifyListeners();
        }
      });
    });

    // 2. Phase Change (Immediate UI Switch)
    _socketService.on(AppConstants.onPhaseChange, (data) {
      if (_room != null && data['phase'] != null) {
        _room = _room!.copyWith(phase: data['phase']);
        // If we switch phases, usually reactions/typing should clear
        _isTyping = false;
        notifyListeners();
      }
    });

    // 3. Next Turn (Immediate Active Player Switch)
    _socketService.on(AppConstants.onNextTurn, (data) {
      if (_room != null && data['currentTurn'] != null) {
        // Find index of player with this ID
        final nextPlayerId = data['currentTurn'];
        final index = _room!.players.indexWhere((p) => p.id == nextPlayerId);
        if (index != -1) {
          _room = _room!.copyWith(currentTurnIndex: index);
          notifyListeners();
        }
      }
    });

    // 4. New Round (Immediate Round Update)
    _socketService.on(AppConstants.onNewRound, (data) {
      if (_room != null) {
        // data usually has { phase, currentTurn, roundNumber? }
        // If server strictly sends standard NewRound payload, we assume it triggers robust room_update too.
        // But we can optimistically update phase.
        if (data['phase'] != null) {
          _room = _room!.copyWith(phase: data['phase']);
        }
        // Force a robust sync just in case logic is complex
        requestSync(); 
        notifyListeners();
      }
    });
    // 5. Update Votes (Realtime Voting Progress)
    _socketService.on(AppConstants.onUpdateVotes, (data) {
      if (_room != null && data['votes'] != null) {
        Map<String, String> newVotes = Map<String, String>.from(data['votes']);
        _room = _room!.copyWith(votes: newVotes);
        notifyListeners();
      }
    });

    // 6. Game Started (Explicit Start)
    _socketService.on(AppConstants.onGameStarted, (data) {
      if (_room != null) {
        _room = _room!.copyWith(
          status: 'PLAYING',
          phase: data['phase'],
          currentTurnIndex: _room!.players.indexWhere((p) => p.id == data['currentTurn'])
        );
        _gameResult = null;
        _eliminatedInfo = null;
        notifyListeners();
      }
    });

    // 7. Room Destroyed
    _socketService.on(AppConstants.onRoomDestroyed, (_) {
      _errorMessage = 'Room was ended by the host';
      _room = null;
      _playerName = ''; // Optional: keep name?
      _saveRoomId(''); // Clear saved room
      notifyListeners();
      Future.delayed(const Duration(seconds: 3), () {
        _errorMessage = null;
        notifyListeners();
      });
    });

    // 8. Player Disconnected
    _socketService.on(AppConstants.onPlayerDisconnected, (data) {
      // data is the name of string
      _errorMessage = '$data disconnected';
      notifyListeners();
      Future.delayed(const Duration(seconds: 3), () {
        if (_errorMessage == '$data disconnected') {
           _errorMessage = null;
           notifyListeners();
        }
      });
      // We also expect a room_update shortly to remove them or mark them dead
    });

    // 9. Vote Confirmed
    _socketService.on(AppConstants.onVoteConfirmed, (data) {
      // Optional: Visual confirmation
      // _errorMessage = "Vote Submitted"; // Using error message slot for notifications is hacky but works for now
      // notifyListeners();
    });

    // 10. Rejoin Failed
    _socketService.on(AppConstants.onRejoinFailed, (data) {
      _errorMessage = 'Rejoin failed: $data';
      _room = null;
      _isLoading = false; // Stop spinner
      _saveRoomId(''); // Clear invalid room
      notifyListeners();
    });
    
    // 11. Left Room Success
    _socketService.on(AppConstants.onLeftRoomSuccess, (_) {
      _room = null;
      notifyListeners();
    });

    // 12. Player Joined (Instant Update)
    _socketService.on(AppConstants.onPlayerJoined, (data) {
      if (_room != null && data['player'] != null) {
        final newPlayer = Player.fromJson(data['player']);
        // Check if already exists to avoid dupes
        if (!_room!.players.any((p) => p.id == newPlayer.id)) {
           List<Player> updatedPlayers = List.from(_room!.players)..add(newPlayer);
           _room = _room!.copyWith(players: updatedPlayers);
           notifyListeners();
        }
      }
    });
  }

  Future<void> _saveRoomId(String roomId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('lastRoomId', roomId);
  }

  // --- ACTIONS ---

  void createRoom() {
    if (_playerName.isEmpty) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    _socketService.emit(AppConstants.emitCreateRoom, {'playerName': _playerName});
  }

  void joinRoom(String roomId) {
    if (_playerName.isEmpty || roomId.isEmpty) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    _saveRoomId(roomId); // Optimistic save
    _socketService.emit(AppConstants.emitJoinRoom, {'roomId': roomId, 'playerName': _playerName});
  }

  void rejoinGame() async {
    final prefs = await SharedPreferences.getInstance();
    String? lastRoomId = prefs.getString('lastRoomId');
    if (lastRoomId != null && _playerName.isNotEmpty) {
      _isLoading = true;
      notifyListeners();
      _socketService.emit(AppConstants.emitRejoinGame, {'roomId': lastRoomId, 'playerName': _playerName});
    }
  }

  void startGame(int ucCount, int mrWhiteCount, bool showRole) {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitStartGame, {
      'roomId': _room!.id,
      'config': {
        'ucCount': ucCount,
        'mrWhiteCount': mrWhiteCount,
        'showRole': showRole
      }
    });
  }

  void submitDescription(String description) {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitSubmitDescription, {
      'roomId': _room!.id,
      'description': description
    });
  }

  void submitVote(String targetId) {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitSubmitVote, {
      'roomId': _room!.id,
      'targetId': targetId
    });
  }

  void returnToLobby(String roomId) {
    _gameResult = null; // Clear game over state
    _socketService.emit(AppConstants.emitReturnToLobby, {'roomId': roomId});
  }
  
  void leaveRoom() async {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitLeaveRoom, {'roomId': _room!.id});
    _room = null;
    _myRole = null;
    _myWord = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('lastRoomId');
    notifyListeners();
  }

  void reshuffleWords() {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitReshuffleWords, {'roomId': _room!.id});
  }

  void endGame() {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitEndGame, {'roomId': _room!.id});
  }

  void sendReaction(String emoji) {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitSendReaction, {'roomId': _room!.id, 'emoji': emoji});
  }

  void requestSync() {
    if (_room == null) return;
    _socketService.emit(AppConstants.emitRequestSync, {'roomId': _room!.id});
  }


  Future<String> checkServerHealth() async {
    try {
      final client = io.HttpClient();
      client.connectionTimeout = const Duration(seconds: 5);
      // Allow self-signed certs for dev/debug if needed, though we use https prod
      client.badCertificateCallback = (cert, host, port) => true; 
      
      final request = await client.getUrl(Uri.parse(AppConstants.baseUrl));
      final response = await request.close();
      
      if (response.statusCode == 200) {
        return 'Server Reachable (200 OK)';
      }
      return 'Server Status: ${response.statusCode}';
    } catch (e) {
      return 'Network Error: $e';
    }
  }

  void _startHeartbeat() {
    _stopHeartbeat();
    _latencyTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (!_socketService.isConnected) return;
      final start = DateTime.now().millisecondsSinceEpoch;
      _socketService.emitWithAck('ping', null, (_) {
        final end = DateTime.now().millisecondsSinceEpoch;
        _latency = end - start;
        notifyListeners(); // Update UI with ping
      });
    });
  }

  void _stopHeartbeat() {
    _latencyTimer?.cancel();
    _latencyTimer = null;
  }
}
