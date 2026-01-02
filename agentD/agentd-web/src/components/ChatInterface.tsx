import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatHistory } from './ChatHistory';
import { MCPServerConfig } from './MCPServerConfig';
import { Message, ChatSession, MCPServer } from '../types/chat';
import { Send, Settings, Menu, X } from 'lucide-react';

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
  const [progress, setProgress] = useState<{step: number, total: number, message: string} | null>(null);
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
          messages: [],
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

  const createNewSession = useCallback(async (firstMessage?: string) => {
    try {
      const newId = generateId();
      const payloadObj = { id: newId, title: firstMessage || 'Untitled Chat' };
      let headers: any = { 'Content-Type': 'application/json' };
      let bodyPayload: string;
      try {
        bodyPayload = JSON.stringify(payloadObj);
      } catch (err) {
        console.error('Failed to stringify session payload', err);
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

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      await createNewSession(inputMessage);
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
          setActiveSessionId(currentSessionId);
        });
    }
    setInputMessage('');
    setIsTyping(true);
    setProgress(null);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setProgress({ step: data.step, total: data.total, message: data.message });
            } else if (data.type === 'response') {
              const aiMessage: Message = {
                id: generateId(),
                content: data.content,
                role: 'assistant',
                timestamp: new Date(),
              };
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
              setIsTyping(false);
              setProgress(null);
              return;
            } else if (data.type === 'error') {
              const errorMessage: Message = {
                id: generateId(),
                content: `Error: ${data.message}`,
                role: 'assistant',
                timestamp: new Date(),
              };
              setSessions(prev => prev.map(session =>
                session.id === currentSessionId
                  ? { ...session, messages: [...session.messages, errorMessage], updatedAt: new Date() }
                  : session
              ));
              setIsTyping(false);
              setProgress(null);
              return;
            }
          }
        }
      }
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
      setIsTyping(false);
      setProgress(null);
    }
  };

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
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-0f1923 via-1a2942 to-132847">
        <div className="text-white text-lg font-anton border border-white/30 px-8 py-6 bg-white/10 backdrop-blur-xl rounded-2xl">
          ⏳ LOADING AGENTD...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-0f1923 via-1a2942 to-132847">
        <div className="bg-white/10 backdrop-blur-xl border border-white/30 text-white p-6 font-anton text-center rounded-2xl">
          <div className="font-anton mb-2 text-xl">⚠️ ERROR</div>
          <div className="font-general-sans font-semibold">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {showSidebar && (
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onDeleteSession={deleteSession}
          onNewChat={createNewSession}
        />
      )}
      <div className="chat-main">
        <div className="chat-header">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg font-anton text-lg lg:hidden hover:bg-white/20 transition-all"
              title="Toggle Sidebar"
            >
              {showSidebar ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-lg border border-white/30 rounded-lg flex items-center justify-center font-anton text-agentd-primary text-xl">
                A
              </div>
              <div>
                <h1 className="m-0 text-agentd-primary">AGENTD</h1>
                <p className="text-xs text-agentd-text/70 font-general-sans font-semibold m-0">
                  {activeSession ? activeSession.title : 'Select a chat'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowMcpConfig(true)}
            className="p-2 rounded-lg font-anton hover:bg-white/20 transition-all text-agentd-primary"
            title="Configure MCP Servers"
          >
            <Settings size={24} />
          </button>
        </div>

        <div className="chat-messages">
          {activeSession ? (
            <>
              {activeSession.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {progress && (
                <div className="message-bubble agent">
                  <div className="message-avatar agent">A</div>
                  <div className="message-content agent">
                    <div className="flex flex-col gap-2">
                      <div className="text-sm text-agentd-text/70">
                        {progress.message}
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div
                          className="bg-agentd-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(progress.step / progress.total) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-agentd-text/50">
                        Step {progress.step} of {progress.total}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isTyping && !progress && (
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
              <div className="text-center border border-white/30 backdrop-blur-lg bg-white/10 p-12 rounded-2xl">
                <h1 className="text-agentd-primary mb-4">AGENTD CHAT</h1>
                <p className="text-agentd-text font-general-sans font-semibold mb-8 text-lg">
                  Start a conversation to explore possibilities
                </p>
                <button
                  onClick={createNewSession}
                  className="px-8 py-4 font-anton text-lg"
                >
                  START NEW CHAT
                </button>
              </div>
            </div>
          )}
        </div>

        {activeSession && (
          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="ASK AGENTD..."
              className="chat-input"
              rows={2}
              style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="send-button"
            >
              <Send size={24} />
            </button>
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
