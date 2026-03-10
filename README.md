# 📋 GroupDigest — OpenClaw 群聊智能摘要插件

> 自动汇总群消息，提取 @你 的待办事项，生成每日/每周摘要报告

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue?style=flat-square)](https://github.com/openclaw/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## 🤔 解决什么问题？

- 每天 **几十个群**，几百条未读消息
- @你 的重要消息淹没在闲聊里
- 群里做了重要决定，但你没看到
- 不知道哪些消息需要你回复

## ✨ 功能

| 功能 | 描述 |
|------|------|
| 📊 群聊摘要 | 自动聚类话题，生成结构化摘要 |
| ⚡ 待办提取 | 识别 @你 的待办事项，按优先级排序 |
| ✅ 决定追踪 | 提取群内重要决定和结论 |
| 📈 活跃统计 | 参与人数、消息量、活跃成员 |
| 🔴🟡🟢 优先级 | 自动判断紧急/一般/低优先级 |
| ⏰ 截止时间 | 自动识别"今天之内""下周前"等时间 |
| 💬 需回复标记 | 标注需要你回复的消息 |

## 📦 安装

```bash
openclaw plugins install /path/to/group-digest
```

## 🚀 使用

### 命令

```
/digest        — 生成最近 24 小时的群聊摘要
/digest 48     — 生成最近 48 小时的摘要
/todos         — 查看所有待办事项
```

### Agent 工具

插件注册了两个 AI 工具：

- `group_digest` — 生成群聊摘要报告
- `group_todos` — 提取待办事项

AI 会根据你的请求自动调用。

## ⚙️ 配置

在 `openclaw.json` 中配置：

```json
{
  "plugins": {
    "entries": {
      "group-digest": {
        "config": {
          "digestSchedule": "daily",
          "maxMessages": 500,
          "todoKeywords": "请,帮忙,麻烦,deadline,urgent",
          "outputFormat": "markdown"
        }
      }
    }
  }
}
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `digestSchedule` | `daily` | 摘要频率: hourly / daily / weekly |
| `maxMessages` | `500` | 单次摘要最大处理消息数 |
| `todoKeywords` | 内置中英文关键词 | 自定义待办关键词，逗号分隔 |
| `outputFormat` | `markdown` | 输出格式: markdown / text / json |

## 📋 输出示例

```markdown
# 📋 群聊摘要 — 产品讨论群

> 共 128 条消息，12 人参与，5 个话题，⚠️ 2 条紧急待办，📋 5 条待办
> 📅 2026/3/9 09:00 ~ 2026/3/10 09:00

## ⚡ 待办事项 (5)

- 🔴 **产品文档今天之内要更新完** ⏰ 今天之内 💬需回复
  — 张三
- 🟡 **帮忙看一下上线后的数据** ⏰ 明天之前
  — 李四
- 🟢 **有空的话帮忙 review 一下代码**
  — 王五

## ✅ 重要决定 (2)

- [张三] 确定了新版本下周三发布
- [李四] 决定用方案 B，性能更好

## 💬 话题概览 (5)

### 1. 新版本发布计划讨论
5 人参与，共 32 条消息
...
```

## 🗺️ Roadmap

- [ ] 接入 LLM 生成更智能的摘要（当前版本基于规则）
- [ ] 支持定时自动推送摘要
- [ ] 支持 @全员 的待办
- [ ] 接入飞书/钉钉/企微的原生消息 API
- [ ] Web 面板查看历史摘要
- [ ] 付费版：跨群汇总、自定义报告模板、团队协作

## 📄 License

MIT

---

**Made with 🦞 by OpenClaw Community**
