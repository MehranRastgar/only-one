import { Socket } from 'socket.io-client';

export interface User {
    _id: string;
    username: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: string;
}

declare module 'socket.io-client' {
    interface Socket {
        data: {
            user: User;
        };
    }
}

export interface Message {
    id: string;
    content: string;
    type: 'text' | 'gif' | 'image';
    imageUrl?: string;
    sender: User;
    timestamp: string;
}

export interface ChatRoom {
    id: string;
    name: string;
    participants: User[];
    isGroup: boolean;
    lastMessage?: Message;
} 