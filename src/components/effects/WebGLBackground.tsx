import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float } from '@react-three/drei';
import { useRef, useState } from 'react';
import type * as THREE from 'three';

/**
 * Cinematic obsidian fluid background — distorted spheres with
 * cursor parallax. Decorative only, silently degrades on context loss.
 * Source spec: design-master/design.md → AmbientWebGLBackground.
 */

function DistortedObsidian() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Normalized mouse coords (-1..+1)
    const targetX = state.pointer.x * 2;
    const targetY = state.pointer.y * 2;
    // Heavy inertia for premium feel
    groupRef.current.position.x += (targetX - groupRef.current.position.x) * 0.03;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.03;
  });

  return (
    <group ref={groupRef}>
      <Float floatIntensity={2} rotationIntensity={1.5} speed={1.2}>
        <mesh position={[-3, 1, -5]} scale={3.5}>
          <sphereGeometry args={[1, 128, 128]} />
          <MeshDistortMaterial
            color="#030305"
            distort={0.4}
            metalness={0.9}
            roughness={0.2}
            clearcoat={0.2}
            speed={2}
          />
        </mesh>
      </Float>

      <Float floatIntensity={3} rotationIntensity={2} speed={1.5}>
        <mesh position={[4, -2, -7]} scale={4.5}>
          <sphereGeometry args={[1, 128, 128]} />
          <MeshDistortMaterial
            color="#030305"
            distort={0.5}
            metalness={1}
            roughness={0.15}
            speed={1.5}
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function WebGLBackground() {
  const [contextLost, setContextLost] = useState(false);

  if (contextLost) {
    return (
      <div
        className="fixed inset-0 -z-50 pointer-events-none"
        style={{ background: '#09090b' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="fixed inset-0 -z-50 pointer-events-none" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ background: '#09090b' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true));
        }}
      >
        <color attach="background" args={['#09090b']} />
        <ambientLight intensity={0.1} />
        <directionalLight position={[10, 10, 5]} intensity={3} color="#8b5cf6" />
        <directionalLight position={[-10, -10, -5]} intensity={4} color="#34d399" />
        <spotLight position={[0, 5, 10]} intensity={1} penumbra={1} color="#ffffff" distance={20} />
        <DistortedObsidian />
      </Canvas>
    </div>
  );
}
