/**
 * 部件拾取与悬浮信息面板
 * - 鼠标悬停：指针变手型 + 部件橙色高亮
 * - 点击：弹出跟随锚点的信息面板（名称 / 作用 / 工作原理）
 * - 拖拽旋转不触发点击（按下与抬起位移超过阈值视为拖拽）
 */
import * as THREE from 'three';
import { PART_INFO } from './config.js';
import { setHighlight } from './materials.js';

export class InteractionManager {
  constructor(camera, domElement, parts, pickables, root) {
    this.camera = camera;
    this.dom = domElement;
    this.parts = parts;       // Map<partId, Mesh[]>
    this.pickables = pickables;
    this.root = root;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoveredId = null;
    this.selectedId = null;
    this.downPos = null;

    this.panel = document.getElementById('info-panel');
    this.anchorWorld = new THREE.Vector3();
    this._anchorObj = null;
    this._onClose = this._onClose.bind(this);
    document.getElementById('info-close').addEventListener('click', this._onClose);

    domElement.addEventListener('pointermove', e => this._onMove(e));
    domElement.addEventListener('pointerdown', e => {
      this.downPos = { x: e.clientX, y: e.clientY };
    });
    domElement.addEventListener('pointerup', e => this._onUp(e));
  }

  _setPointer(e) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pick(e) {
    this._setPointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    return hits.length ? hits[0] : null;
  }

  _onMove(e) {
    const hit = this._pick(e);
    const id = hit ? hit.object.userData.partId : null;
    if (id !== this.hoveredId) {
      if (this.hoveredId && this.hoveredId !== this.selectedId) {
        setHighlight(this.parts.get(this.hoveredId), false);
      }
      this.hoveredId = id;
      if (id && id !== this.selectedId) setHighlight(this.parts.get(id), true);
      this.dom.style.cursor = id ? 'pointer' : 'default';
    }
  }

  _onUp(e) {
    if (!this.downPos) return;
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    this.downPos = null;
    if (moved > 6) return; // 判定为轨道拖拽，不弹面板

    const hit = this._pick(e);
    if (!hit) {
      this._onClose();
      return;
    }
    const id = hit.object.userData.partId;
    this._select(id, hit.object);
  }

  _select(id, mesh) {
    if (this.selectedId && this.selectedId !== id) {
      setHighlight(this.parts.get(this.selectedId), false);
    }
    this.selectedId = id;
    setHighlight(this.parts.get(id), true);

    const info = PART_INFO[id];
    document.getElementById('info-title').textContent = info.name;
    document.getElementById('info-role').textContent = info.role;
    document.getElementById('info-principle').textContent = info.principle;
    this.panel.classList.add('open');
  }

  /** 每帧调用：让信息面板跟随所选部件的实时包围盒中心（运动部件也能跟住） */
  update() {
    if (!this.panel.classList.contains('open') || !this.selectedId) return;

    const box = new THREE.Box3().setFromObjects(this.parts.get(this.selectedId));
    box.getCenter(this.anchorWorld);
    const v = this.anchorWorld.clone().project(this.camera);

  _onClose() {
    if (this.selectedId) {
      setHighlight(this.parts.get(this.selectedId), false);
      this.selectedId = null;
    }
    this.panel.classList.remove('open');
  }

  /** 每帧调用：让信息面板跟随 3D 锚点投影位置 */
  update() {
    if (!this.panel.classList.contains('open')) return;
    const v = this.anchorWorld.clone().project(this.camera);
    const rect = this.dom.getBoundingClientRect();
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;

    const pw = this.panel.offsetWidth;
    const ph = this.panel.offsetHeight;
    let px = x + 18;
    let py = y - ph / 2;
    // 防止面板超出视口
    px = Math.min(Math.max(12, px), rect.width - pw - 12);
    py = Math.min(Math.max(12, py), rect.height - ph - 12);
    this.panel.style.transform = `translate(${px}px, ${py}px)`;
    this.panel.style.opacity = v.z > 1 ? 0.25 : 1; // 锚点在相机背后时淡出
  }
}
