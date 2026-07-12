import { useEffect } from 'react';

/**
 * A generic and reusable keyboard listener hook for editing operations.
 * Decoupled from application-specific logic, text fields focus check,
 * and handles configurable movement steps.
 */
export default function useUniversalKeyboard({
  isActive,
  stepSize = 10,
  largeStepSize = 50,
  onMoveUp,
  onMoveLeft,
  onMoveDown,
  onMoveRight,
  onRotate90,
  onRotate15,
  onRotateMinus15,
  onDelete,
  onConfirm,
  onCancel,
  onUndo,
  onRedo
}) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      // 1. Focus check: ignore when typing in input, textarea, or contenteditable
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (
        activeTag === 'INPUT' || 
        activeTag === 'TEXTAREA' || 
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // 2. Undo / Redo
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (onUndo) onUndo();
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (onRedo) onRedo();
        return;
      }

      // 3. Movement
      const currentStep = e.shiftKey ? largeStepSize : stepSize;
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (onMoveUp) onMoveUp(currentStep);
        return;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (onMoveLeft) onMoveLeft(currentStep);
        return;
      }
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (onMoveDown) onMoveDown(currentStep);
        return;
      }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (onMoveRight) onMoveRight(currentStep);
        return;
      }

      // 4. Rotation
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (onRotate90) onRotate90();
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (e.shiftKey) {
          if (onRotateMinus15) onRotateMinus15();
        } else {
          if (onRotate15) onRotate15();
        }
        return;
      }

      // 5. Delete
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        if (onDelete) onDelete();
        return;
      }

      // 6. Confirm / Cancel
      if (e.key === 'Enter') {
        e.preventDefault();
        if (onConfirm) onConfirm();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onCancel) onCancel();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isActive,
    stepSize,
    largeStepSize,
    onMoveUp,
    onMoveLeft,
    onMoveDown,
    onMoveRight,
    onRotate90,
    onRotate15,
    onRotateMinus15,
    onDelete,
    onConfirm,
    onCancel,
    onUndo,
    onRedo
  ]);
}
