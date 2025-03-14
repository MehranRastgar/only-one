import { Request } from 'express';
import { User } from '../models';
import path from 'path';
import fs from 'fs';
import { UploadedFile } from 'express-fileupload';
import { RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import mime from 'mime-types';

// Define the request type for file uploads
type FileUploadRequest = Request & {
    files?: {
        [key: string]: UploadedFile;
    };
    user?: {
        _id: string;
        [key: string]: any;
    };
};

export const getAvatar: RequestHandler = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.avatar) {
            return res.status(404).json({ message: 'No avatar found' });
        }

        const uploadDir = path.join(__dirname, '../../uploads');
        const avatarPath = path.join(uploadDir, user.avatar);

        // Check if file exists
        if (!fs.existsSync(avatarPath)) {
            console.error(`Avatar file not found at path: ${avatarPath}`);
            return res.status(404).json({ message: 'Avatar file not found' });
        }

        // Get the MIME type based on file extension
        const mimeType = mime.lookup(avatarPath) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);

        // Set cache control headers
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.setHeader('Last-Modified', fs.statSync(avatarPath).mtime.toUTCString());

        // Stream the file instead of loading it all into memory
        const stream = fs.createReadStream(avatarPath);
        stream.on('error', (error) => {
            console.error('Error streaming avatar:', error);
            res.status(500).json({ message: 'Error streaming avatar' });
        });

        return stream.pipe(res);
    } catch (error) {
        console.error('Error fetching avatar:', error);
        return res.status(500).json({ message: 'Error fetching avatar' });
    }
};

export const updateAvatar: RequestHandler<ParamsDictionary, any, any, any, FileUploadRequest> = async (req, res) => {
    try {
        if (!req.files?.image || Array.isArray(req.files.image)) {
            return res.status(400).json({ message: 'No avatar file uploaded' });
        }

        const avatarFile = req.files.image;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

        if (!allowedTypes.includes(avatarFile.mimetype)) {
            return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG and GIF are allowed' });
        }

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(avatarFile.name);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);

        // Move the file
        await avatarFile.mv(filePath);

        // Update user's avatar in database
        if (!req.user?._id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old avatar if exists
        if (user.avatar) {
            const oldAvatarPath = path.join(uploadDir, user.avatar);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        user.avatar = fileName;
        await user.save();

        return res.json({
            message: 'Avatar updated successfully',
            avatar: fileName
        });
    } catch (error) {
        console.error('Error updating avatar:', error);
        return res.status(500).json({ message: 'Error updating avatar' });
    }
};