import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { friendsAPI } from '../utils/api';
import { 
  PaperAirplaneIcon, 
  ArrowLeftIcon, 
  ChatBubbleLeftRightIcon, 
  ClockIcon 
} from '@heroicons/react/24/outline';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const PrivateChat = () => {
  const { friendId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [friend, setFriend] = useState(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const { user } = useAuth();
  const { 
    joinPrivateRoom, 
    onPrivateMessage, 
    connected, 
    sendPrivateMessage: sendPrivateMessageSocket 
  } = useSocket();
  const navigate = useNavigate();
  const messageListenerRef = useRef(null);

  // Load initial messages and friend info
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get friend info first
        const friendsResponse = await friendsAPI.getFriends();
        const friendInfo = friendsResponse.data.friends.find(f => f.id === parseInt(friendId));
        
        if (!friendInfo) {
          toast.error('Friend not found');
          navigate('/friends');
          return;
        }
        
        setFriend(friendInfo);
        
        // Get private messages
        const messagesResponse = await friendsAPI.getPrivateMessages(friendId);
        console.log('📥 Loaded private messages:', messagesResponse.data.length);
        setMessages(messagesResponse.data || []);
        
      } catch (error) {
        console.error('❌ Error loading private chat data:', error);
        toast.error('Failed to load chat');
        navigate('/friends');
      } finally {
        setLoading(false);
      }
    };

    if (friendId) {
      loadData();
    }
  }, [friendId, navigate]);

  // Join private room when connected and friend is loaded
  useEffect(() => {
    if (connected && friend?.username) {
      console.log(`🔒 Joining private room with: ${friend.username}`);
      joinPrivateRoom(friend.username);
    }
  }, [connected, friend?.username, joinPrivateRoom]);

  // Set up private message listener
  useEffect(() => {
    console.log('🎧 Setting up private message listener');
    
    const handlePrivateMessage = (message) => {
      console.log('🔒 Received private message:', message);
      
      // Check if message is for this chat
      if ((message.from === friend?.username && message.to === user?.username) || 
          (message.to === friend?.username && message.from === user?.username)) {
        console.log('✅ Adding private message to chat');
        
        setMessages(prev => {
          // Avoid duplicates
          const isDuplicate = prev.some(msg => msg.id === message.id);
          if (isDuplicate) {
            console.log('🔄 Duplicate private message detected, ignoring');
            return prev;
          }
          
          // Convert to expected format
          const formattedMessage = {
            id: message.id,
            sender: {
              id: message.from === user?.username ? user.id : friend?.id,
              username: message.from,
              is_mod: message.is_mod || false
            },
            content: message.content,
            timestamp: message.timestamp,
            read: false
          };
          
          return [...prev, formattedMessage];
        });
      } else {
        console.log('🚫 Ignoring message not for this private chat');
      }
    };

    // Set up the listener
    const cleanup = onPrivateMessage(handlePrivateMessage);
    
    return () => {
      console.log('🧹 Cleaning up private message listener');
      cleanup();
    };
  }, [onPrivateMessage, friend, user]);

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
    if (!newMessage.trim() || sending || !friend) return;

    setSending(true);
    const content = newMessage.trim();

    try {
      let messageSent = false;
      
      if (connected) {
        console.log(`🔒 Sending real-time private message to ${friend.username}:`, content.slice(0, 50) + '...');
        // Use socket for real-time sending
        messageSent = sendPrivateMessageSocket(friend.username, content);
      }
      
      if (!messageSent) {
        console.log(`📡 Sending REST fallback private message to ${friend.username}:`, content.slice(0, 50) + '...');
        // Fallback to REST API
        const response = await friendsAPI.sendPrivateMessage(friendId, content);
        
        // Add optimistic update if socket didn't work
        setMessages(prev => [...prev, {
          id: `local-${Date.now()}`,
          sender: {
            id: user?.id,
            username: user?.username,
            is_mod: !!user?.is_mod
          },
          content,
          timestamp: new Date().toISOString(),
          read: false
        }]);
      }

      setNewMessage('');
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('❌ Error sending private message:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!friend) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Friend not found</h3>
          <button
            onClick={() => navigate('/friends')}
            className="mt-2 text-purple-600 hover:text-purple-700"
          >
            Back to Friends
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Fixed Private Chat Header */}
      <div className="fixed top-20 left-0 right-0 z-40">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/friends')}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Back to friends"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">
                    {friend.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold flex items-center">
                      {friend.username}
                      {friend.is_mod && (
                        <ShieldCheckIcon className="h-5 w-5 ml-2 text-purple-200" />
                      )}
                    </h1>
                      <div className={`h-2 w-2 rounded-full mr-2 ${connected ? 'bg-green-300' : 'bg-red-300'}`} >

                    <p className="text-sm text-purple-200 flex items-center">
                      Private conversation
                    </p>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden pt-24">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No messages yet</h3>
                <p className="text-gray-500 mb-4">Start your private conversation with {friend.username}!</p>
                <p className="text-sm text-gray-400">Your messages here are private and secure 🔒</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={message.id || index} className="group">
                  <div className={`flex items-start space-x-3 ${
                    message.sender.username === user?.username ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      message.sender.is_mod 
                        ? 'bg-purple-500' 
                        : message.sender.username === user?.username
                          ? 'bg-purple-500'
                          : 'bg-gray-500'
                    }`}>
                      {message.sender.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    
                    <div className={`flex-1 min-w-0 ${
                      message.sender.username === user?.username ? 'text-right' : ''
                    }`}>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`font-medium text-sm ${
                          message.sender.is_mod ? 'text-purple-600' : 'text-gray-700'
                        }`}>
                          {message.sender.username}
                          {message.sender.is_mod && (
                            <ShieldCheckIcon className="inline h-4 w-4 ml-1 text-purple-500" />
                          )}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                          <ClockIcon className="h-3 w-3 mr-1" />
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      
                      <div className={`inline-block max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                        message.sender.username === user?.username
                          ? 'bg-purple-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      } shadow-sm`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t bg-white p-4">
            <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
              <div className="flex-1">
                <textarea
                  ref={messageInputRef}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    autoResize();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${friend.username}...`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none max-h-32"
                  rows="1"
                  disabled={sending}
                />
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className={`p-3 rounded-lg transition-colors ${
                  newMessage.trim() && !sending
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {sending ? (
                  <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <PaperAirplaneIcon className="h-5 w-5" />
                )}
              </button>
            </form>
            
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center">
                <div className={`h-2 w-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                {connected ? 'Real-time messaging active' : 'Using fallback mode'}
              </span>
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivateChat;