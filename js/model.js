/**
 * 程序化三梁四柱液压机模型
 * 所有可拾取网格都写入 userData.partId，由 interaction 模块统一射线检测。
 * 返回的 refs 包含全部需要动画驱动的对象引用。
 */
import * as THREE from 'three';
import { M, applyMaterials } from './materials.js';
import { PART_IDS, PIPE_IDS, PIPE_COLORS, MOTION } from './config.js';

/* ============ 基础几何常量（单位近似 m） ============ */
const C = {
  columnX: 1.35,
  columnZ: 0.85,
  barrelR: 0.42,
  barrelBottom: 2.5,
  barrelTop: 5.25,
  headHomeY: 4.55,
  headLocalY: 1.475,   // 活塞头相对压板组原点（压板顶面）的局部高度
  rodLen: 1.5,
};

function box(w, h, d, bundle, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bundle.solid);
  mesh.position.set(x, y, z);
  applyMaterials(mesh, bundle);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function cyl(rTop, rBottom, h, bundle, x, y, z, seg = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), bundle.solid);
  mesh.position.set(x, y, z);
  applyMaterials(mesh, bundle);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** 把一组网格登记为某个部件 */
function register(parts, partId, ...meshes) {
  if (!parts.has(partId)) parts.set(partId, []);
  for (const m of meshes) {
    m.userData.partId = partId;
    parts.get(partId).push(m);
  }
}

function buildFrame(parts) {
  const g = new THREE.Group();

  // 底座
  const base = box(3.6, 0.6, 2.4, M.darkSteel, 0, 0.3, 0);
  // 上横梁（ crown ）
  const crown = box(3.4, 0.7, 2.2, M.frame, 0, 4.05, 0);
  // 四柱
  const cols = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const col = cyl(0.09, 0.09, 3.7, M.piston, sx * C.columnX, 2.55, sz * C.columnZ, 20);
    // 上下锁紧螺母
    const nut1 = cyl(0.14, 0.14, 0.12, M.darkSteel, sx * C.columnX, 4.42, sz * C.columnZ, 6);
    const nut2 = cyl(0.14, 0.14, 0.12, M.darkSteel, sx * C.columnX, 0.72, sz * C.columnZ, 6);
    cols.push(col, nut1, nut2);
  }
  g.add(base, crown, ...cols);
  register(parts, PART_IDS.FRAME, base, crown, ...cols);
  return g;
}

function buildTable(parts) {
  const g = new THREE.Group();
  const plate = box(3.0, 0.1, 2.0, M.table, 0, 0.65, 0);
  // T 形槽示意（深色凹槽条）
  const slots = [];
  for (const z of [-0.6, -0.2, 0.2, 0.6]) {
    slots.push(box(2.4, 0.012, 0.05, M.darkSteel, 0, 0.706, z));
  }
  g.add(plate, ...slots);
  register(parts, PART_IDS.TABLE, plate, ...slots);
  return g;
}

function buildCylinderAndPiston(parts) {
  const g = new THREE.Group();
  const barrelH = C.barrelTop - C.barrelBottom;
  const barrelY = (C.barrelTop + C.barrelBottom) / 2;

  // ---- 主油缸缸筒（外壳，透视时透明） ----
  const barrel = cyl(C.barrelR, C.barrelR, barrelH, M.cylinder, 0, barrelY, 0, 40);
  const capTop = cyl(C.barrelR * 1.08, C.barrelR * 1.08, 0.14, M.cylinder, 0, C.barrelTop + 0.02, 0, 40);
  const gland = cyl(C.barrelR * 1.02, C.barrelR * 1.02, 0.18, M.cylinder, 0, C.barrelBottom + 0.02, 0, 40);
  // A / B 油口接头（接管嘴沿 x 方向伸出缸壁）
  const portA = cyl(0.07, 0.07, 0.18, M.pipe, C.barrelR + 0.04, 4.85, 0, 16);
  portA.rotation.z = Math.PI / 2;
  const portB = cyl(0.07, 0.07, 0.18, M.pipe, C.barrelR + 0.04, 2.66, 0, 16);
  portB.rotation.z = Math.PI / 2;
  g.add(barrel, capTop, gland, portA, portB);
  register(parts, PART_IDS.CYLINDER, barrel, capTop, gland, portA, portB);

  // ---- 活塞运动组：原点在压板顶面，随压板一起平移 ----
  const pistonGroup = new THREE.Group();
  const head = cyl(0.36, 0.36, 0.18, M.piston, 0, C.headLocalY, 0, 36);
  // 活塞密封圈（深色环）
  const seal = cyl(0.365, 0.365, 0.04, M.darkSteel, 0, C.headLocalY, 0, 36);
  const rod = cyl(0.13, 0.13, C.rodLen, M.piston, 0, C.headLocalY / 2, 0, 24);
  pistonGroup.add(head, seal, rod);
  g.add(pistonGroup);
  register(parts, PART_IDS.PISTON, head, seal, rod);

  // ---- 缸内油腔（实体模式被缸筒遮挡，透视模式可见） ----
  const upperOil = cyl(0.365, 0.365, 1, M.oil, 0, 4.9, 0, 32);
  upperOil.material.transparent = true;
  upperOil.material.opacity = 0.8;
  const lowerOil = cyl(0.365, 0.365, 1, M.oilBlue, 0, 3.0, 0, 32);
  lowerOil.material.transparent = true;
  lowerOil.material.opacity = 0.8;
  g.add(upperOil, lowerOil);

  return { group: g, pistonGroup, upperOil, lowerOil };
}

function buildPlaten(parts) {
  const g = new THREE.Group();
  const body = box(2.4, 0.35, 1.5, M.platen, 0, 0, 0);
  // 上模（模柄 + 模面）
  const die = box(0.9, 0.16, 0.9, M.darkSteel, 0, -0.255, 0);
  // 四角导套
  const collars = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    collars.push(cyl(0.15, 0.15, 0.42, M.darkSteel, sx * C.columnX, 0, sz * C.columnZ, 20));
  }
  g.add(body, die, ...collars);
  register(parts, PART_IDS.PLATEN, body, die, ...collars);
  return g;
}

function buildWorkpiece() {
  // 工件：红色短圆柱坯料，受压时产生压缩形变
  const wp = cyl(0.32, 0.32, 0.35, M.workpiece, 0, 0.875, 0, 36);
  return wp;
}

function buildPowerUnit(parts) {
  const g = new THREE.Group();
  const refs = {};

  // ---- 油箱 ----
  const tank = box(1.6, 1.1, 1.2, M.tank, 2.9, 0.85, 0);
  const lid = box(1.66, 0.06, 1.26, M.darkSteel, 2.9, 1.43, 0);
  const cap = cyl(0.08, 0.08, 0.1, M.darkSteel, 3.45, 1.5, -0.4, 16);
  // 液位计
  const sight = box(0.06, 0.55, 0.3, M.oil, 3.71, 0.85, 0);
  g.add(tank, lid, cap, sight);
  register(parts, PART_IDS.TANK, tank, lid, cap, sight);

  // ---- 泵 + 电机（轴线沿 z） ----
  const pumpShell = cyl(0.23, 0.23, 0.36, M.pump, 2.4, 1.78, 0.18, 28);
  pumpShell.rotation.x = Math.PI / 2;
  const motorShell = cyl(0.21, 0.21, 0.6, M.motor, 2.4, 1.78, -0.42, 28);
  motorShell.rotation.x = Math.PI / 2;
  // 电机散热筋（沿壳体周向排布）
  const fins = [];
  for (let i = 0; i < 8; i++) {
    const fin = box(0.025, 0.44, 0.045, M.darkSteel, 2.4, 1.78, -0.68 + i * 0.075);
    fin.rotation.z = (i / 8) * Math.PI * 2;
    fin.position.x = 2.4 + Math.cos((i / 8) * Math.PI * 2) * 0.215;
    fin.position.y = 1.78 + Math.sin((i / 8) * Math.PI * 2) * 0.215;
    fins.push(fin);
  }
  g.add(pumpShell, motorShell, ...fins);

  // 内部齿轮副（透视可见，转向相反）
  const rotor = new THREE.Group();
  const gear1 = cyl(0.095, 0.095, 0.1, M.valveSpool, 2.34, 1.78, 0.18, 14);
  gear1.rotation.x = Math.PI / 2;
  const gear2 = cyl(0.095, 0.095, 0.1, M.valveSpool, 2.46, 1.78, 0.18, 14);
  gear2.rotation.x = Math.PI / 2;
  const shaft = cyl(0.04, 0.04, 0.7, M.piston, 2.4, 1.78, -0.2, 12);
  shaft.rotation.x = Math.PI / 2;
  // 电机尾部风扇（绕电机轴线 z 旋转）
  const fan = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = box(0.14, 0.05, 0.015, M.darkSteel, 0.07, 0, 0);
    const bg = new THREE.Group();
    bg.add(blade);
    bg.rotation.z = (i / 4) * Math.PI * 2;
    fan.add(bg);
  }
  fan.position.set(2.4, 1.78, -0.74);
  rotor.add(gear1, shaft, fan);
  g.add(rotor, gear2);
  refs.rotor = rotor;
  refs.gear2 = gear2;
  register(parts, PART_IDS.PUMP, pumpShell, motorShell, ...fins, gear1, gear2, shaft);

  // ---- 三位四通换向阀（独立阀架） ----
  const stand = box(0.5, 1.0, 0.5, M.darkSteel, 1.85, 1.0, 0.55);
  const valveBody = box(0.58, 0.55, 0.46, M.valve, 1.85, 1.55, 0.55);
  // 两端电磁铁（轴线沿 x）
  const sol1 = cyl(0.1, 0.1, 0.14, M.darkSteel, 1.49, 1.55, 0.55, 18);
  sol1.rotation.z = Math.PI / 2;
  const sol2 = cyl(0.1, 0.1, 0.14, M.darkSteel, 2.21, 1.55, 0.55, 18);
  sol2.rotation.z = Math.PI / 2;
  g.add(stand, valveBody, sol1, sol2);

  // 阀芯（透视可见，沿 x 滑动）
  const spool = cyl(0.07, 0.07, 0.42, M.valveSpool, 1.85, 1.55, 0.55, 18);
  spool.rotation.z = Math.PI / 2;
  g.add(spool);
  // 阀芯外置指示杆
  const indicator = new THREE.Group();
  const indRod = box(0.26, 0.025, 0.025, M.label, 0, 0, 0);
  const indKnob = cyl(0.045, 0.045, 0.05, M.label, 0.15, 0, 0, 14);
  indKnob.rotation.z = Math.PI / 2;
  indicator.add(indRod, indKnob);
  indicator.position.set(1.85, 1.92, 0.55);
  g.add(indicator);
  refs.spool = spool;
  refs.indicator = indicator;
  register(parts, PART_IDS.DVALVE, stand, valveBody, sol1, sol2, spool, indicator);

  // ---- 溢流阀（接在压油路上） ----
  const reliefBody = cyl(0.095, 0.095, 0.26, M.valve, 2.2, 2.42, 0.28, 20);
  const reliefCap = cyl(0.075, 0.075, 0.08, M.darkSteel, 2.2, 2.59, 0.28, 20);
  // 阀芯（开启时上抬）
  const poppet = cyl(0.05, 0.05, 0.12, M.valveSpool, 2.2, 2.38, 0.28, 16);
  g.add(reliefBody, reliefCap, poppet);
  refs.poppet = poppet;
  register(parts, PART_IDS.RVALVE, reliefBody, reliefCap, poppet);

  // ---- 压力表（表盘法线沿 x，朝向机器外侧） ----
  const gauge = new THREE.Group();
  const face = cyl(0.16, 0.16, 0.03, M.gaugeFace, 0, 0, 0, 32);
  face.rotation.z = Math.PI / 2;
  const rim = cyl(0.17, 0.17, 0.035, M.darkSteel, 0, 0, 0, 32);
  rim.rotation.z = Math.PI / 2;
  const needlePivot = new THREE.Group();
  // 指针在表盘平面（y-z 平面）内绕 x 轴摆动
  const needle = box(0.008, 0.13, 0.012, M.label, 0, 0.06, 0);
  needlePivot.add(needle);
  gauge.add(rim, face, needlePivot);
  gauge.position.set(1.52, 1.62, 0.78);
  g.add(gauge);
  refs.needlePivot = needlePivot;

  return { group: g, refs };
}

/** 建一根油管：钢管 + 管内流动粒子 */
function buildPipe(id, points, pipeRoot, particleList) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
  const geo = new THREE.TubeGeometry(curve, 72, 0.045, 12, false);
  const mesh = new THREE.Mesh(geo, M.pipe.solid);
  mesh.castShadow = true;
  mesh.userData.partId = PART_IDS.PIPES;
  mesh.userData.pipeId = id;
  const wireMesh = new THREE.Mesh(geo, M.pipe.wire);
  wireMesh.userData.isWireOverlay = true;
  wireMesh.raycast = () => {};
  mesh.add(wireMesh);
  mesh.userData.solidMaterial = M.pipe.solid;
  pipeRoot.add(mesh);

  // 流动粒子
  const color = PIPE_COLORS[id];
  const particles = [];
  const pGeo = new THREE.SphereGeometry(0.035, 10, 10);
  const COUNT = 9;
  for (let i = 0; i < COUNT; i++) {
    const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const p = new THREE.Mesh(pGeo, pMat);
    p.visible = false;
    pipeRoot.add(p);
    particles.push({ mesh: p, t: i / COUNT });
  }
  particleList.push({ id, curve, particles });
  return mesh;
}

function buildPipes(parts, particleList) {
  const root = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const meshes = [];

  meshes.push(buildPipe(PIPE_IDS.SUCTION, [
    V(2.62, 1.46, 0.05), V(2.5, 1.55, 0.08), V(2.4, 1.62, 0.14),
  ], root, particleList));

  meshes.push(buildPipe(PIPE_IDS.PRESSURE, [
    V(2.4, 1.98, 0.18), V(2.4, 2.25, 0.18), V(2.2, 2.25, 0.28),
    V(2.0, 2.1, 0.42), V(1.85, 1.86, 0.55),
  ], root, particleList));

  meshes.push(buildPipe(PIPE_IDS.RELIEF, [
    V(2.2, 2.55, 0.28), V(2.2, 2.75, 0.28), V(2.75, 2.75, 0.25),
    V(3.05, 2.2, 0.2), V(3.05, 1.46, 0.2),
  ], root, particleList));

  meshes.push(buildPipe(PIPE_IDS.A, [
    V(1.62, 1.78, 0.6), V(1.35, 2.4, 0.55), V(1.05, 3.6, 0.4),
    V(0.85, 4.85, 0.25), V(0.48, 4.85, 0),
  ], root, particleList));

  meshes.push(buildPipe(PIPE_IDS.B, [
    V(1.62, 1.38, 0.6), V(1.25, 1.9, 0.48), V(0.95, 2.66, 0.3),
    V(0.48, 2.66, 0),
  ], root, particleList));

  meshes.push(buildPipe(PIPE_IDS.T, [
    V(1.85, 1.26, 0.55), V(2.1, 1.05, 0.55), V(2.5, 1.15, 0.5),
    V(2.72, 1.46, 0.5),
  ], root, particleList));

  register(parts, PART_IDS.PIPES, ...meshes);
  return root;
}

/**
 * 组装整台液压机
 * @returns {{root:Group, refs:object, parts:Map, pickables:Array, particles:Array}}
 */
export function buildPress() {
  const parts = new Map();
  const root = new THREE.Group();
  const particleList = [];

  root.add(buildFrame(parts));
  root.add(buildTable(parts));

  const cyl = buildCylinderAndPiston(parts);
  root.add(cyl.group);

  const platenGroup = buildPlaten(parts);
  platenGroup.position.set(0, MOTION.platenHomeY, 0);
  root.add(platenGroup);

  const workpiece = buildWorkpiece();
  root.add(workpiece);

  const power = buildPowerUnit(parts);
  root.add(power.group);

  const pipeRoot = buildPipes(parts, particleList);
  root.add(pipeRoot);

  const pickables = [];
  for (const list of parts.values()) pickables.push(...list);

  const refs = {
    platenGroup,
    pistonGroup: cyl.pistonGroup,
    upperOil: cyl.upperOil,
    lowerOil: cyl.lowerOil,
    workpiece,
    ...power.refs,
    barrelBottom: C.barrelBottom,
    barrelTopInner: C.barrelTop - 0.07,
    headLocalY: C.headLocalY,
    headHalf: 0.09,
  };

  return { root, refs, parts, pickables, particles: particleList };
}
