import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getAvatar, updateAvatar } from '../controllers/avatar.controller';

const router = express.Router();

// Get user avatar
router.get('/:userId', getAvatar);

// Update user avatar
router.post('/', authMiddleware, updateAvatar);

export default router;

