# SmartNest AI - Codebase File Inventory

This document lists all application source files in **SmartNest AI**, including their type, approximate line count, purpose, key components, and dependencies.

---

## 1. Backend Codebase Inventory

| File Path | File Type | Approx. Lines | Purpose | Key Functions / Classes | Local Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/server.js` | JS Entrypoint | 20 | Starts server listener. | `app.listen` | `src/app.js`, `src/config/database.js` |
| `backend/src/app.js` | Express Router | 30 | Configures Express server. | Express settings | Routing features |
| `backend/src/config/database.js` | Postgres Config | 40 | Database client pool setup. | `testConnection` | `pg` package |
| `backend/src/config/schema.sql` | SQL Schema | 90 | Database schema definitions. | Table definitions | PostgreSQL |
| `backend/src/config/migrate.js` | Migration script | 45 | Runs migrations on startup. | Schema migration logic | `database.js` |
| `backend/src/controllers/projectController.js` | Controller | 225 | Workspace project CRUD operations. | `createProject`, `getAllProjects` | `database.js` |
| `backend/src/controllers/fileController.js` | Controller | 250 | File uploads and quantities. | `uploadDxfFile`, `deleteFile` | `database.js`, `nestingService.js` |
| `backend/src/controllers/nestingController.js` | Controller | 375 | Coordinates nesting jobs. | `startNestingJob`, `runNestingInBackground` | `database.js`, `nestingService.js`, `costingService.js` |
| `backend/src/controllers/remnantController.js` | Controller | 95 | Manages remnants inventory. | `getAllRemnants`, `recommendRemnants` | `database.js` |
| `backend/src/controllers/aiController.js` | Controller | 90 | Handles AI recommendations. | `getAdvisorRecommendations` | `database.js`, `aiService.js` |
| `backend/src/services/nestingService.js` | Engine Service | 1440 | Runs genetic nesting optimizations. | `runDeepnestNext`, `updateLayoutFiles` | `database.js`, `ClipperLib` |
| `backend/src/services/costingService.js` | Costing Service | 60 | Calculates fabrication costs. | `calculateCost` | `MATERIAL_MASTER` |
| `backend/src/services/aiService.js` | AI Service | 80 | Connects to Google Gemini API. | `getManufacturingRecommendations` | `@google/genai` |

---

## 2. Frontend Codebase Inventory

| File Path | File Type | Approx. Lines | Purpose | Key Components | Local Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/main.jsx` | React Mount | 12 | React mounting node entrypoint. | `ReactDOM.createRoot` | `App.jsx`, `index.css` |
| `frontend/src/App.jsx` | React Router | 30 | Defines application route paths. | Route map | Layout shells, client views |
| `frontend/src/layouts/DashboardLayout.jsx` | Dashboard shell | 80 | View wrapper with navigation sidebar. | `DashboardLayout` | MUI components |
| `frontend/src/pages/Dashboard.jsx` | Client Page | 100 | General metrics overview dashboard. | `Dashboard` | `api.js` |
| `frontend/src/pages/Projects.jsx` | Client Page | 210 | Lists all projects. | `Projects` | `api.js` |
| `frontend/src/pages/ProjectDetails.jsx` | Client Page | 450 | Manages project parts queue and stock settings. | `ProjectDetails` | `api.js` |
| `frontend/src/pages/Remnants.jsx` | Client Page | 180 | Lists unused remnants in inventory. | `Remnants` | `api.js` |
| `frontend/src/pages/Result.jsx` | Client Page | 1180 | Interactive nesting results canvas. | `Result` | `api.js`, dynamic transform formulas |
| `frontend/src/services/api.js` | API Gateway | 120 | Client HTTP client endpoints client. | API definitions wrapper | `axios` package |

---

## 3. Test & Optimization Scripts Inventory

| File Path | File Type | Approx. Lines | Purpose | Key Logic | Local Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/compare_nesting.js` | Benchmark Runner | 150 | Compares Greedy vs Genetic nesting. | Optimizations benchmark | `nestingService.js` |
| `backend/verify_remnant_tracking.js` | Integration test | 290 | Verifies remnants are auto-created. | E2E integration verification | `app.js`, `database.js` |
| `backend/test_nesting_api.js` | API validator | 180 | Verifies core nesting endpoints. | Test validations | `app.js` |
