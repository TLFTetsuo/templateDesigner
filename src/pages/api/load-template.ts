import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

type Data = {
  content?: string;
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
    const { folderPath, fileName } = req.body;

    if (!folderPath || !fileName || typeof folderPath !== 'string' || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'Invalid folder path or file name provided' });
    }

    const filePath = path.join(folderPath, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template file not found' });
    }

    // Verify it's a file and has correct extension
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Invalid file' });
    }

    const isYamlFile = fileName.toLowerCase().endsWith('.yaml') || fileName.toLowerCase().endsWith('.yml');
    if (!isYamlFile) {
      return res.status(400).json({ error: 'File must be a YAML template file' });
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    res.status(200).json({ content });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read template file' });
  }
}