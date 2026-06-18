# SmartNest AI - Project Architecture & System Design

This document provides a comprehensive design overview of **SmartNest AI**, a web-based CAD/CAM sheet metal nesting application.

---

## 1. Project Overview

### Purpose
SmartNest AI is a specialized CAD/CAM layout optimization application designed to automate the packing of arbitrary 2D vector shapes onto stock sheets. By optimizing spatial nesting patterns, it directly reduces raw material waste and lowers manufacturing costs in sheet metal, textile, woodworking, and leather cutting industries.

### Main Problem Solved
Raw material cost constitutes up to 70% of the cost of fabricated metal components. Standard manual nesting or sequential greedy layout generators suffer from poor layout utilization, resulting in significant material waste (offcuts). 

SmartNest AI resolves this by:
1. Converting DXF/SVG CAD geometry files into closed Clipper-compatible vector paths.
2. Grouping complex polygon contours and nested internal holes.
3. Automatically running a genetic optimization engine to iterate and identify optimal nesting sequences and rotations.
4. Enabling manual layout adjustment overlays.
5. Auto-tracking, inventorying, and recommending sheet offcuts (remnants) for reuse.
6. Generating Gemini-powered fabrication suggestions to improve cost-efficiency.

### Target Users
* **Metal Fabricators & Laser/Plasma Cutting Operators**: Who need to optimize layouts quickly to save material.
* **Manufacturing Engineers & Cost Estimators**: Who need estimates of component weights and sheet metal purchase costs.
* **Inventory Managers**: Who track sheet offcut stocks (remnants) to avoid buying new sheet stock.

---

## 2. Technology Stack

### Frontend Layer
* **Core Runtime**: React 19.2.6 (SPA template powered by Vite).
* **Styling & UI Components**: Material UI (MUI v9.1.1), styled via Emotion engines (`@emotion/react`, `@emotion/styled`).
* **Routing**: React Router DOM (v7.17.0) for workspace navigation.
* **API Client**: Axios (v1.17.0) for asynchronous HTTP requests to backend controller gateways.
* **Canvas Rendering**: Pure vector SVGs with interactive pan/zoom, hover styling, and local coordinate transforms.

### Backend Layer
* **Runtime**: Node.js v20 (CommonJS modules format).
* **Web Framework**: Express.js (v5.2.1) exposing REST API routers.
* **Multipart Uploader**: Multer (v2.1.1) for disk storage streaming of CAD/DXF files.
* **External HTTP Client**: Axios (v1.17.0) for posting conversion payloads to remote DXF-to-SVG engines.
* **XML parser**: `@xmldom/xmldom` (v0.9.10) to parse vector nodes.
* **AI Engine**: Google Gen AI SDK (`@google/genai` v2.8.0) connected to `gemini-2.5-flash` model.

### Database Layer
* **Engine**: PostgreSQL 16.
* **Node Driver**: `pg` (v8.21.0) with connection pool streaming.

### Math & Nesting Libraries
* **ClipperLib**: JavaScript port of Clipper (Vatti's clipping algorithm) for union, difference, and intersection operations.
* **Native C++ Addons**: `@deepnest/calculate-nfp` (native bindings to evaluate Minkowski Sum boundaries) and `@deepnest/svg-preprocessor` (SVG vector path segment conversion).

---

## 3. Folder Structure

```text
smartnest-ai/
├── README.md                           # Main project readme
├── RELEASE_NOTES_V1.md                 # Stable release log
├── PROJECT_ARCHITECTURE.md             # This architecture documentation
├── CODEBASE_EXPLAINED.md               # Detailed source code file reference
├── CODE_INVENTORY.md                   # List of source files and metrics
├── PROJECT_TEACHING_GUIDE.md           # Student teaching curriculum
│
├── frontend/                           # Client Application Directory
│   ├── public/                         # Public graphics assets (favicon, icons)
│   ├── src/
│   │   ├── assets/                     # Component vector graphics
│   │   ├── layouts/                    # Layout shells (DashboardLayout.jsx)
│   │   ├── pages/                      # Client views (Dashboard, Projects, Result)
│   │   ├── services/                   # Client HTTP API wrappers (api.js)
│   │   ├── App.css / index.css         # UI CSS styles
│   │   ├── App.jsx                     # Route paths declaration
│   │   └── main.jsx                    # React mount entrypoint
│   ├── package.json                    # Frontend package settings
│   └── vite.config.js                  # Vite compiler configurations
│
├── backend/                            # Server Application Directory
│   ├── src/
│   │   ├── config/                     # Database pools and migrations
│   │   ├── controllers/                # REST Controller layers
│   │   ├── routes/                     # REST Express routes
│   │   ├── services/                   # Engine, Costing, and AI services
│   │   └── uploads/projects/           # CAD storage directories
│   ├── compare_nesting.js              # Nesting benchmarks runner
│   ├── package.json                    # Backend package settings
│   ├── server.js                       # Server listener entrypoint
│   └── verify_remnant_tracking.js       # Remnant integration test script
│
└── deepnest-engine/                    # Native Engine bindings and C++ assets
```

---

## 4. High-Level Architecture & Request Flow

```text
  [ React Client Views ]
            │
            ▼ (HTTP REST Call)
     [ Express Router ]
            │
            ▼ (Controller Interceptor)
    [ Service Handler ]
     ├── DB Pools (pg) ──────────> [ PostgreSQL ]
     ├── File System (fs) ───────> [ Disk Uploads ]
     ├── Remote Converter API ───> [ deepnest.app/convert ]
     ├── Minkowski C++ Addon ────> [ calculate-nfp binary ]
     └── Gen AI SDK Client ──────> [ Google Gemini API ]
```

### Request Flow
1. **Request Reception**: React makes an Axios call (e.g. `api.startNestingJob`).
2. **Routing**: Express routes `/api/nesting/start/:projectId` to `nestingController.startNestingJob`.
3. **Validation & Initial Persistence**: Checks file queues, registers a job row in `nest_jobs` with status `pending`, and immediately responds to the client with `202 Accepted`.
4. **Asynchronous Execution**: Spawns `runNestingInBackground`, which reads files, runs the genetic optimizer loop, calculates Minkowski NFPs, and writes layout SVGs and JSON arrays to disk.
5. **Costing & Remnants Processing**: Invokes `costingService` to calculate costs, stores leftovers in `remnants`, updates the DB row status to `completed`, and returns data to the client.

---

## 5. End-to-End Workflows

### 1. DXF Upload Flow
1. **User Action**: User drags a DXF file into the queue in `ProjectDetails.jsx` and hits "Upload".
2. **Frontend Processing**: Axios sends a `multipart/form-data` payload containing the file and `project_id`.
3. **Backend Processing**: `fileController.uploadDxfFile` intercepts the request using `multer` and writes the file to `backend/src/uploads/projects/{projectId}/{filename}`.
4. **Area Calculation**: Calls `nestingService.calculateFileArea` to compute the DXF footprint area.
5. **Database Operation**: Saves a record in `uploaded_files` with `quantity = 1` and the calculated `area`.
6. **UI Update**: Frontend updates the parts list to render the new DXF file.

### 2. Manual Nest Adjustment Flow
1. **User Action**: The user enters "Manual Edit Mode" in `Result.jsx`, selects a nested part on the canvas, moves it (e.g. 10mm right), and clicks "Save Layout".
2. **Frontend Processing**: Translates the part element and calculates the coordinate offsets. Compounds rotation math to lock the part's centroid.
3. **API Call**: Sends a `PUT` request to `/api/nesting/layout/:jobId` with the updated coordinates array.
4. **Backend Processing**: `nestingController.updateLayoutPlacements` receives the coordinates, reads the database project files, and invokes `nestingService.updateLayoutFiles`.
5. **Layout Regeneration**: Reads the cached DXF SVG files, translates and rotates paths according to the new coordinates, and overwrites the physical SVG and JSON outputs on disk.
6. **Response & UI Refresh**: Returns HTTP 200, prompting the React client to reload the updated SVG preview.

---

## 6. Database Design

```text
  users
    └── projects (ON DELETE CASCADE)
          ├── uploaded_files (ON DELETE CASCADE)
          ├── remnants (ON DELETE CASCADE)
          └── nest_jobs (ON DELETE CASCADE)
```

### Table Schema Definitions

#### `users`
* `id` (SERIAL PRIMARY KEY)
* `name`, `email` (UNIQUE), `password` (VARCHAR)
* `created_at` (TIMESTAMP)

#### `projects`
* `id` (SERIAL PRIMARY KEY)
* `user_id` (INTEGER, FOREIGN KEY REFERENCES users)
* `project_name` (VARCHAR), `description` (TEXT)
* `material_type` (VARCHAR, default 'Mild Steel')
* `material_thickness` (DECIMAL, default 1.00)

#### `uploaded_files`
* `id` (SERIAL PRIMARY KEY)
* `project_id` (INTEGER, FOREIGN KEY REFERENCES projects)
* `file_name` (VARCHAR), `file_path` (TEXT)
* `quantity` (INTEGER, default 1)
* `area` (NUMERIC, default 0.00)

#### `remnants`
* `id` (SERIAL PRIMARY KEY)
* `project_id` (INTEGER, FOREIGN KEY REFERENCES projects)
* `material_type` (VARCHAR), `material_thickness` (DECIMAL)
* `sheet_width`, `sheet_height` (INTEGER)
* `utilization`, `remaining_area` (NUMERIC)
* `remaining_width`, `remaining_height` (INTEGER)
* `estimated_value` (NUMERIC), `used` (BOOLEAN, default false)

#### `nest_jobs`
* `id` (SERIAL PRIMARY KEY)
* `project_id` (INTEGER, FOREIGN KEY REFERENCES projects)
* `status` (VARCHAR, e.g. 'pending', 'completed', 'failed')
* `input_file_count`, `total_parts`, `placed_parts` (INTEGER)
* `sheet_width`, `sheet_height` (INTEGER)
* `output_file` (TEXT)
* `utilization` (NUMERIC)
* `estimated_weight`, `material_cost`, `scrap_value`, `total_estimated_cost` (NUMERIC)
* `remnant_id` (INTEGER, FOREIGN KEY REFERENCES remnants ON DELETE SET NULL)

---

## 7. API Reference Documentation

### 1. Workspace Projects
* **`POST /api/projects`**: Creates a project. Expects `{ user_id, project_name, description, materialType, materialThickness }`.
* **`GET /api/projects`**: Lists all projects.
* **`GET /api/projects/:id`**: Gets project details.
* **`PUT /api/projects/:id/material`**: Updates project material properties.

### 2. CAD File Queue
* **`POST /api/files/upload`**: Uploads a DXF file. Expects a `multipart` payload with a file and `project_id`.
* **`PUT /api/files/:id/quantity`**: Updates a file's quantity modifier.

### 3. Nesting Execution
* **`POST /api/nesting/start/:projectId`**: Triggers a nesting job. Expects `{ sheetWidth, sheetHeight, optimizationLevel, remnantId }`.
* **`GET /api/nesting/status/:jobId`**: Returns job status (`pending`, `processing`, `completed`, `failed`).
* **`GET /api/nesting/result/:jobId`**: Returns nested parts layout details and cost metrics.
* **`GET /api/nesting/layout/:jobId`**: Gets nested coordinate points array.
* **`PUT /api/nesting/layout/:jobId`**: Saves manual coordinates modifications.

### 4. Remnants Inventory
* **`GET /api/remnants`**: Lists all available remnants.
* **`GET /api/remnants/recommend/:projectId`**: Recommends remnants for a project.

### 5. AI Advisor
* **`GET /api/ai/advisor/:jobId`**: Gets Gemini-powered layout recommendations.

---

## 8. Core Flow Mechanisms

### File Upload & Caching Flow
1. Multer writes the uploaded DXF file to `backend/src/uploads/projects/{projectId}/`.
2. The system checks for a cached SVG file. If missing, it converts the DXF to SVG and caches it as `{filename}.dxf.svg` on disk.
3. Calculates and stores the part footprint area in the database.

### AI Integration Flow
1. Exposes `GET /api/ai/advisor/:jobId`, joining the `nest_jobs` and `projects` tables.
2. Formats layout utilization, cost metrics, and remnant status into a prompt.
3. Invokes the `gemini-2.5-flash` model, requesting optimization recommendations.
4. Returns the structured JSON recommendations.

### Security Configurations
* **CORS Middleware**: Configured to restrict external origins.
* **Input Sanitization**: Parses and validates numeric inputs to prevent SQL injection.
* **Path Validation**: Resolves and validates absolute paths on the server to prevent directory traversal attempts.
