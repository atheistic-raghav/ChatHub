import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  EyeIcon,
  EyeSlashIcon,
  BoltIcon,
  ShieldCheckIcon,
  UsersIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/rooms');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(formData);
    
    if (result.success) {
      navigate('/rooms');
    }
    
    setIsLoading(false);
  };

  const features = [
    {
      icon: BoltIcon,
      title: 'Instant Messaging',
      description: 'Connect with friends across multiple rooms',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Secure & Private',
      description: 'Advanced security measures protect your conversations',
    },
    {
      icon: UsersIcon,
      title: 'Growing Community',
      description: 'Build your network and stay connected',
    },
  ];

  return (
    <div className="min-h-screen gradient-bg flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-8">
        <div className="w-full max-w-md animate-slide-up">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-18 h-18 bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl shadow-soft mb-6 transition-transform hover:scale-105">
              <ChatBubbleLeftRightIcon className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Welcome Back</h1>
            <p className="text-gray-600 text-lg">Sign in to your ChatHub account</p>
          </div>

          {/* Form */}
          <div className="card">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-3">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="input"
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-3">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input pr-12"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary py-4 text-base font-semibold"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sign up link */}
          <div className="text-center mt-8">
            <p className="text-gray-600 text-base">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-primary-600 hover:text-primary-700 transition-colors underline decoration-2 underline-offset-2"
              >
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Features */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-500 to-purple-600 text-white items-center justify-center p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-purple-500/20"></div>
        <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-24 h-24 bg-purple-300/20 rounded-full blur-2xl"></div>
        
        <div className="max-w-md relative z-10">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">Professional Chat Platform</h2>
          <p className="text-xl text-primary-100 mb-12 leading-relaxed">
            Connect with your team and friends in a modern, secure environment designed for productivity and seamless communication.
          </p>

          <div className="space-y-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                    <feature.icon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                  <p className="text-primary-100 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
            <p className="text-center text-primary-100 text-sm">
              ✨ Join thousands of users already connecting on ChatHub
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;