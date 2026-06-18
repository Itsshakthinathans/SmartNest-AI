# Transactional Execution Flows

This document details the step-by-step transaction paths across the database and application layers.

## A) Create Project Flow
1. **Frontend View**: User fills out project settings in `Projects.jsx` and submits.
2. **API Call**: `api.createProject` sends a POST request containing project metrics.
3. **Router**: `projectRoutes.js` matches the request and forwards it to `projectController.createProject`.
4. **Database Query**: Inserts the project record into the `projects` table.
5. **Response**: Returns the saved project data, prompting the React client to update the workspace list.

## B) Upload DXF Flow
1. **Frontend View**: User uploads a file in `ProjectDetails.jsx`.
2. **Multipart Upload Handler**: `fileRoutes.js` intercept the request using Multer, writing the raw DXF file to the uploads directory.
3. **Controller Handling**: `fileController.uploadDxfFile` queries project details, calculates the DXF footprint area, and registers the file in the `uploaded_files` table.
4. **Response**: Returns the uploaded file record, prompting the frontend to update the parts queue list.

## C) Run Nesting Flow
1. **Frontend View**: The user configures sheet dimensions and optimization settings, then clicks "Generate Nest".
2. **API Call**: Invokes `api.startNestingJob`, passing configuration parameters.
3. **Router**: `nestingRoutes.js` routes the request to `nestingController.startNestingJob`.
4. **Queue Dispatch**: Inserts a job record into `nest_jobs` (status: processing) and returns an immediate HTTP 202 status.
5. **Background execution**: `runNestingInBackground` triggers `nestingService.runDeepnestNext`.
6. **Layout Processing**:
   * Reads raw DXF or cached SVG file.
   * Simplifies vector path geometries and groupings.
   * Runs the genetic optimization loop to identify layout locations.
   * Writes `nested_output.svg` and `nested_output.json` to disk.
7. **Costing & Remnants**: Invokes `costingService`, saves leftovers in `remnants`, updates the job status to `completed`, and returns the results to the client.
