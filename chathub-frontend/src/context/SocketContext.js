import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Refs to prevent duplicate connections and track state
  const socketRef = useRef(null);
  const currentRoomRef = useRef(null);
  const isConnectingRef = useRef(false);

  // CRITICAL FIX: Track joined users to prevent repeated notifications
  const joinedUsersRef = useRef(new Set());
  const notificationTimeoutRef = useRef(null);

  // CRITICAL FIX: Track if socket is properly initialized for this user
  const socketInitializedRef = useRef(false);

  // CRITICAL FIX: Track room join operations to prevent loops
  const roomJoinInProgressRef = useRef(false);
  const lastJoinedRoomRef = useRef(null);
  const roomJoinTimeoutRef = useRef(null);

  useEffect(() => {
    // Only connect if we have a user and aren't already connecting/connected
    if (isAuthenticated() && user && !socketRef.current && !isConnectingRef.current) {
      isConnectingRef.current = true;
      console.log('🔌 Initializing socket connection for user:', user.username);

      // FIXED: Use proper server URL configuration
      const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://127.0.0.1:5000';

      // Initialize socket connection with FIXED timeout and reconnection options
      const newSocket = io(SERVER_URL, {
        // CRITICAL FIXES: Proper timeout configuration
        timeout: 20000, // 20 second connection timeout

        // TRANSPORT CONFIGURATION - CRITICAL FIX
        transports: ['polling', 'websocket'], // Use both transports for reliability
        upgrade: true, // Allow upgrading from polling to websocket

        // PING/PONG CONFIGURATION - MUST MATCH SERVER SETTINGS
        pingTimeout: 60000, // Match server ping_timeout (60 seconds)
        pingInterval: 25000, // Match server ping_interval (25 seconds)

        // RECONNECTION CONFIGURATION - PREVENTS CONNECTION DROPS
        reconnection: true, // Enable auto-reconnection
        reconnectionAttempts: 5, // Try 5 times before giving up
        reconnectionDelay: 1000, // Wait 1 second between attempts
        reconnectionDelayMax: 5000, // Maximum delay between attempts
        randomizationFactor: 0.5, // Add randomness to prevent thundering herd

        // CONNECTION SETTINGS
        withCredentials: true, // Send cookies for session management
        autoConnect: true, // Connect immediately when created
        forceNew: false, // Reuse existing connection if possible

        // PATH CONFIGURATION
        path: '/socket.io', // Standard Socket.IO path
      });

      // ENHANCED CONNECTION EVENT HANDLERS
      newSocket.on('connect', () => {
        console.log('✅ Connected to ChatHub server successfully!');
        console.log('   Socket ID:', newSocket.id);
        console.log('   Transport:', newSocket.io.engine.transport.name);
        console.log('   Connection time:', new Date().toISOString());

        setConnected(true);
        setSocket(newSocket);
        socketRef.current = newSocket;
        isConnectingRef.current = false;
        socketInitializedRef.current = true; // CRITICAL FIX: Mark as initialized

        // CRITICAL FIX: Don't auto-join any room on connection
        // Let the Chat component explicitly manage room joining

        toast.success('Connected to ChatHub! 🌐');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Connection failed:', error.message);
        console.error('   Error type:', error.type);
        console.error('   Error description:', error.description);

        setConnected(false);
        isConnectingRef.current = false;
        socketInitializedRef.current = false;

        // Detailed error analysis for debugging
        if (error.message.includes('CORS')) {
          console.error('💡 CORS Error: Server needs cors_allowed_origins="*" configuration');
          toast.error('Connection failed: CORS error');
        } else if (error.message.includes('timeout')) {
          console.error('💡 Timeout Error: Check server responsiveness and increase timeout values');
          toast.error('Connection timeout. Please check your connection.');
        } else if (error.message.includes('version')) {
          console.error('💡 Version Error: Socket.IO client/server version mismatch');
          toast.error('Connection failed: Version mismatch');
        } else if (error.message.includes('xhr')) {
          console.error('💡 XHR Error: Network connectivity or server not running');
          toast.error('Cannot reach server. Please check if server is running.');
        } else {
          console.error('💡 Unknown Error: Check server logs and network connectivity');
          toast.error('Connection failed. Please try refreshing the page.');
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from ChatHub server');
        console.log('   Reason:', reason);
        console.log('   Time:', new Date().toISOString());

        setConnected(false);
        socketInitializedRef.current = false;
        joinedUsersRef.current.clear(); // Clear joined users on disconnect
        roomJoinInProgressRef.current = false; // Reset room join state
        lastJoinedRoomRef.current = null;

        if (roomJoinTimeoutRef.current) {
          clearTimeout(roomJoinTimeoutRef.current);
        }

        // Handle different disconnection reasons
        switch (reason) {
          case 'io server disconnect':
            console.log('   Server initiated disconnect, attempting reconnection...');
            toast.error('Server disconnected. Reconnecting...');
            newSocket.connect();
            break;
          case 'io client disconnect':
            console.log('   Client initiated disconnect');
            break;
          case 'ping timeout':
            console.log('   Connection timed out, will auto-reconnect');
            toast.error('Connection timed out. Reconnecting...');
            break;
          case 'transport close':
            console.log('   Connection closed, will auto-reconnect');
            break;
          case 'transport error':
            console.log('   Transport error occurred, will auto-reconnect');
            break;
          default:
            console.log('   Unknown disconnect reason, will auto-reconnect if enabled');
            if (reason !== 'io client disconnect') {
              toast.error('Connection lost. Attempting to reconnect...');
            }
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected successfully!');
        console.log('   Attempt number:', attemptNumber);
        console.log('   New socket ID:', newSocket.id);

        setConnected(true);
        socketInitializedRef.current = true;
        joinedUsersRef.current.clear(); // Clear on reconnect
        roomJoinInProgressRef.current = false;
        toast.success('Reconnected to ChatHub! 🎉');

        // CRITICAL FIX: Don't auto-rejoin room on reconnection
        // Let the Chat component handle rejoining when needed
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection failed:', error.message);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ All reconnection attempts failed');
        console.error('   Check server status and network connectivity');
        toast.error('Failed to reconnect. Please refresh the page.');
      });

      // SERVER-SPECIFIC EVENT HANDLERS
      newSocket.on('connection_status', (data) => {
        console.log('📡 Connection status from server:', data);
      });

      newSocket.on('connection_confirmed', (data) => {
        console.log('✅ Connection confirmed by server:', data);
        // Mark room join as complete
        roomJoinInProgressRef.current = false;
      });

      // ENHANCED ERROR HANDLING
      newSocket.on('error', (error) => {
        console.error('❌ Socket error from server:', error.message);

        // Handle specific error codes
        if (error.code) {
          switch (error.code) {
            case 'INVALID_DATA':
              console.error('   Invalid data format sent to server');
              toast.error('Invalid data sent to server');
              break;
            case 'NOT_AUTHENTICATED':
              console.error('   User not authenticated - check login status');
              toast.error('Authentication required');
              break;
            case 'USER_BANNED':
              console.error('   User is banned from the chat');
              toast.error('You have been banned from the chat');
              break;
            case 'USER_KICKED':
              console.error('   User is temporarily kicked');
              toast.error('You have been temporarily kicked');
              break;
            case 'INVALID_ROOM':
              console.error('   Invalid room specified');
              toast.error('Invalid chat room');
              break;
            case 'MESSAGE_TOO_LONG':
              toast.error('Message too long (max 1000 characters)');
              break;
            case 'EMPTY_CONTENT':
              toast.error('Message cannot be empty');
              break;
            default:
              console.error('   Server error code:', error.code);
              toast.error(error.message || 'Server error occurred');
          }
        } else {
          toast.error(error.message || 'An error occurred');
        }
      });

      // MESSAGE AND USER EVENTS
      newSocket.on('online_users', (data) => {
        try {
          // Handle both old format (array) and new format (object with users array)
          let users;
          if (Array.isArray(data)) {
            users = data;
          } else if (data && Array.isArray(data.users)) {
            users = data.users;
          } else {
            console.warn('⚠️ online_users payload format unexpected:', data);
            setOnlineUsers([]);
            return;
          }

          console.log('📋 Updated online users:', users.length, 'users');
          setOnlineUsers(users);
        } catch (e) {
          console.error('❌ online_users handler error:', e);
          setOnlineUsers([]);
        }
      });

      // CRITICAL FIX: Debounced user joined notification to prevent spam
      newSocket.on('user_joined', (data) => {
        if (data?.username && data.username !== user.username) {
          // Check if we already notified about this user recently
          if (!joinedUsersRef.current.has(data.username)) {
            console.log('👋 User joined:', data.username);
            toast.success(`${data.username} joined the room`);

            // Add to tracking set
            joinedUsersRef.current.add(data.username);

            // Remove from tracking after 5 seconds to allow for legitimate re-joins
            setTimeout(() => {
              joinedUsersRef.current.delete(data.username);
            }, 5000);
          } else {
            console.log('🔄 Duplicate join notification prevented for:', data.username);
          }
        }
      });

      newSocket.on('user_left', (data) => {
        if (data?.username && data.username !== user.username) {
          console.log('👋 User left:', data.username);
          toast(`${data.username} left the room`, { icon: '👋' });

          // Remove from joined users tracking when they leave
          joinedUsersRef.current.delete(data.username);
        }
      });

      newSocket.on('receive_message', (message) => {
        console.log('📨 Received message:', message);
        // The Chat component will handle this via the onMessage callback
      });

      newSocket.on('receive_private_message', (message) => {
        console.log('🔒 Received private message:', message);
        // The PrivateChat component will handle this
      });

      // PING/PONG HANDLERS FOR CONNECTION KEEPALIVE
      newSocket.on('pong', (data) => {
        console.log('🏓 Pong received from server:', data);
      });

      // TRANSPORT UPGRADE HANDLERS
      newSocket.io.on('upgrade', () => {
        console.log('⬆️ Upgraded to WebSocket transport');
      });

      newSocket.io.on('upgradeError', (error) => {
        console.error('❌ WebSocket upgrade failed:', error);
        console.log('   Continuing with polling transport');
      });

      // SUCCESS CONFIRMATION HANDLERS
      newSocket.on('message_sent', (data) => {
        console.log('✅ Message sent confirmation:', data);
      });

      newSocket.on('private_message_sent', (data) => {
        console.log('✅ Private message sent confirmation:', data);
      });

      newSocket.on('private_room_joined', (data) => {
        console.log('✅ Private room joined:', data);
      });

      newSocket.on('left_room', (data) => {
        console.log('✅ Left room confirmation:', data);
      });

      // Cleanup function
      return () => {
        console.log('🧹 Cleaning up socket connection');
        if (newSocket && newSocket.connected) {
          newSocket.disconnect();
        }
        setSocket(null);
        setConnected(false);
        setOnlineUsers([]);
        socketRef.current = null;
        currentRoomRef.current = null;
        isConnectingRef.current = false;
        socketInitializedRef.current = false;
        joinedUsersRef.current.clear();
        roomJoinInProgressRef.current = false;
        lastJoinedRoomRef.current = null;

        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
        if (roomJoinTimeoutRef.current) {
          clearTimeout(roomJoinTimeoutRef.current);
        }
      };
    }
  }, [user, isAuthenticated]);

  // CONNECTION QUALITY MONITORING
  useEffect(() => {
    if (!socketRef.current) return;

    const connectionMonitor = setInterval(() => {
      if (socketRef.current && connected) {
        const startTime = Date.now();

        socketRef.current.emit('ping');

        // Monitor response time
        const pongHandler = () => {
          const responseTime = Date.now() - startTime;
          if (responseTime > 5000) {
            console.warn('⚠️ Poor connection quality - high latency detected');
          } else if (responseTime > 2000) {
            console.log('🟡 Fair connection quality - moderate latency');
          }
        };

        socketRef.current.once('pong', pongHandler);

        // Cleanup if no response
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.off('pong', pongHandler);
          }
        }, 10000);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(connectionMonitor);
  }, [connected]);

  // CRITICAL FIX: Use useCallback to create stable function references
  const joinRoom = useCallback((roomName) => {
    if (!socketRef.current || !user || !roomName || !connected || !socketInitializedRef.current) {
      console.warn('❌ Cannot join room - missing requirements:', {
        hasSocket: !!socketRef.current,
        hasUser: !!user,
        hasRoomName: !!roomName,
        isConnected: connected,
        isInitialized: socketInitializedRef.current
      });
      if (!connected) {
        toast.error('Not connected to server');
      }
      return;
    }

    // CRITICAL FIX: Prevent room join loops
    if (roomJoinInProgressRef.current && lastJoinedRoomRef.current === roomName) {
      console.log(`🔄 Room join already in progress for: ${roomName}, skipping...`);
      return;
    }

    // If already in the same room, don't rejoin
    if (currentRoomRef.current === roomName && !roomJoinInProgressRef.current) {
      console.log(`🏠 Already in room: ${roomName}, skipping join`);
      return;
    }

    console.log(`🚪 Joining room: ${roomName}`);

    // Set join in progress
    roomJoinInProgressRef.current = true;
    lastJoinedRoomRef.current = roomName;
    currentRoomRef.current = roomName;

    // Clear any existing timeout
    if (roomJoinTimeoutRef.current) {
      clearTimeout(roomJoinTimeoutRef.current);
    }

    // Join new room
    socketRef.current.emit('user_connected', {
      username: user.username,
      room_name: roomName
    });

    // Request online users list after a short delay
    setTimeout(() => {
      if (socketRef.current && connected && currentRoomRef.current === roomName) {
        socketRef.current.emit('who_is_online', { room_name: roomName });
      }
    }, 1000); // Increased delay to prevent rapid requests

    // Reset join in progress after timeout
    roomJoinTimeoutRef.current = setTimeout(() => {
      roomJoinInProgressRef.current = false;
      console.log(`⏱️ Room join timeout reset for: ${roomName}`);
    }, 3000); // 3 second timeout
  }, [connected, user]);

  const leaveRoom = useCallback((roomName) => {
    if (socketRef.current && user && roomName) {
      console.log(`🚪 Leaving room: ${roomName}`);

      // Clear join in progress if leaving current room
      if (roomName === currentRoomRef.current) {
        roomJoinInProgressRef.current = false;
        currentRoomRef.current = null;
        lastJoinedRoomRef.current = null;
      }

      socketRef.current.emit('leave', {
        username: user.username,
        room: roomName
      });
    }
  }, [user]);

  const sendMessage = useCallback((roomName, content) => {
    // CRITICAL FIX: Check if socket is properly initialized for the user
    if (socketRef.current && user && content.trim() && roomName && connected && socketInitializedRef.current) {
      const messageData = {
        username: user.username,
        content: content.trim(),
        room_name: roomName
      };

      console.log(`💬 Sending message to ${roomName}:`, content.slice(0, 50) + '...');
      socketRef.current.emit('send_message', messageData);
      return true;
    } else {
      console.warn('❌ Cannot send message - missing requirements:', {
        hasSocket: !!socketRef.current,
        hasUser: !!user,
        hasContent: !!content?.trim(),
        hasRoomName: !!roomName,
        isConnected: connected,
        isInitialized: socketInitializedRef.current
      });

      if (!connected) {
        toast.error('Not connected to server');
      } else if (!socketInitializedRef.current) {
        toast.error('Socket not initialized. Please refresh the page.');
      } else if (!content?.trim()) {
        toast.error('Message cannot be empty');
      }

      return false;
    }
  }, [connected, user]);

  const joinPrivateRoom = useCallback((friendUsername) => {
    // CRITICAL FIX: Initialize socket if needed before joining private room
    if (socketRef.current && user && friendUsername && connected) {
      console.log(`🔒 Joining private room with: ${friendUsername}`);

      // If socket not properly initialized for this user, initialize it first
      if (!socketInitializedRef.current) {
        console.log('🔧 Initializing socket for private chat...');
        socketRef.current.emit('user_connected', {
          username: user.username,
          room_name: 'Chat Room 1' // Default room to initialize the socket
        });
        socketInitializedRef.current = true;

        // Wait a moment for initialization before joining private room
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.emit('join_private', {
              with: friendUsername
            });
          }
        }, 500);
      } else {
        socketRef.current.emit('join_private', {
          with: friendUsername
        });
      }
    } else if (!connected) {
      toast.error('Not connected to server');
    }
  }, [connected, user]);

  const sendPrivateMessage = useCallback((toUsername, content) => {
    // CRITICAL FIX: Check if socket is properly initialized for the user
    if (socketRef.current && user && content.trim() && toUsername && connected) {
      // If socket not properly initialized, initialize it first
      if (!socketInitializedRef.current) {
        console.log('🔧 Initializing socket for private messaging...');
        socketRef.current.emit('user_connected', {
          username: user.username,
          room_name: 'Chat Room 1' // Default room to initialize the socket
        });
        socketInitializedRef.current = true;

        // Wait a moment then send the message
        setTimeout(() => {
          if (socketRef.current) {
            console.log(`🔒 Sending private message to ${toUsername}`);
            socketRef.current.emit('send_private_message', {
              to: toUsername,
              content: content.trim()
            });
          }
        }, 500);
      } else {
        console.log(`🔒 Sending private message to ${toUsername}`);
        socketRef.current.emit('send_private_message', {
          to: toUsername,
          content: content.trim()
        });
      }
      return true;
    } else {
      if (!connected) {
        toast.error('Not connected to server');
      } else if (!socketInitializedRef.current) {
        console.log('🔧 Socket not initialized, attempting to initialize...');
        // Try to initialize
        if (socketRef.current && user) {
          socketRef.current.emit('user_connected', {
            username: user.username,
            room_name: 'Chat Room 1'
          });
          socketInitializedRef.current = true;
        }
        toast.error('Initializing connection...');
      } else if (!content?.trim()) {
        toast.error('Message cannot be empty');
      }
      return false;
    }
  }, [connected, user]);

  // ENHANCED EVENT LISTENERS
  const onMessage = useCallback((callback) => {
    if (socketRef.current) {
      const handler = (message) => {
        console.log('📨 Message event triggered:', message);
        callback(message);
      };
      socketRef.current.on('receive_message', handler);
      return () => {
        if (socketRef.current) {
          socketRef.current.off('receive_message', handler);
        }
      };
    }
    return () => {}; // No-op cleanup if no socket
  }, []);

  const onPrivateMessage = useCallback((callback) => {
    if (socketRef.current) {
      const handler = (message) => {
        console.log('🔒 Private message event triggered:', message);
        callback(message);
      };
      socketRef.current.on('receive_private_message', handler);
      return () => {
        if (socketRef.current) {
          socketRef.current.off('receive_private_message', handler);
        }
      };
    }
    return () => {}; // No-op cleanup if no socket
  }, []);

  const onUserJoined = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('user_joined', callback);
      return () => {
        if (socketRef.current) {
          socketRef.current.off('user_joined', callback);
        }
      };
    }
    return () => {};
  }, []);

  const onUserLeft = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('user_left', callback);
      return () => {
        if (socketRef.current) {
          socketRef.current.off('user_left', callback);
        }
      };
    }
    return () => {};
  }, []);

  // UTILITY FUNCTIONS
  const getConnectionStatus = useCallback(() => ({
    connected,
    socketId: socketRef.current?.id,
    transport: socketRef.current?.io?.engine?.transport?.name,
    currentRoom: currentRoomRef.current,
    initialized: socketInitializedRef.current,
    joinInProgress: roomJoinInProgressRef.current
  }), [connected]);

  const forceReconnect = useCallback(() => {
    console.log('🔄 Forcing reconnection...');
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    joinPrivateRoom,
    sendPrivateMessage,
    onMessage,
    onPrivateMessage,
    onUserJoined,
    onUserLeft,
    getConnectionStatus,
    forceReconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};