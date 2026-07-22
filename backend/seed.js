const mongoose = require('mongoose');
const Project = require('./models/Project');
require('dotenv').config();

const projects = require('./data/projects');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio')
    .then(async () => {
        console.log('Connected to MongoDB');
        await Project.deleteMany({});
        console.log('Cleared existing projects');
        await Project.insertMany(projects);
        console.log('Seeded', projects.length, 'projects successfully');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error seeding database:', err);
        process.exit(1);
    });
