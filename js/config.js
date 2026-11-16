/**
 * 全局配置：部件资料、液压时序、管线定义、可选 GLB 模型地址
 * 所有可调参数集中在此文件，便于二次开发
 */

/* ============ 可选：线上 GLB 模型 ============
 * 留空字符串时使用内置程序化模型（默认，10 个部件全部可点击、动画完整）。
 * 填入 URL 后会优先加载该 GLB；若加载失败自动回退到程序化模型。
 * 注意：外部 GLB 的网格命名需要在 glbNameMap 中映射到部件 id，
 *       映射不到的网格仍可显示，但不会有点击标注与动画联动。
 */
export const MODEL_CONFIG = {
  glbUrl: '',
  // 示例：glbUrl: 'https://example.com/your-hydraulic-press.glb',
  glbNameMap: {
    // 外部 GLB 中的网格名 : 内部部件 id
    // 'Cylinder_Barrel': 'main-cylinder',
    // 'Piston_Rod': 'piston',
  },
};

/* ============ 部件 id 常量 ============ */
export const PART_IDS = {
  CYLINDER: 'main-cylinder',   // 液压主油缸
  PISTON: 'piston',            // 活塞（含活塞杆）
  PLATEN: 'upper-platen',      // 上压板（滑块）
  TABLE: 'worktable',          // 下工作台
  PUMP: 'pump',                // 液压泵（含电机）
  TANK: 'tank',                // 液压油箱
  DVALVE: 'directional-valve',// 换向阀
  RVALVE: 'relief-valve',      // 溢流阀
  PIPES: 'pipes',              // 油管
  FRAME: 'frame',              // 机架
};

/* ============ 10 个核心部件资料（点击信息面板内容） ============ */
export const PART_INFO = {
  [PART_IDS.FRAME]: {
    name: '机架（机身）',
    role: '承载液压机全部工作载荷，固定主油缸、工作台与导轨，保证压制时机身刚度与压头对中精度。',
    principle: '由上横梁（ crown ）、工作台底座和四根立柱组成门式框架。压制时主油缸的反作用力通过上横梁、立柱、底座形成封闭力系，工作台承受工件的反向支撑力，立柱承受拉应力。三梁四柱式结构是中小吨位液压机最典型的布局。',
  },
  [PART_IDS.CYLINDER]: {
    name: '液压主油缸',
    role: '将液压能转换为直线往复机械能的执行元件，输出压制所需的巨大推力，是整台机器的“出力部件”。',
    principle: '缸筒内由活塞分隔为无杆腔（上腔）和有杆腔（下腔）。高压油进入无杆腔时，作用在活塞全面积上产生推力 F = p·A；换向之后压力油进入有杆腔，作用面积为环形面积 A₁−A₂，推动活塞快速回升。缸筒两端设有端盖、导向套与密封件，防止高压油泄漏并为活塞杆导向。',
  },
  [PART_IDS.PISTON]: {
    name: '活塞与活塞杆',
    role: '活塞把油压力变成机械推力，活塞杆把推力传递给上压板，带动滑块完成下压、保压和回程动作。',
    principle: '活塞与缸筒内壁之间用密封圈分隔两腔，压差即驱动力。下行时无杆腔进油、有杆腔回油，活塞下移；回程时有杆腔进油、无杆腔排油，因环形作用面积小，相同流量下回程速度更快、推力较小。活塞杆表面镀铬磨削，通过导向套伸出缸外并承受一定偏载。',
  },
  [PART_IDS.PLATEN]: {
    name: '上压板（滑块 / 动梁）',
    role: '安装模具上模，沿立柱导轨上下运动，把活塞杆的推力均匀施加到工件上完成压制。',
    principle: '滑块四角装有导套（衬套）套在立柱上，保证上下模精确对中、抵抗偏载。快速下行阶段滑块靠自重与泵油共同作用快速接近工件；接触工件后阻力增大、系统压力升高，自动转入慢速加压阶段，使材料平稳成形。',
  },
  [PART_IDS.TABLE]: {
    name: '下工作台',
    role: '安装下模并放置工件，承受全部压制反力，台面上的 T 形槽用于螺栓固定模具。',
    principle: '工作台与底座连成一体，把工件的反力直接传入机架形成封闭力环。台面经过精加工保证与滑块运动方向垂直；演示中工件在受压时产生微小压缩形变，模拟真实材料的塑性变形过程。',
  },
  [PART_IDS.PUMP]: {
    name: '液压泵 + 驱动电机',
    role: '液压系统的动力源。电机驱动泵从油箱吸油，把机械能转换成油液的压力能，向整个系统供给高压油。',
    principle: '演示采用齿轮泵示意：一对啮合齿轮旋转时，脱啮侧容积增大形成负压吸油，啮合侧容积减小把油液挤出排油口，实现连续供油。系统压力不由泵“决定”，而是由外负载决定——负载越大，泵出口压力越高，直到顶开溢流阀限定最高压力。',
  },
  [PART_IDS.TANK]: {
    name: '液压油箱',
    role: '储存系统所需液压油，同时兼起散热、沉淀杂质、分离油中空气和水分的作用。',
    principle: '泵吸油管从油箱低位吸油，系统回油经回油管送回油箱液面以下，吸、回油区之间用隔板隔开，避免回油气泡直接被泵吸入（防止气穴）。油箱顶部设空气滤清器与注油口，侧面设液位计；长时间工作的热量通过油箱壁面散发到空气。',
  },
  [PART_IDS.DVALVE]: {
    name: '三位四通电磁换向阀',
    role: '液压系统的“交通指挥”，通过阀芯滑动切换油口连通关系，控制活塞的下行、停止保压与回程方向。',
    principle: '阀体有 P（进油）、T（回油）、A（接无杆腔）、B（接有杆腔）四个油口。阀芯有三个位置：左位 P→A、B→T，活塞下行；中位 P→T 卸荷、A·B 封闭（配合液控单向阀实现保压）；右位 P→B、A→T，活塞回程。演示中可看到阀芯随工序左右移动。',
  },
  [PART_IDS.RVALVE]: {
    name: '溢流阀（安全阀）',
    role: '限定系统最高压力，防止过载损坏泵、缸和机架；加压到位时溢出多余流量，起定压与安全保护双重作用。',
    principle: '阀芯背后有弹簧预紧力，设定开启压力（演示约 24 MPa）。泵出口压力低于设定值时阀口关闭；压制受阻、压力升到设定值时阀芯被顶开，多余油液经溢流管泄回油箱，系统压力被钳制在设定值附近。可把它理解为液压系统的“保险丝 + 稳压阀”。',
  },
  [PART_IDS.PIPES]: {
    name: '液压管路（油管）',
    role: '连接油箱、泵、阀与油缸，输送压力油和回油，是液压能量传递的“血管”。',
    principle: '吸油管（油箱→泵）管径最粗、流速低，防止吸空；压油管（泵→阀、阀→缸）承受高压，按流速 3~6 m/s 选径；回油管（阀→油箱）压力接近零。演示中流动粒子表示油流方向：暖色为高压供油、蓝色为低压回油，可结合换向阀位置对照观察油路切换。',
  },
};

/* ============ 液压工作循环时序（速度倍率 = 1 时的秒数） ============ */
export const PHASES = {
  IDLE:       { key: 'idle',       label: '待机',     duration: 1.2 },
  FAST_DOWN:  { key: 'fastDown',   label: '快速下行', duration: 2.0 },
  PRESS:      { key: 'press',      label: '慢速加压', duration: 3.2 },
  DWELL:      { key: 'dwell',      label: '保压',     duration: 2.6 },
  DECOMPRESS: { key: 'decompress', label: '泄压',     duration: 0.9 },
  RETURN:     { key: 'return',     label: '活塞回升', duration: 2.6 },
};
export const PHASE_ORDER = ['idle', 'fastDown', 'press', 'dwell', 'decompress', 'return'];

/* ============ 运动学参数 ============ */
export const MOTION = {
  platenHomeY: 2.9,      // 上压板初始（最上）中心高度
  platenContactY: 1.225, // 接触工件瞬间的中心高度
  platenEndY: 1.13,      // 加压终了中心高度（工件被压缩）
  workpieceTopY: 1.05,   // 工件初始顶面高度
  gaugeMaxMPa: 30,       // 压力表满量程
  reliefSetMPa: 24,      // 溢流阀开启压力
  speedMin: 0.25,
  speedMax: 3,
  speedDefault: 1,
};

/* ============ 管线 id 与显示色 ============ */
export const PIPE_IDS = {
  SUCTION:  'pipe-suction',  // 吸油管 油箱→泵
  PRESSURE: 'pipe-pressure', // 压油管 泵→换向阀P
  A:        'pipe-a',        // 无杆腔管 阀A↔缸上腔
  B:        'pipe-b',        // 有杆腔管 阀B↔缸下腔
  T:        'pipe-t',        // 回油管 阀T→油箱
  RELIEF:   'pipe-relief',   // 溢流管 溢流阀→油箱
};

export const PIPE_COLORS = {
  [PIPE_IDS.SUCTION]:  0x66ccff, // 浅蓝：吸油
  [PIPE_IDS.PRESSURE]: 0xff5533, // 红：高压供油
  [PIPE_IDS.A]:        0xff8822, // 橙：无杆腔高压
  [PIPE_IDS.B]:        0xffcc33, // 黄：有杆腔
  [PIPE_IDS.T]:        0x44aaff, // 蓝：回油
  [PIPE_IDS.RELIEF]:   0xff2244, // 深红：溢流
};
