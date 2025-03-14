import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware';
import { UploadedFile } from 'express-fileupload';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

router.post('/', authMiddleware, async (req: express.Request, res: express.Response) => {
    try {
        if (!req.files?.image || Array.isArray(req.files.image)) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const file = req.files.image as UploadedFile;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
                message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
            });
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            return res.status(400).json({ message: 'File size exceeds 5MB limit' });
        }

        // Generate unique filename
        const fileExtension = path.extname(file.name);
        const fileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);

        console.log('Uploading file:', {
            originalname: file.name,
            mimetype: file.mimetype,
            size: file.size,
            destination: filePath
        });

        // Move the file
        await file.mv(filePath);

        // Verify file exists
        const fileExists = fs.existsSync(filePath);
        console.log('File exists:', fileExists);

        if (!fileExists) {
            return res.status(500).json({ message: 'File was not saved correctly' });
        }

        // Construct the image URL
        const imageUrl = `/api/images/${fileName}`;
        console.log('Generated image URL:', imageUrl);

        return res.json({
            message: 'File uploaded successfully',
            imageUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ message: 'Error uploading file' });
    }
});

export default router; 