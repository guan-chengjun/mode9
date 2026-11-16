/**
 * 入口：场景初始化、轨道相机（360° 无锁定）、UI 接线、渲染循环
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initMaterials, setXRayMode } from './materials.js';
import { buildPress } from './model.js';
import { HydraulicController } from './hydraulic.js';
import { InteractionManager } from './interaction.js';
import { tryLoadGLB } from './glb-loader.js';
import { MOTION } from './config.js';

/* ============ 渲染器 / 场景 / 相机 ============ */
const container = document.getElementById('scene-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10161f);
scene.fog = new THREE.Fog(0x10161f, 14, 30);

const camera = new THREE.PerspectiveCamera(
  50, container.clientWidth / container.clientHeight, 0.1, 100
);
camera.position.set(6.2, 4.2, 7.4);

/* ============ 轨道控制：360° 自由旋转 / 缩放 / 平移，无角度锁定 ============ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.6, 2.4, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.enableZoom = true;
controls.minDistance = 2.2;
controls.maxDistance = 22;
// 不设置 maxPolarAngle / minPolarAngle，允许任意俯仰角
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};

/* ============ 灯光与环境 ============ */
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x2a3340, 0.85));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(6, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.camera.far = 30;
scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.6);
fill.position.set(-6, 4, -5);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x1b2530, roughness: 0.95, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(40, 40, 0x3a5068, 0x243445);
grid.position.y = 0.002;
scene.add(grid);

/* ============ 模型与子系统 ============ */
const allMaterials = initMaterials();
const press = buildPress();

// GLB 为可选替换；默认 glbUrl 为空，返回内置程序化模型并挂载
const activeModel = await tryLoadGLB(scene, () => press.root);
if (!activeModel.parent) scene.add(activeModel);

const hydraulic = new HydraulicController(press.refs, press.particles);
const interaction = new InteractionManager(
  camera, renderer.domElement, press.parts, press.pickables, press.root
);

/* ============ 透视模式开关 ============ */
let xray = false;
const xrayBtn = document.getElementById('btn-xray');
xrayBtn.addEventListener('click', () => {
  xray = !xray;
  setXRayMode(allMaterials, xray);
  xrayBtn.classList.toggle('active', xray);
  xrayBtn.textContent = xray ? '退出透视模式' : '透视模式';
  document.getElementById('xray-badge').classList.toggle('show', xray);
});

/* ============ 液压控制面板 ============ */
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const speedRange = document.getElementById('speed-range');
const speedVal = document.getElementById('speed-value');
const phaseLabel = document.getElementById('phase-label');
const pressureVal = document.getElementById('pressure-value');
const phaseItems = document.querySelectorAll('#phase-sequence li');
let lastPhaseKey = null;

btnStart.addEventListener('click', () => {
  hydraulic.start();
  btnStart.classList.add('active');
  btnPause.classList.remove('active');
});
btnPause.addEventListener('click', () => {
  hydraulic.pause();
  btnPause.classList.add('active');
  btnStart.classList.remove('active');
});
btnReset.addEventListener('click', () => {
  hydraulic.reset();
  btnStart.classList.remove('active');
  btnPause.classList.remove('active');
});
speedRange.min = MOTION.speedMin;
speedRange.max = MOTION.speedMax;
speedRange.step = 0.05;
speedRange.value = MOTION.speedDefault;
speedVal.textContent = MOTION.speedDefault.toFixed(2) + '×';
speedRange.addEventListener('input', () => {
  const v = parseFloat(speedRange.value);
  hydraulic.setSpeed(v);
  speedVal.textContent = v.toFixed(2) + '×';
});

/* ============ 渲染循环 ============ */
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();

  hydraulic.update(dt);
  controls.update();
  interaction.update();

  // HUD 状态
  phaseLabel.textContent = hydraulic.running ? hydraulic.phaseLabel : '已停止';
  pressureVal.textContent = hydraulic.pressure.toFixed(1) + ' MPa';

  // 阶段序列指示灯
  const currentKey = hydraulic.running ? hydraulic.phaseKey : null;
  if (currentKey !== lastPhaseKey) {
    lastPhaseKey = currentKey;
    phaseItems.forEach(li => {
      li.classList.toggle('current', li.dataset.phase === currentKey);
    });
  }

  renderer.render(scene, camera);
}
tick();

/* ============ 自适应窗口 ============ */
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
