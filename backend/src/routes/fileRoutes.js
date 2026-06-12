const express = require('express');
const router = express.Router();
const {
  upload,
  uploadDxfFile,
  getFilesByProject,
  deleteFile,
  updateFileQuantity
} = require('../controllers/fileController');

// Route for uploading a DXF file (intercepts multer errors first)
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}, uploadDxfFile);

// Route for retrieving files associated with a specific project
router.get('/project/:projectId', getFilesByProject);

// Route for deleting a file record and its physical counterpart
router.delete('/:id', deleteFile);

// Route for updating file quantity
router.put('/:id/quantity', updateFileQuantity);

module.exports = router;
