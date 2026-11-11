import React from 'react';

interface EraserIconProps {
  className?: string;
  size?: number | string;
}

/**
 * Clean, minimalist, standalone eraser icon matching toolbar design requirements.
 * Tilted at 45 degrees with subtle inner sleeve divider line.
 * Strictly independent: contains NO baseline, ground line, underline, or selection mark.
 */
export const CleanEraserIcon: React.FC<EraserIconProps> = ({
  className = 'w-4 h-4',
  size,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Tilted standalone eraser body (closed rounded rectangle) */}
      <rect x="7.5" y="4.5" width="9" height="15" rx="2.5" transform="rotate(45 12 12)" />
      {/* Subtle diagonal inner sleeve divider */}
      <line x1="7.5" y1="13.5" x2="16.5" y2="13.5" transform="rotate(45 12 12)" />
    </svg>
  );
};
