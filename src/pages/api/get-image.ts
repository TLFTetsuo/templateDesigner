import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { filename } = req.query;

    if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'Filename is required' });
    }

    try {
        const imagePath = path.join('/opt/esl/tag_image_gen/images', filename);
        
        // Check if file exists
        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Read the image file
        const imageBuffer = fs.readFileSync(imagePath);
        
        // Determine content type based on file extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'image/png'; // default
        
        if (ext === '.bmp') {
            contentType = 'image/bmp';
        } else if (ext === '.png') {
            contentType = 'image/png';
        }

        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        
        // Send the image
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).json({ error: 'Failed to load image' });
    }
}
