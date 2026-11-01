const express = require('express');
const Project = require('./Project');
const curatedProjects = require('../../data/projects');

class ProjectCatalog {
  static merge(dbProjects) {
    if (!dbProjects || !dbProjects.length) return curatedProjects;
    const liveByUrl = new Map(dbProjects.map((row) => [row.sourceUrl, row]));
    return curatedProjects.map((curated) => {
      const live = liveByUrl.get(curated.sourceUrl);
      return live ? { ...curated, lastSyncedAt: live.lastSyncedAt || curated.lastSyncedAt } : curated;
    });
  }

  static withPublicIds(projects) {
    return projects.map((project, index) => ({ ...project, _id: String(index + 1) }));
  }
}

class ProjectsRouter {
  send(res, work) {
    return work
      .then((payload) => res.json(payload))
      .catch((error) => {
        if (error.status === 404) return res.status(404).json({ message: 'Not found' });
        console.error('[Projects] Operation failed; details suppressed.');
        return res.status(500).json({ message: 'Could not load projects.' });
      });
  }

  create() {
    const router = express.Router();
    router.get('/projects', (req, res) => this.send(res, this.list(req.query.source)));
    router.get('/projects/:id', (req, res) => this.send(res, this.one(req.params.id)));
    return router;
  }

  async catalog() {
    const dbProjects = await Project.find({}).sort({ updatedAt: -1 });
    return ProjectCatalog.withPublicIds(ProjectCatalog.merge(dbProjects));
  }

  async list(source) {
    const projects = await this.catalog();
    return source ? projects.filter((project) => project.source === source) : projects;
  }

  async one(id) {
    const project = (await this.catalog()).find((row) => row._id === id);
    if (!project) throw Object.assign(new Error('Not found'), { status: 404 });
    return project;
  }
}

function createProjectsRouter() {
  return new ProjectsRouter().create();
}

function mergeWithDb(dbProjects) {
  return ProjectCatalog.merge(dbProjects);
}

module.exports = { ProjectCatalog, ProjectsRouter, createProjectsRouter, mergeWithDb };
