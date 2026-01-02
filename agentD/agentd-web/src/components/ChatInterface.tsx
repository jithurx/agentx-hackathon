import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatHistory } from './ChatHistory';
import { MCPServerConfig } from './MCPServerConfig';
import { Message, ChatSession, MCPServer } from '../types/chat';
import { Send, Settings, Menu, X, Sparkles } from 'lucide-react';

function parseDate(date: string | Date): Date {
  return date instanceof Date ? date : new Date(date);
}

export const ChatInterface: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [showMcpConfig, setShowMcpConfig] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isTyping]);

  // Load all sessions on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/chat_sessions')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load sessions');
        return res.json();
      })
      .then(data => {
        const loadedSessions: ChatSession[] = (data.sessions || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          messages: [], // will be loaded on select
          createdAt: parseDate(s.created_at),
          updatedAt: parseDate(s.updated_at),
        }));
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) setActiveSessionId(loadedSessions[0].id);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Failed to load sessions');
        setLoading(false);
      });
  }, []);

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) return;
    fetch(`/api/chat_sessions/${activeSessionId}`)
      .then(res => res.json())
      .then(data => {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { ...s, messages: (data.messages || []).map((m: any) => ({
                id: m.id.toString(),
                content: m.content,
                role: m.role,
                timestamp: parseDate(m.timestamp),
              })) }
            : s
        ));
      });
  }, [activeSessionId]);

  // After the initial session load effect:
  useEffect(() => {
    if (!loading && !creatingSession && sessions.length === 0 && !activeSessionId) {
      setCreatingSession(true);
      (async () => {
        await createNewSession();
        setCreatingSession(false);
      })();
    }
  }, [loading, creatingSession, sessions, activeSessionId]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Create new session (persisted)
  const createNewSession = useCallback(async (firstMessage?: string) => {
    try {
      const newId = generateId();
      const now = new Date();
      // Build a safe payload for session creation. If JSON.stringify fails
      // (e.g. due to an unexpected circular value), fall back to form-encoding.
      const payloadObj = { id: newId, title: firstMessage || 'Untitled Chat' };
      let headers: any = { 'Content-Type': 'application/json' };
      let bodyPayload: string;
      try {
        bodyPayload = JSON.stringify(payloadObj);
      } catch (err) {
        // Fallback to urlencoded form body if JSON serialization fails
        console.error('Failed to stringify session payload, falling back to form-encoding', err);
        bodyPayload = new URLSearchParams({ id: String(payloadObj.id), title: String(payloadObj.title) }).toString();
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      }

      const res = await fetch('/api/chat_sessions', {
        method: 'POST',
        headers,
        body: bodyPayload,
      });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        messages: [],
        createdAt: parseDate(data.created_at),
        updatedAt: parseDate(data.updated_at),
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    } catch (e: any) {
      setError(e.message || 'Failed to create session');
    }
  }, []);

  // Send message (persisted)
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    let currentSessionId = activeSessionId;
    // Create new session if none exists
    if (!currentSessionId) {
      await createNewSession(inputMessage);
      // Wait for the new session to be set as active
      const res = await fetch('/api/chat_sessions');
      const data = await res.json();
      const loadedSessions: ChatSession[] = (data.sessions || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        messages: [],
        createdAt: parseDate(s.created_at),
        updatedAt: parseDate(s.updated_at),
      }));
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) setActiveSessionId(loadedSessions[0].id);
      return;
    }
    const userMessage: Message = {
      id: generateId(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date(),
    };
    // Persist user message
    await fetch('/api/chat_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSessionId,
        role: 'user',
        content: userMessage.content,
        timestamp: userMessage.timestamp.toISOString(),
      }),
    });
    setSessions(prev => prev.map(session =>
      session.id === currentSessionId
        ? { ...session, messages: [...session.messages, userMessage], updatedAt: new Date() }
        : session
    ));
    // --- ADDED: Reload sessions if title is generic ---
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (currentSession && (currentSession.title === 'Untitled Chat' || currentSession.title === 'New Chat')) {
      fetch('/api/chat_sessions')
        .then(res => res.json())
        .then(data => {
          const loadedSessions: ChatSession[] = (data.sessions || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: [],
            createdAt: parseDate(s.created_at),
            updatedAt: parseDate(s.updated_at),
          }));
          setSessions(loadedSessions);
          setActiveSessionId(currentSessionId); // Ensure UI updates to the correct session
        });
    }
    setInputMessage('');
    setIsTyping(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, message: userMessage.content }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const aiResponseContent = data.response || 'No response from AI.';
      const aiMessage: Message = {
        id: generateId(),
        content: aiResponseContent,
        role: 'assistant',
        timestamp: new Date(),
      };
      // Persist assistant message
      await fetch('/api/chat_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          role: 'assistant',
          content: aiMessage.content,
          timestamp: aiMessage.timestamp.toISOString(),
        }),
      });
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, aiMessage], updatedAt: new Date() }
          : session
      ));
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        content: `Error: Could not get response from AI. ${error instanceof Error ? error.message : String(error)}`,
        role: 'assistant',
        timestamp: new Date(),
      };
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, errorMessage], updatedAt: new Date() }
          : session
      ));
    } finally {
      setIsTyping(false);
    }
  };

  // Delete session (persisted)
  const deleteSession = async (sessionId: string) => {
    await fetch(`/api/chat_sessions/${sessionId}`, { method: 'DELETE' });
    setSessions(prev => {
      const updatedSessions = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(updatedSessions.length > 0 ? updatedSessions[0].id : null);
      }
      return updatedSessions;
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addMcpServer = (server: Omit<MCPServer, 'id'>) => {
    const newServer: MCPServer = {
      ...server,
      id: generateId(),
      isActive: true
    };
    setMcpServers(prev => [...prev, newServer]);
  };

  const deleteMcpServer = (serverId: string) => {
    setMcpServers(prev => prev.filter(s => s.id !== serverId));
  };

  const toggleMcpServer = (serverId: string) => {
    setMcpServers(prev => prev.map(server =>
      server.id === serverId
        ? { ...server, isActive: !server.isActive }
        : server
    ));
  };

  if (loading || creatingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-white text-lg">Loading chat sessions...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="bg-red-500/20 text-red-200 p-6 rounded-xl shadow-lg">
          <div className="font-bold mb-2">Error</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {showSidebar && (
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onDeleteSession={deleteSession}
          onNewChat={createNewSession}
        />
      )}
      <div className="flex-1 flex flex-col backdrop-blur-sm">
        <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-white/10 rounded-xl transition-all duration-300 lg:hidden backdrop-blur-sm"
            >
              {showSidebar ? <X size={20} className="text-white" /> : <Menu size={20} className="text-white" />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Axiom AI
                </h1>
                <p className="text-sm text-white/70">
                  {activeSession ? activeSession.title : 'Select or start a new chat'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowMcpConfig(true)}
            className="p-3 hover:bg-white/10 rounded-xl transition-all duration-300 backdrop-blur-sm group"
            title="Configure MCP Servers"
          >
            <Settings size={20} className="text-white/80 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-transparent to-black/20">
          {activeSession ? (
            <>
              {activeSession.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isTyping && (
                <MessageBubble
                  message={{
                    id: 'typing',
                    content: '',
                    role: 'assistant',
                    timestamp: new Date(),
                    isTyping: true
                  }}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <Sparkles className="text-white w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
                  Welcome to Axiom AI
                </h2>
                <p className="text-white/70 mb-6 text-lg">Start a conversation to explore infinite possibilities</p>
                <button
                  onClick={createNewSession}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-xl hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 font-medium"
                >
                  Start New Chat
                </button>
              </div>
            </div>
          )}
        </div>
        {activeSession && (
          <div className="border-t border-white/10 bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-pink-600/10 backdrop-blur-md p-6">
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask Axiom AI anything..."
                  className="w-full resize-none bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 pr-16 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 min-h-[60px] max-h-32 text-white placeholder-white/50 transition-all duration-300 break-words overflow-hidden"
                  rows={1}
                  style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm text-white/60">
                <span>Press Enter to send, Shift+Enter for new line</span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                  {mcpServers.filter(s => s.isActive).length} MCP server(s) connected
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <MCPServerConfig
        servers={mcpServers}
        onAddServer={addMcpServer}
        onDeleteServer={deleteMcpServer}
        onToggleServer={toggleMcpServer}
        isOpen={showMcpConfig}
        onClose={() => setShowMcpConfig(false)}
      />
    </div>
  );
};