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

AI 会根据你的请求自动调用，比如你可以说：
- "帮我总结一下今天群里聊了什么"
- "我有什么待办没处理？"

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

---

## 🔌 接入企业微信

GroupDigest 可以搭配企微插件使用，实现企业微信群聊的自动摘要。

### 架构

```
企业微信群聊消息
       ↓
企微服务器 → 回调推送
       ↓
OpenClaw Gateway (端口 18789)
       ↓
企微插件 (wecom) → 解密/解析消息
       ↓
OpenClaw Agent → 调用 group_digest / group_todos
       ↓
返回摘要/待办到群聊
```

### 步骤 1：安装企微插件

```bash
openclaw plugins install @sunnoy/wecom
```

### 步骤 2：企业微信后台配置

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)
2. 进入 **应用管理** → **创建应用**（或创建 AI 机器人）
3. 记录以下信息：

| 参数 | 位置 |
|------|------|
| `corpId` | 我的企业 → 企业信息 → 企业ID |
| `agentId` | 应用管理 → 你的应用 → AgentId |
| `secret` | 应用管理 → 你的应用 → Secret |
| `token` | 应用 → API接收消息 → 随机生成 |
| `encodingAESKey` | 应用 → API接收消息 → 随机生成 |

4. 设置 **API 接收消息** 的回调 URL：
   - 本地开发：用内网穿透工具获取公网地址
   - 生产环境：使用有公网 IP 的服务器

### 步骤 3：配置回调地址（公网访问）

OpenClaw 默认监听 `127.0.0.1:18789`，企微回调需要公网地址。

**方式 A：内网穿透（开发测试）**

```bash
# 使用 ngrok
ngrok http 18789
# 获得公网地址如 https://xxxx.ngrok-free.app

# 或使用 cpolar（国内友好）
cpolar http 18789
```

将获得的公网地址填入企微后台回调 URL，格式如：
```
https://xxxx.ngrok-free.app/webhook/wecom
```

**方式 B：服务器部署（生产环境）**

将 OpenClaw 部署到有公网 IP 的服务器，配置反向代理指向 18789 端口。

### 步骤 4：配置 openclaw.json

```json
{
  "channels": {
    "wecom": {
      "plugin": "wecom",
      "config": {
        "corpId": "你的企业ID",
        "agentId": "应用AgentId",
        "secret": "应用Secret",
        "token": "回调Token",
        "encodingAESKey": "回调EncodingAESKey"
      }
    }
  },
  "plugins": {
    "entries": {
      "group-digest": {
        "config": {
          "digestSchedule": "daily",
          "maxMessages": 500,
          "outputFormat": "markdown"
        }
      }
    }
  }
}
```

### 步骤 5：使用

配置完成后，在企微群里：

- 输入 `/digest` → 生成群聊摘要
- 输入 `/todos` → 查看待办事项
- 对 bot 说 **"帮我总结一下今天群里聊了什么"** → Agent 自动调用工具

---

## 🔌 接入飞书

GroupDigest 同样支持搭配飞书插件使用。

### 步骤 1：安装飞书插件

如果尚未安装：
```bash
openclaw plugins install feishu
```

### 步骤 2：飞书开放平台配置

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 开启 **机器人** 能力
4. 在 **事件订阅** 中添加 `im.message.receive_v1`（接收消息事件）
5. 配置回调地址（同样需要公网访问）

### 步骤 3：配置 openclaw.json

```json
{
  "channels": {
    "feishu": {
      "plugin": "feishu",
      "config": {
        "appId": "你的AppID",
        "appSecret": "你的AppSecret"
      }
    }
  }
}
```

### 步骤 4：使用

在飞书群聊中 @机器人 并使用 `/digest` 或 `/todos` 命令。

---

## 🔌 接入钉钉

### 步骤 1：钉钉开放平台配置

1. 登录 [钉钉开放平台](https://open-dev.dingtalk.com/)
2. 创建企业内部应用
3. 开启 **机器人** 能力
4. 配置消息接收地址

### 步骤 2：安装钉钉通道插件

```bash
openclaw plugins install dingtalk
```

### 步骤 3：使用方式同上

---

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

## 📊 活跃统计

- 消息总数: 128
- 参与人数: 12
- 活跃成员: 张三, 李四, 王五, 赵六...
```

## 🗺️ Roadmap

- [x] 基于规则的话题聚类和待办提取
- [x] 中英文关键词支持
- [x] Markdown / Text / JSON 输出
- [ ] 接入 LLM 生成更智能的摘要
- [ ] 支持定时自动推送摘要（Cron）
- [ ] 支持 @全员 的待办
- [ ] Web 面板查看历史摘要
- [ ] 跨群汇总报告
- [ ] 付费版：自定义报告模板、团队协作、数据导出

## 🤝 贡献

欢迎 PR 和 Issue！

1. Fork 这个仓库
2. 创建你的分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送 (`git push origin feature/amazing`)
5. 发起 Pull Request

## 📄 License

MIT

---

**Made with 🦞 by OpenClaw Community**
