const express = require('express');
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  deleteProject,
  getDashboardStats,
  updateProjectMaterial
} = require('../controllers/projectController');

// Define API routes for project management
router.post('/', createProject);
router.get('/', getAllProjects);
router.get('/dashboard/stats', getDashboardStats);
router.get('/:id', getProjectById);
router.delete('/:id', deleteProject);
router.put('/:id/material', updateProjectMaterial);

module.exports = router;
