import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ChatInterface } from './components/ChatInterface';
import { ChatHistory } from './components/ChatHistory';
import { MCPServerConfig } from './components/MCPServerConfig';
import { Dashboard } from './components/Dashboard';
import { Home, MessageSquare, History, Settings, BarChart3, Sparkles } from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: <BarChart3 className="w-5 h-5" />, label: 'Dashboard' },
    { path: '/chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
    { path: '/history', icon: <History className="w-5 h-5" />, label: 'History' },
    { path: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur-md border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Wave AI
              </h1>
              <p className="text-sm text-white/70">Intelligent System Assistant</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm ${
                  location.pathname === item.path
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10 border border-white/20'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

const NAV_HEIGHT = 80; // px, matches p-4 and content height

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Navigation />
        <main className="flex-1 pt-24"> {/* pt-24 = 6rem = 96px, enough for nav height and spacing */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<ChatInterface />} />
            <Route path="/history" element={<ChatHistory />} />
            <Route path="/settings" element={<MCPServerConfig />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;