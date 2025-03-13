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

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add session logging
  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
  }, [status, session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.token) {
      console.log('Connecting to chat server...');
      console.log('User token:', session.user.token);
      console.log('User ID:', session.user.id);
      
      const newSocket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: {
          token: session.user.token,
        },
      });

      newSocket.on('connect', () => {
        console.log('Connected to chat server');
        setIsLoading(false);
        // Fetch users when connected
        console.log('Fetching users after socket connection...');
        fetchUsers();
      });

      newSocket.on('connect_error', (error: Error) => {
        console.error('Connection error:', error);
        setIsLoading(false);
      });

      newSocket.on('receive_message', (message: Message) => {
        console.log('Received message:', message);
        setMessages((prev) => {
          // Check if message already exists
          const messageExists = prev.some(m => m.id === message.id);
          if (messageExists) {
            console.log('Message already exists, skipping:', message.id);
            return prev;
          }
          return [...prev, message];
        });
      });

      newSocket.on('message_error', (error: { message: string }) => {
        console.error('Error sending message:', error);
      });

      newSocket.on('chat_rooms', (rooms: ChatRoom[]) => {
        console.log('Received chat rooms:', rooms);
        setRooms(rooms);
      });

      newSocket.on('users', (users: User[]) => {
        console.log('Received users:', users);
        setUsers(users);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [status, session, router]);

  useEffect(() => {
    if (socket && activeRoom) {
      console.log('Joining room:', activeRoom.id);
      socket.emit('join_room', activeRoom.id);
      // Fetch messages for the active room
      fetchMessages(activeRoom.id);

      return () => {
        console.log('Leaving room:', activeRoom.id);
        socket.emit('leave_room', activeRoom.id);
      };
    }
  }, [socket, activeRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const fetchUsers = async () => {
    try {
      console.log('Fetching users from API...');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
        },
      });

      console.log('Users API Response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      console.log('Received users data:', data);
      
      // Filter out the current user
      const otherUsers = data.filter((user: User) => user._id !== session?.user?.id);
      console.log('Filtered users:', otherUsers);
      
      setUsers(otherUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSendMessage = (content: string, type: 'text' | 'gif') => {
    if (!socket || !activeRoom) {
      console.log('Cannot send message:', {
        socketExists: !!socket,
        activeRoomExists: !!activeRoom,
        activeRoomId: activeRoom?.id
      });
      return;
    }

    console.log('Sending message:', {
      content,
      type,
      chatRoomId: activeRoom.id
    });

    try {
      socket.emit('send_message', {
        content,
        type,
        chatRoomId: activeRoom.id,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSelectUser = async (userId: string) => {
    if (status !== 'authenticated' || !session?.user?.token) {
      console.error('Not authenticated or missing session token');
      router.push('/auth/login');
      return;
    }

    console.log('handleSelectUser called with userId:', userId);
    console.log('Current session:', session);
    console.log('User token:', session.user.token);
    console.log('User ID:', session.user.id);

    try {
      // Ensure userId is a valid MongoDB ObjectId
      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.error('Invalid user ID format');
        return;
      }

      setSelectedUserId(userId);
      console.log('Making API request to create/get direct message room...');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/direct/${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.user.token}`,
          },
        }
      );

      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        throw new Error(error.message || 'Failed to create direct message room');
      }

      const room = await response.json();
      console.log('Received room:', room);
      
      // Check if room already exists in rooms array
      const existingRoom = rooms.find(r => r.id === room.id);
      if (!existingRoom) {
        setRooms(prev => [...prev, room]);
      }

      // Set active room and ensure it has an ID
      if (room.id) {
        console.log('Setting active room:', room);
        setActiveRoom(room);
      } else {
        console.error('Received room without ID:', room);
        throw new Error('Invalid room data received');
      }
    } catch (error) {
      console.error('Error creating direct message room:', error);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar with user list */}
      <div className="w-80 border-r p-4">
        <UserList 
          users={users}
          currentUserId={session?.user?.id || ''}
          onSelectUser={handleSelectUser}
          selectedUserId={selectedUserId || undefined}
        />
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {activeRoom ? (
          <>
            {/* Chat header */}
            <div className="border-b p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={activeRoom.participants[0]?.avatar} />
                  <AvatarFallback>
                    {activeRoom.participants[0]?.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold">{activeRoom.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {activeRoom.participants.length} participants
                  </p>
                </div>
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
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={message.sender.avatar} />
                          <AvatarFallback>
                            {message.sender.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {message.sender.username}
                        </span>
                      </div>
                      {message.type === 'gif' ? (
                        <img
                          src={message.content}
                          alt="GIF"
                          className="mt-1 max-w-full rounded"
                        />
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
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">
              Select a user to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 