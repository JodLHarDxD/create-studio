import { useId } from 'react';

export default function NoiseOverlay() {
  const uid = useId();
  const filterId = `grain-${uid.replace(/:/g, '')}`;
  return (
    <div className="fixed inset-0 z-10 grain-overlay" aria-hidden="true">
      <svg width="100%" height="100%">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  );
}
