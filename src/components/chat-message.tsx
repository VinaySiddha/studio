
'use client';
import type { FC } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare, User as UserIcon, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface Reference {
  source: string;
  content_preview?: string;
  number?: number | string;
  chunk_index?: number | string; 
}

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system' | 'error'; // Extended sender types
  text: string;
  timestamp: Date;
  isError?: boolean;
  isLoading?: boolean;
  references?: Reference[];
  thinking?: string | null;
}

interface ChatMessageProps {
  message: Message;
  onCopy: (text: string) => void;
}

const ChatMessage: FC<ChatMessageProps> = ({ message, onCopy }) => {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'ai' || message.sender === 'system' || message.sender === 'error';
  
  // Sanitize HTML-like characters for direct display, allow markdown for AI.
  const displayText = (text: string) => {
    if (isBot && !message.isError) { // Allow richer rendering for AI if not an error
        // Basic attempt to make URLs clickable, very simple.
        // A proper markdown parser would be better for complex content.
        const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        const linkifiedText = text.replace(urlPattern, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${url}</a>`);
        return { __html: linkifiedText.replace(/\n/g, '<br />') }; // Preserve newlines
    }
    // For user messages or errors, escape more strictly.
    const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    return { __html: escapedText.replace(/\n/g, '<br />') }; // Preserve newlines
  };


  return (
    <div className={cn('flex items-start gap-3 my-4 w-full', isUser ? 'justify-end' : 'justify-start')}>
      {isBot && (
        <Avatar className="h-8 w-8 border border-border shrink-0 shadow-sm">
          {message.isError ? (
            <AvatarFallback className="bg-destructive/20 text-destructive">
              <AlertTriangle size={18} />
            </AvatarFallback>
          ) : (
            <>
              <AvatarImage 
                src="/placeholder-ai-avatar.png" 
                alt="AI Avatar" 
                data-ai-hint="robot abstract"
              />
              <AvatarFallback><MessageSquare size={18} /></AvatarFallback>
            </>
          )}
        </Avatar>
      )}

      <div
        className={cn(
          'max-w-[85%] p-3 rounded-lg shadow-md relative group flex flex-col text-sm leading-relaxed',
          isUser ? 'bg-secondary text-secondary-foreground rounded-br-none' 
                 : (message.isError ? 'bg-destructive/80 border border-destructive text-destructive-foreground rounded-bl-none' 
                                    : 'bg-card border border-border rounded-bl-none'),
          message.isLoading && 'opacity-80 animate-pulse'
        )}
      >
        <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={displayText(message.text)} />

        {message.isLoading && isBot && !message.text && (
            <div className="flex items-center mt-1 text-xs text-muted-foreground">
              <span>Thinking...</span>
            </div>
        )}

        {!message.isLoading && (
            <div className="absolute -bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                            p-0.5 bg-card border border-border rounded-full shadow-lg
                            flex items-center space-x-0.5
                            backdrop-blur-sm bg-opacity-70 z-10"
                 style={isUser ? { right: '0.5rem' } : { left: '0.5rem' }}>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(message.text)} title="Copy">
                <Copy size={13} className="text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
        )}
        
        {isBot && !message.isLoading && (message.thinking || (message.references && message.references.length > 0)) && (
            <Accordion type="single" collapsible className="w-full mt-2 border-t border-border/30 pt-2">
              {message.thinking && (
                <AccordionItem value="thinking" className="border-b-0">
                  <AccordionTrigger className="text-xs py-1 hover:no-underline text-muted-foreground hover:text-foreground">
                    Show Reasoning
                  </AccordionTrigger>
                  <AccordionContent className="text-xs whitespace-pre-wrap p-2 bg-background/50 rounded max-h-32 overflow-y-auto border border-border/30">
                    {message.thinking}
                  </AccordionContent>
                </AccordionItem>
              )}
              {message.references && message.references.length > 0 && (
                <AccordionItem value="references" className="border-b-0">
                  <AccordionTrigger className="text-xs py-1 hover:no-underline text-muted-foreground hover:text-foreground">
                    References ({message.references.length})
                  </AccordionTrigger>
                  <AccordionContent className="text-xs p-2 bg-background/50 rounded max-h-32 overflow-y-auto border border-border/30">
                    <ul className="list-none space-y-1">
                      {message.references.map((ref, index) => (
                        <li key={index} title={ref.content_preview || 'No preview available'} className="truncate">
                          <span className="font-semibold text-accent-foreground">[{ref.number || index + 1}] {ref.source}</span>
                          {ref.chunk_index && <span className="text-muted-foreground text-xs"> (Chunk: {ref.chunk_index})</span>}
                          {ref.content_preview && <span className="italic ml-1 text-muted-foreground block text-xs truncate">{`"${ref.content_preview.substring(0,70)}..."`}</span>}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 border border-border shrink-0 shadow-sm">
          <AvatarImage 
            src="/placeholder-user-avatar.png" 
            alt="User Avatar"
            data-ai-hint="person outline"
          />
          <AvatarFallback><UserIcon size={18} /></AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
