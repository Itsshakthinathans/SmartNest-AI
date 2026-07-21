const express = require('express');
const cors = require('cors');
const path = require('path');
const projectRoutes = require('./routes/projectRoutes');
const fileRoutes = require('./routes/fileRoutes');
const nestingRoutes = require('./routes/nestingRoutes');
const remnantRoutes = require('./routes/remnantRoutes');
const aiRoutes = require('./routes/aiRoutes');
const exportRoutes = require('./routes/exportRoutes');
const copilotRoutes = require('./routes/copilotRoutes');
const sheetRoutes = require('./routes/sheetRoutes');
const studioRoutes = require('./routes/studioRoutes');
const guideRoutes = require('./routes/guideRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Request logger middleware for tracing execution in backend CMD
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

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
app.use('/api/copilot', copilotRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/guide', guideRoutes);

module.exports = app;
