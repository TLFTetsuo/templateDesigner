import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { folderPath, filename, content } = req.body;

    if (!folderPath || !filename || !content) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Construct full file path
        const fullPath = path.join(folderPath, filename);
        
        // Ensure the filename ends with .yml or .yaml
        if (!filename.endsWith('.yml') && !filename.endsWith('.yaml')) {
            return res.status(400).json({ error: 'Filename must end with .yml or .yaml' });
        }

        // Check if directory exists
        if (!fs.existsSync(folderPath)) {
            return res.status(400).json({ error: 'Directory does not exist' });
        }

        // Check if directory is writable
        try {
            fs.accessSync(folderPath, fs.constants.W_OK);
        } catch (permError) {
            return res.status(403).json({ 
                error: 'Permission denied: Directory is not writable',
                details: `Cannot write to ${folderPath}. Please check directory permissions.`
            });
        }

        // Write the file
        fs.writeFileSync(fullPath, content, 'utf8');

        res.status(200).json({ 
            success: true, 
            message: 'Template saved successfully',
            path: fullPath 
        });
    } catch (error) {
        console.error('Error saving template:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ 
            error: 'Failed to save template',
            details: errorMessage 
        });
    }
}
