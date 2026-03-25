export const TASK_ICON_OPTIONS = [
  { value: "", label: "自动", icon: "radio_button_unchecked" },
  { value: "check_circle", label: "完成", icon: "check_circle" },
  { value: "flag", label: "目标", icon: "flag" },
  { value: "schedule", label: "计划", icon: "schedule" },
  { value: "fitness_center", label: "健身", icon: "fitness_center" },
  { value: "music_note", label: "音乐", icon: "music_note" },
  { value: "school", label: "学习", icon: "school" },
  { value: "menu_book", label: "阅读", icon: "menu_book" },
  { value: "edit_note", label: "写作", icon: "edit_note" },
  { value: "work", label: "工作", icon: "work" },
  { value: "groups", label: "沟通", icon: "groups" },
  { value: "monitoring", label: "量化", icon: "monitoring" },
  { value: "trending_up", label: "市场", icon: "trending_up" },
  { value: "payments", label: "财务", icon: "payments" },
  { value: "smart_display", label: "视频", icon: "smart_display" },
  { value: "photo_camera", label: "拍摄", icon: "photo_camera" },
  { value: "apps", label: "应用", icon: "apps" },
  { value: "dashboard", label: "看板", icon: "dashboard" },
  { value: "gavel", label: "仲裁", icon: "gavel" },
  { value: "code", label: "代码", icon: "code" },
];

const TASK_ICON_KEYWORDS = [
  { icon: "check_circle", keywords: ["完成", "收尾", "交付"] },
  { icon: "flag", keywords: ["目标", "计划", "里程碑"] },
  { icon: "schedule", keywords: ["日程", "安排", "计划表"] },
  { icon: "fitness_center", keywords: ["健身", "锻炼", "训练", "跑步", "运动"] },
  { icon: "music_note", keywords: ["吉他", "音乐", "练琴"] },
  { icon: "school", keywords: ["学习", "课程", "复习", "练习"] },
  { icon: "menu_book", keywords: ["阅读", "读书", "书", "文章"] },
  { icon: "edit_note", keywords: ["写作", "写", "笔记", "总结", "周总结"] },
  { icon: "work", keywords: ["找工作", "求职", "简历", "面试", "工作"] },
  { icon: "briefcase", keywords: ["职业", "offer", "简历投递"] },
  { icon: "groups", keywords: ["沟通", "协作", "开会", "会议", "老板", "客户"] },
  { icon: "monitoring", keywords: ["量化", "回测", "交易", "策略", "股票"] },
  { icon: "trending_up", keywords: ["市场", "行情", "涨跌", "复盘"] },
  { icon: "payments", keywords: ["财务", "预算", "工资", "报销", "钱"] },
  { icon: "smart_display", keywords: ["视频", "剪辑", "拍摄", "镜头"] },
  { icon: "photo_camera", keywords: ["摄影", "拍照", "拍摄"] },
  { icon: "movie", keywords: ["剪辑", "后期", "分镜"] },
  { icon: "apps", keywords: ["app", "应用", "产品"] },
  { icon: "dashboard", keywords: ["dashboard", "界面", "看板", "面板"] },
  { icon: "language", keywords: ["网站", "网页", "站点"] },
  { icon: "gavel", keywords: ["仲裁", "法务"] },
  { icon: "code", keywords: ["开发", "代码", "程序", "前端", "后端"] },
  { icon: "terminal", keywords: ["终端", "脚本", "命令行"] },
  { icon: "psychology", keywords: ["思考", "研究", "分析", "实验"] },
  { icon: "lightbulb", keywords: ["灵感", "创意", "想法"] },
  { icon: "rocket_launch", keywords: ["推进", "启动", "上线", "发布"] },
];

const LEADING_TASK_SYMBOL_PATTERN = /^[\s\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+/u;

export function getTaskDisplayName(value) {
  const raw = String(value || "");
  const stripped = raw.replace(LEADING_TASK_SYMBOL_PATTERN, "").trim();
  return stripped || raw.trim() || "未命名任务";
}

export function getTaskIcon(taskName, customIcon = "") {
  if (customIcon) {
    return customIcon;
  }

  const name = getTaskDisplayName(taskName).toLowerCase();
  const matched = TASK_ICON_KEYWORDS.find((entry) => entry.keywords.some((keyword) => name.includes(keyword.toLowerCase())));
  return matched?.icon || "radio_button_unchecked";
}
