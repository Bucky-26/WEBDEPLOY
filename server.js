const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const flash = require('connect-flash');
const http = require('http');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

const { sequelize, User, Project, syncDatabase, ProjectFile } = require('./models');

const app = express();
const port = process.env.PORT || 3000;

// Ensure projects directory exists
const projectsDir = path.join(__dirname, 'projects');
if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir);
}

const generateSecret = () => {
    return crypto.randomBytes(64).toString('hex');
};

const sessionSecret = generateSecret();

console.log('Generated session secret:', sessionSecret);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Passport configuration
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
        }
        if (!await bcrypt.compare(password, user.password)) {
            return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));
app.use('/projects', express.static('projects'));

// Routes
app.get('/', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    const projects = await Project.findAll({ where: { UserId: req.user.id } });
    res.render('index', { user: req.user, projects });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('error') || [] });
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword });
        res.redirect('/login');
    } catch (error) {
        res.redirect('/register');
    }
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error during logout:', err);
        }
        res.redirect('/login');
    });
});

// Add this route before create-project
app.get('/check-project/:projectName', async (req, res) => {
    const { projectName } = req.params;
    try {
        const project = await Project.findOne({ where: { name: projectName } });
        res.json({ exists: !!project });
    } catch (error) {
        res.status(500).json({ error: 'Error checking project name' });
    }
});

// Create project
app.post('/create-project', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { projectName } = req.body;
    if (!projectName) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        // Check for existing project
        const existingProject = await Project.findOne({ where: { name: projectName } });
        if (existingProject) {
            return res.status(400).json({ error: 'Project name already exists' });
        }

        const lastProject = await Project.findOne({
            order: [['port', 'DESC']]
        });
        const port = lastProject ? lastProject.port + 1 : 3001;

        const project = await Project.create({ 
            name: projectName, 
            UserId: req.user.id,
            port: port
        });

        const projectPath = path.join(__dirname, 'projects', projectName);
        fs.mkdirSync(projectPath, { recursive: true });

        const indexPath = path.join(projectPath, 'index.html');
        const defaultContent = '<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n</body>\n</html>';
        await fsPromises.writeFile(indexPath, defaultContent);

        // Create and start the server for this project
        const serve = serveStatic(projectPath);
        const server = http.createServer((req, res) => {
            serve(req, res, finalhandler(req, res));
        });

        server.listen(port, () => {
            console.log(`Project ${projectName} is running on port ${port}`);
        });

        // Store the server instance
        const servers = new Map(); // Store server instances
        servers.set(projectName, server);

        res.json({ message: `Project created successfully and running on port ${port}` });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(400).json({ error: 'Project creation failed' });
    }
});

// Upload file
app.post('/upload/:projectName', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files were uploaded' });
    }

    const { projectName } = req.params;
    const project = await Project.findOne({ where: { name: projectName, UserId: req.user.id } });
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    const uploadedFile = req.files.file;
    const uploadPath = path.join(__dirname, 'projects', projectName, uploadedFile.name);

    uploadedFile.mv(uploadPath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'File upload failed' });
        }
        res.json({ message: 'File uploaded successfully' });
    });
});

app.get('/project-files/:projectName', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectName } = req.params;

    try {
        const project = await Project.findOne({
            where: { 
                name: projectName,
                UserId: req.user.id
            },
            include: [ProjectFile]
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectPath = path.join(__dirname, 'projects', projectName);
        const files = await getFileTree(projectPath);

        res.json(files);
    } catch (error) {
        console.error('Error loading project files:', error);
        res.status(500).json({ error: 'Error loading project files' });
    }
});

app.get('/file-content/:projectName/*', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract the correct project name and file path
    const projectName = req.params.projectName.replace('projects/', '');
    const relativePath = req.params[0];
    const filePath = path.join(__dirname, 'projects', projectName, relativePath);
    
    console.log({
        originalProjectName: req.params.projectName,
        cleanProjectName: projectName,
        relativePath: relativePath,
        fullPath: filePath
    });

    try {
        // Verify the file exists
        if (!fs.existsSync(filePath)) {
            console.log('File not found at:', filePath);
            return res.status(404).json({ error: 'File not found' });
        }

        const content = await fsPromises.readFile(filePath, 'utf-8');
        res.send(content);
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: 'Error reading file' });
    }
});

app.post('/save-file/:projectName/:filePath(*)', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectName, filePath } = req.params;
    const { content } = req.body;

    try {
        const fullPath = path.join(__dirname, 'projects', projectName, filePath);
        await fsPromises.writeFile(fullPath, content);
        res.json({ message: 'File saved successfully' });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Error saving file' });
    }
});

async function getFileTree(dir) {
    const files = await fsPromises.readdir(dir);
    const fileTree = await Promise.all(files.map(async file => {
        const filePath = path.join(dir, file);
        const stats = await fsPromises.stat(filePath);
        if (stats.isDirectory()) {
            return {
                name: file,
                type: 'directory',
                children: await getFileTree(filePath),
                path: path.relative(__dirname, filePath)
            };
        } else {
            return {
                name: file,
                type: 'file',
                path: path.relative(__dirname, filePath)
            };
        }
    }));
    return fileTree;
}

// Start server
async function startServer() {
    try {
        await syncDatabase();
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
    }
}

startServer();

// Create folder
app.post('/create-folder/:projectName', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { folderName } = req.body;
    const { projectName } = req.params;

    try {
        const project = await Project.findOne({ where: { name: projectName, UserId: req.user.id } });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const folderPath = path.join(__dirname, 'projects', projectName, folderName);
        fs.mkdirSync(folderPath, { recursive: true });

        res.json({ message: 'Folder created successfully' });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Error creating folder' });
    }
});

// Create file
app.post('/create-file/:projectName', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { fileName, content } = req.body;
    const { projectName } = req.params;

    try {
        const project = await Project.findOne({ 
            where: { 
                name: projectName, 
                UserId: req.user.id 
            } 
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const filePath = path.join(__dirname, 'projects', projectName, fileName);
        
        // Create the file in the filesystem
        await fsPromises.writeFile(filePath, content);

        // Store file information in the database
        await ProjectFile.create({
            name: fileName,
            path: fileName,
            type: 'file',
            content: content,
            ProjectId: project.id
        });

        res.json({ message: 'File created successfully' });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: 'Error creating file' });
    }
});

app.delete('/delete-item/:projectName/:itemPath(*)', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectName, itemPath } = req.params;
    const fullPath = path.join(__dirname, 'projects', projectName, itemPath);

    try {
        const stats = await fsPromises.stat(fullPath);
        if (stats.isDirectory()) {
            await fsPromises.rm(fullPath, { recursive: true });
        } else {
            await fsPromises.unlink(fullPath);
        }
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Error deleting item' });
    }
});

app.post('/move-item/:projectName', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectName } = req.params;
    const { sourcePath, destinationPath } = req.body;
    
    const sourceFull = path.join(__dirname, 'projects', projectName, sourcePath);
    const destFull = path.join(__dirname, 'projects', projectName, destinationPath);

    try {
        await fsPromises.rename(sourceFull, destFull);
        res.json({ message: 'Item moved successfully' });
    } catch (error) {
        console.error('Error moving item:', error);
        res.status(500).json({ error: 'Error moving item' });
    }
});
