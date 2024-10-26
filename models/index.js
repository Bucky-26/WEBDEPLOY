const Project = require('./Project');
const ProjectFile = require('./ProjectFile');
const User = require('./User');

// Define associations
User.hasMany(Project);
Project.belongsTo(User);
Project.hasMany(ProjectFile);
ProjectFile.belongsTo(Project);

module.exports = {
    User,
    Project,
    ProjectFile
};
