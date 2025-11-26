import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const OnboardingTour = ({ isOpen, onClose, startStep = 0, sidebarVisible, setSidebarVisible }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(startStep);
  const [highlightPosition, setHighlightPosition] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && mounted) {
      // Show sidebar when tour reaches the create button step (step 2)
      if (currentStep === 2 && setSidebarVisible) {
        setSidebarVisible(true);
      }
      
      updateHighlightPosition();
      window.addEventListener('resize', updateHighlightPosition);
      window.addEventListener('scroll', updateHighlightPosition);
      
      // Add keyboard listener for ESC key
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          handleSkip();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          handlePrevious();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
        window.removeEventListener('resize', updateHighlightPosition);
        window.removeEventListener('scroll', updateHighlightPosition);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, currentStep, mounted, setSidebarVisible]);

  const steps = [
    {
      target: '.popular-characters-section', // Popular characters section
      title: t('onboarding.step1_title'),
      description: t('onboarding.step1_description'),
      position: 'top',
      highlightPadding: 12
    },
    {
      target: '.popular-characters-section .list-group-item:first-child, .popular-characters-section [class*="card"]:first-child', // First character card
      title: t('onboarding.step2_title'),
      description: t('onboarding.step2_description'),
      position: 'bottom',
      highlightPadding: 8
    },
    {
      target: '.create-dropdown-area', // Create button in sidebar
      title: t('onboarding.step3_title'),
      description: t('onboarding.step3_description'),
      position: 'right',
      highlightPadding: 8
    }
  ];

  const updateHighlightPosition = () => {
    const step = steps[currentStep];
    if (!step) return;

    const element = document.querySelector(step.target);
    if (element) {
      // First scroll element into view smoothly
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });

      // Wait for scroll to complete, then update position
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const padding = step.highlightPadding || 8;
        setHighlightPosition({
          top: rect.top + window.scrollY - padding,
          left: rect.left + window.scrollX - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          position: step.position
        });
      }, 500); // Increased timeout to ensure scroll completes
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const currentStepData = steps[currentStep];
  if (!highlightPosition) return null;

  // Calculate tooltip position based on highlight and preferred position
  const getTooltipPosition = () => {
    const isMobile = window.innerWidth < 768;
    const tooltipWidth = isMobile ? Math.min(window.innerWidth - 32, 300) : 320;
    const tooltipHeight = isMobile ? 250 : 200;
    const margin = isMobile ? 12 : 20;
    
    let top = highlightPosition.top;
    let left = highlightPosition.left;

    // On mobile, always position at bottom of viewport for better visibility
    if (isMobile) {
      top = window.innerHeight + window.scrollY - tooltipHeight - 16;
      left = 16;
    } else {
      switch (highlightPosition.position) {
        case 'right':
          left = highlightPosition.left + highlightPosition.width + margin;
          top = highlightPosition.top + highlightPosition.height / 2 - tooltipHeight / 2;
          break;
        case 'left':
          left = highlightPosition.left - tooltipWidth - margin;
          top = highlightPosition.top + highlightPosition.height / 2 - tooltipHeight / 2;
          break;
        case 'bottom':
          top = highlightPosition.top + highlightPosition.height + margin;
          left = highlightPosition.left + highlightPosition.width / 2 - tooltipWidth / 2;
          break;
        case 'top':
          top = highlightPosition.top - tooltipHeight - margin;
          left = highlightPosition.left + highlightPosition.width / 2 - tooltipWidth / 2;
          break;
        default:
          left = highlightPosition.left + highlightPosition.width + margin;
          top = highlightPosition.top;
      }

      // Keep tooltip on screen
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
      if (top < 10) top = 10;
      if (top + tooltipHeight > window.innerHeight + window.scrollY - 10) {
        top = window.innerHeight + window.scrollY - tooltipHeight - 10;
      }
    }

    return { top, left };
  };

  const tooltipPosition = getTooltipPosition();

  // Arrow direction
  const getArrowStyle = () => {
    const arrowSize = 12;
    const style = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid'
    };

    switch (highlightPosition.position) {
      case 'right':
        style.left = -arrowSize;
        style.top = '50%';
        style.transform = 'translateY(-50%)';
        style.borderWidth = `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`;
        style.borderColor = `transparent #fff transparent transparent`;
        break;
      case 'left':
        style.right = -arrowSize;
        style.top = '50%';
        style.transform = 'translateY(-50%)';
        style.borderWidth = `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`;
        style.borderColor = `transparent transparent transparent #fff`;
        break;
      case 'bottom':
        style.top = -arrowSize;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        style.borderWidth = `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`;
        style.borderColor = `transparent transparent #fff transparent`;
        break;
      case 'top':
        style.bottom = -arrowSize;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        style.borderWidth = `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`;
        style.borderColor = `#fff transparent transparent transparent`;
        break;
    }

    return style;
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {/* Dark overlay with cutout */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto',
        background: 'transparent'
      }}>
        {/* Dark overlay with cutout using box-shadow */}
        <div style={{
          position: 'absolute',
          top: highlightPosition.top,
          left: highlightPosition.left,
          width: highlightPosition.width,
          height: highlightPosition.height,
          borderRadius: '12px',
          boxShadow: `
            0 0 0 9999px rgba(0, 0, 0, 0.5),
            inset 0 0 0 2px rgba(102, 126, 234, 0.8)
          `,
        }} />
      </div>

      {/* Tooltip */}
      <div style={{
        position: 'absolute',
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        width: window.innerWidth < 768 ? `${Math.min(window.innerWidth - 32, 300)}px` : '320px',
        background: '#fff',
        borderRadius: window.innerWidth < 768 ? '12px' : '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        padding: window.innerWidth < 768 ? '16px' : '24px',
        pointerEvents: 'auto',
        zIndex: 10000
      }}>
        {/* Arrow */}
        <div style={getArrowStyle()} />

        {/* Progress indicator */}
        <div className="d-flex gap-1 mb-3">
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: '4px',
                background: index === currentStep ? '#667eea' : '#e9ecef',
                borderRadius: '2px',
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ fontSize: window.innerWidth < 768 ? '0.8rem' : '0.85rem', color: '#6c757d', marginBottom: '8px', fontWeight: 500 }}>
          {t('onboarding.step_count', { current: currentStep + 1, total: steps.length })}
        </div>
        <h4 style={{ fontSize: window.innerWidth < 768 ? '1.1rem' : '1.25rem', fontWeight: 700, color: '#232323', marginBottom: window.innerWidth < 768 ? '8px' : '12px' }}>
          {currentStepData.title}
        </h4>
        <p style={{ fontSize: window.innerWidth < 768 ? '0.875rem' : '0.95rem', color: '#6c757d', marginBottom: window.innerWidth < 768 ? '16px' : '24px', lineHeight: 1.6 }}>
          {currentStepData.description}
        </p>

        {/* Actions */}
        <div className="d-flex justify-content-between align-items-center">
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6c757d',
              fontSize: window.innerWidth < 768 ? '0.8rem' : '0.9rem',
              cursor: 'pointer',
              padding: window.innerWidth < 768 ? '6px 8px' : '8px 12px',
              fontWeight: 600,
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#232323'}
            onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}
          >
            {t('onboarding.skip')}
          </button>

          <div className="d-flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                style={{
                  background: '#f5f6fa',
                  border: 'none',
                  color: '#232323',
                  fontSize: window.innerWidth < 768 ? '0.8rem' : '0.9rem',
                  cursor: 'pointer',
                  padding: window.innerWidth < 768 ? '8px 12px' : '10px 20px',
                  borderRadius: window.innerWidth < 768 ? '10px' : '12px',
                  fontWeight: 600,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e9ecef'}
                onMouseLeave={e => e.currentTarget.style.background = '#f5f6fa'}
              >
                {t('onboarding.previous')}
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                background: '#667eea',
                border: 'none',
                color: '#fff',
                fontSize: window.innerWidth < 768 ? '0.8rem' : '0.9rem',
                cursor: 'pointer',
                padding: window.innerWidth < 768 ? '8px 16px' : '10px 24px',
                borderRadius: window.innerWidth < 768 ? '10px' : '12px',
                fontWeight: 600,
                transition: 'background 0.2s',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#5568d3'}
              onMouseLeave={e => e.currentTarget.style.background = '#667eea'}
            >
              {currentStep === steps.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div style={{ 
          marginTop: window.innerWidth < 768 ? '12px' : '16px', 
          paddingTop: window.innerWidth < 768 ? '8px' : '12px', 
          borderTop: '1px solid #e9ecef',
          fontSize: window.innerWidth < 768 ? '0.7rem' : '0.75rem',
          color: '#adb5bd',
          textAlign: 'center',
          display: window.innerWidth < 480 ? 'none' : 'block'
        }}>
          <kbd style={{ 
            padding: '2px 6px', 
            background: '#f5f6fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: '#6c757d'
          }}>←</kbd>
          {' '}
          <kbd style={{ 
            padding: '2px 6px', 
            background: '#f5f6fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: '#6c757d'
          }}>→</kbd>
          {' Navigate • '}
          <kbd style={{ 
            padding: '2px 6px', 
            background: '#f5f6fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: '#6c757d'
          }}>ESC</kbd>
          {' Skip'}
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 0 6px rgba(102, 126, 234, 0.4), 0 0 30px rgba(102, 126, 234, 0.7), 0 0 50px rgba(102, 126, 234, 0.4);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(102, 126, 234, 0.3), 0 0 40px rgba(102, 126, 234, 0.8), 0 0 60px rgba(102, 126, 234, 0.5);
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default OnboardingTour;
