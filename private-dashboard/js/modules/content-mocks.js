const mockContentCatalog = {
  finance: [
    ["央行流动性窗口观察", "关注公开市场操作与短端利率变化。", "Macro Desk", "分析"],
    ["美债收益率短线回落", "风险资产对降息预期重新定价。", "Bond Wire", "快讯"],
    ["港股互联网板块回暖", "资金回流高流动性龙头资产。", "HK Markets", "日报"],
    ["原油价格进入震荡区间", "供给预期与美元走势互相对冲。", "Commodities Now", "观察"],
    ["半导体设备订单改善", "产业链资本开支信号边际修复。", "Chip Pulse", "产业"],
    ["黄金避险情绪抬头", "地缘风险推动贵金属配置需求。", "Precious Metals", "快讯"],
    ["消费复苏节奏分化", "高端白酒与可选消费表现不同步。", "CN Consumer", "专题"],
    ["地产融资边际松动", "信用修复仍取决于销售回款。", "Property Lens", "分析"],
    ["美元指数冲高回落", "新兴市场汇率压力暂时缓和。", "FX Daily", "外汇"],
    ["AI 概念再获资金关注", "算力链条估值扩张但波动提升。", "Growth Radar", "专题"],
  ],
  science: [
    ["神经接口材料进展", "柔性导电材料在长期植入中更稳定。", "Nature Briefing", "期刊"],
    ["常温催化路径新结果", "降低工业反应能耗的思路更加清晰。", "ScienceDaily", "新闻"],
    ["聚变约束实验刷新数据", "装置参数优化带来更长稳定窗口。", "Physics Wire", "实验"],
    ["蛋白设计模型再升级", "生成式方法提升候选结构筛选效率。", "BioML Lab", "综述"],
    ["二维材料传感精度提升", "低功耗检测方案更接近量产。", "Materials Update", "论文"],
    ["海洋碳汇观测新方法", "多模态遥感提高区域估算准确率。", "Earth Systems", "研究"],
    ["星系演化样本扩容", "深空数据帮助修正早期形成假设。", "Astro Review", "观测"],
    ["电池界面副反应机制", "原位表征揭示容量衰减关键阶段。", "Energy Letters", "论文"],
    ["类器官模型应用拓展", "疾病筛选与药效验证更加可控。", "Cell Notes", "快讯"],
    ["量子误差校正新策略", "更低冗余开销提升实际部署可行性。", "Quantum Weekly", "分析"],
  ],
};

export function buildMockContent(channel) {
  const base = mockContentCatalog[channel] || [];
  return Array.from({ length: 30 }, (_, index) => {
    const item = base[index % base.length];
    const publishedAt = new Date(Date.now() - index * 6 * 60 * 60 * 1000).toISOString();
    const externalUrl = `https://example.com/${channel}/${index + 1}`;
    return {
      id: `mock-${channel}-${index + 1}`,
      channel,
      title: item[0],
      summary_zh: item[1],
      summary_raw: `${item[1]} 这是用于前端联调的完整示例内容，后续接入真实 RSS 后，这里会替换成更长的正文摘要、原始描述或正文摘录。`,
      body_zh: `${item[1]}\n\n这是用于前端联调的完整示例内容，后续接入真实 RSS 后，这里会替换成更长的正文摘录，用于详情页阅读。`,
      body_raw: `${item[1]} This is a mock long-form body used for frontend integration testing before the real RSS pipeline is fully connected.`,
      source_name: item[2],
      source_url: externalUrl,
      canonical_url: externalUrl,
      author: channel === "science" ? "编辑部" : "市场编辑",
      published_at: publishedAt,
      fetched_at: publishedAt,
      content_type: item[3],
      tags: [channel === "science" ? "研究" : "市场", item[3]],
      lang: "zh",
      is_featured: index < 3,
      is_favorite: false,
    };
  });
}

export function getMockContentPayload(channel, currentState) {
  let items = buildMockContent(channel);
  const search = String(currentState.search || "").trim().toLowerCase();
  if (search) {
    items = items.filter((item) => {
      return [item.title, item.summary_zh, item.body_zh, item.source_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }
  if (currentState.tag !== "all") {
    items = items.filter((item) => Array.isArray(item.tags) && item.tags.includes(currentState.tag));
  }
  if (currentState.sourceId !== "all") {
    items = items.filter((item) => item.source_name === currentState.sourceId);
  }
  if (currentState.favoriteFilter === "favorites") {
    items = items.filter((item) => item.is_favorite);
  }
  if (currentState.sort === "oldest") {
    items = [...items].reverse();
  }
  const total = items.length;
  const page = Math.max(1, Number(currentState.page || 1));
  const start = (page - 1) * currentState.pageSize;
  const pagedItems = items.slice(start, start + currentState.pageSize);
  return {
    items: pagedItems,
    total,
    page,
    pageSize: currentState.pageSize,
    tags: [...new Set(items.flatMap((item) => item.tags || []))],
    sources: [...new Set(items.map((item) => item.source_name))].map((name) => ({
      id: name,
      name,
    })),
  };
}
