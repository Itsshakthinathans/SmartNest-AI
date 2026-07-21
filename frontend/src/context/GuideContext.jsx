import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { GUIDE_PHASES } from '../config/guideDefinition';

const GuideContext = createContext();

export const GuideProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Load state helper
  const getSavedState = () => {
    const saved = localStorage.getItem('smartnest_guide_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Failed to parse guide state from localStorage:', err);
        return {};
      }
    }
    return {};
  };

  const saved = getSavedState();
  
  // State Initialization
  const [activePhase, setActivePhase] = useState(saved.activePhase || null);
  const [currentStep, setCurrentStep] = useState(saved.currentStep !== undefined ? saved.currentStep : 0);
  const [guideProjectId, setGuideProjectId] = useState(saved.guideProjectId || null);
  const [guideJobId, setGuideJobId] = useState(saved.guideJobId || null);
  const [completedPhases, setCompletedPhases] = useState(saved.completedPhases || []);
  const [isPhaseCompleted, setIsPhaseCompleted] = useState(saved.isPhaseCompleted || false);
  const [isResolvingPhase, setIsResolvingPhase] = useState(false);

  // Sync state to localStorage
  useEffect(() => {
    const stateToSave = {
      activePhase,
      currentStep,
      guideProjectId,
      guideJobId,
      completedPhases,
      isPhaseCompleted
    };
    localStorage.setItem('smartnest_guide_state', JSON.stringify(stateToSave));
  }, [activePhase, currentStep, guideProjectId, guideJobId, completedPhases, isPhaseCompleted]);

  // Auto-complete or transition if route matches expected next phase
  useEffect(() => {
    if (!activePhase) return;
    
    // Auto-advance nesting optimization (Phase 4) when nesting completes and redirects
    if (activePhase === 'nesting_optimization' && location.pathname.startsWith('/results/') && !location.pathname.endsWith('/processing') && !location.pathname.endsWith('/studio')) {
      setCompletedPhases(prev => {
        if (prev.includes('nesting_optimization')) return prev;
        return [...prev, 'nesting_optimization'];
      });
      setIsPhaseCompleted(true);
    }
  }, [location.pathname, activePhase]);

  /**
   * Resolve out-of-order phase jumps and navigate to the starting page
   */
  const startPhase = async (phaseKey) => {
    const phaseConfig = GUIDE_PHASES[phaseKey];
    if (!phaseConfig) return;
    
    setIsResolvingPhase(true);
    try {
      // 1. Ensure guide project workspace is initialized
      let pId = guideProjectId;
      if (!pId) {
        const setupRes = await api.setupGuide();
        if (setupRes && setupRes.success) {
          pId = setupRes.projectId;
          setGuideProjectId(pId);
        } else {
          throw new Error('Failed to setup project workspace');
        }
      }

      // 2. Ensure completed nesting job exists if required by this phase
      let jId = guideJobId;
      const requiresNest = ['nesting_optimization', 'result_analysis', 'manufacturing_studio', 'gcode_generation'].includes(phaseKey);
      
      if (requiresNest && !jId) {
        const jobRes = await api.runGuideJob();
        if (jobRes && jobRes.success) {
          jId = jobRes.jobId;
          setGuideJobId(jId);
        } else {
          throw new Error('Failed to execute greedy nesting job');
        }
      }

      // 3. Resolve navigation route parameters
      let resolvedRoute = phaseConfig.route;
      resolvedRoute = resolvedRoute.replace(':id', String(pId)).replace(':jobId', String(jId));

      // 4. Update states & route
      setActivePhase(phaseKey);
      setCurrentStep(0);
      setIsPhaseCompleted(false);
      navigate(resolvedRoute);
    } catch (err) {
      console.error('[GuideContext] startPhase failed:', err);
      alert(`Walkthrough resolution error: ${err.message}. Re-running setup.`);
      // Reset references so next try runs setup clean
      setGuideProjectId(null);
      setGuideJobId(null);
    } finally {
      setIsResolvingPhase(false);
    }
  };

  const nextStep = () => {
    if (!activePhase) return;
    const phaseConfig = GUIDE_PHASES[activePhase];
    if (!phaseConfig) return;

    if (currentStep < phaseConfig.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completePhase();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completePhase = () => {
    if (!activePhase) return;
    setCompletedPhases(prev => {
      if (prev.includes(activePhase)) return prev;
      return [...prev, activePhase];
    });
    
    if (activePhase === 'material_planning') {
      setIsPhaseCompleted(false);
      startPhase('nesting_optimization');
    } else {
      setIsPhaseCompleted(true);
    }
  };

  const finishPhaseAndGoToHub = () => {
    setActivePhase(null);
    setCurrentStep(0);
    setIsPhaseCompleted(false);
    navigate('/guide');
  };

  const replayCurrentPhase = () => {
    setCurrentStep(0);
    setIsPhaseCompleted(false);
  };

  const continueToNextPhase = () => {
    const phaseKeys = ['project_planning', 'cad_import', 'material_planning', 'nesting_optimization', 'result_analysis', 'manufacturing_studio', 'gcode_generation'];
    const nextIndex = phaseKeys.indexOf(activePhase) + 1;
    if (nextIndex < phaseKeys.length) {
      const nextPhase = phaseKeys[nextIndex];
      setIsPhaseCompleted(false);
      startPhase(nextPhase);
    } else {
      finishPhaseAndGoToHub();
    }
  };

  const exitGuide = () => {
    setActivePhase(null);
    setCurrentStep(0);
    setIsPhaseCompleted(false);
    navigate('/guide');
  };

  const resetAllGuideProgress = () => {
    setActivePhase(null);
    setCurrentStep(0);
    setGuideProjectId(null);
    setGuideJobId(null);
    setCompletedPhases([]);
    setIsPhaseCompleted(false);
    localStorage.removeItem('smartnest_guide_state');
  };

  return (
    <GuideContext.Provider
      value={{
        activePhase,
        currentStep,
        guideProjectId,
        guideJobId,
        completedPhases,
        isPhaseCompleted,
        isResolvingPhase,
        startPhase,
        nextStep,
        prevStep,
        completePhase,
        exitGuide,
        resetAllGuideProgress,
        replayCurrentPhase,
        continueToNextPhase,
        finishPhaseAndGoToHub
      }}
    >
      {children}
    </GuideContext.Provider>
  );
};

export const useGuide = () => {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
};
