import React, { useState, useEffect } from 'react';
import { MCPServer } from '../types/chat';
import { Settings, Server, Plus, Trash2, Check, X, Zap, Globe } from 'lucide-react';

interface MCPServerConfigProps {
  servers: MCPServer[];
  onAddServer: (server: Omit<MCPServer, 'id'>) => void;
  onDeleteServer: (serverId: string) => void;
  onToggleServer: (serverId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const MCPServerConfig: React.FC<MCPServerConfigProps> = ({
  servers,
  onAddServer,
  onDeleteServer,
  onToggleServer,
  isOpen,
  onClose
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    jsonConfig: ''
  });

  // Load existing MCP configuration on component mount
  useEffect(() => {
    const loadMcpConfig = async () => {
      try {
        const response = await fetch('/api/mcp_config');
        if (!response.ok) {
          throw new Error('Failed to load MCP configuration');
        }
        const config = await response.json();
        console.log('Loaded MCP configuration:', config);
      } catch (error) {
        console.error('Error loading MCP configuration:', error);
      }
    };

    if (isOpen) {
      loadMcpConfig();
    }
  }, [isOpen]);

  const handleAddServer = async () => {
    try {
      const serverConfig = JSON.parse(newServer.jsonConfig);
      const serverName = newServer.name;
      
      // Create the new server configuration
      const newServerConfig = {
        mcpServers: {
          [serverName]: serverConfig
        }
      };

      // Send the configuration to the backend
      const response = await fetch('/api/mcp_config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newServerConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to update MCP configuration');
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        // Add the server to the UI
        onAddServer({
          ...serverConfig,
          name: serverName,
          isActive: true
        });

        setNewServer({ name: '', jsonConfig: '' });
        setShowAddForm(false);
        console.log('MCP configuration updated successfully:', result.config);
      } else {
        throw new Error(result.message || 'Failed to update MCP configuration');
      }
    } catch (error) {
      console.error('Error updating MCP configuration:', error);
      alert('Invalid JSON configuration or failed to update. Please check the format and try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800/90 via-purple-900/80 to-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-white/20">
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                MCP Servers
              </h2>
              <p className="text-sm text-white/60">Configure your AI model connections</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all duration-300"
          >
            <X size={20} className="text-white/80 hover:text-white" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white">Connected Servers</h3>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-xl hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-sm font-medium"
              >
                <Plus size={16} />
                Add Server
              </button>
            </div>
            
            {servers.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Server className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No MCP servers configured</p>
                <p className="text-sm opacity-70">Add your first server to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {servers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-5 bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:border-white/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        ${server.isActive 
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                          : 'bg-gradient-to-br from-gray-500 to-gray-600'
                        }
                      `}>
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold text-white">{server.name}</h4>
                          <span className={`
                            px-3 py-1 text-xs rounded-full font-medium
                            ${server.isActive 
                              ? 'bg-gradient-to-r from-green-400/20 to-emerald-500/20 text-green-300 border border-green-400/30' 
                              : 'bg-gradient-to-r from-gray-500/20 to-gray-600/20 text-gray-300 border border-gray-500/30'
                            }
                          `}>
                            {server.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-white/60">{server.url}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleServer(server.id)}
                        className={`
                          p-2 rounded-xl transition-all duration-300
                          ${server.isActive 
                            ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300' 
                            : 'hover:bg-green-500/20 text-green-400 hover:text-green-300'
                          }
                        `}
                      >
                        {server.isActive ? <X size={18} /> : <Check size={18} />}
                      </button>
                      <button
                        onClick={() => onDeleteServer(server.id)}
                        className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all duration-300"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {showAddForm && (
            <div className="border-t border-white/20 pt-8">
              <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Add New Server
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={newServer.name}
                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 text-white placeholder-white/50 transition-all duration-300"
                    placeholder="e.g., GitHub Server"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Server Configuration (JSON)
                  </label>
                  <textarea
                    value={newServer.jsonConfig}
                    onChange={(e) => setNewServer({ ...newServer, jsonConfig: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 text-white placeholder-white/50 transition-all duration-300"
                    placeholder='{"type": "local", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "your_token"}}'
                    rows={5}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddServer}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white rounded-xl hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-medium"
                  >
                    Add Server
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};