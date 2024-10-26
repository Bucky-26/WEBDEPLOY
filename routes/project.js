const express = require('express');
const router = express.Router();
const { Project } = require('../models');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const projects = await Project.findAll({ where: { UserId: req.user.id } });
        res.render('index', { user: req.user, projects });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).send('Error fetching projects');
    }
});

router.post('/create', ensureAuthenticated, async (req, res) => {
    try {
        const { projectName } = req.body;
        await Project.create({
            name: projectName,
            UserId: req.user.id
        });
        res.redirect('/');
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(400).json({ error: 'Project creation failed' });
    }
});

router.get('/:projectId', ensureAuthenticated, async (req, res) => {
    try {
        const project = await Project.findOne({
            where: { id: req.params.projectId, UserId: req.user.id }
        });
        if (!project) {
            return res.status(404).send('Project not found');
        }
        res.render('project', { user: req.user, project });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).send('Error fetching project');
    }
});

module.exports = router;
