import * as THREE from 'three';
import { MeshPhongNodeMaterial, WebGPURenderer } from 'three/webgpu';

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 30);
camera.position.set(1, 2.0, 4);
camera.lookAt(0, 1, 0);

const renderer = new WebGPURenderer({ antialias: true });

const floorMaterial = new MeshPhongNodeMaterial();

export { camera, renderer, floorMaterial };
