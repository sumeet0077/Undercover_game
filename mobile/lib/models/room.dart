import 'player.dart';

class Room {
  final String id;
  final String status;
  final String phase;
  final List<Player> players;
  final int currentTurnIndex;
  final List<Map<String, dynamic>> descriptions;
  final List<List<Map<String, dynamic>>> previousRounds;
  final Map<String, String> votes;
  final int round;

  Room({
    required this.id,
    required this.status,
    required this.phase,
    required this.players,
    required this.currentTurnIndex,
    required this.descriptions,
    required this.previousRounds,
    required this.votes,
    required this.round,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    var playerList = json['players'] as List;
    List<Player> players = playerList.map((i) => Player.fromJson(i)).toList();

    var descList = json['descriptions'] as List? ?? [];
    List<Map<String, dynamic>> descriptions = descList.map((i) => Map<String, dynamic>.from(i)).toList();

    var prevRoundsList = json['previousRounds'] as List? ?? [];
    List<List<Map<String, dynamic>>> previousRounds = prevRoundsList.map((round) {
      var roundList = round as List;
      return roundList.map((desc) => Map<String, dynamic>.from(desc)).toList();
    }).toList();

    var votesMap = json['votes'] as Map<String, dynamic>? ?? {};
    Map<String, String> votes = votesMap.map((key, value) => MapEntry(key, value.toString()));

    return Room(
      id: json['id'] as String,
      status: json['status'] as String,
      phase: json['phase'] as String? ?? '',
      players: players,
      currentTurnIndex: json['currentTurnIndex'] as int? ?? 0,
      descriptions: descriptions,
      previousRounds: previousRounds,
      votes: votes,
      round: json['round'] as int? ?? 1,
    );
  }

  Player? get currentPlayer {
    if (players.isEmpty || currentTurnIndex >= players.length) return null;
    return players[currentTurnIndex];
  }

  Room copyWith({
    String? id,
    String? status,
    String? phase,
    List<Player>? players,
    int? currentTurnIndex,
    List<Map<String, dynamic>>? descriptions,
    List<List<Map<String, dynamic>>>? previousRounds,
    Map<String, String>? votes,
    int? round,
  }) {
    return Room(
      id: id ?? this.id,
      status: status ?? this.status,
      phase: phase ?? this.phase,
      players: players ?? this.players,
      currentTurnIndex: currentTurnIndex ?? this.currentTurnIndex,
      descriptions: descriptions ?? this.descriptions,
      previousRounds: previousRounds ?? this.previousRounds,
      votes: votes ?? this.votes,
      round: round ?? this.round,
    );
  }
}
