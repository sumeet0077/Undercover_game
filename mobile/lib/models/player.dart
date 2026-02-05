class Player {
  final String id;
  final String name;
  final bool isHost;
  final bool isAlive;
  final String avatar;
  final String? role; // Only visible if it's YOU
  final String? word; // Only visible if it's YOU
  final bool inLobby; // Track individual return status

  Player({
    required this.id,
    required this.name,
    required this.isHost,
    required this.isAlive,
    required this.avatar,
    this.role,
    this.word,
    this.inLobby = false,
  });

  factory Player.fromJson(Map<String, dynamic> json) {
    const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];
    
    String avatarStr = '👤';
    if (json['avatar'] is int) {
      int idx = json['avatar'];
      if (idx >= 0 && idx < emojis.length) {
        avatarStr = emojis[idx];
      }
    } else if (json['avatar'] is String) {
      avatarStr = json['avatar'];
    }

    return Player(
      id: json['id'] as String,
      name: json['name'] as String,
      isHost: json['isHost'] as bool? ?? false,
      isAlive: json['isAlive'] as bool? ?? true,
      avatar: avatarStr,
      role: json['role'] as String?,
      word: json['word'] as String?,
      inLobby: json['inLobby'] as bool? ?? false,
    );
  }

  Player copyWith({
    String? id,
    String? name,
    bool? isHost,
    bool? isAlive,
    String? avatar,
    String? role,
    String? word,
  }) {
    return Player(
      id: id ?? this.id,
      name: name ?? this.name,
      isHost: isHost ?? this.isHost,
      isAlive: isAlive ?? this.isAlive,
      avatar: avatar ?? this.avatar,
      role: role ?? this.role,
    String? word,
    bool? inLobby,
  }) {
    return Player(
      id: id ?? this.id,
      name: name ?? this.name,
      isHost: isHost ?? this.isHost,
      isAlive: isAlive ?? this.isAlive,
      avatar: avatar ?? this.avatar,
      role: role ?? this.role,
      word: word ?? this.word,
      inLobby: inLobby ?? this.inLobby,
    );
  }
}
