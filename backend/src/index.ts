import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import imageRoutes from './routes/image.routes';
import jwt from 'jsonwebtoken';
import { User, ChatRoom, Message } from './models';
import { z } from 'zod';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? 'https://your-production-domain.com'
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Message validation schema
const messageSchema = z.object({
    content: z.string().min(1),
    type: z.enum(['text', 'gif', 'image']).default('text'),
    imageUrl: z.string().optional(),
    chatRoomId: z.string(),
}).refine((data) => {
    if (data.type === 'image') {
        return !!data.imageUrl;
    }
    return true;
}, {
    message: "imageUrl is required when type is 'image'",
    path: ["imageUrl"],
});

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? 'https://your-production-domain.com'
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Database connection
mongoose.connect(process.env.MONGODB_URI!)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/images', imageRoutes);

// Basic route
app.get('/', (_req, res) => {
    res.json({ message: 'Welcome to Chat App API' });
});

// Socket.io middleware for authentication
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return next(new Error('User not found'));
        }

        socket.data.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.data.user.username);

    // Join user's chat rooms
    socket.data.user.chatRooms.forEach((roomId: string) => {
        socket.join(roomId);
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
        try {
            // Validate message data
            const validatedData = messageSchema.parse(data);
            const { content, type, chatRoomId, imageUrl } = validatedData;

            console.log('Received message data:', validatedData);

            // Save message to database
            const message = await Message.create({
                content,
                type,
                imageUrl: type === 'image' ? imageUrl : undefined,
                sender: socket.data.user._id,
                chatRoom: chatRoomId,
                readBy: [socket.data.user._id],
            }) as any;

            console.log('Created message:', message);

            // Update last message in chat room
            await ChatRoom.findByIdAndUpdate(chatRoomId, {
                lastMessage: message._id,
            });

            // Emit message to room
            const messageToEmit = {
                id: message._id,
                content: message.content,
                type: message.type,
                imageUrl: message.imageUrl,
                sender: {
                    _id: socket.data.user._id,
                    username: socket.data.user.username,
                    avatar: socket.data.user.avatar,
                },
                timestamp: message.createdAt.toISOString(),
            };

            console.log('Emitting message:', messageToEmit);
            io.to(chatRoomId).emit('receive_message', messageToEmit);

            // Also emit to sender for confirmation
            socket.emit('message_sent', messageToEmit);
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message_error', { message: 'Error sending message' });
        }
    });

    // Handle joining a chat room
    socket.on('join_room', (roomId: string) => {
        socket.join(roomId);
        console.log(`User ${socket.data.user.username} joined room ${roomId}`);
    });

    // Handle leaving a chat room
    socket.on('leave_room', (roomId: string) => {
        socket.leave(roomId);
        console.log(`User ${socket.data.user.username} left room ${roomId}`);
    });

    // Handle typing status
    socket.on('typing', (data) => {
        socket.to(data.chatRoomId).emit('user_typing', {
            userId: socket.data.user._id,
            username: socket.data.user.username,
            isTyping: data.isTyping,
        });
    });

    // Handle read receipts
    socket.on('mark_read', async (data) => {
        try {
            const { chatRoomId } = data;
            await Message.updateMany(
                {
                    chatRoom: chatRoomId,
                    readBy: { $ne: socket.data.user._id },
                },
                { $addToSet: { readBy: socket.data.user._id } }
            );

            socket.to(chatRoomId).emit('messages_read', {
                userId: socket.data.user._id,
                chatRoomId,
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.data.user.username);

        // Update user's online status
        await User.findByIdAndUpdate(socket.data.user._id, {
            isOnline: false,
            lastSeen: new Date(),
        });

        // Notify others in user's chat rooms
        socket.data.user.chatRooms.forEach((roomId: string) => {
            io.to(roomId).emit('user_status', {
                userId: socket.data.user._id,
                isOnline: false,
                lastSeen: new Date(),
            });
        });
    });
});

const PORT = Number(process.env.PORT) || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log('CORS origin:', process.env.NODE_ENV === 'production'
        ? 'https://your-production-domain.com'
        : 'http://localhost:3000');
}); 