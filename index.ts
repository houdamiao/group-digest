/**
 * GroupDigest — OpenClaw 群聊智能摘要插件入口
 *
 * 注册：
 *  - Agent Tool (group_digest)      — 供 AI Agent 调用，生成群聊摘要
 *  - Agent Tool (group_todos)       — 供 AI Agent 调用，提取待办事项
 *  - Command (/digest)              — 用户手动触发群聊摘要
 *  - Command (/todos)               — 用户手动查看待办
 */
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core'
import { MessageCollector } from './src/message-collector.js'
import { DigestGenerator } from './src/digest-generator.js'
import { TodoExtractor } from './src/todo-extractor.js'
import { Formatter } from './src/formatter.js'

export default function register(api: OpenClawPluginApi) {
  const cfg = (api.config as {
    digestSchedule?: string
    maxMessages?: number
    todoKeywords?: string
    outputFormat?: string
  }) ?? {}

  const todoKeywords = cfg.todoKeywords?.split(',').map(s => s.trim()).filter(Boolean)
  const outputFormat = (cfg.outputFormat ?? 'markdown') as 'markdown' | 'text' | 'json'
  const maxMessages = cfg.maxMessages ?? 500

  const collector = new MessageCollector({ maxPerGroup: maxMessages })
  const generator = new DigestGenerator(todoKeywords)
  const todoExtractor = new TodoExtractor(todoKeywords)
  const formatter = new Formatter()

  // 定期清理过期消息（每小时）
  setInterval(() => collector.cleanup(), 3600_000)

  // ── Agent Tool: group_digest ──────────────────────────────────
  api.registerTool(
    {
      name: 'group_digest',
      description: '生成群聊摘要报告。汇总消息话题、待办事项、重要决定和活跃统计。',
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

        const messages = collector.query(p.groupId, from, to)
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
        } else {
          // 所有群的消息
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

      const from = Date.now() - hoursBack * 3600_000
      const messages = collector.query(groupId, from, Date.now())
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
