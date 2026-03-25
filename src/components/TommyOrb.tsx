import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type OrbAgentState = "idle" | "listening" | "thinking" | "talking";

interface TommyOrbProps {
  state?: OrbAgentState;
  size?: number | "fullscreen";
  variant?: "icon" | "fullscreen";
}

export default function TommyOrb({ state = "idle", size, variant = "icon" }: TommyOrbProps) {
  const isFS = variant === "fullscreen" || size === "fullscreen";
  const actualVariant = isFS ? "fullscreen" : "icon";
  const fallbackSize = typeof size === "number" ? size : 200;

  return (
    <View style={isFS ? StyleSheet.absoluteFillObject : { width: fallbackSize, height: fallbackSize }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 5], fov: 45 }}
      >
        <ambientLight intensity={1} />
        <Scene agentState={state} variant={actualVariant} />
      </Canvas>
    </View>
  );
}

function Scene({ agentState, variant }: { agentState: OrbAgentState; variant: "icon" | "fullscreen" }) {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  
  // Gemini Live style colors
  const stateColors = useMemo(() => {
    switch (agentState) {
      case "listening": return ["#00e5ff", "#0055ff"]; // Vibrant cyan/blue
      case "thinking": return ["#b400ff", "#5500ff"];  // Pulsing purple/blue
      case "talking": return ["#ff00ff", "#00ccff"];   // Bright cyan/magenta
      default: return ["#444488", "#111133"];          // Idle deep space blue
    }
  }, [agentState]);

  const targetColor1Ref = useRef(new THREE.Color(stateColors[0]));
  const targetColor2Ref = useRef(new THREE.Color(stateColors[1]));
  const animSpeedRef = useRef(0.1);

  // Volumes
  const curInRef = useRef(0);
  const curOutRef = useRef(0);

  useEffect(() => {
    targetColor1Ref.current.set(stateColors[0]);
    targetColor2Ref.current.set(stateColors[1]);
  }, [stateColors]);

  useFrame((_, delta) => {
    const mat = meshRef.current?.material;
    if (!mat) return;

    const u = mat.uniforms;
    u.uTime.value += delta * 0.5;

    if (u.uOpacity.value < 1) {
      u.uOpacity.value = Math.min(1, u.uOpacity.value + delta * 2);
    }

    let targetIn = 0;
    let targetOut = 0.3;

    const t = u.uTime.value * 2;
    if (agentState === "idle") {
      targetIn = 0;
      targetOut = 0.1; // gentle
    } else if (agentState === "listening") {
      targetIn = clamp01(0.55 + Math.sin(t * 3.2) * 0.35);
      targetOut = 0.3;
    } else if (agentState === "talking") {
      targetIn = clamp01(0.65 + Math.sin(t * 4.8) * 0.22);
      targetOut = clamp01(0.75 + Math.sin(t * 3.6) * 0.4);
    } else if (agentState === "thinking") {
      const base = 0.38 + 0.07 * Math.sin(t * 0.7);
      const wander = 0.05 * Math.sin(t * 2.1) * Math.sin(t * 0.37 + 1.2);
      targetIn = clamp01(base + wander);
      targetOut = clamp01(0.48 + 0.12 * Math.sin(t * 1.05 + 0.6));
    }

    curInRef.current += (targetIn - curInRef.current) * 0.2;
    curOutRef.current += (targetOut - curOutRef.current) * 0.2;

    const targetSpeed = 0.1 + (1 - Math.pow(curOutRef.current - 1, 2)) * 0.9;
    animSpeedRef.current += (targetSpeed - animSpeedRef.current) * 0.12;

    u.uAnimation.value += delta * animSpeedRef.current;
    u.uInputVolume.value = curInRef.current;
    u.uOutputVolume.value = curOutRef.current;
    u.uColor1.value.lerp(targetColor1Ref.current, 0.08);
    u.uColor2.value.lerp(targetColor2Ref.current, 0.08);
  });

  const uniforms = useMemo(() => {
    return {
      uVariant: new THREE.Uniform(variant === "fullscreen" ? 1.0 : 0.0),
      uColor1: new THREE.Uniform(new THREE.Color(stateColors[0])),
      uColor2: new THREE.Uniform(new THREE.Color(stateColors[1])),
      uTime: new THREE.Uniform(0),
      uAnimation: new THREE.Uniform(0.1),
      uInputVolume: new THREE.Uniform(0),
      uOutputVolume: new THREE.Uniform(0),
      uOpacity: new THREE.Uniform(0),
    };
  }, []);

  useEffect(() => {
    if (meshRef.current?.material) {
      meshRef.current.material.uniforms.uVariant.value = variant === "fullscreen" ? 1.0 : 0.0;
    }
  }, [variant]);

  return (
    <mesh ref={meshRef as any}>
      {variant === "fullscreen" ? (
        <planeGeometry args={[15, 15]} />
      ) : (
        <circleGeometry args={[2.0, 64]} />
      )}
      <shaderMaterial
        uniforms={uniforms}
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const vertexShader = [
  "precision mediump float;",
  "uniform float uTime;",
  "varying vec2 vUv;",
  "",
  "void main() {",
  "  vUv = uv;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
  "}"
].join("\\n");

const fragmentShader = [
  "precision mediump float;",
  "uniform float uTime;",
  "uniform float uAnimation;",
  "uniform vec3 uColor1;",
  "uniform vec3 uColor2;",
  "uniform float uInputVolume;",
  "uniform float uOutputVolume;",
  "uniform float uOpacity;",
  "uniform float uVariant;",
  "varying vec2 vUv;",
  "",
  "// Simplex 2D noise",
  "vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }",
  "float snoise(vec2 v){",
  "  const vec4 C = vec4(0.211324865405187, 0.366025403784439,",
  "           -0.577350269189626, 0.024390243902439);",
  "  vec2 i  = floor(v + dot(v, C.yy) );",
  "  vec2 x0 = v -   i + dot(i, C.xx);",
  "  vec2 i1;",
  "  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
  "  vec4 x12 = x0.xyxy + C.xxzz;",
  "  x12.xy -= i1;",
  "  i = mod(i, 289.0);",
  "  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))",
  "  + i.x + vec3(0.0, i1.x, 1.0 ));",
  "  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),",
  "    dot(x12.zw,x12.zw)), 0.0);",
  "  m = m*m;",
  "  m = m*m;",
  "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
  "  vec3 h = abs(x) - 0.5;",
  "  vec3 ox = floor(x + 0.5);",
  "  vec3 a0 = x - ox;",
  "  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );",
  "  vec3 g;",
  "  g.x  = a0.x  * x0.x  + h.x  * x0.y;",
  "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
  "  return 130.0 * dot(m, g);",
  "}",
  "",
  "void main() {",
  "    float time = uTime * 0.2 + uAnimation;",
  "",
  "    if (uVariant < 0.5) {",
  "        // --- ICON MODE (Blob) ---",
  "        vec2 p = vUv * 2.0 - 1.0;",
  "        float radius = length(p);",
  "        float angle = atan(p.y, p.x);",
  "        ",
  "        float blobNoise = snoise(vec2(cos(angle) * 1.5 + time, sin(angle) * 1.5 + time)) * 0.5 + 0.5;",
  "        float targetRadius = 0.55 + uOutputVolume * 0.3 + blobNoise * 0.15;",
  "        ",
  "        float alpha = smoothstep(targetRadius + 0.1, targetRadius - 0.15, radius);",
  "        ",
  "        float glow = smoothstep(targetRadius + 0.2, targetRadius - 0.4, radius);",
  "        vec3 color = mix(uColor2, uColor1, radius / targetRadius);",
  "        color += uColor1 * glow * 0.3;",
  "        ",
  "        gl_FragColor = vec4(color, alpha * uOpacity);",
  "    } else {",
  "        // --- FULLSCREEN MODE (Gemini Live Wave) ---",
  "        float x = vUv.x;",
  "        ",
  "        // 3 layers of noise for fluid motion",
  "        float n1 = snoise(vec2(x * 2.0 + time * 0.8, time * 0.4)) * 0.5 + 0.5;",
  "        float n2 = snoise(vec2(x * 3.5 - time * 0.6, time * 0.3 + 10.0)) * 0.5 + 0.5;",
  "        float n3 = snoise(vec2(x * 1.5 + time * 1.1, time * 0.7 + 20.0)) * 0.5 + 0.5;",
  "        ",
  "        float baseHeight = 0.15 + uInputVolume * 0.1;",
  "        float waveAmp = 0.35 + uOutputVolume * 0.5;",
  "        ",
  "        // Combine noise into a smooth wave",
  "        float waveShape = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;",
  "        float currentWaveHeight = baseHeight + waveShape * waveAmp;",
  "        ",
  "        float distToWave = currentWaveHeight - vUv.y;",
  "        ",
  "        // Very soft aura edge",
  "        float alpha = smoothstep(-0.35, 0.1, distToWave);",
  "        ",
  "        // Inner glow at the crest of the waves",
  "        float bloom = smoothstep(-0.15, 0.15, distToWave) * smoothstep(0.3, -0.05, distToWave);",
  "        ",
  "        // Deep vertical gradient",
  "        vec3 baseColor = mix(uColor2, uColor1, smoothstep(0.0, currentWaveHeight * 1.5, vUv.y));",
  "        baseColor += uColor1 * bloom * (0.4 + uOutputVolume * 0.3);",
  "        ",
  "        gl_FragColor = vec4(baseColor, alpha * uOpacity);",
  "    }",
  "}"
].join("\\n");
