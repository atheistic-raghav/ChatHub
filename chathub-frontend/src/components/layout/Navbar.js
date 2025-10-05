import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  ChatBubbleLeftRightIcon,
  HomeIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { connected, onlineUsers } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Chat Rooms', href: '/rooms', icon: HomeIcon },
    { name: 'Friends', href: '/friends', icon: UsersIcon },
    { name: 'Find Users', href: '/search', icon: MagnifyingGlassIcon },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/20 shadow-soft">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/rooms" className="flex items-center space-x-3 group">
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl shadow-soft group-hover:shadow-glow transition-all duration-300 group-hover:scale-105">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                    ChatHub
                  </span>
                  <span className="text-xs text-gray-500 font-semibold tracking-wide">Connect & Chat</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:block">
              <div className="flex items-center space-x-2">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive
                          ? 'bg-gradient-to-r from-primary-500 to-purple-500 text-white shadow-lg'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      } group flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:shadow-md`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* User Menu */}
            <div className="hidden lg:block">
              <div className="flex items-center space-x-4">
                
                {/* Connection Status */}
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gray-100">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  <span className="text-xs text-gray-600 font-medium">
                    {connected ? 'Online' : 'Offline'}
                  </span>
                  {connected && onlineUsers.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({onlineUsers.length} online)
                    </span>
                  )}
                </div>

                {/* Notifications */}
                <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
                  <BellIcon className="h-5 w-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full"></span>
                </button>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-center w-9 h-9 bg-gradient-to-r from-primary-500 to-purple-500 rounded-lg text-white font-bold text-sm">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold text-gray-900 flex items-center">
                        {user?.username}
                        {user?.is_mod && (
                          <SparklesIcon className="ml-1 h-4 w-4 text-yellow-500" />
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {user?.is_mod ? 'Moderator' : 'Member'}
                      </span>
                    </div>
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl ring-1 ring-black/5 border border-gray-100 animate-fade-in">
                      <div className="p-2">
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900">{user?.username}</p>
                          <p className="text-xs text-gray-500">{user?.is_mod ? 'Moderator Account' : 'Member Account'}</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                        >
                          <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center rounded-xl bg-white border border-gray-200 p-2.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="space-y-1 px-4 pb-4 pt-4">
              
              {/* User info */}
              <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl text-white font-bold">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-900">{user?.username}</span>
                    {user?.is_mod && (
                      <SparklesIcon className="ml-1 h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        connected ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-sm text-gray-500">
                      {connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`${
                      isActive
                        ? 'bg-gradient-to-r from-primary-500 to-purple-500 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    } group flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-3 text-base font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Click outside to close menus */}
      {(mobileMenuOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/5"
          onClick={() => {
            setMobileMenuOpen(false);
            setUserMenuOpen(false);
          }}
        />
      )}
    </>
  );
};

export default Navbar;