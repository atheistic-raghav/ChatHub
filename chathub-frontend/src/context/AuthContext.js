// src/context/AuthContext.js

import React, { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { authAPI } from '../utils/api'

const AuthContext = createContext()
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('chathub_token'))

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('chathub_token')
    const storedUser = localStorage.getItem('chathub_user')
    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('chathub_token')
        localStorage.removeItem('chathub_user')
        setToken(null)
        setUser(null)
      }
    }
    setLoading(false)
  }, [])

  const login = async (credentials) => {
    try {
      const { data } = await authAPI.login(credentials)
      localStorage.setItem('chathub_token', data.access_token)
      localStorage.setItem('chathub_user', JSON.stringify(data.user))
      setToken(data.access_token)
      setUser(data.user)
      toast.success('Welcome to ChatHub! 🎉')
      return { success: true }
    } catch (err) {
      const message = err?.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const register = async (userData) => {
    try {
      await authAPI.register(userData)
      toast.success('Account created! Please login.')
      return { success: true }
    } catch (err) {
      const message = err?.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      // best-effort server logout
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    localStorage.removeItem('chathub_token')
    localStorage.removeItem('chathub_user')
    setToken(null)
    setUser(null)
    toast.success('Logged out')
  }

  const isAuthenticated = () => !!token && !!user

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}
