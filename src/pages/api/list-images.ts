import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path: dirPath } = req.body;

    if (!dirPath) {
        return res.status(400).json({ error: 'Path is required' });
    }

    try {
        // Read directory contents
        const files = fs.readdirSync(dirPath);
        
        // Filter for image files (.bmp and .png only)
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ext === '.bmp' || ext === '.png';
        });

        res.status(200).json({ files: imageFiles });
    } catch (error) {
        console.error('Error reading directory:', error);
        res.status(500).json({ error: 'Failed to read directory' });
    }
}
