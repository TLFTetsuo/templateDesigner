import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

type Data = {
  folders?: string[];
  error?: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path: dirPath } = req.body;

    if (!dirPath || typeof dirPath !== 'string') {
      return res.status(400).json({ error: 'Invalid path provided' });
    }

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      // Return empty array if directory doesn't exist instead of error
      return res.status(200).json({ folders: [] });
    }

    // Read directory contents
    const items = fs.readdirSync(dirPath);
    
    // Filter only directories
    const folders = items.filter(item => {
      try {
        const itemPath = path.join(dirPath, item);
        return fs.statSync(itemPath).isDirectory();
      } catch (error) {
        // Skip items that can't be accessed
        return false;
      }
    });

    res.status(200).json({ folders });
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: 'Failed to read directory' });
  }
}