import React from 'react';

/**
 * MineGuard Official Brand Logo Component
 * - Renders directly on sidebar without artificial decorative boxes or containers
 * - Transparent vector SVG preserving official brand proportions
 * - Expanded: mineguard-logo-horizontal-dark.svg (or light variant)
 * - Collapsed: favicon.svg mark
 */
export default function MineGuardLogo({ 
  collapsed = false, 
  variant = 'dark', // 'dark' (default for navy sidebar) | 'light' (for white surfaces)
  className = '' 
}) {
  if (collapsed) {
    return (
      <img 
        src="/favicon.svg" 
        alt="MineGuard" 
        className={`w-8 h-8 object-contain select-none transition-transform duration-200 ${className}`}
      />
    );
  }

  // Expanded Logo directly on sidebar background
  if (variant === 'light') {
    return (
      <img 
        src="/mineguard-logo-horizontal.svg" 
        alt="MineGuard" 
        className={`h-7 w-auto max-w-[200px] object-contain select-none ${className}`}
      />
    );
  }

  // Default: Dark background variant directly on sidebar
  return (
    <img 
      src="/mineguard-logo-horizontal-dark.svg" 
      alt="MineGuard" 
      className={`h-9 w-auto object-contain select-none ${className}`}
    />
  );
}
