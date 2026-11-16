/**
 * 材质工厂与 X 射线（透视）模式管理
 * 思路：外壳类部件使用“实体材质 + 线框材质”双材质，
 *       透视模式下外壳透明化并叠加线框，内部油缸/油路/活塞始终实体可见。
 */
import * as THREE from 'three';

/**
 * 创建一个受 X 射线模式控制的材质组
 * @param {object} opts
 * @param {number} opts.color        实体颜色
 * @param {number} [opts.metalness]
 * @param {number} [opts.roughness]
 * @param {number} [opts.emissive]
 * @param {boolean} [opts.isShell]   是否为外壳（透视时变透明+线框）
 * @param {number} [opts.opacity]    透视模式下的透明度
 */
export function makeMaterial(opts = {}) {
  const {
    color = 0x888888,
    metalness = 0.6,
    roughness = 0.45,
    emissive = 0x000000,
    isShell = false,
    opacity = 0.12,
  } = opts;

  const solid = new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity: 0.35,
  });

  const wire = new THREE.MeshBasicMaterial({
    color: 0x9fd8ff,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  wire.visible = false;

  // 记录原始外观，供高亮/恢复使用
  solid.userData.baseColor = new THREE.Color(color);
  solid.userData.baseEmissive = new THREE.Color(emissive);
  solid.userData.baseEmissiveIntensity = 0.35;
  solid.userData.isShell = isShell;
  solid.userData.shellOpacity = opacity;
  solid.userData.wireMaterial = wire;

  return { solid, wire, isShell };
}

/** 切换整套材质的透视状态 */
export function setXRayMode(materialList, enabled) {
  for (const mat of materialList) {
    const wire = mat.userData.wireMaterial;
    if (!wire) continue;
    if (mat.userData.isShell) {
      if (enabled) {
        mat.transparent = true;
        mat.opacity = mat.userData.shellOpacity;
        mat.depthWrite = false;
        mat.needsUpdate = true;
        wire.visible = true;
      } else {
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.needsUpdate = true;
        wire.visible = false;
      }
    }
  }
}

/**
 * 为网格挂载实体+线框双材质（外壳部件用）
 * 内部部件直接用实体材质即可，线框材质隐藏
 */
export function applyMaterials(mesh, materialBundle) {
  const { solid, wire } = materialBundle;
  mesh.material = solid;
  // 线框以克隆网格形式叠加，避免破坏原网格的射线检测与阴影
  const wireMesh = new THREE.Mesh(mesh.geometry, wire);
  wireMesh.userData.isWireOverlay = true;
  wireMesh.raycast = () => {}; // 线框不参与拾取
  mesh.add(wireMesh);
  mesh.userData.solidMaterial = solid;
}

/* ============ 常用材质单例 ============ */
export const M = {};

export function initMaterials() {
  M.frame       = makeMaterial({ color: 0x3d5a80, metalness: 0.75, roughness: 0.35, isShell: true, opacity: 0.10 });
  M.cylinder    = makeMaterial({ color: 0x5c7a9e, metalness: 0.8,  roughness: 0.28, isShell: true, opacity: 0.14 });
  M.piston      = makeMaterial({ color: 0xc9d6e3, metalness: 0.95, roughness: 0.18 });
  M.platen      = makeMaterial({ color: 0x4a6fa5, metalness: 0.7,  roughness: 0.35, isShell: true, opacity: 0.12 });
  M.table       = makeMaterial({ color: 0x52677c, metalness: 0.7,  roughness: 0.4,  isShell: true, opacity: 0.12 });
  M.pump        = makeMaterial({ color: 0x2f6f5e, metalness: 0.65, roughness: 0.4,  isShell: true, opacity: 0.16 });
  M.motor       = makeMaterial({ color: 0x3a3f47, metalness: 0.6,  roughness: 0.5,  isShell: true, opacity: 0.16 });
  M.tank        = makeMaterial({ color: 0x708090, metalness: 0.55, roughness: 0.5,  isShell: true, opacity: 0.14 });
  M.valve       = makeMaterial({ color: 0x8a5a2b, metalness: 0.7,  roughness: 0.35, isShell: true, opacity: 0.18 });
  M.valveSpool  = makeMaterial({ color: 0xd9b382, metalness: 0.9,  roughness: 0.22 });
  M.pipe        = makeMaterial({ color: 0xb8c4d0, metalness: 0.85, roughness: 0.3 });
  M.oil         = makeMaterial({ color: 0xffa31a, metalness: 0.1,  roughness: 0.25 });
  M.oilBlue     = makeMaterial({ color: 0x2f7fd0, metalness: 0.1,  roughness: 0.25 });
  M.darkSteel   = makeMaterial({ color: 0x2b323b, metalness: 0.85, roughness: 0.35 });
  M.workpiece   = makeMaterial({ color: 0xb04a3a, metalness: 0.3,  roughness: 0.6 });
  M.gaugeFace   = makeMaterial({ color: 0xf2f4f7, metalness: 0.05, roughness: 0.6 });
  M.label       = makeMaterial({ color: 0xffd24a, metalness: 0.3, roughness: 0.4 });

  return Object.values(M).map(b => b.solid);
}

/** 部件高亮（拾取/悬停）与恢复 */
export function setHighlight(meshes, on) {
  for (const mesh of meshes) {
    const mat = mesh.userData.solidMaterial;
    if (!mat) continue;
    if (on) {
      mat.emissive = new THREE.Color(0xff8800);
      mat.emissiveIntensity = 0.6;
    } else {
      mat.emissive = mat.userData.baseEmissive.clone();
      mat.emissiveIntensity = mat.userData.baseEmissiveIntensity;
    }
  }
}
