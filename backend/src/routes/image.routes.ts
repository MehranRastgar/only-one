import express from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Image serving endpoint with Sharp
router.get('/:filename', async (req: express.Request, res: express.Response) => {
    try {
        const { filename } = req.params;
        const { width, height, quality, format } = req.query;

        console.log('Image request received:', {
            filename,
            width,
            height,
            quality,
            format,
            uploadsDir
        });

        // Validate filename to prevent directory traversal
        if (filename.includes('..') || filename.includes('/')) {
            console.log('Invalid filename detected:', filename);
            return res.status(400).json({ message: 'Invalid filename' });
        }

        const filePath = path.join(uploadsDir, filename);
        console.log('Looking for file at path:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log('File not found at path:', filePath);
            return res.status(404).json({ message: 'Image not found' });
        }

        console.log('File found, creating Sharp instance');
        // Create Sharp instance
        let sharpInstance = sharp(filePath);

        // Apply transformations based on query parameters
        if (width || height) {
            console.log('Applying resize:', { width, height });
            sharpInstance = sharpInstance.resize(
                width ? parseInt(width as string) : undefined,
                height ? parseInt(height as string) : undefined,
                {
                    fit: 'inside',
                    withoutEnlargement: true
                }
            );
        }

        // Set quality if specified
        if (quality) {
            const qualityValue = parseInt(quality as string);
            if (qualityValue >= 1 && qualityValue <= 100) {
                console.log('Setting quality:', qualityValue);
                sharpInstance = sharpInstance.jpeg({ quality: qualityValue });
            }
        }

        // Convert format if specified
        if (format) {
            console.log('Converting format to:', format);
            switch (format) {
                case 'webp':
                    sharpInstance = sharpInstance.webp();
                    break;
                case 'png':
                    sharpInstance = sharpInstance.png();
                    break;
                case 'jpeg':
                case 'jpg':
                    sharpInstance = sharpInstance.jpeg();
                    break;
                default:
                    console.log('Unsupported format:', format);
                    return res.status(400).json({ message: 'Unsupported format' });
            }
        }

        // Get image metadata
        const metadata = await sharpInstance.metadata();
        console.log('Image metadata:', metadata);

        // Set appropriate content type
        const contentType = `image/${metadata.format}`;
        console.log('Setting content type:', contentType);
        res.setHeader('Content-Type', contentType);

        // Stream the processed image
        console.log('Starting to stream image');
        return sharpInstance.pipe(res);
    } catch (error) {
        console.error('Error serving image:', error);
        return res.status(500).json({ message: 'Error processing image' });
    }
});

export default router; 