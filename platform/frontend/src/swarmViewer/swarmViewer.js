/**
 * FX KONTROL · Swarm Viewer
 * InstancedMesh-based drone fleet renderer for 100k+ drones.
 */

import * as THREE from "three";

export function initSwarmViewer(scene, maxDrones = 10000) {
  const droneGeometry = new THREE.OctahedronGeometry(0.3, 0);
  const droneMaterial = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });

  const instancedMesh = new THREE.InstancedMesh(droneGeometry, droneMaterial, maxDrones);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.count = 0;
  scene.add(instancedMesh);

  const dummy = new THREE.Object3D();
  const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(maxDrones * 3), 3);
  instancedMesh.instanceColor = colorAttr;

  function updateDronePositions(droneStates) {
    instancedMesh.count = droneStates.length;

    for (let i = 0; i < droneStates.length; i++) {
      const d = droneStates[i];
      dummy.position.set(d.x, d.z, d.y); // NED → Three.js
      dummy.rotation.set(d.pitch || 0, d.heading || 0, d.roll || 0);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      if (d.color) {
        colorAttr.setXYZ(i, d.color[0], d.color[1], d.color[2]);
      }
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  console.log(`[SwarmViewer] InstancedMesh ready (max ${maxDrones} drones)`);
  return { instancedMesh, updateDronePositions };
}
