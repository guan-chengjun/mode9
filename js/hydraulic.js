/**
 * 液压机状态机：严格按真实液压机工作循环驱动
 *
 * 循环：待机 → 快速下行 → 慢速加压 → 保压 → 泄压 → 活塞回升 →（回到待机）
 * 每个阶段都包含真实液压系统的完整状态：
 *   - 三位四通换向阀阀芯位置（左位/中位/右位）
 *   - 6 条管路各自的油流方向与流速
 *   - 系统压力（压力表）、溢流阀开启度
 *   - 无杆腔/有杆腔油腔体积与压力颜色
 *   - 电机-泵转速、滑块位置、工件塑性形变
 */
import * as THREE from 'three';
import { PHASES, PHASE_ORDER, PIPE_IDS, MOTION } from './config.js';

/* 阶段运行 key（驼峰）→ PHASES 配置 key（大写下划线） */
const PHASE_KEY_TO_DEF = {
  idle: 'IDLE',
  fastDown: 'FAST_DOWN',
  press: 'PRESS',
  dwell: 'DWELL',
  decompress: 'DECOMPRESS',
  return: 'RETURN',
};

const clamp01 = v => Math.min(1, Math.max(0, v));
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/* 压力曲线辅助：加压段近似指数升压（负载阻力随变形增大），
 * 归一化系数 1/(1-e^-3.2) 保证阶段结束时精确达到 24MPa 溢流设定值 */
function pressPressure(t) {
  return 4 + 20 * (1 - Math.exp(-3.2 * t)) / (1 - Math.exp(-3.2));
}

/* ============ 各阶段完整液压状态定义 ============
 * flow: 各管路流速系数，+1 正向（沿管线建管方向），-1 反向，0 截止
 * spool: -1 左位(下行)  0 中位(保压/卸荷)  +1 右位(回程)
 */
const STATE = {
  idle: {
    spool: 0, pressure: 0.5, motorRate: 0.12, reliefOpen: 0,
    flow: { suction: 0, pressure: 0, A: 0, B: 0, T: 0, relief: 0 },
    upperPress: false, lowerPress: false,
  },
  fastDown: {
    spool: -1, pressure: 3, motorRate: 1, reliefOpen: 0,
    flow: { suction: 1, pressure: 1, A: 1, B: 1, T: 1, relief: 0 },
    upperPress: true, lowerPress: false,
  },
  press: {
    spool: -1, pressure: 24, motorRate: 1, reliefOpen: 1,
    flow: { suction: 1, pressure: 1, A: 1, B: 0.35, T: 0.35, relief: 0.7 },
    upperPress: true, lowerPress: false,
  },
  dwell: {
    spool: 0, pressure: 22, motorRate: 0.12, reliefOpen: 0.25,
    // 中位 P→T 卸荷：泵的小流量经溢流/回油脉动；A、B 腔封闭保压
    flow: { suction: 0.15, pressure: 0.15, A: 0, B: 0, T: 0.15, relief: 0.25 },
    upperPress: true, lowerPress: false,
  },
  decompress: {
    spool: 0, pressure: 22, motorRate: 0.12, reliefOpen: 0.6,
    // 上腔封闭压力经缓释放空，压力由 22→2，滑块不动
    flow: { suction: 0.1, pressure: 0.1, A: 0, B: 0, T: 0.1, relief: 0.5 },
    upperPress: true, lowerPress: false,
  },
  return: {
    spool: 1, pressure: 9, motorRate: 1, reliefOpen: 0,
    // 右位：P→B 有杆腔进油，A→T 无杆腔排油
    flow: { suction: 1, pressure: 1, A: -1, B: -1, T: 1, relief: 0 },
    upperPress: false, lowerPress: true,
  },
};

/* 油腔颜色：高压橙、回油蓝 */
const COL_HOT = new THREE.Color(0xffa31a);
const COL_COLD = new THREE.Color(0x2f7fd0);

export class HydraulicController {
  constructor(refs, particles) {
    this.refs = refs;
    this.particles = particles; // [{id, curve, particles:[{mesh,t}]}]
    this.running = false;
    this.speed = MOTION.speedDefault;
    this.phaseIndex = 0;
    this.phaseTime = 0;
    this.platenY = MOTION.platenHomeY;
    this.pressure = 0.5;
    this.spoolX = 0;
    this.reliefLift = 0;
    this.motorAngle = 0;
    this.needleAngle = 0;
    this._blend = {}; // 当前阶段实际混合后的状态
    this._resetBodies();
  }

  _resetBodies() {
    const r = this.refs;
    r.platenGroup.position.y = MOTION.platenHomeY;
    this._applyOilChambers();
    r.workpiece.scale.set(1, 1, 1);
    r.spool.position.x = 1.85;
    r.indicator.position.x = 1.85;
    r.poppet.position.y = 2.38;
    r.needlePivot.rotation.x = 0;
    for (const pipe of this.particles) {
      for (const p of pipe.particles) {
        p.mesh.visible = false;
        p.t = Math.random();
      }
    }
  }

  start() { this.running = true; };
  pause() { this.running = false; };
  reset() {
    this.running = false;
    this.phaseIndex = 0;
    this.phaseTime = 0;
    this.platenY = MOTION.platenHomeY;
    this.pressure = 0.5;
    this._blend = null;
    this.needleAngle = 0;
    this._resetBodies();
  }
  setSpeed(v) { this.speed = v; }

  get phaseKey() { return PHASE_ORDER[this.phaseIndex]; }
  get phaseLabel() {
    const def = PHASES[PHASE_KEY_TO_DEF[this.phaseKey]];
    return def ? def.label : '';
  }

  /** 根据阶段进度求滑块 y */
  _platenYFor(key, t) {
    switch (key) {
      case 'fastDown':
        return THREE.MathUtils.lerp(MOTION.platenHomeY, MOTION.platenContactY, easeInOut(t));
      case 'press':
        return THREE.MathUtils.lerp(MOTION.platenContactY, MOTION.platenEndY, t);
      case 'return':
        return THREE.MathUtils.lerp(MOTION.platenEndY, MOTION.platenHomeY, easeOutCubic(t));
      case 'dwell':
        return MOTION.platenEndY;
      case 'decompress':
        return MOTION.platenEndY;
      default:
        return MOTION.platenHomeY;
    }
  }

  /** 当前阶段的瞬时压力（MPa） */
  _pressureFor(key, t) {
    switch (key) {
      case 'fastDown': return 2 + 1.5 * easeInOut(t);
      case 'press':    return pressPressure(t);
      case 'dwell':    return 22 - 1.5 * t;
      case 'decompress': return THREE.MathUtils.lerp(20, 2, easeOutCubic(t));
      case 'return':   return 8 + Math.sin(t * Math.PI) * 2;
      default:         return 0.5;
    }
  }

  update(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    const r = this.refs;

    if (this.running) {
      this.phaseTime += dt * this.speed;
      const key = this.phaseKey;
      const duration = PHASES[PHASE_KEY_TO_DEF[key]].duration;
      const t = clamp01(this.phaseTime / duration);

      // 阶段推进
      if (this.phaseTime >= duration) {
        this.phaseIndex = (this.phaseIndex + 1) % PHASE_ORDER.length;
        this.phaseTime = 0;
      }

      // 滑块与压力
      if (key === 'idle') {
        // 回程结束后的待机段：平滑归位，避免滑块瞬间跳变
        this.platenY += (MOTION.platenHomeY - this.platenY) * Math.min(1, dt * 4 * this.speed);
      } else {
        this.platenY = this._platenYFor(key, t);
      }
      this.pressure = this._pressureFor(key, t);
      this._blend = STATE[key];
    } else if (!this._blend) {
      // 仅首次（尚未启动过）应用待机状态；暂停时整体冻结，不做任何更新
      this._blend = STATE.idle;
      this._applyOilChambers(this._blend);
      return;
    } else {
      // 暂停：保持当前画面，所有运动部件冻结
      return;
    }

    const s = this._blend;

    /* ---- 滑块 / 活塞组 ---- */
    r.platenGroup.position.y = this.platenY;

    /* ---- 工件塑性压缩：接触后随压板下压量形变（体积近似守恒） ---- */
    const penetration = clamp01(
      (MOTION.platenContactY - this.platenY) /
      (MOTION.platenContactY - MOTION.platenEndY)
    );
    const sy = 1 - penetration * 0.26;
    r.workpiece.scale.set(1 + penetration * 0.12, sy, 1 + penetration * 0.12);

    /* ---- 缸内两腔油液体积（随活塞位置实时变化） ---- */
    this._applyOilChambers(s);

    /* ---- 换向阀阀芯：平滑过渡到目标位 ---- */
    const targetSpoolX = 1.85 + s.spool * 0.13;
    r.spool.position.x += (targetSpoolX - r.spool.position.x) * Math.min(1, dt * 8);
    r.indicator.position.x = r.spool.position.x;

    /* ---- 溢流阀阀芯抬升 ---- */
    const targetLift = s.reliefOpen * 0.09;
    this.reliefLift += (targetLift - this.reliefLift) * Math.min(1, dt * 6);
    r.poppet.position.y = 2.38 + this.reliefLift;

    /* ---- 电机-泵旋转（保压/待机低速卸荷，工作全速） ---- */
    this.motorAngle += dt * 14 * s.motorRate * Math.max(0.25, this.speed);
    r.rotor.rotation.z = this.motorAngle;
    r.gear2.rotation.z = -this.motorAngle * 1.15;

    /* ---- 压力表指针：-120°(0MPa) → +120°(满量程)，绕表盘法线 x 轴 ---- */
    const targetNeedle = -2.094 + (this.pressure / MOTION.gaugeMaxMPa) * 4.188;
    this.needleAngle += (targetNeedle - this.needleAngle) * Math.min(1, dt * 7);
    r.needlePivot.rotation.x = this.needleAngle;

    /* ---- 管路流动粒子 ---- */
    this._updateParticles(dt, s);
  }

  _applyOilChambers(s = STATE.idle) {
    const r = this.refs;
    const headWorldY = this.platenY + r.headLocalY;
    const bottom = r.barrelBottom + 0.12;
    const top = r.barrelTopInner;

    // 上腔（无杆腔）：缸顶 → 活塞头顶面
    const upperH = Math.max(0.02, top - (headWorldY + r.headHalf));
    r.upperOil.scale.y = upperH;
    r.upperOil.position.y = top - upperH / 2;
    // 下腔（有杆腔）：活塞头底面 → 缸底导向套
    const lowerH = Math.max(0.02, (headWorldY - r.headHalf) - bottom);
    r.lowerOil.scale.y = lowerH;
    r.lowerOil.position.y = bottom + lowerH / 2;

    // 压力着色
    const hotColor = s.upperPress ? COL_HOT : COL_COLD;
    r.upperOil.material.color.lerp(hotColor, 0.12);
    const lowColor = s.lowerPress ? COL_HOT : COL_COLD;
    r.lowerOil.material.color.lerp(lowColor, 0.12);
  }

  _updateParticles(dt, s) {
    const flowMap = s.flow;
    const pipeKey = {
      [PIPE_IDS.SUCTION]: 'suction',
      [PIPE_IDS.PRESSURE]: 'pressure',
      [PIPE_IDS.A]: 'A',
      [PIPE_IDS.B]: 'B',
      [PIPE_IDS.T]: 'T',
      [PIPE_IDS.RELIEF]: 'relief',
    };
    for (const pipe of this.particles) {
      const rate = flowMap[pipeKey[pipe.id]] ?? 0;
      const speed = 0.32 * Math.abs(rate) * Math.max(0.25, this.speed);
      for (const p of pipe.particles) {
        if (Math.abs(rate) < 0.02) {
          p.mesh.visible = false;
          continue;
        }
        p.mesh.visible = true;
        p.t += dt * speed * Math.sign(rate) * (1 + p.t * 0); // 沿曲线参数推进
        // 循环
        if (p.t > 1) p.t -= 1;
        if (p.t < 0) p.t += 1;
        const pos = pipe.curve.getPointAt(clamp01(p.t));
        p.mesh.position.copy(pos);
        // 溢流/卸荷小流量做脉动闪烁
        if (Math.abs(rate) <= 0.3) {
          p.mesh.material.opacity = 0.35 + 0.55 * Math.abs(Math.sin(performance.now() * 0.008));
        } else {
          p.mesh.material.opacity = 0.95;
        }
      }
    }
  }
}
