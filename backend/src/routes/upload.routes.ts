import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
        }
    }
});

router.post('/', authMiddleware, upload.single('image'), async (req: express.Request, res: express.Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('Uploaded file:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Construct the image URL using the new image route
        const imageUrl = `${process.env.API_URL}/api/images/${req.file.filename}`;
        console.log('Generated image URL:', imageUrl);

        // Verify file exists
        const filePath = path.join(uploadsDir, req.file.filename);
        const fileExists = fs.existsSync(filePath);
        console.log('File exists:', fileExists);

        if (!fileExists) {
            return res.status(500).json({ message: 'File was not saved correctly' });
        }

        return res.json({
            message: 'File uploaded successfully',
            imageUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Error uploading file' });
    }
});

export default router; 