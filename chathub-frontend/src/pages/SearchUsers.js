import React, { useState } from 'react';
import { usersAPI, friendsAPI } from '../utils/api';
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  UsersIcon,
  SparklesIcon,
  CheckIcon,
  GlobeAltIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import {
  ShieldCheckIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const SearchUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequests, setSendingRequests] = useState({});
  const [sentRequests, setSentRequests] = useState(new Set());

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await usersAPI.searchUsers(searchTerm.trim());
      setSearchResults(response.data.users);
      
      if (response.data.users.length === 0) {
        toast('No users found matching your search', { icon: '🔍' });
      }
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId, username) => {
    setSendingRequests({ ...sendingRequests, [userId]: true });
    
    try {
      await friendsAPI.sendFriendRequest(userId);
      setSentRequests(new Set([...sentRequests, userId]));
      toast.success(`Friend request sent to ${username}! 🚀`);
    } catch (error) {
      console.error('Error sending friend request:', error);
      if (error.response?.status === 400) {
        toast.error('Friend request already exists or you are already friends');
      } else {
        toast.error('Failed to send friend request');
      }
    } finally {
      setSendingRequests({ ...sendingRequests, [userId]: false });
    }
  };

  const getButtonContent = (userId, username) => {
    if (sendingRequests[userId]) {
      return (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          Sending...
        </>
      );
    }
    
    if (sentRequests.has(userId)) {
      return (
        <>
          <CheckIcon className="h-4 w-4" />
          Request Sent
        </>
      );
    }
    
    return (
      <>
        <UserPlusIcon className="h-4 w-4" />
        Add Friend
      </>
    );
  };

  const suggestions = [
    { icon: SparklesIcon, text: 'Search by username', color: 'text-yellow-600' },
    { icon: HeartIcon, text: 'Connect with like-minded people', color: 'text-pink-600' },
    { icon: GlobeAltIcon, text: 'Discover users from around the world', color: 'text-blue-600' },
  ];

  return (
    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl shadow-soft mb-8 animate-pulse-slow">
          <MagnifyingGlassIcon className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">Find Users</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Connect with amazing people in the ChatHub community. Search for users and build your network.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Search Form */}
        <div className="card p-8 mb-12 border-primary-100 bg-gradient-to-r from-primary-50/30 to-indigo-50/30">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label htmlFor="search" className="block text-sm font-semibold text-gray-700 mb-3">
                Search for users
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter username to search..."
                  className="input pl-12 text-lg py-4"
                  disabled={loading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading || !searchTerm.trim()}
              className={`w-full btn btn-primary py-4 text-base font-semibold ${
                loading || !searchTerm.trim() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Searching...
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="h-5 w-5" />
                  Search Users
                </>
              )}
            </button>
          </form>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <UsersIcon className="h-7 w-7 mr-3 text-primary-600" />
              Search Results ({searchResults.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((user) => (
                <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-primary-200 transition-all duration-200">
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold ${
                      user.is_mod 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-primary-500 to-purple-500'
                    }`}>
                      {user.username[0]?.toUpperCase()}
                    </div>
                    
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{user.username}</h3>
                      {user.is_mod && (
                        <ShieldCheckIcon className="h-5 w-5 text-red-500" title="Moderator" />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.is_mod 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-primary-100 text-primary-800'
                      }`}>
                        {user.is_mod ? (
                          <>
                            <SparklesIcon className="h-3 w-3 mr-1" />
                            Moderator
                          </>
                        ) : (
                          'Community Member'
                        )}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-4">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                    
                    <button
                      onClick={() => handleSendFriendRequest(user.id, user.username)}
                      disabled={sendingRequests[user.id] || sentRequests.has(user.id)}
                      className={`w-full btn py-2 transition-all duration-200 ${
                        sentRequests.has(user.id)
                          ? 'bg-green-100 text-green-800 border-green-200 cursor-default'
                          : sendingRequests[user.id]
                          ? 'btn-secondary opacity-50 cursor-not-allowed'
                          : 'btn-primary'
                      }`}
                    >
                      {getButtonContent(user.id, user.username)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State / Tips */}
        {searchResults.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <UsersIcon className="h-12 w-12 text-indigo-500" />
            </div>
            
            {searchTerm ? (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No users found</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Try searching with different keywords or check your spelling. Make sure you're using the exact username.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Discover new connections</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Use the search box above to find users by their username and expand your network on ChatHub.
                </p>
              </>
            )}

            {/* Tips */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-8 max-w-2xl mx-auto">
              <h4 className="text-lg font-semibold text-gray-900 mb-6 flex items-center justify-center">
                <SparklesIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Tips for finding users
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="text-center">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <suggestion.icon className={`h-6 w-6 ${suggestion.color}`} />
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{suggestion.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchUsers;