const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { Project } = require('../../models');
const { ensureAuthenticated } = require('../../middleware/auth');
const multer = require('multer');
// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const projectName = req.params.projectName;
        const projectDir = path.join(__dirname, '..', '..', 'projects', projectName);
        fs.mkdir(projectDir, { recursive: true })
            .then(() => cb(null, projectDir))
            .catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
}).single('file');

// Update the upload route
router.post('/upload/:projectName', ensureAuthenticated, (req, res) => {
    console.log('Upload request received:', req.params);
    
    upload(req, res, function (err) {
        if (err) {
            console.error('Upload error:', err);
            return res.status(500).json({ error: 'File upload failed: ' + err.message });
        }

        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log('File upload successful');
        console.log('Uploaded file:', req.file);
        res.json({ 
            message: 'File uploaded successfully',
            filename: req.file.filename 
        });
    });
});

// Get project files
router.get('/project-files/:projectName', ensureAuthenticated, async (req, res) => {
    try {
        const { projectName } = req.params;
        
        // Verify project exists and belongs to user
        const project = await Project.findOne({
            where: { 
                name: projectName, 
                UserId: req.user.id 
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get files from project directory
        const projectPath = path.join(__dirname, '..', '..', 'projects', projectName);
        const files = await listFiles(projectPath);
        
        res.json(files);
    } catch (error) {
        console.error('Error loading project files:', error);
        res.status(500).json({ error: 'Error loading project files' });
    }
});

// Helper function to list files in a directory
async function listFiles(dirPath) {
    try {
        const files = await fs.readdir(dirPath);
        const fileStats = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(dirPath, file);
                const stats = await fs.stat(filePath);
                return { file, isFile: stats.isFile() };
            })
        );
        return fileStats.filter(({ isFile }) => isFile).map(({ file }) => file);
    } catch (error) {
        console.error('Error listing files:', error);
        return [];
    }
}

// Get file content
router.get('/file-content/:projectName/:fileName', ensureAuthenticated, async (req, res) => {
    try {
        const { projectName, fileName } = req.params;
        
        // Verify project exists and belongs to user
        const project = await Project.findOne({
            where: { 
                name: projectName, 
                UserId: req.user.id 
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const filePath = path.join(__dirname, '..', '..', 'projects', projectName, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        res.send(content);
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: 'Error reading file' });
    }
});

// Save file content
router.post('/write/:projectName/:fileName', ensureAuthenticated, async (req, res) => {
    console.log('Route hit:', req.params);
    console.log('Request body:', req.body);
    try {
        const { projectName, fileName } = req.params;
        const { content } = req.body;

        // Verify project exists and belongs to user
        const project = await Project.findOne({
            where: { 
                name: projectName, 
                UserId: req.user.id 
            }
        });

        if (!project) {
            console.log('Project not found:', projectName);
            return res.status(404).json({ error: 'Project not found' });
        }

        const filePath = path.join(__dirname, '..', '..', 'projects', projectName, fileName);
        console.log('Writing file to:', filePath);
        await fs.writeFile(filePath, content);
        console.log('File saved successfully');
        res.json({ message: 'File saved successfully' });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Error saving file: ' + error.message });
    }
});

// Create new file
router.post('/create/:projectName', ensureAuthenticated, async (req, res) => {
    try {
        const { projectName } = req.params;
        const { fileName, content = '' } = req.body;

        // Verify project exists and belongs to user
        const project = await Project.findOne({
            where: { 
                name: projectName, 
                UserId: req.user.id 
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectPath = path.join(__dirname, '..', '..', 'projects', projectName);
        const filePath = path.join(projectPath, fileName);

        // Create project directory if it doesn't exist
        await fs.mkdir(projectPath, { recursive: true });
        
        // Create the file
        await fs.writeFile(filePath, content);
        res.json({ message: 'File created successfully' });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: 'Error creating file' });
    }
});

// Delete file
router.delete('/:projectName/:fileName', ensureAuthenticated, async (req, res) => {
    console.log('Received delete request:', req.params);
    try {
        const { projectName, fileName } = req.params;

        // Verify project exists and belongs to user
        const project = await Project.findOne({
            where: { 
                name: projectName, 
                UserId: req.user.id 
            }
        });

        if (!project) {
            console.log('Project not found:', projectName);
            return res.status(404).json({ error: 'Project not found' });
        }

        const filePath = path.join(__dirname, '..', '..', 'projects', projectName, fileName);
        console.log('Deleting file:', filePath);
        await fs.unlink(filePath);
        console.log('File deleted successfully');
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Error deleting file: ' + error.message });
    }
});

module.exports = router;
