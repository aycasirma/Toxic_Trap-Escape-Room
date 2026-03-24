import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";

let camera, scene, renderer, composer, controls;
let gui, guiCam;
let room;
let interactionHintDiv;
let isLocked = false;
let currentInteractable = null;
let handsGroup;
let stats;
window.isDoorOpen = false;
window.doorGroup = null;

const EYE_HEIGHT = 1.6;
const CROUCH_HEIGHT = 0.8;
const CROUCH_TRANSITION_SPEED = 8.0;
const moveState = { forward: false, backward: false, left: false, right: false };
const moveSpeed = 2.5;
let isCrouching = false;
let currentEyeHeight = EYE_HEIGHT;
let hasScenarioStarted = false;
let quakeStartTimeoutId = null;
let isGameOver = false;
let isEvacuationPhase = false;

let safeZoneBox = null;
let isPlayerSafe = false;
let quakeStartTime = 0;
let timeToReachSafeZone = null;

const EarthquakeManager = {
  isQuakeActive: false,
  quakeIntensity: 0,
  quakeTimer: 0,
  quakeElapsed: 0,
  quakeDuration: 15,
};
const quakeShakeOffset = new THREE.Vector3();
const quakeObjects = [];

function createSafeZoneBox() {
  const deskCenter = loadedModels.desk
    ? new THREE.Vector3(
        loadedModels.desk.position.x,
        0.4,
        loadedModels.desk.position.z
      )
    : new THREE.Vector3(0, 0.4, -1.5);
  const safeSize = new THREE.Vector3(1.8, 0.9, 1.4);
  safeZoneBox = new THREE.Box3().setFromCenterAndSize(deskCenter, safeSize);
}

function showResultScreen(title, message, isWin) {
  const resultScreen = document.getElementById("resultScreen");
  const resultText = document.getElementById("resultText");
  const resultTitle = document.getElementById("resultTitle");
  const panelDiv = resultScreen ? resultScreen.querySelector("div") : null;

  if (resultScreen) resultScreen.style.display = "block";
  if (resultTitle) {
    resultTitle.textContent = title;
    resultTitle.style.color = isWin ? "#4caf50" : "#f44336";
  }
  if (resultText) resultText.textContent = message;
  if (panelDiv) panelDiv.style.borderColor = isWin ? "#4caf50" : "#f44336";

  const statusDiv = document.getElementById("statusText");
  if (statusDiv) statusDiv.textContent = message;
}

function getPlayerName() {
  const directInput = document.getElementById("playerName");
  if (directInput && directInput.value.trim()) return directInput.value.trim();
  if (window.userData && window.userData.name) return window.userData.name;
  return "Oyuncu";
}

function endScenarioFailure(message) {
  const playerName = getPlayerName();
  const finalMessage = `${playerName}, ${message}`;
  console.log(finalMessage);
  showResultScreen("Kaybettiniz!", finalMessage, false);
  isGameOver = true;
  Object.keys(moveState).forEach((k) => (moveState[k] = false));
  if (controls) controls.unlock();
}

function endScenarioWin(message) {
  console.log(message);
  showResultScreen("Tebrikler!", message, true);
  isGameOver = true;
  Object.keys(moveState).forEach((k) => (moveState[k] = false));
  if (controls) controls.unlock();
}

function finalizeQuakeOutcome() {
  if (isGameOver) return;
  EarthquakeManager.isQuakeActive = false;
  EarthquakeManager.quakeIntensity = 0;
  EarthquakeManager.quakeElapsed = 0;
  EarthquakeManager.quakeTimer = 0;
  quakeShakeOffset.set(0, 0, 0);

  if (!isPlayerSafe) {
    endScenarioFailure("Sarsinti aninda acikta kaldiniz.");
    return;
  }

  isEvacuationPhase = true;
  const msg = "Sarsinti bitti! Kapiya git ve E tusuyla tahliye ol!";
  console.log(msg);
  const statusDiv = document.getElementById("statusText");
  if (statusDiv) statusDiv.textContent = msg;
  const msgBox = document.getElementById("messageBox");
  if (msgBox) {
    msgBox.textContent = msg;
    msgBox.style.display = "block";
    setTimeout(() => { msgBox.style.display = "none"; }, 5000);
  }
}

function updateSafeStatus() {
  if (!safeZoneBox) return;
  const insideSafeZone = safeZoneBox.containsPoint(camera.position);
  const crouchedEnough = camera.position.y < 1.0 || isCrouching;
  const safeNow = insideSafeZone && crouchedEnough;

  if (safeNow && !isPlayerSafe && quakeStartTime > 0 && timeToReachSafeZone === null) {
    timeToReachSafeZone = (Date.now() - quakeStartTime) / 1000;
  }

  isPlayerSafe = safeNow;
}

const statsEnable = false;
const guiEnable = false;
const toneMapping = THREE.ACESFilmicToneMapping;
const antialiasing = false;
const AmbientOcclusion = false;
const SHADOWS_ENABLED = false;
const ENV_REFLECTION_ENABLED = false;

const loader = new GLTFLoader().setPath("/assets/3D/");
const hdriLoader = new RGBELoader().setPath("/assets/hdri/");

const REALISTIC_MODELS = {
  desk: {
    file: "office_desk.glb",
    position: { x: 0, y: 0, z: -1.5 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  monitor: {
    file: "computer_monitor.glb",
    position: { x: 0, y: 0.9, z: -2 },
    scale: { x: 0.3, y: 0.3, z: 0.3 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  keyboard: {
    file: "mouse_and_keyboard.glb",
    position: { x: -0.2, y: 1.1, z: -1.45 },
    scale: { x: 0.07, y: 0.07, z: 0.07 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  chair: {
    file: "office_chair.glb",
    position: { x: 0, y: 0, z: -1 },
    scale: { x: 0.8, y: 0.8, z: 0.8 },
    rotation: { x: 0, y: Math.PI, z: 0 },
  },
  plant: {
    file: "majesty_palm_plant.glb",
    position: { x: -2.0, y: 0, z: -2.0 },
    scale: { x: 1.2, y: 1.2, z: 1.2 },
    rotation: { x: 0, y: 0, z: 0 },
  },
};

const loadedModels = {};

const guiObject = {
  pauseBoolean: false,
  value3: 1.55,
  value4: 0.05,
  color: { r: 0.01, g: 0.01, b: 0.01 },
};

addGUI();
initApp();

async function initApp() {
  await init();
  createProceduralHands();
  animate();
}

function onKeyDown(event) {
  if (isGameOver) return;
  switch (event.code) {
    case "KeyW":
      moveState.forward = true;
      break;
    case "KeyS":
      moveState.backward = true;
      break;
    case "KeyA":
      moveState.left = true;
      break;
    case "KeyD":
      moveState.right = true;
      break;
    case "KeyE":
      if (event.repeat) return;
      if (currentInteractable) handleInteraction(currentInteractable);
      break;
    case "KeyC":
      isCrouching = true;
      break;
  }
}

function onKeyUp(event) {
  if (isGameOver) return;
  switch (event.code) {
    case "KeyW":
      moveState.forward = false;
      break;
    case "KeyS":
      moveState.backward = false;
      break;
    case "KeyA":
      moveState.left = false;
      break;
    case "KeyD":
      moveState.right = false;
      break;
    case "KeyC":
      isCrouching = false;
      break;
  }
}

function handleInteraction(object) {
  if (object.name === "Door") {
    if (isEvacuationPhase && !isGameOver) {
      const finalTime = (Date.now() - quakeStartTime) / 1000;
      const playerName = getPlayerName();
      const score = Math.max(0, Math.round(100 - finalTime * 2));

      const timeDiv = document.getElementById("timeText");
      if (timeDiv) timeDiv.textContent = `${finalTime.toFixed(2)} saniye`;
      const scoreDiv = document.getElementById("scoreText");
      if (scoreDiv) scoreDiv.textContent = `${score} / 100`;

      const winMessage = `TEBRIKLER ${playerName}! Depremi atlattiniz ve binayi ${finalTime.toFixed(2)} saniyede tahliye ettiniz. Puan: ${score}/100`;
      endScenarioWin(winMessage);
      return;
    }
    toggleDoor();
  }
}

function toggleDoor() {
  if (!window.doorGroup) return;
  window.isDoorOpen = !window.isDoorOpen;
  window.doorGroup.rotation.y = window.isDoorOpen ? -Math.PI / 2 : 0;
}

function clampInsideRoom(position) {
  const roomHalfSize = 2.4;
  const wallZ = 2.5;
  const outsideLimitZ = 6.0;
  const doorHalfWidth = 0.5;

  if (position.x > roomHalfSize) position.x = roomHalfSize;
  if (position.x < -roomHalfSize) position.x = -roomHalfSize;
  if (position.z < -roomHalfSize) position.z = -roomHalfSize;
  if (position.z > outsideLimitZ) position.z = outsideLimitZ;

  if (position.z > 2.2 && position.z < 2.8) {
    const inDoorway = Math.abs(position.x) < doorHalfWidth;
    if (!inDoorway || !window.isDoorOpen) {
      if (position.z < wallZ) position.z = 2.2;
      else position.z = 2.8;
    }
  }
}

function updateFirstPersonMovement(delta) {
  if (isGameOver) return;
  if (!controls.isLocked) return;
  const hasMoveInput = moveState.forward || moveState.backward || moveState.left || moveState.right;

  if (hasMoveInput) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const strafe = new THREE.Vector3();
    strafe.crossVectors(direction, camera.up).normalize();

    const velocity = new THREE.Vector3();
    if (moveState.forward) velocity.add(direction);
    if (moveState.backward) velocity.sub(direction);
    if (moveState.left) velocity.sub(strafe);
    if (moveState.right) velocity.add(strafe);

    if (velocity.lengthSq() > 0) {
      velocity.normalize().multiplyScalar(moveSpeed * delta);
      camera.position.add(velocity);
    }
  }

  clampInsideRoom(camera.position);

  const targetEyeHeight = isCrouching ? CROUCH_HEIGHT : EYE_HEIGHT;
  const lerpFactor = Math.min(1, delta * CROUCH_TRANSITION_SPEED);
  currentEyeHeight += (targetEyeHeight - currentEyeHeight) * lerpFactor;
  camera.position.y = currentEyeHeight;
}

async function loadModel(modelKey) {
  return new Promise((resolve) => {
    const config = REALISTIC_MODELS[modelKey];
    if (!config) {
      resolve(null);
      return;
    }

    try {
      loader.load(
        config.file,
        (gltf) => {
          const m = gltf.scene;
          m.name = modelKey;
          m.position.set(config.position.x, config.position.y, config.position.z);
          m.scale.set(config.scale.x, config.scale.y, config.scale.z);
          m.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
          m.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          loadedModels[modelKey] = m;
          resolve(m);
        },
        undefined,
        (error) => {
          console.warn("Model yüklenemedi, atlanıyor:", error);
          resolve(null);
        }
      );
    } catch (error) {
      console.warn("Model yüklenemedi, atlanıyor:", error);
      resolve(null);
    }
  }).catch((error) => {
    console.warn("Model yüklenemedi, atlanıyor:", error);
    return null;
  });
}

async function loadAllRealisticModels() {
  const keys = Object.keys(REALISTIC_MODELS);
  await Promise.all(keys.map((k) => loadModel(k)));
}

async function init() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, EYE_HEIGHT, 2.0);

  scene = new THREE.Scene();

  await createRoom();

  hdriLoader.load("Env.hdr", (texture) => {
    if (!ENV_REFLECTION_ENABLED) return;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  });
  if (!ENV_REFLECTION_ENABLED) scene.environment = null;

  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 8, 20);

  renderer = new THREE.WebGLRenderer({ antialias: antialiasing });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);

  if (statsEnable) {
    stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
  }

  document.addEventListener("click", (event) => {
    const controlsIntro = document.getElementById("controls-intro");
    if (controlsIntro && controlsIntro.style.display !== "none") return;
    if (!controls.isLocked && event.target.tagName !== "BUTTON") controls.lock();
  });

  controls = new PointerLockControls(camera, document.body);
  controls.addEventListener("lock", () => {
    isLocked = true;
  });
  controls.addEventListener("unlock", () => {
    isLocked = false;
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize);

  window.mainLights = new THREE.Group();
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
  window.mainLights.add(ambientLight);
  const hemiLight = new THREE.HemisphereLight(0xe8f4fc, 0x8b7355, 0.55);
  window.mainLights.add(hemiLight);
  const ceilingLight1 = new THREE.PointLight(0xffffee, 2.2, 10);
  ceilingLight1.position.set(-1, 2.8, -1);
  window.mainLights.add(ceilingLight1);
  const ceilingLight2 = new THREE.PointLight(0xffffee, 2.2, 10);
  ceilingLight2.position.set(1, 2.8, 1);
  window.mainLights.add(ceilingLight2);
  scene.add(window.mainLights);

  renderer.shadowMap.enabled = SHADOWS_ENABLED;
  if (SHADOWS_ENABLED) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.05, 0.7, 0.4));
  if (AmbientOcclusion) {
    const ssaoPass = new SSAOPass(scene, camera);
    ssaoPass.kernelRadius = 0.01;
    ssaoPass.minDistance = 0.0001;
    ssaoPass.maxDistance = 0.1;
    composer.addPass(ssaoPass);
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

async function createRoom() {
  room = new THREE.Group();

  const roomSize = 5;
  const wallHeight = 3;
  const wallThickness = 0.1;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9, metalness: 0.05 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8, metalness: 0.05 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.95, metalness: 0.02 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(roomSize, wallThickness, roomSize), floorMaterial);
  floor.position.y = -wallThickness / 2;
  room.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(roomSize, wallThickness, roomSize), ceilingMaterial);
  ceiling.position.y = wallHeight;
  room.add(ceiling);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomSize, wallHeight, wallThickness), wallMaterial);
  backWall.position.set(0, wallHeight / 2, -roomSize / 2);
  room.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomSize), wallMaterial);
  leftWall.position.set(-roomSize / 2, wallHeight / 2, 0);
  room.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomSize), wallMaterial);
  rightWall.position.set(roomSize / 2, wallHeight / 2, 0);
  room.add(rightWall);

  const frontRight = new THREE.Mesh(new THREE.BoxGeometry(2.0, wallHeight, wallThickness), wallMaterial);
  frontRight.position.set(1.5, wallHeight / 2, roomSize / 2);
  room.add(frontRight);

  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(2.0, wallHeight, wallThickness), wallMaterial);
  frontLeft.position.set(-1.5, wallHeight / 2, roomSize / 2);
  room.add(frontLeft);

  const doorHeight = 2.2;
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, wallHeight - doorHeight, wallThickness), wallMaterial);
  frontTop.position.set(0, doorHeight + (wallHeight - doorHeight) / 2, roomSize / 2);
  room.add(frontTop);

  const doorWidth = 1.0;
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, doorHeight, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x442200, roughness: 0.6 })
  );
  const doorGroup = new THREE.Group();
  doorGroup.position.set(-0.5, doorHeight / 2, roomSize / 2);
  doorMesh.position.set(doorWidth / 2, 0, 0);
  doorMesh.name = "Door";
  doorGroup.add(doorMesh);

  const handleGeo = new THREE.SphereGeometry(0.05);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(doorWidth - 0.1, 0, 0.05);
  handle.name = "Door";
  doorGroup.add(handle);

  const handleInside = new THREE.Mesh(handleGeo, handleMat);
  handleInside.position.set(doorWidth - 0.1, 0, -0.05);
  handleInside.name = "Door";
  doorGroup.add(handleInside);

  room.add(doorGroup);
  window.doorGroup = doorGroup;

  await loadAllRealisticModels();
  Object.values(loadedModels).forEach((m) => room.add(m));
  window.computerEquipment = {
    monitor: loadedModels.monitor || null,
    keyboard: loadedModels.keyboard || null,
    mouse: loadedModels.mouse || null,
  };
  createSafeZoneBox();

  scene.add(room);
}

function collectQuakeObjects() {
  quakeObjects.length = 0;
  const add = (obj) => {
    if (!obj) return;
    if (!quakeObjects.includes(obj)) quakeObjects.push(obj);
  };

  if (window.computerEquipment) {
    add(window.computerEquipment.monitor);
    add(window.computerEquipment.keyboard);
    add(window.computerEquipment.mouse);
  }
  add(loadedModels.plant);
  add(loadedModels.chair);
}

function createProceduralHands() {
  handsGroup = new THREE.Group();
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.6, metalness: 0.05 });

  const createHand = (isRight) => {
    const handGroup = new THREE.Group();
    const side = isRight ? 1 : -1;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.5, 12), skinMaterial);
    arm.rotation.x = Math.PI / 2 - 0.2;
    arm.position.set(0.25 * side, -0.35, -0.15);
    handGroup.add(arm);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.12), skinMaterial);
    palm.position.set(0.25 * side, -0.28, -0.42);
    handGroup.add(palm);
    return handGroup;
  };

  handsGroup.add(createHand(false));
  handsGroup.add(createHand(true));
  camera.add(handsGroup);
}

function addGUI() {
  if (!guiEnable) return;
  gui = new GUI();
  guiCam = gui.addFolder("Simulation");
  guiCam.add(guiObject, "value3", 0, 10).name("Sahne Parlaklığı");
  guiCam.add(guiObject, "pauseBoolean").name("Duraklat");
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.033, 1 / 60);

  if (stats) {
    stats.update();
  }

  if (quakeShakeOffset.lengthSq() > 0) {
    camera.position.x -= quakeShakeOffset.x;
    camera.position.z -= quakeShakeOffset.z;
    quakeShakeOffset.set(0, 0, 0);
  }

  controls.update();
  controls.dampingFactor = guiObject.value4;
  updateFirstPersonMovement(delta);
  updateInteraction();

  if (handsGroup && (moveState.forward || moveState.backward || moveState.left || moveState.right)) {
    const t = Date.now() * 0.005;
    handsGroup.position.y = Math.sin(t) * 0.01;
  } else if (handsGroup) {
    const t = Date.now() * 0.001;
    handsGroup.position.y = Math.sin(t) * 0.005;
  }

  renderer.toneMappingExposure = guiObject.value3;

  if (EarthquakeManager.isQuakeActive) {
    EarthquakeManager.quakeTimer += delta;
    EarthquakeManager.quakeElapsed += delta;
    EarthquakeManager.quakeIntensity = 1.0;

    if (EarthquakeManager.quakeElapsed >= 15) {
      EarthquakeManager.isQuakeActive = false;
      EarthquakeManager.quakeIntensity = 0;
      EarthquakeManager.quakeElapsed = 0;
      EarthquakeManager.quakeTimer = 0;
      quakeShakeOffset.set(0, 0, 0);
      finalizeQuakeOutcome();
    }
  }

  if (EarthquakeManager.isQuakeActive) updateSafeStatus();

  // Render'dan hemen once deprem titreşimi uygula
  if (EarthquakeManager.isQuakeActive) {
    const shakeIntensity = 0.1;
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeZ = (Math.random() - 0.5) * shakeIntensity;
    quakeShakeOffset.set(shakeX, 0, shakeZ);
    camera.position.x += quakeShakeOffset.x;
    camera.position.z += quakeShakeOffset.z;

    const monitorRef = window.computerEquipment ? window.computerEquipment.monitor : null;
    for (const obj of quakeObjects) {
      if (obj === monitorRef) {
        obj.position.z += 0.03;
        obj.position.y -= 0.04;
        obj.rotation.x += 0.02;
      } else {
        obj.position.x += (Math.random() - 0.5) * 0.02;
        obj.position.z += (Math.random() - 0.5) * 0.02;
        obj.position.y -= 0.05;
      }
      if (obj.position.y < 0) obj.position.y = 0;
    }
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function updateInteraction() {
  if (!controls.isLocked) {
    if (interactionHintDiv) interactionHintDiv.style.display = "none";
    return;
  }

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  let foundInteractable = null;
  let hintText = "";

  if (room) {
    const intersects = raycaster.intersectObjects(room.children, true);
    if (intersects.length > 0 && intersects[0].distance < 3.0) {
      const object = intersects[0].object;
      if (object.name === "Door") {
        foundInteractable = object;
        hintText = window.isDoorOpen ? "🚪 KAPIYI KAPATMAK İÇİN [E]" : "🚪 KAPIYI AÇMAK İÇİN [E]";
      }
    }
  }

  currentInteractable = foundInteractable;

  if (!interactionHintDiv) {
    interactionHintDiv = document.createElement("div");
    interactionHintDiv.style.position = "fixed";
    interactionHintDiv.style.top = "55%";
    interactionHintDiv.style.left = "50%";
    interactionHintDiv.style.transform = "translate(-50%, -50%)";
    interactionHintDiv.style.color = "#ffffff";
    interactionHintDiv.style.fontFamily = "Arial, sans-serif";
    interactionHintDiv.style.fontSize = "18px";
    interactionHintDiv.style.fontWeight = "bold";
    interactionHintDiv.style.textShadow = "0px 0px 5px #000000";
    interactionHintDiv.style.pointerEvents = "none";
    interactionHintDiv.style.display = "none";
    interactionHintDiv.style.zIndex = "1000";
    document.body.appendChild(interactionHintDiv);
  }

  if (currentInteractable) {
    interactionHintDiv.textContent = hintText;
    interactionHintDiv.style.display = "block";
  } else {
    interactionHintDiv.style.display = "none";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tweenCameraLookAt(targetPos, targetLookAt, duration) {
  return new Promise((resolve) => {
    const startPos = camera.position.clone();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const startLookAt = startPos.clone().add(forward.multiplyScalar(2));
    const startTime = Date.now();

    function update() {
      const now = Date.now();
      let progress = (now - startTime) / duration;
      if (progress > 1) progress = 1;
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      camera.position.lerpVectors(startPos, targetPos, ease);
      camera.lookAt(new THREE.Vector3().lerpVectors(startLookAt, targetLookAt, ease));
      if (progress < 1) requestAnimationFrame(update);
      else resolve();
    }
    update();
  });
}

let tourOverlay;

function showTourMessage(text) {
  if (!tourOverlay) {
    tourOverlay = document.createElement("div");
    tourOverlay.style.position = "fixed";
    tourOverlay.style.bottom = "20%";
    tourOverlay.style.left = "50%";
    tourOverlay.style.transform = "translate(-50%, 0)";
    tourOverlay.style.backgroundColor = "rgba(0,0,0,0.8)";
    tourOverlay.style.color = "#00ff00";
    tourOverlay.style.padding = "20px 40px";
    tourOverlay.style.fontSize = "24px";
    tourOverlay.style.fontWeight = "bold";
    tourOverlay.style.borderRadius = "15px";
    tourOverlay.style.border = "2px solid #00ff00";
    tourOverlay.style.textAlign = "center";
    tourOverlay.style.zIndex = "10000";
    tourOverlay.style.pointerEvents = "none";
    document.body.appendChild(tourOverlay);
  }
  tourOverlay.textContent = text;
  tourOverlay.style.opacity = "1";
}

function hideTourMessage() {
  if (tourOverlay) tourOverlay.style.opacity = "0";
}

async function runRoomTour() {
  if (controls) controls.unlock();
  const initialPos = new THREE.Vector3(0, EYE_HEIGHT, 2.0);
  const centerPos = new THREE.Vector3(0, EYE_HEIGHT, 0.5);

  const targets = [
    { pos: centerPos, look: new THREE.Vector3(0.2, 1.0, -1.5), text: "🖥️ Çalışma alanı burada.", wait: 1800 },
    { pos: centerPos, look: new THREE.Vector3(0, 1.5, 3.0), text: "🚪 Çıkış kapısı burada.", wait: 1800 },
  ];

  for (const t of targets) {
    showTourMessage(t.text);
    await tweenCameraLookAt(t.pos, t.look, 1400);
    await sleep(t.wait);
  }

  hideTourMessage();
  await tweenCameraLookAt(initialPos, new THREE.Vector3(0, EYE_HEIGHT, -2.0), 1200);
}

function startScenario() {
  const startBtn = document.getElementById("startScenarioBtn");
  if (startBtn) startBtn.style.display = "none";

  const instructionsDiv = document.getElementById("instructions");
  if (instructionsDiv && !instructionsDiv.classList.contains("collapsed")) {
    instructionsDiv.classList.add("collapsed");
  }

  if (controls && !controls.isLocked) controls.lock();
  const crosshair = document.getElementById("crosshair");
  if (crosshair) crosshair.style.display = "block";

  if (!hasScenarioStarted) hasScenarioStarted = true;
}

function startQuakeScenario() {
  if (hasScenarioStarted) return;
  console.log('Deprem senaryosu başlıyor...');
  startScenario();
  isEvacuationPhase = false;
  isGameOver = false;
  isPlayerSafe = false;
  timeToReachSafeZone = null;
  collectQuakeObjects();
  if (quakeStartTimeoutId) clearTimeout(quakeStartTimeoutId);
  quakeStartTimeoutId = setTimeout(() => {
    console.log('Deprem başladı!');
    EarthquakeManager.isQuakeActive = true;
    EarthquakeManager.quakeIntensity = 1.0;
    EarthquakeManager.quakeTimer = 0;
    EarthquakeManager.quakeElapsed = 0;
    EarthquakeManager.quakeDuration = 15;
    quakeStartTime = Date.now();
  }, 5000);
}

window.fireSimulation = {
  startScenario,
  startQuakeScenario,
  runRoomTour,
};

window.startQuakeScenario = startQuakeScenario;
window.runRoomTour = runRoomTour;

window.addEventListener("load", () => {
  setTimeout(() => {
    if (controls) controls.unlock();
    const controlsIntro = document.getElementById("controls-intro");
    if (controlsIntro) controlsIntro.style.display = "block";
  }, 1000);
});
