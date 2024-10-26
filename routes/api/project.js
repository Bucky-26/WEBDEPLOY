const express = require('express');
const router = express.Router();
const { Project } = require('../../models');
const { ensureAuthenticated } = require('../../middleware/auth');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Function to find the next available port
async function findNextAvailablePort(startPort = 3000) {
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

// Function to start a server for a project
function startProjectServer(project, projectDir) {
    const server = http.createServer((req, res) => {
        const filePath = path.join(projectDir, 'index.html');
        fs.readFile(filePath)
            .then(content => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            })
            .catch(err => {
                console.error('Error reading index.html:', err);
                res.writeHead(500);
                res.end('Error loading index.html');
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

router.post('/:projectId/files', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.projectId, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const { filename, content } = req.body;
        const filePath = path.join(__dirname, '..', '..', 'projects', project.name, filename);
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
        const deleted = await Project.destroy({
            where: { id: req.params.projectId, UserId: req.user.id }
        });
        if (deleted) {
            return res.status(204).send("Project deleted");
        }
        throw new Error('Project not found');
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(400).json({ error: 'Project deletion failed' });
    }
});

module.exports = router;
