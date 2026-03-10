import type { DigestReport } from './types.js'

/**
 * Formatter — 报告格式化器
 * 
 * 将 DigestReport 转为 Markdown / 纯文本 / JSON 输出。
 */
export class Formatter {
  /** 格式化报告 */
  format(report: DigestReport, style: 'markdown' | 'text' | 'json' = 'markdown'): string {
    switch (style) {
      case 'markdown': return this.toMarkdown(report)
      case 'text': return this.toText(report)
      case 'json': return JSON.stringify(report, null, 2)
    }
  }

  private toMarkdown(r: DigestReport): string {
    const lines: string[] = []

    // 标题
    lines.push(`# 📋 群聊摘要 — ${r.groupName}`)
    lines.push('')

    // 概览
    const fromTime = new Date(r.timeRange.from).toLocaleString('zh-CN')
    const toTime = new Date(r.timeRange.to).toLocaleString('zh-CN')
    lines.push(`> ${r.oneLiner}`)
    lines.push(`> 📅 ${fromTime} ~ ${toTime}`)
    lines.push('')

    // 待办事项（优先展示）
    if (r.todos.length > 0) {
      lines.push(`## ⚡ 待办事项 (${r.todos.length})`)
      lines.push('')
      for (const todo of r.todos) {
        const icon = todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟡' : '🟢'
        const deadline = todo.deadline ? ` ⏰ ${todo.deadline}` : ''
        const reply = todo.needsReply ? ' 💬需回复' : ''
        lines.push(`- ${icon} **${todo.summary}**${deadline}${reply}`)
        lines.push(`  — ${todo.message.sender}`)
      }
      lines.push('')
    }

    // 重要决定
    if (r.decisions.length > 0) {
      lines.push(`## ✅ 重要决定 (${r.decisions.length})`)
      lines.push('')
      for (const d of r.decisions) {
        lines.push(`- ${d}`)
      }
      lines.push('')
    }

    // 话题列表
    if (r.topics.length > 0) {
      lines.push(`## 💬 话题概览 (${r.topics.length})`)
      lines.push('')
      for (let i = 0; i < r.topics.length; i++) {
        const t = r.topics[i]
        lines.push(`### ${i + 1}. ${t.title}`)
        lines.push(`${t.summary}`)
        lines.push(`参与者: ${t.participants.join(', ')}`)
        lines.push('')
      }
    }

    // 活跃统计
    lines.push(`## 📊 活跃统计`)
    lines.push('')
    lines.push(`- 消息总数: ${r.totalMessages}`)
    lines.push(`- 参与人数: ${r.activeParticipants.length}`)
    lines.push(`- 活跃成员: ${r.activeParticipants.slice(0, 10).join(', ')}`)
    lines.push('')

    lines.push(`---`)
    lines.push(`*由 GroupDigest 自动生成 · ${new Date(r.generatedAt).toLocaleString('zh-CN')}*`)

    return lines.join('\n')
  }

  private toText(r: DigestReport): string {
    const lines: string[] = []

    lines.push(`【群聊摘要】${r.groupName}`)
    lines.push(r.oneLiner)
    lines.push('')

    if (r.todos.length > 0) {
      lines.push(`== 待办事项 ==`)
      for (const todo of r.todos) {
        const icon = todo.priority === 'high' ? '[紧急]' : todo.priority === 'medium' ? '[一般]' : '[低]'
        lines.push(`${icon} ${todo.summary} — ${todo.message.sender}`)
      }
      lines.push('')
    }

    if (r.topics.length > 0) {
      lines.push(`== 话题 ==`)
      for (let i = 0; i < r.topics.length; i++) {
        lines.push(`${i + 1}. ${r.topics[i].title} (${r.topics[i].messageCount}条)`)
      }
    }

    return lines.join('\n')
  }
}
