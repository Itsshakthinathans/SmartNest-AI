# Deepnest Core Geometry Operations

This document details the Clipper path operations and Minkowski NFP calculations used in the application.

## 1. Native C++ Minkowski Sum Bindings (`@deepnest/calculate-nfp`)
* Native C++ bindings are compiled using node-gyp (`addon.cc`, `minkowski.cc`, `minkowski.h`).
* Runs Minkowski sum calculations to find collision boundaries, allowing the service to determine valid placement coordinates for parts:
  `const addon = require('@deepnest/calculate-nfp');`
  `nfp = addon.calculateNFP({ A: A, B: B });`

## 2. ClipperLib Polygon Path Operations
* **Clipper Unions**: ClipperLib executes boolean path unions, grouping vectors to identify outer paths and internal holes.
* **Overlap Detection**: Calculates intersection areas between polygons:
  `clipper.AddPath(polygonA, ClipperLib.PolyType.ptSubject, true);`
  `clipper.AddPath(polygonB, ClipperLib.PolyType.ptClip, true);`
  `clipper.Execute(ClipperLib.ClipType.ctIntersection, intersection);`

## 3. Placement Logic & Bounding Boxes
* Iteratively positions shapes on the sheet using gravity or bounding box calculations.
* Runs coordinate translation checks to ensure parts are placed inside sheet boundaries without overlaps.

## 4. Layout Rendering
* Integrates coordinate placements and templates into a unified XML string:
  `let svgContent = '<svg ...><rect ... />...<path d="..." fill-rule="evenodd" /></svg>';`
* Writes output layout vectors directly to the filesystem.
