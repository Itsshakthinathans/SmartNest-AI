export const GUIDE_PHASES = {
  project_planning: {
    key: 'project_planning',
    title: 'Project Planning',
    route: '/projects',
    steps: [
      {
        targetId: 'projects-list-container',
        title: 'Manufacturing Campaign',
        content: 'Welcome to the SmartNest Guide! Today, we are setting up a manufacturing run for our customer, AeroTech Components. The objective is to nest 5 custom brackets on Mild Steel (1.0mm thickness) to maximize material yield.',
        actionType: 'read'
      },
      {
        targetId: 'guide-project-card-manage',
        title: 'Launch Walkthrough Workspace',
        content: 'Click the "Manage" button on the [Guide] Demo Workspace card to inspect the components and set up our queue.',
        actionType: 'click',
        expectedRoute: '/projects/:id'
      }
    ]
  },
  cad_import: {
    key: 'cad_import',
    title: 'CAD Import & Geometry',
    route: '/projects/:id',
    steps: [
      {
        targetId: 'dxf-parts-queue',
        title: 'CAD Geometry Extraction',
        content: 'SmartNest converted the CAD drawings into manufacturing-ready geometry. The outer boundaries and internal cutout loops have been resolved.',
        actionType: 'read'
      },
      {
        targetId: 'dxf-parts-queue',
        title: 'Production Quantities',
        content: 'Notice the quantities pre-set in our queue: 2 L-brackets and 1 of each of the other parts, making a total production run of 6 parts.',
        actionType: 'read'
      },
      {
        targetId: 'next-step-btn',
        title: 'Proceed to Planning',
        content: 'Click the "Next" button in the Project Card to configure raw stock and verify sheet capacity.',
        actionType: 'click',
        expectedRoute: '/projects/:id/review'
      }
    ]
  },
  material_planning: {
    key: 'material_planning',
    title: 'Material Planning',
    route: '/projects/:id/review',
    steps: [
      {
        targetId: 'preset-size-select',
        title: 'Define Raw Stock Sheet',
        content: 'Here we define the stock boundary. We are using a single standard 1000mm x 1000mm Mild Steel plate as our raw sheet material.',
        actionType: 'read'
      },
      {
        targetId: 'suitability-check-card',
        title: 'Pre-Nest Suitability check',
        content: 'SmartNest ran a pre-nest suitability check. Based on the parts, it estimates a high utilization yield (82%), ensuring the components will fit comfortably on a single sheet.',
        actionType: 'read'
      },
      {
        targetId: 'optimization-level-select',
        title: 'Optimization Strategy',
        content: 'SmartNest supports multiple optimization levels:\n\n• Greedy – Fastest execution. Best for walkthroughs and quick layouts.\n• 10 Generations – Recommended balance between runtime and layout quality.\n• 50 Generations – Better optimization with additional runtime.\n• 200 Generations – Maximum optimization quality with the longest runtime.\n\nToday, we use Greedy to ensure our job completes in seconds for a fast shop walkthrough.',
        actionType: 'read'
      },
      {
        targetId: 'generate-nest-btn',
        title: 'Start Optimization',
        content: 'Click the "Generate Nest" button to trigger the nesting solver and compute the nested arrangement.',
        actionType: 'click'
      }
    ]
  },
  nesting_optimization: {
    key: 'nesting_optimization',
    title: 'Nesting Optimization',
    route: '/results/:jobId/processing',
    steps: [
      {
        targetId: 'processing-live-canvas',
        title: 'Density Calculation',
        content: 'SmartNest optimized the layout using the selected Greedy optimization level. Watch as parts are arranged closely to minimize material scrap.',
        actionType: 'read'
      },
      {
        targetId: 'processing-pipeline-list',
        title: 'Nesting Solver Run',
        content: 'The background thread runs conversions, weld tests, and packing strategies. Let\'s wait for the calculations to complete.',
        actionType: 'read'
      }
    ]
  },
  result_analysis: {
    key: 'result_analysis',
    title: 'Result Analysis',
    route: '/results/:jobId',
    steps: [
      {
        targetId: 'layout-tabs',
        title: 'Compare Strategies',
        content: 'SmartNest calculated 3 layouts concurrently. Toggle between Layout 1 (Compact), Layout 2 (Vertical), and Layout 3 (Horizontal) to choose the best net yield.',
        actionType: 'read'
      },
      {
        targetId: 'ai-advisor-panel',
        title: 'AI Yield Evaluation',
        content: 'The AI Manufacturing Advisor analyzes efficiency, calculates Mild Steel material costs, and estimates savings from scrap recovery.',
        actionType: 'read'
      },
      {
        targetId: 'cam-studio-btn',
        title: 'Open Manufacturing Studio',
        content: 'Click "Manufacturing Studio" to generate toolpaths and sequence cutter movements.',
        actionType: 'click',
        expectedRoute: '/results/:jobId/studio'
      }
    ]
  },
  manufacturing_studio: {
    key: 'manufacturing_studio',
    title: 'Manufacturing Studio',
    route: '/results/:jobId/studio',
    steps: [
      {
        targetId: 'sim-play-control',
        title: 'Verify Cut Sequence',
        content: 'Before exporting, we run a preview. Click the "Play" button to simulate the laser head cutting paths.',
        actionType: 'click'
      },
      {
        targetId: 'studio-canvas-view',
        title: 'Toolpath Visualization',
        content: 'Observe the vectors: red paths denote rapid travel moves, blue represents lead-in/out cuts, and green highlights final geometries. SmartNest sequences travel paths to minimize cycle time.',
        actionType: 'read'
      },
      {
        targetId: 'studio-metrics-panel',
        title: 'Edge & Cut Optimizations',
        content: 'Toggle optimizations like Common Line Cutting (CLC) to merge shared edges, reducing cut lengths, and Pierce minimization to prevent cutting head wear.',
        actionType: 'read'
      }
    ]
  },
  gcode_generation: {
    key: 'gcode_generation',
    title: 'G-Code Generation',
    route: '/results/:jobId/studio',
    steps: [
      {
        targetId: 'target-controller-select',
        title: 'Machine Controller Profile',
        content: 'Select the target controller profile (e.g. GRBL, Mach3, LinuxCNC). This formats coordinates into your machine\'s dialect.',
        actionType: 'read'
      },
      {
        targetId: 'download-gcode-btn',
        title: 'Download Cutting Program',
        content: 'Click "Download G-Code" to export the machine-ready RS-274 program file. The AeroTech Components production run is complete!',
        actionType: 'click'
      }
    ]
  }
};
