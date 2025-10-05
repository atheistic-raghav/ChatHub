import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { chatAPI, modAPI } from '../utils/api';
import { PaperAirplaneIcon, ArrowLeftIcon, ChatBubbleLeftRightIcon, UsersIcon, ClockIcon, ExclamationCircleIcon, NoSymbolIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ShieldCheckIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const Chat = () => {
  const { roomName } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showOnlinePanel, setShowOnlinePanel] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const { user } = useAuth();
  const { joinRoom, leaveRoom, onMessage, onlineUsers, connected, sendMessage: sendMessageSocket } = useSocket();
  const navigate = useNavigate();

  const decodedRoomName = decodeURIComponent(roomName);
  const previousRoomRef = useRef(null);

  // CRITICAL FIX: Track room management to prevent loops
  const roomInitializedRef = useRef(false);
  const mountedRef = useRef(true);
  const loadingTimeoutRef = useRef(null);

  // Load initial messages with timeout fallback
  useEffect(() => {
    const loadMessages = async () => {
      try {
        console.log('📥 Loading messages for room:', decodedRoomName);
        setLoading(true);

        // Set a timeout to prevent infinite loading
        loadingTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Loading timeout reached, proceeding with empty messages');
          if (mountedRef.current) {
            setMessages([]);
            setLoading(false);
          }
        }, 10000); // 10 second timeout

        const response = await chatAPI.getMessages(decodedRoomName);
        console.log('📥 Loaded initial messages:', response.data?.length || 0);

        // Clear the timeout since we got a response
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }

        if (mountedRef.current) {
          setMessages(response.data || []);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error loading messages:', error);

        // Clear timeout on error too
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }

        if (mountedRef.current) {
          if (error.response?.status === 404) {
            toast.error('Invalid chat room');
            navigate('/rooms');
          } else {
            console.log('📝 Using empty messages due to load error');
            setMessages([]); // Use empty messages instead of failing
            setLoading(false);
            toast.error('Failed to load messages, starting fresh');
          }
        }
      }
    };

    if (decodedRoomName && mountedRef.current) {
      loadMessages();
    }

    // Cleanup timeout on unmount or room change
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [decodedRoomName, navigate]);

  // CRITICAL FIX: Remove function dependencies from useEffect to prevent loops
  useEffect(() => {
    if (!decodedRoomName || !connected) {
      console.log(`⏸️ Skipping room join - Room: ${decodedRoomName}, Connected: ${connected}`);
      return;
    }

    console.log(`🎯 Room management effect for: ${decodedRoomName}`);

    // Leave previous room if switching
    if (previousRoomRef.current && previousRoomRef.current !== decodedRoomName) {
      console.log(`🚪 Switching from ${previousRoomRef.current} to ${decodedRoomName}`);
      leaveRoom(previousRoomRef.current);
      roomInitializedRef.current = false; // Reset initialization flag
    }

    // Join new room only if not already initialized for this room
    if (!roomInitializedRef.current || previousRoomRef.current !== decodedRoomName) {
      console.log(`🚪 Joining room: ${decodedRoomName}`);
      joinRoom(decodedRoomName);
      roomInitializedRef.current = true;
    } else {
      console.log(`🏠 Already initialized for room: ${decodedRoomName}`);
    }

    previousRoomRef.current = decodedRoomName;

    // Cleanup function - only clean up if we're unmounting or changing rooms
    return () => {
      // Only cleanup if the room is actually changing or component unmounting
      if (previousRoomRef.current === decodedRoomName) {
        console.log(`🧹 Cleanup - leaving room: ${decodedRoomName}`);
        leaveRoom(decodedRoomName);
        roomInitializedRef.current = false;
      }
    };
  }, [decodedRoomName, connected]); // CRITICAL FIX: Remove joinRoom and leaveRoom from dependencies

  // Set up message listener
  useEffect(() => {
    console.log('🎧 Setting up message listener for room:', decodedRoomName);

    const handleNewMessage = (message) => {
      console.log('📨 Received message:', message);

      // Only add messages for this room
      if (!message || !message.room_name || message.room_name !== decodedRoomName) {
        console.log(`🚫 Ignoring message for different room: ${message?.room_name} !== ${decodedRoomName}`);
        return;
      }

      if (!mountedRef.current) return;

      console.log('✅ Adding message to current room');
      setMessages(prev => {
        // Avoid duplicates by checking message ID
        const isDuplicate = prev.some(msg => msg.id === message.id);
        if (isDuplicate) {
          console.log('🔄 Duplicate message detected, ignoring');
          return prev;
        }
        return [...prev, message];
      });
    };

    // Set up the listener
    const cleanup = onMessage(handleNewMessage);

    return () => {
      console.log('🧹 Cleaning up message listener');
      cleanup();
    };
  }, [onMessage, decodedRoomName]);

  // Component unmount cleanup
  useEffect(() => {
    mountedRef.current = true; // Set mounted to true on mount

    return () => {
      console.log('🧹 Chat component unmounting');
      mountedRef.current = false;

      // Clean up any timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const autoResize = () => {
    const textarea = messageInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const content = newMessage.trim();

    try {
      let messageSent = false;

      if (connected) {
        console.log(`💬 Sending real-time message to ${decodedRoomName}:`, content.slice(0, 50) + '...');
        // Use socket for real-time sending
        messageSent = sendMessageSocket(decodedRoomName, content);
      }

      if (!messageSent) {
        console.log(`📡 Sending REST fallback message to ${decodedRoomName}:`, content.slice(0, 50) + '...');
        // Fallback to REST API
        const response = await chatAPI.sendMessage(decodedRoomName, content);

        // Add optimistic update if socket didn't work
        if (mountedRef.current) {
          setMessages(prev => [...prev, {
            id: `local-${Date.now()}`,
            username: user?.username,
            content,
            timestamp: new Date().toISOString(),
            is_mod: !!user?.is_mod,
            is_system: false,
            room_name: decodedRoomName,
          }]);
        }
      }

      setNewMessage('');
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor((now - date) / (1000 * 60));
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getRoomColor = (name) => {
    const colors = {
      'Chat Room 1': 'from-blue-500 to-blue-600',
      'Chat Room 2': 'from-green-500 to-green-600',
      'Chat Room 3': 'from-purple-500 to-purple-600',
      'Chat Room 4': 'from-pink-500 to-pink-600',
      'Chat Room 5': 'from-yellow-500 to-yellow-600',
    };
    return colors[name] || 'from-gray-500 to-gray-600';
  };

  // Enhanced online users display with better fallback
  const displayedOnlineUsers = Array.isArray(onlineUsers) && onlineUsers.length > 0 ? onlineUsers : [];

  const handleKick = async (targetUsername) => {
    try {
      if (!user?.is_mod) return;

      if (targetUsername === user.username) {
        toast.error("You can't moderate yourself");
        return;
      }

      const res = await modAPI.kick(targetUsername);
      toast.success(res.data?.message || `Kicked ${targetUsername}`);
      setShowOnlinePanel(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to kick user');
    }
  };

  const handleBan = async (targetUsername) => {
    try {
      if (!user?.is_mod) return;

      if (targetUsername === user.username) {
        toast.error("You can't moderate yourself");
        return;
      }

      const res = await modAPI.ban(targetUsername);
      toast.success(res.data?.message || `Banned ${targetUsername}`);
      setShowOnlinePanel(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to ban user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
          <p className="text-gray-400 text-sm mt-2">This should only take a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className={`bg-gradient-to-r ${getRoomColor(decodedRoomName)} text-white shadow-lg`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/rooms')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <ChatBubbleLeftRightIcon className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-bold">{decodedRoomName}</h1>
                <p className="text-sm opacity-90">
                  {connected ? 'Real-time messaging active' : 'Disconnected - using fallback'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowOnlinePanel(!showOnlinePanel)}
              className="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <UsersIcon className="w-5 h-5" />
              <span className="text-sm font-medium">{displayedOnlineUsers.length}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Welcome to {decodedRoomName}!
                </h3>
                <p className="text-gray-500">
                  Be the first to start the conversation! 💬
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Share your thoughts, ask questions, or just say hello 👋
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.username === user?.username ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                      message.username === user?.username
                        ? 'bg-blue-500 text-white'
                        : message.is_system
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : 'bg-white text-gray-800 shadow-sm border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${
                          message.username === user?.username ? 'text-blue-100' : 'text-gray-600'
                        }`}>
                          {message.username}
                        </span>
                        {message.is_mod && (
                          <ShieldCheckIcon className={`w-3 h-3 ${
                            message.username === user?.username ? 'text-blue-200' : 'text-blue-500'
                          }`} />
                        )}
                      </div>
                      <span className={`text-xs ${
                        message.username === user?.username ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        <ClockIcon className="w-3 h-3 inline mr-1" />
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t bg-white p-4">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <div className="flex-1">
                <textarea
                  ref={messageInputRef}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    autoResize();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="1"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                  disabled={sending}
                />
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Online Users Panel */}
        {showOnlinePanel && (
          <div className="w-80 bg-white border-l shadow-lg">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center">
                  <UsersIcon className="w-5 h-5 mr-2 text-gray-600" />
                  Online Users ({displayedOnlineUsers.length})
                </h2>
                <button
                  onClick={() => setShowOnlinePanel(false)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {displayedOnlineUsers.length === 0 ? (
                <div className="text-center py-8">
                  <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No users online</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Users will appear here when they join the room
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedOnlineUsers.map((onlineUser, index) => (
                    <div
                      key={`${onlineUser.username}-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {onlineUser.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {onlineUser.username}
                            </span>
                            {onlineUser.is_mod && (
                              <ShieldCheckIcon className="w-4 h-4 text-blue-500" title="Moderator" />
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-gray-500">Online</span>
                          </div>
                        </div>
                      </div>

                      {/* Moderation Actions */}
                      {user?.is_mod && onlineUser.username !== user.username && onlineUser.username !== 'SYSTEM' && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleKick(onlineUser.username)}
                            className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
                            title="Kick user (12 hours)"
                          >
                            <ExclamationTriangleIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleBan(onlineUser.username)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Ban user permanently"
                          >
                            <NoSymbolIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;