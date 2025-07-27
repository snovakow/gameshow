import * as THREE from 'three/webgpu';
import { color, reflector, normalWorldGeometry, texture, uv } from 'three/tsl';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import Stats from 'three/addons/libs/stats.module.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

let camera, scene, renderer;
let model, mixer = null, clock;
let controls;
let stats;
let gui;
let box1, box2, box3;
let textInited = false;
let textZero1 = null;
let textZero2 = null;
const texts = [];
let font;

const hoverBase = -0.1;
const boxSize = 0.75;

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

const api = {
    stanceDuration: 0.5,
    stance: initialAnimation,
    poseDuration: 0.5,
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

const makeText = (text, material) => {
    const bevelEnabled = false;

    const depth = 0.2 * boxSize;
    const size = 0.5 * boxSize;
    const hover = hoverBase;

    const curveSegments = 4;

    const bevelThickness = 0.4 * boxSize;
    const bevelSize = 0.2 * boxSize;

    const textGeo = new TextGeometry(text, {

        font: font,

        size: size,
        depth: depth,
        curveSegments: curveSegments,

        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelEnabled: bevelEnabled

    });

    textGeo.computeBoundingBox();

    const centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);

    const textMesh = new THREE.Mesh(textGeo, material);

    textMesh.position.x = centerOffset;
    textMesh.position.y = hover;
    textMesh.position.z = -depth * 0.5;

    textMesh.rotation.x = 0;
    textMesh.rotation.y = Math.PI * 2;

    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    return textMesh;
}
function loadFont() {
    const loader = new FontLoader();

    const fontName = 'optimer'; // helvetiker, optimer, gentilis, droid sans, droid serif
    const fontWeight = 'bold'; // normal bold

    loader.load('fonts/' + fontName + '_' + fontWeight + '.typeface.json', function (response) {

        font = response;


        const material = new THREE.MeshPhongMaterial({ color: 0xFFD700 })
        textZero1 = makeText("$0", material);
        textZero2 = makeText("$0", material);
        texts.push(makeText("$1", material));
        texts.push(makeText("$2", material));
        texts.push(makeText("$3", material));
        texts.push(makeText("$4", material));
        texts.push(makeText("$5", material));

        textInited = true;
        box1.mesh.add(textZero1);
        box2.mesh.add(textZero2);
        box3.mesh.add(texts[4]);

    });

}

const init = () => {

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 30);
    camera.position.set(1, 2.0, 4);

    const skycolor = 0x0487e2;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(skycolor, 7, 25);
    scene.backgroundNode = normalWorldGeometry.y.mix(color(skycolor), color(0x0066ff));
    camera.lookAt(0, 1, 0);

    const sunLight = new THREE.DirectionalLight(0xFFE499, 5);
    sunLight.position.set(.5, 2, .5);

    sunLight.castShadow = true;
    sunLight.shadow.camera.near = .1;
    sunLight.shadow.camera.far = 5;
    sunLight.shadow.camera.right = 2;
    sunLight.shadow.camera.left = - 2;
    sunLight.shadow.camera.top = 2;
    sunLight.shadow.camera.bottom = - 2;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = - 0.01;

    sunLight.shadow.intensity = 1;
    sunLight.shadow.radius = 3;

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
        model.position.z = 1;
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

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMaterial);
    floor.rotation.x = -Math.PI * 0.5;
    floor.receiveShadow = true;

    floor.position.set(0, 0, 0);
    scene.add(floor);

    const makeBox = (x, z) => {
        const boxMaterial = new THREE.MeshPhongNodeMaterial(); // Example color
        boxMaterial.map = textureLoader.load('/textures/crate.gif');
        boxMaterial.side = THREE.DoubleSide;

        const geometry = new THREE.PlaneGeometry(boxSize, boxSize);

        const box = new THREE.Group();

        const bottom = new THREE.Mesh(geometry, boxMaterial);
        bottom.position.y = -boxSize * 0.5;
        bottom.rotation.x = Math.PI * 0.5;

        const back = new THREE.Mesh(geometry, boxMaterial);
        back.position.z = -boxSize * 0.5;
        back.rotation.x = Math.PI;

        const front = new THREE.Mesh(geometry, boxMaterial);
        front.position.z = boxSize * 0.5;

        const right = new THREE.Mesh(geometry, boxMaterial);
        right.position.x = boxSize * 0.5;
        right.rotation.y = Math.PI * 0.5;

        const left = new THREE.Mesh(geometry, boxMaterial);
        left.position.x = -boxSize * 0.5;
        left.rotation.y = -Math.PI * 0.5;

        box.position.set(x, boxSize * 0.5, z);
        box.castShadow = true;
        box.receiveShadow = true;

        const lid = new THREE.Group();
        lid.position.y = boxSize * 0.5;
        lid.position.z = -boxSize * 0.5;

        const top = new THREE.Mesh(geometry, boxMaterial);
        top.position.z = boxSize * 0.5;
        top.rotation.x = -Math.PI * 0.5;
        lid.add(top);

        bottom.castShadow = true;
        bottom.receiveShadow = true;
        top.castShadow = true;
        top.receiveShadow = true;
        back.castShadow = true;
        back.receiveShadow = true;
        front.castShadow = true;
        front.receiveShadow = true;
        right.castShadow = true;
        right.receiveShadow = true;
        left.castShadow = true;
        left.receiveShadow = true;

        box.add(bottom);
        box.add(lid);
        box.add(back);
        box.add(front);
        box.add(right);
        box.add(left);

        scene.add(box);

        return { mesh: box, lid };
    };
    box1 = makeBox(-1.5, 0);
    box2 = makeBox(0, -1.5);
    box3 = makeBox(1.5, 0);

    loadFont();
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
    window.addEventListener('click', onWindowClick);
}
init();

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

let open1 = false;
let open1Time = 0;
let open2 = false;
let open2Time = 0;
let open3 = false;
let open3Time = 0;

const raycaster = new THREE.Raycaster();
function onWindowClick(event) {
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    const intersect = intersects[0];
    if (intersect) {
        let object = intersect.object;
        while (object) {
            if (object === box1.mesh) {
                open1 = true;
                open1Time = performance.now();
                break;
            }
            if (object === box2.mesh) {
                open2 = true;
                open2Time = performance.now();
                break;
            }
            if (object === box3.mesh) {
                open3 = true;
                open3Time = performance.now();
                break;
            }
            object = object.parent;
        }
    }
}

const animateBox = (box, text, start) => {
    const time = performance.now();
    const duration = 1000;
    const degree = Math.min((time - start) / duration, 1);
    const oscillate = 0.5 - Math.cos(degree * Math.PI) * 0.5;
    box.lid.rotation.x = -Math.PI * oscillate * 0.6;

    if (textInited) {
        const maxHeight = 1.4 * boxSize;
        text.position.y = hoverBase + oscillate * maxHeight;
    }
}

function animate() {

    stats.update();

    controls.update();

    const delta = clock.getDelta();

    if (model) {

        mixer.update(delta);

    }

    if (open1) {
        animateBox(box1, textZero1, open1Time);
    }
    if (open2) {
        animateBox(box2, textZero2, open2Time);
    }
    if (open3) {
        animateBox(box3, texts[4], open3Time);
    }

    renderer.render(scene, camera);
}