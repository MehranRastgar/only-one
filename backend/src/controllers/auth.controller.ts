import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { z } from 'zod';

const signupSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const authController = {
    register: async (req: Request, res: Response): Promise<void> => {
        try {
            // Validate input
            const { name, email, password } = signupSchema.parse(req.body);

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [{ email }, { username: name }],
            });

            if (existingUser) {
                res.status(400).json({
                    message: 'User with this email or name already exists',
                });
                return;
            }

            // Create new user
            const user = new User({
                username: name,
                email,
                password,
            });

            await user.save();

            // Generate token
            const token = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            res.status(201).json({
                token,
                user: {
                    id: user._id,
                    name: user.username,
                    email: user.email,
                    avatar: user.avatar,
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    message: error.errors[0].message,
                });
                return;
            }
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Error creating user' });
        }
    },

    login: async (req: Request, res: Response): Promise<void> => {
        try {
            const { email, password } = req.body;

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }

            // Check password
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }

            // Update online status
            user.isOnline = true;
            user.lastSeen = new Date();
            await user.save();

            // Generate token
            const token = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            res.json({
                token,
                user: {
                    id: user._id,
                    name: user.username,
                    email: user.email,
                    avatar: user.avatar,
                },
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Error logging in' });
        }
    },

    getProfile: async (req: Request, res: Response): Promise<void> => {
        try {
            const user = await User.findById(req.user._id)
                .select('-password')
                .lean();

            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            res.json({
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            res.status(500).json({ message: 'Error fetching profile' });
        }
    },

    updateProfile: async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, email, avatar } = req.body;
            const updates: { [key: string]: any } = {};

            if (username) updates.username = username;
            if (email) updates.email = email;
            if (avatar) updates.avatar = avatar;

            // Check if username or email is already taken
            if (username || email) {
                const existingUser = await User.findOne({
                    $or: [
                        ...(email ? [{ email, _id: { $ne: req.user._id } }] : []),
                        ...(username ? [{ username, _id: { $ne: req.user._id } }] : [])
                    ],
                });

                if (existingUser) {
                    res.status(400).json({
                        message: 'Username or email already taken'
                    });
                    return;
                }
            }

            // Update user
            const user = await User.findByIdAndUpdate(
                req.user._id,
                updates,
                { new: true, select: '-password' }
            ).lean();

            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            res.json({
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({ message: 'Error updating profile' });
        }
    }
}; 