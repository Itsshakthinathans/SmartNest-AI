const express = require('express');
const cors = require('cors');
const path = require('path');
const projectRoutes = require('./routes/projectRoutes');
const fileRoutes = require('./routes/fileRoutes');
const nestingRoutes = require('./routes/nestingRoutes');
const remnantRoutes = require('./routes/remnantRoutes');
const aiRoutes = require('./routes/aiRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'SmartNest AI Backend Running'
    });
});

app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/nesting', nestingRoutes);
app.use('/api/remnants', remnantRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/export', exportRoutes);

module.exports = app;
