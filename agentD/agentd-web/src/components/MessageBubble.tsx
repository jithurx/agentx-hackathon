import React, { useState, useEffect } from 'react';
import { Message } from '../types/chat';
import { Bot, User, Loader2, Sparkles, Terminal } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

interface CommandEvent {
  type: 'start' | 'info' | 'command' | 'output' | 'error';
  content: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [displayedContent, setDisplayedContent] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [events, setEvents] = useState<CommandEvent[]>([]);
  
  // Function to clean up system information display and format content
  const cleanContent = (content: string) => {
    // Remove backticks and "Here is the system information:" prefix
    let cleaned = content
      .replace(/```\n?/g, '')
      .replace(/Here is the system information:\n?/g, '')
      .trim();
    
    // Convert \n to actual line breaks for proper display
    cleaned = cleaned.replace(/\\n/g, '\n');
    
    // Format email-like content for better readability
    if (cleaned.includes('subject') && cleaned.includes('body') && cleaned.includes('@')) {
      // Extract and format email information
      const subjectMatch = cleaned.match(/subject[:\s]*["']([^"']+)["']/i);
      const bodyMatch = cleaned.match(/body[:\s]*["']([^"']+)["']/i);
      const emailMatch = cleaned.match(/to[:\s]*([^\s]+@[^\s]+)/i);
      
      if (subjectMatch && bodyMatch && emailMatch) {
        const subject = subjectMatch[1];
        const body = bodyMatch[1].replace(/\\n/g, '\n');
        const email = emailMatch[1];
        
        cleaned = `📧 Email Sent Successfully!

📬 To: ${email}
📋 Subject: ${subject}

📝 Body:
${body}

✅ The email has been sent successfully.`;
      }
    }
    
    return cleaned;
  };

  useEffect(() => {
    try {
      const content = message.content;
      if (content.includes('events')) {
        const parsed = JSON.parse(content);
        if (parsed.events) {
          setIsExecuting(true);
          setEvents(parsed.events);
          let currentContent = '';
          let currentIndex = 0;

          const typeNextEvent = () => {
            if (currentIndex < parsed.events.length) {
              const event = parsed.events[currentIndex];
              currentContent += `\n${event.content}`;
              setDisplayedContent(currentContent);
              currentIndex++;
              setTimeout(typeNextEvent, 100); // Adjust speed here
            } else {
              setIsExecuting(false);
            }
          };

          typeNextEvent();
        } else {
          setDisplayedContent(cleanContent(content));
        }
      } else {
        setDisplayedContent(cleanContent(content));
      }
    } catch (e) {
      setDisplayedContent(cleanContent(message.content));
    }
  }, [message.content]);

  return (
    <div className={`flex items-start gap-4 mb-8 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg
        ${isUser 
          ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500' 
          : 'bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600'
        }
      `}>
        {isUser ? <User size={18} className="text-white" /> : <Sparkles size={18} className="text-white" />}
      </div>
      
      <div className={`
        max-w-[75%] rounded-2xl px-6 py-4 shadow-xl backdrop-blur-md transition-all duration-300 hover:shadow-2xl
        ${isUser 
          ? 'bg-gradient-to-br from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white rounded-br-md border border-white/20' 
          : 'bg-gradient-to-br from-white/10 to-white/5 text-white rounded-bl-md border border-white/20'
        }
      `}>
        {message.isTyping ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {isExecuting && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Terminal className="w-4 h-4" />
                <span>Executing command...</span>
              </div>
            )}
            <div className="whitespace-pre-wrap break-words overflow-hidden font-mono text-sm leading-relaxed" style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'break-word',
              maxWidth: '100%'
            }}>
              {displayedContent.split('\n').map((line, index) => (
                <div key={index} className={line.trim() === '' ? 'h-2' : ''}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};