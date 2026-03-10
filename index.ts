/**
 * GroupDigest — OpenClaw 群聊智能摘要插件入口
 *
 * 注册：
 *  - Agent Tool (group_digest)      — 生成群聊摘要（支持飞书 API 直接拉取）
 *  - Agent Tool (group_todos)       — 提取待办事项
 *  - Agent Tool (feishu_chat_digest) — 飞书专用：直接从飞书 API 拉取消息并生成摘要
 *  - Command (/digest)              — 用户手动触发群聊摘要
 *  - Command (/todos)               — 用户手动查看待办
 */
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core'
import { MessageCollector } from './src/message-collector.js'
import { DigestGenerator } from './src/digest-generator.js'
import { TodoExtractor } from './src/todo-extractor.js'
import { Formatter } from './src/formatter.js'
import { FeishuFetcher } from './src/feishu-fetcher.js'

export default function register(api: OpenClawPluginApi) {
  const cfg = (api.config as {
    digestSchedule?: string
    maxMessages?: number
    todoKeywords?: string
    outputFormat?: string
    feishuAppId?: string
    feishuAppSecret?: string
    feishuBotOpenId?: string
  }) ?? {}

  const todoKeywords = cfg.todoKeywords?.split(',').map(s => s.trim()).filter(Boolean)
  const outputFormat = (cfg.outputFormat ?? 'markdown') as 'markdown' | 'text' | 'json'
  const maxMessages = cfg.maxMessages ?? 500

  const collector = new MessageCollector({ maxPerGroup: maxMessages })
  const generator = new DigestGenerator(todoKeywords)
  const todoExtractor = new TodoExtractor(todoKeywords)
  const formatter = new Formatter()

  // 如果配置了飞书凭证，初始化 fetcher
  let feishuFetcher: FeishuFetcher | null = null
  if (cfg.feishuAppId && cfg.feishuAppSecret) {
    feishuFetcher = new FeishuFetcher(cfg.feishuAppId, cfg.feishuAppSecret)
  }

  // 定期清理过期消息（每小时）
  setInterval(() => collector.cleanup(), 3600_000)

  // ── Agent Tool: feishu_chat_digest ────────────────────────────
  // 飞书专用：直接从飞书 API 拉取群消息并生成摘要
  api.registerTool(
    {
      name: 'feishu_chat_digest',
      description: '飞书群聊摘要：直接从飞书 API 拉取指定群的消息历史，生成摘要报告。需要提供飞书群 ID（chat_id，以 oc_ 开头）。',
      parameters: {
        type: 'object',
        required: ['chatId'],
        properties: {
          chatId: {
            type: 'string',
            description: '飞书群 ID（以 oc_ 开头，如 oc_be8deadf23560e5f4195331311552bca）',
          },
          hoursBack: {
            type: 'number',
            description: '回溯小时数，默认 24',
          },
          limit: {
            type: 'number',
            description: '最大消息数，默认 200',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'text', 'json'],
            description: '输出格式，默认 markdown',
          },
        },
      },
      async execute(_id, params) {
        const p = params as {
          chatId: string
          hoursBack?: number
          limit?: number
          format?: 'markdown' | 'text' | 'json'
        }

        if (!feishuFetcher) {
          return {
            content: [{
              type: 'text',
              text: '⚠️ 飞书凭证未配置。请在 plugins.entries.group-digest.config 中设置 feishuAppId 和 feishuAppSecret',
            }],
          }
        }

        try {
          // 获取群信息
          let groupName = p.chatId
          try {
            const chatInfo = await feishuFetcher.getChatInfo(p.chatId)
            groupName = chatInfo.name
          } catch {
            // 获取群名失败不影响主流程
          }

          // 拉取消息
          const messages = await feishuFetcher.fetchMessages(p.chatId, {
            hoursBack: p.hoursBack ?? 24,
            limit: p.limit ?? 200,
            botOpenId: cfg.feishuBotOpenId,
          })

          if (messages.length === 0) {
            return {
              content: [{
                type: 'text',
                text: `📋 群「${groupName}」在最近 ${p.hoursBack ?? 24} 小时内没有消息`,
              }],
            }
          }

          // 同时把消息存入收集器（供后续查询）
          collector.pushBatch(messages)

          // 生成摘要
          const report = generator.generate(messages, p.chatId, groupName)
          const output = formatter.format(report, p.format ?? outputFormat)

          return { content: [{ type: 'text', text: output }] }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return {
            content: [{
              type: 'text',
              text: `❌ 拉取飞书消息失败: ${msg}\n\n可能原因:\n- 机器人不在该群中\n- 缺少 im:message 权限\n- chat_id 不正确`,
            }],
          }
        }
      },
    },
    { optional: false },
  )

  // ── Agent Tool: group_digest ──────────────────────────────────
  api.registerTool(
    {
      name: 'group_digest',
      description: '生成群聊摘要报告（基于已收集的消息）。如果是飞书群，建议先用 feishu_chat_digest。',
      parameters: {
        type: 'object',
        required: ['groupId'],
        properties: {
          groupId: {
            type: 'string',
            description: '群组 ID',
          },
          groupName: {
            type: 'string',
            description: '群组名称（可选，用于报告标题）',
          },
          hoursBack: {
            type: 'number',
            description: '回溯小时数，默认 24',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'text', 'json'],
            description: '输出格式',
          },
        },
      },
      async execute(_id, params) {
        const p = params as {
          groupId: string
          groupName?: string
          hoursBack?: number
          format?: 'markdown' | 'text' | 'json'
        }

        const hoursBack = p.hoursBack ?? 24
        const from = Date.now() - hoursBack * 3600_000
        const to = Date.now()

        // 如果收集器里没有数据，且是飞书群，自动尝试拉取
        let messages = collector.query(p.groupId, from, to)
        if (messages.length === 0 && p.groupId.startsWith('oc_') && feishuFetcher) {
          try {
            messages = await feishuFetcher.fetchMessages(p.groupId, {
              hoursBack,
              limit: maxMessages,
              botOpenId: cfg.feishuBotOpenId,
            })
            collector.pushBatch(messages)
          } catch {
            // 拉取失败，继续用空数据
          }
        }

        const report = generator.generate(
          messages,
          p.groupId,
          p.groupName ?? p.groupId
        )
        const output = formatter.format(report, p.format ?? outputFormat)

        return { content: [{ type: 'text', text: output }] }
      },
    },
    { optional: false },
  )

  // ── Agent Tool: group_todos ───────────────────────────────────
  api.registerTool(
    {
      name: 'group_todos',
      description: '提取群聊中 @你的待办事项，按优先级排序。',
      parameters: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: '群组 ID（不填则提取所有群的待办）',
          },
          hoursBack: {
            type: 'number',
            description: '回溯小时数，默认 24',
          },
        },
      },
      async execute(_id, params) {
        const p = params as { groupId?: string; hoursBack?: number }
        const hoursBack = p.hoursBack ?? 24
        const from = Date.now() - hoursBack * 3600_000

        let messages: import('./src/types.js').ChatMessage[]

        if (p.groupId) {
          messages = collector.query(p.groupId, from, Date.now())

          // 飞书群自动拉取
          if (messages.length === 0 && p.groupId.startsWith('oc_') && feishuFetcher) {
            try {
              messages = await feishuFetcher.fetchMessages(p.groupId, {
                hoursBack,
                limit: maxMessages,
                botOpenId: cfg.feishuBotOpenId,
              })
              collector.pushBatch(messages)
            } catch {
              // ignore
            }
          }
        } else {
          messages = []
          for (const gid of collector.getGroupIds()) {
            messages.push(...collector.query(gid, from, Date.now()))
          }
        }

        const todos = todoExtractor.extract(messages)

        if (todos.length === 0) {
          return { content: [{ type: 'text', text: '✅ 暂无待办事项' }] }
        }

        const lines: string[] = [`📋 **待办事项** (${todos.length} 条)\n`]
        for (const todo of todos) {
          const icon = todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟡' : '🟢'
          const deadline = todo.deadline ? ` ⏰ ${todo.deadline}` : ''
          const reply = todo.needsReply ? ' 💬需回复' : ''
          const group = p.groupId ? '' : ` [${todo.message.groupName}]`
          lines.push(`${icon} **${todo.summary}**${deadline}${reply}${group}`)
          lines.push(`  — ${todo.message.sender}`)
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] }
      },
    },
    { optional: false },
  )

  // ── Command: /digest ──────────────────────────────────────────
  api.registerCommand({
    name: 'digest',
    description: '生成当前群聊的摘要。用法: /digest [小时数]',
    acceptsArgs: true,
    handler: async (ctx) => {
      const hoursBack = parseInt(ctx.args?.trim() || '24', 10) || 24
      const groupId = (ctx as Record<string, unknown>).groupId as string | undefined

      if (!groupId) {
        return { text: '⚠️ 请在群聊中使用此命令' }
      }

      // 飞书群自动从 API 拉取
      let messages = collector.query(groupId, Date.now() - hoursBack * 3600_000, Date.now())
      if (messages.length === 0 && groupId.startsWith('oc_') && feishuFetcher) {
        try {
          messages = await feishuFetcher.fetchMessages(groupId, {
            hoursBack,
            limit: maxMessages,
            botOpenId: cfg.feishuBotOpenId,
          })
          collector.pushBatch(messages)
        } catch {
          // ignore
        }
      }

      const groupName = (ctx as Record<string, unknown>).groupName as string ?? groupId
      const report = generator.generate(messages, groupId, groupName)
      const output = formatter.format(report, outputFormat)

      return { text: output }
    },
  })

  // ── Command: /todos ───────────────────────────────────────────
  api.registerCommand({
    name: 'todos',
    description: '查看群聊中 @你的待办。用法: /todos',
    acceptsArgs: false,
    handler: async (ctx) => {
      const groupId = (ctx as Record<string, unknown>).groupId as string | undefined
      const from = Date.now() - 24 * 3600_000

      let messages: import('./src/types.js').ChatMessage[]
      if (groupId) {
        messages = collector.query(groupId, from, Date.now())
        if (messages.length === 0 && groupId.startsWith('oc_') && feishuFetcher) {
          try {
            messages = await feishuFetcher.fetchMessages(groupId, {
              hoursBack: 24,
              limit: maxMessages,
              botOpenId: cfg.feishuBotOpenId,
            })
            collector.pushBatch(messages)
          } catch {
            // ignore
          }
        }
      } else {
        messages = []
        for (const gid of collector.getGroupIds()) {
          messages.push(...collector.query(gid, from, Date.now()))
        }
      }

      const todos = todoExtractor.extract(messages)

      if (todos.length === 0) {
        return { text: '✅ 暂无待办事项，去摸鱼吧！' }
      }

      const lines: string[] = [`📋 待办事项 (${todos.length} 条)\n`]
      for (const todo of todos) {
        const icon = todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟡' : '🟢'
        lines.push(`${icon} ${todo.summary} — ${todo.message.sender}`)
      }

      return { text: lines.join('\n') }
    },
  })
}
