# SmartNest AI - Codebase Reference Guide

This document provides a file-by-file breakdown of the core source files in **SmartNest AI**, detailing the architecture, implementation logic, and dependencies of each module.

---

## 1. Backend Server & Core Configuration

### File: `backend/server.js`

#### Purpose
Starts the backend Express server, loads environment variables, and tests the database connection.

#### Why it exists
Serves as the entrypoint for the Node.js application process, initializing configurations before listening for requests.

#### Imports
* `dotenv`: Loads configuration variables from the `.env` file into `process.env`.
* `./src/app`: Imports the configured Express application instance.
* `./src/config/database`: Imports the database pool manager and connection verification logic.

#### Functions
* **Server Initialization**: Starts the Express server listener on `PORT` (default 5000) once the database connection pool succeeds.

#### Execution Flow
```text
node server.js
  ↓
dotenv.config()
  ↓
testConnection() (Attempts SELECT NOW() query)
  ↓
app.listen() (Starts server listener)
```

#### Dependencies
* **Files Called**: [app.js](file:///e:/smartnest-ai/backend/src/app.js), [database.js](file:///e:/smartnest-ai/backend/src/config/database.js)
* **Calling Files**: Managed directly by `npm run dev` (via `nodemon`) or the production process runner.

#### Interview Questions
* **Q: Why are database connections verified before starting the Express listener?**
  * *A*: To ensure database issues are caught immediately on startup, preventing the server from running in a broken state.
* **Q: What package manages environment variables on startup?**
  * *A*: `dotenv`.

---

### File: `backend/src/app.js`

#### Purpose
Configures Express application configurations, registers global middlewares (CORS, JSON body parser), mounts static directories, and registers feature routes.

#### Why it exists
Separates HTTP endpoint routing and middleware configuration from the server startup logic, making testing easier.

#### Imports
* `express`: Web API routing framework.
* `cors`: Cross-Origin Resource Sharing middleware.
* `path`: File system path utility.
* Feature route modules: `projectRoutes`, `fileRoutes`, `nestingRoutes`, `remnantRoutes`, `aiRoutes`.

#### Routing Mounts
* `/uploads`: Mapped to static storage directory `backend/src/uploads`.
* `/api/health`: Exposes server status.
* `/api/projects`: Mapped to `projectRoutes`.
* `/api/files`: Mapped to `fileRoutes`.
* `/api/nesting`: Mapped to `nestingRoutes`.
* `/api/remnants`: Mapped to `remnantRoutes`.
* `/api/ai`: Mapped to `aiRoutes`.

#### Interview Questions
* **Q: How are generated DXF vector previews served to the client?**
  * *A*: The client accesses previews via the `/uploads` route, which Express serves as static files from the uploads directory.
* **Q: What is the purpose of CORS middleware in this file?**
  * *A*: To allow the frontend application (running on port 5173/5174) to communicate with the backend API (running on port 5000).

---

## 2. Database & Migrations

### File: `backend/src/config/database.js`

#### Purpose
Configures the PostgreSQL client pool and seeds a default user on startup.

#### Why it exists
Centralizes database connection pool configurations, reusing client connections to optimize database queries.

#### Key Methods
* `testConnection()`: Queries `SELECT NOW()` to verify the pool configuration, then inserts a default user (ID 1) if they don't exist.

#### Interview Questions
* **Q: Why use a connection pool instead of individual client connections?**
  * *A*: Reusing connections in a pool reduces connection overhead, optimizing database query performance.

---

### File: `backend/src/config/schema.sql`

#### Purpose
Defines the database schema, including tables for users, projects, uploaded files, job status records, remnants, and indexes.

#### Why it exists
Serves as the database blueprint for setting up database structures.

#### Data Models & Fields
* `users`: `id`, `name`, `email`, `password`, `created_at`.
* `projects`: `id`, `user_id`, `project_name`, `description`, `material_type`, `material_thickness`, `created_at`.
* `uploaded_files`: `id`, `project_id`, `file_name`, `file_path`, `quantity`, `area`, `uploaded_at`.
* `remnants`: `id`, `project_id`, `material_type`, `material_thickness`, `sheet_width`, `sheet_height`, `utilization`, `remaining_area`, `remaining_width`, `remaining_height`, `estimated_value`, `used`, `created_at`.
* `nest_jobs`: `id`, `project_id`, `status`, `input_file_count`, `total_parts`, `placed_parts`, `sheet_width`, `sheet_height`, `output_file`, `utilization`, `estimated_weight`, `material_cost`, `scrap_value`, `total_estimated_cost`, `created_at`, `completed_at`, `remnant_id`.

#### Interview Questions
* **Q: Why does the `uploaded_files` table cache the calculated geometry area?**
  * *A*: To avoid recalculating geometry areas during remnant recommendations and cost estimation calls.
* **Q: What happens to a project's nesting jobs and files if the project is deleted?**
  * *A*: They are cascadingly deleted from the database using foreign key `ON DELETE CASCADE` constraints.

---

## 3. Controller Handlers

### File: `backend/src/controllers/projectController.js`

#### Purpose
Handles HTTP endpoints for creating, retrieving, and updating project workspaces.

#### Why it exists
Acts as the controller layer for database-driven project CRUD operations.

#### Methods
* `createProject(req, res)`: Registers a project in the database.
* `getAllProjects(req, res)`: Returns projects sorted by creation date.
* `getProjectById(req, res)`: Gets a project by ID.
* `deleteProject(req, res)`: Deletes a project by ID.
* `updateProjectMaterial(req, res)`: Updates material settings (`material_type`, `material_thickness`).

#### Interview Questions
* **Q: How does `createProject` handle optional fields?**
  * *A*: It validates required fields (`user_id`, `project_name`), uses fallbacks for empty optional fields, and parses numbers using `parseFloat`.

---

### File: `backend/src/controllers/fileController.js`

#### Purpose
Manages CAD DXF file uploads, updates part quantities, and handles file deletions.

#### Why it exists
Validates DXF file uploads, parses part geometry areas, and updates database records.

#### Key Methods
* `uploadDxfFile(req, res)`: Handled by Multer. Validates project existence, saves the file to disk, calculates its area via the nesting service, and inserts a record in `uploaded_files`.
* `deleteFile(req, res)`: Removes the database record and deletes the physical file from disk.
* `updateFileQuantity(req, res)`: Updates the file quantity modifier in the database.

#### Interview Questions
* **Q: How does the upload endpoint handle database write failures?**
  * *A*: If the database write fails, a catch block deletes the uploaded file from disk using `fs.unlinkSync` to prevent orphaned files.

---

### File: `backend/src/controllers/nestingController.js`

#### Purpose
Coordinates nesting runs and manages endpoints for starting jobs, checking status, retrieving results, and adjusting manual layouts.

#### Why it exists
Separates API routes from the heavy genetic nesting optimization services.

#### Key Methods
* `startNestingJob(req, res)`: Creates a nesting job record in the database, sets its status to `processing`, responds with HTTP 202, and runs the nesting process in the background.
* `runNestingInBackground(...)`: Runs the nesting optimization service, calculates nesting costs, inserts generated remnants into the database, and updates the job status upon completion.
* `getNestingResult(req, res)`: Joins job details with project material configurations and returns cost estimates.
* `getLayoutPlacements(req, res)`: Reads the nested output JSON file and returns part coordinates.
* `updateLayoutPlacements(req, res)`: Receives manual placement adjustments and calls `nestingService.updateLayoutFiles` to regenerate layouts on disk.

#### Interview Questions
* **Q: Why does `startNestingJob` respond with HTTP 202 instead of 200?**
  * *A*: To immediately acknowledge request reception while nesting calculations run asynchronously in the background, preventing client connection timeouts.

---

### File: `backend/src/controllers/remnantController.js`

#### Purpose
Handles remnants inventory endpoints, recommending remnants for reuse based on sheet dimension requirements.

#### Why it exists
Queries and filters available remnants to match current project requirements.

#### Key Methods
* `getAllRemnants(req, res)`: Lists unused remnants (`used = false`) sorted by creation date.
* `recommendRemnantsForProject(req, res)`: Queries project details, calculates the total required part area, and recommends compatible remnants matching material, thickness, and area constraints (ordered by area ascending).

#### Interview Questions
* **Q: Why does the recommendation query order compatible remnants ascendingly?**
  * *A*: To recommend the smallest compatible remnant first, conserving larger sheets for other jobs.

---

### File: `backend/src/controllers/aiController.js`

#### Purpose
Exposes the AI Advisor endpoint, retrieving job details and passing them to the AI service.

#### Why it exists
Retrieves nesting job metrics and passes them to the Gemini recommendations service.

#### Key Methods
* `getAdvisorRecommendations(req, res)`: Joins layout results with material configurations and passes them to the recommendations service.

---

## 4. Service Implementations

### File: `backend/src/services/nestingService.js`

#### Purpose
Executes genetic nesting optimization loops, Clipper polygon manipulations, Minkowski NFP checks, and handles layout rendering.

#### Why it exists
Provides the core geometry processing and nesting optimization engine.

#### Key Logic & Helpers
* `prepareEnvironment()`: Sets up mock environment variables and loads native Clipper and Minkowski addon binaries.
* `groupPolygonsByHierarchy(subPolys)`: Performs Clipper unions to separate outer contours from child holes.
* `simplifyPath(path, tolerance)`: Uses Douglas-Peucker reduction to simplify part vertices.
* `rotatePolygon(polygon, degrees)`: Rotates coordinates around the local origin.
* `placeParts(sheets, parts, config, nestindex)`: Executes sequential part positioning.
* `runDeepnestNext(files, projectId, optimizationLevel, sheetWidth, sheetHeight)`: Performs genetic optimization runs, calculates utilization, and saves output SVGs and JSON files.
* `updateLayoutFiles(jobId, projectFiles, placements)`: Rebuilds layout files on disk based on manual coordinate adjustments.

#### Interview Questions
* **Q: How does the nesting engine handle holes inside a part?**
  * *A*: The system categorizes polygons as outer boundaries (CCW) or holes (CW), applying the evenodd fill rule to render holes correctly on the canvas.

---

### File: `backend/src/services/costingService.js`

#### Purpose
Calculates fabrication costs based on nested weights, raw material rates, and scrap recovery values.

#### Why it exists
Centralizes costing calculations for nested parts and material waste.

#### Key Methods
* `calculateCost(materialType, thicknessMm, sheetWidthMm, sheetHeightMm, utilizationPercent)`: Calculates material volume, weights, costs, and scrap recovery values using density tables.

---

### File: `backend/src/services/aiService.js`

#### Purpose
Generates manufacturing recommendations by passing nesting metrics to Gemini.

#### Why it exists
Encapsulates Gemini API configurations and schema validations.

#### Key Methods
* `getManufacturingRecommendations(jobData, remnantData, inputRemnantData)`: Formats metrics into a prompt and calls `gemini-2.5-flash` with response schema configurations.

---

## 5. Frontend Routes & Canvas Views

### File: `frontend/src/pages/Result.jsx`

#### Purpose
Renders nesting results, providing an interactive canvas with pan, zoom, custom highlights, and manual placement controls.

#### Why it exists
Enables real-time layout visualization and manual placement adjustments.

#### Key Controls & Handlers
* **Centroid Lock Rotation Math**:
  $$\Delta x = cx - x, \quad \Delta y = cy - y$$
  $$cx_0 = \Delta x \cos(-\theta) - \Delta y \sin(-\theta)$$
  $$cy_0 = \Delta x \sin(-\theta) + \Delta y \cos(-\theta)$$
  $$x' = cx - (cx_0 \cos\theta' - cy_0 \sin\theta')$$
  $$y' = cy - (cx_0 \sin\theta' + cy_0 \cos\theta')$$
* **Manual Nest Editor**: Moves parts in 10mm steps and rotates them in $90^\circ$ steps.
* **Canvas Interactivity**: Supports mouse drags for panning and mouse wheel actions for zooming.

#### Interview Questions
* **Q: Why do manual rotations require translation corrections?**
  * *A*: Because the backend rotates parts around the local origin `(0, 0)`. The frontend applies translation adjustments to ensure parts rotate around their visual center.
