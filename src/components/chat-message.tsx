
'use client';
import type { FC } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Edit2, Copy, ThumbsUp, ThumbsDown, Check, X, MessageSquare, User as UserIcon } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export interface Reference {
  source: string;
  content_preview?: string;
  number?: number | string;
  chunk_index?: number | string; 
}

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'bot' | 'system' | 'error'; 
  text: string;
  timestamp: Date;
  references?: Reference[];
  thinking?: string | null; 
  isError?: boolean;
  isLoading?: boolean;
  isEdited?: boolean;
  feedback?: 'like' | 'dislike';
}

interface ChatMessageProps {
  message: Message;
  onEdit: (messageId: string, newText: string) => void;
  onCopy: (text: string) => void;
  onFeedback: (messageId: string, feedbackType: 'like' | 'dislike') => void;
}

const ChatMessage: FC<ChatMessageProps> = ({ message, onEdit, onCopy, onFeedback }) => {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'ai' || message.sender === 'bot';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const handleEditSubmit = () => {
    if (editText.trim() !== message.text.trim()) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditText(message.text);
    setIsEditing(false);
  };

  const formattedText = message.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");


  return (
    <>
      <div className={cn('flex items-start gap-3 my-4 w-full', isUser ? 'justify-end' : 'justify-start')}>
        {isBot && (
          <Avatar className="h-8 w-8 border border-ai-engineer-border shrink-0 shadow-sm">
            <AvatarImage src="https://placehold.co/40x40/7777ff/ffffff.png?text=AI" alt="AI Avatar" data-ai-hint="robot abstract" />
            <AvatarFallback><MessageSquare size={18} /></AvatarFallback>
          </Avatar>
        )}

        <div
          className={cn(
            'max-w-[85%] p-3 rounded-lg shadow-md relative group flex flex-col text-sm leading-relaxed',
            isUser ? 'bg-ai-engineer-message-user text-white rounded-br-none' : 'bg-ai-engineer-message-bot text-ai-engineer-text-primary rounded-bl-none',
            message.isError && isBot && '!bg-destructive/70 border border-destructive text-destructive-foreground',
            message.isLoading && 'opacity-80'
          )}
        >
          {isEditing && isUser ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={Math.max(2, editText.split('\n').length)}
                className="bg-ai-engineer-input-bg text-ai-engineer-text-primary focus:ring-ai-engineer-accent-blue text-sm"
                autoFocus
              />
              <div className="flex justify-end space-x-1">
                <Button size="icon" variant="ghost" onClick={handleEditCancel} title="Cancel Edit" className="h-7 w-7">
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleEditSubmit} title="Confirm Edit" className="h-7 w-7">
                  <Check className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formattedText.replace(/\n/g, '<br />') }} />
          )}

          {message.isLoading && isBot && (
            <div className="flex items-center mt-2 text-xs text-ai-engineer-text-muted">
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              <span>Thinking...</span>
            </div>
          )}
          {message.isEdited && isUser && (
              <span className="text-xs text-white/70 mt-1">(edited)</span>
          )}

          <div className="absolute -bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                          p-0.5 bg-ai-engineer-card-bg border border-ai-engineer-border rounded-full shadow-lg
                          flex items-center space-x-0.5
                          backdrop-blur-sm bg-opacity-70 z-10"
               style={isUser ? { right: '0.5rem' } : { left: '0.5rem' }}>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(message.text)} title="Copy">
              <Copy size={13} className="text-ai-engineer-text-secondary hover:text-ai-engineer-text-primary" />
            </Button>
            {isUser && !isEditing && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)} title="Edit">
                <Edit2 size={13} className="text-ai-engineer-text-secondary hover:text-ai-engineer-text-primary" />
              </Button>
            )}
            {isBot && !message.isLoading && !message.isError && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback(message.id, 'like')} title="Like">
                  <ThumbsUp size={13} className={cn("text-ai-engineer-text-secondary hover:text-green-500", message.feedback === 'like' && "text-green-500 fill-green-500/30")} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback(message.id, 'dislike')} title="Dislike">
                  <ThumbsDown size={13} className={cn("text-ai-engineer-text-secondary hover:text-red-500", message.feedback === 'dislike' && "text-red-500 fill-red-500/30")} />
                </Button>
              </>
            )}
          </div>

          {isBot && (message.thinking || (message.references && message.references.length > 0)) && (
              <Accordion type="single" collapsible className="w-full mt-2 border-t border-ai-engineer-border/30 pt-2">
                {message.thinking && (
                  <AccordionItem value="thinking" className="border-b-0">
                    <AccordionTrigger className="text-xs py-1 hover:no-underline text-ai-engineer-text-secondary hover:text-ai-engineer-text-primary">
                      Show Reasoning
                    </AccordionTrigger>
                    <AccordionContent className="text-xs whitespace-pre-wrap p-2 bg-ai-engineer-dark-bg/50 rounded max-h-32 overflow-y-auto border border-ai-engineer-border/30">
                      {message.thinking}
                    </AccordionContent>
                  </AccordionItem>
                )}
                {message.references && message.references.length > 0 && (
                  <AccordionItem value="references" className="border-b-0">
                    <AccordionTrigger className="text-xs py-1 hover:no-underline text-ai-engineer-text-secondary hover:text-ai-engineer-text-primary">
                      References ({message.references.length})
                    </AccordionTrigger>
                    <AccordionContent className="text-xs p-2 bg-ai-engineer-dark-bg/50 rounded max-h-32 overflow-y-auto border border-ai-engineer-border/30">
                      <ul className="list-none space-y-1">
                        {message.references.map((ref, index) => (
                          <li key={index} title={ref.content_preview || 'No preview available'} className="truncate">
                            <span className="font-semibold text-ai-engineer-accent-teal">[{ref.number || index + 1}] {ref.source}</span>
                            {ref.chunk_index && <span className="text-ai-engineer-text-muted text-xs"> (Chunk: {ref.chunk_index})</span>}
                            {ref.content_preview && <span className="italic ml-1 text-ai-engineer-text-secondary block text-xs truncate">{`"${ref.content_preview.substring(0,70)}..."`}</span>}
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
          <Avatar className="h-8 w-8 border border-ai-engineer-border shrink-0 shadow-sm">
            <AvatarImage src="https://placehold.co/40x40/cccccc/111111.png?text=U" alt="User Avatar" data-ai-hint="person outline" />
            <AvatarFallback><UserIcon size={18} /></AvatarFallback>
          </Avatar>
        )}
      </div>
    </>
  );
};

export default ChatMessage;
