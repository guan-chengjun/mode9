# 线上 GLB 三维模型接入指南

项目默认使用内置**程序化模型**：10 个部件全部可点击、与液压动画完整联动。
当需要替换为真实建模的 GLB 模型时，按本指南配置。

## 1. 配置地址

打开 `js/config.js`，修改 `MODEL_CONFIG`：

```js
export const MODEL_CONFIG = {
  glbUrl: 'https://your-cdn.com/hydraulic-press.glb',
  glbNameMap: {
    // GLB 内部网格名 : 本项目部件 id
    'Barrel':      'main-cylinder',
    'PistonRod':   'piston',
    'MovingPlaten':'upper-platen',
    'WorkTable':   'worktable',
    'Pump':        'pump',
    'OilTank':     'tank',
    'DirectionalValve': 'directional-valve',
    'ReliefValve': 'relief-valve',
    'Pipes':       'pipes',
    'Frame':       'frame',
  },
};
```

## 2. 部件 id 对照表

| 部件 id | 对应部件 |
|---------|----------|
| `main-cylinder` | 液压主油缸 |
| `piston` | 活塞与活塞杆 |
| `upper-platen` | 上压板（滑块） |
| `worktable` | 下工作台 |
| `pump` | 液压泵 + 电机 |
| `tank` | 液压油箱 |
| `directional-valve` | 三位四通换向阀 |
| `relief-valve` | 溢流阀 |
| `pipes` | 油管 |
| `frame` | 机架 |

## 3. 对 GLB 文件的要求

1. **格式**：glTF 2.0 二进制（`.glb`），建议用 Blender 导出时勾选 Y-up 转换、压缩纹理；
2. **CORS**：模型托管服务器必须允许跨域（响应头 `Access-Control-Allow-Origin: *`
   或允许当前站点 origin），否则浏览器会拦截加载；
3. **网格命名**：需要点击标注的网格按上表命名，或在 `glbNameMap` 中做名称映射；
   未映射网格正常显示，但不参与拾取；
4. **尺寸**：加载器会自动按包围盒归一化到约 5.2 m 高度并居中，无需手工对齐坐标；
5. **面数**：建议整体 ≤ 20 万三角面，保证浏览器流畅；纹理单张 ≤ 2K。

## 4. 加载行为说明

- 加载中：屏幕底部显示「正在加载线上 GLB 模型…」状态条；
- 成功：GLB 替换内置模型显示，状态条提示映射成功的网格数量；
- 失败（地址错误 / 跨域 / 网络超时）：控制台输出错误，**自动回退内置程序化模型**，
  页面其余功能（动画、透视、面板）完全不受影响。

## 5. GLB 模式的能力边界（重要）

液压动画的运动引用（滑块平移、阀芯滑动、油腔缩放、油流粒子、压力表指针）
绑定在程序化模型的对象上。GLB 模式下：

- ✅ 视角控制、透视切换 UI、部件点击标注（按名称映射的网格）正常可用；
- ⚠️ 动画仍驱动内置模型（此时被隐藏），外部 GLB 不会自动跟随运动。

**要获得完整动画联动，推荐两种做法：**

1. 直接使用内置程序化模型（默认，零配置，教学演示功能最完整）；
2. 在 Blender 中按程序化模型的层级组织 GLB（独立的滑块、活塞、阀芯、油腔网格），
   然后在 `js/glb-loader.js` 加载完成后，参照 `buildPress()` 返回的 `refs` 结构
   把 GLB 中的同名节点赋给 `HydraulicController` 的 refs 即可接管动画。

## 6. 本地验证 GLB

把模型放到项目任意目录（如 `assets/press.glb`），配置相对路径：

```js
glbUrl: './assets/press.glb',
```

通过本地服务器（见 README 第三节）访问，避免 file:// 限制。
