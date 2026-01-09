import React, { useRef } from 'react';
import { useThree, useFrame, extend } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls';

extend({ OrbitControls: OrbitControlsImpl });

export const OrbitControls = ({ domElement, ...props }) => {
  const { camera, gl } = useThree();
  const controls = useRef();

  useFrame(() => controls.current?.update());

  return (
    <orbitControls
      ref={controls}
      args={[camera, domElement || gl.domElement]}
      {...props}
    />
  );
};