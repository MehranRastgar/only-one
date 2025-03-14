'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserList } from '@/components/user-list';
import { Loader2 } from 'lucide-react';
import type { Message, ChatRoom, User } from '@/types/socket';
import { MessageInput } from '@/components/message-input';

interface OptimisticMessage extends Message {
  pending?: boolean;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add session logging
  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
  }, [status, session]);

  const fetchMessages = async (roomId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/${roomId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Socket connection effect
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.token) {
      console.log('Connecting to chat server...');
      
      const newSocket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: {
          token: session.user.token,
        },
      });

      newSocket.on('connect', () => {
        console.log('Connected to chat server');
        setIsLoading(false);
        fetchPartnerAndRoom();
      });

      newSocket.on('connect_error', (error: Error) => {
        console.error('Connection error:', error);
        setIsLoading(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [status, session]);

  // Room joining effect
  useEffect(() => {
    if (socket && activeRoom) {
      // Join the room
      socket.emit('join_room', activeRoom.id);
      
      // Set up message handlers
      const handleReceiveMessage = (message: Message) => {
        console.log('Received message:', message);
        setMessages((prevMessages) => {
          // Don't add messages from the current user (handled by optimistic updates)
          if (message.sender._id === session?.user?.id) {
            return prevMessages;
          }
          
          // Don't add duplicate messages
          if (prevMessages.some(m => m.id === message.id)) {
            return prevMessages;
          }
          
          // Add new message and sort by timestamp
          return [...prevMessages, message].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
      };

      socket.on('receive_message', handleReceiveMessage);

      // Fetch existing messages
      fetchMessages(activeRoom.id);

      return () => {
        socket.off('receive_message', handleReceiveMessage);
        socket.emit('leave_room', activeRoom.id);
      };
    }
  }, [socket, activeRoom, session?.user?.id]);

  const fetchPartnerAndRoom = async () => {
    try {
      // Fetch user's partner information
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/partner`, {
        headers: {
          Authorization: `Bearer ${session?.user?.token}`
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No partner found, redirect to partner code entry page
          router.push('/partner-code');
          return;
        }
        if (response.status === 400) {
          const data = await response.json();
          console.error('Partner error:', data.message);
          // Handle "already has partner" case
          if (data.message.includes('already have a partner')) {
            router.push('/partner-code');
            return;
          }
        }
        throw new Error('Failed to fetch partner information');
      }

      const partnerData = await response.json();
      console.log('Partner data:', partnerData);
      setPartner(partnerData);

      // Fetch or create chat room with partner
      const roomResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/direct/${partnerData._id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.user?.token}`
          },
        }
      );

      if (!roomResponse.ok) {
        throw new Error('Failed to fetch chat room');
      }

      const room = await roomResponse.json();
      console.log('Chat room data:', room);

      // Ensure room has participants
      if (!room.participants || room.participants.length < 2) {
        console.error('Chat room missing participants');
        throw new Error('Invalid chat room configuration');
      }

      // Set active room with participants
      setActiveRoom(room);

      // Fetch messages for the room
      fetchMessages(room.id);
    } catch (error) {
      console.error('Error fetching partner and room:', error);
      // If there's an error, redirect to partner code page
      router.push('/partner-code');
    }
  };

  // Add scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content: string, type: 'text' | 'gif' | 'image', imageUrl?: string) => {
    if (!socket || !activeRoom || !session?.user?.id) {
      console.log('Cannot send message: Missing required data');
      return;
    }

    const messageData = {
      content,
      type,
      imageUrl,
      chatRoomId: activeRoom.id,
      timestamp: new Date().toISOString(),
      sender: {
        _id: session.user.id,
        username: session.user.name || 'Unknown',
        avatar: session.user.image || undefined,
      }
    };

    try {
      // Create optimistic message with temporary ID
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        ...messageData,
        pending: true
      };
      
      // Add optimistic message to UI
      setMessages(prev => [...prev, optimisticMessage]);

      // Emit the message through socket with callback
      socket.emit('send_message', messageData, (error: any, confirmedMessage: Message) => {
        if (error) {
          console.error('Error sending message:', error);
          // Remove the optimistic message if there's an error
          setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
          return;
        }

        // Replace optimistic message with confirmed message
        setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id ? { ...confirmedMessage, pending: false } : msg
        ));
      });
    } catch (error) {
      console.error('Error in message handling:', error);
      // Remove optimistic message if there's an error
      setMessages(prev => prev.filter(msg => msg.id !== `temp-${Date.now()}`));
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-[100vh] w-full sm:h-[600px] sm:w-[400px] bg-background flex items-center justify-center rounded-lg shadow-xl">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="h-[100vh] w-full sm:h-[600px] sm:w-[400px] bg-background flex flex-col overflow-hidden rounded-lg shadow-xl">
        {activeRoom && partner ? (
          <>
            {/* Chat header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                  <AvatarImage src={`${process.env.NEXT_PUBLIC_API_URL}/api/images/${partner.avatar}`} />
                    <AvatarFallback>
                      {partner.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold">{partner.username}</h2>
                    <p className="text-sm text-muted-foreground">
                      {partner.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push('/settings')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="sr-only">Settings</span>
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender._id === session?.user?.id
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.sender._id === session?.user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.type === 'gif' ? (
                        <img
                          src={message.content}
                          alt="GIF"
                          className="mt-1 max-w-full rounded"
                        />
                      ) : message.type === 'image' ? (
                        <div className="mt-1">
                          <div className="relative">
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/api/images/${message.imageUrl?.split('/').pop()}`}
                              alt="Image message"
                              className="mt-1 max-w-full rounded-lg object-contain"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                console.error('Error loading image:', e);
                                img.style.display = 'none';
                                if (img.parentElement) {
                                  const fallback = document.createElement('p');
                                  fallback.textContent = 'Image failed to load';
                                  fallback.className = 'text-sm text-red-500';
                                  img.parentElement.appendChild(fallback);
                                }
                              }}
                            />
                            {/* Optional caption */}
                            {message.content && !message.content.startsWith('[Image:') && (
                              <p className="mt-2 text-sm text-foreground/80">{message.content}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1">{message.content}</p>
                      )}
                      <span className="mt-1 block text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={!socket || !activeRoom}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <p className="text-lg font-semibold text-muted-foreground mb-4">
              No Partner Connected
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              To start messaging, you need to connect with your partner using their unique code.
            </p>
            <Button onClick={() => router.push('/partner-code')}>
              Enter Partner Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}