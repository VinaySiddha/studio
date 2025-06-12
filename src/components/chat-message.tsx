
import type { FC, useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // For editing
import { Loader2, Edit2, Copy, ThumbsUp, ThumbsDown, Check, X } from 'lucide-react'; // Added Check, X for edit confirm/cancel
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


export interface Reference {
  source: string;
  content_preview?: string;
  number?: number | string; // Allow string for flexibility like "[1a]"
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  references?: Reference[];
  thinking?: string;
  isError?: boolean;
  isLoading?: boolean; // For AI messages that are streaming
  isEdited?: boolean; // For user messages
  feedback?: 'like' | 'dislike'; // For AI messages
}

interface ChatMessageProps {
  message: Message;
  onEdit: (messageId: string, newText: string) => void; // For user messages
  onCopy: (text: string) => void;
  onFeedback: (messageId: string, feedbackType: 'like' | 'dislike') => void; // For AI messages
}

const ChatMessage: FC<ChatMessageProps> = ({ message, onEdit, onCopy, onFeedback }) => {
  const isUser = message.sender === 'user';
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


  return (
    <div className={cn('flex items-start gap-3 my-4 w-full', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/50 shrink-0">
          <AvatarImage src="https://placehold.co/40x40.png" alt="AI Avatar" data-ai-hint="robot abstract" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'max-w-[85%] p-3 rounded-lg shadow-md relative group flex flex-col text-sm',
          isUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted/70 text-foreground rounded-bl-none glass-panel !bg-card/50',
          message.isError && !isUser && '!bg-destructive/30 border-destructive',
          message.isLoading && 'opacity-80'
        )}
      >
        {isEditing && isUser ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={Math.max(3, editText.split('\n').length)}
              className="bg-background/80 text-foreground focus:ring-primary"
            />
            <div className="flex justify-end space-x-2">
              <Button size="icon" variant="ghost" onClick={handleEditCancel} title="Cancel Edit">
                <X className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={handleEditSubmit} title="Confirm Edit" className="text-green-500 hover:text-green-400">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: message.text.replace(/</g, "&lt;").replace(/>/g, "&gt;") }}>
            {/* Content is set via dangerouslySetInnerHTML to allow basic HTML like line breaks from markdown. Be cautious if source can be arbitrary HTML. */}
          </div>
        )}

        {message.isLoading && !isUser && (
          <div className="flex items-center mt-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
            <span>Generating...</span>
          </div>
        )}
        {message.isEdited && isUser && (
            <span className="text-xs text-primary-foreground/70 mt-1">(edited)</span>
        )}


        {/* Action buttons */}
        <div className="absolute -bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        p-0.5 bg-card border border-border rounded-full shadow-lg
                        flex items-center space-x-0.5
                        backdrop-blur-sm bg-opacity-70 z-10"
             style={isUser ? { right: '0.5rem' } : { left: '0.5rem' }}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(message.text)} title="Copy">
            <Copy size={14} className="text-muted-foreground hover:text-primary" />
          </Button>
          {isUser && !isEditing && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)} title="Edit">
              <Edit2 size={14} className="text-muted-foreground hover:text-primary" />
            </Button>
          )}
          {!isUser && !message.isLoading && !message.isError && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback(message.id, 'like')} title="Like">
                <ThumbsUp size={14} className={cn("text-muted-foreground hover:text-green-500", message.feedback === 'like' && "text-green-500")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback(message.id, 'dislike')} title="Dislike">
                <ThumbsDown size={14} className={cn("text-muted-foreground hover:text-red-500", message.feedback === 'dislike' && "text-red-500")} />
              </Button>
            </>
          )}
        </div>

        {/* Thinking and References for AI messages */}
        {(!isUser && (message.thinking || (message.references && message.references.length > 0))) && (
            <Accordion type="single" collapsible className="w-full mt-2 border-t border-foreground/10 pt-2">
              {message.thinking && (
                <AccordionItem value="thinking" className="border-b-0">
                  <AccordionTrigger className="text-xs py-1 hover:no-underline text-foreground/70 hover:text-primary">Show Reasoning</AccordionTrigger>
                  <AccordionContent className="text-xs whitespace-pre-wrap p-2 bg-background/30 rounded max-h-40 overflow-y-auto">
                    {message.thinking}
                  </AccordionContent>
                </AccordionItem>
              )}
              {message.references && message.references.length > 0 && (
                <AccordionItem value="references" className="border-b-0">
                  <AccordionTrigger className="text-xs py-1 hover:no-underline text-foreground/70 hover:text-primary">Show References ({message.references.length})</AccordionTrigger>
                  <AccordionContent className="text-xs p-2 bg-background/30 rounded max-h-40 overflow-y-auto">
                    <ul className="list-none space-y-1">
                      {message.references.map((ref, index) => (
                        <li key={index} title={ref.content_preview || 'No preview available'}>
                          <span className="font-semibold">[{ref.number || index + 1}] {ref.source}:</span>
                          <span className="italic ml-1">{ref.content_preview ? ` "${ref.content_preview.substring(0,50)}..."` : ""}</span>
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
        <Avatar className="h-8 w-8 border border-border shrink-0">
          {/* TODO: Use actual user avatar if available */}
          <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="person silhouette" />
          <AvatarFallback>{message.sender.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
