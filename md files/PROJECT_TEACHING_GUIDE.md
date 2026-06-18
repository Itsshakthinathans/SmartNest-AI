# SmartNest AI - Project Teaching Guide & Learning Curriculum

This document serves as an educational guide and reference handbook for learning and teaching the **SmartNest AI** project.

---

## 1. Beginner Level

### Project Overview
SmartNest AI is a specialized CAD/CAM software tool that optimizes the arrangement (nesting) of 2D parts on a rectangular stock sheet. 

Its primary goal is to pack parts tightly to maximize sheet utilization, reducing material waste in manufacturing processes (like laser cutting, stamping, or plasma cutting).

### Basic Operational Workflow
1. **Create Project**: Start a project container and select material settings (e.g. Mild Steel, 2.0 mm).
2. **Upload CAD Files**: Upload `.dxf` CAD drawing files representing individual parts.
3. **Configure Settings**: Select the target stock sheet size (e.g. $1000 \times 1000\text{ mm}$) and set quantities.
4. **Trigger Nesting**: Click **Generate Nest** to calculate the optimal layout.
5. **View & Adjust Results**: View the generated layout, make manual layout adjustments if needed, and save.
6. **AI Insights**: Review the AI Advisor's recommendations on utilization and cost savings.

---

## 2. Intermediate Level

### Architectural Flows

#### 1. Frontend Flow (React SPA)
The client application is built with React and Vite. It uses Material UI (MUI) components for page layouts. 

The application state is managed using standard React hooks (`useState`, `useEffect`, `useRef`). 

The interactive canvas uses vector SVGs to render parts, allowing users to zoom and pan the sheet layout.

#### 2. Backend Flow (Express Router-Controller-Service)
The server runs on Express.js. Requests are routed through routers to controller layers, which validate inputs. 

Controllers call service helpers (e.g. `nestingService` or `costingService`) for business logic and database queries. 

Heavy nesting runs are executed asynchronously in the background to avoid blocking the Express request thread.

#### 3. API Transaction Flow (REST Client)
The frontend uses Axios to make API calls to the server (e.g. `POST /api/projects`). 

The server validates inputs and responds with standardized JSON envelopes (e.g. `{ success: true, data: {...} }`).

#### 4. Database Persistence Flow (PostgreSQL)
A PostgreSQL connection pool manages reusable client connections. 

Migration scripts automatically seed database tables (projects, files, nest jobs, remnants) and default users on startup.

---

## 3. Advanced Level

### Key Design Decisions & Optimization Algorithms

#### 1. Headless C++ Native Addons
To bypass desktop dependencies (like Electron or heavy window systems), the nesting engine loads native C++ Clipper and Minkowski sum binaries (`@deepnest/calculate-nfp`) directly in Node.js. 

This enables fast, server-side nesting calculations.

#### 2. Path Simplification Algorithm (Douglas-Peucker)
Complex CAD geometries with thousands of coordinates can slow down nesting runs. 

The nesting service uses a radial distance Douglas-Peucker path simplification function to reduce vertex counts, reducing calculation times by up to $100\times$.

#### 3. Centroid-Locked Coordinate Transforms
To rotate parts manually on the frontend without moving their visual center, the app translates coordinates to align with the local origin `(0, 0)`, applies the rotation, and applies compensation offsets to keep the visual center locked.

#### 4. Automatic Remnant Harvesting
The nesting service calculates the maximum coordinates of placed parts. 

Any unused area on the sheet is saved as a reusable remnant (offcut) in the database, recommending it for future projects matching the same material and thickness constraints.

---

## 4. Source Code Learning Order

For developers learning the codebase from scratch, read the files in the following order:

```text
[Data Schemas]   schema.sql ──> database.js ──> migrate.js
                      │
[Backend APIs]   projectController.js ──> fileController.js ──> remnantController.js
                      │
[Nesting Engine] nestingController.js ──> nestingService.js ──> costingService.js
                      │
[Client App]     api.js ──> main.jsx ──> App.jsx ──> ProjectDetails.jsx ──> Result.jsx
```

---

## 5. Viva / Interview Questions & Answers

### Q: Why does nesting require Minkowski Sums?
* **A**: The Minkowski Sum of two shapes calculates their No-Fit Polygon (NFP). This polygon defines the boundary of valid, non-overlapping placement positions, simplifying complex collision detection into simple boundary checks.

### Q: What is the genetic algorithm's role in layout optimization?
* **A**: It iterates through different parts nesting sequences and rotations over multiple generations, using crossover and mutation operators to find layouts with optimal material utilization.

### Q: How does the system ensure DXF files are converted quickly?
* **A**: The system caches converted DXF files as SVG files locally. Subsequent nesting runs load the cached SVG files instantly, bypassing repeated external converter API calls.

### Q: How is the remnant estimated recovery value calculated?
* **A**: The costing service calculates the remnant's volume, multiplies it by the material density to find weight, and multiplies the weight by the material's scrap value rate.

### Q: How does the backend process nesting runs without blocking APIs?
* **A**: The Express controller inserts a job record with status `processing`, immediately returns HTTP 202 to the client, and executes the nesting process asynchronously in the background.

---

## 6. Project Presentation Guidelines

### 10-Minute Faculty Explanation
1. **Introduction (1 min)**: Explain the material waste problem in sheet metal fabrication and introduce SmartNest AI.
2. **Architecture (2 mins)**: Explain the layered React-Express-PostgreSQL architecture and the C++ geometry libraries.
3. **Core Features (3 mins)**: Show DXF uploads, genetic nesting optimization, manual layout adjustments, and remnant tracking/reuse.
4. **Nesting Math (2 mins)**: Explain ClipperLib path unions, Minkowski sum NFPs, and centroid-locked manual rotation transforms.
5. **AI Integration & Costing (1 min)**: Show the AI Advisor's recommendations and fabrication cost estimation metrics.
6. **Q&A (1 min)**: Focus answers on calculation speed improvements and CAD hierarchy grouping.

### 2-Minute Placement Interview Pitch
> "I built SmartNest AI, a web-based CAD/CAM sheet metal nesting application that optimizes part layout to minimize material waste. It uses a Node.js API backend connected to native C++ Minkowski Sum and Clipper libraries to calculate part layout coordinates. 
>
> Features include genetic nesting algorithms, manual layout adjustments with centroid-locked rotation math, and an automated remnant tracking system that saves and recommends sheet offcuts. 
>
> It also integrates Google Gemini to analyze layout results and provide manufacturing recommendations. Vite, Express, and PostgreSQL were used to build the complete stack."
