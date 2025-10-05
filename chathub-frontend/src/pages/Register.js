import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  EyeIcon,
  EyeSlashIcon,
  UserPlusIcon,
  SparklesIcon,
  HeartIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
} from '@heroicons/react/24/solid';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/rooms');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.toLowerCase() === 'system') {
      newErrors.username = 'Username "SYSTEM" is reserved';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    const result = await register({
      username: formData.username,
      password: formData.password,
    });
    
    if (result.success) {
      navigate('/login');
    }
    
    setIsLoading(false);
  };

  const features = [
    {
      icon: SparklesIcon,
      title: 'Instant Setup',
      description: 'Create your account in seconds and start chatting immediately',
    },
    {
      icon: HeartIcon,
      title: 'Friendly Community',
      description: 'Connect and maintain friendships in our vibrant community',
    },
    {
      icon: GlobeAltIcon,
      title: 'Global Reach',
      description: 'Connect with people from around the world in real-time',
    },
  ];

  const benefits = [
    'Multiple chat rooms for different topics',
    'Private messaging with friends',
    'Real-time notifications',
    'Professional and secure platform',
    'Mobile-responsive design',
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
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Join ChatHub</h1>
            <p className="text-gray-600 text-lg">Create your account and start connecting with amazing people</p>
          </div>

          {/* Form */}
          <div className="card">
            <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className={`input ${errors.username ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="Choose a unique username"
                disabled={isLoading}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
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
                  className={`input pr-10 ${errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder="Enter a secure password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`input pr-10 ${errors.confirmPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full btn btn-primary py-3 text-base font-semibold ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-5 w-5" />
                  Create Account
                </>
              )}
            </button>
            </form>
          </div>

          {/* Sign in link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-primary-600 hover:text-primary-500 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Features */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-500 to-purple-600 text-white items-center justify-center p-12">
        <div className="max-w-md">
          <h2 className="text-4xl font-bold mb-6">Welcome to the Future of Chat</h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of users already connecting on ChatHub - the modern chat platform designed for everyone.
          </p>

          {/* Features */}
          <div className="space-y-6 mb-10">
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

          {/* Benefits List */}
          <div className="bg-white/10 rounded-xl p-6 backdrop-blur-md border border-white/20">
            <h4 className="font-semibold text-lg mb-4 flex items-center">
              <SparklesIcon className="h-5 w-5 mr-2" />
              What you'll get:
            </h4>
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center text-primary-100 text-sm">
                  <CheckCircleIcon className="h-4 w-4 text-green-300 mr-3 flex-shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;