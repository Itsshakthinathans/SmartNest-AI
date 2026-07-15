// Configurable Manufacturing Optimization Profiles Weight Matrices
const PROFILES = {
  standard: {
    name: 'Standard (Baseline)',
    weights: {
      heat: 0.0,
      travel: 0.0,
      continuity: 0.0,
      time: 0.0
    }
  },
  heatBalanced: {
    name: 'Heat Balanced',
    weights: {
      heat: 2.0,       // Dominant thermal factor
      travel: 0.02,    // Extremely low travel index allows jumping across the sheet
      continuity: 0.1,
      time: 0.0
    }
  },
  travelOptimized: {
    name: 'Travel Optimized',
    weights: {
      heat: 0.0,
      travel: 2.0,     // Strictly prioritize nearest-neighbor distance
      continuity: 0.0,
      time: 0.0
    }
  },
  qualityOptimized: {
    name: 'Quality Optimized',
    weights: {
      heat: 0.7,
      travel: 0.6,
      continuity: 1.0,  // Balance travel, heat, and gantry continuity
      time: 0.2
    }
  },
  productionOptimized: {
    name: 'Production Optimized',
    weights: {
      heat: 0.05,
      travel: 0.2,
      continuity: 0.1,
      time: 2.0         // Highly focused on feed speeds and pierce times
    }
  }
};

function getProfileWeights(profileKey) {
  const profile = PROFILES[profileKey];
  if (profile) return profile.weights;
  return PROFILES.standard.weights; // Default fallback
}

module.exports = {
  PROFILES,
  getProfileWeights
};
