import express from 'express';
import { User } from '../models';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all users (excluding the current user)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select('-password')
            .sort({ isOnline: -1, lastSeen: -1 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

export default router; 