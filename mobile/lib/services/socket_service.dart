import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/constants.dart';

class SocketService {
  late io.Socket _socket;
  bool _isConnected = false;

  bool get isConnected => _isConnected;
  String? get socketId => _socket.id;

  // Singleton
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  void initSocket() {
    // Basic options for Socket.IO v4
    _socket = io.io(AppConstants.baseUrl, <String, dynamic>{
      'transports': ['websocket', 'polling'],
      'autoConnect': true,
      'reconnection': true,
      'reconnectionAttempts': 20, // Increased from 5
      'reconnectionDelay': 2000,
    });

    _socket.onConnect((_) {
      debugPrint('Socket Connected: ${_socket.id}');
      _isConnected = true;
    });

    _socket.onDisconnect((_) {
      debugPrint('Socket Disconnected');
      _isConnected = false;
    });

    _socket.onConnectError((data) {
      debugPrint('Socket Connect Error: $data');
    });

    _socket.onReconnect((_) {
      debugPrint('Socket Reconnected');
      _isConnected = true;
    });
  }

  void connect() {
    if (!_socket.connected) {
      _socket.connect();
    }
  }

  void disconnect() {
    if (_socket.connected) {
      _socket.disconnect();
    }
  }

  void emit(String event, [dynamic data]) {
    _socket.emit(event, data);
  }

  void emitWithAck(String event, dynamic data, Function(dynamic) ack) {
    _socket.emitWithAck(event, data, ack: ack);
  }

  void on(String event, Function(dynamic) callback) {
    _socket.on(event, callback);
  }

  void off(String event) {
    _socket.off(event);
  }
}
