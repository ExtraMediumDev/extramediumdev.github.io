import React, { useMemo, useRef, useEffect, useState} from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { OrbitControls, useHelper } from '@react-three/drei'
import * as THREE from 'three'

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Clock,
  Vector2,
  Vector3,
  TextureLoader,
  MeshStandardMaterial
} from 'three';

import { Agents } from './Agents.jsx';
import { Hunter } from './Hunter.jsx';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { DirectionalLightHelper } from 'three';

extend({ EffectComposer, RenderPass, UnrealBloomPass });

function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();

  // Set up post-processing
  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 1.5, 0.4, 0.85);
    composer.addPass(bloomPass);
    composerRef.current = composer;
  }, [gl, scene, camera, size]);

  // Render with post-processing on every frame
  useFrame(() => composerRef.current && composerRef.current.render(), 1);

  return null;
}

function AgentsComponent( {hunter, onAgentsInit, isVisible } ) {
  const agentsRef = useRef();

  useEffect(() => {
    if (!hunter) return; // Guard against null hunter

    const agents = new Agents(1200);
    agentsRef.current = agents;
    agents.setHunter(hunter);

    if (onAgentsInit) {
      onAgentsInit(agents)
    }

    
  }, [hunter]);

  useFrame((state, delta) => {
    if (isVisible && agentsRef.current) {
      agentsRef.current.tick(delta);
    }
  });

  return agentsRef.current ? <primitive object={agentsRef.current.mesh} /> : null;
}

function HunterComponent({ onHunterInit, isVisible }) {
  const hunterRef = useRef();

    useEffect(() => {
        const hunter = new Hunter();
        hunterRef.current = hunter;

        if (onHunterInit) {
          onHunterInit(hunter);
        }

        return () => {
            
        };
    }, []); // Ensure this only runs once

    useFrame((_, delta) => {
        if (isVisible && hunterRef.current) {
            hunterRef.current.tick(delta);
        }
    });

    return hunterRef.current ? <primitive object={hunterRef.current.mesh} /> : null;
}

function FollowCamera({ hunter, isVisible }) {
  const { camera } = useThree();

  // State to track the vertical angle for vertical rotation
  const [verticalAngle, setVerticalAngle] = useState(0); // Start at level
  const distance = 2.5; // Distance from the hunter

  // Update vertical angle based on scroll, allowing for free rotation
  useEffect(() => {
    const handleScroll = (event) => {
      setVerticalAngle((prev) => prev + event.deltaY * -0.001);
    };

    window.addEventListener('wheel', handleScroll);

    return () => {
      window.removeEventListener('wheel', handleScroll);
    };
  }, []);

  useFrame(() => {
    if (isVisible && hunter) {
      const hunterPos = new Vector3(0,0,0);

      const offsetX = distance * Math.sin(verticalAngle);
      const offsetY = distance * Math.cos(verticalAngle); 
      const offsetZ = distance * Math.sin(verticalAngle); 

      const targetPosition = new THREE.Vector3(
        0 + offsetX,
        0 + offsetY,
        0 + offsetZ
      );

      camera.position.lerp(targetPosition, 0.1);

      const lookDirection = new THREE.Vector3().subVectors(hunterPos, camera.position).normalize();
      const cameraUp = new THREE.Vector3(0, 1, 0); 

      const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        lookDirection
      );


      camera.quaternion.slerp(targetQuaternion, 0.4);
      camera.up.copy(cameraUp); 
    }
  });

  return null;
}


const mousePosition = new THREE.Vector3();


function MouseMarker({ position }) {
  const markerRef = useRef();

  useFrame(() => {
    if (markerRef.current) {
      markerRef.current.position.copy(position);
    }
  });

  return (
    <mesh ref={markerRef}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial color="yellow" wireframe />
    </mesh>
  );
}



function LineToHunter({ hunterPosition, mousePosition, isVisible }) {
  const shapeRef = useRef();
  const lineRef = useRef();

  useEffect(() => {
    // Create a straight line between hunter and mouse
    const positions = [
      hunterPosition.x, hunterPosition.y, hunterPosition.z,
      mousePosition.x, mousePosition.y, mousePosition.z
    ];

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffa500,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });

    if (lineRef.current) {
      shapeRef.current.remove(lineRef.current);
    }

    lineRef.current = new THREE.Line(lineGeometry, lineMaterial);
    shapeRef.current.add(lineRef.current);
  }, [hunterPosition, mousePosition]);

  return (
    <group ref={shapeRef} />
  );
}


function MouseTracker({ onUpdateMousePosition }) {
  const { camera } = useThree();
  const mouseRef = useRef(new THREE.Vector2()); // Use a ref for the mouse
  const raycaster = new THREE.Raycaster();
  const mouse3DPosition = new THREE.Vector3();

  useEffect(() => {
    function handleMouseMove(event) {
      // Update the mouseRef current value
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useFrame(() => {
    raycaster.setFromCamera(mouseRef.current, camera);

    const distance = 2;
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    const planePosition = camera.position
      .clone()
      .add(cameraDirection.clone().multiplyScalar(distance));
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      cameraDirection,
      planePosition
    );

    raycaster.ray.intersectPlane(plane, mouse3DPosition);

    onUpdateMousePosition(mouse3DPosition.clone());
  });

  return null;
}

export function useVisibility() {
  const [isVisible, setIsVisible] = useState(document.visibilityState === "visible");

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

function Stars() {
  const groupRef = useRef();
  
  useEffect(() => {
    const numStars = 600;
    const positions = new Float32Array(numStars * 3);

    for (let i = 0; i < numStars; i++) {
      const radius = 5 + Math.random() * 15; // Spread stars further away
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;

      const x = radius * Math.cos(angle1) * Math.sin(angle2);
      const y = radius * Math.sin(angle1) * Math.sin(angle2);
      const z = radius * Math.cos(angle2);

      positions.set([x, y, z], i * 3);
    }

    groupRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, []);

  return (
    <points ref={groupRef}>
      <bufferGeometry />
      <pointsMaterial size={0.1} color="white" />
    </points>
  );
}

export default function Scene3D() {
  const isVisible = useVisibility();
  const [hunter, setHunter] = useState(null);
  const [agents, setAgents] = useState(null)
  const [mousePos, setMousePos] = useState(mousePosition);

  const handleHunterInit = (initializedHunter) => {
    setHunter(initializedHunter);
    initializedHunter.setMousePosition(mousePosition);
  };

  const handleAgentsInit = (initializedAgents) => {
    setAgents(initializedAgents)
  } 

  const updateMousePosition = (newPosition) => {
    setMousePos(newPosition);
    if (hunter) {
      hunter.setMousePosition(newPosition);
    }
  };

  const fogConfig = useMemo(() => ({
    color: '#291b3e',
    density: 0.15  // Reduced density for better visibility
  }), []);

  useEffect(() => {
  }, [isVisible]);

  /* 
  <DirectionalLightWithHelper />
  <OrbitControls />
  <RotatingCube />
  */
  return (
    isVisible && (
      <Canvas camera={ { position: [0.5, 0.5, 0.5] }} 
              gl={{ 
          antialias: true,
          // Enable logarithmic depth buffer for better depth precision
          logarithmicDepthBuffer: true
        }}

      >
        <color attach="background" args={['#080a12']} />
        <fogExp2 attach="fog" args={[fogConfig.color, fogConfig.density]} />
        <ambientLight intensity={0.1} />

        {/* Add a directional light to help with depth perception in fog */}
        <directionalLight 
          position={[1, 1, 1]} 
          intensity={0.8} 
          castShadow
        />
        

        <Stars />
        <PostProcessing />
        <HunterComponent onHunterInit={handleHunterInit} isVisible={isVisible} />
        <MouseTracker onUpdateMousePosition={updateMousePosition} />
        {hunter && <AgentsComponent hunter={hunter} onAgentsInit={handleAgentsInit} isVisible={isVisible} />}
        {hunter && <FollowCamera hunter={hunter} isVisible={isVisible} />}

        {hunter && <MouseMarker position={mousePos} />}
        {hunter && <LineToHunter hunterPosition={hunter.getPos()} mousePosition={mousePos} isVisible={isVisible} />}
      </Canvas>
    )
  );
}
