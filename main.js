import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

let camera, scene, renderer, controls;
let room;
let interactionHintDiv;
let currentInteractable = null;
window.isDoorOpen = false;
window.doorGroup = null;

// --- SENARYO DEĞİŞKENLERİ ---
window.hasKey = false; 
let earthquakeTriggered = false;
let earthquakeTimer = 0; 
let isFallen = false; 
let recoveryTimer = 0; 
let isWakingUp = false;
let wakeUpProgress = 0;
let isGasLeaking = false; 

// --- IŞIKLAR ---
let normalLight;
let dangerLight;

// --- GAZ DEĞİŞKENLERİ ---
let gasParticles;
let gasVelocities = [];
const particleCount = 4000;
const gasSource = new THREE.Vector3(-1.5, 0.2, -1.5);
const doorTarget = new THREE.Vector3(0, 1.1, 2.5);
let globalGasLevel = 0;
let isVentilationActive = false;
let hasScenarioStarted = false;
let isGameOver = false;
let isGasCleared = false;
let simulationStartTime = 0;

// --- NESNELER ---
window.paintingMesh = null;
window.safeMesh = null;
window.doorLockMesh = null;

// --- SES SİSTEMİ (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

window.playSynth = function(type) {
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'success') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  } else if (type === 'alarm') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
  }
};

// --- UI (ARAYÜZ) OLUŞTURMA ---
function setupGameUI() {
  const introDiv = document.createElement("div");
  introDiv.id = "introScreen";
  introDiv.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,1); z-index:2000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;";
  introDiv.innerHTML = `
    <h1 style="font-size:55px; color:#e74c3c; margin-bottom:10px; letter-spacing:3px;">Toxic Trap: Escape Room</h1>
    <input type="text" id="newPlayerName" placeholder="Enter Player Name..." style="padding:15px; font-size:20px; text-align:center; margin-bottom:20px; width:350px; border-radius:8px; border:2px solid #555; background:#222; color:white; outline:none;" autocomplete="off" />
    <div style="background:rgba(255,255,255,0.05); padding:25px; border-radius:10px; margin-bottom:40px; text-align:left; border:1px solid #444; width: 450px;">
      <h3 style="margin-top:0; color:#f1c40f;">HOW TO SURVIVE:</h3>
      <ul style="font-size:18px; line-height:1.8; padding-left:20px; color:#ddd;">
        <li>Use <b>W, A, S, D</b> to move.</li>
        <li>Use <b>Mouse</b> to look.</li>
        <li>Press <b>[E]</b> to inspect objects and read notes.</li>
        <li>Find the clues, unlock the safe, and get the key.</li>
        <li style="color:#e74c3c;"><b>ESCAPE</b> before the toxic gas kills you!</li>
      </ul>
    </div>
    <button onclick="startGameSequence()" style="padding:15px 60px; font-size:26px; font-weight:bold; background:#c0392b; color:white; border:none; border-radius:8px; cursor:pointer; letter-spacing:3px;">WAKE UP</button>
  `;
  document.body.appendChild(introDiv);

  const fadeDiv = document.createElement("div");
  fadeDiv.id = "fadeOverlay";
  fadeDiv.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:black; z-index:1500; pointer-events:none; display:none;";
  document.body.appendChild(fadeDiv);

  const subtitleDiv = document.createElement("div");
  subtitleDiv.id = "subtitleDisplay";
  subtitleDiv.style.cssText = "position:fixed; bottom:8%; left:50%; transform:translateX(-50%); color:white; background:rgba(0, 0, 0, 0.85); padding:15px 40px; border-radius:8px; font-size:24px; font-style:italic; display:none; z-index:1000; text-align:center; letter-spacing:1px; border:1px solid #555;";
  document.body.appendChild(subtitleDiv);

  const paperDiv = document.createElement("div");
  paperDiv.id = "paperNote";
  paperDiv.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-2deg); background:#fdf8e4; padding:50px; border:1px solid #dcd3b6; box-shadow: 5px 10px 20px rgba(0,0,0,0.8); color:#333; font-family:'Courier New', Courier, monospace; font-size:28px; font-weight:bold; display:none; z-index:1005; width:350px; text-align:center;";
  paperDiv.innerHTML = `
    <div id="paperText" style="margin-bottom:30px;"></div>
    <button onclick="closePaperNote()" style="padding:12px 25px; background:#2c3e50; color:white; border:none; cursor:pointer; font-weight:bold; font-size:18px; border-radius:5px;">Put it back</button>
  `;
  document.body.appendChild(paperDiv);

  const keypadDiv = document.createElement("div");
  keypadDiv.id = "keypadPanel";
  keypadDiv.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:#1a1a1a; border:4px solid #333; padding:30px; border-radius:12px; display:none; flex-direction:column; align-items:center; z-index:1001; box-shadow: 0 0 30px rgba(0,0,0,0.9);";
  keypadDiv.innerHTML = `
    <h3 style="color:#aaa; margin-top:0; font-family:sans-serif; letter-spacing:2px;">SAFE LOCK</h3>
    <input type="text" id="passcodeDisplay" disabled style="font-size:36px; width:220px; text-align:center; margin-bottom:20px; background:#050505; color:#0f0; border:2px solid #222; padding:10px; font-family:monospace; letter-spacing: 10px;" />
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button onclick="pressKey('${n}')" style="font-size:26px; padding:15px; cursor:pointer; background:#222; color:#ddd; border:1px solid #444; border-radius:5px; font-weight:bold;">${n}</button>`).join('')}
      <button onclick="pressKey('C')" style="font-size:26px; padding:15px; cursor:pointer; background:#c0392b; color:white; border:none; border-radius:5px; font-weight:bold;">C</button>
      <button onclick="pressKey('0')" style="font-size:26px; padding:15px; cursor:pointer; background:#222; color:#ddd; border:1px solid #444; border-radius:5px; font-weight:bold;">0</button>
      <button onclick="checkPasscode()" style="font-size:26px; padding:15px; cursor:pointer; background:#27ae60; color:white; border:none; border-radius:5px; font-weight:bold;">OK</button>
    </div>
    <button onclick="closeKeypad()" style="margin-top:25px; padding:12px 20px; cursor:pointer; background:#444; color:white; border:none; border-radius:5px; width:100%; font-weight:bold; font-size:18px;">Cancel</button>
  `;
  document.body.appendChild(keypadDiv);

  const gasHud = document.createElement("div");
  gasHud.id = "gasHud";
  gasHud.style.cssText = "position:absolute; top:20px; left:20px; color:#fff; font-family:monospace; font-size:22px; z-index:999; display:none;";
  gasHud.innerHTML = `
    <div style="background:rgba(0,0,0,0.6); padding:10px 20px; border-radius:8px; border:1px solid #555;">
      <span style="color:#e74c3c; font-weight:bold;">TOXIC GAS: </span><span id="gasLevelText">0.0%</span>
    </div>
  `;
  document.body.appendChild(gasHud);

  const resultDiv = document.createElement("div");
  resultDiv.id = "resultScreen";
  resultDiv.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:3000; display:none; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;";
  resultDiv.innerHTML = `
    <h1 id="resultTitle" style="font-size:80px; margin-bottom:20px; text-shadow: 2px 2px 10px #000; letter-spacing: 5px;"></h1>
    <p id="resultText" style="font-size:28px; text-align:center; max-width:800px; line-height:1.5; color:#ddd;"></p>
  `;
  document.body.appendChild(resultDiv);
}

// --- GLOBAL BUTON FONKSİYONLARI ---
window.pressKey = function(key) {
  playSynth('click');
  const display = document.getElementById('passcodeDisplay');
  if (display.value === 'ERROR') { display.value = ''; display.style.color = '#0f0'; }
  if (key === 'C') display.value = '';
  else if (display.value.length < 3) display.value += key;
};

window.checkPasscode = function() {
  const display = document.getElementById('passcodeDisplay');
  if (display.value === '739') { 
    playSynth('success');
    window.hasKey = true;
    if(window.doorLockMesh) window.doorLockMesh.visible = false;
    closeKeypad();
    showSubtitle("CLICK! The safe opened. I got the door key!", 5000);
  } else {
    playSynth('error');
    display.style.color = '#e74c3c';
    display.value = 'ERROR';
    setTimeout(() => {
      if(display.value === 'ERROR') { display.value = ''; display.style.color = '#0f0'; }
    }, 1500);
  }
};

window.closeKeypad = function() {
  playSynth('click');
  document.getElementById('keypadPanel').style.display = 'none';
  if (controls && !controls.isLocked && !isGameOver) controls.lock();
};

window.showPaperNote = function(text) {
  document.getElementById('paperText').innerText = text;
  document.getElementById('paperNote').style.display = 'block';
  if (controls) controls.unlock(); 
};

window.closePaperNote = function() {
  document.getElementById('paperNote').style.display = 'none';
  if (controls && !controls.isLocked && !isGameOver) controls.lock();
};

function showSubtitle(text, duration = 4000) {
  const sub = document.getElementById('subtitleDisplay');
  if (!sub) return;
  sub.textContent = text;
  sub.style.display = 'block';
  setTimeout(() => sub.style.display = 'none', duration);
}

function getPlayerName() {
  const input = document.getElementById("newPlayerName");
  if (input && input.value.trim()) return input.value.trim();
  return "Survivor";
}

function endScenarioWin(timePassed) {
  if (isGameOver) return;
  isGameOver = true;
  playSynth('success');
  const playerName = getPlayerName();
  const finalScore = Math.max(0, Math.round(100 - (timePassed * 1.5)));
  
  const resultScreen = document.getElementById("resultScreen");
  document.getElementById("resultTitle").textContent = "ESCAPE SUCCESSFUL";
  document.getElementById("resultTitle").style.color = "#2ecc71";
  document.getElementById("resultText").textContent = `Great job, ${playerName}! You survived the toxic trap and escaped in ${timePassed} seconds. Final Score: ${finalScore}/100`;
  
  document.getElementById("gasHud").style.display = "none";
  resultScreen.style.display = "flex";
  if (controls && controls.isLocked) controls.unlock();
}

function endScenarioLose() {
  if (isGameOver) return;
  isGameOver = true;
  playSynth('error');
  const playerName = getPlayerName();
  
  const resultScreen = document.getElementById("resultScreen");
  document.getElementById("resultTitle").textContent = "YOU DIED";
  document.getElementById("resultTitle").style.color = "#c0392b";
  document.getElementById("resultText").textContent = `The toxic gas filled your lungs, ${playerName}... You failed to escape.`;
  
  document.getElementById("gasHud").style.display = "none";
  document.getElementById('keypadPanel').style.display = 'none';
  document.getElementById('paperNote').style.display = 'none';
  resultScreen.style.display = "flex";
  
  if (controls && controls.isLocked) controls.unlock();
}

const loader = new GLTFLoader().setPath("/modeller/3D/");
const hdriLoader = new RGBELoader().setPath("/modeller/hdri/");

const REALISTIC_MODELS = {
  desk: { file: "office_desk.glb", position: { x: 0, y: 0, z: -1.5 }, scale: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 } },
  monitor: { file: "computer_monitor.glb", position: { x: 0, y: 0.9, z: -2 }, scale: { x: 0.3, y: 0.3, z: 0.3 }, rotation: { x: 0, y: 0, z: 0 } },
  bed: { file: "bed.glb", position: { x: 1.5, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: -Math.PI / 2, z: 0 } }, 
  chair: { file: "office_chair.glb", position: { x: 0, y: 0, z: -1 }, scale: { x: 0.8, y: 0.8, z: 0.8 }, rotation: { x: 0, y: Math.PI, z: 0 } },
  plant: { file: "majesty_palm_plant.glb", position: { x: -2.0, y: 0, z: -2.0 }, scale: { x: 1.2, y: 1.2, z: 1.2 }, rotation: { x: 0, y: 0, z: 0 } },
};
const loadedModels = {};

initApp();

async function initApp() {
  setupGameUI(); 
  await init();
  animate();
}

function toggleDoor() {
  if (!window.doorGroup) return;
  window.isDoorOpen = !window.isDoorOpen;
  window.doorGroup.rotation.y = window.isDoorOpen ? -Math.PI / 2 : 0;
  isVentilationActive = window.isDoorOpen;
}

async function init() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(1.5, 0.2, 0.5);

  scene = new THREE.Scene();
  await createRoom();

  hdriLoader.load("Env.hdr", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  });

  scene.background = new THREE.Color(0x2a2a2a); 
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, document.body);

  document.addEventListener("click", (event) => {
    if (isGameOver || !hasScenarioStarted || isWakingUp) return; 
    const tag = event.target.tagName;
    if (tag === "BUTTON" || tag === "INPUT") return;
    
    const keypad = document.getElementById('keypadPanel');
    const paper = document.getElementById('paperNote');
    
    if (!controls.isLocked && keypad.style.display !== 'flex' && paper.style.display !== 'block') {
      controls.lock();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (isGameOver || isWakingUp) return;
    if (e.code === "KeyW") moveState.forward = true;
    if (e.code === "KeyS") moveState.backward = true;
    if (e.code === "KeyA") moveState.left = true;
    if (e.code === "KeyD") moveState.right = true;
    if (e.code === "KeyE" && currentInteractable) handleInteraction(currentInteractable);
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyW") moveState.forward = false;
    if (e.code === "KeyS") moveState.backward = false;
    if (e.code === "KeyA") moveState.left = false;
    if (e.code === "KeyD") moveState.right = false;
  });

  window.addEventListener("resize", onWindowResize);

  normalLight = new THREE.AmbientLight(0xffffff, 2.5);
  scene.add(normalLight);

  dangerLight = new THREE.AmbientLight(0xff0000, 0.0);
  scene.add(dangerLight);

  createGasLeak();
}

const moveState = { forward: false, backward: false, left: false, right: false };

function updateGasMechanics() {
  if (!gasParticles || !hasScenarioStarted || isGameOver) return;
  const positions = gasParticles.geometry.attributes.position.array;

  if (!isGasLeaking) {
    gasParticles.visible = false;
    return;
  }
  gasParticles.visible = true;

  for (let i = 0; i < particleCount; i++) {
    const idx = i * 3;
    if (isVentilationActive) {
      const dx = doorTarget.x - positions[idx];
      const dy = doorTarget.y - positions[idx + 1];
      const dz = doorTarget.z - positions[idx + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const speed = 0.07;
      positions[idx] += (dx / len) * speed;
      positions[idx + 1] += (dy / len) * speed;
      positions[idx + 2] += (dz / len) * speed;
    } else {
      positions[idx] += gasVelocities[i].x;
      positions[idx + 1] += gasVelocities[i].y;
      positions[idx + 2] += gasVelocities[i].z;
      if (positions[idx + 1] > 2.8) positions[idx + 1] = 2.8;
    }
  }
  gasParticles.geometry.attributes.position.needsUpdate = true;

  if (!isVentilationActive) {
    globalGasLevel += 0.015; // Yayılma hızı (yaklaşık 1.5 - 2 dakika sürer)
    if (globalGasLevel >= 100) {
      globalGasLevel = 100;
      endScenarioLose(); // %100 OLUNCA ÖLÜM EKRANI
    }
  } else {
    globalGasLevel = Math.max(0, globalGasLevel - 0.4);
    if (globalGasLevel < 1.0 && !isGasCleared) {
      isGasCleared = true;
      gasParticles.visible = false; 
    }
  }

  const gasText = document.getElementById("gasLevelText");
  if (gasText) gasText.textContent = `${globalGasLevel.toFixed(1)}%`;

  // --- SARSINTI TETİKLEYİCİSİ (%15) ---
  if (globalGasLevel > 15 && !earthquakeTriggered) {
    earthquakeTriggered = true;
    earthquakeTimer = 100; 
    showSubtitle("*RUMBLE* A violent tremor! Watch out!", 4000);
    
    if(window.paintingMesh) {
      window.paintingMesh.position.y = 0.2; 
      window.paintingMesh.rotation.z = 0.3; 
      window.paintingMesh.rotation.x = -Math.PI / 2; 
    }
  }

  // ALARM SESİ TETİKLEYİCİ (Tehlike anında aralıklarla çalar)
  if (globalGasLevel > 50 && !isGameOver && Math.random() < 0.02) {
    playSynth('alarm');
  }

  if (globalGasLevel > 50) {
    normalLight.intensity = 0.1;
    dangerLight.intensity = 3.0;
    renderer.toneMappingExposure = 0.6;
    document.body.style.boxShadow = "inset 0 0 220px rgba(255,0,0,0.85)";
  } else {
    normalLight.intensity = 2.5;
    dangerLight.intensity = 0.0;
    renderer.toneMappingExposure = 1.0;
    document.body.style.boxShadow = "none";
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (isWakingUp) {
    wakeUpProgress += 0.003; 
    camera.position.y = THREE.MathUtils.lerp(0.2, 1.6, wakeUpProgress);
    camera.position.x = THREE.MathUtils.lerp(1.5, 1.0, wakeUpProgress); 
    
    const fadeOverlay = document.getElementById("fadeOverlay");
    if (fadeOverlay) fadeOverlay.style.opacity = 1 - wakeUpProgress;
    
    if (wakeUpProgress >= 1) {
      isWakingUp = false;
      if (fadeOverlay) fadeOverlay.style.display = "none"; 
      controls.lock(); 
      showSubtitle("Where am I? My head hurts... Wait, is that toxic gas leaking?!", 5000);
      document.getElementById("gasHud").style.display = "block";
      setTimeout(() => { isGasLeaking = true; }, 3000);
    }
  }

  if (controls.isLocked && !isGameOver && !isWakingUp && !isFallen) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const strafe = new THREE.Vector3().crossVectors(direction, camera.up).normalize();

    if (moveState.forward) camera.position.addScaledVector(direction, 0.05);
    if (moveState.backward) camera.position.addScaledVector(direction, -0.05);
    if (moveState.left) camera.position.addScaledVector(strafe, -0.05);
    if (moveState.right) camera.position.addScaledVector(strafe, 0.05);
  }

  // DEPREM VE YERE DÜŞME / KALKMA FİZİĞİ
  if (earthquakeTimer > 0) {
    camera.position.x += (Math.random() - 0.5) * 0.15;
    // Düşüş efekti (Yere kapaklanma)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.3, 0.08);
    earthquakeTimer--;
    if (earthquakeTimer === 0) {
      isFallen = true;
      recoveryTimer = 100; // Yerde bekleme süresi
    }
  } else if (isFallen) {
    if (recoveryTimer > 0) {
      recoveryTimer--; // Sarsıntı bitince biraz yerde kalır
    } else {
      // Yavaşça ayağa kalkma
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.6, 0.05);
      if (camera.position.y > 1.58) {
        camera.position.y = 1.6;
        isFallen = false; // Tamamen kalktı, yürüyebilir
      }
    }
  }

  updateInteraction();
  updateGasMechanics();
  
  if (isGasCleared && camera.position.z > 3.0 && window.isDoorOpen) {
    const clearTime = ((Date.now() - simulationStartTime) / 1000).toFixed(2);
    endScenarioWin(clearTime);
  }

  renderer.render(scene, camera);
}

window.startGameSequence = function() {
  const nameInput = document.getElementById("newPlayerName");
  if (nameInput && nameInput.value.trim() === "") {
    alert("Please enter your name to start Toxic Trap: Escape Room.");
    return;
  }
  
  // Tarayıcı ses kuralları gereği, kullanıcı ilk tıkladığında ses motorunu başlatmalıyız.
  if(audioCtx.state === 'suspended') audioCtx.resume();

  document.getElementById("introScreen").style.display = "none";
  const fadeOverlay = document.getElementById("fadeOverlay");
  fadeOverlay.style.display = "block";
  fadeOverlay.style.opacity = "1";

  hasScenarioStarted = true;
  isWakingUp = true; 
  simulationStartTime = Date.now();
};

async function createRoom() {
  room = new THREE.Group();
  const roomSize = 5;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6e7875, roughness: 0.8 }); 
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(roomSize, 0.1, roomSize), floorMat);
  room.add(floor);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomSize, 3, 0.1), wallMat);
  backWall.position.set(0, 1.5, -roomSize / 2);
  room.add(backWall);

  const doorGroup = new THREE.Group();
  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x221100 }));
  door.position.set(0.5, 1.1, 0);
  door.name = "Door";
  doorGroup.add(door);
  
  const lockGeo = new THREE.BoxGeometry(0.2, 0.3, 0.1);
  const lockMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 });
  const doorLock = new THREE.Mesh(lockGeo, lockMat);
  doorLock.position.set(0.8, 1.1, 0.05); 
  doorLock.name = "DoorLock";
  doorGroup.add(doorLock);
  window.doorLockMesh = doorLock; 
  
  doorGroup.position.set(-0.5, 0, 2.5);
  room.add(doorGroup);
  window.doorGroup = doorGroup;

  const safeGeo = new THREE.BoxGeometry(0.6, 0.5, 0.1);
  const safeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 });
  const safe = new THREE.Mesh(safeGeo, safeMat);
  safe.position.set(-1.0, 1.5, -2.45); 
  safe.name = "Safe";
  room.add(safe);
  window.safeMesh = safe;

  const paintingGeo = new THREE.BoxGeometry(0.8, 0.7, 0.05);
  const paintingMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); 
  const painting = new THREE.Mesh(paintingGeo, paintingMat);
  painting.position.set(-1.0, 1.5, -2.4); 
  painting.name = "Painting";
  room.add(painting);
  window.paintingMesh = painting;

  await loadAllRealisticModels();
  Object.values(loadedModels).forEach(m => room.add(m));
  scene.add(room);
}

function createGasLeak() {
  const geometry = new THREE.BufferGeometry();
  const posArray = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    posArray[i * 3] = gasSource.x + (Math.random() - 0.5) * 0.2;
    posArray[i * 3 + 1] = gasSource.y + Math.random() * 0.2;
    posArray[i * 3 + 2] = gasSource.z + (Math.random() - 0.5) * 0.2;
    gasVelocities.push({
      x: (Math.random() - 0.5) * 0.03,
      y: 0.01 + Math.random() * 0.03, 
      z: (Math.random() - 0.5) * 0.03,
    });
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  gasParticles = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x55ff22, 
      size: 0.08,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
  );
  gasParticles.visible = false; 
  scene.add(gasParticles);
}

async function loadAllRealisticModels() {
  const keys = Object.keys(REALISTIC_MODELS);
  for (const key of keys) {
    const config = REALISTIC_MODELS[key];
    const gltf = await new Promise(r => loader.load(config.file, r));
    const m = gltf.scene;
    m.name = key; 
    m.position.set(config.position.x, config.position.y, config.position.z);
    m.scale.set(config.scale.x, config.scale.y, config.scale.z);
    if (config.rotation) m.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
    loadedModels[key] = m;
  }
}

function updateInteraction() {
  // Arayüz çakışmasını (UI Overlap) engelleyen hayati kontrol:
  const isMenuOpen = document.getElementById('keypadPanel').style.display === 'flex' || document.getElementById('paperNote').style.display === 'block';

  if (!interactionHintDiv) {
    interactionHintDiv = document.createElement("div");
    interactionHintDiv.style.position = "fixed";
    interactionHintDiv.style.top = "55%";
    interactionHintDiv.style.left = "50%";
    interactionHintDiv.style.transform = "translate(-50%, -50%)";
    interactionHintDiv.style.color = "white";
    interactionHintDiv.style.fontWeight = "bold";
    interactionHintDiv.style.textShadow = "2px 2px 4px #000";
    interactionHintDiv.style.zIndex = "9998";
    interactionHintDiv.style.fontSize = "20px";
    document.body.appendChild(interactionHintDiv);
  }

  if (isGameOver || isWakingUp || isMenuOpen) {
    interactionHintDiv.style.display = "none";
    return;
  } else {
    interactionHintDiv.style.display = "block";
  }

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  currentInteractable = null;
  if (intersects.length > 0 && intersects[0].distance < 3) {
    const hitObj = intersects[0].object;
    let parentName = hitObj.name;
    hitObj.traverseAncestors((ancestor) => {
      if (['Door', 'DoorLock', 'monitor', 'plant', 'bed', 'Safe', 'Painting'].includes(ancestor.name)) parentName = ancestor.name;
    });
    
    if (['Door', 'DoorLock', 'monitor', 'plant', 'bed', 'Safe', 'Painting'].includes(parentName)) {
      currentInteractable = parentName;
    }
  }

  if (currentInteractable === "Door" || currentInteractable === "DoorLock") {
    interactionHintDiv.textContent = window.hasKey ? "Press [E] to Escape!" : "Press [E] to Inspect Door (LOCKED)";
    interactionHintDiv.style.color = window.hasKey ? "#2ecc71" : "#e74c3c";
  }
  else if (currentInteractable) {
    interactionHintDiv.textContent = "Press [E] to Inspect";
    interactionHintDiv.style.color = "white";
  }
  else {
    interactionHintDiv.textContent = "";
  }
}

function handleInteraction(objName) {
  playSynth('click');
  if (objName === "Door" || objName === "DoorLock") {
    if (window.hasKey) {
      toggleDoor();
      showSubtitle("The door is open! The gas is being sucked out! RUN!", 4000);
    } else {
      showSubtitle("It's locked with a heavy padlock. I need the key from the safe.", 4000);
    }
  } 
  else if (objName === "monitor") {
    showPaperNote("FIRST DIGIT: 7");
  } 
  else if (objName === "bed") {
    showPaperNote("SECOND DIGIT: 3");
  }
  else if (objName === "plant") {
    showPaperNote("LAST DIGIT: 9");
  } 
  else if (objName === "Painting") {
    if (!earthquakeTriggered) {
      showSubtitle("A boring old painting. It's firmly attached to the wall.", 3000);
    } else {
      showSubtitle("The painting fell down and revealed a hidden wall safe!", 4000);
    }
  }
  else if (objName === "Safe") {
    if (!earthquakeTriggered) {
      showSubtitle("I can't reach it, the painting is blocking the way.", 3000);
    } else {
      document.getElementById('keypadPanel').style.display = 'flex';
      if (controls) controls.unlock(); 
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}