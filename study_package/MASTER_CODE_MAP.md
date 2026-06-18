# SmartNest AI - Master Code Map

This document lists all source files, their purpose, exports, functions, call relationships, and execution roles.

## Core Backend Files

### File: backend/server.js
* **Purpose**: Application starter entrypoint. Runs Express and tests pool connectivity.
* **Called By**: Process runners.
* **Calls**: `backend/src/app.js`, `backend/src/config/database.js`
* **Key Functions**: Server initialization wrapper.

### File: backend/src/app.js
* **Purpose**: Configures global middleware (CORS, body parser, static folders) and mounts route handlers.
* **Called By**: `backend/server.js`
* **Calls**: Route definitions (`projectRoutes`, `fileRoutes`, `nestingRoutes`, `remnantRoutes`, `aiRoutes`).

### File: backend/src/config/database.js
* **Purpose**: Manages Postgres pool client and seeds default user ID 1.
* **Called By**: `backend/server.js`, `backend/src/config/migrate.js`
* **Key Functions**: `testConnection()`

### File: backend/src/controllers/projectController.js
* **Purpose**: Handles workspaces/project configurations updates and queries.
* **Called By**: `backend/src/routes/projectRoutes.js`
* **Key Functions**: `createProject`, `getAllProjects`, `getProjectById`, `deleteProject`, `updateProjectMaterial`

### File: backend/src/controllers/fileController.js
* **Purpose**: Process file uploads, quantitive counts modifiers, and database registrations.
* **Called By**: `backend/src/routes/fileRoutes.js`
* **Key Functions**: `uploadDxfFile`, `getFilesByProject`, `deleteFile`, `updateFileQuantity`

### File: backend/src/controllers/nestingController.js
* **Purpose**: Schedules optimization jobs, tracks status, and saves manually adjusted layout positions.
* **Called By**: `backend/src/routes/nestingRoutes.js`
* **Key Functions**: `startNestingJob`, `runNestingInBackground`, `getNestingResult`, `getLayoutPlacements`, `updateLayoutPlacements`

### File: backend/src/controllers/remnantController.js
* **Purpose**: Inventory search and matching engine recommendations logic.
* **Called By**: `backend/src/routes/remnantRoutes.js`
* **Key Functions**: `getAllRemnants`, `recommendRemnantsForProject`

### File: backend/src/controllers/aiController.js
* **Purpose**: Prepares prompts and formats nesting metrics for the AI Advisor.
* **Called By**: `backend/src/routes/aiRoutes.js`
* **Key Functions**: `getAdvisorRecommendations`

### File: backend/src/services/nestingService.js
* **Purpose**: Structural math optimizer. Handles path simplify checks, containment Clipper trees, and Genetic algorithms.
* **Called By**: `backend/src/controllers/nestingController.js`, `backend/src/controllers/fileController.js`
* **Key Functions**: `runDeepnestNext`, `calculateFileArea`, `updateLayoutFiles`, `placeParts`

### File: backend/src/services/costingService.js
* **Purpose**: Performs costing calculations based on volume, weight, and rates.
* **Called By**: `backend/src/controllers/nestingController.js`
* **Key Functions**: `calculateCost`

### File: backend/src/services/aiService.js
* **Purpose**: GenAI API connector. Returns recommendations tailored to metrics.
* **Called By**: `backend/src/controllers/aiController.js`
* **Key Functions**: `getManufacturingRecommendations`

---

## Core Frontend Files

### File: frontend/src/services/api.js
* **Purpose**: Handles client HTTP calls using Axios configurations.
* **Called By**: Frontend React views.
* **Key Functions**: Project operations, upload triggers, nesting execution, remnant matches, and AI Advisor queries.

### File: frontend/src/pages/Result.jsx
* **Purpose**: Displays nesting results on an SVG canvas, supporting manual translation (10mm) and rotation (90° steps).
* **Called By**: Routed inside `App.jsx`.
* **Key Functions**: `handleRotatePart`, `handleTranslatePart`, `handleSaveLayout`, canvas zoom/pan.
