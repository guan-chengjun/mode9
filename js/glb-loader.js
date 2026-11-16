/**
 * 可选线上 GLB 模型加载
 * 流程：配置了 glbUrl 时尝试加载 → 按 glbNameMap 把网格名映射到内部部件 id
 *       → 成功则用外部模型替换程序化模型；失败则回退程序化模型。
 *
 * 注意：外部 GLB 无法自动获得程序化模型的运动引用（滑块/阀芯/粒子等），
 *       因此 GLB 模式下液压动画作用于程序化模型、GLB 仅作展示替换，
 *       或在 glbNameMap 完整映射时保留点击标注能力。
 *       要获得全部动画联动，推荐直接使用内置程序化模型（默认）。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_CONFIG } from './config.js';

export async function tryLoadGLB(scene, fallbackBuilder) {
  const url = MODEL_CONFIG.glbUrl;
  const statusEl = document.getElementById('model-status');

  if (!url) {
    return fallbackBuilder();
  }

  try {
    statusEl.textContent = '正在加载线上 GLB 模型…';
    statusEl.classList.add('show');

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;

    let mapped = 0;
    model.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mappedId = MODEL_CONFIG.glbNameMap[obj.name] || MODEL_CONFIG.glbNameMap[obj.name.toLowerCase()];
      if (mappedId) {
        obj.userData.partId = mappedId;
        mapped++;
      }
    });

    // 自动居中并缩放到与程序化模型相近的尺寸
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 5.2 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.sub(center.multiplyScalar(scale));
    model.position.y += 2.4;

    // 外部模型替换内置模型：内置模型隐藏但保留（动画系统仍作用于其引用）
    fallbackBuilder().visible = false;
    scene.add(model);
    statusEl.textContent = `GLB 模型已加载（${mapped} 个网格映射到部件标注）`;
    setTimeout(() => statusEl.classList.remove('show'), 4000);
    return model;
  } catch (err) {
    console.warn('[GLB] 加载失败，回退到内置程序化模型：', err);
    statusEl.textContent = 'GLB 加载失败，已切换内置模型';
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), 4000);
    return fallbackBuilder();
  }
}
