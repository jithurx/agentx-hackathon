#!/usr/bin/env python3
"""
Cross-Platform OS Agent using Gemini 1.5 Flash with Persistent Memory
A comprehensive system agent that can perform OS operations on Linux and Windows
with memory that persists across sessions
"""

import os
import sys
import subprocess
import platform
import json
import shutil
import psutil
import time
import sqlite3
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import google.generativeai as genai
from datetime import datetime
import logging
from dotenv import load_dotenv
import hashlib
import pickle

load_dotenv()

class MemoryManager:
    """Manages persistent memory for the OS Agent"""
    
    def __init__(self, memory_dir: str = "agent_memory"):
        self.memory_dir = Path(memory_dir)
        self.memory_dir.mkdir(exist_ok=True)
        
        # Database file for structured memory
        self.db_path = self.memory_dir / "agent_memory.db"
        
        # JSON file for quick access memory
        self.quick_memory_path = self.memory_dir / "quick_memory.json"
        
        # Initialize database
        self._init_database()
        
        # Load quick memory
        self.quick_memory = self._load_quick_memory()
        
        # Session ID for current session
        self.session_id = self._generate_session_id()
        
    def _generate_session_id(self) -> str:
        """Generate unique session ID"""
        timestamp = datetime.now().isoformat()
        return hashlib.md5(timestamp.encode()).hexdigest()[:8]
    
    def _init_database(self):
        """Initialize SQLite database for memory storage"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Conversations table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    timestamp TEXT,
                    user_request TEXT,
                    agent_response TEXT,
                    execution_results TEXT,
                    system_state TEXT
                )
            ''')
            
            # System facts table (for learned information)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fact_key TEXT UNIQUE,
                    fact_value TEXT,
                    timestamp TEXT,
                    session_id TEXT
                )
            ''')
            
            # User preferences table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    preference_key TEXT UNIQUE,
                    preference_value TEXT,
                    timestamp TEXT
                )
            ''')
            
            # Command history table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    command TEXT,
                    success BOOLEAN,
                    timestamp TEXT,
                    session_id TEXT,
                    context TEXT
                )
            ''')
            
            conn.commit()
    
    def _load_quick_memory(self) -> Dict[str, Any]:
        """Load quick access memory from JSON"""
        if self.quick_memory_path.exists():
            try:
                with open(self.quick_memory_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                pass
        
        return {
            'frequent_commands': {},
            'user_patterns': {},
            'system_shortcuts': {},
            'learned_preferences': {}
        }
    
    def _save_quick_memory(self):
        """Save quick access memory to JSON"""
        try:
            with open(self.quick_memory_path, 'w') as f:
                json.dump(self.quick_memory, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save quick memory: {e}")
    
    def store_conversation(self, user_request: str, agent_response: Dict[str, Any], 
                          execution_results: List[Dict[str, Any]], system_state: Dict[str, Any]):
        """Store conversation in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO conversations 
                    (session_id, timestamp, user_request, agent_response, execution_results, system_state)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    self.session_id,
                    datetime.now().isoformat(),
                    user_request,
                    json.dumps(agent_response),
                    json.dumps(execution_results),
                    json.dumps(system_state)
                ))
                conn.commit()
        except Exception as e:
            print(f"Warning: Could not store conversation: {e}")
    
    def store_command_history(self, command: str, success: bool, context: str = ""):
        """Store command execution history"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO command_history (command, success, timestamp, session_id, context)
                    VALUES (?, ?, ?, ?, ?)
                ''', (command, success, datetime.now().isoformat(), self.session_id, context))
                conn.commit()
                
            # Update quick memory for frequent commands
            cmd_key = command.split()[0] if command.split() else command
            if cmd_key in self.quick_memory['frequent_commands']:
                self.quick_memory['frequent_commands'][cmd_key] += 1
            else:
                self.quick_memory['frequent_commands'][cmd_key] = 1
                
        except Exception as e:
            print(f"Warning: Could not store command history: {e}")
    
    def store_system_fact(self, fact_key: str, fact_value: str):
        """Store learned system fact"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO system_facts (fact_key, fact_value, timestamp, session_id)
                    VALUES (?, ?, ?, ?)
                ''', (fact_key, fact_value, datetime.now().isoformat(), self.session_id))
                conn.commit()
        except Exception as e:
            print(f"Warning: Could not store system fact: {e}")
    
    def get_recent_conversations(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get recent conversations for context"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_request, agent_response, timestamp
                    FROM conversations
                    ORDER BY timestamp DESC
                    LIMIT ?
                ''', (limit,))
                
                conversations = []
                for row in cursor.fetchall():
                    try:
                        conversations.append({
                            'user_request': row[0],
                            'agent_response': json.loads(row[1]),
                            'timestamp': row[2]
                        })
                    except json.JSONDecodeError:
                        continue
                        
                return conversations
        except Exception as e:
            print(f"Warning: Could not retrieve conversations: {e}")
            return []
    
    def get_command_patterns(self) -> Dict[str, Any]:
        """Get command usage patterns"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT command, COUNT(*) as frequency, 
                           AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate
                    FROM command_history
                    GROUP BY command
                    ORDER BY frequency DESC
                    LIMIT 10
                ''')
                
                patterns = {}
                for row in cursor.fetchall():
                    patterns[row[0]] = {
                        'frequency': row[1],
                        'success_rate': row[2]
                    }
                return patterns
        except Exception as e:
            print(f"Warning: Could not retrieve command patterns: {e}")
            return {}
    
    def get_system_facts(self) -> Dict[str, str]:
        """Get stored system facts"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT fact_key, fact_value FROM system_facts')
                return {row[0]: row[1] for row in cursor.fetchall()}
        except Exception as e:
            print(f"Warning: Could not retrieve system facts: {e}")
            return {}
    
    def get_memory_context(self) -> str:
        """Generate memory context for Gemini"""
        recent_conversations = self.get_recent_conversations(3)
        command_patterns = self.get_command_patterns()
        system_facts = self.get_system_facts()
        
        context = "\n=== MEMORY CONTEXT ===\n"
        
        # Recent conversations
        if recent_conversations:
            context += "Recent Conversations:\n"
            for conv in recent_conversations:
                context += f"- User: {conv['user_request'][:100]}...\n"
                context += f"  Time: {conv['timestamp']}\n"
        
        # Command patterns
        if command_patterns:
            context += "\nFrequent Commands:\n"
            for cmd, stats in list(command_patterns.items())[:5]:
                context += f"- {cmd}: used {stats['frequency']} times (success: {stats['success_rate']:.1%})\n"
        
        # System facts
        if system_facts:
            context += "\nLearned System Facts:\n"
            for key, value in list(system_facts.items())[:5]:
                context += f"- {key}: {value}\n"
        
        # Quick memory insights
        if self.quick_memory['learned_preferences']:
            context += "\nUser Preferences:\n"
            for pref, value in self.quick_memory['learned_preferences'].items():
                context += f"- {pref}: {value}\n"
        
        context += "=== END MEMORY CONTEXT ===\n"
        return context
    
    def cleanup_old_data(self, days_to_keep: int = 30):
        """Clean up old memory data"""
        try:
            cutoff_date = datetime.now().timestamp() - (days_to_keep * 24 * 3600)
            cutoff_iso = datetime.fromtimestamp(cutoff_date).isoformat()
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM conversations WHERE timestamp < ?', (cutoff_iso,))
                cursor.execute('DELETE FROM command_history WHERE timestamp < ?', (cutoff_iso,))
                conn.commit()
                
            print(f"Cleaned up memory data older than {days_to_keep} days")
        except Exception as e:
            print(f"Warning: Could not cleanup old data: {e}")


class OSAgent:
    def __init__(self, gemini_api_key: str):
        """Initialize the OS Agent with Gemini API key and memory"""
        self.system = platform.system().lower()
        self.is_windows = self.system == 'windows'
        self.is_linux = self.system == 'linux'
        
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Initialize memory manager
        self.memory = MemoryManager()
        
        # Setup logging
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        self.logger = logging.getLogger(__name__)
        
        # System information
        self.system_info = self._get_system_info()
        self.logger.info(f"OS Agent initialized on {self.system_info['system']} {self.system_info['version']}")
        
        # Store system info as facts
        self.memory.store_system_fact("os_system", self.system_info['system'])
        self.memory.store_system_fact("os_version", self.system_info['version'])
        self.memory.store_system_fact("hostname", self.system_info['hostname'])
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Get comprehensive system information"""
        try:
            return {
                'system': platform.system(),
                'version': platform.version(),
                'release': platform.release(),
                'architecture': platform.architecture()[0],
                'processor': platform.processor(),
                'hostname': platform.node(),
                'username': os.getenv('USERNAME' if self.is_windows else 'USER'),
                'home_dir': str(Path.home()),
                'current_dir': os.getcwd(),
                'python_version': platform.python_version(),
                'cpu_count': psutil.cpu_count(),
                'memory_total': psutil.virtual_memory().total,
                'disk_usage': {
                    'total': psutil.disk_usage('/').total if not self.is_windows else psutil.disk_usage('C:').total,
                    'used': psutil.disk_usage('/').used if not self.is_windows else psutil.disk_usage('C:').used,
                    'free': psutil.disk_usage('/').free if not self.is_windows else psutil.disk_usage('C:').free
                }
            }
        except Exception as e:
            self.logger.error(f"Error getting system info: {e}")
            return {'error': str(e)}
    
    def _execute_command(self, command: str, shell: bool = True, capture_output: bool = True) -> Dict[str, Any]:
        """Execute a system command safely"""
        try:
            self.logger.info(f"Executing command: {command}")
            
            # Security check for dangerous commands
            dangerous_commands = [
                'rm -rf /', 'del /f /s /q C:\\*', 'format', 'fdisk',
                'dd if=/dev/zero', 'shutdown -h now', 'reboot',
                ':(){ :|:& };:', 'chmod -R 777 /'
            ]
            
            if any(dangerous in command.lower() for dangerous in dangerous_commands):
                result = {
                    'success': False,
                    'error': 'Command blocked for security reasons',
                    'output': '',
                    'command': command
                }
                self.memory.store_command_history(command, False, "blocked_security")
                return result
            
            result = subprocess.run(
                command,
                shell=shell,
                capture_output=capture_output,
                text=True,
                timeout=30
            )
            
            exec_result = {
                'success': result.returncode == 0,
                'returncode': result.returncode,
                'output': result.stdout.strip() if result.stdout else '',
                'error': result.stderr.strip() if result.stderr else '',
                'command': command
            }
            
            # Store in memory
            self.memory.store_command_history(command, exec_result['success'])
            
            return exec_result
            
        except subprocess.TimeoutExpired:
            result = {
                'success': False,
                'error': 'Command timed out (30s limit)',
                'output': '',
                'command': command
            }
            self.memory.store_command_history(command, False, "timeout")
            return result
        except Exception as e:
            result = {
                'success': False,
                'error': str(e),
                'output': '',
                'command': command
            }
            self.memory.store_command_history(command, False, f"exception: {str(e)}")
            return result
    
    def _get_context_prompt(self) -> str:
        """Generate context prompt for Gemini based on system info and memory"""
        memory_gb = self.system_info['memory_total'] / (1024**3)
        disk_free_gb = self.system_info['disk_usage']['free'] / (1024**3)
        
        # Get memory context
        memory_context = self.memory.get_memory_context()
        
        return f"""
You are an AI OS agent running on {self.system_info['system']} {self.system_info['release']}.
System Details:
- Architecture: {self.system_info['architecture']}
- CPU Cores: {self.system_info['cpu_count']}
- Memory: {memory_gb:.1f} GB
- Free Disk Space: {disk_free_gb:.1f} GB
- Current Directory: {self.system_info['current_dir']}
- User: {self.system_info['username']}

{memory_context}

You can execute system commands, manage files, monitor processes, and perform OS operations.
Always prioritize safety and never execute destructive commands.
Provide clear explanations of what you're doing and why.
Use your memory context to provide more personalized and contextual responses.
Learn from previous interactions and user patterns.
"""
    
    def process_request(self, user_request: str) -> Dict[str, Any]:
        """Process user request using Gemini and execute appropriate actions"""
        try:
            # Prepare the prompt for Gemini
            system_prompt = self._get_context_prompt()
            
            full_prompt = f"""
{system_prompt}

User Request: {user_request}

Analyze this request and determine what OS operations need to be performed.
Consider the memory context and previous interactions when formulating your response.
If commands need to be executed, provide them in a structured format.
If it's informational, provide the information directly.

Response format should be JSON with the following structure:
{{
    "analysis": "Brief analysis of the request considering memory context",
    "action_type": "command|info|file_operation|process_management|system_query",
    "commands": ["list", "of", "commands", "to", "execute"],
    "explanation": "Detailed explanation of what will be done",
    "safety_notes": "Any safety considerations",
    "learned_info": "Any new information to remember for future interactions"
}}

Remember:
- For Windows, use Windows-specific commands (dir, type, etc.)
- For Linux, use Linux-specific commands (ls, cat, etc.)
- Always prioritize safety
- Provide clear explanations
- Learn from user patterns and preferences
- Use memory context to provide better responses
"""
            
            # Get Gemini's analysis
            response = self.model.generate_content(full_prompt)
            
            try:
                # Try to parse as JSON
                gemini_response = json.loads(response.text.strip().replace('```json', '').replace('```', ''))
            except json.JSONDecodeError:
                # If not JSON, treat as plain text
                gemini_response = {
                    "analysis": "Generated response",
                    "action_type": "info",
                    "commands": [],
                    "explanation": response.text,
                    "safety_notes": "No specific safety concerns",
                    "learned_info": ""
                }
            
            result = {
                'request': user_request,
                'gemini_analysis': gemini_response,
                'timestamp': datetime.now().isoformat(),
                'system': self.system_info['system'],
                'execution_results': []
            }
            
            # Execute commands if any
            if gemini_response.get('commands'):
                for command in gemini_response['commands']:
                    if isinstance(command, str) and command.strip():
                        exec_result = self._execute_command(command)
                        result['execution_results'].append(exec_result)
                        
                        # Add a small delay between commands
                        time.sleep(0.1)
            
            # Store learned information
            if gemini_response.get('learned_info'):
                self.memory.store_system_fact(
                    f"learned_{datetime.now().strftime('%Y%m%d_%H%M%S')}", 
                    gemini_response['learned_info']
                )
            
            # Store conversation in memory
            current_system_state = self.get_system_status()
            self.memory.store_conversation(
                user_request, 
                gemini_response, 
                result['execution_results'], 
                current_system_state
            )
            
            # Save quick memory
            self.memory._save_quick_memory()
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing request: {e}")
            return {
                'error': str(e),
                'request': user_request,
                'timestamp': datetime.now().isoformat()
            }
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/' if not self.is_windows else 'C:')
            
            # Get running processes count
            process_count = len(psutil.pids())
            
            # Get network interfaces
            network_interfaces = []
            for interface, addresses in psutil.net_if_addrs().items():
                for addr in addresses:
                    if addr.family == 2:  # IPv4
                        network_interfaces.append({
                            'interface': interface,
                            'ip': addr.address
                        })
            
            return {
                'timestamp': datetime.now().isoformat(),
                'cpu_usage': cpu_percent,
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'percentage': memory.percent
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percentage': (disk.used / disk.total) * 100
                },
                'processes': process_count,
                'network_interfaces': network_interfaces,
                'uptime': time.time() - psutil.boot_time()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting system status: {e}")
            return {'error': str(e)}
    
    def list_processes(self, filter_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List running processes with optional filtering"""
        try:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    pinfo = proc.info
                    if filter_name is None or filter_name.lower() in pinfo['name'].lower():
                        processes.append(pinfo)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            return sorted(processes, key=lambda x: x['cpu_percent'], reverse=True)[:20]
            
        except Exception as e:
            self.logger.error(f"Error listing processes: {e}")
            return []
    
    def manage_file_operations(self, operation: str, source: str, destination: str = None) -> Dict[str, Any]:
        """Perform file operations safely"""
        try:
            source_path = Path(source)
            
            if operation == 'copy' and destination:
                dest_path = Path(destination)
                shutil.copy2(source_path, dest_path)
                return {'success': True, 'message': f'Copied {source} to {destination}'}
                
            elif operation == 'move' and destination:
                dest_path = Path(destination)
                shutil.move(source_path, dest_path)
                return {'success': True, 'message': f'Moved {source} to {destination}'}
                
            elif operation == 'delete':
                if source_path.is_file():
                    source_path.unlink()
                    return {'success': True, 'message': f'Deleted file {source}'}
                elif source_path.is_dir():
                    shutil.rmtree(source_path)
                    return {'success': True, 'message': f'Deleted directory {source}'}
                    
            elif operation == 'create_dir':
                source_path.mkdir(parents=True, exist_ok=True)
                return {'success': True, 'message': f'Created directory {source}'}
                
            elif operation == 'info':
                if source_path.exists():
                    stat = source_path.stat()
                    return {
                        'success': True,
                        'info': {
                            'path': str(source_path),
                            'size': stat.st_size,
                            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            'is_file': source_path.is_file(),
                            'is_directory': source_path.is_dir()
                        }
                    }
                else:
                    return {'success': False, 'error': 'Path does not exist'}
            
            return {'success': False, 'error': 'Invalid operation'}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory statistics"""
        try:
            conversations = len(self.memory.get_recent_conversations(1000))
            command_patterns = self.memory.get_command_patterns()
            system_facts = len(self.memory.get_system_facts())
            
            return {
                'total_conversations': conversations,
                'total_system_facts': system_facts,
                'top_commands': list(command_patterns.keys())[:5],
                'memory_location': str(self.memory.memory_dir),
                'session_id': self.memory.session_id
            }
        except Exception as e:
            return {'error': str(e)}


def main():
    """Main function to run the OS Agent"""
    # Get API key from environment variable
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("Error: Please set the GEMINI_API_KEY environment variable")
        sys.exit(1)
    
    # Initialize the agent
    agent = OSAgent(api_key)
    
    print("🤖 OS Agent with Gemini 1.5 Flash and Persistent Memory initialized!")
    print(f"Running on: {agent.system_info['system']} {agent.system_info['release']}")
    print(f"🧠 Memory location: {agent.memory.memory_dir}")
    print(f"🆔 Session ID: {agent.memory.session_id}")
    print("Type 'help' for commands, 'quit' to exit\n")
    
    while True:
        try:
            user_input = input("👤 Enter your request: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("Saving memory and exiting... 👋")
                agent.memory._save_quick_memory()
                break
                
            elif user_input.lower() == 'help':
                print("""
Available commands:
- Any natural language OS request (e.g., "list files in current directory")
- 'status' - Get system status
- 'processes' - List running processes
- 'info' - Get system information
- 'memory' - Show memory statistics
- 'cleanup' - Clean up old memory data
- 'help' - Show this help
- 'quit' - Exit the agent

Memory Features:
- Remembers previous conversations and commands
- Learns user patterns and preferences
- Stores system facts and insights
- Provides context-aware responses

Examples:
- "Show me the contents of the current directory"
- "What processes are consuming the most CPU?"
- "Create a new directory called 'test_folder'"
- "Show system resource usage"
- "Find all Python files in the current directory"
- "What did we discuss in our last session?"
                """)
                continue
                
            elif user_input.lower() == 'status':
                status = agent.get_system_status()
                print(f"\n📊 System Status:")
                print(f"CPU Usage: {status.get('cpu_usage', 'N/A'):.1f}%")
                print(f"Memory Usage: {status.get('memory', {}).get('percentage', 'N/A'):.1f}%")
                print(f"Disk Usage: {status.get('disk', {}).get('percentage', 'N/A'):.1f}%")
                print(f"Running Processes: {status.get('processes', 'N/A')}")
                continue
                
            elif user_input.lower() == 'processes':
                processes = agent.list_processes()
                print(f"\n🔄 Top Processes:")
                for proc in processes[:10]:
                    print(f"PID: {proc['pid']:>8} | CPU: {proc['cpu_percent']:>6.1f}% | Memory: {proc['memory_percent']:>6.1f}% | {proc['name']}")
                continue
                
            elif user_input.lower() == 'info':
                info = agent.system_info
                print(f"\n💻 System Information:")
                for key, value in info.items():
                    if key != 'disk_usage':
                        print(f"{key.replace('_', ' ').title()}: {value}")
                continue
                
            elif user_input.lower() == 'memory':
                memory_stats = agent.get_memory_stats()
                print(f"\n🧠 Memory Statistics:")
                for key, value in memory_stats.items():
                    if key != 'error':
                        print(f"{key.replace('_', ' ').title()}: {value}")
                continue
                
            elif user_input.lower() == 'cleanup':
                days = input("Enter days of data to keep (default 30): ").strip()
                try:
                    days = int(days) if days else 30
                    agent.memory.cleanup_old_data(days)
                except ValueError:
                    print("Invalid number, using default 30 days")
                    agent.memory.cleanup_old_data(30)
                continue
            
            # Process the request with Gemini
            print("\n🧠 Processing request with Gemini (using memory context)...")
            result = agent.process_request(user_input)
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
                continue
            
            # Display Gemini's analysis
            analysis = result.get('gemini_analysis', {})
            print(f"\n📝 Analysis: {analysis.get('analysis', 'N/A')}")
            print(f"🎯 Action Type: {analysis.get('action_type', 'N/A')}")
            print(f"💡 Explanation: {analysis.get('explanation', 'N/A')}")
            
            if analysis.get('safety_notes'):
                print(f"⚠️  Safety Notes: {analysis.get('safety_notes')}")
                
            if analysis.get('learned_info'):
                print(f"🧠 Learned: {analysis.get('learned_info')}")
            
            # Display execution results
            if result.get('execution_results'):
                print(f"\n🔧 Execution Results:")
                for i, exec_result in enumerate(result['execution_results'], 1):
                    print(f"\n--- Command {i}: {exec_result['command']} ---")
                    if exec_result['success']:
                        print(f"✅ Success (Return Code: {exec_result['returncode']})")
                        if exec_result['output']:
                            print(f"Output:\n{exec_result['output']}")
                    else:
                        print(f"❌ Failed")
                        if exec_result['error']:
                            print(f"Error: {exec_result['error']}")
            
        except KeyboardInterrupt:
            print("\n\nGoodbye! 👋")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()