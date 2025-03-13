import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

interface MessageInputProps {
  onSendMessage: (content: string, type: 'text' | 'gif') => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message, 'text');
      setMessage('');
    }
  };

  const handleEmojiClick = (emojiObject: any) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={disabled}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button type="submit" disabled={disabled}>
          Send
        </Button>
      </div>
    </form>
  );
} 