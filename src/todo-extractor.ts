import type { ChatMessage, TodoItem } from './types.js'

/**
 * TodoExtractor — 待办事项提取器
 * 
 * 从群聊消息中提取 @用户 的待办事项。
 * 基于关键词匹配 + 上下文分析，无需额外 LLM 调用。
 */
export class TodoExtractor {
  private readonly keywords: string[]
  private readonly highPriorityWords: string[]
  private readonly deadlinePatterns: RegExp[]

  constructor(keywords?: string[]) {
    this.keywords = keywords ?? [
      // 中文
      '请', '帮忙', '麻烦', '需要', '记得', '别忘了', '尽快', '抓紧',
      '催一下', '跟进', '确认', '回复', '处理', '提交', '发一下', '给我',
      // 英文
      'please', 'todo', 'action', 'follow up', 'asap', 'urgent', 'deadline',
      'remind', 'need', 'must', 'should',
    ]

    this.highPriorityWords = [
      '紧急', '尽快', 'asap', 'urgent', '马上', '立刻', '今天之内',
      '立即', 'immediately', '优先', '加急', '火速',
    ]

    this.deadlinePatterns = [
      /(?:今天|今日|today)(?:之?内)?/i,
      /(?:明天|明日|tomorrow)(?:之?前)?/i,
      /(?:后天|the day after tomorrow)/i,
      /(?:本周|这周|this week)(?:之?内)?/i,
      /(?:下周|next week)(?:之?前)?/i,
      /(\d{1,2})[月/.-](\d{1,2})[日号]?(?:之?前)?/,
      /(\d{1,2})[:.：](\d{2})(?:之?前)?/,
      /(?:周[一二三四五六日天]|星期[一二三四五六日天])/,
    ]
  }

  /** 从消息列表中提取待办 */
  extract(messages: ChatMessage[]): TodoItem[] {
    const todos: TodoItem[] = []

    for (const msg of messages) {
      // 只处理 @了用户的文本消息
      if (!msg.mentionsUser || msg.type !== 'text') continue

      const score = this.scoreTodo(msg.content)
      if (score <= 0) continue

      todos.push({
        message: msg,
        summary: this.extractSummary(msg.content),
        priority: this.getPriority(msg.content),
        needsReply: this.needsReply(msg.content),
        deadline: this.extractDeadline(msg.content),
      })
    }

    // 按优先级排序
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    return todos
  }

  /** 计算消息的待办分数 */
  private scoreTodo(content: string): number {
    const lower = content.toLowerCase()
    let score = 0

    for (const kw of this.keywords) {
      if (lower.includes(kw.toLowerCase())) score++
    }

    // 问号加分（可能是在问你要东西）
    if (content.includes('？') || content.includes('?')) score += 0.5

    return score
  }

  /** 提取摘要（去掉 @提及，取前 80 字符） */
  private extractSummary(content: string): string {
    return content
      .replace(/@[\w\u4e00-\u9fff]+/g, '')
      .trim()
      .slice(0, 80)
  }

  /** 判断优先级 */
  private getPriority(content: string): 'high' | 'medium' | 'low' {
    const lower = content.toLowerCase()
    for (const word of this.highPriorityWords) {
      if (lower.includes(word.toLowerCase())) return 'high'
    }
    // 有截止时间的默认 medium
    if (this.extractDeadline(content)) return 'medium'
    return 'low'
  }

  /** 判断是否需要回复 */
  private needsReply(content: string): boolean {
    const replyIndicators = ['？', '?', '回复', '确认', '回一下', '说一下', '告诉']
    const lower = content.toLowerCase()
    return replyIndicators.some(ind => lower.includes(ind))
  }

  /** 提取截止时间描述 */
  private extractDeadline(content: string): string | undefined {
    for (const pattern of this.deadlinePatterns) {
      const match = content.match(pattern)
      if (match) return match[0]
    }
    return undefined
  }
}
