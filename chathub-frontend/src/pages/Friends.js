import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { friendsAPI } from '../utils/api';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  HeartIcon,
  UserPlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  ShieldCheckIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const Friends = () => {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    loadFriendsData();
  }, []);

  const loadFriendsData = async () => {
    try {
      const response = await friendsAPI.getFriends();
      setFriends(response.data.friends);
      setFriendRequests(response.data.friend_requests);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    setProcessing({ ...processing, [requestId]: 'accepting' });
    
    try {
      await friendsAPI.acceptFriendRequest(requestId);
      toast.success('Friend request accepted! 🎉');
      loadFriendsData();
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept friend request');
    } finally {
      setProcessing({ ...processing, [requestId]: null });
    }
  };

  const handleRejectRequest = async (requestId) => {
    setProcessing({ ...processing, [requestId]: 'rejecting' });
    
    try {
      await friendsAPI.rejectFriendRequest(requestId);
      toast.success('Friend request rejected');
      loadFriendsData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject friend request');
    } finally {
      setProcessing({ ...processing, [requestId]: null });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 bg-pink-200 rounded-2xl mx-auto mb-6"></div>
          <div className="h-4 bg-pink-200 rounded-lg w-36 mx-auto mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-28 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-500 rounded-3xl shadow-soft mb-8 animate-pulse-slow">
          <HeartIcon className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">My Friends</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Connect and chat with your network. Build meaningful relationships in our vibrant community.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <div className="mb-12">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
                    <ClockIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-yellow-900">Friend Requests</h2>
                    <p className="text-yellow-700">You have {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="bg-yellow-500 text-white text-sm font-bold py-1 px-3 rounded-full">
                  {friendRequests.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {friendRequests.map((request) => (
                <div key={request.id} className="card hover:border-yellow-200 hover:shadow-lg transition-all duration-300">
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold ${
                      request.sender.is_mod 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-primary-500 to-purple-500'
                    }`}>
                      {request.sender.username[0]?.toUpperCase()}
                    </div>
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{request.sender.username}</h3>
                      {request.sender.is_mod && (
                        <ShieldCheckIcon className="h-5 w-5 text-red-500" title="Moderator" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Sent {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        disabled={processing[request.id]}
                        className="flex-1 btn bg-green-500 text-white hover:bg-green-600 py-2"
                      >
                        {processing[request.id] === 'accepting' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto" />
                        ) : (
                          <>
                            <CheckIcon className="h-4 w-4" />
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={processing[request.id]}
                        className="flex-1 btn bg-red-500 text-white hover:bg-red-600 py-2"
                      >
                        {processing[request.id] === 'rejecting' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto" />
                        ) : (
                          <>
                            <XMarkIcon className="h-4 w-4" />
                            Reject
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <UsersIcon className="h-7 w-7 mr-3 text-primary-600" />
              My Friends ({friends.length})
            </h2>
            <p className="text-gray-600 mt-1">Start conversations with your connections</p>
          </div>
          
          <Link
            to="/search"
            className="btn btn-primary"
          >
            <UserPlusIcon className="h-5 w-5" />
            Find Friends
          </Link>
        </div>

        {/* Friends Grid */}
        {friends.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <UsersIcon className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No friends yet</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start building your network by finding and adding friends. Connect with people who share your interests!
            </p>
            <div className="space-x-4">
              <Link
                to="/search"
                className="btn btn-primary"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
                Find Users
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {friends.map((friend) => (
              <div key={friend.id} className="group bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-primary-200 transition-all duration-200">
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold group-hover:scale-105 transition-transform ${
                    friend.is_mod 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : 'bg-gradient-to-r from-primary-500 to-purple-500'
                  }`}>
                    {friend.username[0]?.toUpperCase()}
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{friend.username}</h3>
                    {friend.is_mod && (
                      <SparklesIcon className="h-5 w-5 text-yellow-500" title="Moderator" />
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    {friend.is_mod ? 'Moderator' : 'Community Member'}
                  </p>
                  
                  <Link
                    to={`/private-chat/${friend.id}`}
                    className="btn btn-primary w-full py-2"
                  >
                    <ChatBubbleLeftIcon className="h-4 w-4" />
                    Chat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Card */}
        {friends.length > 0 && (
          <div className="mt-12 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-100 rounded-2xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-primary-600 mb-2">{friends.length}</div>
                <div className="text-gray-600 font-medium">Friends</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">{friendRequests.length}</div>
                <div className="text-gray-600 font-medium">Pending Requests</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-pink-600 mb-2">
                  {friends.filter(f => f.is_mod).length}
                </div>
                <div className="text-gray-600 font-medium">Moderator Friends</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;