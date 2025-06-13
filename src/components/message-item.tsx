// src/components/message-item.tsx
'use client';
import type { FC } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react'; // Use specific icons

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'error'; // Extended roles
  content: string;
  timestamp?: Date; // Optional timestamp
  name?: string; // For 'user' role, could be user's name
}

interface MessageItemProps {
  message: Message;
}

const MessageItem: FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isModel = message.role === 'model';
  const isSystem = message.role === 'system';
  const isError = message.role === 'error';

  if (isSystem) { // System messages might not be displayed or styled differently
    return (
      <div className="my-2 text-center text-xs text-muted-foreground italic">
        {message.content}
      </div>
    );
  }

  return (
    <div className={cn('flex items-start gap-3 my-3 w-full', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/30 shrink-0 shadow-md">
          <AvatarImage src="https://placehold.co/40x40/7F00FF/FFFFFF.png?text=AI" alt="AI Avatar" data-ai-hint="bot abstract" />
          <AvatarFallback><Bot size={18} /></AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'max-w-[80%] p-3 rounded-xl shadow-md text-sm break-words leading-relaxed',
          isUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground rounded-bl-none',
          isError && 'bg-destructive/80 text-destructive-foreground border border-destructive',
        )}
      >
        {/* Basic rendering of content. For Markdown, a library would be needed. */}
        {message.content.split('\n').map((line, index) => (
          <span key={index}>
            {line}
            {index < message.content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 border border-border shrink-0 shadow-md">
           <AvatarImage src="https://placehold.co/40x40/FFFFFF/000000.png?text=U" alt="User Avatar" data-ai-hint="person silhouette" />
          <AvatarFallback>{message.name ? message.name.charAt(0).toUpperCase() : <User size={18}/>}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default MessageItem;
