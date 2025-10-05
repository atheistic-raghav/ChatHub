import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-purple-50">
        <div className="text-center">
          {/* Animated Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl flex items-center justify-center animate-pulse">
                <ChatBubbleLeftRightIcon className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl opacity-30 animate-ping"></div>
            </div>
          </div>
          
          {/* Loading Text */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              Loading ChatHub
            </h2>
            <p className="text-gray-600 font-medium">Connecting you to the community...</p>
          </div>
          
          {/* Loading Bar */}
          <div className="mt-8 w-64 mx-auto">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Loading Dots */}
          <div className="flex justify-center space-x-2 mt-6">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;