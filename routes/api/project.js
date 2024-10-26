const express = require('express');
const router = express.Router();
const { Project } = require('../../models');
const { ensureAuthenticated } = require('../../middleware/auth');
const fs = require('fs').promises;  // or const fs = require('fs-extra');
const path = require('path');
const http = require('http');

// Function to find the next available port
async function findNextAvailablePort(startPort = 3030) {
    let port = startPort;
    while (true) {
        const existingProject = await Project.findOne({ where: { port } });
        if (!existingProject) {
            return port;
        }
        port++;
    }
}

// Function to create the index.html content
function createIndexHtml(projectName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
        }
        h1 {
            color: #333;
        }
    </style>
</head>
<body>
    <h1>Hello World from ${projectName}!</h1>
</body>
</html>
    `;
}

// Updated function to start a server for a project
function startProjectServer(project, projectDir) {
    const server = http.createServer((req, res) => {
        let filePath = path.join(projectDir, req.url === '/' ? 'index.html' : req.url);
        const extname = path.extname(filePath);
        let contentType = 'text/html';

        switch (extname) {
            case '.css':
                contentType = 'text/css';
                break;
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.jpg':
                contentType = 'image/jpg';
                break;
        }

        fs.readFile(filePath)
            .then(content => {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            })
            .catch(err => {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    console.error('Error reading file:', err);
                    res.writeHead(500);
                    res.end('Server error');
                }
            });
    });

    server.listen(project.port, () => {
        console.log(`Server for project ${project.id} running on http://localhost:${project.port}`);
    });

    return server;
}

// File manager routes
router.get('/:projectId/files', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectDir = path.join(__dirname, '..', '..', 'projects', project.name);
        const files = await fs.readdir(projectDir);
        res.json(files);
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

router.get('/:projectId/files/:filename', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const filePath = path.join(__dirname, '..', '..', 'projects', project.name, req.params.filename);
        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

// Update the file creation route to handle different file types
router.post('/:projectId/files', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const { filename, content } = req.body;
        const filePath = path.join(__dirname, '..', '..', 'projects', project.name, filename);
        
        // Ensure the directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        await fs.writeFile(filePath, content);
        res.json({ message: 'File created successfully' });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

router.put('/:projectId/files/:filename', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const { content } = req.body;
        const filePath = path.join(__dirname, '..', '..', 'projects', project.name, req.params.filename);
        await fs.writeFile(filePath, content);
        res.json({ message: 'File updated successfully' });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

router.delete('/:projectId/files/:filename', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const filePath = path.join(__dirname, '..', '..', 'projects', project.name, req.params.filename);
        await fs.unlink(filePath);
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

router.post('/create', ensureAuthenticated, async (req, res) => {
    try {
        const { projectName } = req.body;
        
        // Check if project already exists
        const existingProject = await Project.findOne({ where: { name: projectName, UserId: req.user.id } });
        if (existingProject) {
            return res.status(400).json({ error: 'A project with this name already exists' });
        }

        // Find the next available port
        const port = await findNextAvailablePort();

        const project = await Project.create({
            name: projectName,
            UserId: req.user.id,
            port: port
        });

        // Create project directory
        const projectDir = path.join(__dirname, '..', '..', 'projects', projectName);
        await fs.mkdir(projectDir, { recursive: true });

        // Create and save the index.html file
        const indexHtmlContent = createIndexHtml(projectName);
        const indexFilePath = path.join(projectDir, 'index.html');
        await fs.writeFile(indexFilePath, indexHtmlContent);

        // Start the project server
        const server = startProjectServer(project, projectDir);

        // Save the server instance to the global scope for management
        if (!global.projectServers) {
            global.projectServers = new Map();
        }
        global.projectServers.set(project.id, server);

        res.status(201).json({
            ...project.toJSON(),
            url: `http://localhost:${project.port}`
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Project creation failed' });
    }
});

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        console.log('Fetching projects for user:', req.user.id);
        const projects = await Project.findAll({ where: { UserId: req.user.id } });
        console.log('Projects found:', projects.length);
        res.json(projects.map(project => ({
            id: project.id,
            name: project.name,
            port: project.port
        })));
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

router.get('/:projectId', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({
            ...project.toJSON(),
            url: `http://localhost:${project.port}`
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project details' });
    }
});

router.put('/:projectId', ensureAuthenticated, async (req, res) => {
    try {
        const { projectName } = req.body;
        const [updated] = await Project.update({ name: projectName }, {
            where: { id: req.params.projectId, UserId: req.user.id }
        });
        if (updated) {
            const updatedProject = await Project.findByPk(req.params.projectId);
            return res.json(updatedProject);
        }
        throw new Error('Project not found');
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(400).json({ error: 'Project update failed' });
    }
});

router.delete('/:projectId', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Stop the server if it's running
        if (global.projectServers && global.projectServers.has(project.id)) {
            const server = global.projectServers.get(project.id);
            server.close();
            global.projectServers.delete(project.id);
        }

        // Delete the project directory
        const projectDir = path.join(__dirname, '..', '..', 'projects', project.name);
        await fs.promises.rmdir(projectDir, { recursive: true });

        // Delete the project from the database
        await project.destroy();

        res.status(204).send("Project deleted");
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(400).json({ error: 'Project deletion failed' });
    }
});

async function deployAllProjects() {
    try {
        const projects = await Project.findAll();
        for (const project of projects) {
            const projectDir = path.join(__dirname, '..', '..', 'projects', project.name);
            try {
                await fs.access(projectDir);
                const server = startProjectServer(project, projectDir);
                if (!global.projectServers) {
                    global.projectServers = new Map();
                }
                global.projectServers.set(project.id, server);
                await Project.update({ deployed: true }, { where: { id: project.id } });
                console.log(`Redeployed project ${project.name} on port ${project.port}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log(`Project directory not found for ${project.name}`);
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error('Error deploying projects:', error);
    }
}

// Add these new routes near the end of the file, before the module.exports

router.post('/:projectId/pause', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.deployed) {
            return res.status(400).json({ error: 'Project is already paused' });
        }

        if (global.projectServers && global.projectServers.has(project.id)) {
            const server = global.projectServers.get(project.id);
            server.close();
            global.projectServers.delete(project.id);
        }

        await Project.update({ deployed: false }, { where: { id: project.id } });

        res.json({ message: `Project ${project.name} has been paused` });
    } catch (error) {
        console.error('Error pausing project:', error);
        res.status(500).json({ error: 'Failed to pause project' });
    }
});

router.post('/:projectId/start', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (project.deployed) {
            return res.status(400).json({ error: 'Project is already running' });
        }

        const projectDir = path.join(__dirname, '..', '..', 'projects', project.name);
        const server = startProjectServer(project, projectDir);

        if (!global.projectServers) {
            global.projectServers = new Map();
        }
        global.projectServers.set(project.id, server);

        await Project.update({ deployed: true }, { where: { id: project.id } });

        res.json({ message: `Project ${project.name} has been started`, url: `http://localhost:${project.port}` });
    } catch (error) {
        console.error('Error starting project:', error);
        res.status(500).json({ error: 'Failed to start project' });
    }
});

// At the end of the file
module.exports = {
    router: router,
    deployAllProjects: deployAllProjects
};
