import express from 'express';
import { User } from '../models';
import { authenticateToken } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth.middleware';
import { ChatRoom } from '../models';
import { getAvatar, updateAvatar } from '../controllers/avatar.controller';
import { authController } from '../controllers/auth.controller';
import Partnership from '../models/partnership.model';
import { IUser } from '../models/user.model';

const router = express.Router();

// Get all users (excluding the current user)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select('-password')
            .sort({ isOnline: -1, lastSeen: -1 });

        return res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ message: 'Error fetching users' });
    }
});

// Get current user's partner code
router.get('/partner-code', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate a new code if user doesn't have one
        if (!user.partnerCode) {
            user.generatePartnerCode();
            await user.save();
        }

        return res.json({ partnerCode: user.partnerCode });
    } catch (error) {
        console.error('Error fetching partner code:', error);
        return res.status(500).json({ message: 'Error fetching partner code' });
    }
});

// Generate new partner code
router.post('/partner-code/generate', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate new code
        const newCode = user.generatePartnerCode();
        await user.save();

        return res.json({ partnerCode: newCode });
    } catch (error) {
        console.error('Error generating partner code:', error);
        return res.status(500).json({ message: 'Error generating partner code' });
    }
});

// Connect with partner using code
router.post('/partner-connect', authMiddleware, async (req, res) => {
    try {
        const { partnerCode } = req.body;
        if (!partnerCode) {
            return res.status(400).json({ message: 'Partner code is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is already in a partnership
        const existingPartnership = await Partnership.findOne({
            users: user._id
        });

        if (existingPartnership) {
            return res.status(400).json({ message: 'You already have a partner' });
        }

        // Find partner with the provided code
        const partner = await User.findOne({ partnerCode });
        if (!partner) {
            return res.status(404).json({ message: 'Invalid partner code' });
        }

        // Check if partner is already in a partnership
        const partnerExistingPartnership = await Partnership.findOne({
            users: partner._id
        });

        if (partnerExistingPartnership) {
            return res.status(400).json({ message: 'This partner is already connected with someone else' });
        }

        // Create a chat room for the partners
        const chatRoom = new ChatRoom({
            name: `Chat with ${partner.username}`,
            participants: [user._id, partner._id],
            isGroup: false,
        });
        await chatRoom.save();

        // Create the partnership
        const partnership = new Partnership({
            users: [user._id, partner._id],
            chatRoom: chatRoom._id
        });
        await partnership.save();

        // Update both users' chat rooms
        user.chatRooms = user.chatRooms || [];
        partner.chatRooms = partner.chatRooms || [];
        user.chatRooms.push(chatRoom._id);
        partner.chatRooms.push(chatRoom._id);

        // Clear partner codes
        user.partnerCode = null;
        partner.partnerCode = null;

        // Save both users
        await Promise.all([user.save(), partner.save()]);

        return res.json({
            message: 'Successfully connected with partner',
            chatRoom: {
                id: chatRoom._id,
                name: chatRoom.name,
                participants: [
                    {
                        _id: user._id,
                        username: user.username,
                        avatar: user.avatar,
                        isOnline: user.isOnline,
                        lastSeen: user.lastSeen
                    },
                    {
                        _id: partner._id,
                        username: partner.username,
                        avatar: partner.avatar,
                        isOnline: partner.isOnline,
                        lastSeen: partner.lastSeen
                    }
                ]
            }
        });
    } catch (error) {
        console.error('Error connecting with partner:', error);
        return res.status(500).json({ message: 'Error connecting with partner' });
    }
});

// Get partner information
router.get('/partner', authMiddleware, async (req, res) => {
    try {
        // Find partnership where the current user is one of the users
        const partnership = await Partnership.findOne({
            users: req.user._id
        }).populate('users', 'username avatar isOnline lastSeen');

        if (!partnership) {
            return res.status(404).json({ message: 'No partner found' });
        }

        // Get the partner (the other user in the partnership)
        const partner = partnership.users.find(user => !user._id.equals(req.user._id));
        if (!partner) {
            return res.status(404).json({ message: 'No partner found' });
        }

        return res.json(partner);
    } catch (error) {
        console.error('Error fetching partner:', error);
        return res.status(500).json({ message: 'Error fetching partner' });
    }
});

// Disconnect from partner
router.post('/partner-disconnect', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Find the partnership
        const partnership = await Partnership.findOne({
            users: user._id
        }).populate<{ users: IUser[] }>('users');

        if (!partnership) {
            console.log('No active partnership found for user:', user._id);
            // Clean up any leftover partner code
            user.partnerCode = null;
            await user.save();
            return res.json({
                message: 'No active partnership found',
                success: true
            });
        }

        console.log('Found partnership:', partnership._id);

        try {
            // Get both users from the partnership
            const users = partnership.users;

            // Find and remove the chat room
            if (partnership.chatRoom) {
                const chatRoom = await ChatRoom.findById(partnership.chatRoom);
                if (chatRoom) {
                    console.log('Found chat room to remove:', chatRoom._id);

                    // Remove chat room from both users' chatRooms array
                    for (const partnerUser of users) {
                        console.log('Processing user:', partnerUser._id);
                        console.log('Current chatRooms:', partnerUser.chatRooms);

                        // Safely filter out the chat room
                        partnerUser.chatRooms = (partnerUser.chatRooms || []).filter(roomId => {
                            try {
                                return roomId && roomId.toString() !== chatRoom._id.toString();
                            } catch (err) {
                                console.error('Error comparing room IDs:', err);
                                return true; // Keep the room ID if comparison fails
                            }
                        });

                        partnerUser.partnerCode = null;
                        console.log('Updated chatRooms:', partnerUser.chatRooms);
                    }

                    // Save all user updates in parallel with better error handling
                    await Promise.all(users.map(async (partnerUser) => {
                        try {
                            await User.updateOne({ _id: partnerUser._id }, { $unset: { partnerCode: "" } });
                            // console.log('Successfully updated user:', savedUser._id);
                        } catch (saveError) {
                            console.error('Error saving user:', partnerUser._id, saveError);
                            throw new Error(`Failed to save user ${partnerUser._id}: ${saveError.message}`);
                        }
                    }));

                    try {
                        // Delete the chat room
                        await ChatRoom.findByIdAndDelete(chatRoom._id);
                        console.log('Successfully deleted chat room:', chatRoom._id);
                    } catch (deleteError) {
                        console.error('Error deleting chat room:', deleteError);
                        throw new Error(`Failed to delete chat room: ${deleteError.message}`);
                    }
                }
            }

            try {
                // Delete the partnership
                await Partnership.findByIdAndDelete(partnership._id);
                console.log('Successfully deleted partnership:', partnership._id);
            } catch (deleteError) {
                console.error('Error deleting partnership:', deleteError);
                throw new Error(`Failed to delete partnership: ${deleteError.message}`);
            }

            return res.json({
                message: 'Successfully disconnected from partner',
                success: true
            });
        } catch (innerError) {
            console.error('Error during disconnect operations:', innerError);
            // Return more specific error message
            return res.status(500).json({
                message: `Error during disconnect operations: ${innerError.message}`,
                success: false
            });
        }
    } catch (error) {
        console.error('Error disconnecting from partner:', error);
        return res.status(500).json({
            message: 'Error disconnecting from partner',
            success: false
        });
    }
});

// Profile routes
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);

// Avatar routes
router.get('/avatar/:userId', getAvatar);
router.post('/avatar', authMiddleware, updateAvatar);

export default router;