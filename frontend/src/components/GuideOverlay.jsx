import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useGuide } from '../context/GuideContext';
import { GUIDE_PHASES } from '../config/guideDefinition';

export const GuideOverlay = () => {
  const {
    activePhase,
    currentStep,
    nextStep,
    prevStep,
    exitGuide,
    isPhaseCompleted,
    replayCurrentPhase,
    continueToNextPhase,
    finishPhaseAndGoToHub
  } = useGuide();
  
  const [targetRect, setTargetRect] = useState(null);

  const phaseConfig = activePhase ? GUIDE_PHASES[activePhase] : null;
  const step = phaseConfig ? phaseConfig.steps[currentStep] : null;

  // Track target element dimensions and coordinates
  useLayoutEffect(() => {
    if (isPhaseCompleted || !step || !step.targetId) {
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(`[data-guide-id="${step.targetId}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
      } else {
        setTargetRect(null);
      }
    };

    // Run immediately
    updatePosition();

    // Re-run on layout events
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    // Poll coordinates occasionally to handle asynchronous DOM updates
    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      clearInterval(interval);
    };
  }, [activePhase, currentStep, step, isPhaseCompleted]);

  // Monitor target elements and attach click listener for automated step progression
  useEffect(() => {
    if (isPhaseCompleted || !step || !step.targetId) {
      return;
    }

    let attachedElement = null;

    const handleTargetClick = () => {
      // Small timeout to allow native event handlers and routers to execute first
      setTimeout(() => {
        nextStep();
      }, 50);
    };

    const checkAndAttach = () => {
      const element = document.querySelector(`[data-guide-id="${step.targetId}"]`);
      if (element && element !== attachedElement) {
        if (attachedElement) {
          attachedElement.removeEventListener('click', handleTargetClick);
        }
        attachedElement = element;
        attachedElement.addEventListener('click', handleTargetClick);
      }
    };

    // Run check immediately and on short interval to capture async renders
    checkAndAttach();
    const clickInterval = setInterval(checkAndAttach, 250);

    return () => {
      clearInterval(clickInterval);
      if (attachedElement) {
        attachedElement.removeEventListener('click', handleTargetClick);
      }
    };
  }, [activePhase, currentStep, step, isPhaseCompleted, nextStep]);

  // Automatic scrolling to keep the highlighted control comfortably centered in the viewport
  useEffect(() => {
    if (isPhaseCompleted || !step || !step.targetId) return;

    // Small delay to let page layout calculations settle
    const timer = setTimeout(() => {
      const element = document.querySelector(`[data-guide-id="${step.targetId}"]`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [activePhase, currentStep, step?.targetId, isPhaseCompleted]);

  if (!activePhase || (!step && !isPhaseCompleted)) return null;

  const totalSteps = phaseConfig ? phaseConfig.steps.length : 0;

  // Determine card offset to prevent obscuring the target component
  const isOverlap = targetRect && 
                    targetRect.left > window.innerWidth - 420 && 
                    targetRect.top > window.innerHeight - 340;
  const cardLeft = isOverlap ? '24px' : 'auto';
  const cardRight = isOverlap ? 'auto' : '24px';

  return (
    <>
      {/* 1. Pulsing Highlight Frame surrounding the target UI component */}
      {targetRect && (
        <div
          className="guide-pulse-highlight"
          style={{
            position: 'absolute',
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            border: '3px solid #0d9488',
            borderRadius: '8px',
            boxShadow: '0 0 15px rgba(13, 148, 136, 0.8), inset 0 0 8px rgba(13, 148, 136, 0.4)',
            zIndex: 99999,
            pointerEvents: 'none',
            animation: 'guidePulse 1.8s infinite ease-in-out'
          }}
        />
      )}

      {/* 2. Glassmorphic Instruction / Completion Card overlay */}
      <div
        className="guide-instruction-card"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: cardLeft,
          right: cardRight,
          width: '380px',
          backgroundColor: '#0f1319',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          padding: '24px',
          zIndex: 99998,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {isPhaseCompleted ? (
          /* Completion State View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', width: '56px', height: '56px', borderRadius: '28px', backgroundColor: 'rgba(13, 148, 136, 0.1)', marginBottom: '4px' }}>
              <svg style={{ width: '32px', height: '32px', fill: '#0d9488' }} viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: '#f8f9fa' }}>
                Phase Completed!
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#a9b1d6' }}>
                You have successfully completed the **{phaseConfig.title}** phase of the AeroTech Components campaign.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <button className="guide-btn-primary" onClick={continueToNextPhase}>
                Continue to Next Phase
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="guide-btn-secondary" style={{ flex: 1 }} onClick={replayCurrentPhase}>
                  Replay Phase
                </button>
                <button className="guide-btn-secondary" style={{ flex: 1 }} onClick={finishPhaseAndGoToHub}>
                  Return to Guide
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Walkthrough Steps View */
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {phaseConfig.title}
              </span>
              <span style={{ fontSize: '11px', color: '#565f89', fontWeight: '700' }}>
                Step {currentStep + 1} of {totalSteps}
              </span>
            </div>

            {/* Title & Body */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                {step.title}
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#a9b1d6' }}>
                {step.content}
              </p>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: '#0d9488',
                  width: `${((currentStep + 1) / totalSteps) * 100}%`,
                  transition: 'width 0.3s ease-in-out'
                }}
              />
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <button className="guide-btn-text" onClick={exitGuide}>
                Exit Guide
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {currentStep > 0 && (
                  <button className="guide-btn-secondary" onClick={prevStep}>
                    Back
                  </button>
                )}

                {step.actionType === 'read' ? (
                  <button className="guide-btn-primary" onClick={nextStep}>
                    {currentStep === totalSteps - 1 ? 'Finish Phase' : 'Next'}
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#0d9488',
                      backgroundColor: 'rgba(13, 148, 136, 0.06)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: '800',
                      border: '1px solid rgba(13, 148, 136, 0.15)'
                    }}
                  >
                    Perform Action to Continue
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Global CSS Inject for frame animations and button transitions */}
      <style>{`
        @keyframes guidePulse {
          0% {
            box-shadow: 0 0 10px rgba(13, 148, 136, 0.6), inset 0 0 6px rgba(13, 148, 136, 0.2);
            opacity: 0.8;
          }
          50% {
            box-shadow: 0 0 20px rgba(13, 148, 136, 0.9), inset 0 0 10px rgba(13, 148, 136, 0.4);
            opacity: 1;
          }
          100% {
            box-shadow: 0 0 10px rgba(13, 148, 136, 0.6), inset 0 0 6px rgba(13, 148, 136, 0.2);
            opacity: 0.8;
          }
        }
        
        .guide-btn-primary {
          background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%);
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 18px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
          transition: all 0.2s ease-in-out;
        }
        .guide-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(13, 148, 136, 0.4);
          filter: brightness(1.1);
        }
        
        .guide-btn-secondary {
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #a9b1d6;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .guide-btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.15);
        }
        
        .guide-btn-text {
          background: none;
          border: none;
          color: #565f89;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 8px 12px;
          transition: color 0.2s ease;
        }
        .guide-btn-text:hover {
          color: #a9b1d6;
        }

        @media (max-width: 600px) {
          .guide-instruction-card {
            width: calc(100% - 32px) !important;
            left: 16px !important;
            right: 16px !important;
            bottom: 16px !important;
          }
        }
      `}</style>
    </>
  );
};
