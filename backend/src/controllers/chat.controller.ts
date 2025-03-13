import { Request, Response } from 'express';
import { ChatRoom, Message, User } from '../models';
import { z } from 'zod';

const messageSchema = z.object({
    content: z.string().min(1),
    chatRoomId: z.string(),
});

export const chatController = {
    createChatRoom: async (req: Request, res: Response): Promise<void> => {
        try {
            const { participantIds, name, isGroup } = req.body;

            // Add current user to participants
            const participants = [...new Set([...participantIds, req.user._id])];

            // For direct messages, check if room already exists
            if (!isGroup) {
                const existingRoom = await ChatRoom.findOne({
                    participants: { $all: participants },
                    isGroup: false,
                });

                if (existingRoom) {
                    res.json(existingRoom);
                    return;
                }
            }

            // Create new chat room
            const chatRoom = new ChatRoom({
                name: name || `Chat ${Date.now()}`,
                participants,
                isGroup,
            });

            await chatRoom.save();

            // Add chat room to participants' chatRooms array
            await User.updateMany(
                { _id: { $in: participants } },
                { $addToSet: { chatRooms: chatRoom._id } }
            );

            res.status(201).json(chatRoom);
        } catch (error) {
            res.status(500).json({ message: 'Error creating chat room' });
        }
    },

    getChatRooms: async (req: Request, res: Response): Promise<void> => {
        try {
            const chatRooms = await ChatRoom.find({
                participants: req.user._id,
            })
                .populate('participants', 'username avatar isOnline lastSeen')
                .populate('lastMessage')
                .sort({ updatedAt: -1 });

            res.json(chatRooms);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching chat rooms' });
        }
    },

    getMessages: async (req: Request, res: Response): Promise<void> => {
        try {
            const { chatRoomId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            // Check if user is part of the chat room
            const chatRoom = await ChatRoom.findOne({
                _id: chatRoomId,
                participants: req.user._id,
            });

            if (!chatRoom) {
                res.status(404).json({ message: 'Chat room not found' });
                return;
            }

            const messages = await Message.find({ chatRoom: chatRoomId })
                .populate('sender', 'username avatar')
                .sort({ createdAt: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            // Mark messages as read
            await Message.updateMany(
                {
                    chatRoom: chatRoomId,
                    readBy: { $ne: req.user._id },
                    sender: { $ne: req.user._id },
                },
                { $addToSet: { readBy: req.user._id } }
            );

            res.json(messages.reverse());
        } catch (error) {
            res.status(500).json({ message: 'Error fetching messages' });
        }
    },

    sendMessage: async (req: Request, res: Response): Promise<void> => {
        try {
            // Validate request body
            const validatedData = messageSchema.parse(req.body);
            const { content, chatRoomId } = validatedData;

            // Check if user is part of the chat room
            const chatRoom = await ChatRoom.findOne({
                _id: chatRoomId,
                participants: req.user._id,
            });

            if (!chatRoom) {
                res.status(404).json({ message: 'Chat room not found' });
                return;
            }

            // Create message
            const message = new Message({
                content,
                sender: req.user._id,
                chatRoom: chatRoomId,
                readBy: [req.user._id],
            });

            await message.save();

            // Update chat room's last message
            chatRoom.lastMessage = message._id;
            await chatRoom.save();

            // Populate sender information
            await message.populate('sender', 'username avatar');

            res.status(201).json(message);
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    message: 'Invalid message data',
                    errors: error.errors
                });
                return;
            }
            res.status(500).json({ message: 'Error sending message' });
        }
    },

    markMessagesAsRead: async (req: Request, res: Response): Promise<void> => {
        try {
            const { chatRoomId } = req.params;

            // Check if user is part of the chat room
            const chatRoom = await ChatRoom.findOne({
                _id: chatRoomId,
                participants: req.user._id,
            });

            if (!chatRoom) {
                res.status(404).json({ message: 'Chat room not found' });
                return;
            }

            // Mark all unread messages as read
            await Message.updateMany(
                {
                    chatRoom: chatRoomId,
                    readBy: { $ne: req.user._id },
                    sender: { $ne: req.user._id },
                },
                { $addToSet: { readBy: req.user._id } }
            );

            res.json({ message: 'Messages marked as read' });
        } catch (error) {
            res.status(500).json({ message: 'Error marking messages as read' });
        }
    }
}; 