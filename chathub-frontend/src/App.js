import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatRooms from './pages/ChatRooms';
import Chat from './pages/Chat';
import Friends from './pages/Friends';
import PrivateChat from './pages/PrivateChat';
import SearchUsers from './pages/SearchUsers';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Layout><Navigate to="/rooms"/></Layout></ProtectedRoute>} />
            <Route path="/rooms" element={<ProtectedRoute><Layout><ChatRooms/></Layout></ProtectedRoute>} />
            <Route path="/chat/:roomName" element={<ProtectedRoute><Layout><Chat/></Layout></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><Layout><Friends/></Layout></ProtectedRoute>} />
            <Route path="/private-chat/:friendId" element={<ProtectedRoute><Layout><PrivateChat/></Layout></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Layout><SearchUsers/></Layout></ProtectedRoute>} />
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
