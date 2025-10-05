import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../utils/api';
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ArrowRightIcon,
  SparklesIcon,
  FireIcon,
  StarIcon,
  HeartIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ChatRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const res = await chatAPI.getRooms();
        setRooms(res.data.rooms || []);
      } catch (err) {
        setError('Failed to load rooms');
        toast.error('Failed to load rooms');
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, []);

  const handleRoomClick = (roomName) => {
    navigate(`/chat/${encodeURIComponent(roomName)}`);
  };

  const getRoomColor = (index) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-yellow-500 to-yellow-600',
    ];
    return colors[index % colors.length];
  };

  const getRoomIcon = (index) => {
    const icons = [
      ChatBubbleLeftRightIcon,
      UsersIcon,
      FireIcon,
      StarIcon,
      LightBulbIcon,
    ];
    return icons[index % icons.length];
  };

  const getRoomDescription = (index) => {
    const descriptions = [
      'General discussions and community conversations',
      'Meet new people and make lasting connections',
      'Share hot topics and trending discussions',
      'Connect with featured members and influencers',
      'Creative ideas, tips, and innovative thinking',
    ];
    return descriptions[index % descriptions.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 bg-primary-200 rounded-2xl mx-auto mb-6"></div>
          <div className="h-4 bg-primary-200 rounded-lg w-32 mx-auto mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-primary-500 to-purple-500 rounded-3xl shadow-soft mb-8 animate-pulse-slow">
          <ChatBubbleLeftRightIcon className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Welcome to ChatHub, <span className="text-primary-600">{user?.username}</span>! 👋
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Join a chat room and connect with our vibrant community. Choose from multiple rooms to find conversations that match your interests.
        </p>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {rooms.map((room, index) => {
          const IconComponent = getRoomIcon(index);
          return (
            <div
              key={room}
              className="group relative card overflow-hidden hover:shadow-xl hover:border-primary-200 transition-all duration-500 transform hover:-translate-y-1 hover:scale-105"
            >
              {/* Background Pattern */}
              <div className={`absolute inset-0 bg-gradient-to-br ${getRoomColor(index)} opacity-5 group-hover:opacity-10 transition-opacity`} />
              
              <div className="relative p-8">
                {/* Room Icon */}
                <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${getRoomColor(index)} rounded-xl shadow-lg mb-6`}>
                  <IconComponent className="h-8 w-8 text-white" />
                </div>

                {/* Room Info */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{room}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {getRoomDescription(index)}
                </p>

                {/* Stats */}
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center text-gray-500">
                    <UsersIcon className="h-5 w-5 mr-2" />
                    <span className="text-sm font-medium">Active Now</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    <span className="text-sm font-medium">24/7 Active</span>
                  </div>
                </div>

                {/* Join Button */}
                <button
                  onClick={() => handleRoomClick(room)}
                  disabled={loading}
                  className={`w-full btn bg-gradient-to-r ${getRoomColor(index)} text-white hover:shadow-lg hover:shadow-primary-500/25 transform hover:scale-105 transition-all duration-200 py-3 font-semibold`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Joining...
                    </div>
                  ) : (
                    <>
                      Join Room
                      <ArrowRightIcon className="h-5 w-5 ml-2" />
                    </>
                  )}
                </button>
              </div>

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000" />
     
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="card p-8 mb-12 border-primary-100 bg-gradient-to-r from-primary-50/50 to-purple-50/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center group">
            <div className="text-4xl font-bold text-primary-600 mb-3 group-hover:scale-110 transition-transform">{rooms.length}</div>
            <div className="text-gray-700 font-semibold">Active Rooms</div>
          </div>
          <div className="text-center group">
            <div className="text-4xl font-bold text-green-600 mb-3 group-hover:scale-110 transition-transform">24/7</div>
            <div className="text-gray-700 font-semibold">Always Online</div>
          </div>
          <div className="text-center group">
            <div className="text-4xl font-bold text-purple-600 mb-3 group-hover:scale-110 transition-transform">✨</div>
            <div className="text-gray-700 font-semibold">Secure & Fun</div>
          </div>
        </div>
      </div>

      {/* Welcome Message for Mods */}
      {user?.is_mod && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <SparklesIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-lg font-semibold text-red-900 flex items-center">
                <SparklesIcon className="h-5 w-5 mr-2" />
                Moderator Access
              </h4>
              <p className="text-red-700">
                You have moderator privileges. You can manage users and maintain a positive community environment across all chat rooms.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Community Guidelines */}
      
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-100 rounded-2xl p-8">
        <div className="text-center">
          <HeartIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-4">Community Guidelines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-gray-700">
            <div className="flex items-center">
              <SparklesIcon className="h-4 w-4 text-primary-500 mr-2 flex-shrink-0" />
              <span>Be respectful to all members</span>
            </div>
            <div className="flex items-center">
              <SparklesIcon className="h-4 w-4 text-primary-500 mr-2 flex-shrink-0" />
              <span>Keep conversations friendly</span>
            </div>
            <div className="flex items-center">
              <SparklesIcon className="h-4 w-4 text-primary-500 mr-2 flex-shrink-0" />
              <span>No spam or inappropriate content</span>
            </div>
            <div className="flex items-center">
              <SparklesIcon className="h-4 w-4 text-primary-500 mr-2 flex-shrink-0" />
              <span>Help create a welcoming space</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRooms;