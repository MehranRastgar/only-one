import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Image } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

interface MessageInputProps {
  onSendMessage: (content: string, type: 'text' | 'gif' | 'image', imageUrl?: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const { data: session } = useSession();
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() || selectedImage) {
      if (selectedImage) {
        try {
          // Create a FormData object to send the image
          const formData = new FormData();
          formData.append('image', selectedImage);

          console.log('Uploading image:', selectedImage.name);
          console.log('Image type:', selectedImage.type);
          console.log('Image size:', selectedImage.size);
          console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${session?.user?.token}`,
            },
          });

          const data = await response.json();
          console.log('Upload response:', data);

          if (!response.ok) {
            throw new Error(data.message || 'Failed to upload image');
          }

          if (!data.imageUrl) {
            throw new Error('No image URL in response');
          }

          // Ensure the imageUrl is a complete URL
          const imageUrl = data.imageUrl.startsWith('http') 
            ? data.imageUrl 
            : `${process.env.NEXT_PUBLIC_API_URL}${data.imageUrl}`;

          console.log('Final image URL:', imageUrl);
          // Extract filename from URL and use it as content
          const filename = imageUrl.split('/').pop() || 'image';
          onSendMessage(`[Image: ${filename}]`, 'image', imageUrl);
          setMessage('');
          setSelectedImage(null);
          setImagePreview(null);
        } catch (error) {
          console.error('Error uploading image:', error);
          // You might want to show an error message to the user here
        }
      } else {
        onSendMessage(message, 'text');
        setMessage('');
      }
    }
  };

  const handleEmojiClick = (emojiObject: any) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('Uploading image to:', `${process.env.NEXT_PUBLIC_API_URL}/api/upload`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      console.log('Upload response:', data);

      if (!data.imageUrl) {
        throw new Error('No image URL in response');
      }

      // Ensure the imageUrl is a complete URL
      const imageUrl = data.imageUrl.startsWith('http') 
        ? data.imageUrl 
        : `${process.env.NEXT_PUBLIC_API_URL}${data.imageUrl}`;

      console.log('Final image URL:', imageUrl);
      // Extract filename from URL and use it as content
      const filename = imageUrl.split('/').pop() || 'image';
      onSendMessage(`[Image: ${filename}]`, 'image', imageUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <div className="flex flex-col gap-2">
        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-48 rounded-lg object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6"
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
            >
              ×
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={disabled}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
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

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={disabled}>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
} 