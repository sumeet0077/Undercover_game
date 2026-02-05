class AppConstants {
  // Networking
  // static const String baseUrl = 'http://localhost:3000'; // iOS Simulator
  // static const String baseUrl = 'http://10.0.2.2:3000'; // Android Emulator
  // static const String baseUrl = 'YOUR_DEPLOYED_URL_HERE'; // Production

  // TODO: Update this based on where you are running the app (Sim vs Device)
  static const String baseUrl = 'https://undercover-backend-uezs.onrender.com'; 

  // Socket Events (Client -> Server)
  static const String emitCreateRoom = 'create_room';
  static const String emitJoinRoom = 'join_room';
  static const String emitRejoinGame = 'rejoin_game';
  static const String emitStartGame = 'start_game';
  static const String emitSubmitDescription = 'submit_description';
  static const String emitSubmitVote = 'submit_vote';
  static const String emitTypingStart = 'typing_start';
  static const String emitTypingStop = 'typing_stop';
  static const String emitSendReaction = 'send_reaction';
  static const String emitReshuffleWords = 'reshuffle_words';
  static const String emitLeaveRoom = 'leave_room';
  static const String emitEndGame = 'end_game';
  static const String emitReturnToLobby = 'return_to_lobby';
  static const String emitRequestSync = 'request_sync';

  // Socket Events (Server -> Client)
  static const String onRoomCreated = 'room_created';
  static const String onRoomUpdate = 'room_update';
  static const String onGameStarted = 'game_started';
  static const String onYourInfo = 'your_info';
  static const String onPhaseChange = 'phase_change';
  static const String onNextTurn = 'next_turn';
  static const String onNewRound = 'new_round';
  static const String onGameOver = 'game_over';
  static const String onRoomDestroyed = 'room_destroyed';
  static const String onUpdateDescriptions = 'update_descriptions';
  static const String onUpdateVotes = 'update_votes';
  static const String onVotingResult = 'voting_result';
  static const String onPlayerTyping = 'player_typing';
  static const String onReceiveReaction = 'receive_reaction';
  static const String onNotification = 'notification';
  static const String onError = 'error';
  // Additional Events for Full Parity
  static const String onPlayerDisconnected = 'player_disconnected';
  static const String onVoteConfirmed = 'vote_confirmed';
  static const String onLeftRoomSuccess = 'left_room_success';
  static const String onRejoinFailed = 'rejoin_failed';
  static const String onPlayerJoined = 'player_joined';
}
