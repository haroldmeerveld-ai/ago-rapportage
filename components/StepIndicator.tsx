
import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex items-center space-x-2 mb-10">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-700 ${
            i + 1 <= currentStep ? 'bg-ago-green' : 'bg-stone-100'
          }`}
        />
      ))}
    </div>
  );
};