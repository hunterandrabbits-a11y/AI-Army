/* AI数班 PC office-first prototype V2. */
(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const digitalEmployeeLabel = (employee) => {
    if (!employee) return "";
    const name = employee.name || employee.persona || employee.role || "";
    const role = employee.role || employee.persona || "";
    return role && role !== name ? `${name} · ${role}` : name;
  };
  const HIRE_KEY = "ai-legion-prd-hired-employees-v1";
  const RESERVE_KEY = "ai-legion-prd-reserved-employees-v1";
  const GUIDE_KEY = "ai-office-first-guide-v2";
  const MEMORY_KEY = "ai-office-soul-v2";
  const MOCK_MEMORY_SEEDED_KEY = "ai-office-mock-memory-v1";
  const SETTINGS_KEY = "ai-office-agent-settings-v2";
  const ACCOUNT_KEY = "ai-legion-prd-accounts-v1";
  const WUJIAN_KEY = "ai-office-wujian-workspace-v1";
  const WUJIAN_CASE_COVER_REV = "20260813-cover-fix";
  const FRAME_PATH = "assets/snapshots/0804-rpa/frame-";
  const LIVE_VIDEO_PATH = "assets/snapshots/0804-rpa/0804-rpa.mp4";
  const SMART_REPLY_VIDEO_PATH = "assets/snapshots/chen-service/chen-service.mp4";
  const WUJIAN_LIVE_VIDEO_PATH = "assets/wujian/creative-center-publish.mp4";
  const FIXED_AGENT_SKILLS = [
    "挖掘直播潜客", "挖掘短视频潜客", "挖掘粉丝潜客", "判断潜客意向",
    "私信触达潜客", "转化话术设计", "数据报告",
  ];
  const reservedMemory = new Set();
  let reservationsHydrated = false;
  let requestedKnowledgeTab = "dialog";

  const snapshotFrames = [
    { file: "01", time: "00:04", action: "进入工作台，读取今日任务队列", status: "已连接" },
    { file: "02", time: "00:11", action: "打开客户任务，确认账号权限和工作范围", status: "已检查" },
    { file: "03", time: "00:18", action: "筛选包含车型、预算或到店时间的互动记录", status: "已完成" },
    { file: "04", time: "00:25", action: "读取页面内容，提取客户原话和意向信号", status: "分析中" },
    { file: "05", time: "00:32", action: "按门店规则判断意向，生成首轮触达内容", status: "执行中" },
    { file: "06", time: "00:39", action: "检查触达结果，标记需要人工确认的优惠问题", status: "已校验" },
    { file: "07", time: "00:46", action: "回写客户、车型、城市和触达结果", status: "已回写" },
    { file: "08", time: "00:53", action: "归档本次任务，将可跟进结果交给成果中心", status: "已回传" },
  ];

  const smartReplySnapshotFrames = [
    { time: "00:00", action: "进入客服工作台，读取待接待会话队列", status: "已连接" },
    { time: "00:03", action: "查看客户原话，确认车型和咨询意图", status: "已分析" },
    { time: "00:06", action: "检索车型库和门店政策，准备回复依据", status: "检索中" },
    { time: "00:09", action: "生成回复并检查价格承诺边界", status: "已校验" },
    { time: "00:12", action: "发送客户回复，更新会话处理结果", status: "已发送" },
  ];

  const conversationSnapshots = [
    { customer: "X70L 现在大概多少钱？", judgement: "价格咨询 · 中意向", reply: "我先把官方指导价和当前门店政策说清楚，具体优惠会再请门店顾问确认。", result: "已回复" },
    { customer: "预算 15 万，周末能试驾吗？", judgement: "预算 + 试驾 · 高意向", reply: "可以。你在哪个城市？我帮你匹配最近门店和可预约时间。", result: "已留资" },
    { customer: "你们能保证比别家便宜两万吗？", judgement: "特殊承诺 · 高风险", reply: "这类价格承诺需要门店人员确认，我已保留你的问题和车型需求。", result: "已转人工" },
    { customer: "我在苏州，想看七座 SUV。", judgement: "城市 + 车型需求 · 中意向", reply: "明白，我会先按七座、家用空间和苏州在售范围帮你整理可选车型。", result: "持续跟进" },
    { customer: "先发点资料吧，还没想好。", judgement: "资料索取 · 低意向", reply: "好的，我先发一份简明车型介绍，不频繁打扰你。", result: "已培育" },
  ];

  const smartReplyHandoffPrompts = [
    { id: "li", name: "李女士", topic: "价格优惠", quote: "如果今天不说清楚，我就不考虑了。", reason: "客户语气变急，要求马上给明确答复", time: "2 分钟前", tone: "negative", live: { name: "李女士", initial: "李", copy: "如果今天不说清楚，我就不考虑了。", tag: "需人工介入", detail: "客户要求明确价格承诺，已暂停自动回复。", need: "确认今天可用的优惠范围" } },
    { id: "zhang", name: "张先生", topic: "提车后异响", quote: "车提回来就有异响，这个要找谁处理？", reason: "客户在问售后处理，不能继续用常规话术回复", time: "5 分钟前", tone: "after-sales", live: { name: "张先生", initial: "张", copy: "车提回来就有异响，这个要找谁处理？", tag: "需人工介入", detail: "客户反馈提车后的售后问题，已暂停自动回复。", need: "确认售后联系人和回访时间" } },
    { id: "zhou2", name: "周先生", topic: "退订咨询", quote: "我想退订，已经等了两天还没人回复。", reason: "客户已经等待较久，需要人工给明确时间", time: "11 分钟前", tone: "after-sales", live: { name: "周先生", initial: "周", copy: "我想退订，已经等了两天还没人回复。", tag: "需人工介入", detail: "客户提出退订诉求并等待较久，已暂停自动回复。", need: "确认退订流程和处理时间" } },
  ];

  const smartReplyDailyBriefing = "今天我接待了 1298 个客户的咨询，都在 3 分钟内回应了客户，引导了 50 个客户进行留资，但是有 5 个客户需要人工介入，我已经暂停回复。";

  const wuJianTemplates = [
    {
      id: "uploaded-car-case-01", tag: "实车测评", title: "别人开车放手机，我开车也放手机？", vehicle: "车内收纳 · 实车画面",
      cover: `assets/wujian/cases/car-case-01.jpg?v=${WUJIAN_CASE_COVER_REV}`, video: "assets/wujian/cases/car-case-01.mp4", duration: "00:11", ratio: "9:16", model: "Seedance 2.5",
      style: "真实测评", hook: "同一个车内收纳位，换个使用场景就能形成反差钩子。",
      script: "镜头 1｜3 秒钩子：对比“别人开车放手机”和“我开车放手机”，先把差异抛出来。\n镜头 2｜4 秒展示：连续切换中控台、手机和手部动作，突出空间细节。\n镜头 3｜4 秒结论：回到完整车内画面，字幕收束使用场景。",
      result: "用户上传 · 11 秒灵感",
      caseGroup: "test", source: "用户上传",
    },
    {
      id: "uploaded-car-case-02", tag: "车型口播", title: "这台车的动力，车主这样说", vehicle: "动力体验 · 真人口播",
      cover: `assets/wujian/cases/car-case-02.jpg?v=${WUJIAN_CASE_COVER_REV}`, video: "assets/wujian/cases/car-case-02.mp4", duration: "01:07", ratio: "9:16", model: "MiniMax H3",
      style: "顾问口播", hook: "真人出镜 + 车型观点 + 连续反应，适合复用成汽车口播结构。",
      script: "镜头 1｜开场：人物站在车旁，用一句结论抓住注意力。\n镜头 2｜主体：围绕动力、颜值和驾驶感受连续表达，字幕跟随口播节奏。\n镜头 3｜收束：保留一个反问，引导观众留言自己的用车感受。",
      result: "用户上传 · 1 分 07 秒灵感",
      caseGroup: "talk", source: "用户上传",
    },
    {
      id: "uploaded-car-case-03", tag: "展厅大片", title: "女司机来了：一镜看懂跑车细节", vehicle: "跑车细节 · 展厅视觉",
      cover: `assets/wujian/cases/car-case-03.jpg?v=${WUJIAN_CASE_COVER_REV}`, video: "assets/wujian/cases/car-case-03.mp4", duration: "00:11", ratio: "9:16", model: "Seedance 2.5",
      style: "科技感 TVC", hook: "展厅灯光、低机位和细节特写组合成高质感车型展示。",
      script: "镜头 1｜开场：展厅环境和整车轮廓先建立视觉记忆。\n镜头 2｜细节：轮毂、车灯和车身线条用低机位连续推进。\n镜头 3｜收束：回到整车远景，用一句“女司机来了”完成记忆点。",
      result: "用户上传 · 11 秒灵感",
      caseGroup: "visual", source: "用户上传",
    },
    {
      id: "rear-space", tag: "抖音爆款", title: "后排空间真人实测", vehicle: "星途 E7 纯电旗舰版",
      cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "30 秒", ratio: "9:16", model: "Seedance 2.5",
      style: "真实测评", hook: "1 米 85 的我坐进 E7 后排，膝部空间竟然还有两拳？",
      script: "镜头 1｜3 秒钩子：1 米 85 体验者坐入后排，字幕突出“两拳空间”。\n镜头 2｜12 秒实测：展示腿部、头部与中央地台，引用车型库尺寸。\n镜头 3｜10 秒场景：放入儿童座椅与行李箱，说明家庭出行体验。\n镜头 4｜5 秒行动：评论区回复“空间”，领取同级车型实测对比。",
      result: "同类实测平均完播率 31.8% · 获客 18 条",
      caseGroup: "test",
    },
    {
      id: "range-challenge", tag: "实测挑战", title: "长续航通勤挑战", vehicle: "星途 E7 长续航版",
      cover: "assets/vehicles/e7-longrange-2024.jpg", duration: "45 秒", ratio: "9:16", model: "MiniMax H3",
      style: "纪录片感", hook: "满电从上海开到杭州，E7 到底还剩多少续航？",
      script: "镜头 1｜出发：满电表显与上海地标同框。\n镜头 2｜高速：记录空调、车速和实时能耗，不使用未经确认的数据。\n镜头 3｜抵达：杭州门店前展示剩余续航与全程里程。\n镜头 4｜总结：说明测试条件，引导预约同路线试驾。",
      result: "同类挑战平均互动率 8.6% · 试驾预约 11 条",
      caseGroup: "test",
    },
    {
      id: "family-suv", tag: "达人口播", title: "家庭 SUV 选车三问", vehicle: "风云 T9 120 长续航版",
      cover: "assets/vehicles/fengyun-t9-120-2025.jpg", duration: "30 秒", ratio: "9:16", model: "Seedance 2.5",
      style: "顾问口播", hook: "家里有两个孩子，选七座 SUV 先别急着看配置表。",
      script: "口播开场：家庭选七座 SUV，先回答三个问题。\n问题一：第三排是否真的能坐成年人；问题二：满员后行李还能不能放；问题三：日常通勤能耗是否可控。\n结合风云 T9 实车画面逐项说明，价格与权益只引用已确认的车型库口径。\n结尾邀请用户留言家庭人数，生成个性化选车建议。",
      result: "同类口播平均播放 12.4 万 · 留资 23 条",
      caseGroup: "talk",
    },
    {
      id: "smart-cockpit", tag: "AI 炫酷视觉", title: "智能座舱夜景大片", vehicle: "星途瑶光四驱版",
      cover: "assets/vehicles/yaoguang-4wd-2024.jpg", duration: "20 秒", ratio: "9:16", model: "MiniMax H3",
      style: "科技感 TVC", hook: "当城市入夜，车内每一束光都在回应你。",
      script: "0-3 秒：城市灯光掠过车身，切入座舱氛围灯。\n3-12 秒：屏幕、语音交互、座椅与音响细节快速蒙太奇。\n12-17 秒：夜间行驶氛围镜头，字幕使用已确认功能名称。\n17-20 秒：品牌收束与到店体验引导。",
      result: "同类视觉片平均收藏率 4.9% · 分享 2,310 次",
      caseGroup: "visual",
    },
  ];

  const wuJianAssets = {
    works: [
      { id: "work-e7-space", name: "E7 后排空间实测_终版.mp4", type: "视频", meta: "00:30 · 1080 × 1920", cover: "assets/vehicles/e7-flagship-2025.jpg" },
      { id: "work-t9-family", name: "风云 T9 家庭口播_竖版.mp4", type: "视频", meta: "00:32 · 1080 × 1920", cover: "assets/vehicles/fengyun-t9-120-2025.jpg" },
      { id: "work-yaoguang", name: "瑶光智能座舱_封面.jpg", type: "图片", meta: "1080 × 1440", cover: "assets/vehicles/yaoguang-4wd-2024.jpg" },
    ],
    history: [
      { id: "case-uploaded-car-case-01-visual", name: "车内收纳对比 · 画面参考", type: "图片", meta: "来自汽车视频灵感 · 9:16", cover: "assets/wujian/cases/car-case-01.jpg" },
      { id: "case-uploaded-car-case-02-visual", name: "真人口播车型展示 · 画面参考", type: "图片", meta: "来自汽车视频灵感 · 9:16", cover: "assets/wujian/cases/car-case-02.jpg" },
      { id: "case-uploaded-car-case-03-visual", name: "跑车展厅细节 · 画面参考", type: "图片", meta: "来自汽车视频灵感 · 9:16", cover: "assets/wujian/cases/car-case-03.jpg" },
      { id: "history-showroom", name: "上海门店展厅走拍.mp4", type: "视频", meta: "08-08 上传 · 146 MB", cover: "assets/live/ai-lead-live.jpg" },
      { id: "history-delivery", name: "E7 用户交付合影.jpg", type: "图片", meta: "08-07 上传 · 4.2 MB", cover: "assets/vehicles/e7-yueye-2025.jpg" },
      { id: "history-detail", name: "内饰细节画面组", type: "图片组", meta: "12 张 · 可直接使用", cover: "assets/vehicles/lingyun-300t-2025.jpg" },
    ],
    roles: [
      { id: "role-wujian", name: "短视频运营专员", type: "数字人口播", meta: "正面半身 · 已授权", cover: "assets/talent-portraits/ai-video.jpg" },
      { id: "role-advisor", name: "林顾问 · 上海门店", type: "真人出镜", meta: "3 段视频 · 授权至 2027-08", cover: "assets/portraits/lin-xia.jpg" },
      { id: "role-owner", name: "周女士 · 真实车主", type: "用户证言", meta: "2 段视频 · 单次项目授权", cover: "assets/portraits/zhou-ye.jpg" },
    ],
    vehicles: [
      { id: "vehicle-e7", name: "星途 E7 纯电旗舰版", type: "车型库", meta: "在售 · 24 张已审核图片", cover: "assets/vehicles/e7-flagship-2025.jpg" },
      { id: "vehicle-t9", name: "风云 T9 120 长续航版", type: "车型库", meta: "在售 · 18 张已审核图片", cover: "assets/vehicles/fengyun-t9-120-2025.jpg" },
      { id: "vehicle-yaoguang", name: "星途瑶光四驱版", type: "车型库", meta: "在售 · 16 张已审核图片", cover: "assets/vehicles/yaoguang-4wd-2024.jpg" },
      { id: "vehicle-lingyun", name: "星途凌云 300T", type: "车型库", meta: "在售 · 14 张已审核图片", cover: "assets/vehicles/lingyun-300t-2025.jpg" },
    ],
  };

  const wuJianWorks = [
    { id: "video-1001", title: "1 米 85 实测 E7 后排，两拳空间是真的吗？", cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30", time: "今天 10:30", account: "鸿途汽车官方旗舰店", status: "success", views: "12.6万", likes: "8,492", comments: "621", favorites: "1,208", shares: "436" },
    { id: "video-1002", title: "风云 T9：家庭七座 SUV 先看这三个细节", cover: "assets/vehicles/fengyun-t9-120-2025.jpg", duration: "00:32", time: "今天 18:30", account: "鸿途汽车上海店", status: "scheduled", views: "—", likes: "—", comments: "—", favorites: "—", shares: "—" },
    { id: "video-1003", title: "满电从上海开到杭州，E7 续航挑战", cover: "assets/vehicles/e7-longrange-2024.jpg", duration: "00:45", time: "昨天 16:20", account: "鸿途汽车官方旗舰店", status: "failed", views: "—", likes: "—", comments: "—", favorites: "—", shares: "—", error: "抖音触发设备验证，请人工完成后重试" },
    { id: "video-1004", title: "当城市入夜，瑶光智能座舱醒了", cover: "assets/vehicles/yaoguang-4wd-2024.jpg", duration: "00:20", time: "08-08 20:00", account: "鸿途汽车官方旗舰店", status: "success", views: "8.9万", likes: "5,310", comments: "284", favorites: "976", shares: "312" },
    { id: "video-1005", title: "黑色 E7 夜间城市高架体验", cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30", time: "今天 15:20", account: "鸿途汽车官方旗舰店", status: "review", releaseMode: "now", views: "—", likes: "—", comments: "—", favorites: "—", shares: "—" },
    { id: "video-1006", title: "风云 T9 满员出行空间实测", cover: "assets/vehicles/fengyun-t9-120-2025.jpg", duration: "00:30", time: "今天 15:45", account: "鸿途汽车上海店", status: "review", releaseMode: "scheduled", scheduleAt: "明天 18:30", views: "—", likes: "—", comments: "—", favorites: "—", shares: "—" },
    { id: "video-1007", title: "E7 后排空间实测 · 生成任务", cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30", time: "今天 16:05", account: "鸿途汽车官方旗舰店", status: "generation-failed", views: "—", likes: "—", comments: "—", favorites: "—", shares: "—" },
  ];

  const employees = {
    "lead-hunter": {
      name: "主号获客专家", role: "主号获客专家", badge: "主", platform: "抖音",
      status: "working", task: "正在筛选直播间里的购车信号", progress: 68,
      goal: "发现并触达明确询价、预算或试驾需求的客户",
      next: "把高意向客户交给客服专员做首轮需求确认",
      last: "刚刚完成一轮直播弹幕筛选",
      greeting: "已筛到 24 位潜客，6 位留资；3 条高意向线索继续跟进。",
      cost: "¥90", outcome: "24 位潜客 · 6 条留资",
      fixedFlow: ["读取弹幕/评论/关注", "提取车型和预算信号", "判断意向", "生成首轮触达", "等待回复", "回传留资"],
      adjustable: ["意向高低判断", "触达话术内容", "话术风格", "必须人工确认的场景"],
    },
    "lead-hunter-advanced": {
      name: "副号获客专家", role: "副号获客专家", badge: "副", platform: "抖音",
      status: "working", task: "正在独立筛选直播间里的购车信号", progress: 68,
      goal: "发现并触达明确询价、预算或试驾需求的客户",
      next: "把高意向客户独立回传至成果中心",
      last: "刚刚完成一轮独立直播弹幕筛选",
      greeting: "独立筛到 24 位潜客，6 位留资；高意向线索已回传。",
      cost: "¥90", outcome: "24 位潜客 · 6 条留资",
      fixedFlow: ["读取弹幕/评论/关注", "提取车型和预算信号", "判断意向", "生成首轮触达", "等待回复", "回传留资"],
      adjustable: ["意向高低判断", "触达话术内容", "话术风格", "必须人工确认的场景"],
    },
    "smart-reply": {
      name: "客服专员", role: "客服专员", badge: "客", platform: "抖音 / 快手 / 小红书",
      status: "waiting", task: "2 个价格相关会话等待你确认", progress: 82,
      goal: "第一时间接住客户私信，说清楚并留下可跟进信息",
      next: "确认价格口径后继续回复，特殊承诺仍交给人工",
      last: "2 分钟前保留了两个会话上下文",
      greeting: "有 2 个价格会话待确认，我已暂停发送并保留上下文。",
      cost: "¥36", outcome: "204 个会话 · 8 次人工介入",
      fixedFlow: ["接收客户私信", "识别问题和意向", "查找门店知识", "生成回复", "检查人工边界", "回复或转人工"],
      adjustable: ["回复风格", "意向判断", "工作时间", "转人工规则"],
    },
    "ai-video": {
      name: "短视频运营专员", role: "短视频运营专员", badge: "短", platform: "抖音",
      status: "working", task: "正在推进账号矩阵的本周发布任务", progress: 64,
      goal: "完成抖音账号矩阵的快速孵化，按发布任务批量分发短视频并回收效果",
      next: "处理待发布作品与账号待办",
      last: "3 分钟前完成一批账号的发布排期",
      greeting: "老板，今天的发布任务正在按计划执行：14 个账号中 6 个已完成发布、3 个发布中、4 个排队，1 个因营销授权过期暂停；本周已发布 535 条。我会先处理授权，再完成剩余账号发布并回收播放、互动和线索数据。",
      cost: "¥5 / 账号 / 天", outcome: "本周已发布 535 条 · 14 个账号",
      fixedFlow: ["接入账号", "确定发布计划", "准备内容", "发布", "回收效果"],
      adjustable: ["账号范围", "每周发布目标", "审核方式", "发布时段", "内容来源"],
    },
  };

  const statusMeta = {
    coordinating: { label: "协调中", copy: "正在整理团队目标和待办" },
    working: { label: "工作中", copy: "正在执行当前任务" },
    waiting: { label: "需要你", copy: "有一项判断需要你确认" },
    learning: { label: "学习中", copy: "没有新任务，正在阅读已有知识和案例" },
    paused: { label: "已暂停", copy: "工作已暂停，等待你恢复" },
    auth: { label: "授权异常", copy: "账号权限不足，需要恢复后继续" },
  };

  const deskReportCopy = {
    "lead-hunter": {
      working: ["我正在筛选直播间里的购车信号", "刚找到 3 条值得继续跟进的信息", "下一步把高意向客户交给客服专员"],
      waiting: ["有 2 个价格会话需要你确认", "我先暂停发送，避免做出未确认的承诺", "你确认口径后，我会从这里继续"],
      auth: ["抖音账号授权掉线了", "我已停在对外触达前，客户上下文还在", "恢复授权后，我会继续处理当前线索"],
      paused: ["我已经暂停，当前线索上下文已保留", "你准备好后，我会从原来的节点继续", "这批客户不会丢，随时可以恢复"],
      learning: ["我在复盘门店案例和高意向样本", "暂时没有新任务，我先把判断规则学扎实", "有新的目标，直接告诉我就好"],
    },
    "lead-hunter-advanced": {
      working: ["我正在独立筛选直播间里的购车信号", "刚找到 3 条值得继续跟进的信息", "下一步把副号获客专家的线索独立回传成果中心"],
      waiting: ["有 2 个价格会话需要你确认", "我先暂停发送，避免做出未确认的承诺", "你确认口径后，我会从这里继续"],
      auth: ["副号获客专家的抖音账号授权掉线了", "我已停在对外触达前，独立客户上下文还在", "恢复授权后，我会继续处理当前线索"],
      paused: ["我已经暂停，副号获客专家的当前线索上下文已保留", "你准备好后，我会从原来的节点继续", "这批客户不会丢，随时可以恢复"],
      learning: ["我在独立复盘门店案例和高意向样本", "暂时没有新任务，我先把判断规则学扎实", "有新的目标，直接告诉我就好"],
    },
    "smart-reply": {
      working: ["我正在接待客户私信，先把问题说清楚", "刚完成一轮知识检索和回复检查", "需要人工确认的内容，我会先替你拦住"],
      waiting: ["有事情需要你确认，我先替你稳住客户", "价格口径不确定，我没有擅自发送", "你确认后，我会带着完整上下文继续"],
      auth: ["客服账号授权需要恢复", "我暂时停在发送前，不会丢失会话", "授权恢复后，我会从当前客户继续"],
      paused: ["我已暂停回复，客户上下文已经保留", "你处理好后，我可以继续接待", "这几条会话会留在待办里等你"],
      learning: ["我正在学习新的门店问答和回复案例", "先把容易混淆的价格政策整理好", "有新的规则，可以直接教给我"],
    },
    "ai-video": {
      working: ["正在为 100 个账号推进本周发布计划", "本周已完成 224 条内容的排期与发布", "下一步回收播放、互动与线索"],
      waiting: ["有 24 项内容等待你确认", "审核通过后按排期自动发布", "确认一项，发布一项"],
      auth: ["部分账号授权需要续期", "未到期账号照常按计划发布", "完成续期后补齐剩余账号"],
      paused: ["矩阵发布已暂停，发布计划保留", "恢复后从当前账号继续推进", "不会重复发布已排期的内容"],
      learning: ["我在复盘汽车垂类高完播案例", "暂时没有新任务，正在整理账号内容节奏", "有新目标，直接告诉我就好"],
    },
  };

  const defaultHumanCollaboration = {
    humanHandoffEnabled: false,
    aiHandoffTimeout: "",
    aiHandoffTimeoutUnit: "",
    humanHandoffRules: [],
    keywordHandoffEnabled: false,
    handoffKeywords: [],
  };

  const humanHandoffRuleGroups = [
    { label: "特定意图", items: [{ value: "trade-in", label: "置换" }, { value: "after-sales", label: "售后" }, { value: "complaint", label: "客诉" }] },
    { label: "客户要求", items: [{ value: "contact", label: "催联系" }, { value: "add-friend", label: "催加好友" }, { value: "visit-store", label: "要到店" }] },
    { label: "其他选项", items: [{ value: "negative", label: "负面情绪" }, { value: "high-intent", label: "高意向客户" }, { value: "unrecognized-opening", label: "首句未识别", info: "首句无法判断意图时转人工" }, { value: "ai-no-reply", label: "AI无回复", info: "AI未能生成可发送的回复" }, { value: "douyin-app-reply", label: "抖音App回复", info: "抖音 App 内的会话转人工" }, { value: "xiaohongshu-app-reply", label: "小红书app回复", info: "小红书 App 内的会话转人工" }, { value: "kuaishou-app-reply", label: "快手App回复", info: "快手 App 内的会话转人工" }] },
  ];

  const defaultSettings = {
    "lead-hunter": { displayName: "主号获客专家", persona: "敏锐、专业的主号获客专家，擅长从互动信号中发现真实购车需求。", goal: "trial", intent: "balanced", tone: "professional", outreach: "你好，看到你在关注这款车。如果方便，我可以按你的城市和预算帮你整理车型和试驾信息。", confirmDiscount: true, confirmBatch: true, strategyMode: "separate" },
    "lead-hunter-advanced": { displayName: "副号获客专家", persona: "敏锐、专业的副号获客专家，擅长把潜客发现和多账号跟进接起来。", goal: "trial", intent: "balanced", tone: "professional", outreach: "你好，看到你在关注这款车。如果方便，我可以按你的城市和预算帮你整理车型和试驾信息。", confirmDiscount: true, confirmBatch: true, strategyMode: "main-sub" },
    "smart-reply": { displayName: "客服专员", persona: "稳妥、清晰的客服专员，优先说清事实，对不确定的价格和承诺主动转人工。", goal: "reply", intent: "balanced", tone: "clear", outreach: "先给客户结论，再补充车型、政策和门店依据。", confirmDiscount: true, confirmBatch: false, strategyMode: "separate", humanCollaboration: { ...defaultHumanCollaboration } },
    "ai-video": { displayName: "短视频运营专员", persona: "负责抖音账号矩阵的内容排期、批量发布和效果回收。", goal: "conversion", tone: "professional", publishMode: "review", publishModeGlobal: "review", weeklyTarget: 4, defaultSlot: "09:00", publishByAccount: { "鸿途汽车官方旗舰店": { mode: "review", timing: "now", scheduleAt: "2026-08-10T18:30" }, "鸿途汽车上海店": { mode: "review", timing: "now", scheduleAt: "2026-08-10T18:30" } }, confirmClaims: true, strategyMode: "review" },
  };

  const mockMemoryPlan = [
    { id: "mock-lead-intent", employee: "lead-hunter", text: "潜客意向判断：同时出现明确车型和预算、试驾、到店时间中的任意两项时，标记为高意向；只表达关注或索取资料时进入培育。", scope: "主号获客专家 · 潜客判断", date: "2026-08-05 14:30" },
    { id: "mock-outreach-logic", employee: "lead-hunter", text: "触达话术判断：首轮私信先回应客户原话，再补充车型和门店依据；不主动承诺未经确认的价格、优惠或库存。", scope: "主号获客专家 · 触达策略", date: "2026-08-05 14:36" },
    { id: "mock-report-format", employee: "lead-hunter", text: "数据报告规划：日报按新增互动、有效潜客、已触达、已回复、留资五个指标展示，单独突出高意向数量和人工待办。", scope: "主号获客专家 · 数据报告", date: "2026-08-05 14:42" },
    { id: "mock-advanced-lead-intent", employee: "lead-hunter-advanced", text: "潜客意向判断：同时出现明确车型和预算、试驾、到店时间中的任意两项时，标记为高意向；只表达关注或索取资料时进入培育。", scope: "副号获客专家 · 潜客判断", date: "2026-08-05 14:30" },
    { id: "mock-advanced-outreach-logic", employee: "lead-hunter-advanced", text: "触达话术判断：首轮私信先回应客户原话，再补充车型和门店依据；不主动承诺未经确认的价格、优惠或库存。", scope: "副号获客专家 · 触达策略", date: "2026-08-05 14:36" },
    { id: "mock-advanced-report-format", employee: "lead-hunter-advanced", text: "数据报告规划：日报按新增互动、有效潜客、已触达、已回复、留资五个指标展示，单独突出高意向数量和人工待办。", scope: "副号获客专家 · 数据报告", date: "2026-08-05 14:42" },
    { id: "mock-service-reply", employee: "smart-reply", text: "客服回复判断：客户明确询价或试驾时先给结论；涉及特殊优惠、竞品对比和承诺时保留上下文并转人工。", scope: "客服专员 · 回复规则", date: "2026-08-05 15:05" },
    { id: "mock-wujian-visual-style", employee: "ai-video", kind: "视频风格", text: "作者偏好真实汽车测评风：优先使用实车素材、自然光和低机位推进镜头，避免过度炫技的转场与虚构画面。", scope: "短视频运营专员 · 生成风格", date: "2026-08-11 16:20" },
    { id: "mock-wujian-hook-style", employee: "ai-video", kind: "内容节奏", text: "前 3 秒先给实测结论或反差钩子；中段用 3 个连续细节证明观点，结尾只保留一个“预约试驾”行动引导。", scope: "短视频运营专员 · 脚本偏好", date: "2026-08-11 16:28" },
    { id: "mock-wujian-generation-style", employee: "ai-video", kind: "生成规格", text: "抖音内容默认生成 9:16、30 秒、清晰女声版本；字幕使用白字配品牌绿色重点词，车型参数必须先经过车型库校验。", scope: "短视频运营专员 · 生成设置", date: "2026-08-12 11:05" },
    { id: "mock-wujian-publish-strategy", employee: "ai-video", kind: "发布策略", text: "内容先统一进入人工审核；工作日优先在 18:30—20:30 发布，旗舰店账号首发，同城市账号间隔至少 90 分钟，次日回收播放与线索效果。", scope: "短视频运营专员 · 发布策略", date: "2026-08-12 18:42" },
  ];

  const state = {
    selected: null,
    sideConversation: "li",
    statuses: {},
    threads: {},
    pendingMemory: null,
    planStarted: false,
    workspaceOpen: false,
    workspaceMode: "overview",
    sidePanelMode: "overview",
    snapshot: { employee: "lead-hunter", index: 0, liveFrame: 0, playing: false, timer: null, liveTimer: null },
    onboarding: { employee: "lead-hunter", step: 0, goal: "trial", testResult: "" },
    memories: loadJson(MEMORY_KEY, []),
    taskMemories: [],
    settings: { ...defaultSettings, ...loadJson(SETTINGS_KEY, {}) },
    activityIndex: 0,
    wuJian: {
      section: "overview", assetTab: "works", templateId: "rear-space",
      prompt: "为星途 E7 制作一条 30 秒竖版短视频，真人实测后排空间，突出家庭出行体验。",
      script: wuJianTemplates[0].script, materials: ["vehicle-e7", "role-wujian"],
      model: "Seedance 2.5", ratio: "9:16", duration: "30 秒", creative: "实车测评", style: "真实测评", hook: wuJianTemplates[0].hook, voice: "短视频运营专员 · 清晰女声",
      autoMode: "自动成片", canvas: true, caseFilter: "all", showPlan: false,
      flowStep: "script-ready", historyId: "draft-space", assetCheckStatus: "pending", aiMaterialConfirmed: false,
      chatMessages: [], queueEta: "约 3 分钟", queueProgress: 0, caseDetailId: "", caseDetailAutoplay: false,
      assetPickerOpen: false, assetPickerTab: "history", assetPickerSelected: [],
      generationStatus: "ready", publishMode: "review", timing: "now", scheduleAt: "2026-08-10T18:30", account: "鸿途汽车官方旗舰店", publishAccountIds: [], publishSetupStep: "accounts", generatedWorkId: "", publishRoute: "", worksCreated: [], worksFilter: "all", worksSelected: [], worksBatchMode: false, worksOverrides: {},
      publishResult: "", matrixSource: "",
      recreateWork: null, monitorTab: "accounts", monitorGroupFilter: "all", monitorAddOpen: false,
      worksPoolAccountFilter: "all", worksPoolStatusFilter: "all", worksPoolSelected: [], worksBatchOpen: false, worksBatchMode: "cover", worksBatchRoute: "review",
      livePublishExpanded: false, livePublishAccountId: "",
      matrixDataTab: "accounts", matrixTimeRange: "week", matrixAccountId: "",
      libraryTab: "pending", libraryReviewDeleted: [], libraryReviewApproved: [],
      publishTaskView: "list", publishTaskStep: 1, publishTaskSource: "library", publishTaskAccountIds: [], publishTaskWorkIds: [], publishTaskScript: "", publishTaskScriptsReady: false, publishTaskScriptsConfirmed: false, publishTaskGenerated: false, publishTaskUploaded: false, publishTaskUploadItem: null, publishTaskRemixGenerated: false, publishTaskTiming: "now", publishTaskScheduleAt: "2026-08-25T18:30", publishTaskReview: "review", publishTaskMessages: [], publishTaskHistoryId: "", publishTasks: [], publishTaskHistory: [], publishTaskResult: null,
      v13: { section: "overview", publishView: "results", taskStep: 1, taskAccounts: [], taskWorks: [], taskTiming: "now", taskScheduleAt: "2026-08-26T18:30", taskTitleMode: "none", taskTitleCopy: "", taskTitles: {}, taskTitlesSignature: "", libTab: "works", workFilter: "all", accountWorksOpen: "", accountWorksFilter: "all", accountWorkStatuses: {}, generatedTasks: [], worksPoolUploads: [], monitorAddOpen: false, monitorDraftHandle: "", monitorValidating: false, monitorAddError: "", monitorGrabs: {}, monitors: [] },
      ...loadJson(WUJIAN_KEY, {}),
    },
  };
  if (["accounts", "effects"].includes(state.wuJian.section)) state.wuJian.section = "data";
  if (!["accounts", "works"].includes(state.wuJian.matrixDataTab)) state.wuJian.matrixDataTab = "accounts";
  if (!["week", "last", "month", "all"].includes(state.wuJian.matrixTimeRange)) state.wuJian.matrixTimeRange = "week";
  if (!["pending", "pool", "monitor", "published", "review"].includes(state.wuJian.libraryTab)) state.wuJian.libraryTab = "pending";
  if (!Array.isArray(state.wuJian.libraryReviewDeleted)) state.wuJian.libraryReviewDeleted = [];
  if (!Array.isArray(state.wuJian.libraryReviewApproved)) state.wuJian.libraryReviewApproved = [];
  if (!["works", "monitor"].includes(state.wuJian.libraryPoolView)) state.wuJian.libraryPoolView = "works";
  if (state.wuJian.libraryTab === "monitor") {
    state.wuJian.libraryTab = "pool";
    state.wuJian.libraryPoolView = "monitor";
  }
  if (!["list", "agent", "history"].includes(state.wuJian.publishTaskView)) state.wuJian.publishTaskView = "list";
  if (!["library", "remix", "ai"].includes(state.wuJian.publishTaskSource)) state.wuJian.publishTaskSource = "library";
  // v13 安全重置：如果处于发布流程中途但账号为空，退回第一步；同时补全新字段默认值
  { const v13 = state.wuJian.v13 || {}; if (v13.publishView === "create" && (v13.taskStep || 1) > 1 && !(v13.taskAccounts || []).length) { v13.taskStep = 1; state.wuJian.v13 = v13; } if (!v13.taskTitleMode) { v13.taskTitleMode = "none"; } if (v13.taskTitleCopy === undefined) { v13.taskTitleCopy = ""; } if (!["all", "待发布", "发布中", "发布完成", "发布失败", "取消发布"].includes(v13.accountWorksFilter)) { v13.accountWorksFilter = "all"; } const validWorkFilters = ["all", "待发布", "发布中", "发布完成", "发布失败", "取消发布"]; if (!Array.isArray(v13.accountWorksFilters)) { v13.accountWorksFilters = v13.accountWorksFilter === "all" ? ["all"] : [v13.accountWorksFilter]; } v13.accountWorksFilters = v13.accountWorksFilters.filter((filter) => validWorkFilters.includes(filter)); if (!v13.accountWorksFilters.length) { v13.accountWorksFilters = ["all"]; } if (!v13.accountWorkStatuses || typeof v13.accountWorkStatuses !== "object" || Array.isArray(v13.accountWorkStatuses)) { v13.accountWorkStatuses = {}; } if (!Array.isArray(v13.monitors)) { v13.monitors = []; } if (typeof v13.monitorAddOpen !== "boolean") { v13.monitorAddOpen = false; } if (typeof v13.monitorDraftHandle !== "string") { v13.monitorDraftHandle = ""; } if (typeof v13.monitorValidating !== "boolean") { v13.monitorValidating = false; } if (typeof v13.monitorAddError !== "string") { v13.monitorAddError = ""; } if (!v13.monitorGrabs || typeof v13.monitorGrabs !== "object" || Array.isArray(v13.monitorGrabs)) { v13.monitorGrabs = {}; } if (!v13.taskTitles || typeof v13.taskTitles !== "object" || Array.isArray(v13.taskTitles)) { v13.taskTitles = {}; } if (typeof v13.taskTitlesSignature !== "string") { v13.taskTitlesSignature = ""; } state.wuJian.v13 = v13; }
  syncWuJianPublishState();

  if (Array.isArray(state.wuJian.worksCreated)) {
    state.wuJian.worksCreated.slice().reverse().forEach((item) => {
      if (item?.id && !wuJianWorks.some((work) => work.id === item.id)) wuJianWorks.unshift(item);
    });
  }

  Object.keys(employees).forEach((id) => {
    const savedName = state.settings[id]?.displayName;
    if (savedName) employees[id].name = savedName;
  });

  function ensureMockMemories() {
    const existing = new Set(state.memories.map((item) => item.id));
    let changed = false;
    mockMemoryPlan.forEach((item) => {
      if (existing.has(item.id)) return;
      state.memories.push({ ...item, source: "长期规划样例（演示）", mock: true });
      changed = true;
    });
    if (changed) saveJson(MEMORY_KEY, state.memories);
    if (!loadJson(MOCK_MEMORY_SEEDED_KEY, false)) saveJson(MOCK_MEMORY_SEEDED_KEY, true);
  }
  ensureMockMemories();

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function loadJson(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value == null ? fallback : value; } catch (error) { return fallback; }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* local demo remains usable */ } }
  function nowTime() { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); }
  function nowDateTime() { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); }
  function employeeImage(id) {
    const savedAvatar = state?.settings?.[id]?.avatar;
    if (savedAvatar) return savedAvatar;
    const cartoonAvatars = {
      "lead-hunter": "assets/characters/avatars/lead-hunter.png",
      "lead-hunter-advanced": "assets/characters/avatars/lead-hunter.png",
      "smart-reply": "assets/characters/avatars/smart-reply.png",
      "ai-video": "assets/talent-portraits/ai-video.jpg",
      supervisor: "assets/characters/avatars/supervisor.png",
    };
    return cartoonAvatars[id] || cartoonAvatars.supervisor;
  }
  function hiredSet() { try { return typeof hiredEmployees !== "undefined" ? hiredEmployees : new Set(loadJson(HIRE_KEY, [])); } catch (error) { return new Set(loadJson(HIRE_KEY, [])); } }
  function reservedSet() {
    let set = reservedMemory;
    try {
      if (typeof reservedEmployees !== "undefined" && reservedEmployees instanceof Set) {
        set = reservedEmployees;
      }
    } catch (error) { /* legacy reservation state is optional */ }
    if (!reservationsHydrated) {
      loadJson(RESERVE_KEY, []).forEach((id) => set.add(id));
      reservationsHydrated = true;
    }
    return set;
  }
  function isHired(id) { return Object.prototype.hasOwnProperty.call(employees, id) && hiredSet().has(id); }
  function isReserved(id) { return reservedSet().has(id); }
  function hiredIds() { return Object.keys(employees).filter(isHired); }
  function persistHires() { saveJson(HIRE_KEY, Array.from(hiredSet()).filter((id) => employees[id])); }
  function persistReservations() { saveJson(RESERVE_KEY, Array.from(reservedSet()).filter((id) => legacyTalentIds.includes(id))); }
  function reservedIds() { return legacyTalentIds.filter(isReserved); }
  function reserveEmployee(id) {
    if (!legacyTalentIds.includes(id) || isHired(id) || isReserved(id)) return;
    reservedSet().add(id);
    persistReservations();
    renderTalentPage();
    if (typeof showToast === "function") showToast("已预约岗位", "岗位上线后会通知你，当前不计入已雇佣团队");
  }
  function ensureDemoTeam() {
    try {
      // Keep a fresh demo in the no-employee state so the office can guide the first hire.
      if (localStorage.getItem(HIRE_KEY) === null) saveJson(HIRE_KEY, []);
    } catch (error) { /* no storage */ }
  }
  function getStatus(id) { return state.statuses[id] || employees[id]?.status || "learning"; }
  function setStatus(id, status) { if (employees[id] && statusMeta[status]) state.statuses[id] = status; renderOfficeScene(); renderSidePanel(); }
  function taskText(id) {
    const status = getStatus(id);
    if (status === "paused") return "工作已暂停，恢复后会从当前节点继续";
    if (status === "learning") return "没有新任务，正在学习已有门店知识和过往案例";
    if (status === "auth") return "账号权限不足，已停在对外触达之前";
    return employees[id]?.task || statusMeta[status]?.copy || "等待新任务";
  }
  function greetingText(id) {
    const employee = employees[id];
    if (!employee) return "";
    if (getStatus(id) === "learning") return `你好，我是${employee.name}。我现在没有新任务，正在学习已有的门店知识和过往案例。你也可以直接给我一个工作目标。`;
    if (getStatus(id) === "paused") return `你好，我是${employee.name}。当前工作已经暂停，你确认后我会从原来的位置继续。`;
    return employee.greeting;
  }

  function disableLegacyOverlays() {
    try {
      if (typeof firstRunOnboardingDismissed !== "undefined") firstRunOnboardingDismissed = true;
      if (typeof firstRunChatGuideSeen !== "undefined") firstRunChatGuideSeen = true;
      if (typeof firstRunGuideShownThisLoad !== "undefined") firstRunGuideShownThisLoad = true;
      if (typeof morningReportShownThisLoad !== "undefined") morningReportShownThisLoad = true;
      // The office is the default landing view; keep the legacy full-screen chat guide from covering it.
      window.localStorage.setItem("ai-legion-prd-guide-v2", "dismissed");
      if (typeof closeFirstRunOnboarding === "function") closeFirstRunOnboarding();
      if (typeof closeMorningReport === "function") closeMorningReport();
      if (typeof closeChat === "function") closeChat();
      if (typeof setChatFullscreen === "function") setChatFullscreen(false);
    } catch (error) { /* legacy overlays are optional */ }
  }

  function navIcon(kind) {
    const icons = {
      knowledge: '<svg viewBox="0 0 24 24"><path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12H7.5A2.5 2.5 0 0 1 5 16.5Z"/><path d="M8 8h7M8 11.5h7M8 15h4"/></svg>',
    };
    return icons[kind] || "";
  }
  function renameNavLabel(link, text) {
    const labels = $$('span:not(.nav-icon)', link);
    if (labels.length) labels[labels.length - 1].textContent = text;
  }
  function decorateNavigation() {
    const nav = $(".side-nav");
    if (!nav) return;
    const dashboard = $("[data-route='dashboard']", nav);
    if (dashboard) renameNavLabel(dashboard, "数字办公室");
    const live = $("[data-route='live']", nav);
    const results = $("[data-route='results']", nav);
    const vehicles = $("[data-route='vehicles']", nav);
    if (live) {
      live.hidden = false;
      live.removeAttribute("hidden");
      live.href = "#live";
      live.dataset.route = "live";
      renameNavLabel(live, "实时工作");
    }
    if (results) renameNavLabel(results, "成果中心");

    const businessKnowledge = $("[data-route='digital-human']", nav);
    if (businessKnowledge) {
      businessKnowledge.href = "#knowledge";
      businessKnowledge.dataset.route = "knowledge";
      businessKnowledge.dataset.knowledgeNav = "dialog";
      const icon = $(".nav-icon", businessKnowledge);
      if (icon) icon.innerHTML = navIcon("knowledge");
      renameNavLabel(businessKnowledge, "业务话术库");
    }
    if (vehicles) {
      vehicles.hidden = false;
      vehicles.href = "#knowledge";
      vehicles.dataset.route = "knowledge";
      vehicles.dataset.knowledgeNav = "vehicles";
      renameNavLabel(vehicles, "车型库");
    }

    const knowledgeHeading = $$("p", nav).find((heading) => heading.textContent.trim() === "设置");
    if (knowledgeHeading) {
      knowledgeHeading.textContent = "知识库";
      knowledgeHeading.dataset.navGroup = "knowledge";
    }

    const accounts = $("[data-route='accounts']", nav);
    if (accounts) {
      renameNavLabel(accounts, "账号授权");
      const accountHeading = document.createElement("p");
      accountHeading.textContent = "账号授权";
      accountHeading.dataset.navGroup = "accounts";
      nav.insertBefore(accountHeading, accounts);
      if (vehicles && knowledgeHeading) nav.insertBefore(vehicles, accountHeading);
    }
    try {
      if (typeof routeTitles === "object") {
        routeTitles.dashboard = "数字办公室";
        routeTitles.knowledge = "知识库";
        routeTitles.accounts = "账号授权";
      }
    } catch (error) { /* older build */ }
    document.body.classList.add("ai-office-v2");
  }

  function createKnowledgePage() {
    const main = $(".main-content");
    if (!main || $("[data-view='knowledge']")) return;
    const section = document.createElement("section");
    section.className = "app-view ai-knowledge-page";
    section.dataset.view = "knowledge";
    section.innerHTML = `<div class="ai-page-heading"><span>门店知识底座</span><h2>知识库</h2><p>把员工说话的方式和可以引用的车型政策放在同一个地方。</p></div><div class="ai-knowledge-summary"><article><i>话</i><div><strong>业务话术库</strong><small>人设、工作时间、标准回复和门店问答</small></div></article><article><i>车</i><div><strong>车型库</strong><small>在售车型、门店价、优惠和补贴政策</small></div></article></div><div class="ai-knowledge-tabs" role="tablist"><button class="is-active" type="button" role="tab" data-knowledge-tab="dialog">业务话术库</button><button type="button" role="tab" data-knowledge-tab="vehicles">车型库</button></div><div class="ai-knowledge-host"><div data-knowledge-panel="dialog"></div><div data-knowledge-panel="vehicles" hidden></div></div>`;
    main.appendChild(section);
    const dialogSource = $("[data-view='demo-config']");
    const vehicleSource = $("[data-view='vehicles']");
    if (dialogSource) {
      dialogSource.classList.remove("app-view", "is-active");
      dialogSource.classList.add("ai-knowledge-embedded");
      $("[data-knowledge-panel='dialog']", section).appendChild(dialogSource);
    }
    if (vehicleSource) {
      vehicleSource.classList.remove("app-view", "is-active");
      vehicleSource.classList.add("ai-knowledge-embedded");
      $("[data-knowledge-panel='vehicles']", section).appendChild(vehicleSource);
    }
  }
  function syncKnowledgeNavigation(tab) {
    const onKnowledge = window.location.hash.slice(1) === "knowledge";
    $$("[data-knowledge-nav]").forEach((link) => link.classList.toggle("is-active", onKnowledge && link.dataset.knowledgeNav === tab));
  }
  function switchKnowledge(tab) {
    const activeTab = tab === "vehicles" ? "vehicles" : "dialog";
    $$("[data-knowledge-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.knowledgeTab === activeTab));
    $$("[data-knowledge-panel]").forEach((panel) => { panel.hidden = panel.dataset.knowledgePanel !== activeTab; });
    syncKnowledgeNavigation(activeTab);
    if (activeTab === "vehicles") { try { if (typeof renderVehicleLibrary === "function") renderVehicleLibrary(); } catch (error) { /* existing page is already usable */ } }
  }

  function officeMarkup() {
    return `<div class="ai-office-shell" aria-label="数字办公室">
      <div class="ai-first-guide" id="ai-first-guide" aria-hidden="true"><div class="ai-first-guide__card"><span>第一次使用</span><h3>不用先学 AI，先看团队现在在做什么</h3><div class="ai-first-guide__steps"><article><i>1</i><strong>点员工</strong><small>先看当前任务和需要你处理的事</small></article><article><i>2</i><strong>看过程</strong><small>展开工作区或查看连续快照</small></article><article><i>3</i><strong>给目标</strong><small>使用快捷选项，不需要自己组织复杂语句</small></article></div><button type="button" data-guide-done>我知道了，开始看团队</button></div></div>
      <div class="ai-office-heading"><div><span>AI 数班 · DIGITAL OFFICE</span><h2>今天，团队在做什么？</h2><p>先看结果和待办，再点击员工了解具体过程。</p></div><div class="ai-office-heading__actions"><button class="is-primary" type="button" data-route-link="plaza">去人才广场选择员工</button></div></div>
      <div class="ai-office-grid"><section class="ai-office-scene" aria-label="鸿途汽车数字办公室"><header><div><strong>鸿途汽车 · 品牌运营中心</strong><small id="ai-office-hired-count">正在读取到岗员工</small></div><span><i></i>团队在线</span></header><div class="ai-office-room" id="ai-office-room"><div class="ai-office-stage" id="ai-office-stage"><div class="ai-office-stage-loading">正在加载卡通员工场景…</div></div></div><footer class="ai-office-activity" id="ai-office-activity"></footer></section><aside class="ai-office-side" id="ai-office-side" aria-label="员工工作概览"></aside></div>
      <div class="ai-office-bottom-links"><button type="button" data-route-link="results">结果已进入成果中心 →</button><button type="button" data-route-link="knowledge">查看员工使用的知识</button><button type="button" data-route-link="accounts">查看账号权限</button></div>
    </div>`;
  }

  function renderOffice() {
    const dashboard = $("[data-view='dashboard']");
    if (!dashboard) return;
    disableLegacyOverlays();
    dashboard.classList.add("ai-office-dashboard");
    if (!$(".ai-office-shell", dashboard)) dashboard.insertAdjacentHTML("afterbegin", officeMarkup());
    renderOfficeScene();
    renderSidePanel();
    const guide = $("#ai-first-guide");
    if (guide) {
      // The office is the working surface on entry; do not place a blocking tutorial over the team.
      const show = !document.body.classList.contains("is-office-default") && loadJson(GUIDE_KEY, "") !== "done";
      guide.classList.toggle("is-open", show);
      guide.setAttribute("aria-hidden", String(!show));
    }
    document.title = "数字办公室 · AI数班";
  }

  function supervisorDeskMarkup() {
    return `<article class="ai-desk ai-desk--butler ${state.selected === "supervisor" ? "is-selected" : ""}" data-select-employee="supervisor"><button type="button" aria-label="查看 AI 管家"><span class="ai-butler-avatar"><i class="ai-butler-avatar__ring"></i><strong>AI</strong><em>管家</em></span><span><small>团队协调台</small><strong>小班 · AI 管家</strong><p>整理目标、派工、交接、日报和人工待办</p><b><i></i>协调中</b></span><span class="ai-butler-count"><strong>${hiredIds().length}</strong><small>位员工</small></span></button></article>`;
  }
  function deskReportBubbles(id, status, deskIndex) {
    const reports = deskReportCopy[id]?.[status] || deskReportCopy[id]?.working || [statusMeta[status]?.copy || "我正在继续工作"];
    return reports.slice(0, 3).map((text, index) => `<span class="ai-desk__bubble is-${status}" style="--bubble-delay:${(deskIndex * 1.5) + (index * 4)}s" aria-hidden="true">${escapeHtml(text)}</span>`).join("");
  }
  function employeeDeskMarkup(id, deskIndex) {
    const employee = employees[id];
    const status = getStatus(id);
    return `<article class="ai-desk ai-desk--employee is-${status} ${state.selected === id ? "is-selected" : ""}" data-select-employee="${id}"><button type="button" aria-label="查看${employee.name}的工作概览"><span class="ai-desk__avatar"><img src="${escapeHtml(employeeImage(id))}" alt="${employee.name}"><i></i></span><span class="ai-desk__copy"><strong>${employee.name}</strong><small>${employee.role}</small><p>${escapeHtml(taskText(id))}</p><b><i></i>${statusMeta[status].label}</b></span><span class="ai-desk__progress"><em>${status === "learning" ? "学习" : employee.progress + "%"}</em><i><b style="width:${status === "paused" ? 0 : employee.progress}%"></b></i></span></button>${deskReportBubbles(id, status, deskIndex)}</article>`;
  }
  function renderOfficeScene() {
    const room = $("#ai-office-room");
    if (!room) return;
    const ids = hiredIds();
    if (!ids.includes(state.selected)) state.selected = ids[0] || null;
    room.classList.toggle("is-collaborating", state.planStarted);
    const stage = $("#ai-office-stage");
    if (stage && window.AIOfficeChibi) {
      window.AIOfficeChibi.mount(stage);
      window.AIOfficeChibi.update(ids.map((id) => ({
        id,
        name: employees[id].name,
        role: employees[id].role,
        status: getStatus(id),
        task: taskText(id),
        progress: employees[id].progress,
      })), state.selected, state.planStarted);
    }
    const count = $("#ai-office-hired-count");
    if (count) count.textContent = ids.length ? `PC 工作空间 · ${ids.length} 位数字员工已到岗` : "PC 工作空间 · 暂无数字员工";
    renderActivity();
  }
  function renderActivity() {
    const host = $("#ai-office-activity");
    if (!host) return;
    const rows = [
      ["主号获客专家", "找到一位同时提到预算和试驾的客户", "刚刚"],
      ["副号获客专家", "独立找到一位同时提到预算和试驾的客户", "刚刚"],
      ["客服专员", "保留了两个价格会话，等待门店确认", "2 分钟前"],
      ["短视频运营专员", "完成 12 个账号的发布排期，正在整理剩余账号内容", "3 分钟前"],
    ].filter((row) => hiredIds().some((id) => employees[id].name === row[0]));
    if (!rows.length) {
      host.innerHTML = `<span><i></i><strong>数字办公室</strong><em>去人才广场选择员工，开始你的第一条业务线</em></span><small>现在</small>`;
      return;
    }
    const row = rows[state.activityIndex % rows.length];
    host.innerHTML = `<span><i></i><strong>${row[0]}</strong><em>${row[1]}</em></span><small>${row[2]}</small>`;
  }

  function renderLiveSnapshot() {
    const video = $("#ai-current-task-live-video");
    if (!video) return;
    const isSmartReply = state.selected === "smart-reply";
    const frames = isSmartReply ? smartReplySnapshotFrames : snapshotFrames;
    const videoTime = Number(video.currentTime) || 0;
    const frameIndex = frames.reduce((active, frame, index) => {
      const marker = frame.time.split(":").reduce((total, value) => total * 60 + Number(value), 0);
      return videoTime >= marker ? index : active;
    }, 0);
    state.snapshot.liveFrame = frameIndex;
    const frame = frames[frameIndex] || frames[0];
    const action = $("[data-live-snapshot-action]");
    const status = $("[data-live-snapshot-status]");
    const time = $("[data-live-snapshot-time]");
    const employeeId = isSmartReply ? "smart-reply" : state.selected === "lead-hunter-advanced" ? "lead-hunter-advanced" : "lead-hunter";
    const employeeStatus = getStatus(employeeId);
    if (action) action.textContent = frame.action;
    if (status) status.textContent = employeeStatus === "working" ? "正在工作" : statusMeta[employeeStatus]?.label || "工作快照";
    if (time) time.textContent = `操作进度 · ${frame.time}`;
    if (employeeStatus === "working" && video.paused) video.play().catch(() => {});
    if (employeeStatus !== "working" && !video.paused) video.pause();
  }

  function startLiveSnapshot() {
    if (state.snapshot.liveTimer) window.clearInterval(state.snapshot.liveTimer);
    state.snapshot.liveTimer = window.setInterval(renderLiveSnapshot, 260);
    renderLiveSnapshot();
  }

  const userAvatarPath = "assets/profile/jinge-jay-chou-avatar-v1.jpg";
  function dialogueAvatar(id, from) {
    if (from === "user") {
      return `<span class="ai-dialogue-avatar ai-dialogue-avatar--user"><img src="${userAvatarPath}" alt="我"></span>`;
    }
    if (id === "supervisor") {
      return `<span class="ai-dialogue-avatar ai-dialogue-avatar--butler" aria-label="AI 管家头像"><strong>AI</strong><em>管家</em></span>`;
    }
    const employee = employees[id];
    return `<span class="ai-dialogue-avatar ai-dialogue-avatar--employee"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee?.name || "数字员工")}头像"></span>`;
  }
  function dialogueName(id, from) {
    if (from === "user") return "我";
    if (id === "supervisor") return "小班 · AI 管家";
    return employees[id]?.name || "数字员工";
  }
  function dialogueMessage(id, from, text, time = "", bodyMarkup = "") {
    const safeTime = time ? `<small>${escapeHtml(time)}</small>` : "";
    const body = bodyMarkup || `<p>${escapeHtml(text)}</p>`;
    return `<article class="ai-dialogue-message is-${from}">${dialogueAvatar(id, from)}<div class="ai-dialogue-message__body"><div class="ai-dialogue-message__meta"><strong>${escapeHtml(dialogueName(id, from))}</strong>${safeTime}</div>${body}</div></article>`;
  }
  function messageMarkup(id) {
    const messages = state.threads[id] || [];
    const visible = messages.slice(-3);
    return visible.length ? `<section class="ai-side-thread" aria-label="与${escapeHtml(dialogueName(id, "agent"))}的对话">${visible.map((item) => dialogueMessage(id, item.from, item.text, item.time)).join("")}</section>` : "";
  }
  function sideChatForm(id) {
    const isCompactEmployee = ["lead-hunter", "lead-hunter-advanced", "smart-reply"].includes(id);
    const placeholder = id === "supervisor" ? "说一句简单目标，或使用上面的快捷选项" : "问进度、暂停工作，或告诉员工一条规则";
    const recipient = id === "supervisor" ? "AI 管家" : employees[id]?.name || "数字员工";
    const label = id === "supervisor" ? "与 AI 管家对话" : `与${recipient}对话`;
    const hint = "发送目标、问题或工作指令";
    const inputId = `ai-side-chat-input-${id}`;
    const labelMarkup = isCompactEmployee ? "" : `<div class="ai-side-chat__label"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(hint)}</small></div>`;
    return `<div class="ai-side-chat-wrap">${labelMarkup}<form class="ai-side-chat" data-side-chat="${escapeHtml(id)}"><input id="${escapeHtml(inputId)}" type="text" aria-label="给${escapeHtml(recipient)}发消息" placeholder="${escapeHtml(placeholder)}"><button type="submit" aria-label="发送消息">↑</button></form></div>`;
  }

  function supervisorSectionHead(index, title, description, meta) {
    return `<header class="ai-supervisor-section__head"><div><span>${index}</span><div><strong>${title}</strong><small>${description}</small></div></div>${meta ? `<em>${meta}</em>` : ""}</header>`;
  }

  function supervisorSummaryHead(title, meta) {
    return `<header class="ai-supervisor-summary-head"><strong>${title}</strong>${meta ? `<span>${meta}</span>` : ""}</header>`;
  }

  function supervisorBusinessLineName(id) {
    return ({ "lead-hunter": "主号获客专家", "lead-hunter-advanced": "副号获客专家", "smart-reply": "客服专员", "ai-video": "短视频运营专员" })[id] || employees[id]?.role || "业务线";
  }

  function supervisorEmployeeRows() {
    const ids = hiredIds();
    if (!ids.length) return `<div class="ai-supervisor-empty"><strong>暂时没有普通员工</strong><small>去人才广场选择员工后，这里会同步工作进度。</small></div>`;
    return ids.map((id) => {
      const employee = employees[id];
      const status = getStatus(id);
      const progress = status === "paused" ? 0 : Math.max(0, Math.min(100, Number(employee.progress) || 0));
      const attention = status === "waiting" || status === "auth";
      return `<article class="ai-supervisor-employee${attention ? " is-attention" : ""}"><button type="button" data-select-employee="${id}" aria-label="查看${employee.name}的工作概览"><span class="ai-supervisor-employee__avatar"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><i></i></span><span class="ai-supervisor-employee__body"><strong>${escapeHtml(employee.name)} <small>${escapeHtml(employee.role)}</small></strong><em><i></i>${statusMeta[status].label}</em><p>${escapeHtml(taskText(id))}</p><i class="ai-supervisor-employee__bar"><b style="width:${progress}%"></b></i></span><span class="ai-supervisor-employee__progress">${status === "learning" ? "学习" : `${progress}%`}</span></button></article>`;
    }).join("");
  }

  function supervisorResultCards() {
    const leadCount = ["lead-hunter", "lead-hunter-advanced"].filter(isHired).length;
    const leadActive = leadCount > 0;
    const replyActive = isHired("smart-reply");
    const videoActive = isHired("ai-video");
    const matrix = matrixData();
    const cards = [
      { label: "新增潜客", value: leadActive ? String(leadCount * 24) : "0", unit: "位", note: leadActive ? "各员工独立统计" : "环比 0.0%", percent: leadActive ? 80 : 0, tone: "green" },
      { label: "本周发布", value: videoActive ? String(matrix.weekPublished) : "0", unit: "条", note: videoActive ? `${matrix.accounts.length} 个账号 · 完成率 ${matrix.weekRate}%` : "暂无账号接入", percent: videoActive ? matrix.weekRate : 0, tone: "blue" },
      { label: "有效留资", value: leadActive ? String(leadCount * 6) : "0", unit: "条", note: leadActive ? "各员工独立统计" : "环比 0.0%", percent: leadActive ? 25 : 0, tone: "purple" },
      { label: "承接会话数", value: replyActive ? "204" : "0", unit: "个", note: replyActive ? "今日客服承接" : "暂无客服会话", percent: replyActive ? 100 : 0, tone: "teal" },
    ];
    return cards.map((card) => `<article class="ai-supervisor-metric is-${card.tone}"><div><span>${card.label}</span><strong>${card.value}<small>${card.unit}</small></strong></div><p>${card.note}</p><i><b style="width:${card.percent}%"></b></i><em>${card.percent}%</em></article>`).join("");
  }

  function supervisorBusinessLineCards() {
    const matrix = matrixData();
    const videoReviewCount = matrix.pending.find((item) => item.type === "审核")?.count || 12;
    const lineDetails = {
      "lead-hunter": { title: "主号获客专家", goal: "新增 30 位潜客", outputs: [["已新增", "24 位"], ["有效留资", "6 条"]], next: "17:00 完成本轮线索筛选" },
      "lead-hunter-advanced": { title: "副号获客专家", goal: "新增 30 位潜客", outputs: [["已新增", "24 位"], ["有效留资", "6 条"]], next: "17:00 完成副号获客专家独立线索筛选" },
      "ai-video": { title: "矩阵发布", goal: `按周计划发布 ${matrix.accounts.length} 个账号内容`, outputs: [["本周已发布", `${matrix.weekPublished} 条`], ["待审核", `${videoReviewCount} 项`]], next: `处理 ${matrix.pendingCount} 项人工待办` },
      "smart-reply": { title: "客服转化", goal: "承接咨询并促进留资", outputs: [["服务会话", "204 个"], ["人工待办", "2 项"]], next: "确认价格口径后继续回复" },
    };
    const ids = hiredIds();
    if (!ids.length) return `<div class="ai-supervisor-empty"><strong>暂时没有业务线运行</strong><small>去人才广场选择数字员工后，这里会同步经营状态。</small></div>`;
    return ids.map((id) => {
      const employee = employees[id];
      const detail = lineDetails[id] || { title: supervisorBusinessLineName(id), goal: employee.goal, outputs: [["今日结果", employee.outcome], ["当前进度", `${employee.progress}%`]], next: employee.next };
      const status = getStatus(id);
      const attention = status === "waiting" || status === "auth";
      const stateLabel = attention ? "需关注" : status === "paused" ? "已暂停" : status === "learning" ? "待任务" : "正常";
      return `<article class="ai-supervisor-business-line${attention ? " is-attention" : ""}"><button type="button" data-select-employee="${id}" aria-label="查看${escapeHtml(detail.title)}业务线"><span class="ai-supervisor-business-line__head"><span class="ai-supervisor-business-line__avatar"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"></span><span><strong>${escapeHtml(detail.title)}</strong><small>${escapeHtml(digitalEmployeeLabel(employee))}</small></span><em>${attention ? "▲" : "●"} ${stateLabel}</em></span><span class="ai-supervisor-business-line__outputs">${detail.outputs.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</span><span class="ai-supervisor-business-line__now"><small>当前</small><strong>${escapeHtml(taskText(id))}</strong></span></button></article>`;
    }).join("");
  }

  function supervisorHumanTasks() {
    const tasks = [];
    if (isHired("smart-reply") && getStatus("smart-reply") === "waiting") {
      tasks.push(`<article class="ai-supervisor-human-task"><span class="ai-supervisor-human-task__icon">!</span><div><strong>客服转化 · 2 个价格口径</strong><p>小班建议先给出价格区间并邀请客户留资，兼顾转化与合规。</p></div><button type="button" data-select-employee="smart-reply">去处理</button></article>`);
    }
    if (isHired("lead-hunter") && getStatus("lead-hunter") === "auth") {
      tasks.push(`<article class="ai-supervisor-human-task"><span class="ai-supervisor-human-task__icon">!</span><div><strong>主号获客专家 · 抖音账号授权异常</strong><p>主号获客专家已暂停对外触达，恢复授权后会从当前节点继续。</p></div><button type="button" data-select-employee="lead-hunter">去处理</button></article>`);
    }
    if (isHired("lead-hunter-advanced") && getStatus("lead-hunter-advanced") === "auth") {
      tasks.push(`<article class="ai-supervisor-human-task"><span class="ai-supervisor-human-task__icon">!</span><div><strong>副号获客专家 · 抖音账号授权异常</strong><p>副号获客专家已暂停对外触达，恢复授权后会从当前节点继续。</p></div><button type="button" data-select-employee="lead-hunter-advanced">去处理</button></article>`);
    }
    return tasks.join("") || `<div class="ai-supervisor-human-empty"><span>✓</span><div><strong>暂无需要立即处理的事项</strong><small>新的授权异常、特殊承诺和人工回复会在这里提醒你。</small></div></div>`;
  }

  function supervisorHiringGuide() {
    const messages = [
      ["agent", "你好，我是小班。团队里还没有数字员工，你可以跟我说说你的业务，我来帮你判断适合雇佣什么员工。"],
      ["user", "我们是一家汽车门店，想在抖音上找客户，也希望有人及时回复私信。"],
      ["agent", "明白了。建议先雇佣主号获客专家负责发现抖音潜客，再搭配客服专员承接私信；如果还要稳定产出内容，可以再看看短视频运营专员。"],
    ];
    const prompts = ["我们是汽车门店，想做抖音获客", "我主要需要客服接待私信", "我想持续生产短视频"];
    return `<section class="ai-supervisor-hiring-guide" aria-label="和小班聊天，了解适合雇佣的数字员工"><header><div><span>从一个业务目标开始</span><strong>和我聊聊你的业务，我帮你选员工</strong></div><em>AI 建议</em></header><div class="ai-supervisor-hiring-dialogue">${messages.map(([from, text], index) => dialogueMessage("supervisor", from, text, index === messages.length - 1 ? "刚刚" : "")).join("")}${messageMarkup("supervisor")}</div><div class="ai-supervisor-hiring-prompts" aria-label="快捷问题">${prompts.map((prompt) => `<button type="button" data-supervisor-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("")}</div><button type="button" class="ai-supervisor-hiring-cta" data-route-link="plaza">去人才市场选员工 <span aria-hidden="true">→</span></button><form class="ai-supervisor-hiring-chat" data-side-chat="supervisor"><input type="text" aria-label="和小班聊聊业务需求" placeholder="说说你的业务目标，例如：想做抖音获客"><button type="submit" aria-label="发送给小班">↑</button></form></section>`;
  }

  function renderSupervisorSection() {
    const employeeCount = hiredIds().length;
    const attentionCount = hiredIds().filter((id) => ["waiting", "auth"].includes(getStatus(id))).length;
    const attentionId = hiredIds().find((id) => ["waiting", "auth"].includes(getStatus(id)));
    const headline = employeeCount ? `${employeeCount} 条业务线独立运行，${attentionCount} 项需要你确认` : "还没有业务线运行";
    const normalLines = hiredIds().filter((id) => !["waiting", "auth"].includes(getStatus(id))).map(supervisorBusinessLineName);
    const attentionLines = hiredIds().filter((id) => ["waiting", "auth"].includes(getStatus(id))).map(supervisorBusinessLineName);
    const report = employeeCount ? `${normalLines.length ? `${normalLines.join("、")}运行正常；` : ""}${attentionLines.length ? `${attentionLines.join("、")}需要你处理。` : "当前没有需要人工处理的异常。"}` : "配置第一位数字员工后，小班会在这里汇总经营结果和异常。";
    const briefingAction = attentionId ? `data-select-employee="${attentionId}"` : employeeCount ? `data-open-workspace="overview"` : `data-route-link="plaza"`;
    const briefing = "";
    if (!employeeCount) {
      return `<header class="ai-side-head ai-side-head--butler"><span class="ai-butler-mini"><strong>AI</strong><em>主理</em></span><div class="ai-side-head__identity"><strong>小班 · 数字团队负责人</strong><small><i></i>在线 · 等待你的第一位数字员工</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-open-workspace="overview" title="展开小班工作区" aria-label="展开小班工作区"><span aria-hidden="true">⛶</span></button></div></header><div class="ai-side-scroll ai-supervisor-summary is-empty">${supervisorHiringGuide()}</div>`;
    }
    return `<header class="ai-side-head ai-side-head--butler"><span class="ai-butler-mini"><strong>AI</strong><em>主理</em></span><div class="ai-side-head__identity"><strong>小班 · 数字团队负责人</strong><small><i></i>在线 · 管理 ${employeeCount} 条独立业务线</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-open-workspace="overview" title="展开工作区" aria-label="展开小班工作区"><span aria-hidden="true">⛶</span></button></div></header><div class="ai-side-scroll ai-supervisor-summary">${briefing}<section class="ai-supervisor-section ai-supervisor-results">${supervisorSummaryHead("今日经营结果", "小班统一汇总 · 截至 16:20")}<div class="ai-supervisor-metrics">${supervisorResultCards()}</div></section><section class="ai-supervisor-section ai-supervisor-business">${supervisorSummaryHead("独立业务线", `${Math.max(0, employeeCount - attentionCount)} 条正常 · ${attentionCount} 条需关注`)}<div class="ai-supervisor-business-lines">${supervisorBusinessLineCards()}</div></section><section class="ai-supervisor-section ai-supervisor-human">${supervisorSummaryHead("需要你决策", attentionCount ? `${attentionCount} 项待处理` : "当前无待办")}<div class="ai-supervisor-human-list">${supervisorHumanTasks()}</div></section></div>${sideChatForm("supervisor")}`;
  }
  function pendingMemoryMarkup(id) {
    if (!state.pendingMemory || state.pendingMemory.employee !== id) return "";
    return `<section class="ai-memory-confirm"><span>这句话要不要记住？</span><p>${escapeHtml(state.pendingMemory.text)}</p><small>长期规则会影响以后的任务；“仅本次”不会写入长期记忆。</small><div><button type="button" data-memory-confirm="long">记住，以后都这样</button><button type="button" data-memory-confirm="task">仅本次任务</button><button type="button" data-memory-confirm="cancel">取消</button></div></section>`;
  }
  function renderSmartReplyOverviewPanel(id) {
    const employee = employees[id];
    const status = getStatus(id);
    const greeting = `<section class="ai-side-greeting ai-side-greeting--bottom ai-lead-greeting is-animated" data-employee-greeting="${id}">${dialogueMessage(id, "agent", smartReplyDailyBriefing, "刚刚")}</section>`;
    return `<header class="ai-side-head"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><div class="ai-side-head__identity"><strong>${escapeHtml(digitalEmployeeLabel(employee))}</strong><small><i></i>${escapeHtml(statusMeta[status].label)}</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-open-workspace="overview" title="展开工作区" aria-label="展开工作区"><span aria-hidden="true">⛶</span></button><button class="ai-side-icon" type="button" data-open-workspace="settings" title="Agent 设置" aria-label="Agent 设置"><span aria-hidden="true">⚙︎</span></button></div></header><div class="ai-side-scroll ai-lead-panel ai-smart-reply-panel"><section class="ai-lead-section ai-lead-cloud" aria-label="正在接待"><header class="ai-lead-section__head"><div><span>正在接待</span><strong>工作状态</strong></div></header><div class="ai-lead-workspace"><div class="ai-lead-cloud__screen"><video id="ai-current-task-live-video" src="${SMART_REPLY_VIDEO_PATH}" ${status === "working" ? "autoplay" : ""} muted loop playsinline preload="auto" aria-label="${escapeHtml(employee.name)}正在接待的工作桌面"></video><span><i></i>工作中</span></div><div class="ai-lead-cloud__copy"><span>正在接待客户咨询</span><button type="button" data-open-workspace="detail">查看实时工作</button></div></div></section>${pendingMemoryMarkup(id)}${messageMarkup(id)}</div>${greeting}${sideChatForm(id)}`;
  }
  function leadHunterReportMarkup(id, status) {
    const employeeName = employees[id]?.name || "数字员工";
    if (id === "lead-hunter-advanced") {
      return `<div class="ai-lead-report ai-lead-report--huang" aria-label="副号获客专家数据汇报"><span class="ai-lead-report__label">主动汇报</span><p>我已在 <span class="ai-lead-account-chip"><i aria-hidden="true">抖音</i><b>包头鸿达</b></span> 下完成本轮搜寻，找到 <strong>210</strong> 个潜客，其中 <strong class="is-high">150</strong> 个为高意向。</p><p>已使用 <strong>5</strong> 个副号触达 <strong>100</strong> 个用户，其中 <strong>80</strong> 个客户已回复，<strong>20</strong> 个客户完成留资。</p><small>我会继续跟进高意向客户，并同步后续结果。</small></div>`;
    }
    const statusNote = status === "paused"
      ? `${employeeName}已暂停触达，线索上下文已保留。`
      : status === "auth"
        ? `${employeeName}已完成筛选，账号授权待恢复；结果不会丢。`
        : status === "waiting"
          ? "价格口径待确认，我会先保留高意向线索。"
          : "我会继续跟进高意向客户，并同步后续结果。";
    return `<div class="ai-lead-report" aria-label="${escapeHtml(employeeName)}数据汇报"><span class="ai-lead-report__label">数据汇报</span><p>本轮搜寻 <strong>210</strong> 位潜客，其中 <strong class="is-high">150</strong> 位高意向。</p><p>累计触达 <strong>100</strong> 位用户，其中 <strong>80</strong> 位客户已回复，<strong>20</strong> 位客户已留资。</p><small>${escapeHtml(statusNote)}</small></div>`;
  }
  function wuJianReportMarkup(status) {
    const accounts = V13_ACCOUNTS;
    const done = accounts.filter((account) => account.status === "已发布").length;
    const publishing = accounts.filter((account) => account.status === "正在发布").length;
    const queued = accounts.filter((account) => account.status === "排队中").length;
    const blocked = accounts.filter((account) => account.status === "发布异常");
    const published = accounts.reduce((sum, account, index) => sum + v13Published(account, index), 0);
    const pendingWorks = typeof v13Works === "function" ? v13Works().length : 0;
    const stateLead = status === "paused"
      ? "矩阵发布已暂停，当前进度和账号顺序已保留"
      : status === "auth"
        ? "账号授权检查未通过，我已停在对外发布前"
        : status === "learning"
          ? "当前没有新发布任务，我在整理作品和账号规则"
          : "今天的发布任务正在按计划执行";
    const nextStep = blocked.length
      ? `我会先处理${escapeHtml(blocked[0].name)}的营销授权，再按排队顺序继续发布；完成后回收播放、互动和线索数据。`
      : "我会继续完成排队账号的发布，发布结束后回收播放、互动和线索数据。";
    return `<div class="ai-lead-report ai-lead-report--wujian" aria-label="短视频运营专员工作汇报"><span class="ai-lead-report__label">工作汇报</span><p>老板，截至 09:30，${stateLead}。当前 ${accounts.length} 个抖音账号中，<strong>${done}</strong> 个已完成、<strong>${publishing}</strong> 个正在发布、<strong>${queued}</strong> 个排队${blocked.length ? `，<strong class="is-high">${blocked.length}</strong> 个发布异常` : ""}；本周已发布 <strong>${published}</strong> 条。</p><p>作品库还有 <strong>${pendingWorks}</strong> 条待发布作品，当前执行盘面和账号范围均已锁定。</p><small>${nextStep}</small></div>`;
  }
  function renderLeadHunterPanel(id) {
    const employee = employees[id];
    const status = getStatus(id);
    const greeting = `<section class="ai-side-greeting ai-side-greeting--bottom ai-lead-greeting is-animated" data-employee-greeting="${id}"><header><span>主动汇报</span><em>刚刚</em></header>${dialogueMessage(id, "agent", "", "刚刚", leadHunterReportMarkup(id, status))}</section>`;
      return `<header class="ai-side-head"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><div class="ai-side-head__identity"><strong>${escapeHtml(digitalEmployeeLabel(employee))}</strong><small><i></i>${escapeHtml(statusMeta[status].label)}</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-open-workspace="overview" title="展开工作区" aria-label="展开工作区"><span aria-hidden="true">⛶</span></button><button class="ai-side-icon" type="button" data-open-workspace="settings" title="Agent 设置" aria-label="Agent 设置"><span aria-hidden="true">⚙︎</span></button></div></header><div class="ai-side-scroll ai-lead-panel"><section class="ai-lead-section ai-lead-cloud" aria-label="工作界面"><header class="ai-lead-section__head"><div><span>工作界面</span></div></header><div class="ai-lead-workspace"><div class="ai-lead-cloud__screen"><video id="ai-current-task-live-video" src="${LIVE_VIDEO_PATH}" ${status === "working" ? "autoplay" : ""} muted loop playsinline preload="auto" aria-label="${escapeHtml(employee.name)}工作界面"></video><span><i></i>工作中</span></div><div class="ai-lead-cloud__copy"><span>主号获客专家正在处理获客任务</span><button type="button" data-open-workspace="detail">查看实时工作</button></div></div></section>${pendingMemoryMarkup(id)}${messageMarkup(id)}</div>${greeting}${sideChatForm(id)}`;
  }
  function renderWuJianOverviewPanel(id) {
    const employee = employees[id];
    const status = getStatus(id);
    const accounts = V13_ACCOUNTS;
    /* 发布过程视频仅在发布完成后可获取，优先展示最近一次已完成发布的账号 */
    const focusAccount = accounts.find((a) => a.status === "已发布")
      || accounts.find((a) => a.status === "正在发布")
      || accounts.find((a) => a.status === "发布异常")
      || accounts.find((a) => a.status === "排队中")
      || accounts[0];
    const focusIndex = Math.max(0, accounts.indexOf(focusAccount));
    const focusStatus = focusAccount?.status || "已发布";
    const focusError = focusAccount?.failureType === "marketing" ? "营销未授权" : focusAccount?.failureType === "rpa" ? "发布失败" : "发布异常";
    const focusTime = focusStatus === "已发布" ? v13WallTime(focusAccount) : "";
    const focusMedia = focusStatus === "已发布"
      ? `<video class="ai-wujian-side-media" src="${v13Video(focusIndex)}" poster="${v13Cover(focusIndex)}" autoplay muted loop playsinline preload="metadata" aria-label="${escapeHtml(focusAccount.name)}账号发布过程视频"></video>`
      : focusStatus === "正在发布"
        ? `<div class="ai-wujian-side-empty is-live"><strong>正在发布</strong><small>发布过程视频将在发布完成后展示</small></div>`
        : `<div class="ai-wujian-side-empty is-${focusStatus === "排队中" ? "queue" : "error"}"><strong>${escapeHtml(focusStatus === "排队中" ? "排队中" : focusError)}</strong><small>${escapeHtml(focusStatus === "排队中" ? "待发布，暂时没有可展示视频" : focusAccount.error || "发布失败，请点击重新发布")}</small></div>`;
    const focusAction = focusStatus === "发布异常" && focusAccount.failureType === "marketing"
      ? `<button type="button" data-wjv-account-todo="${escapeHtml(focusAccount.id)}" data-wjv-account-name="${escapeHtml(focusAccount.name)}">去处理</button>`
      : focusStatus === "发布异常"
        ? `<button type="button" class="ai-wujian-side-republish" data-wjv-republish-account="${escapeHtml(focusAccount.id)}">重新发布</button>`
        : `<button type="button" data-open-workspace="overview">查看实时工作</button>`;
    const greeting = `<section class="ai-side-greeting ai-side-greeting--bottom ai-lead-greeting" data-employee-greeting="${id}"><header><span>${employee.name}主动汇报</span><em>刚刚</em></header>${dialogueMessage(id, "agent", "", "刚刚", wuJianReportMarkup(status))}</section>`;
    return `<header class="ai-side-head"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><div class="ai-side-head__identity"><strong>${escapeHtml(digitalEmployeeLabel(employee))}</strong><small><i></i>${escapeHtml(statusMeta[status].label)} · 抖音 ${accounts.length} 个账号</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-open-workspace="overview" title="进入实时工作" aria-label="进入短视频运营专员实时工作"><span aria-hidden="true">⛶</span></button><button class="ai-side-icon" type="button" data-open-workspace="settings" title="Agent 设置" aria-label="短视频运营专员 Agent 设置"><span aria-hidden="true">⚙︎</span></button></div></header><div class="ai-side-scroll ai-lead-panel"><section class="ai-lead-section ai-lead-cloud" aria-label="工作界面"><header class="ai-lead-section__head"><div><span>工作界面</span><strong>${escapeHtml(focusAccount.name)}</strong></div><em class="ai-wujian-side-status is-${focusStatus === "正在发布" ? "live" : focusStatus === "已发布" ? "done" : focusStatus === "排队中" ? "queue" : "error"}">${escapeHtml(focusStatus === "正在发布" ? "正在发布" : focusStatus === "发布异常" ? "发布异常" : focusStatus)}</em></header><div class="ai-lead-workspace"><div class="ai-lead-cloud__screen is-wujian-status-${focusStatus === "正在发布" ? "live" : focusStatus === "已发布" ? "done" : focusStatus === "排队中" ? "queue" : "error"}">${focusMedia}${focusTime ? `<time class="ai-wujian-side-time">${escapeHtml(focusTime)}</time>` : ""}<span><i></i>${escapeHtml(focusStatus === "正在发布" ? "正在发布" : focusStatus === "发布异常" ? focusError : focusStatus)}</span></div><div class="ai-lead-cloud__copy"><span>${escapeHtml(focusStatus === "排队中" ? "待发布，暂时没有可展示视频" : focusStatus === "发布异常" ? (focusAccount.error || "发布失败，请点击重新发布") : focusStatus === "已发布" ? "最近一次发布视频 · 动态回放" : "正在发布 · 发布完成后展示过程视频")}</span>${focusAction}</div></div></section>${pendingMemoryMarkup(id)}${messageMarkup(id)}</div>${greeting}${sideChatForm(id)}`;
  }

  function wuJianPublishStrategyHistory() {
    const settings = { ...defaultSettings["ai-video"], ...(state.settings["ai-video"] || {}) };
    const current = wuJianAccountPublishConfig(settings, state.wuJian.account || "鸿途汽车官方旗舰店");
    const stored = Array.isArray(state.wuJian.publishStrategyHistory) ? state.wuJian.publishStrategyHistory : [];
    const defaults = [
      { time: "2026-08-12 14:20", account: "鸿途汽车官方旗舰店", mode: "auto", timing: "now", scheduleAt: "", source: "我希望成片生成好后直接发到官方旗舰店。" },
      { time: "2026-08-11 18:05", account: "鸿途汽车上海店", mode: "review", timing: "now", scheduleAt: "", source: "上海店的成片生成后先发给我审核。" },
      { time: "2026-08-10 16:42", account: "鸿途汽车官方旗舰店", mode: "auto", timing: "scheduled", scheduleAt: "2026-08-13 18:30", source: "这条视频等生成完成后，明天 18:30 定时发布。" },
    ];
    const active = { time: "当前生效", account: state.wuJian.account || "鸿途汽车官方旗舰店", mode: current.mode, timing: current.timing, scheduleAt: current.scheduleAt, source: "当前账号规则（来自最近一次发布对话）" };
    const rows = [active, ...stored.slice(-4).reverse(), ...defaults].filter((item, index, all) => item && all.findIndex((row) => `${row.time}|${row.account}|${row.mode}|${row.timing}|${row.scheduleAt}` === `${item.time}|${item.account}|${item.mode}|${item.timing}|${item.scheduleAt}`) === index).slice(0, 7);
    const modeLabel = (item) => item.mode === "auto" ? "自动发布" : "审核发布";
    const timingLabel = (item) => item.timing === "scheduled" ? `定时 ${String(item.scheduleAt || "").replace("T", " ")}` : item.mode === "review" ? "审核通过后立即发布" : "生成完成后立即发布";
    return rows.map((item, index) => `<article class="ai-wujian-strategy-event${index === 0 ? " is-current" : ""}"><span class="ai-wujian-strategy-event__dot" aria-hidden="true"></span><div class="ai-wujian-strategy-event__body"><header><strong>${escapeHtml(item.time)}</strong><em>${index === 0 ? "当前生效" : "历史对话"}</em></header><p><b>${escapeHtml(item.account || "未指定账号")}</b> · ${modeLabel(item)} · ${timingLabel(item)}</p><small>触发条件：${item.mode === "review" ? "成片生成完成后等待用户确认" : item.timing === "scheduled" ? `到达 ${String(item.scheduleAt || "排期时间").replace("T", " ")} 自动执行` : "成片生成完成后立即执行"}</small><blockquote>“${escapeHtml(item.source || "用户在对话中配置发布策略") }”</blockquote></div></article>`).join("");
  }

  function renderWujianSettingsSidePanel(id) {
    const employee = employees[id];
    const status = statusMeta[getStatus(id)];
    return `<header class="ai-side-head ai-side-head--settings"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><div class="ai-side-head__identity"><strong>${escapeHtml(employee.name)} · Agent 设置</strong><small><i></i>${escapeHtml(status.label)} · 设置来自历史对话</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-wujian-settings-close title="返回工作概览" aria-label="返回短视频运营专员工作概览"><span aria-hidden="true">←</span></button></div></header><div class="ai-side-scroll ai-wujian-settings-side"><header class="ai-settings-agent ai-wujian-settings-agent"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><div><span>Agent 设置</span><h2>${escapeHtml(employee.name)}</h2><p>${escapeHtml(employee.role)} · ${escapeHtml(taskText(id))}</p></div><em><i></i>${escapeHtml(status.label)}</em></header>${settingOptions(id)}</div>`;
  }

  function renderEmployeePanel(id) {
    if (id === "smart-reply") return renderSmartReplyOverviewPanel(id);
    if (["lead-hunter", "lead-hunter-advanced"].includes(id)) return renderLeadHunterPanel(id);
    if (id === "ai-video") return renderWuJianOverviewPanel(id);
    const employee = employees[id];
    const status = getStatus(id);
    const waiting = status === "waiting" ? `<section class="ai-human-task"><span>需要你处理</span><h4>价格口径不确定，我已经暂停发送</h4><dl><div><dt>原因</dt><dd>客户要求特殊优惠承诺</dd></div><div><dt>风险</dt><dd>门店可能无法兑现未经确认的价格</dd></div><div><dt>你要做的事</dt><dd>确认一次性回复口径，或直接人工接管</dd></div></dl><div><button type="button" data-resolve-waiting>确认口径并继续</button><button type="button" data-takeover>我来接管</button></div></section>` : "";
    const liveSnapshot = ["lead-hunter", "lead-hunter-advanced"].includes(id) ? `<div class="ai-current-task__live" aria-label="${employee.name}当前工作快照"><div class="ai-current-task__live-image"><video id="ai-current-task-live-video" src="${LIVE_VIDEO_PATH}" ${status === "working" ? "autoplay" : ""} muted loop playsinline preload="auto" aria-label="${employee.name}当前工作视频"></video><span><i></i>工作中</span></div><div class="ai-current-task__live-copy"><span>${employee.name}正在操作</span><strong data-live-snapshot-action>${snapshotFrames[state.snapshot.liveFrame].action}</strong><small data-live-snapshot-status>${status === "working" ? "正在工作" : statusMeta[status].label}</small><em data-live-snapshot-time>桌面操作 · ${snapshotFrames[state.snapshot.liveFrame].time}</em></div></div>` : id === "ai-video" ? `<button class="ai-current-task__live wujian-side-live" type="button" data-open-workspace="create" aria-label="打开短视频运营专员实时创作台"><span class="ai-current-task__live-image"><img src="${wuJianTemplate().cover}" alt="${escapeHtml(wuJianTemplate().title)}"><em><i></i>排期中</em></span><span class="ai-current-task__live-copy"><span>短视频运营专员正在操作</span><strong>按账号组推进本周发布计划</strong><small>100 个账号 · 本周已发布 224 条</small><em>旗舰店 18:30 首发 · 城市店间隔 90 分钟</em></span></button>` : "";
    const recentWork = `<section class="ai-recent-work"><header><span>最近工作状态</span><em>刚刚更新</em></header><p>${escapeHtml(employee.last)}</p></section>`;
    const greeting = `<section class="ai-side-greeting ai-side-greeting--bottom${["lead-hunter", "lead-hunter-advanced"].includes(id) ? " is-animated" : ""}" data-employee-greeting="${id}"><header><span>${employee.name}主动汇报</span><em>刚刚</em></header>${dialogueMessage(id, "agent", greetingText(id), "刚刚")}</section>`;
    return `<header class="ai-side-head"><img src="${escapeHtml(employeeImage(id))}" alt="${employee.name}"><div class="ai-side-head__identity"><strong>${digitalEmployeeLabel(employee)}</strong><small><i></i>${statusMeta[status].label}</small></div><div class="ai-side-head__actions"><button class="ai-side-icon" type="button" data-open-workspace="overview" title="展开工作区" aria-label="展开工作区"><span aria-hidden="true">⛶</span></button><button class="ai-side-icon" type="button" data-open-workspace="settings" title="Agent 设置" aria-label="Agent 设置"><span aria-hidden="true">⚙︎</span></button></div></header><div class="ai-side-scroll"><section class="ai-current-task"><header><span>当前工作</span><em>${statusMeta[status].label}</em></header>${liveSnapshot}<h4>${escapeHtml(taskText(id))}</h4><div><i><b style="width:${status === "paused" ? 0 : employee.progress}%"></b></i><strong>${status === "learning" ? "没有新任务" : employee.progress + "%"}</strong></div><dl><div><dt>工作目标</dt><dd>${employee.goal}</dd></div><div><dt>下一步</dt><dd>${employee.next}</dd></div></dl></section>${recentWork}${waiting}${pendingMemoryMarkup(id)}${messageMarkup(id)}</div>${greeting}${sideChatForm(id)}`;
  }
  function renderEmptyOfficePanel() {
    return `<section class="ai-office-empty-state" aria-label="选择数字员工"><span class="ai-office-empty-state__icon" aria-hidden="true">＋</span><strong>还没有数字员工</strong><p>去人才广场选择一位员工，开始你的第一条业务线。</p><button type="button" data-route-link="plaza">去人才广场选择员工 <span aria-hidden="true">→</span></button></section>`;
  }
  function renderSidePanel() {
    const side = $("#ai-office-side");
    if (!side) return;
    const ids = hiredIds();
    if (!ids.length) {
      state.selected = null;
      side.classList.remove("is-settings-drawer");
      side.setAttribute("aria-label", "选择数字员工");
      side.innerHTML = renderEmptyOfficePanel();
      return;
    }
    if (!ids.includes(state.selected)) state.selected = ids[0];
    side.classList.remove("is-settings-drawer");
    side.setAttribute("aria-label", "员工工作概览");
    side.innerHTML = renderEmployeePanel(state.selected);
  }
  function focusLiveServiceConversation(id) {
    const prompt = smartReplyHandoffPrompts.find((item) => item.id === id);
    if (!prompt) return;
    state.sideConversation = prompt.id;
    try {
      if (typeof demoLiveJobs === "undefined" || !demoLiveJobs.service) throw new Error("live service workspace unavailable");
      const target = prompt.live;
      let index = demoLiveJobs.service.signals.findIndex((item) => item.name === target.name && item.copy === target.copy);
      if (index < 0) {
        demoLiveJobs.service.signals.push({
          initial: target.initial,
          name: target.name,
          meta: "抖音 · 鸿途汽车官方旗舰店",
          copy: target.copy,
          tag: target.tag,
          detail: target.detail,
          need: target.need,
          platform: "抖音",
          sourceAccount: "鸿途汽车官方旗舰店",
          time: prompt.time,
          responseTime: "刚刚",
        });
        index = demoLiveJobs.service.signals.length - 1;
      }
      demoLiveJob = "service";
      demoLiveSelectedSignal = index;
      demoLiveDetailStep = null;
      demoLiveTransferIndex = 0;
      demoServiceSearch = "";
      demoServiceAccountFilter = "all";
      demoServiceFilter = "human";
      window.location.hash = "live";
      window.setTimeout(() => { if (typeof renderDemoLiveJob === "function") renderDemoLiveJob("service"); }, 0);
    } catch (error) {
      selectEmployee("smart-reply");
    }
  }
  function selectEmployee(id) {
    if (!employees[id] || !isHired(id)) return;
    if (state.workspaceOpen) closeWorkspace();
    state.selected = id;
    state.sidePanelMode = "overview";
    renderOfficeScene();
    renderSidePanel();
  }

  function ensureWorkspace() {
    let overlay = $("#ai-employee-workspace");
    if (overlay) return overlay;
    document.body.insertAdjacentHTML("beforeend", `<div class="ai-workspace-backdrop" id="ai-workspace-backdrop" aria-hidden="true"></div><section class="ai-employee-workspace" id="ai-employee-workspace" aria-hidden="true" aria-label="员工工作区"><header id="ai-workspace-header"></header><nav id="ai-workspace-tabs"></nav><div class="ai-workspace-body" id="ai-workspace-body"></div></section>`);
    return $("#ai-employee-workspace");
  }

  function persistWuJian() {
    saveJson(WUJIAN_KEY, state.wuJian);
  }
  function wuJianTemplate() {
    return wuJianTemplates.find((item) => item.id === state.wuJian.templateId) || wuJianTemplates[0];
  }
  function wuJianCase(templateId) {
    return wuJianTemplates.find((item) => item.id === templateId) || wuJianTemplates[0];
  }
  function wuJianCaseVisualAsset(templateId) {
    return ({
      "uploaded-car-case-01": "case-uploaded-car-case-01-visual",
      "uploaded-car-case-02": "case-uploaded-car-case-02-visual",
      "uploaded-car-case-03": "case-uploaded-car-case-03-visual",
    })[templateId] || ({
      "rear-space": "vehicle-e7",
      "range-challenge": "vehicle-e7",
      "family-suv": "vehicle-t9",
      "smart-cockpit": "vehicle-yaoguang",
    })[templateId] || "vehicle-e7";
  }
  function wuJianCaseDetailMarkup() {
    const template = wuJianCase(state.wuJian.caseDetailId);
    if (!state.wuJian.caseDetailId || !template) return "";
    const playable = Boolean(template.video);
    const visualAssetId = wuJianCaseVisualAsset(template.id);
    const selectedVisual = wuJianMaterial(visualAssetId);
    const visualCovers = Array.from(new Set([
      template.cover,
      selectedVisual?.cover,
      template.id === "uploaded-car-case-03" ? "assets/vehicles/yaoguang-4wd-2024.jpg" : "assets/vehicles/e7-flagship-2025.jpg",
    ].filter(Boolean))).slice(0, 3);
    const scriptLines = String(template.script || "").split("\n").filter(Boolean);
    return `<div class="wujian-case-detail-overlay" data-wujian-case-close>
      <section class="wujian-case-detail" role="dialog" aria-modal="true" aria-labelledby="wujian-case-detail-title">
        <header><div><span>${escapeHtml(template.source || "汽车灵感")}</span><h3 id="wujian-case-detail-title">${escapeHtml(template.title)}</h3><small>${escapeHtml(template.vehicle)} · ${escapeHtml(template.duration)} · ${escapeHtml(template.ratio)}</small></div><button type="button" data-wujian-case-close aria-label="关闭素材详情">×</button></header>
        <div class="wujian-case-detail-body"><div class="wujian-case-detail-media">${playable ? `<video src="${escapeHtml(template.video)}" poster="${escapeHtml(template.cover)}" controls playsinline ${state.wuJian.caseDetailAutoplay ? "autoplay muted" : ""}></video>` : `<img src="${escapeHtml(template.cover)}" alt="${escapeHtml(template.title)}">`}<span>${playable ? "点击播放" : "灵感参考"}</span></div><aside class="wujian-case-detail-aside"><section class="wujian-case-detail-card wujian-case-detail-copy"><header><span>这条灵感适合你</span><em>${escapeHtml(template.style)}</em></header><p>${escapeHtml(template.hook)}</p><div><b>画面</b><span>${playable ? "沿用节奏，换成你的车型画面" : "换成车型库里的画面"}</span></div><div><b>文案</b><span>保留开场方式，改成你的卖点</span></div></section><section class="wujian-case-detail-card wujian-case-detail-script"><header><span>脚本文案</span><button type="button" data-wujian-case-reuse="text">做同款</button></header><div class="wujian-case-script-lines">${scriptLines.map((line, index) => `<p><i>${String(index + 1).padStart(2, "0")}</i><span>${escapeHtml(line)}</span></p>`).join("")}</div></section><section class="wujian-case-detail-card wujian-case-detail-config"><header><span>生成设置</span><em>可以按需调整</em></header><dl><div><dt>画面风格</dt><dd>${escapeHtml(template.style)}</dd></div><div><dt>视频时长</dt><dd>${escapeHtml(template.duration)}</dd></div><div><dt>画面比例</dt><dd>${escapeHtml(template.ratio)}</dd></div><div><dt>生成模型</dt><dd>${escapeHtml(template.model)}</dd></div></dl></section><section class="wujian-case-detail-card wujian-case-detail-visuals"><header><span>画面素材</span><button type="button" data-wujian-case-reuse="image">做同款</button></header><div class="wujian-case-visual-grid">${visualCovers.map((cover, index) => `<img src="${escapeHtml(cover)}" alt="${escapeHtml(template.title)}画面 ${index + 1}">`).join("")}</div><small>带回创作后，可以替换成自己的车型素材。</small></section><section class="wujian-case-detail-actions"><strong>准备好开始了吗？</strong><button type="button" class="is-primary" data-wujian-case-reuse="all">整条灵感带走 <small>画面 + 文案 + 设置</small></button><button type="button" data-wujian-case-reuse="image">只用画面</button><button type="button" data-wujian-case-reuse="text">只用文案</button></section></aside></div>
      </section>
    </div>`;
  }
  function wuJianMaterial(id) {
    return Object.values(wuJianAssets).flat().find((item) => item.id === id);
  }
  function wuJianStatus(status) {
    return ({ success: ["发布成功", "success"], scheduled: ["已排期", "scheduled"], failed: ["发布失败", "failed"], "generation-failed": ["生成失败", "generation-failed"], review: ["等你确认", "review"], draft: ["成片完成", "draft"] })[status] || ["制作中", "working"];
  }
  function wuJianWorkStatus(item) {
    return state.wuJian.worksOverrides?.[item.id] || item.status;
  }
  function wuJianApproveWorks(ids) {
    const selectedIds = Array.from(new Set(ids));
    const approved = selectedIds.map((id) => wuJianWorks.find((item) => item.id === id)).filter((item) => item && wuJianWorkStatus(item) === "review");
    if (!approved.length) return;
    const overrides = { ...(state.wuJian.worksOverrides || {}) };
    approved.forEach((item) => { overrides[item.id] = item.releaseMode === "scheduled" ? "scheduled" : "success"; });
    state.wuJian.worksOverrides = overrides;
    state.wuJian.worksSelected = [];
    state.wuJian.worksBatchMode = false;
    persistWuJian();
    if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
    const scheduled = approved.filter((item) => item.releaseMode === "scheduled").length;
    const immediate = approved.length - scheduled;
    const result = [immediate ? `${immediate} 条立即发布` : "", scheduled ? `${scheduled} 条定时发布` : ""].filter(Boolean).join("、");
    if (typeof showToast === "function") showToast("审核通过", `${result}已进入对应发布状态`);
  }
  function wuJianRegisterGeneratedWork() {
    syncWuJianPublishState();
    const template = wuJianTemplate();
    const isReview = state.wuJian.publishMode !== "auto";
    const releaseMode = state.wuJian.timing === "scheduled" ? "scheduled" : "now";
    const status = isReview ? "review" : releaseMode === "scheduled" ? "scheduled" : "success";
    const id = state.wuJian.generatedWorkId || `work-generated-${Date.now()}`;
    const existing = wuJianWorks.find((item) => item.id === id);
    const durationSeconds = String(state.wuJian.duration || template.duration).match(/\d+/)?.[0] || "30";
    const work = {
      id,
      title: `${template.title} · ${state.wuJian.duration}`,
      cover: template.cover,
      duration: `00:${durationSeconds.padStart(2, "0")}`,
      time: "刚刚生成",
      account: wuJianPublishAccountNames().join("、") || state.wuJian.account || "鸿途汽车官方旗舰店",
      status,
      releaseMode,
      scheduleAt: state.wuJian.scheduleAt ? state.wuJian.scheduleAt.replace("T", " ") : "",
      views: "—",
      likes: "—",
      comments: "—",
      favorites: "—",
      shares: "—",
    };
    if (existing) Object.assign(existing, work);
    else wuJianWorks.unshift(work);
    const createdWorks = Array.isArray(state.wuJian.worksCreated) ? [...state.wuJian.worksCreated] : [];
    const createdIndex = createdWorks.findIndex((item) => item.id === id);
    if (createdIndex >= 0) createdWorks[createdIndex] = { ...createdWorks[createdIndex], ...work };
    else createdWorks.unshift({ ...work });
    state.wuJian.worksCreated = createdWorks;
    state.wuJian.generatedWorkId = id;
    state.wuJian.publishRoute = isReview ? "review" : "auto";
    state.wuJian.publishResult = isReview
      ? `作品已生成，等待人工审核；审核通过后按${releaseMode === "scheduled" ? "定时发布" : "立即发布"}执行。`
      : `作品已按全自动规则${releaseMode === "scheduled" ? "安排定时发布，等待到点执行" : "提交发布"}。`;
    return { template, work, isReview, releaseMode };
  }
  function completeWuJianProduction() {
    const result = wuJianRegisterGeneratedWork();
    const { template, isReview, releaseMode } = result;
    state.wuJian.flowStep = "complete";
    state.wuJian.generationStatus = "complete";
    state.wuJian.queueProgress = 100;
    state.wuJian.queueEta = "已完成";
    wuJianAddChatMessage("agent", wuJianFlowMessage("complete"));
    if (!wuJianAssets.works.some((item) => item.name === `${template.title}_新生成.mp4`)) wuJianAssets.works.unshift({ id: `work-conversation-${Date.now()}`, name: `${template.title}_新生成.mp4`, type: "视频", meta: `${state.wuJian.duration} · 1080 × 1920`, cover: template.cover });
    employees["ai-video"].progress = 100;
    employees["ai-video"].task = isReview ? "成片已完成，等待审核发布" : releaseMode === "scheduled" ? "成片已完成，已进入定时发布" : "成片已完成，已自动发布";
    employees["ai-video"].next = isReview ? "进入作品管理完成审核" : "回收作品播放和互动数据";
    persistWuJian();
    if (state.workspaceOpen && state.selected === "ai-video") {
      state.workspaceMode = "history";
      renderWorkspace();
    } else refreshWuJianLiveWorkspace();
    renderOfficeScene();
    renderSidePanel();
    if (typeof showToast === "function") showToast(isReview ? "视频已完成，等待审核" : "视频已完成并已发布", isReview ? "进入作品管理即可完成审核" : state.wuJian.publishResult);
  }
  function wuJianSelectedMaterials() {
    return state.wuJian.materials.map(wuJianMaterial).filter(Boolean);
  }
  function openWuJianCaseDetail(templateId, autoplay) {
    if (!wuJianCase(templateId)) return;
    state.wuJian.caseDetailId = templateId;
    state.wuJian.caseDetailAutoplay = Boolean(autoplay);
    refreshWuJianLiveWorkspace();
  }
  function applyWuJianCaseReuse(templateId, mode) {
    const template = wuJianCase(templateId);
    if (!template) return;
    const visualAsset = wuJianCaseVisualAsset(templateId);
    if (mode === "all" || mode === "text") applyWuJianTemplate(templateId);
    if (mode === "image") {
      state.wuJian.templateId = templateId;
      state.wuJian.historyId = "draft-space";
      state.wuJian.section = "create";
      state.wuJian.prompt = `参考《${template.title}》的画面节奏，为我的车型素材生成一条${template.duration}竖版短视频。`;
      state.wuJian.materials = Array.from(new Set([...(state.wuJian.materials || []), visualAsset]));
      state.wuJian.showPlan = true;
      state.wuJian.generationStatus = "ready";
    }
    if (mode === "all") state.wuJian.materials = Array.from(new Set([...(state.wuJian.materials || []), visualAsset]));
    state.wuJian.caseDetailId = "";
    state.wuJian.caseDetailAutoplay = false;
    persistWuJian();
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast(mode === "image" ? "画面已带入" : mode === "text" ? "文案已带入" : "灵感已带入", "已经放进短视频运营专员创作台，可以继续调整");
  }
  function wuJianScriptRows(template) {
    const rows = {
      "rear-space": [
        ["01", "3 秒", "1 米 85 体验者快速坐入 ${vehicle} 后排，字幕打出“两拳空间？”", "中近景", "自然日光，明亮通透", "旁白：1 米 85 坐进来，膝盖前面竟然还有两拳。", "低频心跳 + 车门声", "快速推近"],
        ["02", "8 秒", "侧拍腿部、头部与中央地台，切换车型库尺寸标注", "近景", "冷白天光，细节清晰", "旁白：腿部、头部和地台一次看清。", "轻节奏鼓点", "横向跟拍"],
        ["03", "9 秒", "儿童座椅、两个行李箱放入后排，展示家庭出行空间", "中景", "暖色室内光，家庭感", "旁白：带娃出门，座椅和行李也能同时放下。", "行李箱落地声", "缓慢拉远"],
        ["04", "5 秒", "体验者回头给出结论，屏幕叠加车型名与事实来源", "特写", "柔和侧光，真实自然", "对白：这才是家用车该有的后排。", "环境声收窄", "轻微摇镜"],
        ["05", "5 秒", "车型外观与预约试驾 CTA 收束，评论区出现“空间”关键词", "远景", "品牌绿收束光", "旁白：评论区回复“空间”，领取同级实测对比。", "提示音 + 音乐收束", "升格推远"],
      ],
      "range-challenge": [
        ["01", "4 秒", "满电仪表与上海地标同框，显示测试起点", "特写", "清晨自然光", "旁白：满电出发，开到杭州还剩多少？", "启动提示音", "快速推近"],
        ["02", "12 秒", "高速行驶、空调和实时能耗连续切换", "中景", "通透日光，纪录片感", "旁白：记录车速、空调和每一段能耗。", "路噪 + 轻鼓点", "车外跟拍"],
        ["03", "15 秒", "抵达杭州门店，镜头展示剩余续航和全程里程", "全景", "午后高亮光", "旁白：到达终点，测试条件和结果一次公开。", "导航提示音", "环绕移动"],
        ["04", "8 秒", "车型侧面与测试数据卡片并置，强调不夸大结论", "中近景", "冷暖对比光", "旁白：续航表现要看真实路况，不看单一数字。", "音乐降低", "平稳横移"],
        ["05", "6 秒", "试驾预约按钮和路线地图收束", "远景", "品牌蓝收束光", "旁白：想走同路线，评论区预约试驾。", "提示音", "缓慢拉远"],
      ],
      "family-suv": [
        ["01", "4 秒", "家庭用户推开车门，第三排空间快速亮相", "中景", "暖色家庭光", "旁白：家里有两个孩子，七座 SUV 先别急着看配置表。", "车门声 + 轻快音乐", "快速摇入"],
        ["02", "7 秒", "成年人坐入第三排，字幕标注腿部与头部空间", "近景", "柔和顶光", "旁白：第一个问题，第三排能不能坐成年人？", "座椅滑轨声", "横向跟拍"],
        ["03", "7 秒", "儿童座椅、婴儿车和行李箱同时装载", "中景", "明亮自然光", "旁白：第二个问题，满员后行李还能不能放？", "行李箱声", "俯拍下移"],
        ["04", "7 秒", "日常通勤场景与车型局部特写交替", "中近景", "城市晨光", "旁白：第三个问题，日常通勤是否可控？", "城市环境声", "稳定器前移"],
        ["05", "5 秒", "顾问面对镜头总结，留言家庭人数 CTA", "近景", "柔和侧光", "对白：留言家庭人数，我帮你生成选车建议。", "音乐收束", "轻推近"],
      ],
      "smart-cockpit": [
        ["01", "3 秒", "城市灯光掠过 ${vehicle} 车身，氛围灯同时亮起", "远景", "深蓝夜景，高对比", "旁白：当城市入夜，车内每一束光都在回应你。", "低频氛围音", "慢速掠过"],
        ["02", "5 秒", "屏幕、语音交互和座椅细节快速蒙太奇", "近景", "冷色屏幕光", "旁白：屏幕、语音和座椅，每个细节都被点亮。", "电子提示音", "快速切换"],
        ["03", "5 秒", "驾驶员说出指令，座舱灯光随之变化", "特写", "蓝紫交错光", "对白：打开夜间氛围。", "语音反馈音", "轻微环绕"],
        ["04", "4 秒", "夜间道路行驶，车内外光线交替", "中景", "城市霓虹，柔和反射", "旁白：科技感不是炫技，而是让每次出发更舒服。", "音乐渐强", "车外跟拍"],
        ["05", "3 秒", "品牌标识与到店体验 CTA 收束", "近景", "品牌光收束", "旁白：到店体验你的下一段夜行。", "收束提示音", "缓慢推远"],
      ],
    };
    const source = rows[template.id] || rows["rear-space"];
    return source.map((row) => row.map((value) => String(value).replaceAll("${vehicle}", template.vehicle)));
  }
  function wuJianScriptMarkup(template, compact = false) {
    const rows = wuJianScriptRows(template);
    return `<div class="wujian-script-table-wrap${compact ? " is-compact" : ""}"><table class="wujian-script-table"><thead><tr><th>镜号</th><th>时长</th><th>画面描述</th><th>景别</th><th>光影氛围</th><th>对白 / 旁白</th><th>音效</th><th>运镜</th></tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function wuJianFlowLabel(step) {
    return ({ "script-ready": "等你看脚本", "asset-check": "正在找画面", "asset-proposal": "等你选画面", "publish-accounts": "等你选账号", "publish-config": "等你选发布方式", queue: "正在制作", complete: "成片已完成" })[step] || "等你看脚本";
  }
  function wuJianFlowMessage(step) {
    return ({
      "script-ready": "我已经把你的创作目标整理成 5 个镜头，脚本包含画面、景别、光影、对白、音效和运镜。你可以继续告诉我车型、颜色或场景怎么改。",
      "asset-check": "脚本确认好了，我正在逐镜检查车型、人物和场景画面。缺什么，我会给你补上。",
      "asset-proposal": "现有素材里没有完全匹配的画面，我准备了两张参考图，确认后就开始生成。",
      "publish-accounts": "素材已确认，成片开始生成。趁着生成的时间，先告诉我这条视频要发到哪些账号吧。已完成营销授权的账号可以直接选择，待授权账号也会列出来供你处理。",
      "publish-config": "账号记下了。接下来选择发布方式，我会按你的选择完成后续动作。",
      queue: `发布设置已记下${wuJianPublishAccountNames().length ? `，会发到${wuJianPublishAccountNames().join("、")}` : ""}。我先生成关键画面，再合成完整视频。`,
      complete: state.wuJian.publishMode === "auto"
        ? `视频已经生成完成，${state.wuJian.timing === "scheduled" ? `已为${wuJianPublishAccountNames().join("、") || state.wuJian.account}排好发布时间，届时会自动发布` : `已发到${wuJianPublishAccountNames().join("、") || state.wuJian.account}`}。你可以去作品里看结果。`
        : `视频已经生成完成，我把成片报告放回这条对话了。看过标题、封面和内容后，确认即可发到${wuJianPublishAccountNames().join("、") || state.wuJian.account}。`,
    })[step] || "我已准备好继续处理这条创作任务。";
  }
  function wuJianCompletionRouteMarkup(template) {
    const isReview = state.wuJian.publishMode !== "auto";
    const releaseLabel = state.wuJian.timing === "scheduled" ? "定时发布" : "立即发布";
    const scheduleLabel = state.wuJian.scheduleAt ? state.wuJian.scheduleAt.replace("T", " ") : "已排期";
    const autoScheduled = !isReview && state.wuJian.timing === "scheduled";
    return `<div class="wujian-completion-route ${isReview ? "is-review" : "is-auto"}"><header><div><span>${isReview ? "等你确认" : autoScheduled ? "已安排" : "已经发出"}</span><strong>${isReview ? "成片等你看一眼" : autoScheduled ? "等待定时发布" : `已${releaseLabel}`}</strong></div><em>${isReview ? releaseLabel : (autoScheduled ? scheduleLabel : "发布成功")}</em></header><p>${isReview ? `看过《${escapeHtml(template.title)}》的标题、封面和内容后，${releaseLabel === "定时发布" ? `会在 ${escapeHtml(scheduleLabel)} 发出` : "就会马上发出"}。` : autoScheduled ? `《${escapeHtml(template.title)}》已安排在 ${escapeHtml(scheduleLabel)} 发布，短视频运营专员会在执行后把结果发回这条对话。` : `《${escapeHtml(template.title)}》已经按你的设置处理好了，去作品里可以看到发布结果。`}</p>${isReview ? `<button type="button" class="is-primary" data-wujian-review-work>去作品里确认</button>` : `<button type="button" data-wujian-section="works">去看作品</button>`}</div>`;
  }
  function wuJianAddChatMessage(role, text) {
    state.wuJian.chatMessages = Array.isArray(state.wuJian.chatMessages) ? state.wuJian.chatMessages : [];
    state.wuJian.chatMessages.push({ role, text, time: nowDateTime() });
  }
  function wuJianSyncComposerForm(form) {
    const data = new FormData(form);
    state.wuJian.prompt = String(data.get("prompt") || "").trim();
    state.wuJian.model = String(data.get("model") || state.wuJian.model);
    state.wuJian.ratio = String(data.get("ratio") || state.wuJian.ratio);
    state.wuJian.duration = String(data.get("duration") || state.wuJian.duration);
    state.wuJian.creative = String(data.get("creative") || state.wuJian.creative || "实车测评");
    state.wuJian.style = String(data.get("style") || state.wuJian.style);
    state.wuJian.hook = String(data.get("hook") || state.wuJian.hook || "反差实测");
    state.wuJian.voice = String(data.get("voice") || state.wuJian.voice);
    state.wuJian.autoMode = String(data.get("autoMode") || state.wuJian.autoMode || "自动成片");
    state.wuJian.canvas = data.get("canvas") === "true";
  }
  function generateWuJianScript(form) {
    wuJianSyncComposerForm(form);
    const template = wuJianTemplate();
    state.wuJian.historyId = "draft-space";
    state.wuJian.section = "history";
    state.wuJian.script = state.wuJian.script || template.script;
    state.wuJian.flowStep = "script-ready";
    state.wuJian.generationStatus = "ready";
    state.wuJian.showPlan = true;
    state.wuJian.assetCheckStatus = "pending";
    state.wuJian.chatMessages = [];
    wuJianAddChatMessage("user", state.wuJian.prompt || "请根据已选素材生成一条汽车短视频脚本。");
    wuJianAddChatMessage("agent", wuJianFlowMessage("script-ready"));
    persistWuJian();
    renderWorkspace();
    if (typeof showToast === "function") showToast("脚本写好了", "去创作记录里查看每个镜头，也可以继续修改");
  }
  function finishWuJianQueue() {
    completeWuJianProduction();
  }
  function startWuJianQueue() {
    state.wuJian.flowStep = "queue";
    state.wuJian.generationStatus = "generating";
    state.wuJian.queueProgress = 28;
    state.wuJian.queueEta = "约 3 分钟";
    state.wuJian.generatedWorkId = "";
    state.wuJian.publishResult = "";
    employees["ai-video"].progress = 28;
    employees["ai-video"].task = "正在生成关键帧，随后合成视频";
    wuJianAddChatMessage("agent", wuJianFlowMessage("queue"));
    persistWuJian();
    renderWorkspace();
    window.setTimeout(finishWuJianQueue, 2600);
  }
  function openWuJianPublishAccounts() {
    state.wuJian.flowStep = "publish-accounts";
    state.wuJian.generationStatus = "generating";
    state.wuJian.queueProgress = 8;
    state.wuJian.queueEta = "等待发布设置";
    employees["ai-video"].progress = 8;
    employees["ai-video"].task = "成片就绪，等待选择发布账号";
    state.wuJian.publishSetupStep = "accounts";
    state.wuJian.publishAccountIds = Array.isArray(state.wuJian.publishAccountIds) ? state.wuJian.publishAccountIds : [];
    wuJianAddChatMessage("agent", wuJianFlowMessage("publish-accounts"));
    persistWuJian();
    renderWorkspace();
    renderSidePanel();
  }
  function confirmWuJianPublishAccounts() {
    const selected = new Set(state.wuJian.publishAccountIds || []);
    const readyIds = new Set(wuJianPublishAccountRows().filter((item) => item.canTouch).map((item) => item.id));
    const valid = Array.from(selected).filter((id) => readyIds.has(id));
    if (!valid.length) {
      if (typeof showToast === "function") showToast("先选择发布账号", "只有完成营销授权的账号可以继续");
      return;
    }
    state.wuJian.publishAccountIds = valid;
    state.wuJian.publishSetupStep = "config";
    state.wuJian.flowStep = "publish-config";
    state.wuJian.publishModeDraft = state.wuJian.publishMode || "review";
    state.wuJian.publishTimingDraft = state.wuJian.timing || "now";
    wuJianAddChatMessage("user", `我选择发布到${wuJianPublishAccountNames().join("、")}。`);
    wuJianAddChatMessage("agent", wuJianFlowMessage("publish-config"));
    persistWuJian();
    renderWorkspace();
  }
  function confirmWuJianPublishConfig() {
    if (!wuJianPublishAccountNames().length) {
      state.wuJian.flowStep = "publish-accounts";
      renderWorkspace();
      return;
    }
    saveWuJianPublishConfig();
    const mode = state.wuJian.publishMode;
    const timing = state.wuJian.timing;
    const timingText = mode === "review" ? "成片完成后我会先通知你审核" : timing === "scheduled" ? `成片完成后等到 ${state.wuJian.scheduleAt.replace("T", " ")} 自动发布` : "成片完成后直接发布";
    wuJianAddChatMessage("user", mode === "review" ? "我选择审核发布。" : timing === "scheduled" ? `我选择自动发布，定时发布到 ${state.wuJian.scheduleAt.replace("T", " ")}。` : "我选择自动发布，直接发布。");
    wuJianAddChatMessage("agent", `知道了，我会发到${wuJianPublishAccountNames().join("、")}。${timingText}。现在开始生成视频。`);
    state.wuJian.publishSetupStep = "done";
    startWuJianQueue();
  }
  function advanceWuJianFlow(action) {
    if (action !== "history") state.wuJian.section = "history";
    if (action === "confirm-script") {
      wuJianAddChatMessage("user", "我已确认脚本，进入素材核验。");
      state.wuJian.flowStep = "asset-check";
      state.wuJian.assetCheckStatus = "missing";
      wuJianAddChatMessage("agent", wuJianFlowMessage("asset-check"));
    } else if (action === "ai-material") {
      wuJianAddChatMessage("user", "请准备 AI 素材方案。");
      state.wuJian.flowStep = "asset-proposal";
      wuJianAddChatMessage("agent", wuJianFlowMessage("asset-proposal"));
    } else if (action === "confirm-ai-material") {
      wuJianAddChatMessage("user", "我确认这些 AI 素材，继续配置发布。");
      state.wuJian.aiMaterialConfirmed = true;
      state.wuJian.materials = Array.from(new Set([...state.wuJian.materials, "history-delivery"]));
      openWuJianPublishAccounts();
      return;
    } else if (action === "use-library") {
      wuJianAddChatMessage("user", "去素材库挑一组相近画面。");
      state.wuJian.assetCheckStatus = "complete";
      openWuJianPublishAccounts();
      return;
    } else if (action === "history") {
      state.wuJian.section = "history";
      state.workspaceMode = "history";
      renderWorkspace();
      return;
    } else if (action === "confirm-publish-accounts") {
      confirmWuJianPublishAccounts();
      return;
    } else if (action === "back-publish-accounts") {
      state.wuJian.flowStep = "publish-accounts";
      state.wuJian.publishSetupStep = "accounts";
      renderWorkspace();
      return;
    } else if (action === "confirm-publish-config") {
      confirmWuJianPublishConfig();
      return;
    }
    persistWuJian();
    renderWorkspace();
  }
  function wuJianPublishConfigFromMessage(message) {
    const mode = /审核发布|人工审核/.test(message) ? "review" : /全自动发布|自动发布/.test(message) ? "auto" : "";
    const timing = /定时发布|定时/.test(message) ? "scheduled" : /立即发布|马上发布/.test(message) ? "now" : "";
    if (!mode && !timing) return "";
    const settings = { ...defaultSettings["ai-video"], ...(state.settings["ai-video"] || {}) };
    const accounts = wuJianPublishAccounts(settingsAccounts("ai-video")).filter((account) => account.canTouch);
    const target = accounts.find((account) => {
      const aliases = [account.nickname, account.nickname.replace(/^鸿途汽车/, ""), account.nickname.replace("官方旗舰店", "官方账号")];
      return aliases.some((alias) => alias && message.includes(alias));
    }) || accounts.find((account) => account.nickname === state.wuJian.account) || accounts[0];
    if (!target) return "";
    const previous = wuJianAccountPublishConfig(settings, target.nickname);
    const next = { ...previous, ...(mode ? { mode } : {}), ...(timing ? { timing } : {}) };
    const publishByAccount = { ...(settings.publishByAccount || {}), [target.nickname]: next };
    state.settings["ai-video"] = { ...settings, publishByAccount, publishMode: next.mode };
    state.wuJian.account = target.nickname;
    state.wuJian.publishMode = next.mode;
    state.wuJian.timing = next.timing;
    state.wuJian.scheduleAt = next.scheduleAt;
    saveJson(SETTINGS_KEY, state.settings);
    persistWuJian();
    const modeLabel = next.mode === "auto" ? "全自动发布" : "审核发布";
    const timingLabel = next.timing === "scheduled" ? `定时发布（${next.scheduleAt.replace("T", " ")}）` : "立即发布";
    const timingCopy = next.mode === "auto" ? `自动发布时机为${timingLabel}` : `审核通过后${timingLabel}`;
    return `已将${target.nickname}的发布策略更新为${modeLabel}，${timingCopy}。后续成片会按这条账号规则执行。`;
  }

  function handleWuJianChatSubmit(form) {
    const input = $("textarea[name=message]", form);
    const message = input?.value.trim();
    if (!message) return;
    state.wuJian.section = "history";
    wuJianAddChatMessage("user", message);
    const publishResponse = wuJianPublishConfigFromMessage(message);
    let response = publishResponse || "已按你的意见更新脚本，镜号、时长和生成参数保持不变。你可以继续修改，或确认脚本进入素材核验。";
    if (!publishResponse && /颜色|白色|黑色|蓝色|红色/.test(message)) response = "已把车型颜色调整到对应镜头，并同步更新光影与画面描述。请确认后继续。";
    else if (!publishResponse && /车型|车系|换成|替换/.test(message)) response = "已替换脚本中的车型称呼，并重新检查车型库口径。请确认后继续。";
    else if (!publishResponse && /场景|地点|夜景|展厅|高速/.test(message)) response = "已调整场景与环境氛围，保留原有镜头节奏和行动引导。请确认后继续。";
    if (!publishResponse) {
      state.wuJian.prompt = `${state.wuJian.prompt}（${message}）`;
      state.wuJian.script = `${state.wuJian.script}\n修改记录：${message}`;
      state.wuJian.flowStep = "script-ready";
    }
    wuJianAddChatMessage("agent", response);
    if (publishResponse) {
      const settings = { ...defaultSettings["ai-video"], ...(state.settings["ai-video"] || {}) };
      const config = wuJianAccountPublishConfig(settings, state.wuJian.account || "鸿途汽车官方旗舰店");
      const history = Array.isArray(state.wuJian.publishStrategyHistory) ? state.wuJian.publishStrategyHistory : [];
      history.push({ time: nowDateTime(), account: state.wuJian.account, mode: config.mode, timing: config.timing, scheduleAt: config.scheduleAt, source: message });
      state.wuJian.publishStrategyHistory = history.slice(-12);
      persistWuJian();
      state.sidePanelMode = "overview";
      state.workspaceMode = "overview";
    }
    persistWuJian();
    renderWorkspace();
  }
  function wuJianHistoryRows() {
    const currentTemplate = wuJianTemplate();
    return [
      { id: "draft-space", templateId: currentTemplate.id, title: currentTemplate.title, meta: "今天 14:20", status: wuJianFlowLabel(state.wuJian.flowStep || "script-ready"), step: state.wuJian.flowStep || "script-ready", cover: currentTemplate.cover },
      { id: "range-history", templateId: "range-challenge", title: "长续航通勤挑战", meta: "昨天 16:10", status: "视频已完成", step: "complete", cover: "assets/vehicles/e7-longrange-2024.jpg" },
      { id: "family-history", templateId: "family-suv", title: "家庭 SUV 选车三问", meta: "08-08 11:30", status: "脚本已确认", step: "asset-check", cover: "assets/vehicles/fengyun-t9-120-2025.jpg" },
    ];
  }
  function wuJianHistoryDetailMarkup() {
    const historyRows = wuJianHistoryRows();
    const activeRow = historyRows.find((row) => row.id === state.wuJian.historyId) || historyRows[0];
    const template = wuJianTemplates.find((item) => item.id === activeRow.templateId) || wuJianTemplate();
    const step = activeRow.id === "draft-space" ? (state.wuJian.flowStep || "script-ready") : activeRow.step;
    const messages = activeRow.id === "draft-space" && Array.isArray(state.wuJian.chatMessages) && state.wuJian.chatMessages.length
      ? state.wuJian.chatMessages
      : [{ role: "user", text: activeRow.id === "draft-space" ? state.wuJian.prompt : `继续查看《${template.title}》创作记录。` }, { role: "agent", text: wuJianFlowMessage(step) }];
    let actionCard = "";
    if (step === "script-ready") {
      actionCard = `<article class="wujian-chat-message is-agent is-action"><div><span>短视频运营专员</span><p>脚本整理好了，共 5 个镜头。我会再帮你检查车型、人物和场景素材，确认后就能继续制作。</p><div class="wujian-inline-actions"><button type="button" class="is-primary" data-wujian-flow="confirm-script">确认脚本，继续选素材</button></div></div></article>`;
    } else if (step === "asset-check") {
      actionCard = `<article class="wujian-chat-message is-agent is-action"><div><span>短视频运营专员</span><p>有 2 个镜头还缺画面。你可以从素材库挑相近画面，也可以让我先给你生成一版参考。</p><div class="wujian-action-list"><div><strong>01 · 白色 ${escapeHtml(template.vehicle)} 外观</strong><small>用于镜头 1、2、5</small><b>待补充</b></div><div><strong>02 · 驾驶座舱内饰与人物</strong><small>用于镜头 3、4</small><b>待补充</b></div></div><div class="wujian-inline-actions"><button type="button" data-wujian-flow="use-library">去素材库挑选</button><button type="button" class="is-primary" data-wujian-flow="ai-material">先生成一版参考</button></div></div></article>`;
    } else if (step === "asset-proposal") {
      actionCard = `<article class="wujian-chat-message is-agent is-action"><div><span>短视频运营专员</span><p>我先准备了两张参考画面，确认后就开始生成关键帧。</p><div class="wujian-ai-material-grid"><article><img src="assets/vehicles/e7-flagship-2025.jpg" alt="车型外观参考画面"><strong>车型外观 · 白色夜景</strong><small>用于镜头 1、2、5 · 9:16</small></article><article><img src="assets/vehicles/e7-yueye-2025.jpg" alt="座舱人物参考画面"><strong>座舱人物 · 真实体验</strong><small>用于镜头 3、4 · 9:16</small></article></div><div class="wujian-inline-actions"><button type="button" class="is-primary" data-wujian-flow="confirm-ai-material">确认画面，开始生成</button></div></div></article>`;
    } else if (step === "publish-accounts") {
      actionCard = `<article class="wujian-chat-message is-agent is-action"><div><span>短视频运营专员</span>${wuJianPublishAccountsMarkup()}</div></article>`;
    } else if (step === "publish-config") {
      actionCard = `<article class="wujian-chat-message is-agent is-action"><div><span>短视频运营专员</span>${wuJianPublishModeMarkup()}</div></article>`;
    } else if (step === "queue") {
      actionCard = `<section class="wujian-history-queue"><header><div><span>正在制作</span><strong>先生成关键画面，再合成视频</strong></div><em>预计 ${escapeHtml(state.wuJian.queueEta || "约 3 分钟")}</em></header><div class="wujian-queue-progress"><i><b style="width:${state.wuJian.queueProgress || 28}%"></b></i><strong>${state.wuJian.queueProgress || 28}%</strong></div><ol><li class="is-done">脚本和素材确认 <b>✓</b></li><li class="is-active">生成关键画面 <b>进行中</b></li><li>合成视频和字幕 <b>稍后</b></li></ol><small>你可以继续修改，确认前不会开始消耗生成额度。</small></section>`;
    } else {
      actionCard = `<section class="wujian-history-video"><header><div><span>视频做好了</span><strong>成片已经回到这次创作里</strong></div><em>已完成</em></header><div class="wujian-video-file"><div class="wujian-video-thumb"><img src="${escapeHtml(template.cover)}" alt="${escapeHtml(template.title)}视频封面"><i>▶</i></div><div><strong>${escapeHtml(template.title)}_新生成.mp4</strong><small>${escapeHtml(state.wuJian.duration)} · ${escapeHtml(state.wuJian.ratio)} · 1080P</small><button type="button" data-wujian-download>查看成片</button></div></div>${wuJianCompletionRouteMarkup(template)}<footer><button type="button" data-wujian-flow="history">继续修改</button></footer></section>`;
    }
    return `<main class="wujian-history-detail"><header class="wujian-history-detail-head"><div><span>短视频运营专员</span><h2>${escapeHtml(template.title)}</h2><p>脚本、画面和成片都在这里，随时回来接着改。</p></div><em>${wuJianFlowLabel(step)}</em></header><div class="wujian-history-thread">${messages.map((message, index) => `<article class="wujian-chat-message is-${message.role}"><div><span>${message.role === "user" ? "你" : "短视频运营专员"}</span><p>${escapeHtml(message.text)}</p>${message.role === "agent" && index === 1 ? wuJianScriptMarkup(template) : ""}</div></article>`).join("")}${actionCard}</div><form id="ai-wujian-chat-form" class="wujian-history-composer"><textarea name="message" rows="2" placeholder="告诉短视频运营专员想改什么，比如车型、颜色或场景"></textarea><div><button type="button" data-wujian-open-picker="history">＋ 添加素材</button><span>直接说你的想法就好</span><button type="submit">发送 ↑</button></div></form></main>${wuJianAssetPickerMarkup()}`;
  }

  function wuJianHistoryPage() {
    const historyRows = wuJianHistoryRows();
    const activeRow = historyRows.find((row) => row.id === state.wuJian.historyId) || historyRows[0];
    return `<div class="wujian-page wujian-history-page"><div class="wujian-history-layout"><aside class="wujian-history-list"><header><div><span>创作记录</span><h2>我的视频</h2><p>脚本、修改和成片，都在这里继续。</p></div><button type="button" data-wujian-section="create">＋ 新建视频</button></header>${historyRows.map((row) => `<button type="button" class="wujian-history-item ${row.id === activeRow.id ? "is-active" : ""}" data-wujian-history="${row.id}" data-wujian-history-template="${row.templateId}"><img src="${row.cover}" alt="${row.title}"><span><strong>${row.title}</strong><small>${row.meta} · ${row.status}</small></span><i>›</i></button>`).join("")}</aside>${wuJianHistoryDetailMarkup()}</div></div>`;
  }
  function wuJianFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  /* 上传校验按抖音官方视频发布限制：MP4 / MOV / WebM，单文件 ≤ 4GB */
  const WUJIAN_VIDEO_LIMITS = { extensions: ["mp4", "mov", "webm"], mime: /^video\/(mp4|quicktime|webm)$/, maxBytes: 4 * 1024 * 1024 * 1024, formatCopy: "MP4 / MOV / WebM", sizeCopy: "4GB" };
  function wuJianVideoFileCheck(file) {
    const name = String(file?.name || "");
    const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    if (!WUJIAN_VIDEO_LIMITS.extensions.includes(ext) && !WUJIAN_VIDEO_LIMITS.mime.test(file?.type || "")) {
      return { ok: false, copy: `仅支持 ${WUJIAN_VIDEO_LIMITS.formatCopy} 格式（抖音发布限制）` };
    }
    if (Number(file?.size || 0) > WUJIAN_VIDEO_LIMITS.maxBytes) {
      return { ok: false, copy: `单个视频不能超过 ${WUJIAN_VIDEO_LIMITS.sizeCopy}（抖音发布限制），当前文件 ${wuJianFileSize(file.size)}` };
    }
    return { ok: true, copy: "" };
  }
  const wuJianUploadedBlobUrls = new Set();
  function wuJianWorkDownloadUrl(item) {
    const url = String(item?.video || "");
    if (!url) return "";
    if (url.startsWith("blob:") && !wuJianUploadedBlobUrls.has(url)) return "";
    return url;
  }
  function wuJianWorkDownloadName(item) {
    const url = String(item?.video || "");
    const raw = String(item?.title || "").replace(/[\\/:*?"<>|]/g, "").trim() || "待发布视频";
    if (/\.[a-z0-9]{2,4}$/i.test(raw)) return raw;
    const ext = (url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i)?.[1] || "mp4").toLowerCase();
    return `${raw}.${ext}`;
  }
  function wuJianTriggerWorkDownload(item) {
    const url = wuJianWorkDownloadUrl(item);
    if (!url) {
      if (typeof showToast === "function") showToast("原文件不可用", "本次会话上传的原文件已失效，请重新上传后再下载");
      return false;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = wuJianWorkDownloadName(item);
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (typeof showToast === "function") showToast("开始下载", `${item.title || "待发布视频"} 已开始下载`);
    return true;
  }
  function handleWuJianUpload(fileList) {
    const files = Array.from(fileList || []).filter((file) => /^(image|video)\//.test(file.type));
    if (!files.length) {
      if (typeof showToast === "function") showToast("还没有添加素材", "请选择图片或视频文件");
      return;
    }
    const uploadedAt = Date.now();
    const uploaded = files.map((file, index) => {
      const isVideo = file.type.startsWith("video/");
      const cover = isVideo || typeof URL === "undefined" || typeof URL.createObjectURL !== "function" ? "assets/live/ai-lead-live.jpg" : URL.createObjectURL(file);
      return { id: `upload-${uploadedAt}-${index}`, name: file.name, type: isVideo ? "视频" : "图片", meta: `刚刚上传 · ${wuJianFileSize(file.size)}`, cover };
    });
    wuJianAssets.history.unshift(...uploaded);
    state.wuJian.assetPickerTab = "history";
    state.wuJian.assetPickerSelected = Array.from(new Set([...(state.wuJian.assetPickerSelected || []), ...uploaded.map((item) => item.id)]));
    persistWuJian();
    if (!state.wuJian.assetPickerOpen) {
      if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
    } else if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
    if (typeof showToast === "function") showToast("素材已添加", `新增 ${uploaded.length} 个素材，确认后就会带回创作`);
  }
  function openWuJianAssetPicker(tab = "history") {
    state.wuJian.assetPickerOpen = true;
    state.wuJian.assetPickerTab = ["history", "vehicles", "works"].includes(tab) ? tab : "history";
    state.wuJian.assetPickerSelected = [];
    if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
  }
  function closeWuJianAssetPicker() {
    state.wuJian.assetPickerOpen = false;
    state.wuJian.assetPickerSelected = [];
    if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
  }
  function confirmWuJianAssetPicker() {
    const selected = Array.from(new Set(state.wuJian.assetPickerSelected || [])).filter((id) => wuJianMaterial(id));
    if (!selected.length) {
      if (typeof showToast === "function") showToast("先选一些素材", "选择图片或视频后再带回创作");
      return;
    }
    state.wuJian.materials = Array.from(new Set([...(state.wuJian.materials || []), ...selected]));
    state.wuJian.showPlan = true;
    state.wuJian.assetPickerOpen = false;
    state.wuJian.assetPickerSelected = [];
    persistWuJian();
    if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
    if (typeof showToast === "function") showToast("素材已带回创作", `已添加 ${selected.length} 项素材`);
  }
  function wuJianAssetPickerMarkup() {
    if (!state.wuJian.assetPickerOpen) return "";
    const tabs = [["history", "我的素材"], ["vehicles", "车型素材"], ["works", "已生成作品"]];
    const allRows = wuJianAssets[state.wuJian.assetPickerTab] || wuJianAssets.history;
    const rows = allRows.filter((item) => state.wuJian.assetPickerTab === "vehicles" || ["图片", "图片组", "图片素材"].includes(item.type));
    const selected = new Set(state.wuJian.assetPickerSelected || []);
    return `<div class="wujian-asset-picker-overlay" data-wujian-picker-close><section class="wujian-asset-picker" role="dialog" aria-modal="true" aria-labelledby="wujian-asset-picker-title"><header><div><span>添加素材</span><h3 id="wujian-asset-picker-title">选好素材，接着创作</h3><p>可以上传新图片，也可以从已有素材里挑选。</p></div><button type="button" data-wujian-picker-close aria-label="关闭素材选择">×</button></header><div class="wujian-asset-picker-tabs">${tabs.map(([id, label]) => { const count = (wuJianAssets[id] || []).filter((item) => id === "vehicles" || ["图片", "图片组", "图片素材"].includes(item.type)).length; return `<button type="button" class="${state.wuJian.assetPickerTab === id ? "is-active" : ""}" data-wujian-picker-tab="${id}">${label}<em>${count}</em></button>`; }).join("")}</div><div class="wujian-asset-picker-body"><div class="wujian-picker-upload"><input type="file" data-wujian-picker-upload-input accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml" multiple hidden><button type="button" data-wujian-picker-upload><i>↑</i><strong>从本地上传图片</strong><small>支持 JPG、PNG、WEBP、GIF、BMP、SVG，可多选</small></button></div><div class="wujian-picker-divider"><span>或从素材库选择</span></div><div class="wujian-picker-grid">${rows.map((item) => `<button type="button" class="wujian-picker-item ${selected.has(item.id) ? "is-selected" : ""}" data-wujian-picker-item="${item.id}"><span><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.name)}"><i>${selected.has(item.id) ? "✓" : ""}</i></span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.meta)}</small></button>`).join("") || `<div class="wujian-picker-empty">这里还没有可用图片，先从本地上传一张吧。</div>`}</div></div><footer><span>${selected.size ? `已选 ${selected.size} 项` : "还没有选择素材"}</span><div><button type="button" data-wujian-picker-close>先不添加</button><button type="button" class="is-primary" data-wujian-picker-confirm>带回创作</button></div></footer></section></div>`;
  }
  function wuJianCreatePage() {
    const template = wuJianTemplate();
    const generating = state.wuJian.generationStatus === "generating";
    const caseFilter = state.wuJian.caseFilter || "all";
    const caseMeta = {
      "rear-space": { group: "test", visuals: ["assets/vehicles/e7-flagship-2025.jpg", "assets/vehicles/e7-yueye-2025.jpg", "assets/vehicles/lingyun-300t-2025.jpg"] },
      "range-challenge": { group: "test", visuals: ["assets/vehicles/e7-longrange-2024.jpg", "assets/vehicles/yaoguang-4wd-2024.jpg", "assets/vehicles/e7-flagship-2025.jpg"] },
      "family-suv": { group: "talk", visuals: ["assets/vehicles/fengyun-t9-120-2025.jpg", "assets/vehicles/lingyun-300t-2025.jpg", "assets/vehicles/e7-yueye-2025.jpg"] },
      "smart-cockpit": { group: "visual", visuals: ["assets/vehicles/yaoguang-4wd-2024.jpg", "assets/vehicles/e7-longrange-2024.jpg", "assets/vehicles/e7-flagship-2025.jpg"] },
    };
    const visibleTemplates = wuJianTemplates.filter((item) => caseFilter === "all" || (item.caseGroup || caseMeta[item.id]?.group) === caseFilter);
    return `<div class="wujian-page wujian-create-page wujian-agent-page">
      ${state.wuJian.matrixSource === "script" ? `<button type="button" class="ai-matrix-create-back" data-wujian-matrix-source="back">← 返回创作来源</button>` : ""}
      ${state.wuJian.recreateWork ? `<section class="ai-recreate-banner"><i aria-hidden="true">↻</i><div><strong>基于《${escapeHtml(state.wuJian.recreateWork.title)}》二创</strong><small>来源账号：${escapeHtml(state.wuJian.recreateWork.account)} · 保留核心卖点，改编成自有版本</small></div><button type="button" data-wujian-recreate-clear>取消二创</button></section>` : ""}
      <section class="wujian-agent-hero">
        <form class="wujian-agent-composer" id="ai-wujian-create-form">
          <div class="wujian-agent-prompt">
            <textarea name="prompt" rows="4" placeholder="比如：用 E7 实车素材做一条 30 秒后排空间测评，开头先说结论，吸引家庭用户来试驾">${escapeHtml(state.wuJian.prompt)}</textarea>
            <textarea name="script" hidden>${escapeHtml(state.wuJian.script)}</textarea>
            <input type="hidden" name="voice" value="${escapeHtml(state.wuJian.voice)}">
          </div>
          <footer class="wujian-agent-toolbar">
            <div class="wujian-agent-tools">
              <button class="wujian-tool-icon" type="button" data-wujian-open-picker="history" title="添加素材" aria-label="添加素材">＋</button>
              <button class="wujian-tool-icon" type="button" data-wujian-asset-shortcut="roles" title="添加出镜角色" aria-label="添加出镜角色">＠</button>
              <label class="wujian-tool-select"><span>◫</span><select name="model" data-wujian-control aria-label="生成模型"><option ${state.wuJian.model === "Seedance 2.5" ? "selected" : ""}>Seedance 2.5</option><option ${state.wuJian.model === "MiniMax H3" ? "selected" : ""}>MiniMax H3</option><option ${state.wuJian.model === "Seedance 2.0 Mini" ? "selected" : ""}>Seedance 2.0 Mini</option></select></label>
              <label class="wujian-tool-select"><span>◌</span><select name="style" data-wujian-control aria-label="视频风格"><option ${state.wuJian.style === "真实测评" ? "selected" : ""}>真实测评</option><option ${state.wuJian.style === "顾问口播" ? "selected" : ""}>顾问口播</option><option ${state.wuJian.style === "纪录片感" ? "selected" : ""}>纪录片感</option><option ${state.wuJian.style === "科技感 TVC" ? "selected" : ""}>科技感 TVC</option></select></label>
              <label class="wujian-tool-select is-compact"><span>▣</span><select name="ratio" data-wujian-control aria-label="画面比例"><option ${state.wuJian.ratio === "9:16" ? "selected" : ""}>9:16</option><option ${state.wuJian.ratio === "16:9" ? "selected" : ""}>16:9</option><option ${state.wuJian.ratio === "1:1" ? "selected" : ""}>1:1</option></select></label>
              <label class="wujian-tool-select is-compact"><span>◷</span><select name="duration" data-wujian-control aria-label="视频时长"><option ${state.wuJian.duration === "20 秒" ? "selected" : ""}>20 秒</option><option ${state.wuJian.duration === "30 秒" ? "selected" : ""}>30 秒</option><option ${state.wuJian.duration === "45 秒" ? "selected" : ""}>45 秒</option><option ${state.wuJian.duration === "60 秒" ? "selected" : ""}>60 秒</option></select></label>
            </div>
            <div class="wujian-agent-actions"><button class="wujian-agent-submit" type="submit" ${generating ? "disabled" : ""} title="生成脚本" aria-label="生成脚本">${generating ? "76%" : "↑"}</button></div>
          </footer>
        </form>
      </section>
      <section class="wujian-cases wujian-agent-cases">
        <header><div><span>汽车视频灵感</span><h3>看中哪条，就从哪条开始</h3><p>先看视频，再挑你想带走的画面或文案，换成自己的车型继续创作。</p></div><div class="wujian-case-filters">${[["all","全部"],["test","实车测评"],["talk","车型口播"],["visual","展厅大片"]].map((filter) => `<button class="${caseFilter === filter[0] ? "is-active" : ""}" type="button" data-wujian-case-filter="${filter[0]}">${filter[1]}</button>`).join("")}</div></header>
        <div class="wujian-case-wall">${visibleTemplates.map((item) => { const meta = caseMeta[item.id] || { visuals: [item.cover, item.cover, item.cover] }; const playable = Boolean(item.video); return `<article class="wujian-material-tile ${playable ? "is-video-case" : "is-mock-case"} ${item.id === state.wuJian.templateId ? "is-selected" : ""}"><button type="button" class="wujian-material-preview" data-wujian-case-preview="${item.id}" aria-label="查看${escapeHtml(item.title)}${playable ? "视频" : "灵感"}">${playable ? `<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}" data-wujian-case-cover data-wujian-cover-source="${escapeHtml(item.cover)}" data-wujian-video-fallback="${escapeHtml(item.video)}" decoding="async" loading="eager">` : `<div class="wujian-material-storyboard">${meta.visuals.map((visual, index) => `<img src="${escapeHtml(visual)}" alt="${escapeHtml(item.title)}镜头${index + 1}">`).join("")}</div>`}<span class="wujian-material-badge">${playable ? "▶ 观看视频" : "灵感参考"}</span><em>${escapeHtml(item.duration)}</em></button><div class="wujian-material-copy"><small>${escapeHtml(item.vehicle)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.hook)}</p><footer><span>${escapeHtml(item.result)}</span><button type="button" data-wujian-case-detail="${item.id}">查看详情</button><button type="button" class="is-primary" data-wujian-case-detail="${item.id}">${item.id === state.wuJian.templateId && state.wuJian.showPlan ? "已带入创作" : "用这条开始"}</button></footer></div></article>`; }).join("")}</div>
        ${wuJianCaseDetailMarkup()}
      </section>
      ${wuJianAssetPickerMarkup()}
    </div>`;
  }
  function wuJianStructuredCreatePage() {
    const template = wuJianTemplate();
    const selectedMaterials = wuJianSelectedMaterials();
    const generating = state.wuJian.generationStatus === "generating";
    const complete = state.wuJian.generationStatus === "complete";
    return `<div class="wujian-page wujian-create-page">
      <section class="wujian-page-head"><div><span>汽车短视频创作台</span><h2>把一个想法，变成可发布成片</h2><p>告诉短视频运营专员你想拍什么，脚本和画面会准备好，发布前由你确认，通过后进入本周发布计划。</p></div><div class="wujian-head-metrics"><article><strong>100</strong><span>接入账号</span></article><article><strong>12</strong><span>待审核</span></article><article><strong>¥5</strong><span>每账号/天</span></article></div></section>
      <div class="wujian-create-layout">
        <form class="wujian-studio" id="ai-wujian-create-form">
          <section class="wujian-composer"><header><div><span class="wujian-avatar"><img src="${employeeImage("ai-video")}" alt="短视频运营专员"></span><div><strong>短视频运营专员</strong><small><i></i>在线，随时可以开始</small></div></div><em>车型信息会帮你核对</em></header><label><span>你想拍一条什么视频？</span><textarea name="prompt" rows="3" placeholder="比如：为 E7 做一条 30 秒后排空间实测，吸引家庭用户来试驾">${escapeHtml(state.wuJian.prompt)}</textarea></label><div class="wujian-composer-tools"><button type="button" data-wujian-open-picker="history">＋ 添加素材</button><button type="button" data-wujian-add-vehicle>车 引用车型</button><span>${selectedMaterials.length} 项素材已准备好</span></div></section>
          <div class="wujian-studio-grid">
            <section class="wujian-material-panel"><header><div><span>01</span><strong>参考素材</strong></div><button type="button" data-wujian-open-picker="history">挑选素材</button></header><div class="wujian-selected-assets">${selectedMaterials.map((item) => `<article><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.name)}"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.meta)}</small></div><button type="button" data-wujian-remove-material="${item.id}" aria-label="移除${escapeHtml(item.name)}">×</button></article>`).join("") || `<div class="wujian-empty"><span>＋</span><strong>先挑几张喜欢的画面</strong><small>可以从上传记录、出镜角色或车型里选择</small></div>`}</div></section>
            <section class="wujian-script-panel"><header><div><span>02</span><strong>视频脚本</strong></div><em>已加入车型 · ${escapeHtml(template.vehicle)}</em></header><label><span>镜头、口播和字幕</span><textarea name="script" rows="10">${escapeHtml(state.wuJian.script)}</textarea></label><footer><span>车型名称、公开参数和行动引导已帮你核对</span><button type="button" data-wujian-polish>帮我润色</button></footer></section>
          </div>
          <section class="wujian-config-panel"><header><div><span>03</span><strong>视频设置</strong></div><em>按你的发布场景来选</em></header><div class="wujian-config-grid"><label><span>生成模型</span><select name="model"><option ${state.wuJian.model === "Seedance 2.5" ? "selected" : ""}>Seedance 2.5</option><option ${state.wuJian.model === "MiniMax H3" ? "selected" : ""}>MiniMax H3</option><option ${state.wuJian.model === "Seedance 2.0 Mini" ? "selected" : ""}>Seedance 2.0 Mini</option></select><small>适合连续镜头和精准节奏</small></label><label><span>画面比例</span><select name="ratio"><option ${state.wuJian.ratio === "9:16" ? "selected" : ""}>9:16</option><option ${state.wuJian.ratio === "16:9" ? "selected" : ""}>16:9</option><option ${state.wuJian.ratio === "1:1" ? "selected" : ""}>1:1</option></select><small>短视频推荐 9:16</small></label><label><span>视频时长</span><select name="duration"><option ${state.wuJian.duration === "20 秒" ? "selected" : ""}>20 秒</option><option ${state.wuJian.duration === "30 秒" ? "selected" : ""}>30 秒</option><option ${state.wuJian.duration === "45 秒" ? "selected" : ""}>45 秒</option><option ${state.wuJian.duration === "60 秒" ? "selected" : ""}>60 秒</option></select><small>当前脚本适配 ${escapeHtml(state.wuJian.duration)}</small></label><label><span>创意风格</span><select name="style"><option ${state.wuJian.style === "真实测评" ? "selected" : ""}>真实测评</option><option ${state.wuJian.style === "顾问口播" ? "selected" : ""}>顾问口播</option><option ${state.wuJian.style === "纪录片感" ? "selected" : ""}>纪录片感</option><option ${state.wuJian.style === "科技感 TVC" ? "selected" : ""}>科技感 TVC</option></select><small>会影响镜头、字幕和配乐节奏</small></label><label><span>口播角色</span><select name="voice"><option>短视频运营专员 · 清晰女声</option><option>林顾问 · 专业男声</option><option>纯字幕 · 无口播</option></select><small>可从角色库里更换</small></label></div><footer><div><strong>按账号月度托管</strong><small>发布排期与效果回收已包含</small></div><button class="wujian-generate" type="submit" ${generating ? "disabled" : ""}>${generating ? "正在生成 76%" : complete ? "再生成一个版本" : "生成脚本"}<span>→</span></button></footer></section>
        </form>
        <aside class="wujian-preview"><header><span>制作进度</span><em><i></i>${generating ? "正在生成" : complete ? "成片已完成" : "准备好了"}</em></header><div class="wujian-preview-screen"><img src="${escapeHtml(template.cover)}" alt="${escapeHtml(template.title)}"><span class="wujian-preview-play">▶</span><div><strong>${escapeHtml(template.title)}</strong><small>${escapeHtml(state.wuJian.ratio)} · ${escapeHtml(state.wuJian.duration)}</small></div></div><ol class="wujian-progress-list">${[["整理素材",100],["生成脚本",100],["核对车型信息",100],["合成视频",generating ? 76 : complete ? 100 : 0],["配字幕和封面",complete ? 100 : 0]].map((row, index) => `<li class="${row[1] === 100 ? "is-done" : row[1] > 0 ? "is-active" : ""}"><i>${row[1] === 100 ? "✓" : index + 1}</i><div><strong>${row[0]}</strong><span><b style="width:${row[1]}%"></b></span></div><em>${row[1]}%</em></li>`).join("")}</ol>${complete ? `<div class="wujian-complete"><strong>成片已放进作品库</strong><small>发布前会按你设置的账号规则执行</small><button type="button" data-workspace-tab="settings">查看发布设置</button></div>` : `<div class="wujian-preview-note"><span>发布前提醒</span><p>车型信息、音乐版权和公开发布，都会在最后一步请你确认。</p></div>`}</aside>
      </div>
      <section class="wujian-cases"><header><div><span>汽车视频灵感</span><h3>喜欢哪条，就从哪条开始</h3><p>先看一眼，再把画面、文案或整条创作思路带回自己的视频。</p></div><div class="wujian-case-filters"><button class="is-active" type="button">全部</button><button type="button">空间实测</button><button type="button">车型口播</button><button type="button">视觉大片</button></div></header><div class="wujian-case-grid">${wuJianTemplates.map((item) => `<article class="${item.id === state.wuJian.templateId ? "is-selected" : ""}"><div class="wujian-case-cover"><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}"><span>${escapeHtml(item.tag)}</span><em>▶ ${escapeHtml(item.duration)}</em></div><div><small>${escapeHtml(item.vehicle)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.hook)}</p><footer><span>${escapeHtml(item.result)}</span><button type="button" data-wujian-replicate="${item.id}">${item.id === state.wuJian.templateId ? "已带入创作" : "用这条开始"}</button></footer></div></article>`).join("")}</div></section>
    </div>`;
  }

  function wuJianAssetsPage() {
    const tabs = [["works","作品"],["history","我的素材"],["roles","出镜角色"],["vehicles","车型"]];
    const rows = wuJianAssets[state.wuJian.assetTab] || wuJianAssets.works;
    const copy = { works: ["生成作品", "做好的视频和封面，都在这里"], history: ["我的素材", "上传过的图片和视频，随时拿来继续创作"], roles: ["出镜角色", "想让谁出镜，来这里挑"], vehicles: ["车型素材", "已核对过的车型图片，拿来就能用"] }[state.wuJian.assetTab] || ["素材库", "把喜欢的素材留在手边"];
    return `<div class="wujian-page wujian-assets-page"><input type="file" data-wujian-upload-input accept="image/*,video/*" multiple hidden><nav class="wujian-asset-tabs">${tabs.map((tab) => `<button type="button" class="${state.wuJian.assetTab === tab[0] ? "is-active" : ""}" data-wujian-asset-tab="${tab[0]}"><i>${tab[0] === "works" ? "片" : tab[0] === "history" ? "传" : tab[0] === "roles" ? "人" : "车"}</i><span>${tab[1]}</span><em>${wuJianAssets[tab[0]].length}</em></button>`).join("")}</nav><section class="wujian-asset-content"><header><div><span>${copy[0]}</span><h3>${copy[1]}</h3></div><div><button class="wujian-primary" type="button" data-wujian-upload>＋ 添加素材</button><button type="button">筛选类型</button><button type="button">最近添加 ↓</button></div></header><div class="wujian-asset-grid">${rows.map((item) => `<article><div><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.name)}"><span>${escapeHtml(item.type)}</span><label><input type="checkbox" ${state.wuJian.materials.includes(item.id) ? "checked" : ""} disabled><i>${state.wuJian.materials.includes(item.id) ? "已选中" : "可选"}</i></label></div><section><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.meta)}</small><footer><button type="button" data-wujian-use-asset="${item.id}">${state.wuJian.materials.includes(item.id) ? "已加入创作" : "加入创作"}</button><button type="button" aria-label="更多操作">•••</button></footer></section></article>`).join("")}</div></section></div>`;
  }

  function wuJianPublishPage() {
    return `<div class="wujian-page wujian-publish-page"><section class="wujian-page-head"><div><span>发布设置</span><h2>成片做好后，按你的节奏发出去</h2><p>你可以选择先看一眼再发布，也可以交给短视频运营专员自动发到指定账号。</p></div><button class="wujian-primary" type="button" data-workspace-tab="settings">去设置发布方式</button></section></div>`;
  }

  function wuJianWorksLegacyPage() {
    const successCount = wuJianWorks.filter((item) => item.status === "success").length;
    return `<div class="wujian-page wujian-works-page"><section class="wujian-page-head"><div><span>作品管理</span><h2>你的每条视频，都有结果可看</h2><p>查看发布状态和播放互动；没发出去的作品，也能接着修改再试一次。</p></div><button class="wujian-primary" type="button" data-wujian-section="create">创作视频</button></section><div class="wujian-work-metrics"><article><span>全部作品</span><strong>${wuJianWorks.length}</strong><small>包含排期和待处理</small></article><article><span>发布成功</span><strong>${successCount}</strong><small>已发到账号</small></article><article><span>总播放</span><strong>21.5万</strong><small>比上周多 18.6%</small></article><article><span>互动总数</span><strong>1.76万</strong><small>赞、评、藏、转</small></article></div><section class="wujian-work-table"><header><div><strong>抖音视频</strong><span>2 分钟前更新</span></div><div><button type="button">筛选状态</button><button type="button">筛选账号</button><button type="button">导出数据</button></div></header><div class="wujian-work-head"><span>作品</span><span>发布信息</span><span>状态</span><span>播放</span><span>点赞</span><span>评论</span><span>收藏</span><span>分享</span><span>操作</span></div>${wuJianWorks.map((item) => { const status = wuJianStatus(item.status); const action = item.status === "failed" ? `<button type="button" data-wujian-republish="${item.id}">再次发布</button>` : item.status === "generation-failed" ? `<button type="button" data-wujian-retry-generation="${item.id}">重试生成</button>` : item.status === "scheduled" ? `<button type="button">调整发布时间</button>` : `<button type="button">查看详情</button>`; return `<article><div class="wujian-work-title"><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.duration)}</small></span></div><div class="wujian-work-publish"><strong>${escapeHtml(item.time)}</strong><small>${escapeHtml(item.account)}</small></div><div><span class="wujian-status is-${status[1]}"><i></i>${status[0]}</span>${item.error ? `<small class="wujian-error">${escapeHtml(item.error)}</small>` : ""}</div><strong>${item.views}</strong><span>${item.likes}</span><span>${item.comments}</span><span>${item.favorites}</span><span>${item.shares}</span><div class="wujian-work-actions">${action}</div></article>`; }).join("")}</section></div>`;
  }

  function wuJianWorksPage() {
    const filter = state.wuJian.worksFilter || "all";
    const allReviewCount = wuJianWorks.filter((item) => wuJianWorkStatus(item) === "review").length;
    const rows = wuJianWorks.filter((item) => filter === "all" || wuJianWorkStatus(item) === filter);
    const batchMode = Boolean(state.wuJian.worksBatchMode);
    const selectedIds = batchMode ? (state.wuJian.worksSelected || []).filter((id) => rows.some((item) => item.id === id && wuJianWorkStatus(item) === "review")) : [];
    const successCount = wuJianWorks.filter((item) => wuJianWorkStatus(item) === "success").length;
    const statusOptions = [["all", "全部状态"], ["review", "等你确认"], ["success", "发布成功"], ["scheduled", "已排期"], ["failed", "发布失败"], ["generation-failed", "生成失败"]];
    const toolbarBatchAction = batchMode
      ? `<button type="button" class="is-batch" data-wujian-batch-approve ${selectedIds.length ? "" : "disabled"}>确认发布${selectedIds.length ? `（${selectedIds.length}）` : ""}</button><button type="button" class="is-quiet" data-wujian-cancel-batch>取消</button>`
      : allReviewCount ? `<button type="button" class="is-quiet" data-wujian-enter-batch>批量确认</button>` : "";
    return `<div class="wujian-page wujian-works-page"><div class="wujian-work-metrics"><article><span>全部作品</span><strong>${wuJianWorks.length}</strong><small>含待确认、排期作品</small></article><article><span>待确认</span><strong>${allReviewCount}</strong><small>需要人工确认</small></article><article><span>发布成功</span><strong>${successCount}</strong><small>已发到账号</small></article><article><span>总播放</span><strong>21.5万</strong><small>比上周多 18.6%</small></article></div><section class="wujian-work-table"><header><div><strong>抖音视频</strong><span>2 分钟前更新</span></div><div class="wujian-work-toolbar"><label class="wujian-work-filter"><span>状态</span><select data-wujian-status-filter aria-label="作品状态筛选">${statusOptions.map((option) => `<option value="${option[0]}" ${filter === option[0] ? "selected" : ""}>${option[1]}</option>`).join("")}</select></label>${toolbarBatchAction}<button type="button" class="is-quiet">全部账号</button><button type="button" class="is-quiet">导出数据</button></div></header><div class="wujian-work-head"><span>作品</span><span>发布信息</span><span>状态</span><span>播放</span><span>点赞</span><span>评论</span><span>收藏</span><span>分享</span><span>操作</span></div>${rows.length ? rows.map((item) => { const statusKey = wuJianWorkStatus(item); const status = wuJianStatus(statusKey); const isReview = statusKey === "review"; const selectMarkup = batchMode && isReview ? `<label class="wujian-work-select"><input type="checkbox" data-wujian-work-select="${item.id}" ${selectedIds.includes(item.id) ? "checked" : ""} aria-label="选择${escapeHtml(item.title)}"><i></i></label>` : ""; const action = isReview ? `<button type="button" data-wujian-approve-work="${item.id}">确认发布</button>` : statusKey === "failed" ? `<button type="button" data-wujian-republish="${item.id}">再次发布</button>` : statusKey === "generation-failed" ? `<button type="button" data-wujian-retry-generation="${item.id}">重试生成</button>` : statusKey === "scheduled" ? `<button type="button" data-wujian-edit-schedule="${item.id}">调整发布时间</button>` : `<button type="button" data-wujian-view-work="${item.id}">查看详情</button>`; return `<article><div class="wujian-work-title${batchMode && isReview ? " is-review" : ""}">${selectMarkup}<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.duration)}</small></span></div><div class="wujian-work-publish"><strong>${escapeHtml(item.time)}</strong><small>${escapeHtml(item.account)}</small></div><div><span class="wujian-status is-${status[1]}"><i></i>${status[0]}</span>${item.error ? `<small class="wujian-error">${escapeHtml(item.error)}</small>` : ""}</div><strong>${item.views}</strong><span>${item.likes}</span><span>${item.comments}</span><span>${item.favorites}</span><span>${item.shares}</span><div class="wujian-work-actions">${action}</div></article>`; }).join("") : `<div class="wujian-work-empty">这里还没有符合条件的作品</div>`}</section></div>`;
  }

  function wuJianRealtimeWorkbench(content) {
    return `<div class="wujian-realtime-page">
      <main class="wujian-workbench-main wujian-workbench-main--full">${content}</main>
    </div>`;
  }

  function refreshWuJianLiveWorkspace() {
    const workspace = $("#demo-live-workspace");
    if (!workspace || typeof window.renderWuJianLiveWorkspace !== "function") return false;
    const root = workspace.closest("[data-view='demo-live']") || workspace.parentElement;
    window.renderWuJianLiveWorkspace(root || workspace);
    return true;
  }
  function clearWuJianAssetPickerPortal() {
    document.querySelectorAll("body > .wujian-asset-picker-overlay").forEach((node) => node.remove());
  }
  function portalWuJianAssetPicker(root) {
    const picker = root?.querySelector(".wujian-asset-picker-overlay");
    if (picker) document.body.appendChild(picker);
  }

  // ---------- 指定账号二创：监控账号 / 作品池 / 同步任务 ----------
  const wuJianMonitorGroups = ["品牌官方", "区域门店", "对标账号"];
  const wuJianMonitorSeeds = [
    { id: "ma-01", handle: "hongtu_official", name: "鸿途汽车官方", group: "品牌官方", status: "监控中", autoSync: true, lastSync: "今天 09:00", works: 3 },
    { id: "ma-02", handle: "hongtu_flagship", name: "鸿途汽车旗舰店", group: "品牌官方", status: "监控中", autoSync: true, lastSync: "今天 09:00", works: 2 },
    { id: "ma-03", handle: "hongtu_hz_chengxi", name: "杭州城西店", group: "区域门店", status: "监控中", autoSync: true, lastSync: "昨天 18:00", works: 1 },
    { id: "ma-04", handle: "hongtu_sz_baoan", name: "深圳宝安店", group: "区域门店", status: "监控中", autoSync: false, lastSync: "昨天 18:00", works: 0 },
    { id: "ma-05", handle: "hongtu_sh_pudong", name: "上海浦东店", group: "区域门店", status: "监控中", autoSync: true, lastSync: "昨天 18:00", works: 2 },
    { id: "ma-06", handle: "hongtu_cd_tianfu", name: "成都天府店", group: "区域门店", status: "暂停", autoSync: false, lastSync: "08-12 18:00", works: 1 },
    { id: "ma-07", handle: "hongtu_bj_chaoyang", name: "北京朝阳店", group: "区域门店", status: "监控中", autoSync: true, lastSync: "今天 09:00", works: 1 },
    { id: "ma-08", handle: "xingtu_e7_ceping", name: "星途E7测评号", group: "对标账号", status: "监控中", autoSync: true, lastSync: "今天 09:00", works: 2 },
    { id: "ma-09", handle: "dianche_yanxuan", name: "电车严选", group: "对标账号", status: "监控中", autoSync: true, lastSync: "昨天 18:00", works: 1 },
    { id: "ma-10", handle: "jiazheng_duibi", name: "家装车对比研究所", group: "对标账号", status: "监控中", autoSync: false, lastSync: "08-11 18:00", works: 0 },
    { id: "ma-11", handle: "hongtu_hf_baojin", name: "合肥宝津店", group: "区域门店", status: "监控中", autoSync: true, lastSync: "昨天 18:00", works: 0 },
    { id: "ma-12", handle: "xingtu_lingyun_vlog", name: "星途凌云日常", group: "对标账号", status: "监控中", autoSync: true, lastSync: "今天 09:00", works: 1 },
  ];
  const wuJianWorksPoolSeeds = [
    { id: "wp-01", title: "E7 后排空间实测", account: "ma-01", plays: "18.6万", likes: "1.2万", comments: "863", grabbedAt: "今天 09:05", status: "未处理" },
    { id: "wp-02", title: "一次看懂 E7 增程续航", account: "ma-01", plays: "9.4万", likes: "6,200", comments: "411", grabbedAt: "今天 09:06", status: "未处理" },
    { id: "wp-03", title: "自动泊车挑战窄车位", account: "ma-01", plays: "23.1万", likes: "1.8万", comments: "1,204", grabbedAt: "今天 09:07", status: "未处理" },
    { id: "wp-04", title: "旗舰店 18:30 首发记录", account: "ma-02", plays: "5.2万", likes: "3,100", comments: "238", grabbedAt: "今天 09:10", status: "未处理" },
    { id: "wp-05", title: "城西店交车现场", account: "ma-03", plays: "2.8万", likes: "1,600", comments: "152", grabbedAt: "昨天 18:20", status: "未处理" },
    { id: "wp-06", title: "上海浦东店试驾实录", account: "ma-05", plays: "4.1万", likes: "2,200", comments: "187", grabbedAt: "昨天 18:25", status: "未处理" },
    { id: "wp-07", title: "E7 全场景空间对比", account: "ma-08", plays: "31.5万", likes: "2.6万", comments: "1,730", grabbedAt: "今天 09:15", status: "未处理" },
    { id: "wp-08", title: "电车保值率真实样本", account: "ma-09", plays: "15.8万", likes: "9,800", comments: "642", grabbedAt: "昨天 18:30", status: "未处理" },
    { id: "wp-09", title: "家庭出游装载实测", account: "ma-01", plays: "12.3万", likes: "8,500", comments: "520", grabbedAt: "今天 09:08", status: "已二创" },
    { id: "wp-10", title: "北京朝阳店 12 台现车盘点", account: "ma-07", plays: "3.6万", likes: "1,900", comments: "96", grabbedAt: "昨天 18:22", status: "未处理" },
    { id: "wp-11", title: "E7 高速能耗实测", account: "ma-08", plays: "8.9万", likes: "5,400", comments: "301", grabbedAt: "今天 09:16", status: "未处理" },
    { id: "wp-12", title: "后备箱隔板安装教程", account: "ma-05", plays: "6.2万", likes: "3,800", comments: "214", grabbedAt: "昨天 18:27", status: "已排期" },
    { id: "wp-13", title: "凌云山路驾驶动态", account: "ma-12", plays: "7.7万", likes: "4,600", comments: "276", grabbedAt: "今天 09:18", status: "未处理" },
  ];
  const wuJianSyncSeeds = [
    { id: "st-01", account: "ma-01", triggeredAt: "今天 09:00", mode: "每日自动", status: "已完成", progress: 100, newCount: 3 },
    { id: "st-02", account: "ma-02", triggeredAt: "今天 09:00", mode: "每日自动", status: "已完成", progress: 100, newCount: 2 },
    { id: "st-03", account: "ma-08", triggeredAt: "今天 09:00", mode: "每日自动", status: "已完成", progress: 100, newCount: 2 },
    { id: "st-04", account: "ma-10", triggeredAt: "昨天 18:00", mode: "每日自动", status: "失败", progress: 42, newCount: 0 },
  ];
  const wuJianMonitorWorkCandidates = {
    "ma-01": ["E7 隔音静谧性实测", "后排放平当床用", "雨天高速车身稳定性"],
    "ma-02": ["旗舰店交车仪式", "金融方案讲解"],
    "ma-03": ["城西店保养流程", "老车主回访实录"],
    "ma-04": ["宝安店现车实拍", "置换流程详解"],
    "ma-05": ["浦东店充电桩实测", "家庭版配置单"],
    "ma-06": ["天府店交车现场", "川西自驾路线"],
    "ma-07": ["朝阳店夜间试驾", "二手车评估"],
    "ma-08": ["E7 智驾高速实测", "雨夜泊车挑战"],
    "ma-09": ["电车冬季续航样本", "三电质保解析"],
    "ma-10": ["MPV 家用横评", "SUV 七座对比"],
    "ma-11": ["合肥宝津店开业实况", "售后回访记录"],
    "ma-12": ["凌云城市通勤实录", "周末露营装载"],
  };
  const wuJianMonitorAccounts = wuJianMonitorSeeds.map((row) => ({ ...row }));
  const wuJianWorksPool = wuJianWorksPoolSeeds.map((row) => ({ ...row }));
  const wuJianSyncTasks = wuJianSyncSeeds.map((row) => ({ ...row }));
  const wuJianBatchTasks = []; // 二创产出 → 发布任务

  function wuJianMonitorAccountName(id) {
    return wuJianMonitorAccounts.find((row) => row.id === id)?.name || "未知账号";
  }
  function wuJianMonitorAccountHandle(id) {
    return wuJianMonitorAccounts.find((row) => row.id === id)?.handle || "";
  }
  function wuJianMonitorStatusPill(status) {
    const tone = { "监控中": "ok", "暂停": "muted" }[status] || "muted";
    return `<span class="ai-matrix-pill is-${tone}"><i></i>${escapeHtml(status)}</span>`;
  }
  function wuJianWorkPoolStatusPill(status) {
    const tone = { "未处理": "warning", "已二创": "schedule", "已排期": "ok" }[status] || "muted";
    return `<span class="ai-matrix-pill is-${tone}"><i></i>${escapeHtml(status)}</span>`;
  }
  function wuJianSyncStatusPill(status) {
    const tone = { "已完成": "ok", "同步中": "schedule", "失败": "danger" }[status] || "muted";
    return `<span class="ai-matrix-pill is-${tone}"><i></i>${escapeHtml(status)}</span>`;
  }
  function wuJianMatrixPublishAccount(index) {
    const accounts = matrixData().accounts;
    return accounts.length ? accounts[index % accounts.length].name : "鸿途汽车·上海旗舰店";
  }

  function wuJianRenderActive() {
    if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
  }
  function wuJianMatrixMonitorPage() {
    const tab = state.wuJian.monitorTab || "accounts";
    const running = wuJianSyncTasks.filter((task) => task.status === "同步中").length;
    const pendingWorks = wuJianWorksPool.filter((work) => work.status === "未处理").length;
    const subTabs = [["accounts", "监控账号"], ["works", "作品池"], ["sync", "同步任务"]];
    const content = tab === "accounts" ? wuJianMatrixMonitorAccountsPage() : tab === "works" ? wuJianMatrixMonitorWorksPage() : wuJianMatrixMonitorSyncPage();
    return `<div class="wujian-page wujian-matrix-page">
      <button type="button" class="ai-matrix-create-back" data-wujian-matrix-source="back">← 返回创作来源</button>
      ${wuJianMatrixKpiMarkup([["监控账号", wuJianMonitorAccounts.length, "按品牌与区域分组"], ["同步任务", wuJianSyncTasks.length, `${running} 个同步中`], ["作品池", wuJianWorksPool.length, `${pendingWorks} 条待处理`], ["待二创", pendingWorks, "可单条或批量处理"]])}
      <section class="ai-matrix-section">
        <header class="ai-matrix-section-head"><div><span>监控与作品池</span><strong>指定账号二创</strong><small>输入要监控的抖音号，作品列表手动或每日自动更新，更新后落到作品池，再做单条或批量二创。</small></div><div class="ai-monitor-tabs">${subTabs.map(([key, label]) => `<button type="button" class="${tab === key ? "is-active" : ""}" data-wujian-monitor-tab="${key}">${escapeHtml(label)}</button>`).join("")}</div></header>
        <div class="ai-monitor-content">${content}</div>
      </section>
    </div>`;
  }
  function wuJianMatrixMonitorAccountsPage() {
    const filter = state.wuJian.monitorGroupFilter || "all";
    const rows = wuJianMonitorAccounts.filter((row) => filter === "all" || row.group === filter);
    const addOpen = Boolean(state.wuJian.monitorAddOpen);
    return `<div class="ai-monitor-accounts">
      <header class="ai-monitor-toolbar"><div class="ai-monitor-title"><span>监控账号</span><strong>${rows.length} 个</strong></div><div class="ai-matrix-group-filter">${[["all", "全部", wuJianMonitorAccounts.length], ...wuJianMonitorGroups.map((group) => [group, group, wuJianMonitorAccounts.filter((row) => row.group === group).length])].map(([key, label, count]) => `<button type="button" class="${filter === key ? "is-active" : ""}" data-wujian-monitor-group-filter="${escapeHtml(key)}">${escapeHtml(label)} <em>${count}</em></button>`).join("")}</div><button type="button" class="ai-monitor-add-btn" data-wujian-monitor-add>＋ 添加账号</button></header>
      ${addOpen ? `<form class="ai-monitor-add-form" data-wujian-monitor-add-form><div><label><span>账号名称</span><input name="name" placeholder="例如：鸿途汽车官方" required></label><label><span>抖音号</span><input name="handle" placeholder="例如：hongtu_official" required></label><label><span>分组</span><select name="group">${wuJianMonitorGroups.map((group) => `<option>${escapeHtml(group)}</option>`).join("")}</select></label></div><footer><button type="button" class="is-primary" data-wujian-monitor-add-submit>开始监控</button><button type="button" data-wujian-monitor-add-cancel>取消</button></footer></form>` : ""}
      <div class="ai-matrix-table"><table><thead><tr><th>账号</th><th>分组</th><th>状态</th><th>最近同步</th><th>作品</th><th>操作</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>@${escapeHtml(row.handle)}</small></td><td>${escapeHtml(row.group)}</td><td>${wuJianMonitorStatusPill(row.status)}</td><td>${escapeHtml(row.lastSync)}</td><td>${row.works} 条</td><td><div class="ai-monitor-actions">${row.status === "暂停" ? `<button type="button" data-wujian-monitor-resume="${escapeHtml(row.id)}">恢复</button>` : `<button type="button" data-wujian-monitor-pause="${escapeHtml(row.id)}">暂停</button>`}<button type="button" class="is-quiet" data-wujian-monitor-sync="${escapeHtml(row.id)}">同步</button><button type="button" class="is-danger" data-wujian-monitor-delete="${escapeHtml(row.id)}">删除</button></div></td></tr>`).join("")}</tbody></table></div>
    </div>`;
  }
  function wuJianMatrixMonitorWorksPage() {
    const accFilter = state.wuJian.worksPoolAccountFilter || "all";
    const statusFilter = state.wuJian.worksPoolStatusFilter || "all";
    const rows = wuJianWorksPool.filter((work) => (accFilter === "all" || work.account === accFilter) && (statusFilter === "all" || work.status === statusFilter));
    const selected = (state.wuJian.worksPoolSelected || []).filter((id) => rows.some((work) => work.id === id));
    const batchOpen = Boolean(state.wuJian.worksBatchOpen);
    return `<div class="ai-monitor-works">
      <header class="ai-monitor-toolbar">
        <div class="ai-monitor-works-filters"><label><span>账号</span><select data-wujian-works-filter-account>${[["all", "全部账号"], ...wuJianMonitorAccounts.map((account) => [account.id, account.name])].map(([key, label]) => `<option value="${escapeHtml(key)}" ${accFilter === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label><label><span>状态</span><select data-wujian-works-filter-status>${[["all", "全部状态"], ["未处理", "未处理"], ["已二创", "已二创"], ["已排期", "已排期"]].map(([key, label]) => `<option value="${key}" ${statusFilter === key ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
        <div class="ai-monitor-works-batch">${selected.length ? `<span>已选 ${selected.length} 条</span><button type="button" class="is-primary" data-wujian-works-batch>批量二创</button><button type="button" class="is-quiet" data-wujian-works-batch-clear>取消选择</button>` : `<button type="button" data-wujian-works-batch>批量二创</button>`}</div>
      </header>
      ${batchOpen ? wuJianBatchPanel(selected) : ""}
      <div class="ai-matrix-table"><table><thead><tr><th></th><th>作品</th><th>来源账号</th><th>播放</th><th>点赞</th><th>评论</th><th>抓取时间</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((work) => `<tr><td><label class="ai-works-select"><input type="checkbox" data-wujian-works-select="${escapeHtml(work.id)}" ${selected.includes(work.id) ? "checked" : ""} aria-label="选择${escapeHtml(work.title)}"><i></i></label></td><td><strong>${escapeHtml(work.title)}</strong></td><td>${escapeHtml(wuJianMonitorAccountName(work.account))}</td><td>${escapeHtml(work.plays)}</td><td>${escapeHtml(work.likes)}</td><td>${escapeHtml(work.comments)}</td><td>${escapeHtml(work.grabbedAt)}</td><td>${wuJianWorkPoolStatusPill(work.status)}</td><td><button type="button" class="is-primary" data-wujian-works-recreate="${escapeHtml(work.id)}">制作二创</button></td></tr>`).join("")}</tbody></table></div>
    </div>`;
  }
  function wuJianBatchPanel(selected) {
    const mode = state.wuJian.worksBatchMode || "cover";
    const route = state.wuJian.worksBatchRoute || "review";
    return `<section class="ai-batch-panel"><header><div><span>批量二创</span><strong>已选 ${selected.length} 条作品</strong><small>选择批量方式与产出去向，统一处理后进入发布任务。</small></div></header>
      <div class="ai-batch-block"><span>批量方式</span><div class="ai-batch-options">${[["cover", "增加首位图", "为每条作品统一添加首帧封面"], ["storyboard", "更改素材分镜顺序", "按钩子优先重排分镜顺序"]].map(([key, label, desc]) => `<button type="button" class="${mode === key ? "is-active" : ""}" data-wujian-works-batch-mode="${key}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(desc)}</small></button>`).join("")}</div></div>
      <div class="ai-batch-block"><span>产出去向</span><div class="ai-batch-options">${[["review", "进入待审核", "成片先停在待审核，你确认后发布"], ["auto", "直接自动发布", "按排期直接发布到账号"]].map(([key, label, desc]) => `<button type="button" class="${route === key ? "is-active" : ""}" data-wujian-works-batch-route="${key}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(desc)}</small></button>`).join("")}</div></div>
      <footer><button type="button" class="is-primary" data-wujian-works-batch-confirm>确认批量二创（${selected.length}）</button><button type="button" data-wujian-works-batch-cancel>取消</button></footer>
    </section>`;
  }
  function wuJianMatrixMonitorSyncPage() {
    return `<div class="ai-monitor-sync">
      <header class="ai-monitor-toolbar"><div class="ai-monitor-title"><span>同步任务</span><strong>${wuJianSyncTasks.length} 次</strong><small>手动刷新与每日自动更新统一记录，失败可重试。</small></div><button type="button" data-wujian-sync-run-all>同步全部账号</button></header>
      <div class="ai-matrix-table"><table><thead><tr><th>账号</th><th>触发时间</th><th>触发方式</th><th>进度</th><th>新增作品</th><th>状态</th><th>操作</th></tr></thead><tbody>${wuJianSyncTasks.slice().reverse().map((task) => `<tr><td><strong>${escapeHtml(wuJianMonitorAccountName(task.account))}</strong><small>@${escapeHtml(wuJianMonitorAccountHandle(task.account))}</small></td><td>${escapeHtml(task.triggeredAt)}</td><td>${escapeHtml(task.mode)}</td><td><span class="ai-matrix-rate"><i><b style="width:${task.progress}%"></b></i><em>${task.progress}%</em></span></td><td>${task.newCount ? `${task.newCount} 条` : "—"}</td><td>${wuJianSyncStatusPill(task.status)}</td><td>${task.status === "失败" ? `<button type="button" data-wujian-sync-retry="${escapeHtml(task.id)}">重试</button>` : task.status === "同步中" ? `<span class="ai-matrix-sync-spin"><i></i>同步中</span>` : ""}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
  }
  function wuJianCompleteSyncTask(taskId) {
    window.setTimeout(() => {
      const task = wuJianSyncTasks.find((item) => item.id === taskId);
      if (!task) return;
      const account = wuJianMonitorAccounts.find((row) => row.id === task.account);
      if (!account) return;
      task.status = "已完成";
      task.progress = 100;
      const candidates = wuJianMonitorWorkCandidates[task.account] || [];
      const taken = wuJianWorksPool.filter((work) => work.account === task.account).length;
      const next = candidates.slice(taken % candidates.length, (taken % candidates.length) + 2);
      next.forEach((title, index) => {
        wuJianWorksPool.unshift({ id: `wp-${Date.now()}-${index}`, title, account: task.account, plays: "1.2万", likes: "860", comments: "53", grabbedAt: "刚刚", status: "未处理" });
      });
      task.newCount = next.length;
      account.works = wuJianWorksPool.filter((work) => work.account === task.account).length;
      persistWuJian();
      wuJianRenderActive();
      if (typeof showToast === "function") showToast("作品已更新", `新抓取 ${next.length} 条作品，已落入作品池`);
    }, 1600);
  }
  function wuJianStartSync(accountId) {
    const account = wuJianMonitorAccounts.find((row) => row.id === accountId);
    if (!account) return;
    const taskId = `st-${Date.now()}`;
    wuJianSyncTasks.unshift({ id: taskId, account: accountId, triggeredAt: "刚刚", mode: "手动", status: "同步中", progress: 32, newCount: 0 });
    account.status = "监控中";
    account.lastSync = "刚刚";
    persistWuJian();
    wuJianRenderActive();
    wuJianCompleteSyncTask(taskId);
  }
  function wuJianSyncAll() {
    const targets = wuJianMonitorAccounts.filter((row) => row.status !== "暂停");
    targets.forEach((row) => wuJianStartSync(row.id));
    if (typeof showToast === "function") showToast("已开始同步", `正在同步 ${targets.length} 个监控账号`);
  }
  function wuJianStartRecreate(workId) {
    const work = wuJianWorksPool.find((item) => item.id === workId);
    if (!work) return;
    state.wuJian.recreateWork = { id: work.id, title: work.title, account: wuJianMonitorAccountName(work.account) };
    state.wuJian.matrixSource = "script";
    state.wuJian.prompt = `基于《${work.title}》这条作品进行二创改编，保留核心卖点，调整开头和字幕，做成我们自己的版本。`;
    work.status = "已二创";
    const route = state.wuJian.publishMode === "auto" ? "auto" : "review";
    wuJianBatchTasks.unshift({ id: `bt-${Date.now()}`, title: `《${work.title}》二创`, account: wuJianMatrixPublishAccount(wuJianBatchTasks.length), source: "指定账号二创", time: "今天", publishMode: route === "auto" ? "自动" : "人工审核", status: route === "auto" ? "已排期" : "待审核" });
    state.workspaceMode = "create";
    state.wuJian.section = "tasks";
    state.wuJian.publishTaskView = "agent";
    state.wuJian.publishTaskSource = "remix";
    state.wuJian.publishTaskStep = 2;
    state.wuJian.publishTaskWorkIds = [work.id];
    state.wuJian.publishTaskRemixGenerated = false;
    persistWuJian();
    wuJianRenderActive();
    if (typeof showToast === "function") showToast("已带入创作台", `基于《${work.title}》开始二创`);
  }
  function wuJianApplyBatch() {
    const selected = (state.wuJian.worksPoolSelected || []).filter((id) => wuJianWorksPool.some((work) => work.id === id && work.status === "未处理"));
    if (!selected.length) return;
    const route = state.wuJian.worksBatchRoute || "review";
    const modeLabel = state.wuJian.worksBatchMode === "storyboard" ? "更改素材分镜顺序" : "增加首位图";
    selected.forEach((id, index) => {
      const work = wuJianWorksPool.find((item) => item.id === id);
      if (!work) return;
      work.status = route === "auto" ? "已排期" : "已二创";
      wuJianBatchTasks.unshift({ id: `bt-${Date.now()}-${index}`, title: `《${work.title}》${modeLabel}`, account: wuJianMatrixPublishAccount(index + wuJianBatchTasks.length), source: "指定账号二创", time: "今天", publishMode: route === "auto" ? "自动" : "人工审核", status: route === "auto" ? "已排期" : "待审核" });
    });
    state.wuJian.worksPoolSelected = [];
    state.wuJian.worksBatchOpen = false;
    persistWuJian();
    wuJianRenderActive();
    if (typeof showToast === "function") showToast(route === "auto" ? "已安排自动发布" : "已进入待审核", `批量${modeLabel}已处理 ${selected.length} 条作品`);
  }

  function matrixData() {
    return window.AIVideoMatrix || {
      accounts: [], groups: [], weekTarget: 0, weekPublished: 0, weekRate: 0,
      pending: [], pendingCount: 0, tasks: [], effects: [],
      statTotals: { plays: 0, interactions: 0, leads: 0 },
    };
  }
  function wuJianMatrixCount(value) {
    const num = Number(value) || 0;
    return num >= 10000 ? `${(num / 10000).toFixed(1)}万` : String(num);
  }
  function wuJianMatrixPill(status) {
    const tone = { "运营中": "ok", "正在发布": "ok", "已发布": "ok", "已排期": "schedule", "排队中": "schedule", "待审核": "warning", "授权待续": "warning", "待接入": "muted", "账号受限": "danger", "发布失败": "danger" }[status] || "muted";
    return `<span class="ai-matrix-pill is-${tone}"><i></i>${escapeHtml(status)}</span>`;
  }
  function wuJianMatrixAccountRows() {
    const data = matrixData();
    const target = data.accounts.reduce((sum, row) => sum + row.weeklyTarget, 0);
    const published = data.accounts.reduce((sum, row) => sum + row.publishedThisWeek, 0);
    return { accounts: data.accounts, groups: data.groups, weekTarget: target, weekPublished: published, weekRate: target ? Math.round((published / target) * 100) : 0 };
  }
  function wuJianMatrixKpiMarkup(kpis) {
    return `<section class="ai-matrix-kpis">${kpis.map(([label, value, note]) => `<article class="ai-matrix-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("")}</section>`;
  }
  function wuJianMatrixPendingItem(item) {
    const actionByType = { "审核": `<button type="button" data-wujian-live-section="tasks">去审核</button>`, "授权": `<button type="button" data-wujian-live-section="data">去处理</button>`, "来源": `<button type="button" data-wujian-live-section="tasks">补充素材</button>`, "失败": `<button type="button" data-wujian-live-section="tasks">重新生成</button>`, "受限": `<button type="button" data-wujian-live-section="data">去处理</button>` };
    return `<article class="ai-matrix-pending-item"><i>!</i><div><strong>${escapeHtml(item.label)}</strong><small>${item.count} 项待处理</small></div>${actionByType[item.type] || ""}</article>`;
  }
  function wuJianLivePublishRows(data) {
    const fallback = [
      { id: "live-001", name: "鸿途汽车·上海旗舰店", group: "旗舰店", city: "上海", status: "运营中" },
      { id: "live-002", name: "鸿途汽车·杭州城东店", group: "城市店", city: "杭州", status: "运营中" },
      { id: "live-003", name: "鸿途汽车·深圳体验中心", group: "专营店", city: "深圳", status: "运营中" },
      { id: "live-004", name: "鸿途汽车·北京旗舰店", group: "旗舰店", city: "北京", status: "运营中" },
      { id: "live-005", name: "鸿途汽车·成都城西店", group: "城市店", city: "成都", status: "运营中" },
      { id: "live-006", name: "鸿途汽车·宁波服务店", group: "专营店", city: "宁波", status: "运营中" },
    ];
    const source = (data.accounts && data.accounts.length ? data.accounts : fallback).slice(0, 6);
    const states = [
      ["正在上传", 82, "预计 1 分钟"],
      ["处理中", 64, "预计 2 分钟"],
      ["等待发布", 46, "排队中"],
      ["已发布", 100, "刚刚完成"],
      ["排队中", 28, "预计 4 分钟"],
      ["处理中", 58, "预计 2 分钟"],
    ];
    return source.map((account, index) => {
      const publishState = states[index % states.length][0];
      const publishLabel = publishState === "已发布" ? "已发布" : ["等待发布", "排队中"].includes(publishState) ? "排队中" : "正在发布";
      return { ...account, publishState, publishLabel, progress: states[index % states.length][1], eta: states[index % states.length][2] };
    });
  }
  function wuJianLivePublishMarkup(data) {
    const expanded = Boolean(state.wuJian.livePublishExpanded);
    const rows = wuJianLivePublishRows(data);
    const activeCount = rows.filter((row) => row.publishLabel !== "已发布").length;
    const primary = rows.find((row) => row.id === state.wuJian.livePublishAccountId) || rows[0];
    if (primary && state.wuJian.livePublishAccountId !== primary.id) state.wuJian.livePublishAccountId = primary.id;
    const queued = primary?.publishLabel === "排队中";
    const accountsMarkup = expanded ? `<div class="ai-live-publish-accounts"><div class="ai-live-publish-accounts-head"><div><span>多账号同步发布</span><strong>${rows.length} 个账号正在执行 · 点击账号切换实时状态</strong></div><button type="button" class="is-quiet" data-wujian-live-section="data">进入内容数据 <span aria-hidden="true">→</span></button></div><div class="ai-live-publish-account-grid">${rows.map((row) => `<button type="button" class="ai-live-publish-account-card${row.publishLabel === "已发布" ? " is-done" : ""}${row.id === primary.id ? " is-selected" : ""}" data-wujian-live-publish-account="${escapeHtml(row.id)}" aria-pressed="${row.id === primary.id ? "true" : "false"}" title="${row.publishLabel === "排队中" ? "任务排队中，请稍后查看" : "点击查看实时发布快照"}"><header><div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.group)} · ${escapeHtml(row.city)}</small></div>${wuJianMatrixPill(row.publishLabel)}</header><div class="ai-live-publish-account-progress"><div><span>${escapeHtml(row.publishLabel)}</span><b>${row.progress}%</b></div><i><b style="width:${row.progress}%"></b></i></div><footer><span>${escapeHtml(row.eta)}</span><small>${row.publishLabel === "排队中" ? "任务排队中，请稍后查看" : "点击查看实时发布快照"}</small></footer></button>`).join("")}</div></div>` : "";
    return `<section class="ai-live-publish-section${expanded ? " is-expanded" : ""}">
        <header class="ai-live-publish-head">
          <div class="ai-live-publish-title"><span>实时工作</span><strong>创作中心发布</strong><small>多个抖音账号正在同时发布这条视频，进度会实时同步。</small></div>
          <div class="ai-live-publish-head-actions"><span class="ai-live-publish-status"><i></i>发布中 ${activeCount} 个账号</span><button type="button" class="ai-live-publish-expand" data-wujian-live-publish-expand aria-expanded="${expanded ? "true" : "false"}">${expanded ? "收起账号" : "展开多账号发布"}<b aria-hidden="true">${expanded ? "⌃" : "⌄"}</b></button></div>
        </header>
        ${accountsMarkup}
        <div class="ai-live-publish-main">
          <div class="ai-live-publish-summary"><div class="ai-live-publish-summary-head"><span>当前发布任务</span><strong>《星途 E7 后排空间实测》</strong><small>竖版 30 秒 · 人工审核后发布</small></div><div class="ai-live-publish-summary-account"><span class="ai-live-publish-account-avatar">${escapeHtml(primary.city?.slice(0, 1) || primary.name.slice(0, 1) || "鸿")}</span><div><strong>${escapeHtml(primary.name)}</strong><small>${escapeHtml(primary.group)} · ${escapeHtml(primary.city)} · ${escapeHtml(primary.publishLabel)}</small></div><b>${primary.progress}%</b></div><div class="ai-live-publish-progress"><i><b style="width:${primary.progress}%"></b></i><span>${queued ? "任务排队中 · 请稍后查看" : `已完成 ${primary.progress}% · ${escapeHtml(primary.eta)}`}</span></div><button type="button" class="ai-live-publish-summary-action" data-wujian-live-publish-expand aria-expanded="${expanded ? "true" : "false"}">${expanded ? "收起账号列表" : `展开 ${rows.length} 个账号`}<b aria-hidden="true">${expanded ? "⌃" : "⌄"}</b></button></div>
          <div class="ai-live-publish-video-wrap">
            <div class="ai-live-publish-video-frame${queued ? " is-queued" : ""}"><video autoplay muted loop playsinline preload="metadata" aria-label="${escapeHtml(primary.name)}创作中心发布实时工作录屏"><source src="${WUJIAN_LIVE_VIDEO_PATH}" type="video/mp4"><source src="assets/wujian/creative-center-publish.mov" type="video/quicktime"></video><div class="ai-live-publish-video-shade"></div><div class="ai-live-publish-video-overlay"><span><i></i>${queued ? "任务排队中 · 请稍后查看" : `实时发布快照 · ${escapeHtml(primary.name)} · ${escapeHtml(primary.publishLabel)}`}</span>${queued ? "" : `<b>${primary.progress}%</b>`}</div>${queued ? `<div class="ai-live-publish-queue-notice"><strong>任务排队中</strong><span>请稍后查看</span></div>` : ""}</div>
            <div class="ai-live-publish-video-meta"><div><strong>创作中心发布</strong><small>视频录屏 · 55 秒</small></div><span>刚刚更新</span></div>
          </div>
        </div>
      </section>`;
  }
  function wuJianMatrixOverviewPage() {
    const matrix = wuJianMatrixAccountRows();
    const data = matrixData();
    return `<div class="wujian-page wujian-matrix-page ai-matrix-overview">
      ${wuJianMatrixKpiMarkup([["计入账号", matrix.accounts.length || 100, "按账号按日计费"], ["本周发布数", matrix.weekPublished || 224, "已发布内容"], ["待人工处理", data.pendingCount || 24, "需要你确认"]])}
      ${wuJianLivePublishMarkup(data)}
    </div>`;
  }
  function wuJianMatrixAccountsPage() {
    const data = matrixData();
    const filter = state.wuJian.matrixGroupFilter || "all";
    const rows = data.accounts.filter((row) => filter === "all" || row.group === filter);
    const currentTarget = rows.reduce((sum, row) => sum + row.weeklyTarget, 0);
    const currentPublished = rows.reduce((sum, row) => sum + row.publishedThisWeek, 0);
    const currentRate = currentTarget ? Math.round((currentPublished / currentTarget) * 100) : 0;
    return `<div class="wujian-page wujian-matrix-page">
      ${wuJianMatrixKpiMarkup([["账号总数", data.accounts.length, filter === "all" ? "全部账号组" : filter], ["本周计划", currentTarget, "每周每账号 2-7 条"], ["本周已发布", currentPublished, `完成率 ${currentRate}%`], ["待人工处理", data.pendingCount, "需要你确认"]])}
      <section class="ai-matrix-section">
        <header class="ai-matrix-section-head"><div><span>账号矩阵</span><strong>发布进度</strong><small>展示全部 ${data.accounts.length} 个账号，按账号组筛选查看推进情况。</small></div><div class="ai-matrix-group-filter">${[["all", "全部", data.accounts.length], ...data.groups.map((group) => [group, group, data.accounts.filter((row) => row.group === group).length])].map(([key, label, count]) => `<button type="button" class="${filter === key ? "is-active" : ""}" data-wujian-matrix-group-filter="${escapeHtml(key)}">${escapeHtml(label)} <em>${count}</em></button>`).join("")}</div></header>
        <div class="ai-matrix-table">${wuJianMatrixAccountsTable(rows)}</div>
      </section>
    </div>`;
  }
  function wuJianMatrixAccountsTable(rows) {
    return `<table><thead><tr><th>账号</th><th>账号组</th><th>城市</th><th>本周计划</th><th>已发布</th><th>完成率</th><th>状态</th></tr></thead><tbody>${rows.map((row) => {
      const rate = row.weeklyTarget ? Math.round((row.publishedThisWeek / row.weeklyTarget) * 100) : 0;
      return `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.id)}</small></td><td>${escapeHtml(row.group)}</td><td>${escapeHtml(row.city)}</td><td>${row.weeklyTarget} 条</td><td>${row.publishedThisWeek} 条</td><td><span class="ai-matrix-rate"><i><b style="width:${rate}%"></b></i><em>${rate}%</em></span></td><td>${wuJianMatrixPill(row.status)}</td></tr>`;
    }).join("")}</tbody></table>`;
  }
  function wuJianMatrixTasksPage() {
    const data = matrixData();
    const tasks = wuJianPublishTaskRows(data);
    const reviewCount = tasks.filter((row) => row.status === "待审核").length;
    const publishedCount = tasks.filter((row) => row.status === "已发布").length;
    const failedCount = tasks.filter((row) => row.status === "发布失败").length;
    return `<div class="wujian-page wujian-matrix-page ai-publish-task-list-page">
      ${wuJianMatrixKpiMarkup([["本周发布任务", tasks.length, "按排期统一推进"], ["待审核", reviewCount, "需要你确认"], ["已发布", publishedCount, "已进入效果回收"], ["发布失败", failedCount, "需要重新生成"]])}
      <section class="ai-matrix-section">
        <header class="ai-matrix-section-head ai-publish-task-list-head"><div><span>发布任务</span><strong>作品 × 账号的发布状态</strong><small>素材库、二创素材和 AI 创作统一在这里确认发布条件并追踪状态。</small></div><div class="ai-publish-task-head-actions"><button type="button" class="is-quiet" data-wujian-publish-task-history>历史任务对话</button><button type="button" class="is-primary" data-wujian-publish-task-new>＋ 创建发布任务</button></div></header>
        <div class="ai-matrix-table">${wuJianMatrixTasksTable(tasks)}</div>
      </section>
    </div>`;
  }
  function wuJianMatrixTasksTable(rows) {
    const sourceLabels = { "用户上传": "素材库", "指定账号二创": "二创素材", "AI 脚本创作": "AI 创作" };
    return `<table><thead><tr><th>内容</th><th>发布账号</th><th>来源</th><th>排期时间</th><th>发布方式</th><th>状态</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.title)}</strong></td><td>${escapeHtml(row.account)}</td><td><span class="ai-matrix-source">${escapeHtml(sourceLabels[row.source] || row.source)}</span></td><td>${escapeHtml(row.time)}</td><td><span class="ai-matrix-mode is-${row.publishMode === "人工审核" ? "warning" : "ok"}">${escapeHtml(row.publishMode)}</span></td><td>${wuJianMatrixPill(row.status)}</td></tr>`).join("")}</tbody></table>`;
  }
  function wuJianPublishTaskRows(data) {
    const created = Array.isArray(state.wuJian.publishTasks) ? state.wuJian.publishTasks : [];
    return [...created, ...wuJianBatchTasks, ...(data.tasks || [])];
  }
  function wuJianPublishTaskAccounts() {
    return (matrixData().accounts || []).map((account) => ({ ...account }));
  }
  function wuJianPublishTaskSourceItems(source) {
    if (source === "remix") return wuJianWorksPool.filter((work) => work.status !== "已排期").slice(0, 8).map((work) => ({ id: work.id, title: work.title, meta: `${wuJianMonitorAccountName(work.account)} · ${work.plays} 播放`, cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30", source: "二创素材" }));
    const libraryItems = [
      { id: "library-e7-space", title: "E7 后排空间实测_待发布.mp4", meta: "客户上传 · 1080 × 1920 · 00:30", cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30", source: "素材库" },
      { id: "library-t9-family", title: "风云 T9 家庭口播_待发布.mp4", meta: "客户上传 · 1080 × 1920 · 00:32", cover: "assets/vehicles/fengyun-t9-120-2025.jpg", duration: "00:32", source: "素材库" },
      { id: "library-showroom", title: "上海门店展厅走拍_待发布.mp4", meta: "客户上传 · 竖版视频 · 00:18", cover: "assets/live/ai-lead-live.jpg", duration: "00:18", source: "素材库", video: "assets/wujian/cases/car-case-03.mp4" },
    ].map((item, index) => ({ ...item, video: item.video || ["assets/wujian/cases/car-case-01.mp4", "assets/wujian/cases/car-case-02.mp4", "assets/wujian/cases/car-case-03.mp4"][index % 3] }));
    const uploaded = state.wuJian.publishTaskUploadItem;
    return uploaded?.id ? [uploaded, ...libraryItems.filter((item) => item.id !== uploaded.id)] : libraryItems;
  }
  function wuJianPublishTaskUpload(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const accepted = [];
    const rejected = [];
    list.forEach((file) => {
      const check = wuJianVideoFileCheck(file);
      if (check.ok) accepted.push(file); else rejected.push(`${file.name || "该视频"}：${check.copy}`);
    });
    if (rejected.length && typeof showToast === "function") showToast(accepted.length ? "部分视频未通过校验" : "上传失败", rejected.join("；"));
    const file = accepted[0];
    if (!file) return;
    const video = typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";
    if (video) wuJianUploadedBlobUrls.add(video);
    const id = `library-upload-${Date.now()}`;
    state.wuJian.publishTaskUploadItem = {
      id,
      title: file.name || "客户上传视频.mp4",
      meta: `客户上传 · ${wuJianFileSize(file.size)} · 待发布视频`,
      cover: "assets/vehicles/e7-flagship-2025.jpg",
      duration: "待识别",
      source: "素材库",
      video,
    };
    state.wuJian.publishTaskUploaded = true;
    state.wuJian.publishTaskWorkIds = [id];
    persistWuJian();
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast("校验通过，已加入作品库", `${file.name || "客户上传视频"} 符合抖音发布格式与大小限制，已放入待发布作品`);
  }
  function wuJianPublishTaskAgentMessage() {
    const step = Number(state.wuJian.publishTaskStep) || 1;
    const source = state.wuJian.publishTaskSource;
    if (step === 1) return "你好，我来帮你创建发布任务。先选这次要发布到哪些抖音账号，之后我会根据素材类型自动带出对应的发布条件。";
    if (step === 2) return "账号范围已记下。接下来选素材来源：客户上传的待发布视频、已经抓取的二创作品，或完全由 AI 生成。";
    if (step === 3) return source === "library" ? "素材库视频不需要人工审核。你只要告诉我立即发布还是定时发布，我就能生成任务。" : source === "remix" ? "二创作品会先经过大模型改编。你可以选择人工审核后发布，也可以直接自动发布。" : "AI 会先批量生成脚本给你确认，确认后再进入视频生成，生成完成我再帮你创建发布任务。";
    return "条件都确认好了。请检查右侧任务摘要，点击“生成发布任务”后，我会按账号拆分任务并回写到发布列表。";
  }
  function wuJianPublishTaskAccountsMarkup() {
    const accounts = wuJianPublishTaskAccounts();
    const selected = new Set(state.wuJian.publishTaskAccountIds || []);
    const allChecked = accounts.length > 0 && accounts.every((row) => selected.has(row.id));
    return `<div class="ai-publish-task-account-picker"><div class="ai-publish-task-filter-row"><button type="button" class="is-quiet" data-wujian-publish-account-all>${allChecked ? "取消全选" : "全选账号"}</button></div><div class="ai-publish-task-account-summary"><strong>已选 ${selected.size} 个账号</strong><span>全部账号 · 点击下方账号可微调范围</span></div><div class="ai-publish-task-account-grid">${accounts.slice(0, 12).map((row) => `<label class="ai-publish-task-account-option"><input type="checkbox" data-wujian-publish-account-id="${escapeHtml(row.id)}" ${selected.has(row.id) ? "checked" : ""}><span><strong>${escapeHtml(row.name)}</strong></span><i></i></label>`).join("")}</div>${accounts.length > 12 ? `<small class="ai-publish-task-muted">共 ${accounts.length} 个账号，已展示前 12 个，可直接全选账号。</small>` : ""}<footer class="ai-publish-chat-attachment-actions"><button type="button" class="is-primary" data-wujian-publish-task-step-next>确认账号范围</button></footer></div>`;
  }
  function wuJianPublishTaskSourceMarkup() {
    const source = state.wuJian.publishTaskSource || "library";
    const selected = new Set(state.wuJian.publishTaskWorkIds || []);
    const tabs = [["library", "素材库", "待发布视频"], ["remix", "二创素材", "二创作品列表"], ["ai", "AI 创作", "一句话生成脚本"]];
    const items = source === "ai" ? [] : wuJianPublishTaskSourceItems(source);
    let content = "";
    if (source === "ai") {
      content = `<div class="ai-publish-task-ai-box"><label><span>告诉我你想做什么</span><textarea data-wujian-publish-script placeholder="例如：为星途 E7 做一条 30 秒视频，突出后排空间，语气真实一些。">${escapeHtml(state.wuJian.publishTaskScript || "")}</textarea></label><div class="ai-publish-task-ai-actions"><button type="button" class="is-primary" data-wujian-publish-script-generate>生成脚本方案</button>${state.wuJian.publishTaskScriptsReady ? `<span class="ai-publish-task-ready">已生成 3 个脚本方案</span>` : ""}</div>${state.wuJian.publishTaskScriptsReady ? `<div class="ai-publish-task-script-list">${["前 3 秒实测结论：E7 后排到底能不能坐三个人？", "把后排空间装进行李箱：家庭出行真实体验", "同级对比实测，E7 后排空间到底赢在哪？"].map((title, index) => `<article><i>${index + 1}</i><div><strong>${title}</strong><small>30 秒 · 真人测评 · 已通过车型事实校验</small></div><button type="button" class="${state.wuJian.publishTaskScriptsConfirmed ? "is-confirmed" : ""}" data-wujian-publish-script-confirm>${state.wuJian.publishTaskScriptsConfirmed ? "已确认" : "确认方案"}</button></article>`).join("")}</div>` : ""}${state.wuJian.publishTaskScriptsConfirmed ? `<div class="ai-publish-task-video-ready"><strong>脚本已确认，可以进入视频 AI 生成</strong><button type="button" class="is-primary" data-wujian-publish-video-generate>${state.wuJian.publishTaskGenerated ? "生成完成" : "进入视频生成"}</button></div>${state.wuJian.publishTaskGenerated ? `<div class="ai-publish-task-video-result"><img src="assets/vehicles/e7-flagship-2025.jpg" alt="AI 生成视频封面"><div><strong>星途 E7 后排空间实测_AI 成片.mp4</strong><small>00:30 · 竖版 9:16 · 已生成，可进入发布条件确认</small></div></div>` : ""}` : ""}</div>`;
    } else {
      const library = source === "library";
      const selectedCount = selected.size;
      const remixStatus = source === "remix" && selectedCount ? `<div class="ai-publish-task-remix-status"><div><strong>已选 ${selectedCount} 个二创作品</strong><small>先让大模型完成改编，生成可发布版本后再进入发布条件。</small></div><button type="button" class="is-primary" data-wujian-publish-remix-generate>${state.wuJian.publishTaskRemixGenerated ? "二创已完成" : "开始大模型二创"}</button>${state.wuJian.publishTaskRemixGenerated ? `<span class="ai-publish-task-ready">已生成 ${selectedCount} 个可发布版本</span>` : ""}</div>` : "";
      content = `<div class="ai-publish-task-library-head"><div><strong>${library ? "待发布视频" : "二创作品列表"}</strong><small>${library ? "客户上传后会出现在这里，素材库视频不需要人工审核。" : "从已监控抖音账号抓取的作品中选择，先经过大模型编辑再发布。"}</small></div>${library ? `<input type="file" data-wujian-publish-upload-input accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" hidden><button type="button" class="is-quiet" data-wujian-publish-upload>＋ 上传待发布视频</button>` : `<button type="button" class="is-quiet" data-wujian-publish-remix-manage>管理二创素材</button>`}</div><div class="ai-publish-task-source-list">${items.map((item) => `<label class="ai-publish-task-source-item"><input type="checkbox" data-wujian-publish-work-id="${escapeHtml(item.id)}" ${selected.has(item.id) ? "checked" : ""}><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></span><em>${escapeHtml(item.duration)}</em>${library ? (wuJianWorkDownloadUrl(item) ? `<a class="ai-publish-task-source-download" href="${escapeHtml(wuJianWorkDownloadUrl(item))}" download="${escapeHtml(wuJianWorkDownloadName(item))}" data-wujian-work-download-link>下载 <span aria-hidden="true">↓</span></a>` : `<button type="button" class="ai-publish-task-source-download" data-wujian-work-download-missing="${escapeHtml(item.id)}">下载 <span aria-hidden="true">↓</span></button>`) : ""}</label>`).join("")}</div>${state.wuJian.publishTaskUploaded && library ? `<small class="ai-publish-task-uploaded">刚上传的视频已加入待发布视频列表</small>` : ""}${remixStatus}</div>`;
    }
    return `<div class="ai-publish-task-source-picker"><div class="ai-publish-task-source-tabs">${tabs.map(([key, label, desc]) => `<button type="button" class="${source === key ? "is-active" : ""}" data-wujian-publish-source="${key}"><strong>${label}</strong><small>${desc}</small></button>`).join("")}</div>${content}</div>`;
  }
  function wuJianPublishTaskSettingsMarkup() {
    const source = state.wuJian.publishTaskSource || "library";
    const library = source === "library";
    const timing = state.wuJian.publishTaskTiming || "now";
    const review = library ? "auto" : (state.wuJian.publishTaskReview || "review");
    return `<div class="ai-publish-task-settings"><div class="ai-publish-task-setting-block"><span>发布时间</span><div class="ai-publish-task-choice-row"><button type="button" class="${timing === "now" ? "is-active" : ""}" data-wujian-publish-task-timing="now"><strong>立即发布</strong><small>条件确认后马上执行</small></button><button type="button" class="${timing === "scheduled" ? "is-active" : ""}" data-wujian-publish-task-timing="scheduled"><strong>定时发布</strong><small>按设定时间执行</small></button></div>${timing === "scheduled" ? `<label class="ai-publish-task-date"><span>选择发布时间</span><input type="datetime-local" data-wujian-publish-task-schedule value="${escapeHtml(state.wuJian.publishTaskScheduleAt || "2026-08-25T18:30")}"></label>` : ""}</div><div class="ai-publish-task-setting-block"><span>人工审核</span>${library ? `<div class="ai-publish-task-note"><i>✓</i><div><strong>素材库视频无需人工审核</strong><small>上传成片会直接按发布条件执行。</small></div></div>` : `<div class="ai-publish-task-choice-row"><button type="button" class="${review === "review" ? "is-active" : ""}" data-wujian-publish-review="review"><strong>需要人工</strong><small>审核通过后进入发布</small></button><button type="button" class="${review === "auto" ? "is-active" : ""}" data-wujian-publish-review="auto"><strong>自动发布</strong><small>直接执行发布任务</small></button></div>`}</div></div>`;
  }
  function wuJianPublishTaskSummaryMarkup() {
    const accounts = wuJianPublishTaskAccounts().filter((row) => (state.wuJian.publishTaskAccountIds || []).includes(row.id));
    const sourceLabels = { library: "素材库 · 待发布视频", remix: "二创素材 · 二创作品列表", ai: "AI 创作 · 视频生成" };
    const source = state.wuJian.publishTaskSource || "library";
    const timing = state.wuJian.publishTaskTiming === "scheduled" ? `定时 ${String(state.wuJian.publishTaskScheduleAt || "").replace("T", " ")}` : "立即发布";
    return `<aside class="ai-publish-task-summary"><header><span>任务摘要</span><strong>确认后按账号拆分发布</strong></header><dl><div><dt>账号范围</dt><dd>${accounts.length ? `已选 ${accounts.length} 个账号` : "尚未选择"}</dd></div><div><dt>素材来源</dt><dd>${sourceLabels[source]}</dd></div><div><dt>发布时间</dt><dd>${timing}</dd></div><div><dt>审核方式</dt><dd>${source === "library" ? "素材库无需审核" : state.wuJian.publishTaskReview === "auto" ? "自动发布" : "人工审核"}</dd></div></dl><footer>${state.wuJian.publishTaskStep >= 4 ? `<button type="button" class="is-primary" data-wujian-publish-task-submit>生成发布任务 <span aria-hidden="true">→</span></button>` : `<small>按左侧 Agent 引导逐步确认条件</small>`}</footer></aside>`;
  }
  function wuJianPublishTaskChatMarkup() {
    const step = Number(state.wuJian.publishTaskStep) || 1;
    const source = state.wuJian.publishTaskSource || "library";
    const accounts = wuJianPublishTaskAccounts().filter((row) => (state.wuJian.publishTaskAccountIds || []).includes(row.id));
    const accountText = accounts.length ? `我先选择了 ${accounts.length} 个抖音账号${accounts.length <= 3 ? `：${accounts.map((row) => row.name).join("、")}` : "。"}` : "";
    const sourceText = source === "library" ? "素材库里的待发布视频" : source === "remix" ? "二创作品列表里的作品" : "AI 创作视频";
    const timing = state.wuJian.publishTaskTiming === "scheduled" ? `定时发布（${String(state.wuJian.publishTaskScheduleAt || "").replace("T", " ")}）` : "立即发布";
    const review = source === "library" ? "素材库无需人工审核" : state.wuJian.publishTaskReview === "auto" ? "自动发布" : "需要人工审核";
    const result = state.wuJian.publishTaskResult;
    const customMessages = (state.wuJian.publishTaskMessages || []).map((message) => `<article class="ai-publish-chat-message is-user"><p>${escapeHtml(message.text)}</p></article>`).join("");
    const messages = [`<article class="ai-publish-chat-message is-agent"><div class="ai-publish-chat-author"><i>阿</i><strong>阿影 · 短视频运营专员</strong><small>刚刚</small></div><p>你好，我来帮你创建发布任务。你直接告诉我想发到哪些抖音账号，我会继续帮你把素材和发布条件确认好。</p></article>`];
    if (step >= 2 && accountText) messages.push(`<article class="ai-publish-chat-message is-user"><p>${escapeHtml(accountText)}</p></article><article class="ai-publish-chat-message is-agent"><p>收到，我记下了这 ${accounts.length} 个账号。接下来，你想用哪类素材发布？</p></article>`);
    if (step === 1) {
      messages.push(`<article class="ai-publish-chat-attachment"><div class="ai-publish-chat-attachment-head"><span>账号范围</span><strong>先选这次要发布到哪些抖音账号</strong><small>可以直接选账号组，我会自动带入该组的账号。</small></div>${wuJianPublishTaskAccountsMarkup()}</article>`);
    } else if (step === 2) {
      messages.push(`<article class="ai-publish-chat-attachment"><div class="ai-publish-chat-attachment-head"><span>素材来源</span><strong>你希望这次视频从哪里来？</strong><small>选好后我会继续处理素材，不需要一次填写所有条件。</small></div>${wuJianPublishTaskSourceMarkup()}<footer class="ai-publish-chat-attachment-actions"><button type="button" class="is-primary" data-wujian-publish-task-step-next>确认这个素材，继续</button></footer></article>`);
    } else {
      messages.push(`<article class="ai-publish-chat-message is-user"><p>我选择${sourceText}。</p></article>`);
      if (result && step >= 5) {
        const resultTitle = result.title || "本次发布内容";
        messages.push(`<article class="ai-publish-chat-message is-user"><p>我确认${timing}，${review}。</p></article><article class="ai-publish-chat-message is-agent ai-publish-chat-result"><div class="ai-publish-chat-author"><i>阿</i><strong>阿影 · 短视频运营专员</strong><small>刚刚</small></div><p>发布任务已经创建好了。我已按账号拆分生成 ${result.accountCount} 个发布任务，接下来可以在发布内容列表查看每个账号的执行状态。</p><div class="ai-publish-chat-result-summary"><span>发布内容</span><strong>${escapeHtml(resultTitle)}</strong><small>${escapeHtml(result.sourceLabel || sourceText)} · ${escapeHtml(result.time || timing)}</small></div><button type="button" class="ai-publish-chat-result-link" data-wujian-publish-task-result-list>查看发布内容列表 <span aria-hidden="true">→</span></button></article>`);
      } else if (step === 3) {
        messages.push(`<article class="ai-publish-chat-message is-agent"><p>${wuJianPublishTaskAgentMessage()}</p></article><article class="ai-publish-chat-attachment"><div class="ai-publish-chat-attachment-head"><span>发布条件</span><strong>最后确认一下，什么时候发、是否需要人工看一遍？</strong><small>素材库视频不需要人工审核；二创和 AI 视频可以选择人工审核或自动发布。</small></div>${wuJianPublishTaskSettingsMarkup()}<footer class="ai-publish-chat-attachment-actions"><button type="button" class="is-primary" data-wujian-publish-task-step-next>确认发布条件</button></footer></article>`);
      } else {
        messages.push(`<article class="ai-publish-chat-message is-user"><p>我确认${timing}，${review}。</p></article><article class="ai-publish-chat-message is-agent"><p>条件都确认好了。我会按账号拆分发布任务，生成后你可以在发布列表里逐个查看状态。</p></article><article class="ai-publish-chat-attachment ai-publish-chat-final"><div class="ai-publish-chat-attachment-head"><span>任务确认</span><strong>现在生成这次发布任务吗？</strong><small>将生成 ${accounts.length || 0} 个账号任务，并记录完整对话。</small></div>${wuJianPublishTaskSummaryMarkup()}</article>`);
      }
    }
    return `${messages[0]}${customMessages}${messages.slice(1).join("")}`;
  }
  function wuJianPublishTaskAgentPage() {
    const step = Number(state.wuJian.publishTaskStep) || 1;
    const composerPlaceholder = step === 2 && state.wuJian.publishTaskSource === "ai" ? "也可以直接输入一句话脚本，例如：突出后排空间，做一条 30 秒视频" : "直接告诉我你的要求，或点击上方的选项继续";
    return `<div class="wujian-page wujian-matrix-page ai-publish-chat-page"><header class="ai-publish-chat-head"><div class="ai-publish-chat-head-main"><button type="button" class="ai-publish-task-back" data-wujian-publish-task-back>← 返回发布任务</button><strong>创建发布任务</strong></div><button type="button" class="is-quiet" data-wujian-publish-task-history>历史任务对话</button></header><section class="ai-publish-chat-panel"><div class="ai-publish-chat-meta"><span><i></i>短视频运营专员</span><small>阿影正在帮你整理发布任务</small></div><div class="ai-publish-chat-log">${wuJianPublishTaskChatMarkup()}</div><footer class="ai-publish-chat-composer"><button type="button" class="ai-publish-chat-plus" aria-label="添加素材" title="添加素材">＋</button><textarea data-wujian-publish-chat-input rows="1" placeholder="${escapeHtml(composerPlaceholder)}"></textarea><button type="button" class="ai-publish-chat-send" data-wujian-publish-chat-send aria-label="发送" title="发送">↑</button></footer></section></div>`;
  }
  function wuJianPublishTaskHistoryPage() {
    const history = Array.isArray(state.wuJian.publishTaskHistory) ? state.wuJian.publishTaskHistory : [];
    const selected = history.find((item) => item.id === state.wuJian.publishTaskHistoryId);
    return `<div class="wujian-page wujian-matrix-page ai-publish-task-history"><header class="ai-publish-task-history-head"><div><button type="button" class="ai-publish-task-back" data-wujian-publish-task-back>← 返回发布任务</button><span>历史任务对话</span><strong>每次确认过的发布条件都保留在这里</strong></div></header><div class="ai-publish-task-history-layout"><div class="ai-publish-task-history-list">${history.length ? history.map((item) => `<button type="button" class="${selected?.id === item.id ? "is-active" : ""}" data-wujian-publish-history-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.createdAt)} · ${escapeHtml(item.sourceLabel)}</small><em>${item.accountCount} 个账号</em></button>`).join("") : `<div class="ai-publish-task-empty">还没有历史发布任务对话</div>`}</div><section class="ai-publish-task-history-detail">${selected ? `<header><span>${escapeHtml(selected.createdAt)}</span><strong>${escapeHtml(selected.title)}</strong><small>${escapeHtml(selected.sourceLabel)} · ${selected.accountCount} 个账号</small></header><div>${(selected.messages || []).map((message) => `<article class="ai-publish-task-bubble ${message.role === "user" ? "is-user" : "is-agent"}"><p>${escapeHtml(message.text)}</p></article>`).join("")}</div>` : `<div class="ai-publish-task-empty">选择左侧任务，查看当时与 Agent 确认的完整过程</div>`}</section></div></div>`;
  }
  function wuJianPublishTaskPage() {
    const view = state.wuJian.publishTaskView || "list";
    return view === "agent" ? wuJianPublishTaskAgentPage() : view === "history" ? wuJianPublishTaskHistoryPage() : wuJianMatrixTasksPage();
  }
  function wuJianResetPublishTask() {
    state.wuJian.publishTaskView = "agent";
    state.wuJian.publishTaskStep = 1;
    state.wuJian.publishTaskSource = "library";
    state.wuJian.publishTaskAccountIds = [];
    state.wuJian.publishTaskWorkIds = [];
    state.wuJian.publishTaskScript = "";
    state.wuJian.publishTaskScriptsReady = false;
    state.wuJian.publishTaskScriptsConfirmed = false;
    state.wuJian.publishTaskGenerated = false;
    state.wuJian.publishTaskUploaded = false;
    state.wuJian.publishTaskUploadItem = null;
    state.wuJian.publishTaskRemixGenerated = false;
    state.wuJian.publishTaskTiming = "now";
    state.wuJian.publishTaskReview = "review";
    state.wuJian.publishTaskMessages = [];
    state.wuJian.publishTaskHistoryId = "";
    state.wuJian.publishTaskResult = null;
  }
  function wuJianPublishTaskSelectedSourceTitle() {
    const source = state.wuJian.publishTaskSource || "library";
    if (source === "ai") return "AI 批量生成视频";
    const firstId = (state.wuJian.publishTaskWorkIds || [])[0];
    const item = wuJianPublishTaskSourceItems(source).find((row) => row.id === firstId);
    return item?.title || (source === "remix" ? "二创作品" : "待发布视频");
  }
  function wuJianPublishTaskSubmit() {
    const accountIds = Array.from(new Set(state.wuJian.publishTaskAccountIds || []));
    const source = state.wuJian.publishTaskSource || "library";
    const sourceLabel = source === "library" ? "素材库" : source === "remix" ? "二创素材" : "AI 创作";
    if (!accountIds.length) { if (typeof showToast === "function") showToast("还差一步", "请先选择至少一个抖音账号"); return; }
    if (source !== "ai" && !(state.wuJian.publishTaskWorkIds || []).length) { if (typeof showToast === "function") showToast("还差一步", "请先选择要发布的素材"); return; }
    if (source === "ai" && !state.wuJian.publishTaskGenerated) { if (typeof showToast === "function") showToast("视频还在准备", "请先确认脚本并完成视频 AI 生成"); return; }
    if (source === "remix" && !state.wuJian.publishTaskRemixGenerated) { if (typeof showToast === "function") showToast("二创还在准备", "请先完成大模型二创，再确认发布条件"); return; }
    const accounts = wuJianPublishTaskAccounts().filter((row) => accountIds.includes(row.id));
    const title = wuJianPublishTaskSelectedSourceTitle();
    const publishMode = source === "library" ? "自动" : state.wuJian.publishTaskReview === "auto" ? "自动" : "人工审核";
    const status = publishMode === "人工审核" ? "待审核" : state.wuJian.publishTaskTiming === "now" ? "正在发布" : "已排期";
    const time = state.wuJian.publishTaskTiming === "scheduled" ? String(state.wuJian.publishTaskScheduleAt || "").replace("T", " ") : "立即执行";
    const createdAt = nowDateTime();
    const taskId = `pt-${Date.now()}`;
    const rows = accounts.map((account, index) => ({ id: `${taskId}-${index}`, title, account: account.name, accountId: account.id, source: sourceLabel, time, publishMode, status }));
    state.wuJian.publishTasks = [...rows, ...(Array.isArray(state.wuJian.publishTasks) ? state.wuJian.publishTasks : [])].slice(0, 300);
    const history = Array.isArray(state.wuJian.publishTaskHistory) ? state.wuJian.publishTaskHistory : [];
    history.unshift({ id: taskId, title, sourceLabel, accountCount: accounts.length, createdAt, messages: [{ role: "agent", text: "我来帮你创建发布任务，先确认账号范围。" }, { role: "user", text: `已选择 ${accounts.length} 个抖音账号。` }, { role: "agent", text: `素材来源：${sourceLabel}；发布时间：${time}；发布方式：${publishMode}。` }, { role: "user", text: "确认生成发布任务。" }, { role: "agent", text: `发布任务已经创建好了。我已按账号拆分生成 ${accounts.length} 个发布任务，可以在发布内容列表查看状态。` }] });
    state.wuJian.publishTaskHistory = history.slice(0, 20);
    state.wuJian.publishTaskResult = { taskId, title, sourceLabel, accountCount: accounts.length, time };
    state.wuJian.publishTaskView = "agent";
    state.wuJian.publishTaskStep = 5;
    state.wuJian.section = "tasks";
    persistWuJian();
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast("发布任务已生成", `已按 ${accounts.length} 个账号拆分任务`);
  }
  function wuJianMatrixEffectsPage() {
    const data = matrixData();
    const openId = state.wuJian.matrixEffectId || "";
    return `<div class="wujian-page wujian-matrix-page">
      ${wuJianMatrixKpiMarkup([["累计播放", wuJianMatrixCount(data.statTotals.plays), "本周已发布内容"], ["互动总数", wuJianMatrixCount(data.statTotals.interactions), "赞、评、藏、转"], ["线索", data.statTotals.leads, "可继续跟进"], ["接入账号", data.accounts.length, "按账号按日计费"]])}
      <section class="ai-matrix-section">
        <header class="ai-matrix-section-head"><div><span>内容效果</span><strong>每条内容的播放、互动与线索</strong><small>点击内容查看详情与账号表现。</small></div></header>
        <div class="ai-matrix-table">${wuJianMatrixEffectsTable(data.effects, openId)}</div>
      </section>
    </div>`;
  }
  function wuJianMatrixEffectsTable(rows, openId) {
    return `<table><thead><tr><th>内容</th><th>发布账号</th><th>播放</th><th>互动</th><th>线索</th><th>操作</th></tr></thead><tbody>${rows.map((row) => {
      const open = row.id === openId;
      return `<tr class="${open ? "is-open" : ""}"><td><strong>${escapeHtml(row.title)}</strong></td><td>${escapeHtml(row.account)}</td><td>${wuJianMatrixCount(row.plays)}</td><td>${wuJianMatrixCount(row.interactions)}</td><td>${row.leads}</td><td><button type="button" class="is-quiet" data-wujian-matrix-effect="${escapeHtml(row.id)}">${open ? "收起" : "查看详情"}</button></td></tr>${open ? `<tr class="ai-matrix-effect-detail"><td colspan="6"><div><strong>${escapeHtml(row.title)}</strong><p>发布账号：${escapeHtml(row.account)} · 本周回收播放 ${wuJianMatrixCount(row.plays)} 次、互动 ${wuJianMatrixCount(row.interactions)} 次、线索 ${row.leads} 条。</p><span class="ai-matrix-detail-row">${[["播放", wuJianMatrixCount(row.plays)], ["互动", wuJianMatrixCount(row.interactions)], ["线索", row.leads]].map(([label, value]) => `<i><b>${escapeHtml(value)}</b><em>${escapeHtml(label)}</em></i>`).join("")}</span></div></td></tr>` : ""}`;
    }).join("")}</tbody></table>`;
  }

  function wuJianMatrixTimeLabel(range) {
    return ({ week: "本周", last: "上周", month: "本月", all: "全部" })[range] || "本周";
  }
  function wuJianMatrixRangeOptions() {
    const active = state.wuJian.matrixTimeRange || "week";
    return [["week", "本周"], ["last", "上周"], ["month", "本月"], ["all", "全部"]].map(([key, label]) => `<button type="button" class="${active === key ? "is-active" : ""}" data-wujian-matrix-time-range="${key}" aria-pressed="${active === key ? "true" : "false"}">${label}</button>`).join("");
  }
  function wuJianMatrixDataTabMarkup() {
    const active = state.wuJian.matrixDataTab || "accounts";
    return `<div class="ai-matrix-data-tabs" role="tablist" aria-label="内容数据维度"><button type="button" class="${active === "accounts" ? "is-active" : ""}" data-wujian-matrix-data-tab="accounts" role="tab" aria-selected="${active === "accounts" ? "true" : "false"}">按账号</button><button type="button" class="${active === "works" ? "is-active" : ""}" data-wujian-matrix-data-tab="works" role="tab" aria-selected="${active === "works" ? "true" : "false"}">按作品</button></div>`;
  }
  function wuJianMatrixWorkRows(data, range) {
    const rangeKey = range || "week";
    const rangeAllowed = (publishRange) => rangeKey === "all" || rangeKey === publishRange || (rangeKey === "month" && ["week", "last", "month"].includes(publishRange));
    const covers = wuJianTemplates.filter((item) => item.cover).map((item) => ({ cover: item.cover, duration: item.duration }));
    return (data.effects || []).map((row, index) => {
      const publishRange = ["week", "week", "last", "month", "week", "all", "last", "week"][index % 8];
      if (!rangeAllowed(publishRange)) return null;
      const interactions = Number(row.interactions) || 0;
      const likes = Math.round(interactions * (0.56 + (index % 3) * 0.03));
      const comments = Math.max(1, Math.round(interactions * 0.16));
      const favorites = Math.max(1, Math.round(interactions * 0.19));
      const shares = Math.max(1, interactions - likes - comments - favorites);
      const visual = covers[index % covers.length] || { cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30" };
      const account = (data.accounts || []).find((item) => item.name === row.account);
      return { ...row, accountId: account?.id || `effect-account-${index}`, cover: visual.cover, duration: visual.duration, likes, comments, favorites, shares, publishRange };
    }).filter(Boolean);
  }
  function wuJianMatrixAccountDataRows(data, range) {
    const rangeKey = range || "week";
    const factor = rangeKey === "last" ? 1 : rangeKey === "month" ? 4 : rangeKey === "all" ? 12 : 1;
    return (data.accounts || []).map((row, index) => {
      const expected = Math.max(0, Math.round(row.weeklyTarget * factor));
      const published = Math.min(expected, rangeKey === "week" ? row.publishedThisWeek : Math.max(0, Math.round(row.publishedThisWeek * factor + (rangeKey === "all" ? index % 4 : index % 2))));
      const failed = Math.min(Math.max(0, expected - published), (index * 7 + (rangeKey === "week" ? 1 : 2)) % 3 === 0 ? 1 + (index % 2) : 0);
      return { ...row, expected, published, unpublished: Math.max(0, expected - published - failed), failed };
    });
  }
  function wuJianMatrixFallbackWorks(data, account, range) {
    const accountIndex = Math.max(0, (data.accounts || []).findIndex((row) => row.id === account.id));
    const titles = ["门店实拍：这台车适合哪类家庭", "试驾实测：城市通勤的三个细节", "配置对比：买车前先看这项", "空间体验：后排到底够不够用"];
    const covers = wuJianTemplates.filter((item) => item.cover).map((item) => ({ cover: item.cover, duration: item.duration }));
    const base = 6200 + accountIndex * 337;
    return [0, 1].map((offset) => {
      const interactions = 180 + accountIndex * 11 + offset * 47;
      const likes = Math.round(interactions * .58);
      const comments = Math.max(1, Math.round(interactions * .16));
      const favorites = Math.max(1, Math.round(interactions * .18));
      const shares = Math.max(1, interactions - likes - comments - favorites);
      const visual = covers[(accountIndex + offset) % covers.length] || { cover: "assets/vehicles/e7-flagship-2025.jpg", duration: "00:30" };
      return { id: `mock-${account.id}-${offset}`, title: titles[(accountIndex + offset) % titles.length], account: account.name, accountId: account.id, cover: visual.cover, duration: visual.duration, plays: base + offset * 1800, likes, comments, favorites, shares, publishRange: range === "all" ? "all" : "week" };
    });
  }
  function wuJianMatrixWorksForAccount(data, accountId, range) {
    const account = (data.accounts || []).find((row) => row.id === accountId);
    if (!account) return [];
    const rows = wuJianMatrixWorkRows(data, range).filter((row) => row.accountId === accountId);
    return rows.length ? rows : wuJianMatrixFallbackWorks(data, account, range);
  }
  function wuJianMatrixWorksTable(rows, includeFavorites) {
    const headers = includeFavorites ? "<th>作品封面</th><th>作品标题</th><th>作品时长</th><th>发布账号</th><th>播放数</th><th>点赞数</th><th>评论数</th><th>收藏数</th><th>分享数</th>" : "<th>作品封面</th><th>作品标题</th><th>作品时长</th><th>发布账号</th><th>播放数</th><th>点赞数</th><th>评论数</th><th>分享数</th>";
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td><img class="ai-matrix-work-cover" src="${escapeHtml(row.cover)}" alt="${escapeHtml(row.title)}"></td><td><strong>${escapeHtml(row.title)}</strong></td><td>${escapeHtml(row.duration)}</td><td>${escapeHtml(row.account)}</td><td>${wuJianMatrixCount(row.plays)}</td><td>${wuJianMatrixCount(row.likes)}</td><td>${wuJianMatrixCount(row.comments)}</td>${includeFavorites ? `<td>${wuJianMatrixCount(row.favorites)}</td>` : ""}<td>${wuJianMatrixCount(row.shares)}</td></tr>`).join("") : `<tr><td colspan="${includeFavorites ? 9 : 8}" class="ai-matrix-empty-cell">暂无符合时间范围的已发布作品</td></tr>`}</tbody></table>`;
  }
  function wuJianMatrixAccountDataTable(rows) {
    return `<table><thead><tr><th>账号名</th><th>预计发布数</th><th>已发布数</th><th>未发布数</th><th>发布失败数</th><th>操作</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.group)} · ${escapeHtml(row.city)}</small></td><td>${row.expected}</td><td>${row.published}</td><td>${row.unpublished}</td><td>${row.failed ? `<span class="ai-matrix-number is-danger">${row.failed}</span>` : "0"}</td><td><button type="button" class="is-quiet ai-matrix-data-action" data-wujian-matrix-account="${escapeHtml(row.id)}">查看已发布作品数据 <span aria-hidden="true">→</span></button></td></tr>`).join("")}</tbody></table>`;
  }
  function wuJianMatrixDataPage() {
    const data = matrixData();
    const range = state.wuJian.matrixTimeRange || "week";
    const selectedId = state.wuJian.matrixAccountId || "";
    const selected = (data.accounts || []).find((row) => row.id === selectedId);
    const tab = state.wuJian.matrixDataTab || "accounts";
    const accountRows = wuJianMatrixAccountDataRows(data, range);
    const workRows = selected ? wuJianMatrixWorksForAccount(data, selected.id, range) : wuJianMatrixWorkRows(data, range);
    const detail = selected ? `<button type="button" class="ai-matrix-data-back" data-wujian-matrix-account-back>← 返回按账号</button><div class="ai-matrix-data-detail-title"><div><span>账号作品列表</span><strong>${escapeHtml(selected.name)}</strong><small>${wuJianMatrixTimeLabel(range)} · 已发布作品互动数据</small></div><em>${workRows.length} 条作品</em></div>` : "";
    const body = selected ? wuJianMatrixWorksTable(workRows, true) : tab === "accounts" ? wuJianMatrixAccountDataTable(accountRows) : wuJianMatrixWorksTable(workRows, false);
    return `<div class="wujian-page wujian-matrix-page ai-matrix-data-page">
      ${wuJianMatrixKpiMarkup([["计入账号", data.accounts.length || 100, "按账号按日计费"], ["本周发布数", data.weekPublished || 224, "已发布内容"], ["待人工处理", data.pendingCount || 24, "需要你确认"]])}
      <section class="ai-matrix-section ai-matrix-data-section">
        <header class="ai-matrix-section-head ai-matrix-data-head"><div><span>内容数据</span><strong>${selected ? "已发布作品数据" : "按账号与作品查看发布效果"}</strong><small>${selected ? "查看该账号作品发布后的播放、点赞、评论、收藏与分享数据。" : "按照发布时间筛选发布计划、发布结果和作品互动效果。"}</small></div><div class="ai-matrix-data-toolbar"><div class="ai-matrix-time-filter" aria-label="按发布时间筛选"><span>按发布时间</span>${wuJianMatrixRangeOptions()}</div>${!selected ? wuJianMatrixDataTabMarkup() : ""}</div></header>
        <div class="ai-matrix-data-body">${detail}<div class="ai-matrix-table ai-matrix-data-table">${body}</div></div>
      </section>
    </div>`;
  }
  function wuJianMatrixCreatePage() {
    const matrix = matrixData();
    return `<div class="wujian-page wujian-matrix-page">
      <section class="ai-matrix-create-entry">
        <header class="ai-matrix-section-head"><div><span>内容创作</span><strong>本周内容从哪里来</strong><small>本周已发布 ${matrix.weekPublished}/${matrix.weekTarget} 条，新增内容会进入统一审核与排期。</small></div></header>
        <div class="ai-matrix-source-grid">
          ${[["upload", "用户上传", "上传你已有的成片或素材，由专员统一审核后按排期发布。", "↑"],
             ["recreate", "指定账号二创", "输入要监控的抖音号，作品更新后落入作品池，再做单条或批量二创。", "↻"],
             ["script", "AI 脚本创作", "用车型素材自动生成脚本与成片，完成后进入审核排期。", "✦"]].map(([key, label, desc, icon]) => `
            <button type="button" class="ai-matrix-source-card" data-wujian-matrix-source="${key}">
              <i aria-hidden="true">${icon}</i><strong>${label}</strong><small>${desc}</small><span>开始 <b aria-hidden="true">→</b></span>
            </button>`).join("")}
        </div>
      </section>
    </div>`;
  }

  function wuJianLibraryCover(index, fallback) {
    const covers = [
      "assets/vehicles/e7-flagship-2025.jpg",
      "assets/vehicles/fengyun-t9-120-2025.jpg",
      "assets/vehicles/yaoguang-4wd-2024.jpg",
      "assets/wujian/cases/car-case-01.jpg",
      "assets/wujian/cases/car-case-02.jpg",
      "assets/wujian/cases/car-case-03.jpg",
    ];
    return fallback || covers[index % covers.length];
  }

  function wuJianLibraryPendingItems() {
    const uploaded = wuJianPublishTaskSourceItems("library").map((item, index) => ({
      ...item,
      cover: item.cover || wuJianLibraryCover(index),
      sourceLabel: "客户上传",
      statusLabel: "待发布",
      statusTone: "pending",
    }));
    const deleted = new Set(state.wuJian.libraryReviewDeleted || []);
    const approvedReview = new Set(state.wuJian.libraryReviewApproved || []);
    const approvedReviewItems = wuJianWorks.filter((work) => approvedReview.has(work.id) && !deleted.has(work.id)).map((work, index) => ({
      ...work,
      source: "素材库",
      sourceLabel: "审核通过",
      statusLabel: "待发布",
      statusTone: "approved",
      meta: `${work.account || "鸿途汽车官方旗舰店"} · 审核通过 · 待发布`,
      video: work.video || ["assets/wujian/cases/car-case-01.mp4", "assets/wujian/cases/car-case-02.mp4", "assets/wujian/cases/car-case-03.mp4"][index % 3],
    }));
    const approvedRemix = wuJianWorksPool.filter((work) => work.status === "已二创").map((work, index) => ({
      id: `approved-${work.id}`,
      workId: work.id,
      title: `${work.title}_二创成片.mp4`,
      meta: `${wuJianMonitorAccountName(work.account)} · 审核通过 · ${work.duration || "00:30"}`,
      cover: wuJianLibraryCover(index + uploaded.length),
      duration: work.duration || "00:30",
      source: "二创素材",
      sourceLabel: "二创审核通过",
      statusLabel: "待发布",
      statusTone: "approved",
      video: ["assets/wujian/cases/car-case-01.mp4", "assets/wujian/cases/car-case-02.mp4", "assets/wujian/cases/car-case-03.mp4"][index % 3],
    }));
    return [...uploaded, ...approvedReviewItems, ...approvedRemix];
  }

  function wuJianLibraryReviewItems() {
    const deleted = new Set(state.wuJian.libraryReviewDeleted || []);
    const approved = new Set(state.wuJian.libraryReviewApproved || []);
    return wuJianWorks.filter((work) => wuJianWorkStatus(work) === "review" && !deleted.has(work.id) && !approved.has(work.id)).map((work, index) => ({
      ...work,
      sourceLabel: "待审核作品",
      statusLabel: "待审核",
      statusTone: "pending",
      meta: `${work.account || "鸿途汽车官方旗舰店"} · ${work.time || "刚刚生成"}`,
      video: work.video || ["assets/wujian/cases/car-case-01.mp4", "assets/wujian/cases/car-case-02.mp4", "assets/wujian/cases/car-case-03.mp4"][index % 3],
    }));
  }

  function wuJianLibraryPoolItems() {
    return wuJianWorksPool.map((work, index) => ({
      ...work,
      cover: wuJianLibraryCover(index, work.cover),
      duration: work.duration || ["00:30", "00:45", "00:28", "00:35"][index % 4],
      favorites: work.favorites || ["2,180", "1,460", "3,820", "968"][index % 4],
      video: work.video || ["assets/wujian/cases/car-case-01.mp4", "assets/wujian/cases/car-case-02.mp4", "assets/wujian/cases/car-case-03.mp4"][index % 3],
      statusLabel: work.status === "未处理" ? "" : work.status,
      statusTone: work.status === "已排期" ? "approved" : "pending",
    }));
  }

  function wuJianLibraryPublishedItems() {
    return wuJianWorks.filter((work) => work.status === "success").map((work, index) => ({
      ...work,
      video: work.video || ["assets/wujian/cases/car-case-01.mp4", "assets/wujian/cases/car-case-02.mp4", "assets/wujian/cases/car-case-03.mp4"][index % 3],
      cover: work.cover || wuJianLibraryCover(index),
    }));
  }

  function wuJianLibraryReviewPage() {
    const items = wuJianLibraryReviewItems();
    return `<section class="ai-works-library-panel"><header class="ai-works-library-panel__head"><div><span>待审核作品</span><strong>确认后进入待发布</strong><small>审核通过后作品会进入待发布作品；需要调整时可带入 AI 创作继续优化。</small></div><span class="ai-works-library-count">${items.length} 条作品</span></header><div class="ai-works-library-grid ai-works-library-review-grid">${items.length ? items.map((item, index) => wuJianLibraryWorkCard(item, "review", index)).join("") : `<div class="ai-works-library-empty">暂无待审核作品</div>`}</div></section>`;
  }

  function wuJianApproveLibraryReview(workId) {
    const item = wuJianWorks.find((work) => work.id === workId);
    if (!item || wuJianWorkStatus(item) !== "review") return;
    const approved = new Set(state.wuJian.libraryReviewApproved || []);
    approved.add(workId);
    state.wuJian.libraryReviewApproved = Array.from(approved);
    state.wuJian.libraryReviewDeleted = (state.wuJian.libraryReviewDeleted || []).filter((id) => id !== workId);
    state.wuJian.libraryTab = "pending";
    persistWuJian();
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast("审核通过", `《${item.title}》已进入待发布作品`);
  }

  function wuJianOptimizeLibraryReview(workId) {
    const item = wuJianWorks.find((work) => work.id === workId);
    if (!item || wuJianWorkStatus(item) !== "review") return;
    const prompt = `请基于《${item.title}》进行 AI 二创优化：保留核心卖点，优化前 3 秒钩子、字幕和镜头节奏，生成一版可发布的视频。`;
    state.wuJian.recreateWork = { id: item.id, title: item.title, account: item.account || "鸿途汽车官方旗舰店" };
    state.wuJian.prompt = prompt;
    state.wuJian.matrixSource = "script";
    state.wuJian.publishTaskView = "agent";
    state.wuJian.publishTaskSource = "ai";
    state.wuJian.publishTaskStep = 2;
    state.wuJian.publishTaskScript = prompt;
    state.wuJian.publishTaskWorkIds = [item.id];
    state.wuJian.publishTaskMessages = [];
    state.wuJian.publishTaskRemixGenerated = false;
    state.wuJian.section = "tasks";
    persistWuJian();
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast("已带入 AI 创作", `《${item.title}》已进入二创对话`);
  }

  function wuJianDeleteLibraryReview(workId) {
    const item = wuJianWorks.find((work) => work.id === workId);
    if (!item) return;
    const deleted = new Set(state.wuJian.libraryReviewDeleted || []);
    deleted.add(workId);
    state.wuJian.libraryReviewDeleted = Array.from(deleted);
    state.wuJian.libraryReviewApproved = (state.wuJian.libraryReviewApproved || []).filter((id) => id !== workId);
    persistWuJian();
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast("已删除作品", `《${item.title}》已从待审核列表移除`);
  }

  function wuJianLibraryWorkCard(item, kind, index) {
    const pending = kind === "pending";
    const pool = kind === "pool";
    const published = kind === "published";
    const review = kind === "review";
    const selected = pool && (state.wuJian.worksPoolSelected || []).includes(item.id);
    const selectable = pool && item.status === "未处理";
    const action = review
      ? `<div class="ai-works-library-review-actions"><button type="button" class="is-primary" data-wujian-library-review-approve="${escapeHtml(item.id)}">审核通过</button><button type="button" data-wujian-library-review-optimize="${escapeHtml(item.id)}">优化视频</button><button type="button" class="is-danger" data-wujian-library-review-delete="${escapeHtml(item.id)}">删除</button></div>`
      : pending
      ? `<div class="ai-works-library-card__actions">${wuJianWorkDownloadUrl(item) ? `<a class="ai-works-library-card__action" href="${escapeHtml(wuJianWorkDownloadUrl(item))}" download="${escapeHtml(wuJianWorkDownloadName(item))}">下载视频 <span aria-hidden="true">↓</span></a>` : `<button type="button" class="ai-works-library-card__action" data-wujian-work-download-missing="${escapeHtml(item.id)}">下载视频 <span aria-hidden="true">↓</span></button>`}<button type="button" class="ai-works-library-card__action is-primary" data-wujian-library-publish="${escapeHtml(item.id)}" data-wujian-library-source="${escapeHtml(item.source === "二创素材" ? "remix" : "library")}">去创建发布任务 <span aria-hidden="true">→</span></button></div>`
      : pool
        ? `<button type="button" class="ai-works-library-card__action is-primary" data-wujian-works-recreate="${escapeHtml(item.id)}">开始二创 <span aria-hidden="true">→</span></button>`
        : `<a class="ai-works-library-card__action" href="${escapeHtml(item.video)}" download="${escapeHtml(wuJianWorkDownloadName({ ...item, title: item.title || "已发布作品" }))}">下载视频 <span aria-hidden="true">↓</span></a>`;
    const poolSelect = pool ? `<label class="ai-works-library-card__select${selectable ? "" : " is-disabled"}"><input type="checkbox" data-wujian-works-select="${escapeHtml(item.id)}" ${selected ? "checked" : ""} ${selectable ? "" : "disabled"} aria-label="选择${escapeHtml(item.title)}"><i></i><span>${selected ? "已选" : "选择"}</span></label>` : "";
    return `<article class="ai-works-library-card ai-works-library-card--${kind}${selected ? " is-selected" : ""}">
      <div class="ai-works-library-card__cover"><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy"><span>${escapeHtml(item.duration || "00:30")}</span>${published ? `<i>已发布</i>` : ""}${poolSelect}</div>
      <div class="ai-works-library-card__body"><div class="ai-works-library-card__eyebrow"><span>${escapeHtml(item.sourceLabel || (review ? "待审核作品" : pool ? "抖音作品" : "已发布作品"))}</span>${item.statusLabel ? `<em class="is-${escapeHtml(item.statusTone || "pending")}">${escapeHtml(item.statusLabel)}</em>` : ""}</div><h3>${escapeHtml(item.title)}</h3>
      ${pending || review ? `<p class="ai-works-library-card__meta">${escapeHtml(item.meta || "基础信息已就绪")}</p>` : ""}
      ${pool ? `<dl class="ai-works-library-card__stats"><div><dt>点赞</dt><dd>${escapeHtml(item.likes || "—")}</dd></div><div><dt>评论</dt><dd>${escapeHtml(item.comments || "—")}</dd></div><div><dt>收藏</dt><dd>${escapeHtml(item.favorites || "—")}</dd></div></dl><div class="ai-works-library-card__details"><span>获取时间 <b>${escapeHtml(item.grabbedAt || "今天")}</b></span><span>获取账号 <b>${escapeHtml(wuJianMonitorAccountName(item.account))}</b></span></div><div class="ai-works-library-card__material"><span>短视频素材</span><a href="${escapeHtml(item.video)}" target="_blank" rel="noreferrer">预览素材</a></div>` : ""}
      ${published ? `<dl class="ai-works-library-card__stats"><div><dt>播放</dt><dd>${escapeHtml(item.views || "—")}</dd></div><div><dt>点赞</dt><dd>${escapeHtml(item.likes || "—")}</dd></div><div><dt>评论</dt><dd>${escapeHtml(item.comments || "—")}</dd></div><div><dt>分享</dt><dd>${escapeHtml(item.shares || "—")}</dd></div></dl><div class="ai-works-library-card__details"><span>发布账号 <b>${escapeHtml(item.account || "鸿途汽车官方旗舰店")}</b></span><span>发布时间 <b>${escapeHtml(item.time || "本周")}</b></span></div>` : ""}
      <footer>${action}</footer></div></article>`;
  }

  function wuJianLibraryPendingPage() {
    const items = wuJianLibraryPendingItems();
    return `<section class="ai-works-library-panel"><header class="ai-works-library-panel__head"><div><span>待发布作品</span><strong>客户上传与审核通过的作品</strong><small>素材库视频和二创审核通过的成片都会在这里等待发布。</small></div><div class="ai-works-library-head-actions"><input type="file" data-wujian-library-upload-input accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" hidden><button type="button" class="is-primary" data-wujian-library-upload>＋ 上传待发布视频</button></div></header><div class="ai-works-library-grid">${items.map((item, index) => wuJianLibraryWorkCard(item, "pending", index)).join("")}</div></section>`;
  }

  function wuJianLibraryPoolPage() {
    const poolView = state.wuJian.libraryPoolView === "monitor" ? "monitor" : "works";
    if (poolView === "monitor") return wuJianLibraryMonitorPage();
    const items = wuJianLibraryPoolItems();
    const available = items.filter((item) => item.status === "未处理");
    const selected = (state.wuJian.worksPoolSelected || []).filter((id) => available.some((item) => item.id === id));
    const allSelected = available.length > 0 && available.every((item) => selected.includes(item.id));
    const batchOpen = Boolean(state.wuJian.worksBatchOpen) && selected.length > 0;
    return `<section class="ai-works-library-panel"><header class="ai-works-library-panel__head"><div><span>二创作品池</span><strong>监控账号抓取的抖音作品</strong><small>勾选多条作品后批量进入大模型二创，生成审核通过的待发布视频。</small></div><div class="ai-works-library-head-actions"><span class="ai-works-library-count">${items.length} 条素材</span><span class="ai-works-library-selection-count">${selected.length ? `已选 ${selected.length} 条` : "可批量选择"}</span><button type="button" data-wujian-works-select-all>${allSelected ? "取消全选" : "全选待处理"}</button><button type="button" class="${selected.length ? "is-primary" : ""}" data-wujian-works-batch>批量二创</button><button type="button" data-wujian-sync-run-all>同步全部账号</button></div></header>${wuJianLibraryPoolSubTabs(poolView)}${batchOpen ? wuJianBatchPanel(selected) : ""}<div class="ai-works-library-grid">${items.map((item, index) => wuJianLibraryWorkCard(item, "pool", index)).join("")}</div></section>`;
  }

  function wuJianLibraryPoolSubTabs(view) {
    return `<nav class="ai-works-library-pool-tabs" role="tablist" aria-label="二创作品池分类"><button type="button" class="${view === "works" ? "is-active" : ""}" data-wujian-library-pool-view="works" role="tab" aria-selected="${view === "works" ? "true" : "false"}">二创作品池</button><button type="button" class="${view === "monitor" ? "is-active" : ""}" data-wujian-library-pool-view="monitor" role="tab" aria-selected="${view === "monitor" ? "true" : "false"}">监控抖音账号</button></nav>`;
  }

  function wuJianLibraryMonitorPage() {
    const addOpen = Boolean(state.wuJian.monitorAddOpen);
    const rows = wuJianMonitorAccounts;
    return `<section class="ai-works-library-panel"><header class="ai-works-library-panel__head"><div><span>监控抖音账号</span><strong>周期性获取可二创素材</strong><small>添加要监控的抖音号，系统会按每日周期抓取最新作品并放入二创作品池。</small></div><div class="ai-works-library-head-actions"><span class="ai-works-library-count">${rows.length} 个账号</span><button type="button" class="is-primary" data-wujian-monitor-add>＋ 添加抖音账号</button></div></header>${wuJianLibraryPoolSubTabs("monitor")}
      ${addOpen ? `<form class="ai-works-library-add-form" data-wujian-monitor-add-form><label><span>账号名称</span><input name="name" placeholder="例如：鸿途汽车官方" required></label><label><span>抖音号</span><input name="handle" placeholder="例如：hongtu_official" required></label><label><span>分组</span><select name="group">${wuJianMonitorGroups.map((group) => `<option>${escapeHtml(group)}</option>`).join("")}</select></label><footer><button type="button" class="is-primary" data-wujian-monitor-add-submit>开始监控</button><button type="button" data-wujian-monitor-add-cancel>取消</button></footer></form>` : ""}
      <div class="ai-works-library-monitor-table-wrap"><table class="ai-works-library-monitor-table"><thead><tr><th>抖音账号名称</th><th>抖音账号</th><th>已获取作品数</th><th>最近同步时间</th><th>每日自动获取</th><th>操作</th></tr></thead><tbody>${rows.length ? rows.map((account) => `<tr><td><strong>${escapeHtml(account.name)}</strong></td><td><span class="ai-works-library-monitor-handle">@${escapeHtml(account.handle)}</span></td><td><strong class="ai-works-library-monitor-number">${escapeHtml(account.works)} 条</strong></td><td>${escapeHtml(account.lastSync)}</td><td><button type="button" class="ai-works-library-switch${account.autoSync ? " is-on" : ""}" data-wujian-monitor-auto="${escapeHtml(account.id)}" aria-label="${account.autoSync ? "关闭" : "开启"} ${escapeHtml(account.name)} 每日自动获取" aria-pressed="${account.autoSync ? "true" : "false"}"><i></i></button><span class="ai-works-library-auto-label">${account.autoSync ? "开启" : "关闭"}</span></td><td><div class="ai-works-library-monitor-actions"><button type="button" data-wujian-monitor-sync="${escapeHtml(account.id)}">手动同步</button><button type="button" class="is-danger" data-wujian-monitor-delete="${escapeHtml(account.id)}">删除</button></div></td></tr>`).join("") : `<tr><td colspan="6" class="ai-works-library-monitor-empty">暂无监控账号，点击右上角添加抖音账号。</td></tr>`}</tbody></table></div></section>`;
  }

  function wuJianLibraryPublishedPage() {
    const items = wuJianLibraryPublishedItems();
    return `<section class="ai-works-library-panel"><header class="ai-works-library-panel__head"><div><span>已发布作品</span><strong>发布完成后持续回收效果</strong><small>查看已发布作品的互动数据，也可以下载视频素材。</small></div><span class="ai-works-library-count">${items.length} 条作品</span></header><div class="ai-works-library-grid">${items.map((item, index) => wuJianLibraryWorkCard(item, "published", index)).join("")}</div></section>`;
  }

  function wuJianWorksLibraryPage() {
    const tab = ["pending", "pool", "published", "review"].includes(state.wuJian.libraryTab) ? state.wuJian.libraryTab : "pending";
    state.wuJian.libraryTab = tab;
    const tabs = [["pending", "待发布作品"], ["pool", "二创作品池"], ["published", "已发布作品"], ["review", "待审核作品"]];
    const content = tab === "pending" ? wuJianLibraryPendingPage() : tab === "pool" ? wuJianLibraryPoolPage() : tab === "published" ? wuJianLibraryPublishedPage() : wuJianLibraryReviewPage();
    return `<div class="wujian-page wujian-matrix-page ai-works-library"><header class="ai-works-library-title"><span class="ai-works-library-summary">${wuJianLibraryPendingItems().length} 待发布 · ${wuJianWorksPool.length} 条二创素材 · ${wuJianLibraryReviewItems().length} 条待审核</span></header><nav class="ai-works-library-tabs" role="tablist" aria-label="作品库分类">${tabs.map(([key, label]) => `<button type="button" class="${tab === key ? "is-active" : ""}" data-wujian-library-tab="${key}" role="tab" aria-selected="${tab === key ? "true" : "false"}">${escapeHtml(label)}</button>`).join("")}</nav>${content}</div>`;
  }

  /* ================= V1.3 短视频运营专员 · 矩阵搬运发布 ================= */
  const V13_COVERS = [
    "assets/vehicles/e7-flagship-2025.jpg",
    "assets/vehicles/fengyun-t9-120-2025.jpg",
    "assets/vehicles/yaoguang-4wd-2024.jpg",
    "assets/wujian/cases/car-case-01.jpg",
    "assets/wujian/cases/car-case-02.jpg",
    "assets/wujian/cases/car-case-03.jpg",
    "assets/vehicles/lingyun-300t-2025.jpg",
  ];
  const V13_VIDEOS = [
    "assets/wujian/cases/car-case-01.mp4",
    "assets/wujian/cases/car-case-02.mp4",
    "assets/wujian/cases/car-case-03.mp4",
  ];
  const V13_ACCOUNTS = [
    { id: "acc-001", name: "鸿途汽车·上海旗舰店", group: "旗舰店", city: "上海", enabled: true, status: "正在发布", progress: 82, time: "预计 08:42 完成", pending: 5, published: 46 },
    { id: "acc-002", name: "鸿途汽车·上海城市店", group: "城市店", city: "上海", enabled: true, status: "排队中", progress: 18, time: "预计 09:10 发布", pending: 8, published: 38 },
    { id: "acc-003", name: "鸿途汽车·杭州城东店", group: "城市店", city: "杭州", enabled: true, status: "已发布", progress: 100, time: "08:35 已发布", publishedAt: "2026-08-27T08:35:00+08:00", pending: 3, published: 52 },
    { id: "acc-004", name: "鸿途汽车·深圳体验中心", group: "专营店", city: "深圳", enabled: true, status: "已发布", progress: 100, time: "08:12 已发布", publishedAt: "2026-08-26T08:12:00+08:00", pending: 4, published: 41 },
    { id: "acc-005", name: "鸿途汽车·北京旗舰店", group: "旗舰店", city: "北京", enabled: true, status: "正在发布", progress: 61, time: "预计 08:56 完成", pending: 6, published: 60 },
    { id: "acc-006", name: "鸿途汽车·成都城西店", group: "城市店", city: "成都", enabled: true, status: "排队中", progress: 8, time: "预计 09:24 发布", pending: 7, published: 33 },
    { id: "acc-007", name: "鸿途汽车·宁波服务店", group: "专营店", city: "宁波", enabled: true, status: "已发布", progress: 100, time: "07:50 已发布", publishedAt: "2026-08-27T07:50:00+08:00", pending: 2, published: 29 },
    { id: "acc-008", name: "鸿途汽车·武汉光谷店", group: "城市店", city: "武汉", enabled: true, status: "发布异常", progress: 0, time: "营销未授权", pending: 4, published: 35, failureType: "marketing", error: "抖音营销授权已过期，请完成授权后继续发布" },
    { id: "acc-009", name: "鸿途汽车·重庆旗舰店", group: "旗舰店", city: "重庆", enabled: true, status: "已发布", progress: 100, time: "08:20 已发布", publishedAt: "2026-08-26T08:20:00+08:00", pending: 5, published: 44 },
    { id: "acc-010", name: "鸿途汽车·合肥包河店", group: "城市店", city: "合肥", enabled: true, status: "排队中", progress: 35, time: "预计 09:05 发布", pending: 6, published: 27 },
    { id: "acc-011", name: "鸿途汽车·苏州新区店", group: "城市店", city: "苏州", enabled: true, status: "已发布", progress: 100, time: "08:05 已发布", publishedAt: "2026-08-26T08:05:00+08:00", pending: 4, published: 39 },
    { id: "acc-012", name: "鸿途汽车·西安雁塔店", group: "城市店", city: "西安", enabled: true, status: "正在发布", progress: 47, time: "预计 08:51 完成", pending: 5, published: 31 },
    { id: "acc-013", name: "鸿途汽车·南京栖霞店", group: "城市店", city: "南京", enabled: true, status: "已发布", progress: 100, time: "08:28 已发布", publishedAt: "2026-08-27T08:28:00+08:00", pending: 3, published: 36 },
    { id: "acc-014", name: "鸿途汽车·长沙芙蓉店", group: "城市店", city: "长沙", enabled: true, status: "发布异常", progress: 0, time: "发布失败", pending: 2, published: 24, failureType: "rpa", error: "发布失败，请点击重新发布" },
  ];
  const V13_MONITORS = [
    { id: "ma-001", name: "鸿途汽车官方", handle: "hongtu_official", auto: true, lastSync: "今天 09:00", works: 12 },
    { id: "ma-002", name: "鸿途汽车旗舰店", handle: "hongtu_flagship", auto: true, lastSync: "今天 09:00", works: 8 },
    { id: "ma-003", name: "星途 E7 测评号", handle: "xingtu_e7_ceping", auto: true, lastSync: "今天 09:00", works: 15 },
    { id: "ma-004", name: "电车严选", handle: "dianche_yanxuan", auto: false, lastSync: "昨天 18:00", works: 9 },
    { id: "ma-005", name: "家装车对比研究所", handle: "jiazheng_duibi", auto: false, lastSync: "08-11 18:00", works: 3, paused: true },
    { id: "ma-006", name: "星途凌云日常", handle: "xingtu_lingyun_vlog", auto: true, lastSync: "今天 09:00", works: 6 },
  ];
  function v13Monitors() {
    const custom = Array.isArray(v13State().monitors) ? v13State().monitors : [];
    return [...V13_MONITORS, ...custom];
  }
  function v13MonitorById(id) {
    return v13Monitors().find((monitor) => monitor.id === id);
  }
  function v13UpdateMonitor(id, patch) {
    const custom = Array.isArray(v13State().monitors) ? [...v13State().monitors] : [];
    const customIndex = custom.findIndex((monitor) => monitor.id === id);
    if (customIndex >= 0) {
      custom[customIndex] = { ...custom[customIndex], ...patch };
      v13Patch({ monitors: custom });
      return custom[customIndex];
    }
    const seeded = V13_MONITORS.find((monitor) => monitor.id === id);
    if (!seeded) return null;
    Object.assign(seeded, patch);
    persistWuJian();
    return seeded;
  }
  function v13DeleteMonitor(id) {
    const custom = Array.isArray(v13State().monitors) ? [...v13State().monitors] : [];
    const customIndex = custom.findIndex((monitor) => monitor.id === id);
    if (customIndex >= 0) {
      custom.splice(customIndex, 1);
      v13Patch({ monitors: custom });
      return true;
    }
    const seededIndex = V13_MONITORS.findIndex((monitor) => monitor.id === id);
    if (seededIndex < 0) return false;
    V13_MONITORS.splice(seededIndex, 1);
    persistWuJian();
    return true;
  }

  /* 抖音作品库（演示数据）：同一条作品可能被多个账号发布，用于体现"不同账号相同作品不去重" */
  const V13_MONITOR_GRAB_SIZE = 15;
  const V13_DOUYIN_WORK_POOL = [
    { key: "DY7400000001", title: "门店实拍：这台车适合哪类家庭", duration: "00:31" },
    { key: "DY7400000002", title: "试驾实测：城市通勤的三个细节", duration: "00:44" },
    { key: "DY7400000003", title: "配置对比：买车前先看这项", duration: "00:27" },
    { key: "DY7400000004", title: "空间体验：后排到底够不够用", duration: "00:38" },
    { key: "DY7400000005", title: "提车日记：从下订到交车用了几天", duration: "00:52" },
    { key: "DY7400000006", title: "冬季续航实测：高速与市区差多少", duration: "01:05" },
    { key: "DY7400000007", title: "自动泊车挑战窄车位", duration: "00:29" },
    { key: "DY7400000008", title: "一次看懂增程与纯电怎么选", duration: "00:47" },
    { key: "DY7400000009", title: "保养到底要花多少钱", duration: "00:41" },
    { key: "DY7400000010", title: "后排安装儿童座椅实测", duration: "00:33" },
    { key: "DY7400000011", title: "车主真实油耗记录", duration: "00:36" },
    { key: "DY7400000012", title: "城市通勤一周电费账单", duration: "00:25" },
    { key: "DY7400000013", title: "试驾必看的三个细节", duration: "00:39" },
    { key: "DY7400000014", title: "这台车的隔音到底怎么样", duration: "00:42" },
    { key: "DY7400000015", title: "高速服务区充电体验", duration: "00:30" },
    { key: "DY7400000016", title: "新车首保都做了什么", duration: "00:34" },
    { key: "DY7400000017", title: "语音助手实测：连续指令会不会崩", duration: "00:46" },
    { key: "DY7400000018", title: "后备箱到底能装多少行李", duration: "00:28" },
    { key: "DY7400000019", title: "夜间灯光表现实测", duration: "00:32" },
    { key: "DY7400000020", title: "老车主换车为什么还选它", duration: "00:50" },
  ];

  /* 添加监控账号：抖音号格式本地即时校验，有效性校验模拟服务端请求（带加载状态） */
  const V13_MONITOR_VALIDATE_MS = 1400;
  const V13_MONITOR_HANDLE_PATTERN = /^[A-Za-z0-9._-]{2,24}$/;
  const V13_MONITOR_VALIDATE_MOCK = {
    notfound_demo: "未找到该抖音号，请核对后重新输入",
    banned_demo: "该抖音号状态异常（已被封禁或停用），暂不支持监控",
  };
  function v13MonitorHandleFormatError(handle) {
    if (!V13_MONITOR_HANDLE_PATTERN.test(handle)) return "抖音号仅支持字母、数字、下划线、点和短横线，长度 2–24 位";
    return "";
  }
  function v13MonitorValidateMock(handle) {
    return V13_MONITOR_VALIDATE_MOCK[String(handle).toLowerCase()] || "";
  }
  /* 该账号已获取到的作品ID：演示前的历史作品（按"已获取作品数"折算）+ 本次演示已抓取的作品 */
  function v13MonitorKnownKeys(monitor, monitorIndex) {
    const history = Math.min(Number(monitor.works || 0), V13_MONITOR_GRAB_SIZE);
    const baseline = v13GrabWindow(monitorIndex, 0).slice(0, history).map((item) => item.key);
    return baseline.concat(v13GrabbedWorks(monitor.id).map((work) => work.workKey));
  }
  /* 抓取窗口：首次抓取最近 15 条；每次同步窗口前移 1 条，模拟该账号新发布 1 条作品 */
  function v13GrabWindow(monitorIndex, offset) {
    const pool = V13_DOUYIN_WORK_POOL;
    const size = Math.min(V13_MONITOR_GRAB_SIZE, pool.length);
    const start = ((Number(monitorIndex) || 0) * 5 + Number(offset || 0)) % pool.length;
    return Array.from({ length: size }, (_, i) => pool[(start + i) % pool.length]);
  }
  function v13GrabbedWorks(monitorId) {
    const store = v13State().monitorGrabs || {};
    return Array.isArray(store[monitorId]) ? store[monitorId] : [];
  }
  function v13AllGrabbedWorks() {
    const store = v13State().monitorGrabs || {};
    return Object.keys(store).reduce((rows, id) => rows.concat(Array.isArray(store[id]) ? store[id] : []), []);
  }
  /* 去重规则：同一账号的同一条作品（相同抖音作品ID）去重；不同账号的同一条作品不去重，按账号分别保留 */
  function v13GrabMonitorWorks(monitor, monitorIndex, offset) {
    const window = v13GrabWindow(monitorIndex, offset);
    const known = new Set(v13MonitorKnownKeys(monitor, monitorIndex));
    const accepted = [];
    window.forEach((item) => {
      if (known.has(item.key)) return;
      known.add(item.key);
      accepted.push({ id: `grab-${monitor.id}-${item.key}`, title: item.title, source: "监控抓取", from: monitor.name, monitorId: monitor.id, workKey: item.key, duration: item.duration, grabbedAt: "刚刚" });
    });
    return { accepted, fetched: window.length, deduped: window.length - accepted.length };
  }
  function v13CommitMonitorGrab(monitor, monitorIndex, offset, lastSyncLabel) {
    const batch = v13GrabMonitorWorks(monitor, monitorIndex, offset);
    const store = Object.assign({}, v13State().monitorGrabs);
    store[monitor.id] = [...batch.accepted, ...v13GrabbedWorks(monitor.id)];
    v13Patch({ monitorGrabs: store });
    v13UpdateMonitor(monitor.id, { paused: false, lastSync: lastSyncLabel(batch) });
    return batch;
  }

  const V13_WORKS_SEED = [
    { id: "wp-001", title: "星途 E7 后排空间实测", source: "监控抓取", from: "鸿途汽车官方", duration: "00:30", grabbedAt: "今天 09:05" },
    { id: "wp-002", title: "一次看懂 E7 增程续航", source: "监控抓取", from: "鸿途汽车官方", duration: "00:42", grabbedAt: "今天 09:06" },
    { id: "wp-003", title: "自动泊车挑战窄车位", source: "监控抓取", from: "鸿途汽车官方", duration: "00:35", grabbedAt: "今天 09:07" },
    { id: "wp-004", title: "旗舰店 18:30 首发记录", source: "监控抓取", from: "鸿途汽车旗舰店", duration: "00:28", grabbedAt: "今天 09:10" },
    { id: "wp-005", title: "城西店交车现场", source: "监控抓取", from: "杭州城西店", duration: "00:22", grabbedAt: "昨天 18:20" },
    { id: "wp-006", title: "风云 T9 家庭口播_竖版.mp4", source: "用户上传", from: "客户上传", duration: "00:32", size: "126.4 MB", grabbedAt: "昨天 16:40" },
    { id: "wp-007", title: "上海门店展厅走拍.mp4", source: "用户上传", from: "客户上传", duration: "00:18", size: "88.2 MB", grabbedAt: "昨天 15:10" },
    { id: "wp-008", title: "瑶光智能座舱夜景大片.mp4", source: "用户上传", from: "客户上传", duration: "00:20", size: "203.7 MB", grabbedAt: "08-24 11:20" },
    { id: "wp-009", title: "长续航通勤挑战实录", source: "监控抓取", from: "星途 E7 测评号", duration: "00:45", grabbedAt: "今天 09:15" },
    { id: "wp-010", title: "电车保值率真实样本", source: "监控抓取", from: "电车严选", duration: "00:38", grabbedAt: "昨天 18:30" },
    { id: "wp-011", title: "家庭出游装载实测", source: "监控抓取", from: "鸿途汽车官方", duration: "00:33", grabbedAt: "今天 09:08" },
    { id: "wp-012", title: "凌云山路驾驶动态", source: "监控抓取", from: "星途凌云日常", duration: "00:29", grabbedAt: "今天 09:18" },
  ];
  const V13_WORK_TITLES = ["门店实拍：这台车适合哪类家庭", "试驾实测：城市通勤的三个细节", "配置对比：买车前先看这项", "空间体验：后排到底够不够用"];

  function v13State() { return state.wuJian.v13 || {}; }
  function v13Patch(patch) { state.wuJian.v13 = Object.assign({}, state.wuJian.v13, patch); persistWuJian(); }
  function v13Cover(index) { return V13_COVERS[index % V13_COVERS.length]; }
  function v13Video(index) { return V13_VIDEOS[index % V13_VIDEOS.length]; }
  function v13Works() {
    const uploads = Array.isArray(v13State().worksPoolUploads) ? v13State().worksPoolUploads : [];
    return [...uploads, ...v13AllGrabbedWorks(), ...V13_WORKS_SEED];
  }
  function v13AccountWorks(accountId, accountIndex) {
    const rows = [];
    const base = 4200 + accountIndex * 373;
    const generated = (v13State().generatedTasks || []).filter((task) => (task.accountIds || []).includes(accountId));
    V13_WORK_TITLES.forEach((title, i) => {
      const status = V13_ACCOUNT_WORK_STATUSES[(accountIndex + i) % V13_ACCOUNT_WORK_STATUSES.length];
      const douyinWorkId = `740123456789${String(accountIndex).padStart(2, "0")}${String(i).padStart(2, "0")}`;
      rows.push({
        id: `${accountId}-work-${i}`,
        taskId: `task-history-${String(accountIndex + 1).padStart(2, "0")}`,
        materialId: `material-${String(accountIndex + 1).padStart(2, "0")}-${i + 1}`,
        materialTitle: title,
        publishedTitle: title,
        title,
        cover: v13Cover(accountIndex + i),
        duration: ["00:30", "00:45", "00:28"][i % 3],
        publishedAt: `2026-08-2${(accountIndex + i) % 7 + 1} ${String(8 + (i % 3)).padStart(2, "0")}:30`,
        plays: base + i * 1800,
        likes: Math.round((base + i * 1800) * 0.058),
        comments: Math.max(2, Math.round((base + i * 1800) * 0.014)),
        favorites: Math.max(2, Math.round((base + i * 1800) * 0.02)),
        shares: Math.max(1, Math.round((base + i * 1800) * 0.008)),
        status,
        douyinWorkId,
        link: status === "发布完成" ? `https://www.douyin.com/video/${douyinWorkId}` : ""
      });
    });
    generated.forEach((task, gi) => {
      const distribution = (task.distribution || []).find((row) => row.accountId === accountId);
      const assignedWorks = distribution
        ? (distribution.workIds || []).map((workId) => {
            const workIndex = (task.workIds || []).indexOf(workId);
            return { workId, title: (task.workTitles || [])[workIndex] || workId };
          })
        : (task.workTitles || []).map((title, workIndex) => ({ workId: (task.workIds || [])[workIndex] || `generated-${gi}-${workIndex}`, title }));
      assignedWorks.forEach((assignedWork, wi) => {
        const title = assignedWork.title;
        const record = (task.titles || []).find((item) => item.workId === assignedWork.workId);
        const taskCompleted = task.status === "已完成";
        const douyinWorkId = taskCompleted ? `741987654321${String(accountIndex).padStart(2, "0")}${String(gi).padStart(2, "0")}${String(wi).padStart(2, "0")}` : "";
        rows.unshift({ id: `${accountId}-${task.id || `task-${gi}`}-work-${wi}`, taskId: task.id || `task-${gi}`, materialId: assignedWork.workId, materialTitle: record ? record.materialTitle : title, publishedTitle: title, title, topicTags: record ? (record.tags || []).slice() : [], titleEdited: Boolean(record?.edited), cover: v13Cover(accountIndex + gi + wi + 2), duration: "00:30", publishedAt: task.publishedAt || task.createdAt || task.time, plays: taskCompleted ? 5200 + gi * 640 + wi * 210 : 0, likes: taskCompleted ? 310 + gi * 55 : 0, comments: taskCompleted ? 24 + wi * 6 : 0, favorites: taskCompleted ? 96 + gi * 12 : 0, shares: taskCompleted ? 41 + wi * 3 : 0, status: taskCompleted ? "发布完成" : "发布中", douyinWorkId, link: taskCompleted ? `https://www.douyin.com/video/${douyinWorkId}` : "" });
      });
    });
    return rows;
  }
  const V13_ACCOUNT_WORK_STATUSES = ["发布完成", "发布中", "发布失败", "待发布"];
  const V13_ACCOUNT_WORK_FILTERS = ["待发布", "发布中", "发布完成", "发布失败", "取消发布"];
  function v13AccountWorkFilters() {
    const selected = Array.isArray(v13State().accountWorksFilters) ? v13State().accountWorksFilters.filter((filter) => ["all", ...V13_ACCOUNT_WORK_FILTERS].includes(filter)) : [];
    return selected.length ? selected : ["all"];
  }
  function v13AccountWorkStatus(accountId, work, index) {
    const overrides = v13State().accountWorkStatuses || {};
    if ([...V13_ACCOUNT_WORK_FILTERS].includes(overrides[work.id])) return overrides[work.id];
    if ([...V13_ACCOUNT_WORK_FILTERS].includes(work.status)) return work.status;
    return V13_ACCOUNT_WORK_STATUSES[index % V13_ACCOUNT_WORK_STATUSES.length];
  }
  function v13AccountWorkStatusTone(status) {
    return { "待发布": "pending", "发布中": "publishing", "发布完成": "complete", "发布失败": "failed", "取消发布": "canceled" }[status] || "pending";
  }
  function v13Published(account, index) {
    const generated = (v13State().generatedTasks || []).filter((task) => task.status === "已完成" && (task.accountIds || []).includes(account.id));
    const added = generated.reduce((sum, task) => sum + (task.workCount || 0), 0);
    return (account.published || 0) + added;
  }

  function v13PublishResults() {
    const durationSeconds = (duration) => {
      const parts = String(duration || "00:00").split(":").map(Number);
      return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    };
    const normalizePublishedAt = (value) => {
      const text = String(value || "").replace("T", " ");
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return text.slice(0, 16);
      if (/^\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return `2026-${text}`;
      return "2026-08-27 10:00";
    };
    const rows = [];
    V13_ACCOUNTS.forEach((account, accountIndex) => {
      v13AccountWorks(account.id, accountIndex).forEach((work, workIndex) => {
        if (v13AccountWorkStatus(account.id, work, workIndex) !== "发布完成") return;
        const publishedAt = normalizePublishedAt(work.publishedAt);
        const douyinWorkId = work.douyinWorkId || `740123456789${String(accountIndex).padStart(2, "0")}${String(workIndex).padStart(2, "0")}`;
        rows.push({
          publishResultId: `result-${work.id}`,
          taskId: work.taskId || `task-history-${accountIndex + 1}`,
          materialId: work.materialId || work.id,
          materialTitle: work.materialTitle || work.title,
          publishedTitle: work.publishedTitle || work.title,
          topicTags: Array.isArray(work.topicTags) ? work.topicTags.slice() : [],
          coverUrl: work.cover,
          durationSeconds: durationSeconds(work.duration),
          duration: work.duration,
          accountId: account.id,
          accountName: account.name,
          accountAvatarUrl: v13Cover(accountIndex + 4),
          douyinAccountId: account.id,
          douyinWorkId,
          douyinWorkUrl: work.link || `https://www.douyin.com/video/${douyinWorkId}`,
          publishedAt,
          views: work.plays,
          likes: work.likes,
          comments: work.comments,
          favorites: work.favorites,
          shares: work.shares,
          metricsUpdatedAt: "2026-08-27 10:05"
        });
      });
    });
    return rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
  window.aiVideoPublishResults = v13PublishResults;
  function v13Pending(account) {
    return Number.isFinite(Number(account?.pending)) ? Number(account.pending) : 0;
  }
  function v13StatusTone(status) {
    return { "正在发布": "ok", "排队中": "schedule", "已发布": "ok", "发布异常": "danger" }[status] || "muted";
  }
  function v13Pill(status) {
    return `<span class="ai-matrix-pill is-${v13StatusTone(status)}"><i></i>${escapeHtml(status)}</span>`;
  }
  function v13Kpis(kpis) {
    return `<section class="ai-matrix-kpis">${kpis.map(([label, value, note]) => `<article class="ai-matrix-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("")}</section>`;
  }
  function v13SectionHead(eyebrow, title, copy, actions) {
    return `<header class="ai-matrix-section-head"><div><span>${escapeHtml(eyebrow)}</span><strong>${escapeHtml(title)}</strong>${copy ? `<small>${escapeHtml(copy)}</small>` : ""}</div>${actions || ""}</header>`;
  }

  /* ---------- 总览 · 账号发布状态 ---------- */
  function v13WallTime(account) {
    if (!account?.publishedAt) return account?.time || "";
    const parsed = new Date(account.publishedAt);
    if (Number.isNaN(parsed.getTime())) return account.time || "";
    const time = parsed.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const today = new Date();
    const sameDay = parsed.getFullYear() === today.getFullYear() && parsed.getMonth() === today.getMonth() && parsed.getDate() === today.getDate();
    return sameDay ? time : `${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")} · ${time}`;
  }
  function v13WallCard(account, index) {
    const publishing = account.status === "正在发布";
    const queued = account.status === "排队中";
    const errored = account.status === "发布异常";
    const done = account.status === "已发布";
    const errorLabel = account.failureType === "marketing" ? "营销未授权" : "发布失败";
    /* 发布过程视频在作品发布完成后才可从抖音获取：仅"已发布"展示视频，"正在发布"使用进行中空态 */
    const media = done
      ? `<video class="wjv-wall-media" autoplay muted loop playsinline preload="metadata" poster="${v13Cover(index)}" src="${v13Video(index)}" aria-label="${escapeHtml(account.name)}账号发布过程视频"></video>`
      : publishing
        ? `<div class="wjv-wall-empty is-live"><span class="wjv-wall-empty-icon" aria-hidden="true">●</span><strong>正在发布</strong><small>发布过程视频将在发布完成后展示</small></div>`
        : queued
          ? `<div class="wjv-wall-empty is-queue"><span class="wjv-wall-empty-icon" aria-hidden="true">⋯</span><strong>排队中</strong><small>待发布，暂时没有可展示视频</small></div>`
          : `<div class="wjv-wall-empty is-error"><span class="wjv-wall-empty-icon" aria-hidden="true">!</span><strong>${errorLabel}</strong><small>${escapeHtml(account.error || "发布失败，请点击重新发布")}</small></div>`;
    const stateTag = errored ? `<i class="wjv-wall-state is-error">!</i>` : queued ? `<i class="wjv-wall-state is-queue">⋯</i>` : publishing ? `<i class="wjv-wall-state is-live"></i>` : `<i class="wjv-wall-state is-done">✓</i>`;
    const mediaTime = done ? v13WallTime(account) : account.time;
    const action = errored
      ? account.failureType === "marketing" ? `<button type="button" class="wjv-wall-link is-primary" data-wjv-account-todo="${escapeHtml(account.id)}" data-wjv-account-name="${escapeHtml(account.name)}">去处理</button>` : `<button type="button" class="wjv-wall-link is-primary" data-wjv-republish-account="${escapeHtml(account.id)}">重新发布</button>`
      : `<button type="button" class="wjv-wall-link" data-wjv-view-account="${escapeHtml(account.id)}">查看作品</button>`;
    return `<article class="wjv-wall-card is-${errored ? "error" : publishing ? "live" : queued ? "queue" : "done"}">
      <div class="wjv-wall-media">${media}${stateTag}${mediaTime ? `<span class="wjv-wall-time">${escapeHtml(mediaTime)}</span>` : ""}</div>
      <div class="wjv-wall-body">
        <header><div><strong>${escapeHtml(account.name)}</strong></div>${v13Pill(account.status)}</header>
        <div class="wjv-wall-progress"><i><b style="width:${account.progress}%"></b></i></div>
        <footer><span>${escapeHtml(publishing ? "正在发布" : queued ? "排队中" : done ? "已发布" : errorLabel)}</span>${action}</footer>
      </div>
    </article>`;
  }
  function wujianV13Overview() {
    const accounts = V13_ACCOUNTS;
    const publishing = accounts.filter((a) => a.status === "正在发布").length;
    const queued = accounts.filter((a) => a.status === "排队中").length;
    const errored = accounts.filter((a) => a.status === "发布异常").length;
    const weekPublished = accounts.reduce((sum, a) => sum + v13Published(a, accounts.indexOf(a)), 0);
    const pendingWorks = v13Works().length;
    const wall = accounts.map(v13WallCard).join("") + `<button type="button" class="wjv-wall-card wjv-wall-add" data-wjv-bind-account aria-label="绑定新的抖音账号"><span class="wjv-wall-add__icon" aria-hidden="true">＋</span><span class="wjv-wall-add__eyebrow">账号管理</span><strong>绑定新的抖音账号</strong><small>完成营销授权后加入矩阵发布，按账号按日计费。</small><span class="wjv-wall-add__action">去绑定账号 <b aria-hidden="true">→</b></span></button>`;
    return `<div class="wujian-page wujian-matrix-page wjv-page">
      ${v13Kpis([["接入账号", `${accounts.length} 个`, "按账号按日计费"], ["本周已发布", weekPublished, "矩阵累计发布"], ["实时状态", `${publishing} 正在发布 · ${queued} 排队 · ${errored} 发布异常`, "发布进度实时更新"]])}
      ${v13SectionHead("总览", "账号发布状态", "每个账号展示当前状态；已完成发布的账号展示最近一次发布视频，账号发布节奏一目了然。", `<div class="wjv-wall-legend"><span class="is-live"><i></i>正在发布</span><span class="is-queue"><i></i>排队中</span><span class="is-done"><i></i>已发布</span><span class="is-error"><i></i>发布异常</span></div>`)}
      <div class="wjv-wall">${wall}</div>
    </div>`;
  }

  /* ---------- 发布任务 ---------- */
  function v13ComputeDistribution(accounts, works) {
    if (!accounts.length) return [];
    const dist = accounts.map((a) => ({ account: a, works: [] }));
    works.forEach((w, i) => dist[i % accounts.length].works.push(w));
    return dist;
  }

  function v13AccountPicker() {
    const s = v13State();
    const selected = new Set(s.taskAccounts || []);
    const allChecked = V13_ACCOUNTS.length > 0 && V13_ACCOUNTS.every((a) => selected.has(a.id));
    return `<section class="wjv-step">
      <div class="wjv-step-options">
        <div class="wjv-account-picker-head">
          <div class="wjv-account-picker-title"><span>发布账号</span><strong>选择要发布的账号</strong><small>可多选，视频将分发到选中的账号</small></div>
          <div class="wjv-account-selected-count" aria-live="polite"><b>${selected.size}</b><span>/${V13_ACCOUNTS.length} 个账号</span></div>
        </div>
        <div class="wjv-account-toolbar"><span>已接入 ${V13_ACCOUNTS.length} 个账号</span><button type="button" class="wjv-quiet" data-wjv-account-all>${allChecked ? "取消全选" : "全选账号"}</button></div>
        <div class="wjv-account-grid">${V13_ACCOUNTS.map((a) => { const groupClass = a.group === "旗舰店" ? "is-flagship" : a.group === "城市店" ? "is-city" : "is-franchise"; const isSelected = selected.has(a.id); return `<label class="wjv-account-option${isSelected ? " is-selected" : ""}"><input type="checkbox" data-wjv-account="${escapeHtml(a.id)}" aria-label="选择${escapeHtml(a.name)}" ${isSelected ? "checked" : ""}><span class="wjv-account-avatar ${groupClass}" aria-hidden="true">${escapeHtml(a.city.slice(0, 1))}</span><span class="wjv-account-details"><strong>${escapeHtml(a.name)}</strong><small><em>${escapeHtml(a.group)}</em><span>${escapeHtml(a.city)}</span></small></span><span class="wjv-account-check" aria-hidden="true">${isSelected ? "✓" : ""}</span></label>`; }).join("")}</div>
        <p class="wjv-step-count"><b>${selected.size}</b> 个账号已选</p>
      </div>
      <footer class="wjv-step-actions"><button type="button" class="is-primary" data-wjv-step-next>下一步 · 选择素材 <span aria-hidden="true">→</span></button></footer>
    </section>`;
  }
  function v13WorkPicker() {
    const s = v13State();
    const selected = new Set(s.taskWorks || []);
    const accountCount = (s.taskAccounts || []).length || 1;
    const filter = s.workFilter || "all";
    const works = v13Works();
    const visible = works.filter((w) => filter === "all" || w.source === filter);
    const chips = [["all", "全部"], ["监控抓取", "监控抓取"], ["用户上传", "用户上传"]];
    const underflow = selected.size > 0 && selected.size < accountCount;
    const nextDisabled = selected.size === 0 || underflow;
    return `<section class="wjv-step">
      <div class="wjv-step-options">
        <div class="wjv-filter-row"><div class="wjv-segmented">${chips.map(([key, label]) => `<button type="button" class="${filter === key ? "is-active" : ""}" data-wjv-work-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}</div><div><input type="file" data-wjv-upload-input accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" hidden><button type="button" class="wjv-quiet" data-wjv-upload>＋ 上传视频</button></div></div>
        <div class="wjv-work-grid">${visible.map((w, i) => `<label class="wjv-work-option${selected.has(w.id) ? " is-selected" : ""}"><input type="checkbox" data-wjv-work="${escapeHtml(w.id)}" ${selected.has(w.id) ? "checked" : ""}><img src="${v13Cover(i)}" alt="${escapeHtml(w.title)}"><span><em>${escapeHtml(w.source)}</em><strong>${escapeHtml(w.title)}</strong><small>${escapeHtml(w.duration)} · ${escapeHtml(w.grabbedAt)}</small></span><b>${selected.has(w.id) ? "✓" : ""}</b></label>`).join("")}</div>
        <p class="wjv-step-count">已选 <b>${selected.size}</b> 条素材${selected.size ? `，预计发布 <b>${selected.size}</b> 条（去重分发，每条素材发到一个账号）` : ""}</p>
        ${underflow ? `<p class="wjv-step-warn">当前 ${selected.size} 条素材不足以覆盖 ${accountCount} 个账号（每个账号至少需要 1 条素材），请补充素材或返回上一步减少账号。</p>` : ""}
      </div>
      <footer class="wjv-step-actions"><button type="button" class="wjv-quiet" data-wjv-step-back>上一步</button><button type="button" class="is-primary" ${nextDisabled ? "disabled" : ""} data-wjv-step-next>下一步 · 选择发布方式 <span aria-hidden="true">→</span></button></footer>
    </section>`;
  }
  /* ---------- AI 拓展：标题与话题标签（确认页可编辑，见 PRD 4.5.2） ---------- */
  const V13_TITLE_MAX = 55;
  const V13_TAG_MAX = 3;
  const V13_AI_TITLE_PATTERNS = [
    (core) => `${core}，看完这条再决定`,
    (core) => `为什么大家都在聊${core}`,
    (core) => `${core}｜3 个关键点一次说清`,
    (core) => `${core}到底怎么样？这条讲透了`,
    (core) => `关于${core}，你可能想错了`,
    (core) => `${core}的真实体验，值得看完`,
    (core) => `一条视频看懂${core}`,
    (core) => `${core}值不值？先看这几点`,
  ];
  /* 话题标签只从核心文案里取词，不引用素材标题或文件名 */
  function v13AiTags(core) {
    const tokens = String(core || "").split(/[，,。！!？?、\s｜|：:；;""'']+/).filter((token) => token.length >= 2);
    const tags = [];
    tokens.forEach((token) => {
      if (tags.length >= V13_TAG_MAX) return;
      const tag = `#${token.slice(0, 10)}`;
      if (!tags.includes(tag)) tags.push(tag);
    });
    return tags;
  }
  function v13TitleText(record) {
    const title = String(record?.title || "");
    const tags = Array.isArray(record?.tags) ? record.tags.filter(Boolean) : [];
    return tags.length ? `${title} ${tags.join(" ")}` : title;
  }
  function v13TitleIssue(record) {
    if (!record) return "";
    if (!String(record.title || "").trim()) return "标题正文不能为空";
    if ((record.tags || []).length > V13_TAG_MAX) return `最多添加 ${V13_TAG_MAX} 个话题标签`;
    if (v13TitleText(record).length > V13_TITLE_MAX) return `发布标题不能超过 ${V13_TITLE_MAX} 个字符`;
    return "";
  }
  /* 仅以核心文案为输入批量生成：素材信息不参与生成，只用于按 materialId 回写 */
  function v13AiTitleSet(coreCopy, works) {
    const core = String(coreCopy || "").trim().replace(/[，,。！!？?、\s]+$/, "") || "本条内容";
    const tags = v13AiTags(core);
    const map = {};
    (works || []).forEach((work, index) => {
      const pattern = V13_AI_TITLE_PATTERNS[index % V13_AI_TITLE_PATTERNS.length];
      const record = { title: pattern(core), tags: tags.slice(), edited: false };
      while (v13TitleText(record).length > V13_TITLE_MAX && record.tags.length) record.tags.pop();
      if (v13TitleText(record).length > V13_TITLE_MAX) record.title = record.title.slice(0, V13_TITLE_MAX);
      map[work.id] = record;
    });
    return map;
  }
  function v13TaskTitleRecords() {
    const s = v13State();
    if ((s.taskTitleMode || "none") !== "ai-expand") return {};
    const works = v13Works().filter((w) => (s.taskWorks || []).includes(w.id));
    const stored = s.taskTitles && typeof s.taskTitles === "object" ? s.taskTitles : {};
    const signature = `${String(s.taskTitleCopy || "").trim()}|${works.map((w) => w.id).join(",")}`;
    if (s.taskTitlesSignature === signature && works.length && works.every((w) => stored[w.id])) return stored;
    const generated = v13AiTitleSet(s.taskTitleCopy, works);
    const next = v13State();
    next.taskTitles = generated;
    next.taskTitlesSignature = signature;
    persistWuJian();
    return generated;
  }
  function v13ClearTaskTitles() {
    const next = v13State();
    next.taskTitles = {};
    next.taskTitlesSignature = "";
  }
  /* 新增话题标签：自动补 #、最多 3 个、同条不重复、拼接后不得超过 55 个字符 */
  function v13AddAiTag(workId, rowId) {
    const record = v13State().taskTitles?.[workId];
    if (!record) return;
    const tags = Array.isArray(record.tags) ? record.tags : [];
    if (tags.length >= V13_TAG_MAX) { if (typeof showToast === "function") showToast(`最多添加 ${V13_TAG_MAX} 个话题标签`, "先删除不需要的标签再添加"); return; }
    const row = rowId ? document.querySelector(`[data-wjv-ai-row="${rowId}"]`) : null;
    const input = row ? row.querySelector("[data-wjv-ai-tag-input]") : null;
    const raw = String(input?.value || "").trim();
    if (!raw) return;
    const tag = raw.startsWith("#") ? raw : `#${raw}`;
    if (tag === "#" || tag.length < 2) { if (typeof showToast === "function") showToast("话题标签无效", "话题标签不能为空，请重新输入"); return; }
    if (tags.includes(tag)) { if (typeof showToast === "function") showToast("该话题标签已存在", "同一条发布标题内话题标签不重复"); return; }
    const next = { title: record.title, tags: [...tags, tag], edited: true };
    if (v13TitleText(next).length > V13_TITLE_MAX) { if (typeof showToast === "function") showToast("发布标题不能超过 55 个字符", "请先精简标题正文或删除其他话题标签"); return; }
    record.tags = next.tags;
    record.edited = true;
    persistWuJian();
    refreshWuJianLiveWorkspace();
    const focus = document.querySelector(`[data-wjv-ai-row="${workId}"] [data-wjv-ai-tag-input]`);
    if (focus) focus.focus();
  }
  /* 确认页统一行：素材 → 目标账号 → 发布标题（AI 拓展模式下标题与话题标签可编辑） */
  function v13DistRow(work, coverIndex, account, record, mode, fixedCopy) {
    const headMarkup = (edited) => `<div class="wjv-ai-row-head"><img src="${v13Cover(coverIndex)}" alt="${escapeHtml(work.title)}"><span><strong>${escapeHtml(work.title)}</strong><small>${escapeHtml(work.duration)} · ${escapeHtml(work.source)}</small></span>${edited ? `<em class="wjv-ai-edited">用户修改</em>` : ""}</div>`;
    const head = headMarkup(false);
    const target = `<div class="wjv-dist-target"><small>分配给</small><strong>${escapeHtml(account?.name || "待分配")}</strong><em>${escapeHtml(account?.city || "")}</em></div>`;
    if (mode !== "ai-expand") {
      const plain = mode === "fixed"
        ? `<p class="wjv-dist-plain">${escapeHtml(fixedCopy || "—")}</p><small class="wjv-dist-note">固定文案 · 本次所有素材统一使用，如需修改请返回上一步</small>`
        : `<p class="wjv-dist-plain is-empty">—（无标题）</p><small class="wjv-dist-note">无标题发布 · 发布时文案为空</small>`;
      return `<li class="wjv-ai-row wjv-dist-row" data-wjv-dist-row="${escapeHtml(work.id)}">${head}${target}<div class="wjv-dist-publish">${plain}</div></li>`;
    }
    const tags = Array.isArray(record.tags) ? record.tags : [];
    const issue = v13TitleIssue(record);
    const length = v13TitleText(record).length;
    return `<li class="wjv-ai-row wjv-dist-row" data-wjv-ai-row="${escapeHtml(work.id)}" data-wjv-dist-row="${escapeHtml(work.id)}">
      ${headMarkup(record.edited)}
      ${target}
      <div class="wjv-dist-publish">
        <label class="wjv-ai-title-input"><span>标题正文</span><input type="text" data-wjv-ai-title="${escapeHtml(work.id)}" value="${escapeHtml(record.title)}" placeholder="标题正文，不能为空"></label>
        <div class="wjv-ai-tags"><span class="wjv-ai-tag-label">话题标签</span>${tags.map((tag) => `<span class="wjv-ai-tag">${escapeHtml(tag)}<button type="button" data-wjv-ai-tag-remove="${escapeHtml(work.id)}" data-wjv-ai-tag="${escapeHtml(tag)}" aria-label="删除话题标签 ${escapeHtml(tag)}">×</button></span>`).join("")}${tags.length >= V13_TAG_MAX ? `<em class="wjv-ai-tag-full">最多 ${V13_TAG_MAX} 个</em>` : ""}<input type="text" class="wjv-ai-tag-input" data-wjv-ai-tag-input="${escapeHtml(work.id)}" placeholder="${tags.length >= V13_TAG_MAX ? "已达上限" : "+ 添加话题"}" ${tags.length >= V13_TAG_MAX ? "disabled" : ""}><button type="button" class="wjv-ai-tag-add" data-wjv-ai-tag-add="${escapeHtml(work.id)}" data-wjv-ai-title-row="${escapeHtml(work.id)}">添加</button></div>
        <p class="wjv-ai-row-meta"><span data-wjv-ai-count="${escapeHtml(work.id)}" class="${length > V13_TITLE_MAX ? "is-over" : ""}">${length}/${V13_TITLE_MAX}</span><span class="wjv-ai-error" data-wjv-ai-error="${escapeHtml(work.id)}">${escapeHtml(issue)}</span></p>
      </div>
    </li>`;
  }
  function v13TimingPicker() {
    const s = v13State();
    const timing = s.taskTiming || "now";
    const scheduleAt = s.taskScheduleAt || "2026-08-26T18:30";
    const titleMode = s.taskTitleMode || "none";
    const titleCopy = s.taskTitleCopy || "";
    const slots = [["09:00", "09:00"], ["12:00", "12:00"], ["18:00", "18:00"]];
    const titleNextDisabled = (titleMode === "fixed" || titleMode === "ai-expand") && !titleCopy.trim();
    return `<section class="wjv-step">
      <div class="wjv-step-options">
        <div class="wjv-setting-block"><p class="wjv-setting-label">发布时间</p>
          <div class="wjv-timing-grid">
            <button type="button" class="wjv-timing-card${timing === "now" ? " is-active" : ""}" data-wjv-timing="now"><strong>立即发布</strong><small>确认后马上执行</small></button>
            <button type="button" class="wjv-timing-card${timing === "scheduled" ? " is-active" : ""}" data-wjv-timing="scheduled"><strong>定时发布</strong><small>按设定时间执行（单时间点）</small></button>
          </div>
          ${timing === "scheduled" ? `<div class="wjv-schedule-block"><label><span>发布时间</span><input type="datetime-local" data-wjv-schedule value="${escapeHtml(scheduleAt)}"></label><div class="wjv-slot-row"><span>快捷时段</span>${slots.map(([val, label]) => `<button type="button" class="wjv-slot" data-wjv-slot="${val}">每天 ${escapeHtml(label)}</button>`).join("")}</div></div>` : ""}
        </div>
        <div class="wjv-setting-block"><p class="wjv-setting-label">标题策略<small>每条素材发布时使用的标题文案</small></p>
          <div class="wjv-timing-grid wjv-title-grid">
            <button type="button" class="wjv-timing-card${titleMode === "none" ? " is-active" : ""}" data-wjv-title-mode="none"><strong>无标题发布</strong><small>发布时文案为空</small></button>
            <button type="button" class="wjv-timing-card${titleMode === "fixed" ? " is-active" : ""}" data-wjv-title-mode="fixed"><strong>固定文案</strong><small>所有素材统一使用同一段文案</small></button>
            <button type="button" class="wjv-timing-card${titleMode === "ai-expand" ? " is-active" : ""}" data-wjv-title-mode="ai-expand"><strong>AI 拓展发布</strong><small>输入一句话，AI 自动扩写为多条不同标题</small></button>
          </div>
          ${titleMode === "fixed" ? `<div class="wjv-schedule-block"><label><span>发布文案</span><textarea data-wjv-title-copy rows="3" placeholder="输入发布文案，将应用到本次所有素材">${escapeHtml(titleCopy)}</textarea></label></div>` : ""}
          ${titleMode === "ai-expand" ? `<div class="wjv-schedule-block"><label><span>核心文案</span><input type="text" data-wjv-title-copy placeholder="输入一句核心文案，AI 将自动拓展为多个不同标题" value="${escapeHtml(titleCopy)}"></label><p class="wjv-step-hint">如：济南优质二手车推荐 → AI 将生成多个变体，每条素材使用不同标题</p></div>` : ""}
        </div>
      </div>
      <footer class="wjv-step-actions"><button type="button" class="wjv-quiet" data-wjv-step-back>上一步</button><button type="button" class="is-primary" ${titleNextDisabled ? "disabled" : ""} data-wjv-step-next>下一步 · 确认发布 <span aria-hidden="true">→</span></button></footer>
    </section>`;
  }
  function v13Confirm() {
    const s = v13State();
    const accounts = V13_ACCOUNTS.filter((a) => (s.taskAccounts || []).includes(a.id));
    const works = v13Works().filter((w) => (s.taskWorks || []).includes(w.id));
    const timing = s.taskTiming === "scheduled" ? `定时 ${String(s.taskScheduleAt || "").replace("T", " ")}` : "立即发布";
    const titleMode = s.taskTitleMode || "none";
    const titleCopy = s.taskTitleCopy || "";
    /* 摘要行只给结论值，标题与分发的细节在下方「分发预览」逐条呈现 */
    const titleLabels = { none: "无标题发布", fixed: "固定文案", "ai-expand": "AI 拓展" };
    const total = works.length;
    const dist = v13ComputeDistribution(accounts, works);
    const distMarkup = dist.map((row) => `<div class="wjv-dist-row"><strong>${escapeHtml(row.account.name)}</strong><span>${escapeHtml(row.account.city)}</span><ul>${row.works.map((w) => `<li>${escapeHtml(w.title)}<em>${escapeHtml(w.duration)}</em></li>`).join("")}</ul></div>`).join("");
    const aiTitles = titleMode === "ai-expand" ? v13TaskTitleRecords() : {};
    const accountOf = {};
    dist.forEach((row) => row.works.forEach((w) => { accountOf[w.id] = row.account; }));
    const aiIssues = titleMode === "ai-expand" ? works.filter((w) => v13TitleIssue(aiTitles[w.id])).length : 0;
    const aiEdited = titleMode === "ai-expand" ? works.filter((w) => aiTitles[w.id]?.edited).length : 0;
    const distTitles = `<div class="wjv-dist-preview"><p class="wjv-setting-label">分发预览<small>逐条确认「素材 → 目标账号 → 发布标题」${titleMode === "ai-expand" ? "；标题正文与话题标签可直接修改" : "（按选择顺序轮询分配，不可调整）"}</small></p>
        <ul class="wjv-dist-title-list">${works.map((w) => v13DistRow(w, v13Works().indexOf(w) + 1, accountOf[w.id], aiTitles[w.id] || { title: titleCopy, tags: [], edited: false }, titleMode, titleCopy)).join("")}</ul>
        ${titleMode === "ai-expand" ? `<p class="wjv-step-hint">${aiEdited ? `已修改 ${aiEdited} 条，` : ""}共 ${works.length} 条标题，仅基于核心文案生成，每条素材使用各自唯一的标题与话题组合。</p>` : ""}
      </div>`;
    return `<section class="wjv-step">
      <div class="wjv-step-options wjv-confirm">
        <dl class="wjv-confirm-rows">
          <div><dt>发布账号</dt><dd>${accounts.length} 个</dd></div>
          <div><dt>发布素材</dt><dd>${works.length} 条</dd></div>
          <div><dt>发布方式</dt><dd>${escapeHtml(timing)}</dd></div>
          <div><dt>标题策略</dt><dd>${escapeHtml(titleLabels[titleMode] || "无标题发布")}</dd></div>
          <div><dt>预计发布</dt><dd>${total} 条</dd></div>
        </dl>
        ${dist.length ? distTitles : ""}
        <p class="wjv-confirm-note">确认后系统将校验账号授权，通过后立即锁定素材并创建任务。各账号并行发布，同一账号内素材串行执行。</p>
      </div>
      <footer class="wjv-step-actions"><button type="button" class="wjv-quiet" data-wjv-step-back>上一步</button><button type="button" class="is-primary" ${aiIssues ? "disabled" : ""} data-wjv-submit>确认发布 · 生成任务 <span aria-hidden="true">→</span></button></footer>
    </section>`;
  }
  function v13Flow() {
    const step = Math.min(4, Math.max(1, Number(v13State().taskStep) || 1));
    const steps = [["选择账号", "选择素材", "发布方式", "确认发布"]];
    return `<div class="wjv-flow">
      <header class="wjv-flow-head">
        <div class="wjv-stepper">${steps[0].map((label, i) => `<span class="${i + 1 <= step ? "is-active" : ""}${i + 1 === step ? " is-current" : ""}"><i>${i + 1}</i><b>${escapeHtml(label)}</b></span>`).join("")}</div>
        <button type="button" class="wjv-quiet" data-wjv-flow-cancel>取消</button>
      </header>
      <div class="wjv-flow-body">${step === 1 ? v13AccountPicker() : step === 2 ? v13WorkPicker() : step === 3 ? v13TimingPicker() : v13Confirm()}</div>
    </div>`;
  }
  function v13Results() {
    const accounts = V13_ACCOUNTS;
    const totalPublished = accounts.reduce((sum, a, i) => sum + v13Published(a, i), 0);
    const tasks = v13State().generatedTasks || [];
    const rows = accounts.map((a, i) => `<tr><td><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.group)} · ${escapeHtml(a.city)}</small></td><td class="wjv-pending-cell"><b>${v13Pending(a)}</b> 条</td><td class="wjv-published-cell"><b>${v13Published(a, i)}</b> 条</td><td><button type="button" class="wjv-link" data-wjv-view-account="${escapeHtml(a.id)}">查看作品 <span aria-hidden="true">→</span></button></td></tr>`).join("");
    return `<div class="wjv-results">
      ${v13Kpis([["发布账号", `${accounts.length} 个`, "已接入营销授权"], ["累计已发布", `${totalPublished} 条`, "矩阵发布总量"], ["本批发布任务", `${tasks.length} 个`, "最近生成的发布任务"]])}
      ${v13SectionHead("发布任务", "发布结果", "按账号查看发布情况，点击进入该账号的作品列表。", `<button type="button" class="is-primary" data-wjv-new-task>＋ 创建发布任务</button>`)}
      <div class="ai-matrix-table"><table><thead><tr><th>账号名</th><th title="该账号当前待发布的视频数量">待发布</th><th>已发布</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  }
  function wujianV13PublishSection() {
    const s = v13State();
    const content = s.publishView === "create" ? v13Flow() : v13Results();
    return `<div class="wujian-page wujian-matrix-page wjv-page">${content}</div>`;
  }

  /* ---------- 作品库 ---------- */
  function v13LibraryWorkCard(work, index) {
    const downloadSource = { ...work, video: work.video || v13Video(index) };
    const downloadUrl = wuJianWorkDownloadUrl(downloadSource);
    const downloadMarkup = downloadUrl
      ? `<a class="wjv-link" href="${escapeHtml(downloadUrl)}" download="${escapeHtml(wuJianWorkDownloadName(downloadSource))}">下载视频 <span aria-hidden="true">↓</span></a>`
      : `<button type="button" class="wjv-link" data-wjv-work-download="${escapeHtml(work.id)}">下载视频 <span aria-hidden="true">↓</span></button>`;
    const meta = `${escapeHtml(work.from)} · ${escapeHtml(work.grabbedAt)}${work.workKey ? ` · 作品ID ${escapeHtml(work.workKey)}` : ""}${work.size ? ` · ${escapeHtml(work.size)}` : ""}`;
    /* 作品库卡片只保留"下载视频"：发布统一从"发布任务 → 选择素材"进入，卡片不再提供"去发布"入口 */
    return `<article class="wjv-work-card"><div class="wjv-work-cover"><img src="${v13Cover(index)}" alt="${escapeHtml(work.title)}"><span>${escapeHtml(work.duration)}</span><em class="${work.source === "用户上传" ? "is-upload" : "is-monitor"}">${escapeHtml(work.source)}</em></div><div class="wjv-work-body"><h3>${escapeHtml(work.title)}</h3><p><span>${meta}</span></p><footer>${downloadMarkup}</footer></div></article>`;
  }
  function v13LibraryWorks() {
    const filter = v13State().workFilter || "all";
    const works = v13Works().filter((w) => filter === "all" || w.source === filter);
    const chips = [["all", "全部", v13Works().length], ["监控抓取", "监控抓取", v13Works().filter((w) => w.source === "监控抓取").length], ["用户上传", "用户上传", v13Works().filter((w) => w.source === "用户上传").length]];
    return `<section class="wjv-lib-panel">
      ${v13SectionHead("作品库", "待发布作品", "监控账号抓取与客户上传的作品统一沉淀在这里，作为发布任务的素材来源。上传视频按抖音发布限制校验：MP4 / MOV / WebM，单个不超过 4GB。", `<div class="wjv-filter-row"><div class="wjv-segmented">${chips.map(([key, label, count]) => `<button type="button" class="${filter === key ? "is-active" : ""}" data-wjv-work-filter="${escapeHtml(key)}">${escapeHtml(label)}<em>${count}</em></button>`).join("")}</div><input type="file" data-wjv-upload-input accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" multiple hidden><button type="button" class="is-primary" data-wjv-upload>＋ 上传视频</button></div>`)}
      <div class="wjv-work-grid">${works.map(v13LibraryWorkCard).join("")}</div>
    </section>`;
  }
  function v13MonitorRow(monitor, index) {
    /* 监控状态不单列展示：是否在监控由"每日自动抓取"开关与操作列的"同步/恢复监控"体现 */
    return `<tr><td><strong>${escapeHtml(monitor.name)}</strong><small>@${escapeHtml(monitor.handle)}</small></td><td>${v13MonitorKnownKeys(monitor, index).length} 条</td><td>${escapeHtml(monitor.lastSync)}</td><td><button type="button" class="wjv-switch${monitor.auto ? " is-on" : ""}" data-wjv-monitor-auto="${escapeHtml(monitor.id)}" aria-label="切换 ${escapeHtml(monitor.name)} 每日自动抓取" aria-pressed="${monitor.auto ? "true" : "false"}"><i></i></button><span class="wjv-switch-label">${monitor.auto ? "开启" : "关闭"}</span></td><td><div class="wjv-row-actions"><button type="button" data-wjv-monitor-sync="${escapeHtml(monitor.id)}">${monitor.paused ? "恢复监控" : "同步"}</button><button type="button" class="is-danger" data-wjv-monitor-delete="${escapeHtml(monitor.id)}">删除</button></div></td></tr>`;
  }
  function v13LibraryMonitor() {
    const rows = v13Monitors();
    return `<section class="wjv-lib-panel">
      ${v13SectionHead("作品库", "监控抖音账号", "配置要监控的抖音账号：添加时先校验有效性，校验通过后首次抓取 15 条作品，之后每日自动同步。", `<button type="button" class="is-primary" data-wjv-monitor-add>＋ 添加监控账号</button>`)}
      <div class="ai-matrix-table"><table><thead><tr><th>账号</th><th>已获取作品</th><th>最近同步</th><th>每日自动抓取</th><th>操作</th></tr></thead><tbody>${rows.map(v13MonitorRow).join("")}</tbody></table></div>
      <p class="wjv-lib-note">去重规则：同一账号重复抓取到同一条作品时只保留一条；不同账号发布的同一条作品不去重，按账号分别保留（以作品ID 区分）。</p>
    </section>`;
  }
  function wujianV13Library() {
    const tab = v13State().libTab === "monitor" ? "monitor" : "works";
    const tabs = [["works", "待发布作品"], ["monitor", "监控抖音账号"]];
    return `<div class="wujian-page wujian-matrix-page wjv-page">
      <nav class="wjv-lib-tabs" role="tablist" aria-label="作品库分类">${tabs.map(([key, label]) => `<button type="button" class="${tab === key ? "is-active" : ""}" data-wjv-lib-tab="${key}" role="tab" aria-selected="${tab === key ? "true" : "false"}">${escapeHtml(label)}</button>`).join("")}</nav>
      ${tab === "monitor" ? v13LibraryMonitor() : v13LibraryWorks()}
    </div>`;
  }

  function wujianV13MonitorAddModal() {
    if (!v13State().monitorAddOpen) return "";
    const validating = Boolean(v13State().monitorValidating);
    const error = String(v13State().monitorAddError || "");
    const status = validating
      ? `<p class="wjv-form-status is-validating" role="status"><i class="wjv-spinner" aria-hidden="true"></i>正在校验抖音号有效性，请稍候…</p>`
      : error ? `<p class="wjv-form-status is-error" role="alert">${escapeHtml(error)}</p>` : "";
    return `<div class="wjv-modal-backdrop" data-wjv-monitor-add-close></div><section class="wjv-modal wjv-monitor-add-modal" role="dialog" aria-modal="true" aria-labelledby="wjv-monitor-add-title">
      <header><div><span>监控账号</span><h3 id="wjv-monitor-add-title">添加抖音账号</h3><p>输入抖音号后先校验有效性，通过后自动开始监控并首次抓取 15 条作品。</p></div><button type="button" data-wjv-monitor-add-close aria-label="关闭">×</button></header>
      <form class="wjv-monitor-add-form" data-wjv-monitor-add-form>
        <label><span>抖音号</span><input name="handle" value="${escapeHtml(v13State().monitorDraftHandle || "")}" placeholder="例如：hongtu_official" autocomplete="off" ${validating ? "disabled" : "required"}></label>
        <small>支持输入抖音号或带 @ 的账号标识；演示可输入 <code>notfound_demo</code>、<code>banned_demo</code> 查看校验不通过的反馈。</small>
        ${status}
        <footer><button type="button" class="is-primary${validating ? " is-loading" : ""}" data-wjv-monitor-add-submit ${validating ? "disabled" : ""}>${validating ? `<i class="wjv-spinner" aria-hidden="true"></i>校验中…` : "开始监控"}</button><button type="button" data-wjv-monitor-add-cancel>取消</button></footer>
      </form>
    </section>`;
  }

  /* 校验结果返回：通过则加入监控列表并首次抓取 15 条；不通过就地提示原因，账号不进入列表 */
  function v13FinishMonitorAdd(handle) {
    if (!v13State().monitorValidating || v13State().monitorDraftHandle !== handle) return; /* 校验期间已关闭弹窗 */
    const failure = v13MonitorValidateMock(handle);
    if (failure) {
      v13Patch({ monitorValidating: false, monitorAddError: failure });
      refreshWuJianLiveWorkspace();
      if (typeof showToast === "function") showToast("校验未通过", failure);
      return;
    }
    const custom = Array.isArray(v13State().monitors) ? [...v13State().monitors] : [];
    custom.unshift({ id: `ma-${Date.now()}`, name: handle, handle, auto: true, lastSync: "尚未同步", works: 0, syncCount: 1 });
    v13Patch({ monitors: custom, monitorValidating: false, monitorAddOpen: false, monitorDraftHandle: "" });
    const monitor = custom[0];
    const index = v13Monitors().findIndex((item) => item.id === monitor.id);
    const batch = v13CommitMonitorGrab(monitor, index, 0, (result) => `刚刚 · 首次抓取 ${result.accepted.length} 条`);
    refreshWuJianLiveWorkspace();
    if (typeof showToast === "function") showToast("校验通过，已开始监控", `@${handle} 首次抓取 ${batch.accepted.length} 条作品，已进入待发布作品池`);
  }

  /* ---------- 账号作品弹窗 ---------- */
  function wujianV13AccountModal() {
    const openId = v13State().accountWorksOpen;
    if (!openId) return "";
    const index = V13_ACCOUNTS.findIndex((a) => a.id === openId);
    const account = V13_ACCOUNTS[index];
    if (!account) return "";
    const allRows = v13AccountWorks(account.id, index).map((work, workIndex) => ({ ...work, status: v13AccountWorkStatus(account.id, work, workIndex) }));
    const selectedFilters = v13AccountWorkFilters();
    const showAll = selectedFilters.includes("all") || selectedFilters.length === 0;
    const rows = showAll ? allRows : allRows.filter((work) => selectedFilters.includes(work.status));
    const statusFilters = [["all", "全部"], ...V13_ACCOUNT_WORK_FILTERS.map((status) => [status, status])];
    const statusCounts = allRows.reduce((counts, work) => { counts[work.status] = (counts[work.status] || 0) + 1; return counts; }, {});
    const completedCount = statusCounts["发布完成"] || 0;
    const statusTime = (work) => work.status === "发布完成" ? work.publishedAt : work.status === "发布中" ? "正在发布" : work.status === "待发布" ? "待安排" : work.status === "取消发布" ? "已取消" : "发布失败";
    const statusMarkup = (status) => `<span class="wjv-modal-status is-${v13AccountWorkStatusTone(status)}"><i></i>${escapeHtml(status)}</span>`;
    const selectedStatusSet = new Set(selectedFilters);
    const allChecked = showAll;
    const filterMarkup = statusFilters.map(([key, label]) => {
      const checked = key === "all" ? allChecked : allChecked || selectedStatusSet.has(key);
      return `<label class="${checked ? "is-checked" : ""}"><input type="checkbox" data-wjv-account-work-filter="${escapeHtml(key)}"${checked ? " checked" : ""}><span>${escapeHtml(label)}</span><em>${key === "all" ? allRows.length : statusCounts[key] || 0}</em></label>`;
    }).join("");
    return `<div class="wjv-modal-backdrop" data-wjv-modal-close></div><section class="wjv-modal" role="dialog" aria-modal="true" aria-labelledby="wjv-modal-title">
      <header><div><span>发布作品</span><h3 id="wjv-modal-title">${escapeHtml(account.name)}</h3><p>共 ${allRows.length} 条作品 · ${completedCount} 条发布完成 · ${escapeHtml(account.city)}</p></div><button type="button" data-wjv-modal-close aria-label="关闭">×</button></header>
      <div class="wjv-modal-body"><fieldset class="wjv-modal-status-filters"><legend>筛选状态</legend>${filterMarkup}</fieldset><div class="ai-matrix-table"><table><thead><tr><th>封面</th><th>作品标题</th><th>发布状态</th><th>时长</th><th>发布时间</th><th>播放</th><th>点赞</th><th>评论</th><th>收藏</th><th>分享</th><th>操作</th></tr></thead><tbody>${rows.length ? rows.map((w) => { const action = w.status === "待发布" ? `<button type="button" class="wjv-link is-cancel" data-wjv-cancel-account-work="${escapeHtml(account.id)}" data-wjv-account-work-id="${escapeHtml(w.id)}">取消发布</button>` : w.status === "发布失败" ? `<button type="button" class="wjv-link is-retry" data-wjv-retry-account-work="${escapeHtml(account.id)}" data-wjv-account-work-id="${escapeHtml(w.id)}">重试发布</button>` : w.status === "取消发布" ? `<span class="wjv-link is-muted">已取消</span>` : w.link ? `<a class="wjv-link" href="${escapeHtml(w.link)}" target="_blank" rel="noopener noreferrer">打开抖音</a>` : `<span class="wjv-link is-muted">链接同步中</span>`; return `<tr><td>${w.link ? `<a href="${escapeHtml(w.link)}" target="_blank" rel="noopener noreferrer"><img class="wjv-modal-cover" src="${escapeHtml(w.cover)}" alt="${escapeHtml(w.title)}"></a>` : `<img class="wjv-modal-cover" src="${escapeHtml(w.cover)}" alt="${escapeHtml(w.title)}">`}</td><td><strong>${escapeHtml(w.title)}</strong>${w.titleEdited ? `<em class="wjv-modal-edited">用户修改</em>` : ""}</td><td>${statusMarkup(w.status)}</td><td>${escapeHtml(w.duration)}</td><td>${escapeHtml(statusTime(w))}</td><td>${w.plays.toLocaleString()}</td><td>${w.likes.toLocaleString()}</td><td>${w.comments.toLocaleString()}</td><td>${w.favorites.toLocaleString()}</td><td>${w.shares.toLocaleString()}</td><td>${action}</td></tr>`; }).join("") : `<tr><td colspan="11"><div class="wjv-modal-empty">暂无${showAll ? "符合条件" : escapeHtml(selectedFilters.join("、"))}作品</div></td></tr>`}</tbody></table></div></div>
      </section>`;
  }

  /* ---------- 主渲染 ---------- */
  function renderWuJianLiveWorkspace(root) {
    if (!root) return;
    clearWuJianAssetPickerPortal();
    state.selected = "ai-video";
    const activeView = root.closest(".app-view");
    if (activeView) activeView.classList.toggle("wjv-modal-view", Boolean(v13State().accountWorksOpen || v13State().monitorAddOpen));
    const section = ["overview", "publish", "library"].includes(v13State().section) ? v13State().section : "overview";
    v13Patch({ section });
    const tabs = [["publish", "发布任务"], ["overview", "总览"], ["library", "作品库"]];
    const content = section === "publish" ? wujianV13PublishSection() : section === "library" ? wujianV13Library() : wujianV13Overview();
    const workspace = root.querySelector("#demo-live-workspace") || root;
    workspace.innerHTML = `<div class="demo-wujian-live-workspace demo-wujian-matrix-workspace wjv-workspace">
      <nav class="demo-wujian-live-nav" aria-label="短视频运营专员工作区导航"><div><span>短视频运营专员</span><strong>矩阵搬运发布</strong></div><div class="demo-wujian-live-nav-tabs">${tabs.map(([key, label]) => `<button type="button" class="${section === key ? "is-active" : ""}" data-wjv-section="${key}">${escapeHtml(label)}</button>`).join("")}</div></nav>
      <main class="demo-wujian-live-main demo-wujian-matrix-main" data-wjv-content="${escapeHtml(section)}">${content}${wujianV13AccountModal()}${wujianV13MonitorAddModal()}</main>
    </div>`;
    portalWuJianAssetPicker(workspace);
  }
  window.renderWuJianLiveWorkspace = renderWuJianLiveWorkspace;

  function renderWuJianWorkspace() {
    clearWuJianAssetPickerPortal();
    const employee = employees["ai-video"];
    const mode = ["overview", "create", "settings"].includes(state.workspaceMode) ? state.workspaceMode : "overview";
    state.workspaceMode = mode;
    $("#ai-workspace-header").innerHTML = `<div><img src="${employeeImage("ai-video")}" alt="短视频运营专员"><span><small>短视频运营专员</small><strong>短视频运营专员的实时工作台</strong><em><i></i>${statusMeta[getStatus("ai-video")].label} · ${taskText("ai-video")}</em></span></div><div><button type="button" data-open-workspace="settings">Agent 设置</button><button type="button" data-close-workspace aria-label="关闭短视频运营专员工作台">×</button></div>`;
    $("#ai-workspace-tabs").innerHTML = `${[["overview","矩阵看板"],["create","发布任务"]].map((tab) => `<button type="button" class="${mode === tab[0] ? "is-active" : ""}" data-workspace-tab="${tab[0]}">${tab[1]}</button>`).join("")}<span></span><button type="button" class="is-settings" data-workspace-tab="settings">Agent 设置</button>`;
    const content = mode === "create" ? wuJianPublishTaskPage() : mode === "settings" ? workspaceSettings("ai-video") : wuJianMatrixOverviewPage();
    $("#ai-workspace-body").innerHTML = wuJianRealtimeWorkbench(content, mode);
    portalWuJianAssetPicker($("#ai-workspace-body"));
  }
  function openWorkspace(mode) {
    if (state.selected === "supervisor") {
      state.workspaceMode = "overview";
      state.workspaceOpen = true;
      renderWorkspace();
      return;
    }
    if (state.selected === "ai-video") {
      if (mode === "settings") {
        state.sidePanelMode = "overview";
        state.workspaceMode = "settings";
        state.workspaceOpen = true;
        renderWorkspace();
        return;
      }
      if (mode === "overview") {
        closeWorkspace();
        state.sidePanelMode = "overview";
        if (typeof window.markDemoLiveFromOffice === "function") window.markDemoLiveFromOffice("ai-video");
        window.location.hash = "live";
        window.setTimeout(() => {
          if (typeof window.renderDemoLiveJob === "function") window.renderDemoLiveJob("wujian");
        }, 0);
        return;
      }
      state.sidePanelMode = "overview";
      state.workspaceMode = mode === "create" ? "create" : "overview";
      state.workspaceOpen = true;
      renderWorkspace();
      return;
    }
    if (mode === "overview") {
      const employee = state.selected === "smart-reply" ? "chenfu" : state.selected === "lead-hunter-advanced" ? "huangfu" : "xudou";
      closeWorkspace();
      if (typeof window.openXudouRealtimeWorkspace === "function") {
        window.openXudouRealtimeWorkspace(employee);
      } else {
        window.location.hash = "demo-live-xudou";
      }
      return;
    }
    state.workspaceMode = mode || "overview";
    state.workspaceOpen = true;
    renderWorkspace();
  }
  window.openLiveWuJianWorkspace = function () {
    state.selected = "ai-video";
    state.workspaceMode = "overview";
    state.workspaceOpen = true;
    renderWorkspace();
  };
  function closeWorkspace() {
    state.workspaceOpen = false;
    $("#ai-employee-workspace")?.classList.remove("is-open");
    $("#ai-workspace-backdrop")?.classList.remove("is-open");
    $("#ai-employee-workspace")?.setAttribute("aria-hidden", "true");
    $("#ai-workspace-backdrop")?.setAttribute("aria-hidden", "true");
  }
  function renderWorkspace() {
    const overlay = ensureWorkspace();
    const id = state.selected;
    if (id === "ai-video" && !state.workspaceOpen && refreshWuJianLiveWorkspace()) return;
    const wujianSettings = id === "ai-video" && state.workspaceMode === "settings";
    overlay.classList.toggle("is-wujian-fullpage", id === "ai-video" && !wujianSettings);
    overlay.classList.toggle("is-supervisor", id === "supervisor");
    $("#ai-workspace-backdrop").classList.toggle("is-wujian-fullpage", id === "ai-video" && !wujianSettings);
    if (id === "supervisor") {
      $("#ai-workspace-header").innerHTML = `<div><span class="ai-workspace-butler-mark"><strong>AI</strong><small>主理</small></span><span><small>独立业务线经营驾驶舱</small><strong>小班 · 数字团队负责人</strong><em><i></i>在线 · ${hiredIds().length} 条业务线运行中</em></span></div><div><button type="button" data-close-workspace aria-label="关闭小班工作区">×</button></div>`;
      $("#ai-workspace-tabs").innerHTML = "";
      $("#ai-workspace-body").innerHTML = supervisorWorkspaceOverview();
      overlay.classList.add("is-open");
      $("#ai-workspace-backdrop").classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      $("#ai-workspace-backdrop").setAttribute("aria-hidden", "false");
      return;
    }
    const employee = employees[id];
    if (!employee) return;
    if (id === "ai-video" && !wujianSettings) {
      renderWuJianWorkspace();
      overlay.classList.add("is-open");
      $("#ai-workspace-backdrop").classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      $("#ai-workspace-backdrop").setAttribute("aria-hidden", "false");
      return;
    }
    $("#ai-workspace-header").innerHTML = `<div><img src="${escapeHtml(employeeImage(id))}" alt="${employee.name}"><span><small>${employee.role}</small><strong>${employee.name}的工作区</strong><em><i></i>${statusMeta[getStatus(id)].label} · ${taskText(id)}</em></span></div><div><button type="button" data-open-workspace="settings">Agent 设置</button><button type="button" data-close-workspace aria-label="关闭员工工作区">×</button></div>`;
    $("#ai-workspace-tabs").innerHTML = id === "ai-video" && state.workspaceMode === "settings"
      ? `<span></span><button type="button" class="is-settings is-active" data-workspace-tab="settings">Agent 设置</button>`
      : `<button type="button" class="${state.workspaceMode === "overview" ? "is-active" : ""}" data-workspace-tab="overview">${id === "ai-video" ? "矩阵看板" : "工作概览"}</button><button type="button" class="${state.workspaceMode === "detail" ? "is-active" : ""}" data-workspace-tab="${id === "ai-video" ? "create" : "detail"}">${id === "ai-video" ? "发布任务" : "详细工作"}</button><span></span><button type="button" class="is-settings ${state.workspaceMode === "settings" ? "is-active" : ""}" data-workspace-tab="settings">Agent 设置</button>`;
    $("#ai-workspace-body").innerHTML = state.workspaceMode === "settings" ? workspaceSettings(id) : state.workspaceMode === "overview" ? workspaceOverview(id) : workspaceDetail(id);
    overlay.classList.add("is-open");
    $("#ai-workspace-backdrop").classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    $("#ai-workspace-backdrop").setAttribute("aria-hidden", "false");
  }

  function supervisorWorkspaceHumanTasks() {
    const smartReplyWaiting = isHired("smart-reply") && getStatus("smart-reply") === "waiting";
    const authIssues = hiredIds().filter((id) => getStatus(id) === "auth");
    const authTotal = hiredIds().length;
    const authReady = hiredIds().filter((id) => getStatus(id) !== "auth").length;
    const rows = [
      {
        tone: smartReplyWaiting ? "warning" : "ok",
        icon: smartReplyWaiting ? "!" : "✓",
        title: smartReplyWaiting ? "客服待回复 · 2 个价格会话" : "客服回复链路正常",
        copy: smartReplyWaiting ? "客服专员已保留客户上下文，等待确认安全口径后继续回复。" : "当前没有被暂停的客服会话。",
        meta: smartReplyWaiting ? "处理建议：确认一次性回复口径，或人工接管" : "自动回复会在触发敏感承诺时暂停",
        action: smartReplyWaiting ? `<button type="button" data-select-employee="smart-reply">进入客服专员处理</button>` : "",
      },
      {
        tone: authIssues.length ? "danger" : "ok",
        icon: authIssues.length ? "!" : "✓",
        title: authIssues.length ? `授权掉线提醒 · ${authIssues.length} 个账号` : "授权掉线提醒 · 当前正常",
        copy: authIssues.length ? `${authIssues.map((id) => employees[id].name).join("、")} 的账号已掉线，对外操作已暂停。` : `${authReady}/${authTotal || 0} 个员工账号已连接，暂无掉线。`,
        meta: "处理入口：恢复授权后从当前节点继续",
        action: `<button type="button" data-route-link="accounts">管理账号授权</button>`,
      },
      {
        tone: smartReplyWaiting ? "warning" : "ok",
        icon: smartReplyWaiting ? "!" : "✓",
        title: smartReplyWaiting ? "敏感承诺风险 · 特殊优惠" : "敏感承诺风险已受控",
        copy: smartReplyWaiting ? "客户询问比竞品便宜两万，系统已阻止未经确认的价格承诺。" : "特殊优惠、竞品对比等承诺会自动转人工确认。",
        meta: "处理入口：查看依据、确认安全口径或接管会话",
        action: smartReplyWaiting ? `<button type="button" data-select-employee="smart-reply">查看风险依据</button>` : "",
      },
    ];
    return rows.map((row) => `<article class="ai-supervisor-workspace-task is-${row.tone}"><span class="ai-supervisor-workspace-task__icon">${row.icon}</span><div><strong>${row.title}</strong><p>${row.copy}</p><small>${row.meta}</small>${row.action}</div></article>`).join("");
  }

  function supervisorWorkspaceOverview() {
    const employeeCount = hiredIds().length;
    const attentionCount = hiredIds().filter((id) => ["waiting", "auth"].includes(getStatus(id))).length;
    return `<div class="ai-supervisor-workspace"><section class="ai-supervisor-workspace__section is-results">${supervisorSummaryHead("今日经营结果", "小班统一汇总 · 截至 16:20")}<div class="ai-supervisor-workspace__metrics">${supervisorResultCards()}</div></section><section class="ai-supervisor-workspace__section is-business">${supervisorSummaryHead("独立业务线", `${Math.max(0, employeeCount - attentionCount)} 条正常 · ${attentionCount} 条需关注`)}<div class="ai-supervisor-workspace__lines">${supervisorBusinessLineCards()}</div></section><section class="ai-supervisor-workspace__section is-human">${supervisorSummaryHead("需要你决策", attentionCount ? `${attentionCount} 项待处理` : "当前无待办")}<div class="ai-supervisor-workspace__tasks">${supervisorWorkspaceHumanTasks()}</div></section></div>`;
  }
  function memoryRows(id) {
    const rows = state.memories.filter((item) => item.employee === id);
    return rows.length ? rows.slice().reverse().map((item) => `<article class="ai-learning-row${item.mock ? " is-mock" : ""}"><i>${item.mock ? "示" : "✓"}</i><div><strong>${escapeHtml(item.text)}</strong><small>${item.date} · 来源：${escapeHtml(item.source)} · 适用：${escapeHtml(item.scope)}</small></div><button type="button" data-memory-remove="${escapeHtml(item.id)}">撤销</button></article>`).join("") : `<div class="ai-empty-copy">还没有经过确认的长期规则。</div>`;
  }

  function settingsMemoryRows(id) {
    if (id !== "ai-video") return memoryRows(id);
    const rows = state.memories.filter((item) => item.employee === id);
    return rows.length ? rows.slice().reverse().map((item) => `<article class="ai-wujian-memory-row${item.mock ? " is-mock" : ""}"><span>${escapeHtml(item.kind || "长期记忆")}</span><div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.scope)} · 来自作者对话</small></div><button type="button" data-memory-remove="${escapeHtml(item.id)}" aria-label="撤销${escapeHtml(item.kind || "这条记忆")}">×</button></article>`).join("") : `<div class="ai-empty-copy">还没有记住作者的视频风格或发布策略。</div>`;
  }
  function workspaceOverview(id) {
    const employee = employees[id];
    const handoffFrom = ["lead-hunter", "lead-hunter-advanced"].includes(id) ? employee.name : "主号获客专家";
    return `<div class="ai-overview-grid"><section class="ai-overview-hero"><span>今天的工作目标</span><h3>${employee.goal}</h3><p>${taskText(id)}</p><div><i><b style="width:${employee.progress}%"></b></i><strong>${employee.progress}%</strong></div><footer><button type="button" data-open-snapshot>查看连续快照</button><button type="button" data-workspace-tab="detail">进入详细工作</button></footer></section><section class="ai-overview-metrics"><article><small>今日结果</small><strong>${employee.outcome}</strong><em>结果已可追溯</em></article><article><small>今日计费</small><strong>${employee.cost}</strong><em>只记录正式结果</em></article><article><small>使用平台</small><strong>${employee.platform}</strong><em>权限状态正常</em></article><article><small>人工待办</small><strong>${id === "smart-reply" ? "2 项" : "0 项"}</strong><em>${id === "smart-reply" ? "价格口径等待确认" : "现在无需处理"}</em></article></section><section class="ai-overview-block"><header><div><span>最近交接</span><h4>${escapeHtml(handoffFrom)} → 客服专员</h4></div><em>${["lead-hunter", "lead-hunter-advanced"].includes(id) ? "准备交接" : "已接收"}</em></header><dl><div><dt>任务</dt><dd>跟进“华东老陈”的 X70L 试驾意向</dd></div><div><dt>输入资料</dt><dd>客户原话、城市、预算、关注车型和来源视频</dd></div><div><dt>完成标准</dt><dd>确认购车时间或获取有效联系方式</dd></div><div><dt>人工边界</dt><dd>优惠政策不明确时停止发送</dd></div></dl></section><section class="ai-overview-block"><header><div><span>知识、权限和边界</span><h4>这位员工可以做什么</h4></div><button type="button" data-open-workspace="settings">调整</button></header><div class="ai-capability-chips"><span>车型与政策</span><span>门店问答</span><span>${employee.platform}</span><span>特殊承诺需人工</span></div></section><section class="ai-overview-block ai-overview-learning"><header><div><span>记忆与学习记录</span><h4>你教过员工什么</h4></div></header>${memoryRows(id)}</section></div>`;
  }
  function workspaceDetail(id) {
    if (["lead-hunter", "lead-hunter-advanced"].includes(id)) {
      return `<div class="ai-detail-page"><section class="ai-detail-summary"><div><span>${escapeHtml(employees[id].name)}详细工作</span><h3>从直播信号到可跟进线索</h3><p>每一层都可以查看原始证据，不用只相信一个最终数字。</p></div><button type="button" data-open-snapshot>查看正在播放的快照</button></section><section class="ai-funnel"><article><strong>122</strong><span>读取互动</span><small>弹幕、评论、关注</small></article><i>→</i><article><strong>24</strong><span>获取潜客</span><small>提取有效信号</small></article><i>→</i><article><strong>18</strong><span>已触达</span><small>符合触达边界</small></article><i>→</i><article><strong>10</strong><span>已回复</span><small>客户继续沟通</small></article><i>→</i><article><strong>6</strong><span>已留资</span><small>可交给门店</small></article></section><div class="ai-detail-columns"><section class="ai-event-queue"><header><div><span>正在处理</span><h4>实时事件队列</h4></div><em><i></i>自动筛选中</em></header>${[["华东老陈","“15 万左右，X70L 周末能试驾吗？”","高意向","2 分钟前"],["苏州小周","“想看七座，后排空间怎么样？”","中意向","4 分钟前"],["路过的风","“先发份资料看看。”","低意向","6 分钟前"]].map((row) => `<article><span>${row[0].slice(0,1)}</span><div><strong>${row[0]}</strong><p>${row[1]}</p><small>判断依据：车型、预算、试驾和城市表达</small></div><em class="is-${row[2] === "高意向" ? "high" : row[2] === "中意向" ? "medium" : "low"}">${row[2]}<small>${row[3]}</small></em></article>`).join("")}</section><section class="ai-evidence-panel"><span>当前选中证据</span><h4>“15 万左右，X70L 周末能试驾吗？”</h4><dl><div><dt>车型信号</dt><dd>明确提到 X70L</dd></div><div><dt>预算信号</dt><dd>15 万左右</dd></div><div><dt>行动信号</dt><dd>询问周末试驾</dd></div><div><dt>结论</dt><dd>高意向，建议优先询问城市并提供试驾安排</dd></div></dl><button type="button" data-open-workspace="settings">调整意向判断</button></section></div></div>`;
    }
    return `<div class="ai-detail-page"><section class="ai-detail-summary"><div><span>客服专员详细工作</span><h3>客户会话、回复依据和人工介入</h3><p>左边看会话队列，右边看员工判断、引用知识和可执行动作。</p></div><button type="button" data-open-snapshot>查看最近五次会话</button></section><div class="ai-service-detail"><aside>${conversationSnapshots.map((item, index) => `<button type="button" class="${index === 2 ? "is-active" : ""}"><span>${index + 1}</span><div><strong>${item.customer}</strong><small>${item.judgement}</small></div><em>${item.result}</em></button>`).join("")}</aside><section><header><div><strong>客户要求特殊优惠承诺</strong><small>高风险 · 已停止自动发送</small></div><span>等待你</span></header><div class="ai-service-dialog">${dialogueMessage("smart-reply", "user", "你们能保证比别家便宜两万吗？")}${dialogueMessage("smart-reply", "agent", "这类价格承诺需要门店人员确认，我已保留你的问题和车型需求。")}</div><div class="ai-service-reason"><h4>我为什么没有直接发送</h4><dl><div><dt>使用的知识</dt><dd>门店优惠必须以当日政策和顾问确认为准</dd></div><div><dt>触发的边界</dt><dd>客户要求特殊承诺，数字员工不能自行决定</dd></div><div><dt>建议动作</dt><dd>发送一次性说明，或将完整上下文交给销售顾问</dd></div></dl></div><footer><button type="button" data-resolve-waiting>确认安全口径并继续</button><button type="button" data-takeover>我来接管</button></footer></section></div></div>`;
  }

  function settingsAccounts(id) {
    if (["lead-hunter", "lead-hunter-advanced"].includes(id)) {
      try {
        const sourceAccounts = id === "lead-hunter-advanced" && Array.isArray(advancedLeadHunterAccounts) ? advancedLeadHunterAccounts : leadHunterAccounts;
        if (Array.isArray(sourceAccounts)) return sourceAccounts.map((item) => ({
          id: item.id, nickname: item.nickname, account: `抖音 · ${item.account}`, platform: "抖音", enabled: item.enabled,
          canDiscover: Boolean(item.platformAuth), canTouch: Boolean(item.platformAuth && item.marketingAuth),
          authCopy: item.platformAuth && item.marketingAuth ? "平台、营销已授权" : item.platformAuth ? "营销授权待完成" : "平台授权待完成",
        }));
      } catch (error) { /* fall through to the shared account source */ }
    }
    const fallback = {
      douyin: [{ id: "douyin-demo", nickname: "鸿途汽车官方旗舰店", account: "46524370874", auth: { platform: true, marketing: true }, service: { "smart-reply": true } }],
      kuaishou: [{ id: "kuaishou-demo", nickname: "鸿途汽车快手官方号", account: "HTAUTO88", auth: { platform: true }, service: { "smart-reply": true } }],
      xiaohongshu: [{ id: "xhs-demo", nickname: "鸿途汽车品牌号", account: "946238815", auth: { platform: true }, service: { "smart-reply": true } }],
    };
    const source = loadJson(ACCOUNT_KEY, fallback);
    const platformNames = { douyin: "抖音", kuaishou: "快手", xiaohongshu: "小红书" };
    const marketingOnly = id === "ai-video";
    return Object.entries(source).flatMap(([platform, rows]) => (Array.isArray(rows) ? rows : []).map((item) => ({
      id: item.id, nickname: item.nickname, account: `${platformNames[platform] || platform} · ${item.account}`, platform: platformNames[platform] || platform,
      enabled: item.service?.[id] !== false, canDiscover: Boolean(item.auth?.platform),
      canTouch: marketingOnly ? item.auth?.marketing === true : Boolean(item.auth?.platform && item.auth?.marketing !== false),
      authCopy: marketingOnly
        ? (item.auth?.marketing === true ? "营销授权已完成" : "营销授权待完成")
        : !item.auth?.platform ? "平台授权待完成" : item.auth?.marketing === false ? "营销授权待完成" : "平台、营销已授权",
    })));
  }

  function wuJianPublishAccounts(accounts) {
    const source = Array.isArray(accounts) ? accounts.filter((item) => item.platform === "抖音") : [];
    const fallback = [
      { id: "wujian-official", nickname: "鸿途汽车官方旗舰店", account: "抖音 · 鸿途汽车官方旗舰店", platform: "抖音", canTouch: true, authCopy: "营销授权已完成" },
      { id: "wujian-shanghai", nickname: "鸿途汽车上海店", account: "抖音 · 鸿途汽车上海店", platform: "抖音", canTouch: true, authCopy: "营销授权已完成" },
      { id: "wujian-service", nickname: "鸿途汽车内容号", account: "抖音 · 鸿途汽车内容号", platform: "抖音", canTouch: false, authCopy: "营销授权待完成" },
    ];
    fallback.forEach((item) => { if (!source.some((account) => account.nickname === item.nickname)) source.push(item); });
    return source;
  }

  function wuJianAccountPublishConfig(values, nickname) {
    const fallback = {
      mode: values?.publishMode || state.wuJian.publishMode || "review",
      timing: values?.timing || state.wuJian.timing || "now",
      scheduleAt: values?.scheduleAt || state.wuJian.scheduleAt || "2026-08-10T18:30",
    };
    return { ...fallback, ...(values?.publishByAccount?.[nickname] || {}) };
  }

  function wuJianPublishAccountRows() {
    return wuJianPublishAccounts(settingsAccounts("ai-video"));
  }

  function wuJianPublishAccountNames() {
    const ids = new Set(state.wuJian.publishAccountIds || []);
    return wuJianPublishAccountRows().filter((item) => ids.has(item.id)).map((item) => item.nickname);
  }

  function wuJianPublishAccountsMarkup() {
    const accounts = wuJianPublishAccountRows();
    const selected = new Set(state.wuJian.publishAccountIds || []);
    return `<section class="wujian-publish-step wujian-publish-accounts-step"><header><div><span>发布账号</span><strong>这条视频准备发到哪里？</strong><p>可以同时选择多个账号。未完成营销授权的账号也会保留在这里，完成授权后即可使用。</p></div><em>可多选</em></header><div class="wujian-publish-account-list">${accounts.map((item) => { const ready = Boolean(item.canTouch); const isSelected = ready && selected.has(item.id); return `<label class="wujian-publish-account-option${isSelected ? " is-selected" : ""}${ready ? "" : " is-locked"}"><input type="checkbox" data-wujian-publish-account-select="${escapeHtml(item.id)}" ${isSelected ? "checked" : ""} ${ready ? "" : "disabled"}><span class="wujian-publish-account-avatar">${escapeHtml(item.nickname.slice(0, 1))}</span><span class="wujian-publish-account-copy"><strong><span class="wujian-publish-account-name">${escapeHtml(item.nickname)}</span>${ready ? "" : `<em class="wujian-publish-account-inline-state is-pending">${escapeHtml(item.authCopy || "营销授权待完成")}</em>`}</strong><small>${escapeHtml(item.account)}</small></span>${ready ? `<em class="wujian-publish-account-state is-ready">${isSelected ? "已选择" : "可发布"}</em>` : `<button type="button" data-wujian-authorize-account="${escapeHtml(item.id)}">去授权</button>`}</label>`; }).join("") || `<div class="wujian-publish-empty">暂时没有可用账号，请先完成账号授权。</div>`}</div><footer><span>${selected.size ? `已选 ${selected.size} 个账号` : "还没有选择账号"}</span><button type="button" class="is-primary" data-wujian-flow="confirm-publish-accounts">确认账号，继续</button></footer></section>`;
  }

  function wuJianPublishModeMarkup() {
    const mode = state.wuJian.publishModeDraft || "review";
    const timing = state.wuJian.publishTimingDraft || "now";
    const names = wuJianPublishAccountNames();
    return `<section class="wujian-publish-step wujian-publish-mode-step"><header><div><span>发布方式</span><strong>视频做好后，按这个方式处理</strong><p>已选账号：${escapeHtml(names.join("、") || "—")}</p></div><em>第 2 步</em></header><div class="wujian-publish-mode-cards"><button type="button" class="${mode === "review" ? "is-selected" : ""}" data-wujian-publish-mode="review"><strong>审核发布</strong><small>成片做好后先通知你，由你确认后再发布。</small></button><button type="button" class="${mode === "auto" ? "is-selected" : ""}" data-wujian-publish-mode="auto"><strong>自动发布</strong><small>成片做好后按下面的时间自动发出。</small></button></div>${mode === "auto" ? `<div class="wujian-publish-timing"><span>自动发布时机</span><div><button type="button" class="${timing === "now" ? "is-selected" : ""}" data-wujian-publish-timing="now">直接发布</button><button type="button" class="${timing === "scheduled" ? "is-selected" : ""}" data-wujian-publish-timing="scheduled">定时发布</button></div>${timing === "scheduled" ? `<label><span>选择发布时间</span><input type="datetime-local" data-wujian-publish-schedule value="${escapeHtml(state.wuJian.scheduleAt || "2026-08-10T18:30")}"></label>` : ""}</div>` : `<p class="wujian-publish-mode-note">短视频运营专员会在成片完成后把作品报告发回这条对话，等你确认。</p>`}<footer><button type="button" data-wujian-flow="back-publish-accounts">返回修改账号</button><button type="button" class="is-primary" data-wujian-flow="confirm-publish-config">确认发布方式</button></footer></section>`;
  }

  function saveWuJianPublishConfig() {
    const names = wuJianPublishAccountNames();
    const mode = state.wuJian.publishModeDraft || "review";
    const timing = mode === "review" ? "now" : (state.wuJian.publishTimingDraft || "now");
    const scheduleAt = state.wuJian.scheduleAt || "2026-08-10T18:30";
    const settings = { ...defaultSettings["ai-video"], ...(state.settings["ai-video"] || {}) };
    const publishByAccount = { ...(settings.publishByAccount || {}) };
    names.forEach((nickname) => { publishByAccount[nickname] = { mode, timing, scheduleAt }; });
    state.settings["ai-video"] = { ...settings, publishByAccount, publishMode: mode };
    state.wuJian.account = names[0] || state.wuJian.account;
    state.wuJian.publishMode = mode;
    state.wuJian.timing = timing;
    state.wuJian.publishRoute = mode === "review" ? "review" : timing === "scheduled" ? "scheduled" : "auto";
    saveJson(SETTINGS_KEY, state.settings);
  }

  function syncWuJianPublishState() {
    const settings = { ...defaultSettings["ai-video"], ...(state.settings["ai-video"] || {}) };
    const config = wuJianAccountPublishConfig(settings, state.wuJian.account || "鸿途汽车官方旗舰店");
    state.wuJian.publishMode = config.mode;
    state.wuJian.timing = config.timing;
    state.wuJian.scheduleAt = config.scheduleAt;
    return config;
  }

  function settingsStrategy(id, values, accounts, selectedTouch) {
    if (id === "ai-video") {
      const weeklyTarget = Number(values.weeklyTarget) || 4;
      const defaultSlot = values.defaultSlot || "09:00";
      const publishMode = values.publishModeGlobal || "review";
      const targetOptions = [2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${weeklyTarget === n ? "selected" : ""}>${n} 条</option>`).join("");
      const slotOptions = ["09:00", "12:00", "18:00"].map((slot) => `<option value="${slot}" ${defaultSlot === slot ? "selected" : ""}>每天 ${slot}</option>`).join("");
      return `<div class="ai-video-publish-strategy">
        <div class="ai-strategy-intro"><strong>发布策略</strong><small>作为创建发布任务时的默认规则，任务创建页可在本次任务中覆盖。</small></div>
        <div class="ai-video-strategy-grid">
          <label class="ai-video-strategy-field"><span>每周每账号发布目标</span><select name="weeklyTarget">${targetOptions}</select><small>首次配置默认 4 条</small></label>
          <label class="ai-video-strategy-field"><span>默认发布时段</span><select name="defaultSlot">${slotOptions}</select><small>可配置多个时间点错峰发布</small></label>
        </div>
        <div class="ai-video-strategy-field"><span>审核发布方式</span><div class="ai-publish-mode-options" role="radiogroup" aria-label="审核发布方式"><label class="${publishMode === "review" ? "is-selected" : ""}"><input type="radio" name="publishMode" value="review" ${publishMode === "review" ? "checked" : ""}><span>人工审核后发布</span></label><label class="${publishMode === "auto" ? "is-selected" : ""}"><input type="radio" name="publishMode" value="auto" ${publishMode === "auto" ? "checked" : ""}><span>自动发布</span></label></div><small>人工审核模式下，内容先进入待审核，确认后按排期发布。</small></div>
        <div class="ai-strategy-pricing"><span>计费口径</span><strong>¥5 / 账号 / 天</strong><small>当日开启即产生当日费用，次日扣费</small></div>
      </div>`;
    }
    if (!["lead-hunter", "lead-hunter-advanced"].includes(id)) return `<div class="ai-strategy-static"><i>→</i><div><strong>按来访账号原路回复</strong><small>客户从哪个账号发起私信，就由该账号承接，当前岗位不发起主动触达。</small></div><em>固定</em></div>`;
    let relation = null;
    try { relation = id === "lead-hunter-advanced" ? advancedLeadHunterRelation : leadHunterRelation; } catch (error) { /* optional legacy data */ }
    const relationMode = relation?.mode === "main-sub" || relation?.mode === "joint" || relation?.mode === "sub-only" ? "main-sub" : "separate";
    const fixedMode = id === "lead-hunter" ? "separate" : id === "lead-hunter-advanced" ? "main-sub" : null;
    const mode = fixedMode || values.strategyMode || relationMode;
    const eligibleLead = accounts.filter((item) => item.canDiscover);
    const eligibleTouch = accounts.filter((item) => item.canTouch);
    const leadId = values.strategyLead || relation?.leadPoolIds?.[0] || relation?.mainId || eligibleLead[0]?.id || "";
    const normalizedLeadId = eligibleLead.some((item) => item.id === leadId) ? leadId : (eligibleLead[0]?.id || "");
    const touchIds = Array.isArray(values.strategyTouch) ? values.strategyTouch : (relationMode === "main-sub" && relation?.touchPoolIds?.length ? relation.touchPoolIds : selectedTouch);
    const accountCard = (item, type) => `<label class="ai-strategy-account-option ${type === "lead" ? (item.id === normalizedLeadId ? "is-selected" : "") : (touchIds.includes(item.id) ? "is-selected" : "")}"><input type="${type === "lead" ? "radio" : "checkbox"}" name="${type === "lead" ? "strategyLead" : "strategyTouch"}" value="${escapeHtml(item.id)}" ${type === "lead" ? (item.id === normalizedLeadId ? "checked" : "") : (touchIds.includes(item.id) ? "checked" : "")}><span class="ai-strategy-account-avatar">${escapeHtml(item.nickname.slice(0, 1))}</span><span class="ai-strategy-account-copy"><strong>${escapeHtml(item.nickname)}</strong><small>${escapeHtml(item.account)}</small></span><i class="ai-strategy-account-state">${type === "lead" ? "获取" : "触达"}</i></label>`;
    const strategyOptions = fixedMode === "separate"
      ? `<div class="ai-strategy-options" role="radiogroup" aria-label="触达策略"><label class="is-selected"><input type="radio" name="strategyMode" value="separate" data-strategy-mode checked><span><i></i><strong>账号分别触达</strong><small>每个账号只找自己的客户，也只跟进自己的客户，线索不会串到一起。</small></span></label></div><p class="ai-strategy-customer-copy">哪个账号找到客户，就由哪个账号继续聊，客户体验更连贯。</p>`
      : `<div class="ai-strategy-options" role="radiogroup" aria-label="触达策略"><label class="is-selected"><input type="radio" name="strategyMode" value="main-sub" data-strategy-mode checked><span><i></i><strong>主副号触达</strong><small>一个账号负责找客，其他账号按顺序接力跟进。</small></span></label></div><p class="ai-strategy-customer-copy">先从潜客账号池发现客户，再交给触达账号池持续跟进。</p><div class="ai-strategy-pools"><section class="ai-strategy-pool"><header><strong>潜客账号池</strong><span>选 1 个</span></header><div class="ai-strategy-account-list">${eligibleLead.map((item) => accountCard(item, "lead")).join("") || `<div class="ai-empty-copy">暂无可用账号</div>`}</div></section><section class="ai-strategy-pool"><header><strong>触达账号池</strong><span>可多选</span></header><div class="ai-strategy-account-list">${eligibleTouch.map((item) => accountCard(item, "touch")).join("") || `<div class="ai-empty-copy">暂无可用账号</div>`}</div></section></div>`;
    return strategyOptions;
  }

  function humanCollaborationSettings(values) {
    const collaboration = { ...defaultHumanCollaboration, ...(values.humanCollaboration || {}) };
    const selectedRules = new Set(Array.isArray(collaboration.humanHandoffRules) ? collaboration.humanHandoffRules : []);
    const keywords = Array.isArray(collaboration.handoffKeywords) ? collaboration.handoffKeywords : [];
    const ruleRows = humanHandoffRuleGroups.map((group) => `<div class="ai-human-rule-group"><strong>${escapeHtml(group.label)}：</strong><div>${group.items.map((item) => `<label class="ai-human-rule-option"><input type="checkbox" name="humanHandoffRule" value="${escapeHtml(item.value)}" ${selectedRules.has(item.value) ? "checked" : ""}><span>${escapeHtml(item.label)}</span>${item.info ? `<i title="${escapeHtml(item.info)}">?</i>` : ""}</label>`).join("")}</div></div>`).join("");
    const keywordChips = keywords.map((keyword) => `<span class="ai-handoff-keyword"><b>${escapeHtml(keyword)}</b><button type="button" data-remove-handoff-keyword="${escapeHtml(keyword)}" aria-label="移除关键词 ${escapeHtml(keyword)}">×</button><input type="hidden" name="handoffKeyword" value="${escapeHtml(keyword)}"></span>`).join("");
    return `<section class="ai-config-section ai-config-human-collaboration"><header><span class="ai-config-index">06</span><div><h3>人机协同</h3><p>设置客服专员何时暂停自动回复并交给人工，规则只影响客服接待流程。</p></div><em class="ai-human-collaboration-badge">客服专员专属</em></header><div class="ai-human-settings"><div class="ai-human-setting-row"><div><strong>人工转AI设置</strong><small>针对已转人工的消息，如人工在托管时间内不回复，将会自动转回AI接待</small></div><label class="ai-switch"><input type="checkbox" name="humanHandoffEnabled" ${collaboration.humanHandoffEnabled ? "checked" : ""}><i></i><span>${collaboration.humanHandoffEnabled ? "已开启" : "已关闭"}</span></label></div><div class="ai-human-timeout"><label><span>AI托管时间设置</span><input type="number" name="aiHandoffTimeout" min="1" max="999" inputmode="numeric" placeholder="请输入" value="${escapeHtml(collaboration.aiHandoffTimeout || "")}"></label><label class="ai-human-unit"><span class="ai-visually-hidden">托管时间单位</span><select name="aiHandoffTimeoutUnit" aria-label="托管时间单位"><option value="" ${!collaboration.aiHandoffTimeoutUnit ? "selected" : ""}>请选择</option><option value="minutes" ${collaboration.aiHandoffTimeoutUnit === "minutes" ? "selected" : ""}>分钟</option><option value="hours" ${collaboration.aiHandoffTimeoutUnit === "hours" ? "selected" : ""}>小时</option></select></label></div><div class="ai-human-divider"></div><div class="ai-human-setting-title"><strong>AI自动转人工设置</strong><small>命中任一条件后，客服专员会停止发送并保留完整会话上下文。</small></div><div class="ai-human-rule-list">${ruleRows}</div><div class="ai-human-divider"></div><div class="ai-human-setting-row ai-human-setting-row--keyword"><div><strong>关键词转人工</strong><small>客户消息包含关键词时，自动创建人工待办。</small></div><label class="ai-switch"><input type="checkbox" name="keywordHandoffEnabled" ${collaboration.keywordHandoffEnabled ? "checked" : ""}><i></i><span>${collaboration.keywordHandoffEnabled ? "已开启" : "已关闭"}</span></label></div><div class="ai-handoff-keyword-editor"><div class="ai-handoff-keyword-list">${keywordChips}</div><input type="text" data-handoff-keyword-input aria-label="添加转人工关键词" placeholder="输入完成后按回车添加关键词，单个关键词最多8个字符" maxlength="8"></div></div></section>`;
  }

  function videoSettingOptions(id) {
    const employee = employees[id];
    const values = { ...defaultSettings[id], ...(state.settings[id] || {}) };
    const fixedSkills = ["矩阵账号管理", "抖音账号监控", "自动发布", "效果回收"];
    const accounts = wuJianPublishAccounts(settingsAccounts(id));
    const defaultEnabled = accounts.filter((item) => item.enabled !== false && item.canTouch).map((item) => item.id);
    const selectedEnabled = Array.isArray(values.accountEnabled) ? values.accountEnabled : defaultEnabled;
    const permissionRows = accounts.map((item) => {
      const canUse = Boolean(item.canTouch);
      return `<article class="ai-permission-row ${canUse ? "" : "is-unavailable"}"><div class="ai-permission-account"><i>${escapeHtml(item.nickname.slice(0, 1))}</i><span><strong>${escapeHtml(item.nickname)}</strong><small>${escapeHtml(item.account)}</small></span></div><span class="ai-permission-auth ${canUse ? "is-ready" : "is-pending"}"><i>${canUse ? "✓" : "!"}</i>${escapeHtml(item.authCopy)}</span><label class="ai-permission-check ai-permission-check--account"><input type="checkbox" name="accountEnabled" value="${escapeHtml(item.id)}" ${selectedEnabled.includes(item.id) ? "checked" : ""} ${canUse ? "" : "disabled"}><span>启用账号</span></label></article>`;
    }).join("");
    return `<form class="ai-settings-form ai-settings-form--restructured" id="ai-settings-form" data-settings-employee="${id}"><section class="ai-config-section ai-config-identity"><header><span class="ai-config-index">01</span><div><h3>身份</h3><p>定义 Agent 的称呼、头像、人设和说话风格。</p></div></header><div class="ai-identity-layout"><label class="ai-avatar-picker"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}头像" data-agent-avatar-preview><span>更换头像</span><small>JPG、PNG，建议正方形</small><input type="file" accept="image/png,image/jpeg,image/webp" data-agent-avatar-input></label><div class="ai-identity-fields"><label><span>Agent 称呼</span><input type="text" name="displayName" maxlength="12" value="${escapeHtml(values.displayName || employee.name)}"></label><label><span>说话风格</span><select name="tone"><option value="professional" ${values.tone === "professional" ? "selected" : ""}>专业清晰</option><option value="friendly" ${values.tone === "friendly" ? "selected" : ""}>亲切自然</option><option value="clear" ${values.tone === "clear" ? "selected" : ""}>先结论后依据</option><option value="concise" ${values.tone === "concise" ? "selected" : ""}>简短克制</option></select></label><label class="is-full"><span>Agent 人设</span><textarea name="persona" maxlength="160">${escapeHtml(values.persona || "")}</textarea><small>人设影响表达方式，不会改变能力和权限。</small></label></div></div></section><section class="ai-config-section ai-config-skills"><header><span class="ai-config-index">02</span><div><h3>技能</h3><p>这些是 Agent 的固定能力，当前不支持添加、删除或调整。</p></div><em class="ai-readonly-badge">固定 · 不可更改</em></header><div class="ai-fixed-skills">${fixedSkills.map((skill, index) => `<span><i>✓</i><b>${index + 1}</b><strong>${skill}</strong></span>`).join("")}</div></section><section class="ai-config-section ai-config-permissions"><header><span class="ai-config-index">03</span><div><h3>权限</h3><p>只有已完成抖音营销授权的账号可以参与发布。</p></div><button type="button" data-settings-accounts>管理账号授权 ↗</button></header><div class="ai-permission-table"><div class="ai-permission-head"><span>账号</span><span>授权状态</span><span>是否启用</span></div>${permissionRows || `<div class="ai-empty-copy">还没有可用的授权账号。</div>`}</div></section><footer class="ai-settings-footer"><span>保存后，身份和账号范围将在下一次发布任务中生效。</span><button type="submit">保存设置</button></footer></form>`;
  }

  function settingOptions(id) {
    if (id === "ai-video") return videoSettingOptions(id);
    const employee = employees[id];
    const values = { ...defaultSettings[id], ...(state.settings[id] || {}) };
    const fixedSkills = id === "ai-video" ? ["矩阵账号管理", "每周排期", "统一审核", "效果回收"] : FIXED_AGENT_SKILLS;
    const accounts = id === "ai-video" ? wuJianPublishAccounts(settingsAccounts(id)) : settingsAccounts(id);
    const defaultLead = accounts.filter((item) => item.enabled !== false && (id === "ai-video" ? item.canTouch : item.canDiscover)).map((item) => item.id);
    const defaultTouch = accounts.filter((item) => item.enabled && item.canTouch).map((item) => item.id);
    const selectedLead = Array.isArray(values.accountEnabled) ? values.accountEnabled : (Array.isArray(values.accountLead) ? values.accountLead : defaultLead);
    const selectedTouch = selectedLead;
    const permissionRows = accounts.map((item) => { const canUse = id === "ai-video" ? item.canTouch : item.canDiscover; return `<article class="ai-permission-row ${canUse ? "" : "is-unavailable"}"><div class="ai-permission-account"><i>${escapeHtml(item.nickname.slice(0, 1))}</i><span><strong>${escapeHtml(item.nickname)}</strong><small>${escapeHtml(item.account)}</small></span></div><span class="ai-permission-auth ${canUse ? "is-ready" : "is-pending"}"><i>${canUse ? "✓" : "!"}</i>${escapeHtml(item.authCopy)}</span><label class="ai-permission-check ai-permission-check--account"><input type="checkbox" name="accountEnabled" value="${escapeHtml(item.id)}" ${selectedLead.includes(item.id) ? "checked" : ""} ${canUse ? "" : "disabled"}><span>启用账号</span></label></article>`; }).join("");
    const humanSection = id === "smart-reply" ? humanCollaborationSettings(values) : "";
    const memoryIndex = id === "smart-reply" ? "07" : "06";
    return `<form class="ai-settings-form ai-settings-form--restructured" id="ai-settings-form" data-settings-employee="${id}"><section class="ai-config-section ai-config-identity"><header><span class="ai-config-index">01</span><div><h3>身份</h3><p>定义 Agent 的称呼、头像、人设和说话风格。</p></div></header><div class="ai-identity-layout"><label class="ai-avatar-picker"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}头像" data-agent-avatar-preview><span>更换头像</span><small>JPG、PNG，建议正方形</small><input type="file" accept="image/png,image/jpeg,image/webp" data-agent-avatar-input></label><div class="ai-identity-fields"><label><span>Agent 称呼</span><input type="text" name="displayName" maxlength="12" value="${escapeHtml(values.displayName || employee.name)}"></label><label><span>说话风格</span><select name="tone"><option value="professional" ${values.tone === "professional" ? "selected" : ""}>专业清晰</option><option value="friendly" ${values.tone === "friendly" ? "selected" : ""}>亲切自然</option><option value="clear" ${values.tone === "clear" ? "selected" : ""}>先结论后依据</option><option value="concise" ${values.tone === "concise" ? "selected" : ""}>简短克制</option></select></label><label class="is-full"><span>Agent 人设</span><textarea name="persona" maxlength="160">${escapeHtml(values.persona || "")}</textarea><small>人设影响表达方式，不会改变能力和权限。</small></label></div></div></section><section class="ai-config-section ai-config-knowledge"><header><span class="ai-config-index">02</span><div><h3>知识库</h3><p>展示当前关联的知识类型，内容需到对应知识库中修改。</p></div></header><div class="ai-knowledge-links"><button type="button" data-settings-knowledge="dialog"><i>${id === "ai-video" ? "稿" : "话"}</i><span><strong>${id === "ai-video" ? "视频内容规则" : "对话策略"}</strong><small>${id === "ai-video" ? "品牌口径、文案规范、禁用表达" : "人设、工作时间、标准回复、门店问答"}</small></span><em>已关联 <b>↗</b></em></button><button type="button" data-settings-knowledge="vehicles"><i>车</i><span><strong>车型库</strong><small>${id === "ai-video" ? "在售车型、配置参数、素材与版权" : "在售车型、门店价、优惠和补贴政策"}</small></span><em>已关联 <b>↗</b></em></button></div></section><section class="ai-config-section ai-config-skills"><header><span class="ai-config-index">03</span><div><h3>技能</h3><p>这些是 Agent 的固定能力，当前不支持添加、删除或调整。</p></div><em class="ai-readonly-badge">固定 · 不可更改</em></header><div class="ai-fixed-skills">${fixedSkills.map((skill, index) => `<span><i>✓</i><b>${index + 1}</b><strong>${skill}</strong></span>`).join("")}</div></section><section class="ai-config-section ai-config-permissions"><header><span class="ai-config-index">04</span><div><h3>权限</h3><p>只有已完成授权的账号可以被选择，按账号决定 Agent 执行。</p></div><button type="button" data-settings-accounts>管理账号授权 ↗</button></header><div class="ai-permission-table"><div class="ai-permission-head"><span>账号</span><span>授权状态</span><span>是否启用</span></div>${permissionRows || `<div class="ai-empty-copy">还没有可用的授权账号。</div>`}</div></section><section class="ai-config-section ai-config-strategy"><header><span class="ai-config-index">05</span><div><h3>策略</h3><p>${id === "ai-video" ? "设置每周发布目标、默认发布时段与审核发布方式，任务创建页可覆盖默认值。" : "配置账号分别触达，或按主副号分工挖掘与触达。"}</p></div></header>${settingsStrategy(id, values, accounts, selectedTouch)}</section>${humanSection}<section class="ai-config-section ai-config-memory"><header><span class="ai-config-index">${memoryIndex}</span><div><h3>记忆</h3><p>${id === "ai-video" ? "短视频运营专员会从发布对话中，沉淀稳定的发布策略并作用于后续任务。" : "已确认的长期规则会持久保留，也可通过 Agent 对话补充或撤销。"}</p></div><button type="button" data-settings-chat>与 ${escapeHtml(employee.name)} 对话添加</button></header><div class="ai-memory-examples"><span>${id === "ai-video" ? "发布策略" : "潜客意向"}</span><span>${id === "ai-video" ? "发布时段" : "触达话术"}</span><span>${id === "ai-video" ? "账号范围" : "人工确认"}</span><span>${id === "ai-video" ? "错峰间隔" : "报告规则"}</span></div><div class="ai-memory-list">${settingsMemoryRows(id)}</div></section><footer class="ai-settings-footer"><span>保存后，身份、账号范围和发布策略将在下一次任务中生效。</span><button type="submit">保存设置</button></footer></form>`;
  }
  function workspaceSettings(id) {
    const employee = employees[id];
    const status = statusMeta[getStatus(id)];
    return `<div class="ai-settings-page ai-settings-page--restructured"><header class="ai-settings-agent"><img src="${escapeHtml(employeeImage(id))}" alt="${escapeHtml(employee.name)}"><div><span>Agent 设置</span><h2>${escapeHtml(employee.name)}</h2><p>${escapeHtml(employee.role)} · ${escapeHtml(taskText(id))}</p></div><em><i></i>${escapeHtml(status.label)}</em></header>${settingOptions(id)}</div>`;
  }

  function ensureSnapshotOverlay() {
    if ($("#ai-snapshot-overlay")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="ai-overlay" id="ai-snapshot-overlay" aria-hidden="true"><section class="ai-snapshot-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-snapshot-title"><header><div><span>工作片段 · 最近一次工作</span><h3 id="ai-snapshot-title">连续工作片段</h3><p id="ai-snapshot-subtitle">桌面操作步骤会按顺序播放</p></div><button type="button" data-close-snapshot aria-label="关闭工作片段">×</button></header><div id="ai-snapshot-content"></div><footer><div><button type="button" data-snapshot-prev>← 上一步</button><button type="button" data-snapshot-toggle>暂停播放</button><button type="button" data-snapshot-next>下一步 →</button></div><div class="ai-snapshot-timeline" id="ai-snapshot-timeline"></div></footer></section></div>`);
  }
  function openSnapshot() {
    if (state.selected === "supervisor") state.snapshot.employee = isHired("lead-hunter") ? "lead-hunter" : hiredIds()[0]; else state.snapshot.employee = state.selected;
    if (!state.snapshot.employee) return;
    state.snapshot.index = 0;
    ensureSnapshotOverlay();
    $("#ai-snapshot-overlay").classList.add("is-open");
    $("#ai-snapshot-overlay").setAttribute("aria-hidden", "false");
    renderSnapshot();
    startSnapshot();
  }
  function closeSnapshot() { stopSnapshot(); $("#ai-snapshot-overlay")?.classList.remove("is-open"); $("#ai-snapshot-overlay")?.setAttribute("aria-hidden", "true"); }
  function startSnapshot() {
    stopSnapshot();
    state.snapshot.playing = true;
    state.snapshot.timer = window.setInterval(() => { state.snapshot.index = (state.snapshot.index + 1) % (state.snapshot.employee === "smart-reply" ? conversationSnapshots.length : snapshotFrames.length); renderSnapshot(); }, 1450);
    renderSnapshot();
  }
  function stopSnapshot() { if (state.snapshot.timer) window.clearInterval(state.snapshot.timer); state.snapshot.timer = null; state.snapshot.playing = false; }
  function seekSnapshot(index) {
    const length = state.snapshot.employee === "smart-reply" ? conversationSnapshots.length : snapshotFrames.length;
    state.snapshot.index = (Number(index) + length) % length;
    renderSnapshot();
  }
  function renderSnapshot() {
    const content = $("#ai-snapshot-content");
    const timeline = $("#ai-snapshot-timeline");
    if (!content || !timeline) return;
    const id = state.snapshot.employee;
    const employee = employees[id];
    $("#ai-snapshot-title").textContent = `${employee.name}的连续工作快照`;
    if (id === "smart-reply") {
      const item = conversationSnapshots[state.snapshot.index];
      $("#ai-snapshot-subtitle").textContent = `会话快照 · 节点 ${state.snapshot.index + 1} / ${conversationSnapshots.length} · 每 1.45 秒自动切换`;
      content.innerHTML = `<div class="ai-conversation-snapshot"><aside>${conversationSnapshots.map((row, index) => `<span class="${index === state.snapshot.index ? "is-active" : ""}"><i>${index + 1}</i><strong>${row.result}</strong><small>${row.judgement}</small></span>`).join("")}</aside><section><span>最近一次会话</span><div class="ai-conversation-preview">${dialogueMessage("smart-reply", "user", item.customer)}${dialogueMessage("smart-reply", "agent", item.reply)}</div><dl><div><dt>员工判断</dt><dd>${escapeHtml(item.judgement)}</dd></div><div><dt>最终结果</dt><dd>${escapeHtml(item.result)}</dd></div></dl><em><i></i>会话快照 · ${item.result}</em></section></div>`;
      timeline.innerHTML = conversationSnapshots.map((row, index) => `<button type="button" class="${index === state.snapshot.index ? "is-active" : ""}" data-snapshot-frame="${index}" aria-label="查看第 ${index + 1} 个会话快照"><span>${index + 1}</span><small>${row.result}</small></button>`).join("");
    } else {
      const item = snapshotFrames[state.snapshot.index];
      $("#ai-snapshot-subtitle").textContent = `桌面操作步骤 · ${item.time} · 步骤 ${state.snapshot.index + 1} / ${snapshotFrames.length}`;
      content.innerHTML = `<div class="ai-work-snapshot"><div class="ai-work-frame"><img src="${FRAME_PATH}${item.file}.jpg" alt="${escapeHtml(item.action)}"><span><i></i>工作中</span><footer><strong>${escapeHtml(item.action)}</strong><em>${item.status} · ${item.time}</em></footer></div><aside><span>这一步做了什么</span><h4>${escapeHtml(item.action)}</h4><dl><div><dt>当前员工</dt><dd>${escapeHtml(digitalEmployeeLabel(employee))}</dd></div><div><dt>工作来源</dt><dd>桌面工作任务 · 0804</dd></div><div><dt>结果状态</dt><dd>${item.status}</dd></div></dl><p>这是最近一次演示操作，用来说明员工怎么完成桌面工作，不代表真实平台的当前画面。</p></aside></div>`;
      timeline.innerHTML = snapshotFrames.map((frame, index) => `<button type="button" class="${index === state.snapshot.index ? "is-active" : ""}" data-snapshot-frame="${index}" aria-label="查看第 ${index + 1} 张快照"><img src="${FRAME_PATH}${frame.file}.jpg" alt=""><span>${String(index + 1).padStart(2, "0")}</span></button>`).join("");
    }
    const toggle = $("[data-snapshot-toggle]");
    if (toggle) toggle.textContent = state.snapshot.playing ? "暂停播放" : "继续播放";
  }

  const legacyTalentIds = [
    "live-control", "gold-sales", "xhs-intent-comment", "kuaishou-leads", "lead-chaser", "data-cleaner",
    "wecom-marketing", "xhs-notes", "content-distribution", "platform-report", "xhs-customer-search", "sales-assistant",
  ];
  const legacyTalentProfiles = {
    "live-control": { fixed: "读弹幕 → 控节奏 → 回评 → 沉淀线索", adjust: "直播目标、互动策略和人工接管边界", boundary: "敏感内容、优惠承诺和公开播报需人工确认" },
    "gold-sales": { fixed: "识别沉默客户 → 匹配内容 → 触达 → 记录结果", adjust: "挽回时机、触达内容和跟进频率", boundary: "价格承诺、客户投诉和销售交接需人工确认" },
    "xhs-intent-comment": { fixed: "读取评论 → 识别意向 → 回复 → 沉淀线索", adjust: "意向判断、回复风格和转人工规则", boundary: "敏感评论、价格承诺和批量回复需人工确认" },
    "kuaishou-leads": { fixed: "读取互动 → 提取信号 → 首轮触达 → 回传结果", adjust: "意向判断、权益话术和触达范围", boundary: "权益承诺、批量发送和低置信度客户需人工确认" },
    "lead-chaser": { fixed: "合并行为 → 补全画像 → 判断时机 → 跟进提醒", adjust: "跟进时机、客户分层和提醒频率", boundary: "跨平台身份合并、敏感客户和外发内容需人工确认" },
    "data-cleaner": { fixed: "读取记录 → 去重 → 补全 → 质量校验", adjust: "字段规则、异常阈值和输出格式", boundary: "删除记录、覆盖原数据和异常批次需人工确认" },
    "wecom-marketing": { fixed: "客户分层 → 生成内容 → 企微触达 → 提醒销售", adjust: "触达节奏、内容风格和客户分组", boundary: "批量触达、敏感客户和退订处理需人工确认" },
    "xhs-notes": { fixed: "选题 → 写作 → 配图建议 → 发布回收", adjust: "内容重点、平台语气和发布时间", boundary: "品牌敏感词、对外发布和素材版权需人工确认" },
    "ai-video": { fixed: "接入账号 → 发布计划 → 审核排期 → 发布 → 效果回收", adjust: "账号组、每周发布目标、审核方式、发布时段、内容来源", boundary: "车型事实、素材版权、公开承诺和发布动作需人工确认" },
    "content-distribution": { fixed: "读取原稿 → 平台改写 → 排期 → 回收数据", adjust: "平台版本、发布时间和分发范围", boundary: "品牌口径、批量发布和异常账号需人工确认" },
    "platform-report": { fixed: "汇总数据 → 对齐口径 → 发现异常 → 生成日报", adjust: "统计维度、提醒阈值和日报重点", boundary: "修改原始数据、异常结论和对外报告需人工确认" },
    "xhs-customer-search": { fixed: "搜索笔记 → 判断需求 → 合规触达 → 回传线索", adjust: "搜索范围、意向标准和触达话术", boundary: "主动私信、个人信息和批量触达需人工确认" },
    "sales-assistant": { fixed: "读取客户资料 → 组合车型方案 → 生成跟进包 → 交给销售", adjust: "方案重点、跟进节奏和输出格式", boundary: "报价、优惠承诺和客户外发内容需人工确认" },
  };
  function sourceTalent(id) {
    try { return typeof displayEmployeeById === "function" ? displayEmployeeById(id) : null; } catch (error) { return null; }
  }
  function rawTalent(id) {
    try { return typeof employeeById === "function" ? employeeById(id) : null; } catch (error) { return null; }
  }
  function legacyTalentData(id) {
    const source = rawTalent(id) || {};
    const display = sourceTalent(id) || {};
    const profile = legacyTalentProfiles[id] || {};
    return {
      id,
      name: source.persona || source.name || id,
      role: source.role || source.name || "数字员工",
      description: source.description || "岗位上线后，将按固定流程完成工作并回传结果。",
      fixed: profile.fixed || "读取任务 → 执行岗位流程 → 回传结果",
      adjust: profile.adjust || "工作重点、沟通方式和执行节奏",
      boundary: profile.boundary || "对外发送、敏感信息和长期规则需人工确认",
      price: source.price && source.price !== "敬请期待" ? source.price : "岗位上线后计费",
      image: display.image || source.image || employeeImage(id),
      sample: source.mission || "岗位上线后开始承接对应工作。",
      unavailable: true,
    };
  }
  function talentData() {
    const active = [
      { id: "lead-hunter", name: "主号获客专家", role: "主号获客专家", description: "从抖音弹幕、评论和关注信号中发现潜客，完成意向判断、首轮触达和结果回传。", fixed: "获取 → 判断 → 触达 → 留资", adjust: "意向判断、话术内容和风格", boundary: "优惠承诺和批量发送前请你确认", price: "¥7 / 有效线索" },
      { id: "lead-hunter-advanced", name: "副号获客专家", role: "副号获客专家", description: "一个账号池专门找客，另一个账号池接力跟进，线索不混淆、每条都有承接。", fixed: "获取 → 判断 → 触达 → 留资", adjust: "意向判断、话术内容和风格", boundary: "优惠承诺和批量发送前请你确认", price: "¥7 / 有效线索" },
      { id: "smart-reply", name: "客服专员", role: "客服专员", description: "接住抖音、快手和小红书私信，引用门店知识回复，遇到特殊承诺交给人工。", fixed: "接收 → 理解 → 查知识 → 回复/转人工", adjust: "回复风格、判断和转人工规则", boundary: "价格承诺、低置信度和敏感内容请你确认", price: "¥5 / 天" },
      { id: "ai-video", name: "短视频运营专员", role: "短视频运营专员", description: "统一管理客户在抖音的账号矩阵，按每周发布计划持续排期与发布，并回收播放、互动和线索效果。", fixed: "接入账号 → 发布计划 → 审核排期 → 发布 → 效果回收", adjust: "账号组、每周发布目标、审核方式、发布时段、内容来源", boundary: "车型事实、素材版权、公开承诺和发布动作需人工确认", price: "¥5 / 账号 / 天", image: employeeImage("ai-video") },
    ];
    return active.concat(legacyTalentIds.map(legacyTalentData));
  }
  function renderTalentPage() {
    const view = $("[data-view='plaza']");
    if (!view) return;
    // The PRD grid is the single talent-market surface. Keep the legacy shell
    // out of the layout so it cannot compete with the live card renderer.
    view.classList.remove("ai-talent-redesigned");
    const legacy = $(".ai-talent-shell", view);
    if (legacy) {
      legacy.hidden = true;
      legacy.setAttribute("aria-hidden", "true");
    }
    if (typeof window.renderTalentCards === "function") window.renderTalentCards("all");
    $$(".prd-talent-card", view).forEach((card) => {
      const signal = $(".talent-scene__signal", card);
      const badge = $(".talent-card__eyebrow > em", card);
      if (!signal || !badge) return;
      badge.textContent = signal.classList.contains("is-coming-soon") ? "待上线" : signal.textContent.includes("在线工作") ? "已雇佣" : "可雇佣";
    });
  }

  function ensureOnboarding() {
    if ($("#ai-onboarding-overlay")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="ai-overlay" id="ai-onboarding-overlay" aria-hidden="true"><section class="ai-onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-onboarding-title"><header><div><span>引导式 Agent 入职</span><h3 id="ai-onboarding-title">员工入职</h3><p>每一步只做一个明确决定，不需要自己写提示词。</p></div><button type="button" data-close-onboarding aria-label="关闭 Agent 入职引导">×</button></header><div class="ai-onboarding-progress" id="ai-onboarding-progress"></div><div class="ai-onboarding-body" id="ai-onboarding-body"></div><footer id="ai-onboarding-footer"></footer></section></div>`);
  }
  function openOnboarding(id, step) {
    state.onboarding.employee = id;
    state.onboarding.step = Math.max(0, Math.min(4, Number(step) || 0));
    state.onboarding.goal = state.settings[id]?.goal || defaultSettings[id].goal;
    state.onboarding.testResult = "";
    ensureOnboarding();
    $("#ai-onboarding-overlay").classList.add("is-open");
    $("#ai-onboarding-overlay").setAttribute("aria-hidden", "false");
    renderOnboarding();
  }
  function closeOnboarding() { $("#ai-onboarding-overlay")?.classList.remove("is-open"); $("#ai-onboarding-overlay")?.setAttribute("aria-hidden", "true"); }
  function onboardingGoals(id) {
    if (["lead-hunter", "lead-hunter-advanced"].includes(id)) return [["trial","优先找明确试驾的客户"],["price","优先找询价和问优惠的客户"],["model","优先找关注 X70L 的客户"]];
    if (id === "ai-video") return [["conversion","优先生成能带来试驾线索的视频"],["product","优先讲清车型卖点和真实体验"],["brand","优先产出品牌质感和车型形象片"]];
    return [["reply","先保证客户的问题有回复"],["lead","优先发现值得销售跟进的客户"],["handoff","优先拦住价格承诺等高风险回复"]];
  }
  function trialResult(id, text) {
    if (["lead-hunter", "lead-hunter-advanced"].includes(id)) {
      const signals = [/预算|\d+\s*万/.test(text) ? "预算" : "", /试驾|到店|周末/.test(text) ? "行动" : "", /X70L|车|车型/.test(text) ? "车型" : "", /上海|苏州|杭州|城市/.test(text) ? "城市" : ""].filter(Boolean);
      const level = signals.length >= 3 ? "高意向" : signals.length >= 2 ? "中意向" : "低意向";
      return `<section class="ai-trial-result"><span>意向判断</span><h4>${level}</h4><dl><div><dt>识别到的信号</dt><dd>${signals.length ? signals.join("、") : "暂时没有识别到明确购车信号"}</dd></div><div><dt>判断依据</dt><dd>${signals.length >= 3 ? "同时包含车型、预算和行动意图，值得优先跟进。" : "信号还不足，建议先补问城市、预算或试驾时间。"}</dd></div><div><dt>建议触达</dt><dd>你好，看到你在关注 X70L。你在哪个城市？我可以帮你查附近门店和可预约的试驾时间。</dd></div></dl></section>`;
    }
    if (id === "ai-video") {
      const vehicle = /T9/i.test(text) ? "风云 T9" : /瑶光/.test(text) ? "星途瑶光" : "星途 E7";
      const theme = /续航/.test(text) ? "真实续航挑战" : /座舱|智能/.test(text) ? "智能座舱体验" : "后排空间真人实测";
      return `<section class="ai-trial-result"><span>创作试用</span><h4>${escapeHtml(vehicle)} · ${escapeHtml(theme)}</h4><dl><div><dt>3 秒钩子</dt><dd>${theme === "后排空间真人实测" ? "1 米 85 坐进后排，膝部到底还剩几拳？" : theme === "真实续航挑战" ? "满电跑完真实通勤路线，到底还剩多少续航？" : "当城市入夜，车内每一束光都在回应你。"}</dd></div><div><dt>建议结构</dt><dd>问题钩子 → 真人/实车验证 → 车型事实 → 评论或试驾行动</dd></div><div><dt>生成配置</dt><dd>9:16 · 30 秒 · Seedance 2.5 · 真实汽车测评</dd></div><div><dt>人工边界</dt><dd>未确认车型数据、音乐版权和公开发布必须人工确认。</dd></div></dl></section>`;
    }
    const risky = /保证|便宜|最低价|承诺/.test(text);
    const reply = risky ? "这类价格承诺需要门店人员确认，我已保留你的需求和会话上下文。" : "我可以先说明官方指导价和已确认的门店信息。你告诉我城市后，我再帮你匹配门店和试驾时间。";
    return `<section class="ai-trial-result"><span>试聊结果</span><h4>${risky ? "已触发人工确认" : "可以安全回复"}</h4><div class="ai-trial-dialogue">${dialogueMessage("smart-reply", "user", text)}${dialogueMessage("smart-reply", "agent", reply)}</div><dl><div><dt>客户问题</dt><dd>${escapeHtml(text)}</dd></div><div><dt>回复建议</dt><dd>${escapeHtml(reply)}</dd></div><div><dt>使用依据</dt><dd>车型库、门店营业时间、试驾政策和价格承诺边界</dd></div></dl></section>`;
  }
  function renderOnboarding() {
    const { employee: id, step } = state.onboarding;
    const employee = employees[id];
    $("#ai-onboarding-title").textContent = `${digitalEmployeeLabel(employee)}入职`;
    const labels = ["选工作重点", "看流程和边界", "检查工作条件", ["lead-hunter", "lead-hunter-advanced"].includes(id) ? "模拟判断" : id === "ai-video" ? "创作试用" : "客服试聊", "确认到岗"];
    $("#ai-onboarding-progress").innerHTML = labels.map((label, index) => `<span class="${index === step ? "is-active" : index < step ? "is-done" : ""}"><i>${index < step ? "✓" : index + 1}</i><strong>${label}</strong></span>`).join("");
    const body = $("#ai-onboarding-body");
    if (step === 0) body.innerHTML = `<section class="ai-onboarding-step"><span>第 1 步</span><h4>你希望${employee.name}先把哪个结果做好？</h4><p>不需要自己写目标，从当前产品真正支持的范围中选择。</p><div class="ai-onboarding-choices">${onboardingGoals(id).map((item) => `<button type="button" class="${state.onboarding.goal === item[0] ? "is-selected" : ""}" data-onboarding-goal="${item[0]}"><i></i><strong>${item[1]}</strong><small>可以在 Agent 设置中继续调整</small></button>`).join("")}</div></section>`;
    if (step === 1) body.innerHTML = `<section class="ai-onboarding-step"><span>第 2 步</span><h4>先看清员工会怎么工作</h4><p>固定流程不支持随意修改；你只需要调整判断、话术和人工边界。</p><div class="ai-onboarding-boundary"><section><header><strong>固定流程</strong><em>只读</em></header>${employee.fixedFlow.map((item, index) => `<span><i>${index + 1}</i>${item}</span>`).join("")}</section><section><header><strong>可以调整</strong><em>可编辑</em></header>${employee.adjustable.map((item) => `<span><i>✓</i>${item}</span>`).join("")}</section></div></section>`;
    if (step === 2) body.innerHTML = `<section class="ai-onboarding-step"><span>第 3 步</span><h4>${employee.name}的工作条件已经准备好</h4><p>系统已经把原来的后台配置转成员工能不能开始工作的结果。</p><div class="ai-dependency-list">${(id === "ai-video" ? [["抖音账号和发布授权","已完成"],["车型库与审核图片","4 款车型可用"],["角色与音乐版权","已记录授权"],["工作余额","当前 ¥12,680.40"],["发布审核边界","审核发布"]] : [["平台账号和授权","已完成"],["车型与政策知识","已可用"],["门店问答和沟通风格","已可用"],["工作余额","当前 ¥12,680.40"],["人工确认边界","已设置"]]).map((item) => `<article><i>✓</i><div><strong>${item[0]}</strong><small>${item[1]}</small></div><em>可以工作</em></article>`).join("")}</div><div class="ai-dependency-links"><button type="button" data-route-link="knowledge">查看知识库</button><button type="button" data-route-link="accounts">查看账号授权</button></div></section>`;
    if (step === 3) { const leadEmployee = ["lead-hunter", "lead-hunter-advanced"].includes(id); body.innerHTML = `<section class="ai-onboarding-step"><span>第 4 步</span><h4>${leadEmployee ? "用一条模拟弹幕看意向判断" : id === "ai-video" ? "给短视频运营专员一个汽车视频目标" : "和客服专员试聊一次"}</h4><p>${leadEmployee ? "获客 Agent 不适合空聊，这里直接模拟真实弹幕。" : id === "ai-video" ? "输入车型和主题，查看短视频运营专员如何生成钩子、结构、配置和人工边界。" : "客服 Agent 会显示回答、知识依据和是否需要转人工。"}</p><div class="ai-onboarding-trial"><label><span>${leadEmployee ? "模拟弹幕" : id === "ai-video" ? "创作目标" : "客户问题"}</span><input id="ai-onboarding-trial-input" type="text" value="${leadEmployee ? "15 万预算，想周末试驾 X70L，上海有车吗？" : id === "ai-video" ? "为星途 E7 做一条 30 秒后排空间实测，吸引家庭用户预约试驾" : "你们能保证比别家便宜两万吗？"}"></label><button type="button" data-run-onboarding-trial>${leadEmployee ? `让${employee.name}判断` : id === "ai-video" ? "让短视频运营专员出方案" : "让客服专员回答"}</button></div><div id="ai-onboarding-trial-output">${state.onboarding.testResult}</div></section>`; }
    if (step === 4) body.innerHTML = `<section class="ai-onboarding-step ai-onboarding-complete"><i>✓</i><span>第 5 步</span><h4>${employee.name}已经准备好</h4><p>确认后，${employee.name}会按固定流程工作，并使用你选择的重点、判断和执行规则。</p><dl><div><dt>岗位</dt><dd>${employee.role}</dd></div><div><dt>工作重点</dt><dd>${onboardingGoals(id).find((item) => item[0] === state.onboarding.goal)?.[1] || onboardingGoals(id)[0][1]}</dd></div><div><dt>必须请示</dt><dd>${id === "ai-video" ? "车型事实未确认、素材版权异常、额外验证和公开发布" : "优惠承诺、批量发送、低置信度和长期规则"}</dd></div></dl></section>`;
    $("#ai-onboarding-footer").innerHTML = `<button type="button" data-onboarding-back ${step === 0 ? "disabled" : ""}>返回</button><span>${step + 1} / 5</span>${step < 4 ? `<button class="is-primary" type="button" data-onboarding-next>继续：${labels[step + 1]} →</button>` : `<button type="button" data-onboarding-retry>再试一次</button><button class="is-primary" type="button" data-confirm-hire>${isHired(id) ? "保存校准并回到办公室" : "让他开始工作"}</button>`}`;
  }

  function decorateResults() {
    const view = $("[data-view='results']");
    if (!view || $(".ai-results-analysis", view)) return;
    const panel = document.createElement("section");
    panel.className = "ai-results-analysis";
    panel.innerHTML = `<header><div><span>AI 管家 · 动态分析</span><h3>用简单问法改变看结果的方式</h3><p>只改变维度、排序和表达，不改变原始业务数据。</p></div><em>数据更新：2026-07-13 23:59</em></header><form id="ai-results-analysis-form"><input id="ai-results-analysis-input" type="text" value="只看 X70L 的高意向线索" aria-label="输入成果分析问题"><button type="submit">让 AI 管家分析</button></form><div class="ai-analysis-presets"><button type="button" data-analysis-preset="只看 X70L 的高意向线索">只看高意向</button><button type="button" data-analysis-preset="按平台对比留资率">按平台对比</button><button type="button" data-analysis-preset="把团队日报改成给老板看的摘要">改成老板摘要</button><button type="button" data-analysis-preset="按员工对比今日结果">按员工对比</button></div><div id="ai-analysis-output"></div>`;
    const heading = $(".view-heading", view);
    if (heading) heading.insertAdjacentElement("afterend", panel); else view.insertAdjacentElement("afterbegin", panel);
    renderAnalysis("只看 X70L 的高意向线索");
  }
  function renderAnalysis(query) {
    const output = $("#ai-analysis-output");
    if (!output) return;
    let title = "X70L 高意向线索";
    let conclusion = "昨日找到 6 位 X70L 高意向客户，其中 4 位明确提到试驾，2 位同时提到预算和城市。建议今日先跟进这4位试驾客户。";
    let rows = [["明确试驾",4,100],["有预算和城市",2,50],["已完成留资",2,50]];
    let conditions = "车型 = X70L；意向 = 高；日期 = 2026-07-13";
    if (/平台/.test(query)) { title = "各平台留资率对比"; conclusion = "抖音带来的线索最多，小红书的留资率更高。如果目标是短期增量，继续优先抖音；如果目标是提升效率，可以补充小红书高意向内容。"; rows = [["抖音",6,100],["小红书",3,72],["快手",1,35]]; conditions = "按平台汇总；指标 = 留资人数 / 已回复人数"; }
    if (/老板|摘要/.test(query)) { title = "给老板看的团队摘要"; conclusion = "昨日 2 位数字员工共完成 326 次业务动作，带回 14 条有效线索，费用 ¥126。当前最大风险是 2 个价格口径等待人工确认，建议今日优先处理。"; rows = [["业务动作",326,100],["有效线索",14,62],["人工待办",2,22]]; conditions = "全员；日期 = 2026-07-13；表达 = 管理摘要"; }
    if (/员工/.test(query)) { title = "按员工对比今日结果"; conclusion = "主号获客专家负责获取和触达，带回 6 条留资；客服专员承接 204 个客服会话，发生 8 次人工介入。两个岗位当前的结果口径不同，不建议直接比较绝对数字。"; rows = [["主号获客专家 · 留资",6,72],["客服专员 · 有效回复",196,100],["客服专员 · 人工介入",8,28]]; conditions = "员工 = 主号获客专家、客服专员；按各自结果口径展示"; }
    output.innerHTML = `<section><header><span>AI 管家生成</span><h4>${title}</h4></header><p>${conclusion}</p><div class="ai-analysis-bars">${rows.map((row) => `<div><span>${row[0]}</span><i><b style="width:${row[2]}%"></b></i><strong>${row[1]}</strong></div>`).join("")}</div><footer><span>数据范围：2026-07-13 · 鸿途汽车品牌运营中心</span><span>筛选条件：${conditions}</span><button type="button" data-open-existing-details>查看下方原始明细 ↓</button></footer></section>`;
  }

  function addThreadMessage(id, from, text) {
    state.threads[id] = state.threads[id] || [];
    state.threads[id].push({ from, text, time: nowTime() });
    if (state.threads[id].length > 8) state.threads[id].shift();
  }
  function handleChatSubmit(form) {
    const id = form.dataset.sideChat;
    const input = $("input", form);
    const text = input?.value.trim();
    if (!text) return;
    input.value = "";
    addThreadMessage(id, "user", text);
    if (id === "ai-video") {
      const publishResponse = wuJianPublishConfigFromMessage(text);
      if (publishResponse) {
        const settings = { ...defaultSettings["ai-video"], ...(state.settings["ai-video"] || {}) };
        const config = wuJianAccountPublishConfig(settings, state.wuJian.account || "鸿途汽车官方旗舰店");
        const history = Array.isArray(state.wuJian.publishStrategyHistory) ? state.wuJian.publishStrategyHistory : [];
        history.push({ time: nowDateTime(), account: state.wuJian.account, mode: config.mode, timing: config.timing, scheduleAt: config.scheduleAt, source: text });
        state.wuJian.publishStrategyHistory = history.slice(-12);
        persistWuJian();
        addThreadMessage(id, "agent", publishResponse);
        state.sidePanelMode = "overview";
        renderSidePanel();
        return;
      }
    }
    if (id !== "supervisor" && /暂停|先停|停下/.test(text)) { setStatus(id, "paused"); addThreadMessage(id, "agent", "好的，我已经暂停。当前上下文已保留，你说“继续工作”时我会从原来的位置继续。"); }
    else if (id !== "supervisor" && /继续|恢复|开始工作/.test(text)) { setStatus(id, "working"); addThreadMessage(id, "agent", "我已经继续工作，会从暂停前的节点开始，结果仍会记录在成果中心。"); }
    else if (id !== "supervisor" && /依据|为什么|怎么判断/.test(text)) { addThreadMessage(id, "agent", ["lead-hunter", "lead-hunter-advanced"].includes(id) ? "我主要看车型、预算、城市和试驾表达。这条同时出现了三项信号，所以我判断为高意向。" : "我查了门店优惠知识和人工边界。当前没有可以支撑特殊价格承诺的依据，所以没有直接发送。"); }
    else if (id !== "supervisor" && /记住|以后|规则|不要|必须|改成/.test(text)) { state.pendingMemory = { employee: id, text }; addThreadMessage(id, "agent", "我理解了这次纠正。在它影响以后的任务之前，请你确认是长期记住，还是只对本次任务生效。"); }
    else if (id === "supervisor" && /日报|昨天|成果|老板/.test(text)) { addThreadMessage(id, "agent", "昨日 2 位员工共完成 326 次业务动作，带回 14 条有效线索，费用 ¥126。最需要处理的是 2 个价格口径问题。"); }
    else if (id === "supervisor") {
      if (!hiredIds().length) addThreadMessage(id, "agent", "收到。我会先按你的业务目标推荐岗位：想找客户看主号获客专家，想接待私信看客服专员，想做内容看短视频运营专员。你可以点击上面的快捷问题继续描述，也可以直接去人才市场选人。");
      else { state.planStarted = true; addThreadMessage(id, "agent", "我已经把目标拆成三步：主号获客专家发现客户，客服专员做首轮确认，我在 18:00 汇总。优惠承诺和低置信度会先请你确认。"); renderOfficeScene(); }
    }
    else { addThreadMessage(id, "agent", `我收到了。我现在${taskText(id)}。如果这是长期规则，你可以直接说“以后记住……”。`); }
    renderSidePanel();
  }
  function confirmMemory(scope) {
    const pending = state.pendingMemory;
    if (!pending) return;
    const employee = employees[pending.employee];
    if (scope === "long") {
      state.memories.push({ id: `memory-${Date.now()}`, employee: pending.employee, text: pending.text, scope: `${digitalEmployeeLabel(employee)}`, source: "用户在员工对话中纠正", date: nowDateTime() });
      saveJson(MEMORY_KEY, state.memories);
      addThreadMessage(pending.employee, "agent", "我已经记住这条长期规则。从下一次任务开始，我会按这个方式执行，你也可以在 Agent 设置中撤销。");
    } else if (scope === "task") {
      state.taskMemories.push({ ...pending, scope: "task" });
      addThreadMessage(pending.employee, "agent", "好的，这条只对当前任务生效，任务结束后会归档，不会写入长期记忆。");
    } else addThreadMessage(pending.employee, "agent", "已取消，这次纠正不会改变以后的工作规则。");
    state.pendingMemory = null;
    renderSidePanel();
    if (state.workspaceOpen) renderWorkspace();
  }

  function applyWuJianTemplate(templateId) {
    const template = wuJianTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const vehicleMap = { "rear-space": "vehicle-e7", "range-challenge": "vehicle-e7", "family-suv": "vehicle-t9", "smart-cockpit": "vehicle-yaoguang" };
    const creativeMap = { "rear-space": "实车测评", "range-challenge": "实车测评", "family-suv": "达人口播", "smart-cockpit": "品牌视觉" };
    state.wuJian.templateId = template.id;
    state.wuJian.historyId = "draft-space";
    state.wuJian.section = "create";
    state.wuJian.prompt = `为${template.vehicle}制作一条${template.duration}竖版短视频，采用“${template.title}”结构，目标是提升完播并带来试驾咨询。`;
    state.wuJian.script = template.script;
    state.wuJian.model = template.model;
    state.wuJian.ratio = template.ratio;
    state.wuJian.duration = template.duration;
    state.wuJian.creative = creativeMap[template.id] || "实车测评";
    state.wuJian.style = template.style;
    state.wuJian.hook = template.hook;
    state.wuJian.materials = Array.from(new Set([vehicleMap[template.id] || "vehicle-e7", "role-wujian"]));
    state.wuJian.generationStatus = "ready";
    state.wuJian.flowStep = "script-ready";
    state.wuJian.assetCheckStatus = "pending";
    state.wuJian.aiMaterialConfirmed = false;
    state.wuJian.chatMessages = [];
    state.wuJian.queueProgress = 0;
    state.wuJian.queueEta = "约 3 分钟";
    state.wuJian.showPlan = true;
    persistWuJian();
    state.workspaceMode = "create";
    renderWorkspace();
    if (typeof showToast === "function") showToast("灵感已带入创作台", `已带入《${template.title}》的画面和创作思路`);
  }

  function startWuJianGeneration(form) {
    if ((state.wuJian.flowStep || "script-ready") !== "queue") { generateWuJianScript(form); return; }
    const data = new FormData(form);
    state.wuJian.prompt = String(data.get("prompt") || "").trim();
    state.wuJian.script = String(data.get("script") || "").trim();
    state.wuJian.model = String(data.get("model") || state.wuJian.model);
    state.wuJian.ratio = String(data.get("ratio") || state.wuJian.ratio);
    state.wuJian.duration = String(data.get("duration") || state.wuJian.duration);
    state.wuJian.creative = String(data.get("creative") || state.wuJian.creative || "实车测评");
    state.wuJian.style = String(data.get("style") || state.wuJian.style);
    state.wuJian.hook = String(data.get("hook") || state.wuJian.hook || "反差实测");
    state.wuJian.voice = String(data.get("voice") || state.wuJian.voice);
    state.wuJian.autoMode = String(data.get("autoMode") || state.wuJian.autoMode || "自动成片");
    state.wuJian.canvas = data.get("canvas") === "true";
    state.wuJian.showPlan = true;
    state.wuJian.section = "history";
    state.wuJian.generationStatus = "generating";
    state.wuJian.generatedWorkId = "";
    state.wuJian.publishResult = "";
    state.statuses["ai-video"] = "working";
    employees["ai-video"].progress = 76;
    employees["ai-video"].task = `正在使用 ${state.wuJian.model} 合成汽车短视频`;
    persistWuJian();
    renderWorkspace();
    renderOfficeScene();
    renderSidePanel();
    window.setTimeout(() => {
      completeWuJianProduction();
    }, 1400);
  }

  function handleClick(event) {
    const wjvSection = event.target.closest("[data-wjv-section]");
    if (wjvSection) {
      const section = ["overview", "publish", "library"].includes(wjvSection.dataset.wjvSection) ? wjvSection.dataset.wjvSection : "overview";
      v13Patch({ section });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvLibTab = event.target.closest("[data-wjv-lib-tab]");
    if (wjvLibTab) {
      v13Patch({ libTab: wjvLibTab.dataset.wjvLibTab === "monitor" ? "monitor" : "works" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvNewTask = event.target.closest("[data-wjv-new-task]");
    if (wjvNewTask) {
      v13ClearTaskTitles();
      v13Patch({ publishView: "create", taskStep: 1, taskAccounts: [], taskWorks: [], taskTiming: "now", taskScheduleAt: "2026-08-26T18:30", taskTitleMode: "none", taskTitleCopy: "", taskTitles: {}, taskTitlesSignature: "", workFilter: "all" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvFlowCancel = event.target.closest("[data-wjv-flow-cancel]");
    if (wjvFlowCancel) {
      v13ClearTaskTitles();
      v13Patch({ publishView: "results", taskAccounts: [], taskWorks: [], taskTitles: {}, taskTitlesSignature: "" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvStepNext = event.target.closest("[data-wjv-step-next]");
    if (wjvStepNext) {
      const s = v13State();
      const step = Number(s.taskStep) || 1;
      if (step === 1 && !(s.taskAccounts || []).length) { if (typeof showToast === "function") showToast("先选择账号", "至少选择一个抖音账号后再继续"); return; }
      if (step === 2 && !(s.taskWorks || []).length) { if (typeof showToast === "function") showToast("先选择素材", "从作品库勾选要发布的视频"); return; }
      if (step === 2 && (s.taskWorks || []).length < (s.taskAccounts || []).length) { if (typeof showToast === "function") showToast("素材数量不足", `当前 ${(s.taskWorks || []).length} 条素材不足以覆盖 ${(s.taskAccounts || []).length} 个账号，请补充素材或返回减少账号`); return; }
      if (step === 3 && (s.taskTitleMode === "fixed" || s.taskTitleMode === "ai-expand") && !(s.taskTitleCopy || "").trim()) { if (typeof showToast === "function") showToast("请填写文案", s.taskTitleMode === "ai-expand" ? "请输入核心文案，AI 将基于此拓展标题" : "请输入发布文案"); return; }
      v13Patch({ taskStep: Math.min(4, step + 1) });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvAiTagRemove = event.target.closest("[data-wjv-ai-tag-remove]");
    if (wjvAiTagRemove) {
      const workId = wjvAiTagRemove.dataset.wjvAiTagRemove || "";
      const tag = wjvAiTagRemove.dataset.wjvAiTag || "";
      const record = v13State().taskTitles?.[workId];
      if (record) {
        record.tags = (record.tags || []).filter((item) => item !== tag);
        record.edited = true;
        persistWuJian();
      }
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvAiTagAdd = event.target.closest("[data-wjv-ai-tag-add]");
    if (wjvAiTagAdd) {
      v13AddAiTag(wjvAiTagAdd.dataset.wjvAiTagAdd || "", wjvAiTagAdd.dataset.wjvAiTitleRow || "");
      return;
    }
    const wjvStepBack = event.target.closest("[data-wjv-step-back]");
    if (wjvStepBack) {
      v13Patch({ taskStep: Math.max(1, (Number(v13State().taskStep) || 1) - 1) });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvAccountAll = event.target.closest("[data-wjv-account-all]");
    if (wjvAccountAll) {
      const selected = new Set(v13State().taskAccounts || []);
      const allChecked = V13_ACCOUNTS.length > 0 && V13_ACCOUNTS.every((a) => selected.has(a.id));
      V13_ACCOUNTS.forEach((a) => { if (allChecked) selected.delete(a.id); else selected.add(a.id); });
      v13Patch({ taskAccounts: Array.from(selected) });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvWorkFilter = event.target.closest("[data-wjv-work-filter]");
    if (wjvWorkFilter) {
      v13Patch({ workFilter: wjvWorkFilter.dataset.wjvWorkFilter || "all" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvUpload = event.target.closest("[data-wjv-upload]");
    if (wjvUpload) {
      const input = wjvUpload.closest(".wjv-page, .wjv-step-options, .wjv-lib-panel")?.querySelector("[data-wjv-upload-input]") || document.querySelector("[data-wjv-upload-input]");
      if (input) input.click();
      return;
    }
    const wjvTiming = event.target.closest("[data-wjv-timing]");
    if (wjvTiming) {
      v13Patch({ taskTiming: wjvTiming.dataset.wjvTiming === "scheduled" ? "scheduled" : "now" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvSlot = event.target.closest("[data-wjv-slot]");
    if (wjvSlot) {
      const date = (v13State().taskScheduleAt || "2026-08-26T18:30").slice(0, 11);
      v13Patch({ taskScheduleAt: `${date}${wjvSlot.dataset.wjvSlot || "18:30"}` });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvTitleMode = event.target.closest("[data-wjv-title-mode]");
    if (wjvTitleMode) {
      const mode = wjvTitleMode.dataset.wjvTitleMode;
      if (["none", "fixed", "ai-expand"].includes(mode)) {
        v13Patch({ taskTitleMode: mode, taskTitleCopy: "" });
        refreshWuJianLiveWorkspace();
      }
      return;
    }
    const wjvSubmit = event.target.closest("[data-wjv-submit]");
    if (wjvSubmit) {
      const s = v13State();
      const accounts = V13_ACCOUNTS.filter((a) => (s.taskAccounts || []).includes(a.id));
      const works = v13Works().filter((w) => (s.taskWorks || []).includes(w.id));
      if (!accounts.length) { if (typeof showToast === "function") showToast("先选择账号", "至少选择一个抖音账号"); return; }
      if (!works.length) { if (typeof showToast === "function") showToast("先选择素材", "从作品库选择要发布的视频"); return; }
      if (works.length < accounts.length) { if (typeof showToast === "function") showToast("素材数量不足", `${works.length} 条素材无法覆盖 ${accounts.length} 个账号`); return; }
      const failedAccounts = accounts.filter((a) => a.status === "发布异常" && a.failureType === "marketing");
      if (failedAccounts.length) {
        const names = failedAccounts.map((a) => a.name).join("、");
        if (typeof showToast === "function") showToast("存在授权失效账号", `${names} 营销授权已失效，已自动移除，可继续创建任务`);
      }
      const validAccounts = accounts.filter((a) => !(a.status === "发布异常" && a.failureType === "marketing"));
      if (!validAccounts.length) { if (typeof showToast === "function") showToast("所有账号授权失效", "请先完成营销授权再创建发布任务"); return; }
      const dist = v13ComputeDistribution(validAccounts, works);
      const titleMode = s.taskTitleMode || "none";
      const titleCopy = s.taskTitleCopy || "";
      const records = titleMode === "ai-expand" ? v13TaskTitleRecords() : {};
      const invalid = works.filter((w) => v13TitleIssue(records[w.id]));
      if (invalid.length) { if (typeof showToast === "function") showToast("标题待调整", `${invalid.length} 条素材的发布标题不合规，请修正后再提交`); return; }
      const titles = titleMode === "ai-expand"
        ? works.map((w) => { const record = records[w.id]; return { workId: w.id, materialTitle: w.title, title: record.title, tags: (record.tags || []).slice(), edited: Boolean(record.edited), publishedTitle: v13TitleText(record) }; })
        : [];
      const editedCount = titles.filter((item) => item.edited).length;
      const titleLabel = titleMode === "fixed" ? `固定文案` : titleMode === "ai-expand" ? `AI 拓展（${works.length} 条${editedCount ? `，含 ${editedCount} 条用户修改` : ""}）` : "无标题";
      const task = {
        id: `task-${Date.now()}`,
        status: "执行中",
        accountIds: validAccounts.map((a) => a.id),
        distribution: dist.map((row) => ({ accountId: row.account.id, accountName: row.account.name, workIds: row.works.map((w) => w.id) })),
        workIds: works.map((w) => w.id),
        workTitles: titles.length ? titles.map((item) => item.publishedTitle) : works.map((w) => w.title),
        titles,
        workCount: works.length,
        titleMode,
        titleCopy,
        titleLabel,
        timing: s.taskTiming === "scheduled" ? `定时 ${String(s.taskScheduleAt || "").replace("T", " ")}` : "立即发布",
        time: s.taskTiming === "scheduled" ? String(s.taskScheduleAt || "").replace("T", " ") : "刚刚发布",
        createdAt: nowDateTime(),
      };
      v13ClearTaskTitles();
      v13Patch({ generatedTasks: [task, ...((s.generatedTasks) || [])].slice(0, 50), publishView: "results", taskAccounts: [], taskWorks: [], taskTitleMode: "none", taskTitleCopy: "", taskTitles: {}, taskTitlesSignature: "" });
      refreshWuJianLiveWorkspace();
      if (typeof showToast === "function") showToast("发布任务已生成", `${validAccounts.length} 个账号并行执行，共发布 ${works.length} 条素材（去重分发）`);
      return;
    }
    const wjvViewAccount = event.target.closest("[data-wjv-view-account]");
    if (wjvViewAccount) {
      v13Patch({ accountWorksOpen: wjvViewAccount.dataset.wjvViewAccount || "", accountWorksFilters: ["all"], accountWorksFilter: "all" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvCancelAccountWork = event.target.closest("[data-wjv-cancel-account-work]");
    if (wjvCancelAccountWork) {
      const workId = wjvCancelAccountWork.dataset.wjvAccountWorkId || "";
      const statuses = { ...(v13State().accountWorkStatuses || {}) };
      statuses[workId] = "取消发布";
      v13Patch({ accountWorkStatuses: statuses, accountWorksFilters: ["取消发布"], accountWorksFilter: "取消发布" });
      refreshWuJianLiveWorkspace();
      if (typeof showToast === "function") showToast("已取消发布", "该作品已从发布队列中取消");
      return;
    }
    const wjvRetryAccountWork = event.target.closest("[data-wjv-retry-account-work]");
    if (wjvRetryAccountWork) {
      const workId = wjvRetryAccountWork.dataset.wjvAccountWorkId || "";
      const statuses = { ...(v13State().accountWorkStatuses || {}) };
      statuses[workId] = "待发布";
      v13Patch({ accountWorkStatuses: statuses, accountWorksFilters: ["待发布"], accountWorksFilter: "待发布" });
      refreshWuJianLiveWorkspace();
      if (typeof showToast === "function") showToast("已重新加入待发布", "该作品状态已更新为待发布，可继续安排发布");
      return;
    }
    const wjvWorkDownload = event.target.closest("[data-wjv-work-download]");
    if (wjvWorkDownload) {
      const workId = wjvWorkDownload.dataset.wjvWorkDownload || "";
      const upload = (Array.isArray(v13State().worksPoolUploads) ? v13State().worksPoolUploads : []).find((item) => item.id === workId) || {};
      wuJianTriggerWorkDownload({ ...upload, title: upload.title || "待发布视频" });
      return;
    }
    const wjvModalClose = event.target.closest("[data-wjv-modal-close]");
    if (wjvModalClose) {
      v13Patch({ accountWorksOpen: "" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvBindAccount = event.target.closest("[data-wjv-bind-account]");
    if (wjvBindAccount) {
      window.location.hash = "accounts";
      if (typeof showToast === "function") showToast("去绑定账号", "完成抖音营销授权后即可加入发布范围");
      return;
    }
    const wjvAccountTodo = event.target.closest("[data-wjv-account-todo]");
    if (wjvAccountTodo) {
      const accountName = wjvAccountTodo.dataset.wjvAccountName || "该账号";
      if (typeof window.openAccountBind === "function") {
        window.openAccountBind("douyin", "", { account: accountName, type: "企业号", nickname: accountName });
        if (typeof showToast === "function") showToast("处理营销授权", `请为${accountName}完成抖音营销授权，授权成功后会恢复发布`);
      } else {
        window.location.hash = "accounts";
      }
      return;
    }
    const wjvRepublishAccount = event.target.closest("[data-wjv-republish-account]");
    if (wjvRepublishAccount) {
      const account = V13_ACCOUNTS.find((item) => item.id === wjvRepublishAccount.dataset.wjvRepublishAccount);
      if (account && account.status === "发布异常" && account.failureType !== "marketing") {
        account.status = "排队中";
        account.progress = 0;
        account.time = "等待发布";
        account.error = "";
        account.failureType = "";
        renderSidePanel();
        refreshWuJianLiveWorkspace();
        if (typeof showToast === "function") showToast("已重新发布", `${account.name} 已重新加入发布队列`);
      }
      return;
    }
    const wjvMonitorAdd = event.target.closest("[data-wjv-monitor-add]");
    if (wjvMonitorAdd) {
      v13Patch({ monitorAddOpen: true, monitorDraftHandle: "" });
      refreshWuJianLiveWorkspace();
      window.setTimeout(() => document.querySelector('.wjv-monitor-add-modal input[name="handle"]')?.focus(), 0);
      return;
    }
    const wjvMonitorAddClose = event.target.closest("[data-wjv-monitor-add-close], [data-wjv-monitor-add-cancel]");
    if (wjvMonitorAddClose) {
      v13Patch({ monitorAddOpen: false, monitorDraftHandle: "", monitorValidating: false, monitorAddError: "" });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvMonitorAddSubmit = event.target.closest("[data-wjv-monitor-add-submit]");
    if (wjvMonitorAddSubmit) {
      if (v13State().monitorValidating) return;
      const form = wjvMonitorAddSubmit.closest("[data-wjv-monitor-add-form]");
      const rawHandle = String(new FormData(form || undefined).get("handle") || "").trim();
      const handle = rawHandle.replace(/^@+/, "").replace(/\s+/g, "");
      if (!handle) {
        if (typeof showToast === "function") showToast("请输入抖音号", "输入抖音号后才能开始监控");
        return;
      }
      const formatError = v13MonitorHandleFormatError(handle);
      if (formatError) {
        v13Patch({ monitorDraftHandle: handle, monitorAddError: formatError });
        refreshWuJianLiveWorkspace();
        if (typeof showToast === "function") showToast("抖音号格式不正确", formatError);
        return;
      }
      if (v13Monitors().some((monitor) => String(monitor.handle).toLowerCase() === handle.toLowerCase())) {
        v13Patch({ monitorDraftHandle: handle, monitorAddError: "该抖音号已在监控列表中" });
        refreshWuJianLiveWorkspace();
        if (typeof showToast === "function") showToast("账号已存在", `@${handle} 已在监控列表中`);
        return;
      }
      /* 有效性校验：进入加载态，校验期间不可重复提交，结果返回后回到表单 */
      v13Patch({ monitorValidating: true, monitorDraftHandle: handle, monitorAddError: "" });
      refreshWuJianLiveWorkspace();
      window.setTimeout(() => v13FinishMonitorAdd(handle), V13_MONITOR_VALIDATE_MS);
      return;
    }
    const wjvMonitorAuto = event.target.closest("[data-wjv-monitor-auto]");
    if (wjvMonitorAuto) {
      const row = v13MonitorById(wjvMonitorAuto.dataset.wjvMonitorAuto);
      if (row) v13UpdateMonitor(row.id, { auto: !row.auto });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvMonitorSync = event.target.closest("[data-wjv-monitor-sync]");
    if (wjvMonitorSync) {
      const row = v13MonitorById(wjvMonitorSync.dataset.wjvMonitorSync);
      if (row) {
        const index = v13Monitors().findIndex((item) => item.id === row.id);
        const offset = Number(row.syncCount || 0);
        const batch = v13CommitMonitorGrab(row, index, offset, (result) => `刚刚 · 新增 ${result.accepted.length} 条`);
        v13UpdateMonitor(row.id, { syncCount: offset + 1 });
        if (typeof showToast === "function") showToast("同步完成", batch.accepted.length ? `本次抓取 ${batch.fetched} 条，新增 ${batch.accepted.length} 条进入待发布作品池，同一账号相同作品去重 ${batch.deduped} 条` : `本次抓取 ${batch.fetched} 条，同一账号相同作品已全部去重（${batch.deduped} 条），无新增作品`);
      }
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvMonitorDelete = event.target.closest("[data-wjv-monitor-delete]");
    if (wjvMonitorDelete) {
      v13DeleteMonitor(wjvMonitorDelete.dataset.wjvMonitorDelete);
      refreshWuJianLiveWorkspace();
      return;
    }
    const pickerClose = event.target.closest("[data-wujian-picker-close]");
    if (pickerClose && (pickerClose.tagName === "BUTTON" || pickerClose === event.target)) {
      closeWuJianAssetPicker();
      return;
    }
    if (event.target.closest("[data-wujian-settings-close]")) {
      state.sidePanelMode = "overview";
      renderSidePanel();
      return;
    }
    const pickerTab = event.target.closest("[data-wujian-picker-tab]");
    if (pickerTab) {
      state.wuJian.assetPickerTab = pickerTab.dataset.wujianPickerTab;
      state.wuJian.assetPickerSelected = [];
      persistWuJian();
      if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const pickerItem = event.target.closest("[data-wujian-picker-item]");
    if (pickerItem) {
      const selected = new Set(state.wuJian.assetPickerSelected || []);
      const id = pickerItem.dataset.wujianPickerItem;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      state.wuJian.assetPickerSelected = Array.from(selected);
      persistWuJian();
      if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const pickerUpload = event.target.closest("[data-wujian-picker-upload]");
    if (pickerUpload) {
      pickerUpload.closest(".wujian-asset-picker")?.querySelector("[data-wujian-picker-upload-input]")?.click();
      return;
    }
    if (event.target.closest("[data-wujian-picker-confirm]")) {
      confirmWuJianAssetPicker();
      return;
    }
    const pickerOpen = event.target.closest("[data-wujian-open-picker]");
    if (pickerOpen) {
      openWuJianAssetPicker(pickerOpen.dataset.wujianOpenPicker || "history");
      return;
    }
    const authorizeAccount = event.target.closest("[data-wujian-authorize-account]");
    if (authorizeAccount) {
      closeWorkspace();
      window.location.hash = "accounts";
      if (typeof showToast === "function") showToast("去完成营销授权", "授权完成后，回到这条创作继续选择账号");
      return;
    }
    const publishMode = event.target.closest("[data-wujian-publish-mode]");
    if (publishMode) {
      state.wuJian.publishModeDraft = publishMode.dataset.wujianPublishMode;
      persistWuJian();
      renderWorkspace();
      return;
    }
    const publishTiming = event.target.closest("[data-wujian-publish-timing]");
    if (publishTiming) {
      state.wuJian.publishTimingDraft = publishTiming.dataset.wujianPublishTiming;
      persistWuJian();
      renderWorkspace();
      return;
    }
    const wuJianCaseClose = event.target.closest("[data-wujian-case-close]");
    if (wuJianCaseClose && (wuJianCaseClose === event.target || event.target.closest(".wujian-case-detail > header button"))) {
      state.wuJian.caseDetailId = "";
      state.wuJian.caseDetailAutoplay = false;
      refreshWuJianLiveWorkspace();
      return;
    }
    const wuJianCaseReuse = event.target.closest("[data-wujian-case-reuse]");
    if (wuJianCaseReuse) {
      applyWuJianCaseReuse(state.wuJian.caseDetailId, wuJianCaseReuse.dataset.wujianCaseReuse);
      return;
    }
    const wuJianCasePreview = event.target.closest("[data-wujian-case-preview]");
    if (wuJianCasePreview) {
      openWuJianCaseDetail(wuJianCasePreview.dataset.wujianCasePreview, true);
      return;
    }
    const wuJianCaseDetail = event.target.closest("[data-wujian-case-detail]");
    if (wuJianCaseDetail) {
      openWuJianCaseDetail(wuJianCaseDetail.dataset.wujianCaseDetail, false);
      return;
    }
    const wujianLiveTab = event.target.closest('[data-demo-live-job="wujian"]');
    if (wujianLiveTab) {
      const liveRoot = document.querySelector('[data-view="demo-live"]');
      if (liveRoot) renderWuJianLiveWorkspace(liveRoot);
      return;
    }
    const liveSectionTab = event.target.closest("[data-wujian-live-section]");
    if (liveSectionTab) {
      const section = ["overview", "data", "tasks", "library"].includes(liveSectionTab.dataset.wujianLiveSection) ? liveSectionTab.dataset.wujianLiveSection : "overview";
      state.wuJian.section = section;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const libraryTab = event.target.closest("[data-wujian-library-tab]");
    if (libraryTab) {
      state.wuJian.libraryTab = ["pending", "pool", "published", "review"].includes(libraryTab.dataset.wujianLibraryTab) ? libraryTab.dataset.wujianLibraryTab : "pending";
      if (state.wuJian.libraryTab === "pool" && !["works", "monitor"].includes(state.wuJian.libraryPoolView)) state.wuJian.libraryPoolView = "works";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const libraryReviewApprove = event.target.closest("[data-wujian-library-review-approve]");
    if (libraryReviewApprove) {
      wuJianApproveLibraryReview(libraryReviewApprove.dataset.wujianLibraryReviewApprove);
      return;
    }
    const libraryReviewOptimize = event.target.closest("[data-wujian-library-review-optimize]");
    if (libraryReviewOptimize) {
      wuJianOptimizeLibraryReview(libraryReviewOptimize.dataset.wujianLibraryReviewOptimize);
      return;
    }
    const libraryReviewDelete = event.target.closest("[data-wujian-library-review-delete]");
    if (libraryReviewDelete) {
      wuJianDeleteLibraryReview(libraryReviewDelete.dataset.wujianLibraryReviewDelete);
      return;
    }
    const libraryPoolView = event.target.closest("[data-wujian-library-pool-view]");
    if (libraryPoolView) {
      state.wuJian.libraryTab = "pool";
      state.wuJian.libraryPoolView = libraryPoolView.dataset.wujianLibraryPoolView === "monitor" ? "monitor" : "works";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const libraryUpload = event.target.closest("[data-wujian-library-upload]");
    if (libraryUpload) {
      libraryUpload.closest(".ai-works-library-panel")?.querySelector("[data-wujian-library-upload-input]")?.click();
      return;
    }
    const workDownloadMissing = event.target.closest("[data-wujian-work-download-missing]");
    if (workDownloadMissing) {
      event.preventDefault();
      event.stopPropagation();
      wuJianTriggerWorkDownload({ id: workDownloadMissing.dataset.wujianWorkDownloadMissing || "", title: "待发布视频" });
      return;
    }
    const libraryPublish = event.target.closest("[data-wujian-library-publish]");
    if (libraryPublish) {
      const source = libraryPublish.dataset.wujianLibrarySource === "remix" ? "remix" : "library";
      const itemId = libraryPublish.dataset.wujianLibraryPublish || "";
      state.wuJian.section = "tasks";
      state.wuJian.publishTaskView = "agent";
      state.wuJian.publishTaskSource = source;
      state.wuJian.publishTaskStep = source === "remix" ? 2 : 2;
      state.wuJian.publishTaskWorkIds = source === "remix" ? [itemId.replace(/^approved-/, "")] : [itemId];
      state.wuJian.publishTaskRemixGenerated = false;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskNew = event.target.closest("[data-wujian-publish-task-new]");
    if (publishTaskNew) {
      state.wuJian.section = "tasks";
      wuJianResetPublishTask();
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskHistory = event.target.closest("[data-wujian-publish-task-history]");
    if (publishTaskHistory) {
      state.wuJian.section = "tasks";
      state.wuJian.publishTaskView = "history";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskHistoryId = event.target.closest("[data-wujian-publish-history-id]");
    if (publishTaskHistoryId) {
      state.wuJian.publishTaskHistoryId = publishTaskHistoryId.dataset.wujianPublishHistoryId || "";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskBack = event.target.closest("[data-wujian-publish-task-back]");
    if (publishTaskBack) {
      state.wuJian.publishTaskView = "list";
      state.wuJian.publishTaskHistoryId = "";
      state.wuJian.section = "tasks";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskPrev = event.target.closest("[data-wujian-publish-task-step-prev]");
    if (publishTaskPrev) {
      state.wuJian.publishTaskStep = Math.max(1, (Number(state.wuJian.publishTaskStep) || 1) - 1);
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskNext = event.target.closest("[data-wujian-publish-task-step-next]");
    if (publishTaskNext) {
      const step = Number(state.wuJian.publishTaskStep) || 1;
      const source = state.wuJian.publishTaskSource || "library";
      if (step === 1 && !(state.wuJian.publishTaskAccountIds || []).length) { if (typeof showToast === "function") showToast("先选择账号", "至少选择一个抖音账号后再继续"); return; }
      if (step === 2 && source !== "ai" && !(state.wuJian.publishTaskWorkIds || []).length) { if (typeof showToast === "function") showToast("先选择素材", "从列表中勾选要发布的作品"); return; }
      if (step === 2 && source === "remix" && !state.wuJian.publishTaskRemixGenerated) { if (typeof showToast === "function") showToast("先完成二创", "点击“开始大模型二创”，生成可发布版本后再继续"); return; }
      if (step === 2 && source === "ai" && (!state.wuJian.publishTaskScriptsConfirmed || !state.wuJian.publishTaskGenerated)) { if (typeof showToast === "function") showToast("先完成 AI 视频", "生成并确认脚本后，再等待视频 AI 生成完成"); return; }
      state.wuJian.publishTaskStep = Math.min(4, step + 1);
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskAccountAll = event.target.closest("[data-wujian-publish-account-all]");
    if (publishTaskAccountAll) {
      const accounts = wuJianPublishTaskAccounts();
      const selected = new Set(state.wuJian.publishTaskAccountIds || []);
      const allChecked = accounts.length > 0 && accounts.every((row) => selected.has(row.id));
      state.wuJian.publishTaskAccountIds = allChecked ? [] : accounts.map((row) => row.id);
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskSource = event.target.closest("[data-wujian-publish-source]");
    if (publishTaskSource) {
      state.wuJian.publishTaskSource = publishTaskSource.dataset.wujianPublishSource || "library";
      state.wuJian.publishTaskWorkIds = [];
      state.wuJian.publishTaskScriptsReady = false;
      state.wuJian.publishTaskScriptsConfirmed = false;
      state.wuJian.publishTaskGenerated = false;
      state.wuJian.publishTaskRemixGenerated = false;
      state.wuJian.publishTaskReview = "review";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskRemixGenerate = event.target.closest("[data-wujian-publish-remix-generate]");
    if (publishTaskRemixGenerate) {
      if (!(state.wuJian.publishTaskWorkIds || []).length) {
        if (typeof showToast === "function") showToast("先选择二创作品", "从二创作品列表中勾选至少一个作品");
        return;
      }
      state.wuJian.publishTaskRemixGenerated = true;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      if (typeof showToast === "function") showToast("二创已完成", "大模型已生成可发布版本，现在可以确认发布时间和审核方式");
      return;
    }
    const publishTaskScriptGenerate = event.target.closest("[data-wujian-publish-script-generate]");
    if (publishTaskScriptGenerate) {
      const input = document.querySelector("[data-wujian-publish-script]");
      state.wuJian.publishTaskScript = input?.value?.trim() || "为星途 E7 做一条真实后排空间测评视频";
      state.wuJian.publishTaskScriptsReady = true;
      state.wuJian.publishTaskScriptsConfirmed = false;
      state.wuJian.publishTaskGenerated = false;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskScriptConfirm = event.target.closest("[data-wujian-publish-script-confirm]");
    if (publishTaskScriptConfirm) {
      state.wuJian.publishTaskScriptsConfirmed = true;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskVideoGenerate = event.target.closest("[data-wujian-publish-video-generate]");
    if (publishTaskVideoGenerate) {
      state.wuJian.publishTaskGenerated = true;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      if (typeof showToast === "function") showToast("视频 AI 已生成", "现在可以继续确认发布时间和审核方式");
      return;
    }
    const publishTaskUpload = event.target.closest("[data-wujian-publish-upload]");
    if (publishTaskUpload) {
      publishTaskUpload.closest(".ai-publish-task-source-picker")?.querySelector("[data-wujian-publish-upload-input]")?.click();
      return;
    }
    const publishTaskRemixManage = event.target.closest("[data-wujian-publish-remix-manage]");
    if (publishTaskRemixManage) {
      if (typeof showToast === "function") showToast("二创素材已打开", "可直接从二创作品列表中选择要发布的作品");
      return;
    }
    const publishTaskChatSend = event.target.closest("[data-wujian-publish-chat-send]");
    if (publishTaskChatSend) {
      const input = publishTaskChatSend.closest(".ai-publish-chat-composer")?.querySelector("[data-wujian-publish-chat-input]");
      const text = input?.value?.trim() || "";
      if (!text) return;
      const step = Number(state.wuJian.publishTaskStep) || 1;
      const messages = Array.isArray(state.wuJian.publishTaskMessages) ? state.wuJian.publishTaskMessages : [];
      state.wuJian.publishTaskMessages = [...messages, { role: "user", text }].slice(-8);
      if (step === 1) {
        const accounts = wuJianPublishTaskAccounts();
        const requested = accounts.filter((row) => text.includes(row.name) || text.includes(row.id));
        const selected = text.includes("全部") ? accounts : requested;
        if (selected.length) {
          state.wuJian.publishTaskAccountIds = selected.map((row) => row.id);
          state.wuJian.publishTaskStep = 2;
        }
      } else if (step === 2) {
        if (text.includes("AI") || text.includes("ai") || text.includes("自产")) state.wuJian.publishTaskSource = "ai";
        else if (text.includes("二创") || text.includes("改编")) state.wuJian.publishTaskSource = "remix";
        else if (text.includes("素材库") || text.includes("上传")) state.wuJian.publishTaskSource = "library";
        if (state.wuJian.publishTaskSource === "ai") state.wuJian.publishTaskScript = text;
      } else if (step === 3) {
        if (text.includes("定时")) state.wuJian.publishTaskTiming = "scheduled";
        if (text.includes("自动")) state.wuJian.publishTaskReview = "auto";
        if (text.includes("人工") || text.includes("审核")) state.wuJian.publishTaskReview = "review";
      }
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskTiming = event.target.closest("[data-wujian-publish-task-timing]");
    if (publishTaskTiming) {
      state.wuJian.publishTaskTiming = publishTaskTiming.dataset.wujianPublishTaskTiming === "scheduled" ? "scheduled" : "now";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskReview = event.target.closest("[data-wujian-publish-review]");
    if (publishTaskReview) {
      state.wuJian.publishTaskReview = publishTaskReview.dataset.wujianPublishReview === "auto" ? "auto" : "review";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskSubmit = event.target.closest("[data-wujian-publish-task-submit]");
    if (publishTaskSubmit) {
      wuJianPublishTaskSubmit();
      return;
    }
    const publishTaskResultList = event.target.closest("[data-wujian-publish-task-result-list]");
    if (publishTaskResultList) {
      state.wuJian.publishTaskView = "list";
      state.wuJian.publishTaskStep = 1;
      state.wuJian.publishTaskResult = null;
      state.wuJian.section = "tasks";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const livePublishAccount = event.target.closest("[data-wujian-live-publish-account]");
    if (livePublishAccount) {
      state.wuJian.livePublishAccountId = livePublishAccount.dataset.wujianLivePublishAccount || "";
      state.wuJian.livePublishExpanded = true;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const livePublishExpand = event.target.closest("[data-wujian-live-publish-expand]");
    if (livePublishExpand) {
      state.wuJian.livePublishExpanded = !state.wuJian.livePublishExpanded;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixDataTab = event.target.closest("[data-wujian-matrix-data-tab]");
    if (matrixDataTab) {
      state.wuJian.matrixDataTab = ["accounts", "works"].includes(matrixDataTab.dataset.wujianMatrixDataTab) ? matrixDataTab.dataset.wujianMatrixDataTab : "accounts";
      state.wuJian.matrixAccountId = "";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixTimeRange = event.target.closest("[data-wujian-matrix-time-range]");
    if (matrixTimeRange) {
      state.wuJian.matrixTimeRange = ["week", "last", "month", "all"].includes(matrixTimeRange.dataset.wujianMatrixTimeRange) ? matrixTimeRange.dataset.wujianMatrixTimeRange : "week";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixAccount = event.target.closest("[data-wujian-matrix-account]");
    if (matrixAccount) {
      state.wuJian.matrixDataTab = "accounts";
      state.wuJian.matrixAccountId = matrixAccount.dataset.wujianMatrixAccount || "";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixAccountBack = event.target.closest("[data-wujian-matrix-account-back]");
    if (matrixAccountBack) {
      state.wuJian.matrixAccountId = "";
      state.wuJian.matrixDataTab = "accounts";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixGroupFilter = event.target.closest("[data-wujian-matrix-group-filter]");
    if (matrixGroupFilter) {
      state.wuJian.matrixGroupFilter = matrixGroupFilter.dataset.wujianMatrixGroupFilter || "all";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixEffect = event.target.closest("[data-wujian-matrix-effect]");
    if (matrixEffect) {
      state.wuJian.matrixEffectId = state.wuJian.matrixEffectId === matrixEffect.dataset.wujianMatrixEffect ? "" : matrixEffect.dataset.wujianMatrixEffect;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const matrixSource = event.target.closest("[data-wujian-matrix-source]");
    if (matrixSource) {
      const source = matrixSource.dataset.wujianMatrixSource;
      const inLive = Boolean(event.target.closest("#demo-live-workspace"));
      if (source === "back") {
        state.wuJian.matrixSource = "";
      } else if (source === "script") {
        state.wuJian.section = "tasks";
        state.wuJian.publishTaskView = "agent";
        state.wuJian.publishTaskSource = "ai";
        state.wuJian.publishTaskStep = 2;
      } else if (source === "recreate") {
        state.wuJian.section = "tasks";
        state.wuJian.publishTaskView = "agent";
        state.wuJian.publishTaskSource = "remix";
        state.wuJian.publishTaskStep = 2;
      } else {
        state.wuJian.matrixSource = "";
        if (inLive) state.wuJian.section = "tasks";
        if (typeof showToast === "function") showToast("已收到上传内容", "内容已进入审核排期");
      }
      persistWuJian();
      if (inLive) refreshWuJianLiveWorkspace();
      else renderWorkspace();
      return;
    }
    const recreateClear = event.target.closest("[data-wujian-recreate-clear]");
    if (recreateClear) {
      state.wuJian.recreateWork = null;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const monitorTab = event.target.closest("[data-wujian-monitor-tab]");
    if (monitorTab) {
      state.wuJian.monitorTab = ["accounts", "works", "sync"].includes(monitorTab.dataset.wujianMonitorTab) ? monitorTab.dataset.wujianMonitorTab : "accounts";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const monitorGroupFilter = event.target.closest("[data-wujian-monitor-group-filter]");
    if (monitorGroupFilter) {
      state.wuJian.monitorGroupFilter = monitorGroupFilter.dataset.wujianMonitorGroupFilter || "all";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const monitorAdd = event.target.closest("[data-wujian-monitor-add]");
    if (monitorAdd) {
      state.wuJian.monitorAddOpen = !state.wuJian.monitorAddOpen;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const monitorAddCancel = event.target.closest("[data-wujian-monitor-add-cancel]");
    if (monitorAddCancel) {
      state.wuJian.monitorAddOpen = false;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const monitorAddSubmit = event.target.closest("[data-wujian-monitor-add-submit]");
    if (monitorAddSubmit) {
      const form = monitorAddSubmit.closest("[data-wujian-monitor-add-form]");
      if (form) {
        const data = new FormData(form);
        const name = String(data.get("name") || "").trim();
        const handle = String(data.get("handle") || "").trim();
        const group = String(data.get("group") || "品牌官方");
        if (name && handle) {
          wuJianMonitorAccounts.push({ id: `ma-${Date.now()}`, handle, name, group, status: "监控中", autoSync: false, lastSync: "尚未同步", works: 0 });
          state.wuJian.monitorAddOpen = false;
          persistWuJian();
          refreshWuJianLiveWorkspace();
          if (typeof showToast === "function") showToast("已开始监控", `正在监控 @${handle}`);
        } else if (typeof showToast === "function") showToast("信息不完整", "账号名称和抖音号都要填");
      }
      return;
    }
    const monitorAuto = event.target.closest("[data-wujian-monitor-auto]");
    if (monitorAuto) {
      const account = wuJianMonitorAccounts.find((row) => row.id === monitorAuto.dataset.wujianMonitorAuto);
      if (account) {
        account.autoSync = !account.autoSync;
        if (account.autoSync && account.status === "暂停") account.status = "监控中";
        persistWuJian();
        refreshWuJianLiveWorkspace();
        if (typeof showToast === "function") showToast(account.autoSync ? "已开启每日自动获取" : "已关闭每日自动获取", `@${account.handle} 的周期同步设置已更新`);
      }
      return;
    }
    const monitorSync = event.target.closest("[data-wujian-monitor-sync]");
    if (monitorSync) {
      wuJianStartSync(monitorSync.dataset.wujianMonitorSync);
      return;
    }
    const monitorPause = event.target.closest("[data-wujian-monitor-pause]");
    if (monitorPause) {
      const account = wuJianMonitorAccounts.find((row) => row.id === monitorPause.dataset.wujianMonitorPause);
      if (account) { account.status = "暂停"; account.autoSync = false; persistWuJian(); refreshWuJianLiveWorkspace(); }
      return;
    }
    const monitorResume = event.target.closest("[data-wujian-monitor-resume]");
    if (monitorResume) {
      const account = wuJianMonitorAccounts.find((row) => row.id === monitorResume.dataset.wujianMonitorResume);
      if (account) { account.status = "监控中"; account.autoSync = true; persistWuJian(); refreshWuJianLiveWorkspace(); }
      return;
    }
    const monitorDelete = event.target.closest("[data-wujian-monitor-delete]");
    if (monitorDelete) {
      const deleteId = monitorDelete.dataset.wujianMonitorDelete;
      const index = wuJianMonitorAccounts.findIndex((row) => row.id === deleteId);
      if (index >= 0) {
        wuJianMonitorAccounts.splice(index, 1);
        persistWuJian();
        refreshWuJianLiveWorkspace();
        if (typeof showToast === "function") showToast("已停止监控", "该账号已从监控列表移除");
      }
      return;
    }
    const worksSelectAll = event.target.closest("[data-wujian-works-select-all]");
    if (worksSelectAll) {
      const available = wuJianWorksPool.filter((work) => work.status === "未处理").map((work) => work.id);
      const current = new Set(state.wuJian.worksPoolSelected || []);
      const allSelected = available.length > 0 && available.every((id) => current.has(id));
      state.wuJian.worksPoolSelected = allSelected ? [] : available;
      state.wuJian.worksBatchOpen = false;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksSelect = event.target.closest("[data-wujian-works-select]");
    if (worksSelect) {
      const selected = new Set(state.wuJian.worksPoolSelected || []);
      const workId = worksSelect.dataset.wujianWorksSelect;
      if (worksSelect.checked) selected.add(workId); else selected.delete(workId);
      state.wuJian.worksPoolSelected = Array.from(selected);
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksBatch = event.target.closest("[data-wujian-works-batch]");
    if (worksBatch) {
      const selected = (state.wuJian.worksPoolSelected || []).filter((id) => wuJianWorksPool.some((work) => work.id === id && work.status === "未处理"));
      if (!selected.length) {
        if (typeof showToast === "function") showToast("先勾选作品", "勾选至少 1 条作品后再批量二创");
        return;
      }
      state.wuJian.worksBatchOpen = true;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksBatchMode = event.target.closest("[data-wujian-works-batch-mode]");
    if (worksBatchMode) {
      state.wuJian.worksBatchMode = worksBatchMode.dataset.wujianWorksBatchMode;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksBatchRoute = event.target.closest("[data-wujian-works-batch-route]");
    if (worksBatchRoute) {
      state.wuJian.worksBatchRoute = worksBatchRoute.dataset.wujianWorksBatchRoute;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksBatchConfirm = event.target.closest("[data-wujian-works-batch-confirm]");
    if (worksBatchConfirm) {
      wuJianApplyBatch();
      return;
    }
    const worksBatchCancel = event.target.closest("[data-wujian-works-batch-cancel]");
    if (worksBatchCancel) {
      state.wuJian.worksBatchOpen = false;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksBatchClear = event.target.closest("[data-wujian-works-batch-clear]");
    if (worksBatchClear) {
      state.wuJian.worksPoolSelected = [];
      state.wuJian.worksBatchOpen = false;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksRecreate = event.target.closest("[data-wujian-works-recreate]");
    if (worksRecreate) {
      wuJianStartRecreate(worksRecreate.dataset.wujianWorksRecreate);
      return;
    }
    const syncRetry = event.target.closest("[data-wujian-sync-retry]");
    if (syncRetry) {
      const task = wuJianSyncTasks.find((item) => item.id === syncRetry.dataset.wujianSyncRetry);
      if (task) {
        task.status = "同步中";
        task.progress = 40;
        task.mode = "手动";
        persistWuJian();
        refreshWuJianLiveWorkspace();
        wuJianCompleteSyncTask(task.id);
      }
      return;
    }
    const syncRunAll = event.target.closest("[data-wujian-sync-run-all]");
    if (syncRunAll) {
      wuJianSyncAll();
      return;
    }
    const wuJianLiveOpen = event.target.closest("[data-wujian-live-open]");
    if (wuJianLiveOpen) {
      const section = ["overview", "data", "tasks"].includes(wuJianLiveOpen.dataset.wujianLiveOpen) ? wuJianLiveOpen.dataset.wujianLiveOpen : "overview";
      state.wuJian.section = section;
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace();
      else openWorkspace("overview");
      return;
    }
    const liveNewCreation = event.target.closest("[data-wujian-live-new]");
    if (liveNewCreation) {
      state.wuJian.section = "tasks";
      wuJianResetPublishTask();
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const liveHistory = event.target.closest("[data-wujian-live-history]");
    if (liveHistory) {
      state.wuJian.historyId = liveHistory.dataset.wujianLiveHistory;
      state.wuJian.section = "history";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const sideConversation = event.target.closest("[data-side-conversation]");
    if (sideConversation) { state.sideConversation = sideConversation.dataset.sideConversation; renderSidePanel(); return; }
    const supervisorPrompt = event.target.closest("[data-supervisor-prompt]");
    if (supervisorPrompt) {
      const text = supervisorPrompt.dataset.supervisorPrompt;
      addThreadMessage("supervisor", "user", text);
      const reply = /客服|私信/.test(text)
        ? "这类需求适合先看客服专员，他会接住多平台私信，并在价格承诺等风险场景提醒你。"
        : /视频|内容/.test(text)
          ? "可以看看短视频运营专员，他统一管理 100 个抖音账号，按周计划排期发布内容并回收效果。"
          : "建议先看主号获客专家，他会从抖音弹幕和评论里筛选明确购车信号，再把高意向客户交给客服跟进。";
      addThreadMessage("supervisor", "agent", reply);
      renderSidePanel();
      return;
    }
    const sideHandoff = event.target.closest("[data-side-handoff]");
    if (sideHandoff) { focusLiveServiceConversation(sideHandoff.dataset.sideHandoff); return; }
    const select = event.target.closest("[data-select-employee]"); if (select) { selectEmployee(select.dataset.selectEmployee); return; }
    const wuJianAssetShortcut = event.target.closest("[data-wujian-asset-shortcut]"); if (wuJianAssetShortcut) { state.wuJian.assetTab = wuJianAssetShortcut.dataset.wujianAssetShortcut; state.workspaceMode = "create"; state.wuJian.section = "create"; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    const wuJianFlow = event.target.closest("[data-wujian-flow]"); if (wuJianFlow) { advanceWuJianFlow(wuJianFlow.dataset.wujianFlow); return; }
    const wuJianReviewWork = event.target.closest("[data-wujian-review-work]");
    if (wuJianReviewWork) {
      state.wuJian.worksFilter = "review";
      state.wuJian.worksSelected = [];
      state.workspaceMode = "works";
      state.wuJian.section = "works";
      persistWuJian();
      if (!state.workspaceOpen) {
        if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace();
        else openWorkspace("works");
      } else renderWorkspace();
    if (typeof showToast === "function") showToast("进入待确认作品", "确认后会按你的发布设置继续执行");
      return;
    }
    const wuJianHistory = event.target.closest("[data-wujian-history]"); if (wuJianHistory) { state.wuJian.historyId = wuJianHistory.dataset.wujianHistory; state.workspaceMode = "history"; persistWuJian(); renderWorkspace(); return; }
    if (event.target.closest("[data-wujian-download]")) { if (typeof showToast === "function") showToast("成片已准备好", "去作品里查看或继续发布"); return; }
    const wuJianLegacyPublish = event.target.closest('[data-wujian-section="publish"]');
    if (wuJianLegacyPublish) { state.workspaceMode = "settings"; renderWorkspace(); return; }
    const wuJianSection = event.target.closest("[data-wujian-section]"); if (wuJianSection) { state.workspaceMode = wuJianSection.dataset.wujianSection; state.wuJian.section = state.workspaceMode === "create" ? "create" : "overview"; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    const wuJianCaseFilter = event.target.closest("[data-wujian-case-filter]"); if (wuJianCaseFilter) { state.wuJian.caseFilter = wuJianCaseFilter.dataset.wujianCaseFilter; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    const wuJianReplicate = event.target.closest("[data-wujian-replicate]"); if (wuJianReplicate) { applyWuJianTemplate(wuJianReplicate.dataset.wujianReplicate); return; }
    const wuJianAssetTab = event.target.closest("[data-wujian-asset-tab]"); if (wuJianAssetTab) { state.wuJian.assetTab = wuJianAssetTab.dataset.wujianAssetTab; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    const wuJianUseAsset = event.target.closest("[data-wujian-use-asset]"); if (wuJianUseAsset) { const id = wuJianUseAsset.dataset.wujianUseAsset; state.wuJian.materials = Array.from(new Set([...state.wuJian.materials, id])); state.wuJian.showPlan = true; state.workspaceMode = "create"; state.wuJian.section = "create"; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    const wuJianRemove = event.target.closest("[data-wujian-remove-material]"); if (wuJianRemove) { state.wuJian.materials = state.wuJian.materials.filter((id) => id !== wuJianRemove.dataset.wujianRemoveMaterial); persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    if (event.target.closest("[data-wujian-add-vehicle]")) { state.wuJian.assetTab = "vehicles"; state.workspaceMode = "assets"; state.wuJian.section = "assets"; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); return; }
    if (event.target.closest("[data-wujian-polish]")) { state.wuJian.script = `${state.wuJian.script}\n\n短视频运营专员优化：前 3 秒先给实测结论，每个车型事实标注知识库来源，结尾只保留一个“预约试驾”行动。`; persistWuJian(); if (!state.workspaceOpen) refreshWuJianLiveWorkspace(); else renderWorkspace(); if (typeof showToast === "function") showToast("脚本润色好了", "开头更抓人，车型信息和行动引导也更清楚"); return; }
    const wuJianUpload = event.target.closest("[data-wujian-upload]");
    if (wuJianUpload) {
      const input = wuJianUpload.closest(".wujian-assets-page")?.querySelector("[data-wujian-upload-input]");
      if (input) input.click();
      return;
    }
    const enterWorksBatchClick = event.target.closest("[data-wujian-enter-batch]");
    if (enterWorksBatchClick) {
      state.wuJian.worksBatchMode = true;
      state.wuJian.worksSelected = [];
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const cancelWorksBatchClick = event.target.closest("[data-wujian-cancel-batch]");
    if (cancelWorksBatchClick) {
      state.wuJian.worksBatchMode = false;
      state.wuJian.worksSelected = [];
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const retryGenerationClick = event.target.closest("[data-wujian-retry-generation]");
    if (retryGenerationClick) {
      state.wuJian.workspaceMode = "create";
      state.wuJian.section = "create";
      state.workspaceMode = "create";
      state.wuJian.publishResult = "已带入生成失败作品的创作配置。";
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      if (typeof showToast === "function") showToast("已准备重试", "请检查创作配置后重新生成");
      return;
    }
    const wuJianApproveWork = event.target.closest("[data-wujian-approve-work]");
    if (wuJianApproveWork) { wuJianApproveWorks([wuJianApproveWork.dataset.wujianApproveWork]); return; }
    const wuJianBatchApprove = event.target.closest("[data-wujian-batch-approve]");
    if (wuJianBatchApprove) { wuJianApproveWorks(state.wuJian.worksSelected || []); return; }
    if (event.target.closest("[data-wujian-approve]")) { state.wuJian.publishResult = "已确认，作品会按你的设置继续发布。"; state.wuJian.publishMode = "review"; persistWuJian(); renderWorkspace(); if (typeof showToast === "function") showToast("已确认发布", "作品会按你的设置继续处理"); return; }
    if (event.target.closest("[data-wujian-verify]")) { state.wuJian.publishResult = "已记录人工完成验证，可回到作品管理重新发布失败作品。"; persistWuJian(); renderWorkspace(); return; }
    const wuJianRepublish = event.target.closest("[data-wujian-republish]"); if (wuJianRepublish) { const item = wuJianWorks.find((row) => row.id === wuJianRepublish.dataset.wujianRepublish); state.wuJian.publishResult = item ? `已带入失败作品《${item.title}》的原发布配置。` : "已带入原发布配置。"; state.workspaceMode = "settings"; renderWorkspace(); return; }
    const knowledgeNav = event.target.closest("[data-knowledge-nav]");
    if (knowledgeNav) {
      event.preventDefault();
      closeWorkspace();
      const tab = knowledgeNav.dataset.knowledgeNav === "vehicles" ? "vehicles" : "dialog";
      if (window.location.hash.slice(1) !== "knowledge") window.location.hash = "knowledge";
      window.setTimeout(() => switchKnowledge(tab), 0);
      return;
    }
    const route = event.target.closest("[data-route-link]"); if (route) { closeWorkspace(); closeOnboarding(); window.location.hash = route.dataset.routeLink; return; }
    if (event.target.closest("[data-guide-done]")) { saveJson(GUIDE_KEY, "done"); $("#ai-first-guide")?.classList.remove("is-open"); $("#ai-first-guide")?.setAttribute("aria-hidden", "true"); return; }
    const settingsKnowledge = event.target.closest("[data-settings-knowledge]"); if (settingsKnowledge) { const tab = settingsKnowledge.dataset.settingsKnowledge; closeWorkspace(); window.location.hash = "knowledge"; window.setTimeout(() => switchKnowledge(tab), 60); return; }
    if (event.target.closest("[data-settings-accounts]")) { closeWorkspace(); window.location.hash = "accounts"; return; }
    if (event.target.closest("[data-settings-chat]")) {
      closeWorkspace();
      if (state.selected === "ai-video") state.sidePanelMode = "overview";
      renderSidePanel();
      window.setTimeout(() => $("[data-side-chat] textarea, [data-side-chat] input")?.focus(), 0);
      return;
    }
    const removeHandoffKeyword = event.target.closest("[data-remove-handoff-keyword]");
    if (removeHandoffKeyword) {
      removeHandoffKeyword.closest(".ai-handoff-keyword")?.remove();
      return;
    }
    const knowledge = event.target.closest("[data-knowledge-tab]"); if (knowledge) { switchKnowledge(knowledge.dataset.knowledgeTab); return; }
    const openWorkspaceButton = event.target.closest("[data-open-workspace]"); if (openWorkspaceButton) { openWorkspace(openWorkspaceButton.dataset.openWorkspace); return; }
    const workspaceTab = event.target.closest("[data-workspace-tab]"); if (workspaceTab) { state.workspaceMode = workspaceTab.dataset.workspaceTab; renderWorkspace(); return; }
    if (event.target.closest("[data-close-workspace]")) { closeWorkspace(); return; }
    if (event.target.closest("#ai-workspace-backdrop")) { closeWorkspace(); return; }
    if (event.target.closest("[data-open-snapshot]")) { openSnapshot(); return; }
    if (event.target.closest("[data-close-snapshot]")) { closeSnapshot(); return; }
    if (event.target.closest("[data-snapshot-prev]")) { seekSnapshot(state.snapshot.index - 1); return; }
    if (event.target.closest("[data-snapshot-next]")) { seekSnapshot(state.snapshot.index + 1); return; }
    if (event.target.closest("[data-snapshot-toggle]")) { if (state.snapshot.playing) { stopSnapshot(); renderSnapshot(); } else startSnapshot(); return; }
    const frame = event.target.closest("[data-snapshot-frame]"); if (frame) { seekSnapshot(frame.dataset.snapshotFrame); return; }
    if (event.target.closest("[data-toggle-pause]")) { const id = state.selected; if (id !== "supervisor") { const paused = getStatus(id) === "paused"; setStatus(id, paused ? "working" : "paused"); addThreadMessage(id, "agent", paused ? "我已经继续工作，会从原来的节点开始。" : "我已经暂停，当前上下文已保留。"); renderSidePanel(); } return; }
    if (event.target.closest("[data-resolve-waiting]")) { if (isHired("smart-reply")) { setStatus("smart-reply", "working"); addThreadMessage("smart-reply", "agent", "口径已经确认，我会使用一次性安全回复继续处理，不会把这次口径自动写入长期记忆。"); renderSidePanel(); if (state.workspaceOpen) renderWorkspace(); } return; }
    if (event.target.closest("[data-takeover]")) { if (state.selected !== "supervisor") { setStatus(state.selected, "paused"); addThreadMessage(state.selected, "agent", "已交给你接管。我会保留完整上下文，你处理完后可以让我继续。"); renderSidePanel(); } return; }
    if (event.target.closest("[data-open-evidence]")) { openWorkspace("detail"); return; }
    const memory = event.target.closest("[data-memory-confirm]"); if (memory) { confirmMemory(memory.dataset.memoryConfirm); return; }
    const remove = event.target.closest("[data-memory-remove]"); if (remove) { state.memories = state.memories.filter((item) => item.id !== remove.dataset.memoryRemove); saveJson(MEMORY_KEY, state.memories); if (state.workspaceOpen) renderWorkspace(); renderSidePanel(); return; }
    const goal = event.target.closest("[data-goal-preset]"); if (goal) { state.planStarted = true; addThreadMessage("supervisor", "user", goal.dataset.goalPreset); addThreadMessage("supervisor", "agent", "我已经用现有员工生成了可执行计划。主号获客专家负责发现，客服专员负责首轮确认，优惠承诺和低置信度会先请你确认。"); renderOfficeScene(); renderSidePanel(); return; }
    if (event.target.closest("[data-start-plan]")) { state.planStarted = true; hiredIds().forEach((id) => setStatus(id, "working")); addThreadMessage("supervisor", "agent", "协作计划已经启动。办公室里的流动线会显示当前交接状态。"); renderSidePanel(); if (state.workspaceOpen) renderWorkspace(); return; }
    if (event.target.closest("[data-supervisor-report]")) {
      selectEmployee("supervisor");
      renderSidePanel();
      window.dispatchEvent(new CustomEvent("ai-open-team-report"));
      return;
    }
    const reserve = event.target.closest("[data-reserve]"); if (reserve) { reserveEmployee(reserve.dataset.reserve); return; }
    const onboard = event.target.closest("[data-onboard]"); if (onboard) { openOnboarding(onboard.dataset.onboard, onboard.dataset.onboardStep); return; }
    if (event.target.closest("[data-close-onboarding]")) { closeOnboarding(); return; }
    const onboardingGoal = event.target.closest("[data-onboarding-goal]"); if (onboardingGoal) { state.onboarding.goal = onboardingGoal.dataset.onboardingGoal; renderOnboarding(); return; }
    if (event.target.closest("[data-onboarding-next]")) { state.onboarding.step = Math.min(4, state.onboarding.step + 1); renderOnboarding(); return; }
    if (event.target.closest("[data-onboarding-back]")) { state.onboarding.step = Math.max(0, state.onboarding.step - 1); renderOnboarding(); return; }
    if (event.target.closest("[data-onboarding-retry]")) { state.onboarding.step = 3; state.onboarding.testResult = ""; renderOnboarding(); return; }
    if (event.target.closest("[data-run-onboarding-trial]")) { const input = $("#ai-onboarding-trial-input"); state.onboarding.testResult = trialResult(state.onboarding.employee, input?.value.trim() || ""); renderOnboarding(); return; }
    if (event.target.closest("[data-confirm-hire]")) { const id = state.onboarding.employee; hiredSet().add(id); persistHires(); state.settings[id] = { ...(state.settings[id] || defaultSettings[id]), goal: state.onboarding.goal }; saveJson(SETTINGS_KEY, state.settings); closeOnboarding(); window.location.hash = "dashboard"; state.selected = id; window.setTimeout(() => { renderOffice(); selectEmployee(id); }, 0); return; }
    if (event.target.closest("[data-run-trial]")) { const output = $("#ai-trial-output"); const input = $("#ai-trial-input"); if (output) output.innerHTML = trialResult(state.selected, input?.value.trim() || ""); return; }
    const preset = event.target.closest("[data-analysis-preset]"); if (preset) { const input = $("#ai-results-analysis-input"); if (input) input.value = preset.dataset.analysisPreset; renderAnalysis(preset.dataset.analysisPreset); return; }
    if (event.target.closest("[data-open-existing-details]")) { $("[data-view='results']")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  }

  function handleSubmit(event) {
    if (event.target.matches("[data-wjv-monitor-add-form]")) {
      event.preventDefault();
      event.target.querySelector("[data-wjv-monitor-add-submit]")?.click();
      return;
    }
    if (event.target.matches("[data-side-chat]")) { event.preventDefault(); handleChatSubmit(event.target); return; }
    if (event.target.id === "ai-wujian-chat-form") { event.preventDefault(); handleWuJianChatSubmit(event.target); return; }
    if (event.target.id === "ai-wujian-create-form") { event.preventDefault(); startWuJianGeneration(event.target); return; }
    if (event.target.id === "ai-settings-form") {
      event.preventDefault();
      const form = event.target;
      const id = form.dataset.settingsEmployee;
      const formData = new FormData(form);
      const current = { ...defaultSettings[id], ...(state.settings[id] || {}) };
      const displayName = String(formData.get("displayName") || employees[id].name).trim().slice(0, 12) || employees[id].name;
      const accountEnabled = formData.getAll("accountEnabled").map(String);
      const accountLead = [...accountEnabled];
      const accountTouch = [...accountEnabled];
      const strategyMode = String(formData.get("strategyMode") || current.strategyMode || "separate");
      const requestedLead = String(formData.get("strategyLead") || accountLead[0] || "");
      const strategyLead = accountLead.includes(requestedLead) ? requestedLead : (accountLead[0] || requestedLead);
      let strategyTouch = formData.getAll("strategyTouch").map(String).filter((accountId) => accountTouch.includes(accountId));
      if (strategyMode === "main-sub" && !strategyTouch.length && accountTouch.length) strategyTouch = [...accountTouch];
      const humanCollaboration = id === "smart-reply" ? {
        humanHandoffEnabled: formData.get("humanHandoffEnabled") === "on",
        aiHandoffTimeout: String(formData.get("aiHandoffTimeout") || "").trim().slice(0, 3),
        aiHandoffTimeoutUnit: String(formData.get("aiHandoffTimeoutUnit") || ""),
        humanHandoffRules: formData.getAll("humanHandoffRule").map(String),
        keywordHandoffEnabled: formData.get("keywordHandoffEnabled") === "on",
        handoffKeywords: Array.from(new Set(formData.getAll("handoffKeyword").map((keyword) => String(keyword).trim()).filter(Boolean))).slice(0, 30),
      } : current.humanCollaboration;
      let publishByAccount = current.publishByAccount || {};
      let weeklyTarget = Number(formData.get("weeklyTarget")) || Number(current.weeklyTarget) || 4;
      if (weeklyTarget < 2 || weeklyTarget > 7) weeklyTarget = 4;
      let defaultSlot = String(formData.get("defaultSlot") || current.defaultSlot || "09:00");
      let publishModeGlobal = String(formData.get("publishMode") || current.publishModeGlobal || "review");
      if (id === "ai-video") {
        const publishAccounts = wuJianPublishAccounts(settingsAccounts(id));
        publishByAccount = Object.fromEntries(publishAccounts.map((account, index) => {
          const previous = wuJianAccountPublishConfig(current, account.nickname);
          return [account.nickname, {
            mode: String(formData.get(`publishModeByAccount_${index}`) || previous.mode),
            timing: String(formData.get(`timingByAccount_${index}`) || previous.timing),
            scheduleAt: String(formData.get(`scheduleAtByAccount_${index}`) || previous.scheduleAt),
          }];
        }));
      }
      const activePublishMode = id === "ai-video" ? (publishModeGlobal || wuJianAccountPublishConfig({ ...current, publishByAccount }, state.wuJian.account).mode) : strategyMode;
      state.settings[id] = { ...current, displayName, persona: String(formData.get("persona") || "").trim(), tone: String(formData.get("tone") || current.tone), accountEnabled, accountLead, accountTouch, strategyMode, strategyLead, strategyTouch, ...(id === "smart-reply" ? { humanCollaboration } : {}), ...(id === "ai-video" ? { publishMode: activePublishMode, publishModeGlobal, weeklyTarget, defaultSlot, publishByAccount } : {}) };
      employees[id].name = displayName;
      if (["lead-hunter", "lead-hunter-advanced"].includes(id)) {
        try {
          const enabledIds = new Set([...accountLead, ...accountTouch]);
          const sourceAccounts = id === "lead-hunter-advanced" ? advancedLeadHunterAccounts : leadHunterAccounts;
          const sourceRelation = id === "lead-hunter-advanced" ? advancedLeadHunterRelation : leadHunterRelation;
          sourceAccounts.forEach((item) => { item.enabled = enabledIds.has(item.id); });
          sourceRelation.accountIds = [...enabledIds];
          sourceRelation.mode = strategyMode;
          if (strategyMode === "main-sub") {
            sourceRelation.mainId = strategyLead;
            sourceRelation.leadPoolIds = strategyLead ? [strategyLead] : [];
            sourceRelation.touchPoolIds = [...strategyTouch];
            sourceRelation.subIds = [...strategyTouch];
          } else {
            sourceRelation.leadPoolIds = [...accountLead];
            sourceRelation.touchPoolIds = [...accountTouch];
            sourceRelation.subIds = [...accountTouch];
          }
        } catch (error) { /* the settings remain saved even if legacy account data is unavailable */ }
      } else {
        const accountState = loadJson(ACCOUNT_KEY, null);
        if (accountState) {
          const enabledIds = new Set([...accountLead, ...accountTouch]);
          Object.values(accountState).flat().forEach((item) => { item.service = { ...(item.service || {}), [id]: enabledIds.has(item.id) }; });
          saveJson(ACCOUNT_KEY, accountState);
        }
      }
      saveJson(SETTINGS_KEY, state.settings);
      if (id === "ai-video") {
        const activeConfig = wuJianAccountPublishConfig(state.settings[id], state.wuJian.account);
        state.wuJian.publishMode = activeConfig.mode;
        state.wuJian.timing = activeConfig.timing;
        state.wuJian.scheduleAt = activeConfig.scheduleAt;
        persistWuJian();
        const history = Array.isArray(state.wuJian.publishStrategyHistory) ? state.wuJian.publishStrategyHistory : [];
        history.push({ time: nowDateTime(), account: state.wuJian.account, mode: activeConfig.mode, timing: activeConfig.timing, scheduleAt: activeConfig.scheduleAt, source: "发布策略已在 Agent 设置中确认" });
        state.wuJian.publishStrategyHistory = history.slice(-12);
        state.sidePanelMode = "overview";
        persistWuJian();
      }
      addThreadMessage(id, "agent", `${id === "ai-video" ? "身份和账号权限已更新" : "身份、账号权限和触达策略已更新"}。从下一次任务开始，我会按新设置工作。`);
      if (typeof showToast === "function") showToast(`${employees[id].name}的设置已保存`, "新设置会从下一次任务开始生效");
      renderOfficeScene();
      renderSidePanel();
      if (state.workspaceOpen) renderWorkspace();
      return;
    }
    if (event.target.id === "ai-results-analysis-form") { event.preventDefault(); renderAnalysis($("#ai-results-analysis-input")?.value.trim() || "团队结果"); }
  }

  function handleChange(event) {
    const wjvAccountWorkFilter = event.target.closest("[data-wjv-account-work-filter]");
    if (wjvAccountWorkFilter) {
      const key = wjvAccountWorkFilter.dataset.wjvAccountWorkFilter || "all";
      const current = v13AccountWorkFilters();
      let next;
      if (key === "all") {
        next = wjvAccountWorkFilter.checked ? ["all"] : [...V13_ACCOUNT_WORK_FILTERS];
      } else if (current.includes("all")) {
        next = wjvAccountWorkFilter.checked ? [key] : V13_ACCOUNT_WORK_FILTERS.filter((filter) => filter !== key);
      } else {
        const selected = new Set(current.filter((filter) => filter !== "all"));
        if (wjvAccountWorkFilter.checked) selected.add(key); else selected.delete(key);
        next = Array.from(selected);
      }
      if (!next.length) next = ["all"];
      const legacyFilter = next.includes("all") ? "all" : next[0];
      v13Patch({ accountWorksFilters: next, accountWorksFilter: legacyFilter });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvAccount = event.target.closest("[data-wjv-account]");
    if (wjvAccount) {
      const selected = new Set(v13State().taskAccounts || []);
      if (wjvAccount.checked) selected.add(wjvAccount.dataset.wjvAccount); else selected.delete(wjvAccount.dataset.wjvAccount);
      v13Patch({ taskAccounts: Array.from(selected) });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvWork = event.target.closest("[data-wjv-work]");
    if (wjvWork) {
      const selected = new Set(v13State().taskWorks || []);
      if (wjvWork.checked) selected.add(wjvWork.dataset.wjvWork); else selected.delete(wjvWork.dataset.wjvWork);
      v13Patch({ taskWorks: Array.from(selected) });
      refreshWuJianLiveWorkspace();
      return;
    }
    const wjvSchedule = event.target.closest("[data-wjv-schedule]");
    if (wjvSchedule) {
      v13Patch({ taskScheduleAt: wjvSchedule.value || "2026-08-26T18:30" });
      return;
    }
    const wjvUploadInput = event.target.closest("[data-wjv-upload-input]");
    if (wjvUploadInput) {
      const files = Array.from(wjvUploadInput.files || []);
      const uploads = Array.isArray(v13State().worksPoolUploads) ? v13State().worksPoolUploads : [];
      const accepted = [];
      const rejected = [];
      files.forEach((file) => {
        const check = wuJianVideoFileCheck(file);
        if (!check.ok) { rejected.push(`${file.name || "该视频"}：${check.copy}`); return; }
        const video = typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";
        if (video) wuJianUploadedBlobUrls.add(video);
        accepted.push({ id: `up-${Date.now()}-${accepted.length}`, title: file.name || "客户上传视频.mp4", source: "用户上传", from: "客户上传", duration: "待识别", size: wuJianFileSize(file.size), grabbedAt: "刚刚", video });
      });
      if (accepted.length) v13Patch({ worksPoolUploads: [...accepted, ...uploads].slice(0, 20) });
      if (rejected.length && typeof showToast === "function") showToast(accepted.length ? "部分视频未通过校验" : "上传失败", rejected.join("；"));
      if (accepted.length && typeof showToast === "function") showToast("校验通过，已加入作品库", `${accepted.map((item) => item.title).join("、")} 已进入待发布作品池`);
      wjvUploadInput.value = "";
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskAccountId = event.target.closest("[data-wujian-publish-account-id]");
    if (publishTaskAccountId) {
      const selected = new Set(state.wuJian.publishTaskAccountIds || []);
      const id = publishTaskAccountId.dataset.wujianPublishAccountId;
      if (publishTaskAccountId.checked) selected.add(id); else selected.delete(id);
      state.wuJian.publishTaskAccountIds = Array.from(selected);
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskWorkId = event.target.closest("[data-wujian-publish-work-id]");
    if (publishTaskWorkId) {
      const selected = new Set(state.wuJian.publishTaskWorkIds || []);
      const id = publishTaskWorkId.dataset.wujianPublishWorkId;
      if (publishTaskWorkId.checked) selected.add(id); else selected.delete(id);
      state.wuJian.publishTaskWorkIds = Array.from(selected);
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskUploadInput = event.target.closest("[data-wujian-publish-upload-input]");
    if (publishTaskUploadInput) {
      wuJianPublishTaskUpload(publishTaskUploadInput.files);
      publishTaskUploadInput.value = "";
      return;
    }
    const libraryUploadInput = event.target.closest("[data-wujian-library-upload-input]");
    if (libraryUploadInput) {
      wuJianPublishTaskUpload(libraryUploadInput.files);
      libraryUploadInput.value = "";
      return;
    }
    const wjvTitleCopy = event.target.closest("[data-wjv-title-copy]");
    if (wjvTitleCopy) {
      v13Patch({ taskTitleCopy: wjvTitleCopy.value || "" });
      const stepFooterBtn = wjvTitleCopy.closest(".wjv-step")?.querySelector("[data-wjv-step-next]");
      if (stepFooterBtn) stepFooterBtn.disabled = !wjvTitleCopy.value.trim();
      return;
    }
    const publishTaskSchedule = event.target.closest("[data-wujian-publish-task-schedule]");
    if (publishTaskSchedule) {
      state.wuJian.publishTaskScheduleAt = publishTaskSchedule.value || state.wuJian.publishTaskScheduleAt;
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const publishTaskScript = event.target.closest("[data-wujian-publish-script]");
    if (publishTaskScript) {
      state.wuJian.publishTaskScript = publishTaskScript.value || "";
      persistWuJian();
      return;
    }
    const publishAccountSelect = event.target.closest("[data-wujian-publish-account-select]");
    if (publishAccountSelect) {
      const selected = new Set(state.wuJian.publishAccountIds || []);
      const id = publishAccountSelect.dataset.wujianPublishAccountSelect;
      if (publishAccountSelect.checked) selected.add(id); else selected.delete(id);
      state.wuJian.publishAccountIds = Array.from(selected);
      persistWuJian();
      renderWorkspace();
      return;
    }
    const pickerUploadInput = event.target.closest("[data-wujian-picker-upload-input]");
    if (pickerUploadInput) {
      handleWuJianUpload(pickerUploadInput.files);
      pickerUploadInput.value = "";
      return;
    }
    const publishSchedule = event.target.closest("[data-wujian-publish-schedule]");
    if (publishSchedule) {
      state.wuJian.scheduleAt = publishSchedule.value || state.wuJian.scheduleAt;
      persistWuJian();
      return;
    }
    const worksFilterAccount = event.target.closest("[data-wujian-works-filter-account]");
    if (worksFilterAccount) {
      state.wuJian.worksPoolAccountFilter = worksFilterAccount.value || "all";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const worksFilterStatus = event.target.closest("[data-wujian-works-filter-status]");
    if (worksFilterStatus) {
      state.wuJian.worksPoolStatusFilter = worksFilterStatus.value || "all";
      persistWuJian();
      refreshWuJianLiveWorkspace();
      return;
    }
    const wuJianUploadInput = event.target.closest("[data-wujian-upload-input]");
    if (wuJianUploadInput) {
      handleWuJianUpload(wuJianUploadInput.files);
      wuJianUploadInput.value = "";
      return;
    }
    const worksFilter = event.target.closest("[data-wujian-status-filter]");
    if (worksFilter) {
      state.wuJian.worksFilter = worksFilter.value;
      state.wuJian.worksSelected = [];
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const enterWorksBatch = event.target.closest("[data-wujian-enter-batch]");
    if (enterWorksBatch) {
      state.wuJian.worksBatchMode = true;
      state.wuJian.worksSelected = [];
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const cancelWorksBatch = event.target.closest("[data-wujian-cancel-batch]");
    if (cancelWorksBatch) {
      state.wuJian.worksBatchMode = false;
      state.wuJian.worksSelected = [];
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const workSelect = event.target.closest("[data-wujian-work-select]");
    if (workSelect) {
      const selected = new Set(state.wuJian.worksSelected || []);
      const id = workSelect.dataset.wujianWorkSelect;
      if (workSelect.checked) selected.add(id);
      else selected.delete(id);
      state.wuJian.worksSelected = Array.from(selected);
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      return;
    }
    const retryGeneration = event.target.closest("[data-wujian-retry-generation]");
    if (retryGeneration) {
      state.wuJian.workspaceMode = "create";
      state.wuJian.section = "create";
      state.workspaceMode = "create";
      state.wuJian.publishResult = "已带入生成失败作品的创作配置。";
      persistWuJian();
      if (event.target.closest("#demo-live-workspace")) refreshWuJianLiveWorkspace(); else renderWorkspace();
      if (typeof showToast === "function") showToast("已准备重试", "请检查创作配置后重新生成");
      return;
    }
    const wuJianCreatorControl = event.target.closest("#ai-wujian-create-form [data-wujian-control]");
    if (wuJianCreatorControl) { state.wuJian[wuJianCreatorControl.name] = wuJianCreatorControl.type === "checkbox" ? wuJianCreatorControl.checked : wuJianCreatorControl.value; persistWuJian(); return; }
    const goal = event.target.closest(".ai-settings-goals input");
    if (goal) $$(".ai-settings-goals label").forEach((label) => label.classList.toggle("is-selected", $("input", label)?.checked));
    const strategy = event.target.closest("[data-strategy-mode]");
    if (strategy) {
      $$(".ai-strategy-options > label", strategy.closest(".ai-config-strategy")).forEach((label) => label.classList.toggle("is-selected", $("input", label)?.checked));
      const pools = $(".ai-strategy-pools", strategy.closest(".ai-config-strategy"));
      if (pools) pools.hidden = strategy.value !== "main-sub";
    }
    const humanSwitch = event.target.closest(".ai-human-settings .ai-switch input");
    if (humanSwitch) {
      const label = humanSwitch.closest(".ai-switch");
      const copy = $("span", label);
      if (copy) copy.textContent = humanSwitch.checked ? "已开启" : "已关闭";
    }
    const keywordInput = event.target.closest("[data-handoff-keyword-input]");
    if (keywordInput && event.type === "change") {
      const keyword = keywordInput.value.trim().slice(0, 8);
      if (!keyword) return;
      const list = keywordInput.closest(".ai-handoff-keyword-editor")?.querySelector(".ai-handoff-keyword-list");
      if (!list || $$('input[name="handoffKeyword"]', list).some((input) => input.value === keyword)) { keywordInput.value = ""; return; }
      list.insertAdjacentHTML("beforeend", `<span class="ai-handoff-keyword"><b>${escapeHtml(keyword)}</b><button type="button" data-remove-handoff-keyword="${escapeHtml(keyword)}" aria-label="移除关键词 ${escapeHtml(keyword)}">×</button><input type="hidden" name="handoffKeyword" value="${escapeHtml(keyword)}"></span>`);
      keywordInput.value = "";
    }
    const publishMode = event.target.closest('[name^="publishModeByAccount_"]');
    if (publishMode) {
      const group = publishMode.closest(".ai-publish-mode-options");
      $$("label", group).forEach((label) => label.classList.toggle("is-selected", $("input", label)?.checked));
      return;
    }
    const poolAccount = event.target.closest(".ai-strategy-account-option input");
    if (poolAccount) {
      const pool = poolAccount.closest(".ai-strategy-pool");
      $$(".ai-strategy-account-option", pool).forEach((label) => label.classList.toggle("is-selected", $("input", label)?.checked));
    }
    const avatarInput = event.target.closest("[data-agent-avatar-input]");
    if (avatarInput?.files?.[0]) {
      const file = avatarInput.files[0];
      if (file.size > 3 * 1024 * 1024) { if (typeof showToast === "function") showToast("头像未更换", "请选择小于 3MB 的图片"); avatarInput.value = ""; return; }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const form = avatarInput.closest("#ai-settings-form");
        const id = form?.dataset.settingsEmployee;
        if (!id || typeof reader.result !== "string") return;
        state.settings[id] = { ...defaultSettings[id], ...(state.settings[id] || {}), avatar: reader.result };
        const preview = $("[data-agent-avatar-preview]", form);
        if (preview) preview.src = reader.result;
      }, { once: true });
      reader.readAsDataURL(file);
    }
  }

  /* 标题正文就地编辑：不整体重渲染，避免输入过程中失焦 */
  function handleInput(event) {
    const copyField = event.target.closest("[data-wjv-title-copy]");
    if (copyField) {
      v13Patch({ taskTitleCopy: copyField.value || "" });
      const stepBtn = copyField.closest(".wjv-step")?.querySelector("[data-wjv-step-next]");
      if (stepBtn) stepBtn.disabled = !copyField.value.trim();
      return;
    }
    const titleInput = event.target.closest("[data-wjv-ai-title]");
    if (!titleInput) return;
    const workId = titleInput.dataset.wjvAiTitle || "";
    const record = v13State().taskTitles?.[workId];
    if (!record) return;
    record.title = titleInput.value;
    record.edited = true;
    persistWuJian();
    const row = titleInput.closest(".wjv-ai-row");
    const length = v13TitleText(record).length;
    const count = row?.querySelector(`[data-wjv-ai-count="${workId}"]`);
    if (count) { count.textContent = `${length}/${V13_TITLE_MAX}`; count.classList.toggle("is-over", length > V13_TITLE_MAX); }
    const error = row?.querySelector(`[data-wjv-ai-error="${workId}"]`);
    if (error) error.textContent = v13TitleIssue(record);
    if (row && !row.querySelector(".wjv-ai-edited")) row.querySelector(".wjv-ai-row-head")?.insertAdjacentHTML("beforeend", `<em class="wjv-ai-edited">用户修改</em>`);
    v13SyncAiSubmitState();
  }
  function v13SyncAiSubmitState() {
    const s = v13State();
    if ((s.taskTitleMode || "none") !== "ai-expand") return;
    const works = v13Works().filter((w) => (s.taskWorks || []).includes(w.id));
    const records = s.taskTitles || {};
    const submit = document.querySelector("[data-wjv-submit]");
    if (submit) submit.disabled = works.some((w) => v13TitleIssue(records[w.id]));
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && event.target.closest("[data-wjv-ai-tag-input]")) {
      event.preventDefault();
      v13AddAiTag(event.target.dataset.wjvAiTagInput || "", event.target.dataset.wjvAiTagInput || "");
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && event.target.closest("[data-wujian-publish-chat-input]")) {
      event.preventDefault();
      event.target.closest(".ai-publish-chat-composer")?.querySelector("[data-wujian-publish-chat-send]")?.click();
      return;
    }
    const keywordInput = event.target.closest("[data-handoff-keyword-input]");
    if (!keywordInput || event.key !== "Enter") return;
    event.preventDefault();
    const keyword = keywordInput.value.trim().slice(0, 8);
    if (!keyword) return;
    const list = keywordInput.closest(".ai-handoff-keyword-editor")?.querySelector(".ai-handoff-keyword-list");
    if (!list || $$('input[name="handoffKeyword"]', list).some((input) => input.value === keyword)) { keywordInput.value = ""; return; }
    list.insertAdjacentHTML("beforeend", `<span class="ai-handoff-keyword"><b>${escapeHtml(keyword)}</b><button type="button" data-remove-handoff-keyword="${escapeHtml(keyword)}" aria-label="移除关键词 ${escapeHtml(keyword)}">×</button><input type="hidden" name="handoffKeyword" value="${escapeHtml(keyword)}"></span>`);
    keywordInput.value = "";
  }

  function handleWuJianCoverError(event) {
    const image = event.target?.closest?.("img[data-wujian-case-cover]");
    if (!image) return;
    const attempts = Number(image.dataset.wujianCoverRetry || 0);
    if (attempts < 1) {
      const retryUrl = new URL(image.dataset.wujianCoverSource || image.src, document.baseURI);
      retryUrl.searchParams.set("v", `${WUJIAN_CASE_COVER_REV}-retry`);
      image.dataset.wujianCoverRetry = "1";
      image.src = retryUrl.href;
      return;
    }
    const fallbackSource = image.dataset.wujianVideoFallback;
    if (!fallbackSource) return;
    const video = document.createElement("video");
    video.className = "wujian-material-video-cover";
    video.src = new URL(fallbackSource, document.baseURI).href;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    image.replaceWith(video);
    video.load();
  }

  function onRouteChange() {
    const route = window.location.hash.slice(1) || "dashboard";
    document.body.classList.toggle("is-office-default", route === "dashboard");
    document.body.classList.toggle("is-talent-route", route === "plaza");
    if (route !== "live") closeWorkspace();
    if (route === "dashboard") window.setTimeout(renderOffice, 0);
    if (route === "plaza") window.setTimeout(renderTalentPage, 0);
    if (route === "vehicles" || route === "digital-human") {
      requestedKnowledgeTab = route === "vehicles" ? "vehicles" : "dialog";
      window.location.hash = "knowledge";
    }
    if (route === "knowledge") {
      const tab = requestedKnowledgeTab;
      requestedKnowledgeTab = "dialog";
      window.setTimeout(() => switchKnowledge(tab), 0);
    }
    closeSnapshot();
  }

  function init() {
    ensureDemoTeam();
    decorateNavigation();
    createKnowledgePage();
    renderOffice();
    renderTalentPage();
    ensureWorkspace();
    ensureSnapshotOverlay();
    ensureOnboarding();
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("change", handleChange);
    document.addEventListener("input", handleInput);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("error", handleWuJianCoverError, true);
    window.addEventListener("ai-office-settings-sync", (event) => {
      const id = event.detail?.id;
      if (!id || !event.detail?.settings) return;
      state.settings[id] = { ...(state.settings[id] || defaultSettings[id] || {}), ...event.detail.settings };
      if (state.selected === id) renderOffice();
    });
    window.addEventListener("ai-office-agent-click", (event) => {
      const id = event.detail?.id;
      if (id === "supervisor" || employees[id]) selectEmployee(id);
    });
    window.addEventListener("hashchange", onRouteChange);
    window.setInterval(() => { state.activityIndex += 1; renderActivity(); }, 4200);
    startLiveSnapshot();
    try { if (typeof navigate === "function") navigate(); } catch (error) { /* current route is already visible */ }
    onRouteChange();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();

/* Results center: records-only secondary navigation and reporting. */
(() => {
  "use strict";
  const viewSelector = '[data-view="results"]';
  const sampleDate = "2026-07-30";
  const roles = [
    { id: "main", name: "主号获客专家" },
    { id: "sub", name: "副号获客专家" },
    { id: "service", name: "客服专员" },
    { id: "content", name: "短视频运营专员" }
  ];
  const state = {
    tab: "prospects",
    start: sampleDate,
    end: sampleDate,
    role: "all",
    account: "all",
    platform: "all",
    filterMode: "role",
    prospect: { account: "", intent: "high", model: "", touch: "", reply: "", lead: "" },
    leadFilters: { platform: "all", leadType: "all", twoElementType: "all", contactType: "all", city: "all" },
    leadCategory: "sales",
    leadChartMode: "contact",
    leadQuery: "",
    contentAccount: "all",
    contentQuery: "",
    contentStart: "2026-07-29",
    contentEnd: "2026-08-27",
    contentPage: 1,
    datePreset: "today",
    rendering: false
  };
  let observer;
  let contentQueryTimer;

  const leadCategoryLabels = {
    sales: "销售",
    acquisition: "收购",
    other: "其他"
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function num(value) { return Number(value || 0).toLocaleString("zh-CN"); }
  function dateOf(value) { return String(value || sampleDate).slice(0, 10); }
  function inRange(date) {
    const start = state.start <= state.end ? state.start : state.end;
    const end = state.start <= state.end ? state.end : state.start;
    return date >= start && date <= end;
  }
  function roleFor(index) { return roles[index < 4 ? 0 : index < 7 ? 1 : 2]; }
  function statusFor(index) { return ["授权正常", "授权异常", "未授权", "授权过期"][index % 4]; }

  function rawProspects() {
    const records = Array.isArray(window.prdProspectRecords) ? window.prdProspectRecords : [];
    return records.map(function (item, index) {
      const role = roleFor(index);
      return {
        ...item,
        id: String(item.id || "prospect-" + index),
        roleId: role.id,
        role: role.name,
        prospectAccount: item.prospectAccount || item.account || "账号 " + String.fromCharCode(65 + index),
        touchAccount: item.touchAccount || item.acquisitionAccount || item.account || "账号 " + String.fromCharCode(65 + index),
        account: item.prospectAccount || item.account || "账号 " + String.fromCharCode(65 + index),
        acquisitionAccount: item.acquisitionAccount || item.prospectAccount || item.account || "账号 " + String.fromCharCode(65 + index),
        platform: item.platform || "抖音",
        authStatus: statusFor(index),
        date: dateOf(item.searchedAt),
        avatar: item.avatar || "assets/portraits/lead-hunter.jpg"
      };
    });
  }
  function prospects() {
    return rawProspects().filter(function (item) {
      return inRange(item.date)
        && (state.role === "all" || item.roleId === state.role)
        && (state.account === "all" || item.account === state.account || item.acquisitionAccount === state.account)
        && (state.platform === "all" || item.platform === state.platform);
    });
  }
  function adPlanFor(item) {
    const raw = item && (item.adPlan || item.advertisingPlan || item.ad);
    if (raw && typeof raw === "object") {
      return {
        type: raw.type || raw.trafficType || raw.source || "广告流量",
        adId: raw.adId || raw.id || "—",
        advertiserName: raw.advertiserName || raw.advertiser || raw.adName || "—",
        planId: raw.planId || raw.campaignId || "—",
        creativeId: raw.creativeId || "—",
        advertiserAccountId: raw.advertiserAccountId || raw.advertiserId || "—",
        planName: raw.planName || raw.campaignName || raw.campaign || "—"
      };
    }
    if (item && (item.sourceType === "广告流量" || item.trafficType === "广告流量")) {
      return {
        type: "广告流量",
        adId: item.adId || "—",
        advertiserName: item.advertiserName || "—",
        planId: item.planId || "—",
        creativeId: item.creativeId || "—",
        advertiserAccountId: item.advertiserAccountId || "—",
        planName: item.planName || "—"
      };
    }
    return null;
  }
  function rawLeads() {
    const records = Array.isArray(window.prdLeadRecords) ? window.prdLeadRecords : rawProspects();
    return records.map(function (item, index) {
      const role = roleFor(index);
      const rawCategory = item.leadCategory || item.businessType;
      const category = rawCategory === "销售" ? "sales" : rawCategory === "收购" ? "acquisition" : rawCategory === "其他" ? "other" : rawCategory || ["sales", "sales", "sales", "sales", "acquisition", "acquisition", "acquisition", "sales", "acquisition", "other"][index % 10] || "other";
      return {
        ...item,
        id: String(item.id || "lead-" + index),
        roleId: item.roleId || role.id,
        role: item.role || role.name,
        account: item.acquisitionAccount || item.prospectAccount || "账号 " + String.fromCharCode(65 + index),
        platform: item.platform || "抖音",
        authStatus: statusFor(index),
        date: dateOf(item.latestAcquiredAt || item.leadTime || item.searchedAt),
        phone: item.phone || "—",
        wechat: item.wechat || "—",
        model: item.model || "—",
        city: item.city || "—",
        leadType: item.leadType || item.retentionType || (item.leadTag === "多次留资" ? "多次留资" : "非多次留资"),
        twoElementType: item.twoElementType || item.twoElementsType || item.twoFactorType || (index % 3 === 0 ? "二要素线索" : "非二要素线索"),
        threeElementType: item.threeElementType || (index % 3 === 0 ? "三要素线索" : "非三要素线索"),
        contactType: item.contactType === "phone" || item.contactType === "手机" ? "手机号" : item.contactType === "wechat" || item.contactType === "微信" ? "微信号" : item.contactType || (index % 2 === 0 ? "手机号" : "微信号"),
        leadCategory: leadCategoryLabels[category] ? category : "other",
        adPlan: adPlanFor(item)
      };
    });
  }
  function leads() {
    const query = String(state.leadQuery || "").trim().toLowerCase();
    return rawLeads().filter(function (item) {
      if (!leadMatches(item, true)) return false;
      if (!query) return true;
      return [item.name, item.phone, item.wechat, item.sourceContent, item.sourceType, item.account]
        .some(function (value) { return String(value || "").toLowerCase().includes(query); });
    });
  }
  function leadMatches(item, includeCategory) {
    return inRange(item.date)
      && (state.role === "all" || item.roleId === state.role)
      && (state.account === "all" || item.account === state.account)
      && (state.platform === "all" || item.platform === state.platform)
      && (state.leadFilters.platform === "all" || item.platform === state.leadFilters.platform)
      && (state.leadFilters.leadType === "all" || item.leadType === state.leadFilters.leadType)
      && (state.leadFilters.twoElementType === "all" || item.twoElementType === state.leadFilters.twoElementType)
      && (state.leadFilters.contactType === "all" || item.contactType === state.leadFilters.contactType)
      && (state.leadFilters.city === "all" || item.city === state.leadFilters.city)
      && (!includeCategory || state.leadCategory === "all" || item.leadCategory === state.leadCategory);
  }
  function contentRows() {
    const query = String(state.contentQuery || "").trim().toLowerCase();
    const rows = typeof window.aiVideoPublishResults === "function" ? window.aiVideoPublishResults() : [];
    return rows.filter(function (item) {
      const date = dateOf(item.publishedAt);
      const titleMatch = !query || [item.materialTitle, item.publishedTitle].some(function (value) { return String(value || "").toLowerCase().includes(query); });
      const start = state.contentStart <= state.contentEnd ? state.contentStart : state.contentEnd;
      const end = state.contentStart <= state.contentEnd ? state.contentEnd : state.contentStart;
      return date >= start && date <= end && (state.contentAccount === "all" || state.contentAccount === item.accountId) && titleMatch;
    });
  }

  function filterDimensionMarkup() {
    const mode = state.filterMode || "role";
    const modeLabel = mode === "role" ? "按岗位" : mode === "account" ? "按账号" : "按平台";
    const accounts = Array.from(new Set(
      rawProspects().map(function (item) { return item.acquisitionAccount || item.account; })
        .concat(rawLeads().map(function (item) { return item.account; }))
        .concat(["抖音账号 A", "抖音账号 B", "快手账号 C"])
    ));
    const values = mode === "role"
      ? roles.map(function (item) { return { value: item.id, label: item.name }; })
      : mode === "account"
        ? accounts.map(function (item) { return { value: item, label: item }; })
        : [{ value: "抖音", label: "抖音" }, { value: "快手", label: "快手" }];
    const current = mode === "role" ? state.role : mode === "account" ? state.account : state.platform;
    const emptyLabel = mode === "role" ? "全部岗位" : mode === "account" ? "全部账号" : "全部平台";
    const options = ['<option value="all" ' + (current === "all" ? "selected" : "") + ">" + emptyLabel + "</option>"]
      .concat(values.map(function (item) {
        return '<option value="' + esc(item.value) + '" ' + (current === item.value ? "selected" : "") + ">" + esc(item.label) + "</option>";
      })).join("");
    return '<label class="results-filter-mode"><span>筛选维度</span><select data-results-filter-mode aria-label="筛选维度">'
      + '<option value="role" ' + (mode === "role" ? "selected" : "") + '>按岗位</option>'
      + '<option value="account" ' + (mode === "account" ? "selected" : "") + '>按账号</option>'
      + '<option value="platform" ' + (mode === "platform" ? "selected" : "") + '>按平台</option>'
      + '</select></label><label class="results-filter-value"><span>' + modeLabel
      + '</span><select data-results-filter-value aria-label="' + modeLabel + '">' + options + "</select></label>";
  }

  function globalFilters() {
    const min = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const max = new Date().toISOString().slice(0, 10);
    if (state.tab === "prospects") {
      const accounts = Array.from(new Set(rawProspects().map(function (item) { return item.prospectAccount || item.account; }).filter(Boolean)));
      const accountOptions = ['<option value="all" ' + (state.account === "all" ? "selected" : "") + '>全部潜客账号</option>']
        .concat(accounts.map(function (account) { return '<option value="' + esc(account) + '" ' + (state.account === account ? "selected" : "") + '>' + esc(account) + '</option>'; })).join("");
      const ranges = [["yesterday", "昨日"], ["week", "七日"], ["month", "近30天"]];
      const rangeButtons = ranges.map(function (item) {
        return '<button type="button" class="results-prospect-range ' + (state.datePreset === item[0] ? "is-active" : "") + '" data-results-prospect-range="' + item[0] + '">' + item[1] + '</button>';
      }).join("");
      return '<header class="results-prospect-heading"><div class="results-prospect-heading__title"><h1>潜客记录</h1><span>记录潜客识别、触达、回复与留资结果，支持按条件筛选和下钻。</span></div>'
        + '<div class="results-prospect-heading__controls"><label class="results-prospect-date-range"><span class="sr-only">开始日期</span><input type="date" data-results-filter="start" min="' + min + '" max="' + max + '" value="' + state.start + '"><b aria-hidden="true">至</b><span class="sr-only">结束日期</span><input type="date" data-results-filter="end" min="' + min + '" max="' + max + '" value="' + state.end + '"><i aria-hidden="true">▣</i></label>'
        + '<div class="results-prospect-range-group" role="group" aria-label="快捷日期范围">' + rangeButtons + '</div>'
        + '<label class="results-prospect-account"><span class="sr-only">潜客账号</span><select data-results-prospect-global-account aria-label="全部潜客账号">' + accountOptions + '</select></label></div></header>';
    }
    if (state.tab === "leads") {
      const accounts = Array.from(new Set(rawLeads().map(function (item) { return item.account; }).filter(Boolean)));
      const accountOptions = ['<option value="all" ' + (state.account === "all" ? "selected" : "") + '>全部账号</option>']
        .concat(accounts.map(function (account) { return '<option value="' + esc(account) + '" ' + (state.account === account ? "selected" : "") + '>' + esc(account) + '</option>'; })).join("");
      const ranges = [
        ["today", "今日"],
        ["yesterday", "昨日"],
        ["week", "七日"],
        ["month", "近30天"]
      ];
      const rangeButtons = ranges.map(function (item) {
        return '<button type="button" class="results-lead-range ' + (state.datePreset === item[0] ? "is-active" : "") + '" data-results-lead-range="' + item[0] + '">' + item[1] + '</button>';
      }).join("");
      return '<header class="results-lead-heading">'
        + '<div class="results-lead-heading__title"><h2>线索记录</h2><span>数据更新时间 2026-08-25 19:12:13</span></div>'
        + '<div class="results-lead-heading__controls">'
        + '<label class="results-lead-date-range"><span class="sr-only">开始日期</span><input type="date" data-results-filter="start" min="' + min + '" max="' + max + '" value="' + state.start + '"><b aria-hidden="true">至</b><span class="sr-only">结束日期</span><input type="date" data-results-filter="end" min="' + min + '" max="' + max + '" value="' + state.end + '"><i aria-hidden="true">▣</i></label>'
        + '<div class="results-lead-range-group" role="group" aria-label="快捷日期范围">' + rangeButtons + '</div>'
        + '<label class="results-lead-account"><span class="sr-only">账号</span><select data-results-lead-account aria-label="全部账号">' + accountOptions + '</select></label>'
        + '</div></header>';
    }
    if (state.tab === "content") {
      const rows = contentRows();
      const accounts = Array.from(new Map((typeof window.aiVideoPublishResults === "function" ? window.aiVideoPublishResults() : []).map(function (item) { return [item.accountId, item]; })).values());
      const updatedAt = rows.reduce(function (latest, item) { return String(item.metricsUpdatedAt || "") > latest ? String(item.metricsUpdatedAt) : latest; }, "") || "等待首次同步";
      return '<header class="results-content-heading"><div class="results-content-heading__title"><h2>内容效果记录</h2><span>数据更新于 ' + esc(updatedAt) + ' · 当前 ' + rows.length + ' 条</span></div>'
        + '<div class="results-content-heading__controls"><label class="results-content-date-range"><span class="sr-only">开始日期</span><input type="date" data-results-content-filter="start" value="' + state.contentStart + '"><b aria-hidden="true">至</b><span class="sr-only">结束日期</span><input type="date" data-results-content-filter="end" value="' + state.contentEnd + '"></label>'
        + '<label class="results-content-account"><span class="sr-only">发布账号</span><select data-results-content-account aria-label="发布账号"><option value="all" ' + (state.contentAccount === "all" ? "selected" : "") + '>全部账号</option>' + accounts.map(function (item) { return '<option value="' + esc(item.accountId) + '" ' + (state.contentAccount === item.accountId ? "selected" : "") + '>' + esc(item.accountName) + '</option>'; }).join("") + '</select></label>'
        + '<label class="results-content-query"><span class="sr-only">作品名称</span><input type="search" data-results-content-query value="' + esc(state.contentQuery) + '" placeholder="搜索作品名称" aria-label="搜索作品名称"></label>'
        + '<button type="button" class="results-content-reset" data-results-content-reset>重置</button><button type="button" data-results-export ' + (!rows.length ? "disabled" : "") + '>⇩ 导出</button></div></header>';
    }
    const exportAction = state.tab === "leads"
      ? '<div class="results-lead-download-wrap"><button type="button" data-results-lead-download aria-haspopup="menu" aria-controls="results-lead-download-menu" aria-expanded="false">⇩ 下载</button><div class="results-lead-download-menu" id="results-lead-download-menu" data-results-lead-download-menu role="menu" hidden><button type="button" role="menuitem" data-results-lead-export="result">线索结果明细</button><button type="button" role="menuitem" data-results-lead-export="detail">线索明细</button></div></div>'
      : '<button type="button" data-results-export>⇩ 导出 Excel</button>';
    return '<div class="results-v12-toolbar" data-compact-dimension="true">'
      + '<label><span>统计开始日期</span><input type="date" data-results-filter="start" min="' + min + '" max="' + max + '" value="' + state.start + '"></label>'
      + '<label><span>统计结束日期</span><input type="date" data-results-filter="end" min="' + min + '" max="' + max + '" value="' + state.end + '"></label>'
      + filterDimensionMarkup()
      + '<i></i><button type="button" data-results-refresh>↻ 刷新</button>'
      + exportAction + '</div>';
  }

  function legacySelect(key, label, values) {
    const isIntent = key === "intent";
    const current = state.prospect[key] || (isIntent ? "high" : "");
    const firstOption = isIntent
      ? '<option value="high" ' + (current === "high" ? "selected" : "") + '>有意向潜客</option>'
        + '<option value="all" ' + (current === "all" ? "selected" : "") + '>全部潜客</option>'
      : '<option value="">' + esc(label) + '</option>';
    return '<label><span class="sr-only">' + esc(label) + '</span><select data-results-prospect-filter="' + key + '">' + firstOption
      + values.map(function (item) {
        const value = item && typeof item === "object" ? item.value : item;
        const text = item && typeof item === "object" ? item.label : item;
        return '<option value="' + esc(value) + '" ' + (current === value ? "selected" : "") + ">" + esc(text) + "</option>";
      }).join("")
      + "</select></label>";
  }

  function leadFilterSelect(key, label, values) {
    const current = state.leadFilters[key] || "all";
    const options = [{ value: "all", label: "全部" + label }].concat(values.map(function (value) {
      return { value, label: value };
    }));
    return '<label><span>' + esc(label) + '</span><select data-results-lead-filter="' + esc(key) + '" aria-label="' + esc(label) + '">'
      + options.map(function (option) {
        return '<option value="' + esc(option.value) + '" ' + (current === option.value ? "selected" : "") + '>' + esc(option.label) + '</option>';
      }).join("") + '</select></label>';
  }

  function leadFiltersMarkup() {
    const rows = rawLeads();
    const cities = Array.from(new Set(rows.map(function (item) { return item.city; }).filter(function (value) { return value && value !== "—"; })));
    const platforms = Array.from(new Set(["抖音", "快手", "微信客服", "小红书", "视频号"].concat(rows.map(function (item) { return item.platform; }))));
    const compactSelect = function (key, label, values) {
      const current = state.leadFilters[key] || "all";
      const options = [{ value: "all", label: "全部" + label }].concat(values.map(function (value) { return { value: value, label: value }; }));
      return '<label class="results-lead-filter"><span class="sr-only">' + esc(label) + '</span><select data-results-lead-filter="' + esc(key) + '" aria-label="' + esc(label) + '">' + options.map(function (option) {
        return '<option value="' + esc(option.value) + '" ' + (current === option.value ? "selected" : "") + '>' + esc(option.label) + '</option>';
      }).join("") + '</select></label>';
    };
    return '<div class="results-lead-records-toolbar">'
      + '<label class="results-lead-search"><span aria-hidden="true">⌕</span><input type="search" data-results-lead-query value="' + esc(state.leadQuery) + '" placeholder="请输入联系方式" aria-label="请输入联系方式"></label>'
      + compactSelect("leadType", "转化类型", ["非多次留资", "多次留资"])
      + compactSelect("contactType", "获取类型", ["手机号", "微信号"])
      + compactSelect("city", "城市", cities)
      + compactSelect("platform", "平台", platforms)
      + '<i class="results-lead-records-toolbar__spacer"></i>'
      + '<div class="results-lead-download-wrap"><button type="button" data-results-lead-download aria-haspopup="menu" aria-controls="results-lead-download-menu" aria-expanded="false">⇩ 导出明细</button><div class="results-lead-download-menu" id="results-lead-download-menu" data-results-lead-download-menu role="menu" hidden><button type="button" role="menuitem" data-results-lead-export="result">线索结果明细</button><button type="button" role="menuitem" data-results-lead-export="detail">线索明细</button></div></div>'
      + '<button type="button" class="results-lead-settings" aria-label="字段设置" title="字段设置">⚙</button>'
      + '</div>';
  }

  function prospectTouchLabel(value) {
    return value === "私信已发送" ? "触达成功" : value === "跟进未成" ? "触达失败" : value === "待回复" ? "待触达" : value || "—";
  }

  function prospectStatusMarkup(value, kind) {
    const normalized = String(value || "");
    const tone = kind === "touch"
      ? normalized === "私信已发送" ? "success" : normalized === "跟进未成" ? "danger" : "pending"
      : normalized === "已回复" || normalized === "已留资" ? "success" : normalized === "未留资" || normalized === "未回复" ? "pending" : "muted";
    return '<span class="results-prospect-status is-' + tone + ' is-' + kind + '"><i></i>' + esc(kind === "touch" ? prospectTouchLabel(normalized) : normalized || "—") + '</span>';
  }

  function renderProspects() {
    const all = prospects();
    const rows = all.filter(function (item) {
      return (!state.prospect.account || item.acquisitionAccount === state.prospect.account || item.account === state.prospect.account)
        && (!state.prospect.intent || state.prospect.intent === "all" || (item.tags || []).includes("高意向"))
        && (!state.prospect.model || item.model === state.prospect.model)
        && (!state.prospect.touch || item.touchStatus === state.prospect.touch)
        && (!state.prospect.reply || item.replyStatus === state.prospect.reply)
        && (!state.prospect.lead || item.leadStatus === state.prospect.lead);
    });
    window.prdFilteredProspectRecords = rows;
    const options = {
      account: Array.from(new Set(rawProspects().map(function (item) { return item.acquisitionAccount || item.account; }))),
      model: Array.from(new Set(rawProspects().map(function (item) { return item.model; }).filter(function (item) { return item && item !== "—"; }))),
      touch: [{ value: "私信已发送", label: "触达成功" }, { value: "待回复", label: "待触达" }, { value: "跟进未成", label: "触达失败" }],
      reply: ["已回复", "待回复", "未回复"],
      lead: ["已留资", "未留资"]
    };
    return '<section class="results-v12-panel results-prospect-panel"><header><div><h3>潜客列表</h3><p>当前展示 ' + rows.length + ' 条</p></div><button type="button" data-results-export>⇩ 导出 Excel</button></header>'
      + '<div class="results-v12-legacy-filters">' + legacySelect("intent", "有意向潜客", [])
      + legacySelect("model", "全部意向车型", options.model) + legacySelect("touch", "全部触达状态", options.touch)
      + legacySelect("reply", "全部回复状态", options.reply) + legacySelect("lead", "全部留资状态", options.lead) + '</div>'
      + '<div class="results-v12-table-wrap"><table class="results-v12-table results-v12-legacy-table"><thead><tr>'
      + '<th>客户信息</th><th>触达状态</th><th>车型</th><th>城市</th><th>触达时间</th><th>回复状态</th><th>留资状态</th><th>潜客账号</th><th>触达账号</th><th>操作</th>'
      + '</tr></thead><tbody>' + (rows.map(function (item) {
        return '<tr><td><div class="results-prospect-person"><img src="' + esc(item.avatar) + '" alt="' + esc(item.name) + '"><div><strong>' + esc(item.name) + '</strong><small>' + (item.tags || []).map(function (tag, index) { return '<em class="results-prospect-tag ' + (index ? "is-intent" : "") + '">' + esc(tag) + '</em>'; }).join("") + '</small></div></div></td>'
          + '<td>' + prospectStatusMarkup(item.touchStatus, "touch") + '</td><td>' + esc(item.model) + '</td><td>' + esc(item.city) + '</td><td>' + esc(item.touchTime) + '</td>'
          + '<td>' + prospectStatusMarkup(item.replyStatus, "reply") + '</td><td>' + prospectStatusMarkup(item.leadStatus, "lead") + '</td><td><span class="results-prospect-account" title="' + esc(item.prospectAccount) + '">' + esc(item.prospectAccount) + '</span></td><td><span class="results-prospect-account" title="' + esc(item.touchAccount) + '">' + esc(item.touchAccount) + '</span></td><td>'
          + '<button type="button" data-prd-prospect-conversation="' + esc(item.id) + '">对话流</button><button type="button" data-prd-prospect-timeline="' + esc(item.id) + '">潜客转化记录</button></td></tr>';
      }).join("") || '<tr><td colspan="10" class="empty">当前筛选条件下暂无潜客记录</td></tr>') + '</tbody></table></div></section>';
  }

  function adPlanValue(item) {
    return item.adPlan ? (item.adPlan.type || "广告流量") : "自然流量";
  }

  function adPlanTooltipMarkup(item) {
    const plan = item.adPlan || {};
    const fields = [
      ["广告ID", plan.adId],
      ["广告主名称", plan.advertiserName],
      ["计划ID", plan.planId],
      ["创意ID", plan.creativeId],
      ["广告主账号ID", plan.advertiserAccountId],
      ["计划名称", plan.planName]
    ];
    return fields.map(function (field) {
      return '<div><span>' + esc(field[0]) + '：</span><strong>' + esc(field[1] || "—") + '</strong></div>';
    }).join("");
  }

  function leadCategoryTabsMarkup() {
    return '<div class="results-lead-category-tabs" role="tablist" aria-label="线索业务类型">'
      + Object.keys(leadCategoryLabels).map(function (key) {
        const active = state.leadCategory === key;
        const count = rawLeads().filter(function (item) {
          return item.leadCategory === key && leadMatches(item, false);
        }).length;
        return '<button type="button" role="tab" aria-selected="' + (active ? "true" : "false") + '" class="' + (active ? "is-active" : "") + '" data-results-lead-category="' + key + '">' + leadCategoryLabels[key] + '<b>' + num(count) + '</b></button>';
      }).join("") + '</div>';
  }

  function leadDashboardMarkup(rows) {
    const total = rows.length;
    const metrics = [
      ["全部线索数", total, "当前筛选范围", "total"],
      ["主号获客专家", rows.filter(function (item) { return item.roleId === "main"; }).length, "形成线索", "main"],
      ["副号获客专家", rows.filter(function (item) { return item.roleId === "sub"; }).length, "形成线索", "sub"],
      ["客服专员", rows.filter(function (item) { return item.roleId === "service"; }).length, "形成线索", "service"],
      ["自然承接", rows.filter(function (item) { return !item.adPlan; }).length, "自然流量", "organic"]
    ];
    return '<section class="results-lead-dashboard" aria-label="线索统计看板"><div class="results-lead-metric-grid">'
      + metrics.map(function (item) {
        return '<article class="results-lead-metric is-' + item[3] + '" data-results-dashboard-metric="' + esc(item[0]) + '"><span>' + item[0] + '</span><strong>' + num(item[1]) + '</strong><small>' + item[2] + '</small></article>';
      }).join("") + '</div></section>';
  }

  function ensureAdPlanTooltip() {
    let tooltip = document.querySelector("[data-results-ad-plan-tooltip]");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "results-v12-ad-tooltip";
      tooltip.dataset.resultsAdPlanTooltip = "true";
      tooltip.setAttribute("role", "tooltip");
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  let adPlanTooltipOwner = null;
  function hideAdPlanTooltip() {
    const tooltip = document.querySelector("[data-results-ad-plan-tooltip]");
    if (tooltip) tooltip.hidden = true;
    adPlanTooltipOwner = null;
  }
  function showAdPlanTooltip(trigger) {
    const record = leads().find(function (item) { return item.id === trigger.dataset.resultsAdPlan; });
    if (!record || !record.adPlan) return;
    const tooltip = ensureAdPlanTooltip();
    tooltip.innerHTML = adPlanTooltipMarkup(record);
    tooltip.hidden = false;
    adPlanTooltipOwner = trigger;
    const rect = trigger.getBoundingClientRect();
    const gap = 10;
    const viewportPadding = 12;
    const tooltipRect = tooltip.getBoundingClientRect();
    let top = rect.top - tooltipRect.height - gap;
    if (top < viewportPadding) top = rect.bottom + gap;
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding)
    );
    tooltip.style.top = Math.round(top) + "px";
    tooltip.style.left = Math.round(left) + "px";
  }

  function renderLeads() {
    const rows = leads();
    window.prdFilteredLeadRecords = rows;
    const sourceLabel = function (item) { return item.sourceContent || item.sourceType || "—"; };
    const platformIcon = function (item) { return item.platform === "抖音" ? "抖" : String(item.platform || "平").slice(0, 1); };
    return '<section class="results-lead-content">'
      + leadDashboardMarkup(rows)
      + leadCategoryTabsMarkup()
      + '<section class="results-lead-records results-v12-panel" aria-label="线索明细"><header class="results-lead-records__head"><div><h3>线索明细</h3><p>当前“' + esc(leadCategoryLabels[state.leadCategory] || "全部") + '”展示 ' + rows.length + ' 条</p></div></header>'
      + leadFiltersMarkup()
      + '<div class="results-v12-table-wrap"><table class="results-v12-table results-lead-table"><thead><tr>'
      + '<th>客户信息</th><th>联系方式</th><th>平台</th><th>车系</th><th>城市</th><th>最新获客时间</th><th>线索来源</th><th>用户来源</th><th>操作</th>'
      + '</tr></thead><tbody>' + (rows.map(function (item) {
        return '<tr><td><div class="results-lead-person"><img src="' + esc(item.avatar) + '" alt=""><div><strong>' + esc(item.name) + '</strong><small><em class="' + (item.leadTag === "多次留资" ? "is-repeat" : "") + '">' + esc(item.leadTag || "正式线索") + '</em></small></div></div></td>'
          + '<td><div class="results-lead-contact"><strong>' + esc(item.phone) + '</strong><small>' + esc(item.wechat) + '</small></div></td>'
          + '<td><span class="results-lead-platform"><i aria-hidden="true">' + esc(platformIcon(item)) + '</i>' + esc(item.platform) + '</span></td>'
          + '<td>' + esc(item.model) + '</td><td>' + esc(item.city) + '</td><td>' + esc(item.latestAcquiredAt || item.date) + '</td>'
          + '<td><span class="results-lead-source" title="' + esc(sourceLabel(item)) + '">' + esc(sourceLabel(item)) + '</span></td>'
          + '<td><span class="results-v12-ad-plan ' + (item.adPlan ? "is-ad" : "is-organic") + '"' + (item.adPlan ? ' data-results-ad-plan="' + esc(item.id) + '" tabindex="0" role="button" aria-label="广告流量，查看广告计划详情"' : '') + '>' + esc(adPlanValue(item)) + '</span></td>'
          + '<td><button type="button" class="results-lead-conversation" data-prd-lead-conversation="' + esc(item.id) + '">对话流</button></td></tr>';
      }).join("") || '<tr><td colspan="9" class="empty">当前岗位、账号或时间范围内暂无线索记录</td></tr>') + '</tbody></table></div></section></section>';
  }

  function renderContent() {
    const filteredRows = contentRows();
    const pageSize = 20;
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    state.contentPage = Math.min(pageCount, Math.max(1, Number(state.contentPage) || 1));
    const rows = filteredRows.slice((state.contentPage - 1) * pageSize, state.contentPage * pageSize);
    const allRows = typeof window.aiVideoPublishResults === "function" ? window.aiVideoPublishResults() : [];
    const metric = function (value) { return value == null || value === "" ? "—" : num(value); };
    const body = rows.length ? rows.map(function (item) {
      const title = item.publishedTitle || item.materialTitle;
      const href = item.douyinWorkUrl;
      return '<tr><td><a class="results-content-work" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" title="打开抖音作品：' + esc(title) + '"><span class="results-content-cover"><img src="' + esc(item.coverUrl) + '" alt="' + esc(title) + '"><i>' + esc(item.duration || "00:00") + '</i></span><strong>' + esc(title) + '</strong></a></td>'
        + '<td>' + esc(item.publishedAt) + '</td><td><span class="results-content-account-cell"><img src="' + esc(item.accountAvatarUrl || "assets/portraits/ai-video.jpg") + '" alt=""><strong>' + esc(item.accountName) + '</strong></span></td>'
        + '<td><a class="results-content-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="在抖音打开作品：' + esc(title) + '">查看作品 ↗</a></td><td>' + metric(item.views) + '</td><td>' + metric(item.likes) + '</td><td>' + metric(item.comments) + '</td><td>' + metric(item.favorites) + '</td><td>' + metric(item.shares) + '</td></tr>';
    }).join("") : '<tr><td colspan="9" class="results-content-empty"><strong>' + (allRows.length ? "当前筛选条件下暂无内容效果记录" : "暂无内容效果记录") + '</strong><small>' + (allRows.length ? "调整时间、账号或作品名称后查看结果" : "发布完成的作品将在这里展示") + '</small><button type="button" data-results-content-reset>重置筛选</button></td></tr>';
    const pagination = pageCount > 1 ? '<footer class="results-content-pagination"><span>共 ' + filteredRows.length + ' 条</span><div><button type="button" data-results-content-page="' + (state.contentPage - 1) + '" ' + (state.contentPage === 1 ? "disabled" : "") + '>上一页</button><b>' + state.contentPage + ' / ' + pageCount + '</b><button type="button" data-results-content-page="' + (state.contentPage + 1) + '" ' + (state.contentPage === pageCount ? "disabled" : "") + '>下一页</button></div></footer>' : "";
    return '<section class="results-v12-panel results-content-panel"><div class="results-v12-table-wrap"><table class="results-v12-table results-content-table"><thead><tr><th>作品</th><th>发布时间</th><th>发布账号</th><th>抖音发布链接</th><th>播放数</th><th>点赞数</th><th>评论数</th><th>收藏数</th><th>分享数</th></tr></thead><tbody>' + body + '</tbody></table></div>' + pagination + '</section>';
  }

  function render() {
    const view = document.querySelector(viewSelector);
    if (!view || location.hash.slice(1) !== "results") return;
    document.body.classList.toggle("is-results-leads", state.tab === "leads");
    document.body.classList.toggle("is-results-content", state.tab === "content");
    hideAdPlanTooltip();
    state.rendering = true;
    const content = state.tab === "leads" ? renderLeads() : state.tab === "content" ? renderContent() : renderProspects();
    view.innerHTML = '<div class="results-v12-shell">' + globalFilters() + content + '</div>';
    syncNav();
    state.rendering = false;
  }

  function syncNav() {
    const nav = document.querySelector("[data-results-subnav]");
    const inResults = location.hash.slice(1) === "results";
    if (!nav) return;
    nav.classList.toggle("is-visible", inResults);
    nav.querySelectorAll("a[data-results-tab]").forEach(function (link) {
      link.classList.toggle("is-active", inResults && link.dataset.resultsTab === state.tab);
    });
  }

  function ensureNav() {
    const results = document.querySelector('[data-route="results"]');
    if (!results) return;
    let nav = document.querySelector("[data-results-subnav]");
    if (!nav) {
      nav = document.createElement("div");
      nav.className = "results-subnav";
      nav.dataset.resultsSubnav = "true";
      results.insertAdjacentElement("afterend", nav);
    }
    nav.innerHTML = '<a href="#results" data-results-tab="prospects">潜客记录</a><a href="#results" data-results-tab="leads">线索记录</a><a href="#results" data-results-tab="content">内容效果记录</a>';
    syncNav();
  }

  function exportExcel() {
    let header;
    let rows;
    if (state.tab === "prospects") {
      header = ["客户信息", "触达状态", "车型", "城市", "触达时间", "回复状态", "留资状态", "潜客账号", "触达账号"];
      const filtered = Array.isArray(window.prdFilteredProspectRecords) ? window.prdFilteredProspectRecords : prospects();
      rows = filtered.map(function (item) {
        return [item.name, prospectTouchLabel(item.touchStatus), item.model, item.city, item.touchTime, item.replyStatus, item.leadStatus, item.prospectAccount || item.account, item.touchAccount];
      });
    } else if (state.tab === "leads") {
      exportLeadDetail("result");
      return;
    } else {
      header = ["作品标题", "素材原始名称", "封面链接", "视频时长", "发布时间", "发布账号名称", "抖音发布链接", "播放数", "点赞数", "评论数", "收藏数", "分享数", "指标更新时间"];
      rows = contentRows().map(function (item) {
        let coverUrl = item.coverUrl;
        try { coverUrl = new URL(item.coverUrl, document.baseURI).href; } catch (error) { /* Keep the source value. */ }
        return [item.publishedTitle || item.materialTitle, item.materialTitle, coverUrl, item.duration, item.publishedAt, item.accountName, item.douyinWorkUrl, item.views, item.likes, item.comments, item.favorites, item.shares, item.metricsUpdatedAt];
      });
    }
    const selectedContentAccount = (typeof window.aiVideoPublishResults === "function" ? window.aiVideoPublishResults() : []).find(function (item) { return item.accountId === state.contentAccount; });
    const contentAccountLabel = state.contentAccount === "all" ? "全部账号" : selectedContentAccount ? selectedContentAccount.accountName : "指定账号";
    downloadTable(state.tab === "content" ? "内容效果记录_" + state.contentStart.replace(/-/g, "") + "-" + state.contentEnd.replace(/-/g, "") + "_" + contentAccountLabel.replace(/[\\/:*?"<>|]/g, "-") + ".xlsx" : "成果中心-" + state.tab + "-" + state.start + "-" + state.end + ".xls", header, rows);
  }

  function downloadTable(filename, header, rows) {
    if (/\.xlsx$/i.test(filename)) {
      downloadXlsx(filename, header, rows);
      return;
    }
    const table = '<table><tr>' + header.map(function (item) { return "<th>" + esc(item) + "</th>"; }).join("") + "</tr>"
      + rows.map(function (row) { return "<tr>" + row.map(function (item) { return "<td>" + esc(item) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
    const url = URL.createObjectURL(new Blob(["\ufeff<html><meta charset=\"utf-8\"><style>table{border-collapse:collapse}th,td{border:1px solid #ccd6e2;padding:6px 10px}</style>" + table + "</html>"], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadXlsx(filename, header, rows) {
    const encoder = new TextEncoder();
    const xml = function (value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char];
      });
    };
    const columnName = function (index) {
      let value = index + 1;
      let label = "";
      while (value > 0) {
        const remainder = (value - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        value = Math.floor((value - 1) / 26);
      }
      return label;
    };
    const links = [];
    const allRows = [header].concat(rows);
    const sheetRows = allRows.map(function (row, rowIndex) {
      const cells = row.map(function (value, columnIndex) {
        const ref = columnName(columnIndex) + (rowIndex + 1);
        const isLink = rowIndex > 0 && /^https?:\/\//i.test(String(value || ""));
        if (isLink) links.push({ ref, target: String(value) });
        if (typeof value === "number" && Number.isFinite(value)) return '<c r="' + ref + '"' + (rowIndex === 0 ? ' s="1"' : '') + ' t="n"><v>' + value + '</v></c>';
        return '<c r="' + ref + '"' + (rowIndex === 0 ? ' s="1"' : isLink ? ' s="2"' : '') + ' t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
      }).join("");
      return '<row r="' + (rowIndex + 1) + '">' + cells + '</row>';
    }).join("");
    const hyperlinkMarkup = links.length ? '<hyperlinks>' + links.map(function (item, index) { return '<hyperlink ref="' + item.ref + '" r:id="rId' + (index + 1) + '"/>'; }).join("") + '</hyperlinks>' : "";
    const sheetRels = links.length ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + links.map(function (item, index) { return '<Relationship Id="rId' + (index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xml(item.target) + '" TargetMode="External"/>'; }).join("") + '</Relationships>' : "";
    const files = {
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="内容效果记录" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF172536"/><name val="Arial"/></font><font><u/><sz val="11"/><color rgb="FF2878D4"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
      "xl/worksheets/sheet1.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="2" width="28" customWidth="1"/><col min="3" max="3" width="42" customWidth="1"/><col min="4" max="6" width="20" customWidth="1"/><col min="7" max="7" width="44" customWidth="1"/><col min="8" max="13" width="15" customWidth="1"/></cols><sheetData>' + sheetRows + '</sheetData><autoFilter ref="A1:' + columnName(header.length - 1) + Math.max(1, allRows.length) + '"/>' + hyperlinkMarkup + '</worksheet>'
    };
    if (sheetRels) files["xl/worksheets/_rels/sheet1.xml.rels"] = sheetRels;

    const crcTable = Array.from({ length: 256 }, function (_, index) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      return value >>> 0;
    });
    const crc32 = function (bytes) {
      let crc = 0xffffffff;
      bytes.forEach(function (byte) { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
      return (crc ^ 0xffffffff) >>> 0;
    };
    const uint16 = function (value) { return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff); };
    const uint32 = function (value) { return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); };
    const concat = function (parts) {
      const size = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
      const merged = new Uint8Array(size);
      let offset = 0;
      parts.forEach(function (part) { merged.set(part, offset); offset += part.length; });
      return merged;
    };
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const locals = [];
    const centrals = [];
    let offset = 0;
    Object.keys(files).forEach(function (name) {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(files[name]);
      const crc = crc32(data);
      const local = concat([uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(dosTime), uint16(dosDate), uint32(crc), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0), nameBytes, data]);
      const central = concat([uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(dosTime), uint16(dosDate), uint32(crc), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const centralBytes = concat(centrals);
    const end = concat([uint32(0x06054b50), uint16(0), uint16(0), uint16(centrals.length), uint16(centrals.length), uint32(centralBytes.length), uint32(offset), uint16(0)]);
    const blob = new Blob([concat(locals.concat([centralBytes, end]))], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function exportLeadDetail(kind) {
    const rows = leads();
    const category = leadCategoryLabels[state.leadCategory] || "全部";
    const resultHeader = ["线索类型", "客户信息", "电话", "微信", "平台", "车系", "城市", "最新获客时间", "来源岗位", "获客账号", "广告计划"];
    const detailHeader = ["线索ID", "线索类型", "客户信息", "联系方式类型", "电话", "微信", "平台", "车系", "城市", "来源岗位", "获客账号", "形成时间", "留资类型", "二要素类型", "广告计划"];
    const exportRows = kind === "detail"
      ? rows.map(function (item) { return [item.id, category, item.name, item.contactType, item.phone, item.wechat, item.platform, item.model, item.city, item.role, item.account, item.latestAcquiredAt || item.date, item.leadType, item.twoElementType, adPlanValue(item)]; })
      : rows.map(function (item) { return [category, item.name, item.phone, item.wechat, item.platform, item.model, item.city, item.latestAcquiredAt || item.date, item.role, item.account, adPlanValue(item)]; });
    const label = kind === "detail" ? "线索明细" : "线索结果明细";
    downloadTable("成果中心-" + label + "-" + category + "-" + state.start + "-" + state.end + ".xls", kind === "detail" ? detailHeader : resultHeader, exportRows);
    if (typeof showToast === "function") showToast(label + "已导出", "已按当前日期、筛选条件和“" + category + "”类型生成文件");
  }

  function toggleLeadDownloadMenu(force) {
    const menu = document.querySelector("[data-results-lead-download-menu]");
    const trigger = document.querySelector("[data-results-lead-download]");
    if (!menu || !trigger) return;
    const open = typeof force === "boolean" ? force : menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && event.target.closest("[data-results-content-query]")) {
      event.preventDefault();
      window.clearTimeout(contentQueryTimer);
      state.contentQuery = event.target.value;
      state.contentPage = 1;
      render();
      const input = document.querySelector("[data-results-content-query]");
      if (input) input.focus();
      return;
    }
    if (event.key === "Escape") toggleLeadDownloadMenu(false);
  }

  function applyLeadRange(preset) {
    const end = new Date(sampleDate + "T00:00:00Z");
    const start = new Date(end);
    if (preset === "yesterday") start.setUTCDate(start.getUTCDate() - 1);
    if (preset === "week") start.setUTCDate(start.getUTCDate() - 6);
    if (preset === "month") start.setUTCDate(start.getUTCDate() - 29);
    state.start = start.toISOString().slice(0, 10);
    state.end = (preset === "yesterday" ? new Date(end.getTime() - 86400000) : end).toISOString().slice(0, 10);
    state.datePreset = preset;
  }

  function applyProspectRange(preset) {
    const end = new Date(sampleDate + "T00:00:00");
    const start = new Date(end);
    const days = preset === "yesterday" ? 1 : preset === "week" ? 7 : 30;
    start.setDate(start.getDate() - (days - 1));
    const localDate = function (value) {
      return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
    };
    state.start = localDate(start);
    state.end = localDate(end);
    state.datePreset = preset;
  }

  function handleClick(event) {
    if (location.hash.slice(1) !== "results") return;
    const menu = document.querySelector("[data-results-lead-download-menu]");
    if (menu && !event.target.closest(".results-lead-download-wrap")) toggleLeadDownloadMenu(false);
    const downloadTrigger = event.target.closest("[data-results-lead-download]");
    if (downloadTrigger) {
      event.preventDefault();
      toggleLeadDownloadMenu();
      return;
    }
    const downloadOption = event.target.closest("[data-results-lead-export]");
    if (downloadOption) {
      event.preventDefault();
      toggleLeadDownloadMenu(false);
      exportLeadDetail(downloadOption.dataset.resultsLeadExport || "result");
      return;
    }
    const adPlanTrigger = event.target.closest("[data-results-ad-plan]");
    if (adPlanTrigger) {
      event.preventDefault();
      showAdPlanTooltip(adPlanTrigger);
      return;
    }
    const sub = event.target.closest("[data-results-tab]");
    if (sub) {
      event.preventDefault();
      state.tab = sub.dataset.resultsTab;
      syncNav();
      render();
      return;
    }
    if (event.target.closest("[data-results-content-reset]")) {
      state.contentStart = "2026-07-29";
      state.contentEnd = "2026-08-27";
      state.contentAccount = "all";
      state.contentQuery = "";
      state.contentPage = 1;
      render();
      return;
    }
    const contentPage = event.target.closest("[data-results-content-page]");
    if (contentPage) {
      state.contentPage = Math.max(1, Number(contentPage.dataset.resultsContentPage) || 1);
      render();
      return;
    }
    const leadCategory = event.target.closest("[data-results-lead-category]");
    if (leadCategory) {
      state.leadCategory = leadCategory.dataset.resultsLeadCategory || "sales";
      render();
      return;
    }
    const leadChart = event.target.closest("[data-results-lead-chart]");
    if (leadChart) {
      state.leadChartMode = leadChart.dataset.resultsLeadChart === "elements" ? "elements" : "contact";
      render();
      return;
    }
    const leadRange = event.target.closest("[data-results-lead-range]");
    if (leadRange) {
      applyLeadRange(leadRange.dataset.resultsLeadRange || "today");
      render();
      return;
    }
    const prospectRange = event.target.closest("[data-results-prospect-range]");
    if (prospectRange) {
      applyProspectRange(prospectRange.dataset.resultsProspectRange || "month");
      render();
      return;
    }
    if (event.target.closest("[data-results-refresh]")) {
      render();
      return;
    }
    const exportTrigger = event.target.closest("[data-results-export]");
    if (exportTrigger) {
      if (state.tab === "content") {
        exportTrigger.disabled = true;
        exportTrigger.textContent = "正在导出…";
        window.setTimeout(function () {
          exportExcel();
          render();
          if (typeof showToast === "function") showToast("内容效果记录已导出", "已按当前时间、账号和作品名称筛选条件生成文件");
        }, 180);
      } else {
        exportExcel();
      }
    }
  }

  function handleChange(event) {
    const contentDate = event.target.closest("[data-results-content-filter]");
    if (contentDate) {
      state[contentDate.dataset.resultsContentFilter === "start" ? "contentStart" : "contentEnd"] = contentDate.value;
      state.contentPage = 1;
      render();
      return;
    }
    const contentAccount = event.target.closest("[data-results-content-account]");
    if (contentAccount) {
      state.contentAccount = contentAccount.value || "all";
      state.contentPage = 1;
      render();
      return;
    }
    const modeNode = event.target.closest("[data-results-filter-mode]");
    if (modeNode) {
      state.filterMode = modeNode.value;
      state.role = "all";
      state.account = "all";
      state.platform = "all";
      render();
      return;
    }
    const valueNode = event.target.closest("[data-results-filter-value]");
    if (valueNode) {
      const mode = state.filterMode || "role";
      state.role = mode === "role" ? valueNode.value : "all";
      state.account = mode === "account" ? valueNode.value : "all";
      state.platform = mode === "platform" ? valueNode.value : "all";
      render();
      return;
    }
    const filter = event.target.closest("[data-results-filter]");
    if (filter) {
      state[filter.dataset.resultsFilter] = filter.value;
      if (filter.dataset.resultsFilter === "start" || filter.dataset.resultsFilter === "end") state.datePreset = "";
      render();
      return;
    }
    const leadFilter = event.target.closest("[data-results-lead-filter]");
    if (leadFilter) {
      state.leadFilters[leadFilter.dataset.resultsLeadFilter] = leadFilter.value;
      render();
      return;
    }
    const leadAccount = event.target.closest("[data-results-lead-account]");
    if (leadAccount) {
      state.account = leadAccount.value;
      render();
      return;
    }
    const prospectAccount = event.target.closest("[data-results-prospect-global-account]");
    if (prospectAccount) {
      state.account = prospectAccount.value || "all";
      state.prospect.account = "";
      render();
      return;
    }
    const oldFilter = event.target.closest("[data-results-prospect-filter]");
    if (oldFilter) {
      state.prospect[oldFilter.dataset.resultsProspectFilter] = oldFilter.value;
      render();
    }
  }

  function handleInput(event) {
    const contentQuery = event.target.closest("[data-results-content-query]");
    if (contentQuery && location.hash.slice(1) === "results") {
      state.contentQuery = contentQuery.value;
      state.contentPage = 1;
      window.clearTimeout(contentQueryTimer);
      contentQueryTimer = window.setTimeout(function () {
        render();
        const input = document.querySelector("[data-results-content-query]");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
      return;
    }
    const query = event.target.closest("[data-results-lead-query]");
    if (!query || location.hash.slice(1) !== "results") return;
    state.leadQuery = query.value;
    render();
    const input = document.querySelector("[data-results-lead-query]");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function boot() {
    ensureNav();
    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleChange);
    document.addEventListener("input", handleInput);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("mouseover", function (event) {
      const trigger = event.target.closest("[data-results-ad-plan]");
      if (trigger) showAdPlanTooltip(trigger);
    });
    document.addEventListener("mouseout", function (event) {
      const trigger = event.target.closest("[data-results-ad-plan]");
      if (trigger && (!event.relatedTarget || !trigger.contains(event.relatedTarget))) hideAdPlanTooltip();
    });
    document.addEventListener("focusin", function (event) {
      const trigger = event.target.closest("[data-results-ad-plan]");
      if (trigger) showAdPlanTooltip(trigger);
    });
    document.addEventListener("focusout", function (event) {
      const trigger = event.target.closest("[data-results-ad-plan]");
      if (trigger) hideAdPlanTooltip();
    });
    window.addEventListener("scroll", hideAdPlanTooltip, true);
    window.addEventListener("hashchange", function () {
      syncNav();
      document.body.classList.toggle("is-results-leads", location.hash.slice(1) === "results" && state.tab === "leads");
      document.body.classList.toggle("is-results-content", location.hash.slice(1) === "results" && state.tab === "content");
      if (location.hash.slice(1) === "results") window.setTimeout(render, 30);
    });
    observer = new MutationObserver(function () {
      ensureNav();
      if (!state.rendering && location.hash.slice(1) === "results" && !document.querySelector(".results-v12-shell")) {
        window.setTimeout(render, 30);
      }
    });
    const view = document.querySelector(viewSelector);
    if (view) observer.observe(view, { childList: true, subtree: true });
    syncNav();
    if (location.hash.slice(1) === "results") render();
    window.setInterval(function () {
      if (location.hash.slice(1) === "results") render();
    }, 300000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
