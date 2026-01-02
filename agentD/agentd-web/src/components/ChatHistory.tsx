import React from 'react';
import { ChatSession } from '../types/chat';
import { MessageCircle, Trash2, Plus, Clock } from 'lucide-react';

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat
}) => {
  return (
    <div className="w-80 bg-gradient-to-b from-slate-800/50 via-purple-900/30 to-slate-800/50 backdrop-blur-md border-r border-white/10 flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-xl hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-medium"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
          <Clock size={16} />
          Chat History
        </h3>
        
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1 opacity-70">Start your first chat to begin</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`
                group relative p-4 rounded-xl cursor-pointer transition-all duration-300 backdrop-blur-sm
                ${activeSessionId === session.id 
                  ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-600/20 border border-cyan-400/30 shadow-lg' 
                  : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                }
              `}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate text-sm mb-1">
                    {session.title}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {session.messages.length}
                    </span>
                    <span>
                      {session.updatedAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg transition-all duration-300 backdrop-blur-sm"
                >
                  <Trash2 size={14} className="text-red-400 hover:text-red-300" />
                </button>
              </div>
              
              {activeSessionId === session.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-600/10 rounded-xl -z-10 animate-pulse"></div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/50 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-1 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <span>Powered by Axiom AI</span>
            <div className="w-1 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};