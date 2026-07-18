/**
 * SmartNest AI - Machine Controller Profiles Configuration
 * Defines target controller specifications, custom G-Code command overrides,
 * extensions, and capability metadata.
 */

const MACHINE_PROFILES = {
  generic: {
    key: 'generic',
    name: 'Generic RS-274',
    toolOnCommand: 'M03',
    toolOffCommand: 'M05',
    unitsCommand: 'G21', // Metric (mm)
    coordModeCommand: 'G90', // Absolute
    programEndCommand: 'M30',
    extension: 'gcode',
    description: 'Generic machine-independent G-code.',
    recommendedUsage: 'Recommended for NCViewer simulation and general CNC compatibility.',
    capabilities: {
      supportsPWM: false,
      supportsArcs: false,
      supportsPathBlending: false
    },
    parameters: {}
  },
  grbl: {
    key: 'grbl',
    name: 'GRBL Laser',
    toolOnCommand: 'M04', // Dynamic power mode
    toolOffCommand: 'M05',
    unitsCommand: 'G21',
    coordModeCommand: 'G90',
    programEndCommand: 'M30',
    extension: 'gcode',
    description: 'GRBL controller dynamic power G-code.',
    recommendedUsage: 'Generates G-Code compatible with GRBL-based laser controllers.',
    capabilities: {
      supportsPWM: true,
      supportsArcs: true,
      supportsPathBlending: false
    },
    parameters: {
      laserPower: 1000 // default max laser power (S1000)
    }
  },
  linuxcnc: {
    key: 'linuxcnc',
    name: 'LinuxCNC',
    toolOnCommand: 'M03',
    toolOffCommand: 'M05',
    unitsCommand: 'G21',
    coordModeCommand: 'G90',
    programEndCommand: 'M30',
    extension: 'ngc',
    description: 'LinuxCNC controller standard G-code.',
    recommendedUsage: 'Generates G-Code compatible with LinuxCNC routers and mills.',
    capabilities: {
      supportsPWM: false,
      supportsArcs: true,
      supportsPathBlending: true
    },
    parameters: {
      pathBlendingTolerance: 0.1 // G64 P0.1
    }
  },
  mach3: {
    key: 'mach3',
    name: 'Mach3',
    toolOnCommand: 'M03',
    toolOffCommand: 'M05',
    unitsCommand: 'G21',
    coordModeCommand: 'G90',
    programEndCommand: 'M30',
    extension: 'tap',
    description: 'Mach3 controller standard G-code.',
    recommendedUsage: 'Generates G-Code compatible with Mach3-based systems.',
    capabilities: {
      supportsPWM: false,
      supportsArcs: true,
      supportsPathBlending: true
    },
    parameters: {
      constantVelocityMode: true // G64
    }
  }
};

module.exports = { MACHINE_PROFILES };
