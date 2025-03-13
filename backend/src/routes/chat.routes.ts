import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ChatRoom, Message, User } from '../models';
import mongoose from 'mongoose';

const router = express.Router();

// Get messages for a chat room
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({ chatRoom: req.params.roomId })
            .populate('sender', 'username avatar')
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Create or get direct message room
router.post('/direct/:userId', authMiddleware, async (req, res) => {
    try {
        console.log('Creating/getting direct message room for users:', {
            currentUser: req.user._id,
            otherUser: req.params.userId
        });

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            console.error('Invalid user ID format:', req.params.userId);
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const otherUser = await User.findById(req.params.userId);
        if (!otherUser) {
            console.error('User not found:', req.params.userId);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Found other user:', otherUser.username);

        // Check if a direct message room already exists between these users
        const existingRoom = await ChatRoom.findOne({
            participants: { $all: [req.user._id, req.params.userId] },
            isGroup: false,
        }).populate('participants', 'username avatar isOnline lastSeen');

        if (existingRoom) {
            console.log('Found existing room:', existingRoom);
            return res.json({
                id: existingRoom._id,
                name: existingRoom.name,
                participants: existingRoom.participants,
                isGroup: existingRoom.isGroup,
                lastMessage: existingRoom.lastMessage
            });
        }

        console.log('Creating new direct message room...');

        // Create new direct message room
        const newRoom = new ChatRoom({
            name: `Chat with ${otherUser.username}`,
            participants: [req.user._id, req.params.userId],
            isGroup: false,
        });

        console.log('New room object:', newRoom);

        await newRoom.save();
        console.log('Room saved successfully');

        // Update both users' chatRooms arrays
        await User.updateMany(
            { _id: { $in: [req.user._id, req.params.userId] } },
            { $addToSet: { chatRooms: newRoom._id } }
        );

        // Populate the participants before sending response
        const populatedRoom = await ChatRoom.findById(newRoom._id)
            .populate('participants', 'username avatar isOnline lastSeen');

        console.log('Populated room:', populatedRoom);

        if (!populatedRoom) {
            throw new Error('Failed to populate room after creation');
        }

        return res.json({
            id: populatedRoom._id,
            name: populatedRoom.name,
            participants: populatedRoom.participants,
            isGroup: populatedRoom.isGroup,
            lastMessage: populatedRoom.lastMessage
        });
    } catch (error) {
        console.error('Detailed error creating direct message room:', error);
        return res.status(500).json({
            message: 'Error creating direct message room',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get user's chat rooms
router.get('/', authMiddleware, async (req, res) => {
    try {
        const rooms = await ChatRoom.find({
            participants: req.user._id,
        })
            .populate('participants', 'username avatar')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json(rooms);
    } catch (error) {
        console.error('Error fetching chat rooms:', error);
        res.status(500).json({ message: 'Error fetching chat rooms' });
    }
});

export default router; 