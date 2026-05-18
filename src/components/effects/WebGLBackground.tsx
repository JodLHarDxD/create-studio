import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05;
    float n = noise(uv * 3.0 + vec2(t, -t * 0.7));
    n += 0.5 * noise(uv * 6.0 + vec2(-t * 1.3, t));
    n *= 0.5;

    float dist = distance(uv, vec2(0.5));
    float vignette = smoothstep(0.9, 0.2, dist);

    vec3 base = vec3(0.04, 0.04, 0.05);
    vec3 highlight = vec3(0.0, 0.48, 0.80) * 0.06;
    vec3 color = base + n * 0.08 + highlight * n;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function ShaderPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </mesh>
  );
}

export default function WebGLBackground() {
  const [contextLost, setContextLost] = useState(false);

  // Decorative only — silently degrade to dark background on context loss
  if (contextLost) {
    return <div className="fixed inset-0 z-0 pointer-events-none bg-[#050508]" aria-hidden="true" />;
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
        style={{ pointerEvents: 'none' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true));
        }}
      >
        <ShaderPlane />
      </Canvas>
    </div>
  );
}
