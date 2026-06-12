# SmartNest AI - Version 1.0 Stable Release Notes

Welcome to the stable release of **SmartNest AI v1.0**—an industrial-grade CAD/CAM nesting web application that optimizes sheet material layouts, manages offcut inventory remnants, estimates fabrication costs, and provides intelligent manufacturing advice.

---

## 🚀 Key Features and Modules

### 1. CAD DXF Geometry Upload
* High-performance, client-side vector renderer.
* Headless parser that converts CAD drawings (.dxf) to clean SVG contours, checking boundaries and extracting geometric loops.

### 2. Genetic Nesting Engine
* Native C++ Minkowski Sum and No-Fit-Polygon (NFP) collision checks.
* Genetic algorithm sequence mutations and crossovers (mutating sequence, rotation angles, and nesting order) with configurable optimization levels:
  * **Greedy**: Fast single-pass layout calculation.
  * **Genetic Fast**: 10 generations of layout tight-packing.
  * **Genetic Balanced**: 50 generations.
  * **Genetic Maximum**: 200 generations.
* Optimized NFP bounding evaluations that handle complex artwork geometries without hanging or timing out.

### 3. Dynamic Quantity Management
* Support for assigning part quantities directly in the project workspace queue.
* Physical headless replication of DXF geometries prior to nesting, treating each copy as a unique placable polygon in the layout.

### 4. Custom Sheet Size Selection
* Flexible sheet stock templates ($1000 \times 1000\text{ mm}$, $2000 \times 1000\text{ mm}$, $3000 \times 1500\text{ mm}$).
* Custom width and height numeric override inputs to accommodate custom metal plate dimensions.

### 5. Material Management
* Support for setting material types (Mild Steel, Stainless Steel 304, Aluminium, Copper, Brass) and decimal thicknesses (mm).
* Integrates material parameters throughout the nesting pipeline for weight and AI calculations.

### 6. Cost Estimation V1
* Automatic calculation of sheet area, volume, and material weight based on thickness and physical density (e.g., $7,850\text{ kg/m}^3$ for Mild Steel).
* Realistic cost summaries:
  * **Material Cost**: Weight of sheet $\times$ raw price rate.
  * **Scrap Recovery Value**: Waste area weight $\times$ scrap rate.
  * **Total Net Cost**: Material Cost minus Scrap Recovery Value.

### 7. Remnant Tracking V1
* Automated creation of rectangular offcuts after nesting runs, measuring `remainingWidth = sheetWidth - maxX` and `remainingHeight = sheetHeight`.
* Calculates recovery value of remnants and lists leftovers in the global Remnants Stock inventory dashboard.
* Recommends matching remnants for other projects of matching material, thickness, and footprint requirements.

### 8. Remnant Reuse V1
* **"Use Remnant"** button in the recommended remnant queue of projects.
* Selects the remnant sheet, locks and grays out template inputs, and overrides nesting dimensions.
* Automatically flags the remnant as `used = true` when nesting succeeds, preventing double-consumption, while generating a new secondary remnant from the leftover area.

### 9. AI Manufacturing Advisor V1
* Powered by Google Gemini (`gemini-2.5-flash`) via the official `@google/genai` SDK.
* Provides structured recommendations focused on:
  * Utilization improvement suggestions.
  * Sheet size templates and stock matching.
  * Remnant inventory integration.
  * Structural material cost and waste reduction.
* Displays a dedicated **AI Manufacturing Advisor** card on results pages showing executive summary, advice points, and estimated savings.

---

## 🛠️ Verification & Build Status

* **Frontend Build**: Verified successfully via `npm run build` using Vite. Output chunks compiled cleanly.
* **Backend Dev Status**: Active, verified PostgreSQL connection and automatic seeding schema migrations.
* **Integration Tests**: Programmatic E2E validation scripts (`verify_remnant_reuse.js`, `verify_ai_advisor.js`) successfully completed runs asserting correct remnant consumption state mutations and structured Gemini API parsing.
