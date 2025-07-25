import * as THREE from 'three';
import { color, pass, reflector, normalWorldGeometry, texture, uv, screenUV } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import Stats from 'three/addons/libs/stats.module.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let camera, scene, renderer;
let model, mixer = null, clock;
let controls;
let stats;
let gui;

const initialAnimation = "Idle Simple";
let previousAction = null, activeAction = null;

class Animation {
    constructor(name, clip, looping) {
        this.name = name;
        this.clip = clip;
        this.looping = looping;
        this._action = null;
    }
    clipAction(mixer) {
        if (!mixer) return null;
        if (!this._action) {
            this._action = mixer.clipAction(this.clip);
            if (this.looping) {
                this._action.setLoop(THREE.LoopRepeat);
            } else {
                this._action.setLoop(THREE.LoopOnce);
                this._action.clampWhenFinished = true;
            }
        }
        return this._action;
    }
}
const animations = new Map();
const playAnimation = (name) => {
    const animation = animations.get(name);
    if (!animation) return null;
    const action = animation.clipAction(mixer);
    if (!action) return null;
    action.play();
    return action;
}

gui = new GUI();

const stances = [];
const poses = [];
const loader = new FBXLoader();
const addAnimation = (looping, name, fileName, play = false) => {
    if (looping) stances.push(name);
    else poses.push(name);
    loader.load(`/animations/${fileName}`, (modelAnimation) => {
        const animation = new Animation(name, modelAnimation.animations[0], looping);
        animations.set(name, animation);
        if (play) {
            activeAction = playAnimation(name);
        }
    });
};

addAnimation(true, initialAnimation, "Idle2.fbx", true);
addAnimation(true, "Idle", "Idle.fbx");
addAnimation(true, "Idle Briefcase", "Standing W_Briefcase Idle.fbx");
addAnimation(false, "Defeated", "Defeated.fbx");
addAnimation(false, "Rejected", "Rejected.fbx");
addAnimation(false, "Sad", "Sad Idle.fbx");
addAnimation(false, "Samba Dancing", "Samba Dancing.fbx");
addAnimation(false, "Samba Dancing 2", "Samba Dancing 2.fbx");
addAnimation(false, "Samba Dancing 3", "Samba Dancing 3.fbx");
addAnimation(false, "Dancing Maraschino Step", "Dancing Maraschino Step.fbx");
addAnimation(false, "Hip Hop Dancing", "Hip Hop Dancing.fbx");
addAnimation(false, "Hip Hop Dancing 2", "Hip Hop Dancing 2.fbx");
addAnimation(false, "Rumba Dancing", "Rumba Dancing.fbx");
addAnimation(false, "Silly Dancing", "Silly Dancing.fbx");

const merged = new Map();
merged.set("Dancing Maraschino Step", "Hip Hop Dancing");
merged.set("Hip Hop Dancing", "Hip Hop Dancing 2");
merged.set("Hip Hop Dancing 2", "Rumba Dancing");
merged.set("Rumba Dancing", "Silly Dancing ");

const api = {
    stanceDuration: 1,
    stance: initialAnimation,
    poseDuration: 1,
    poses: {}
};

const stancesFolder = gui.addFolder('Stances');

stancesFolder.add(api, 'stanceDuration', 0, 5).name('Duration');

const fadeToAction = (name, duration) => {
    const animation = animations.get(name);
    if (!animation) return;
    const action = animation.clipAction(mixer);
    if (!action) return;

    if (activeAction === action) return;

    previousAction = activeAction;
    activeAction = action;

    if (previousAction && previousAction !== activeAction) {
        previousAction.fadeOut(duration);
    }

    activeAction
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();
}

const clipCtrl = stancesFolder.add(api, 'stance').options(stances).name("Stance");
clipCtrl.onChange(function () {
    fadeToAction(api.stance, api.stanceDuration);
});

const poseFolder = gui.addFolder('Poses');

poseFolder.add(api, 'poseDuration', 0, 5).name('Duration');

const restoreState = () => {

    mixer.removeEventListener('finished', restoreState);

    fadeToAction(api.stance, api.poseDuration);

}

const createPoseCallback = (name) => {

    api.poses[name] = () => {

        fadeToAction(name, api.poseDuration);

        mixer.addEventListener('finished', restoreState);

    };

    poseFolder.add(api.poses, name);

}

for (const pose of poses) {

    createPoseCallback(pose);

}

const init = () => {

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 30);
    camera.position.set(0, 2.5, 3);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0487e2, 7, 25);
    scene.backgroundNode = normalWorldGeometry.y.mix(color(0x0487e2), color(0x0066ff));
    camera.lookAt(0, 1, 0);

    const sunLight = new THREE.DirectionalLight(0xFFE499, 5);
    sunLight.castShadow = true;
    sunLight.shadow.camera.near = .1;
    sunLight.shadow.camera.far = 5;
    sunLight.shadow.camera.right = 2;
    sunLight.shadow.camera.left = - 2;
    sunLight.shadow.camera.top = 2;
    sunLight.shadow.camera.bottom = - 2;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = - 0.001;

    sunLight.shadow.intensity = 1;
    sunLight.shadow.radius = 5;

    sunLight.position.set(.5, 3, .5);

    const waterAmbientLight = new THREE.HemisphereLight(0x333366, 0x74ccf4, 5);
    const skyAmbientLight = new THREE.HemisphereLight(0x74ccf4, 0, 1);

    scene.add(sunLight);
    scene.add(skyAmbientLight);
    scene.add(waterAmbientLight);

    clock = new THREE.Clock();

    // animated model
    const loader = new GLTFLoader();
    loader.load('/models/gltf/Michelle.glb', function (gltf) {

        model = gltf.scene;
        model.rotation.x = -Math.PI * 0.5;
        model.children[0].children[0].castShadow = true;
        model.children[0].children[0].receiveShadow = true;

        mixer = new THREE.AnimationMixer(model);

        scene.add(model);

        activeAction = playAnimation(initialAnimation);

    });
    // textures

    const textureLoader = new THREE.TextureLoader();

    const floorColor = textureLoader.load('/textures/floors/FloorsCheckerboard_S_Diffuse.jpg');
    floorColor.wrapS = THREE.RepeatWrapping;
    floorColor.wrapT = THREE.RepeatWrapping;
    floorColor.colorSpace = THREE.SRGBColorSpace;

    const floorNormal = textureLoader.load('/textures/floors/FloorsCheckerboard_S_Normal.jpg');
    floorNormal.wrapS = THREE.RepeatWrapping;
    floorNormal.wrapT = THREE.RepeatWrapping;

    // floor

    const floorUV = uv().mul(15);
    const floorNormalOffset = texture(floorNormal, floorUV).xy.mul(2).sub(1).mul(.02);

    const reflection = reflector({ resolution: 0.5 }); // 0.5 is half of the rendering view
    reflection.target.rotateX(- Math.PI / 2);
    reflection.uvNode = reflection.uvNode.add(floorNormalOffset);
    scene.add(reflection.target);

    const floorMaterial = new THREE.MeshPhongNodeMaterial();
    floorMaterial.colorNode = texture(floorColor, floorUV).add(reflection);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(50, .001, 50), floorMaterial);
    floor.receiveShadow = true;

    floor.position.set(0, 0, 0);
    scene.add(floor);

    // renderer

    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    stats = new Stats();
    document.body.appendChild(stats.dom);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2;
    // controls.autoRotate = true;
    // controls.autoRotateSpeed = 1;
    controls.target.set(0, .5, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);
}
init();

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

    stats.update();

    controls.update();

    const delta = clock.getDelta();

    if (model) {

        mixer.update(delta);

    }

    renderer.render(scene, camera);
}