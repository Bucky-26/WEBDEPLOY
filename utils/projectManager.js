const path = require('path');
const http = require('http');
const fs = require('fs').promises;

function startProjectServer(project) {
    return new Promise((resolve, reject) => {
        const projectDir = path.join(__dirname, '..', 'projects', project.name);
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
            if (!global.projectServers) {
                global.projectServers = new Map();
            }
            global.projectServers.set(project.id, server);
            resolve();
        });

        server.on('error', (error) => {
            console.error(`Error starting server for project ${project.id}:`, error);
            reject(error);
        });
    });
}

function stopProjectServer(project) {
    return new Promise((resolve, reject) => {
        if (global.projectServers && global.projectServers.has(project.id)) {
            const server = global.projectServers.get(project.id);
            server.close((err) => {
                if (err) {
                    console.error(`Error stopping server for project ${project.id}:`, err);
                    reject(err);
                } else {
                    console.log(`Server for project ${project.id} stopped`);
                    global.projectServers.delete(project.id);
                    resolve();
                }
            });
        } else {
            console.log(`No server found for project ${project.id}`);
            resolve();
        }
    });
}

module.exports = {
    startProjectServer,
    stopProjectServer
};
