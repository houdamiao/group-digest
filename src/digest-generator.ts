import type { ChatMessage, DigestReport, Topic } from './types.js'
import { TodoExtractor } from './todo-extractor.js'

/**
 * DigestGenerator — 摘要生成器
 * 
 * 将群聊消息聚合为结构化摘要报告。
 * 包含：话题聚类、待办提取、重要决定识别、活跃度统计。
 */
export class DigestGenerator {
  private readonly todoExtractor: TodoExtractor

  constructor(todoKeywords?: string[]) {
    this.todoExtractor = new TodoExtractor(todoKeywords)
  }

  /** 生成摘要报告 */
  generate(messages: ChatMessage[], groupId: string, groupName: string): DigestReport {
    if (messages.length === 0) {
      return this.emptyReport(groupId, groupName)
    }

    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
    const from = sorted[0].timestamp
    const to = sorted[sorted.length - 1].timestamp

    // 提取参与者
    const participantSet = new Set<string>()
    for (const msg of sorted) participantSet.add(msg.sender)

    // 话题聚类（基于时间间隔 + 参与者变化）
    const topics = this.clusterTopics(sorted)

    // 待办提取
    const todos = this.todoExtractor.extract(sorted)

    // 重要决定提取
    const decisions = this.extractDecisions(sorted)

    // 一句话总结
    const oneLiner = this.generateOneLiner(sorted, topics, todos)

    return {
      id: `digest-${groupId}-${Date.now()}`,
      groupName,
      groupId,
      timeRange: { from, to },
      totalMessages: sorted.length,
      activeParticipants: [...participantSet],
      topics,
      todos,
      decisions,
      oneLiner,
      generatedAt: Date.now(),
    }
  }

  /** 话题聚类 — 基于消息间隔分割 */
  private clusterTopics(messages: ChatMessage[]): Topic[] {
    const topics: Topic[] = []
    let currentCluster: ChatMessage[] = []
    const GAP_THRESHOLD = 30 * 60_000 // 30 分钟无消息视为话题切换

    for (let i = 0; i < messages.length; i++) {
      if (i > 0 && messages[i].timestamp - messages[i - 1].timestamp > GAP_THRESHOLD) {
        if (currentCluster.length > 0) {
          topics.push(this.clusterToTopic(currentCluster))
        }
        currentCluster = []
      }
      currentCluster.push(messages[i])
    }

    if (currentCluster.length > 0) {
      topics.push(this.clusterToTopic(currentCluster))
    }

    return topics
  }

  /** 将消息簇转为话题 */
  private clusterToTopic(messages: ChatMessage[]): Topic {
    const participants = [...new Set(messages.map(m => m.sender))]
    // 取前几条作为关键消息
    const keyMessages = messages.slice(0, 3)
    // 话题标题 = 第一条消息的前 30 字符
    const title = messages[0].content.slice(0, 30).replace(/\n/g, ' ') || '(无文本)'

    return {
      title,
      keyMessages,
      participants,
      messageCount: messages.length,
      summary: `${participants.length} 人参与，共 ${messages.length} 条消息`,
    }
  }

  /** 提取重要决定 — 基于关键词匹配 */
  private extractDecisions(messages: ChatMessage[]): string[] {
    const decisionKeywords = [
      '决定', '确定', '定了', '就这样', '通过', '同意', '批准',
      '结论', '最终', '敲定', '拍板', 'decided', 'confirmed', 'approved',
    ]

    const decisions: string[] = []
    for (const msg of messages) {
      const lower = msg.content.toLowerCase()
      if (decisionKeywords.some(kw => lower.includes(kw))) {
        decisions.push(`[${msg.sender}] ${msg.content.slice(0, 100)}`)
      }
    }

    return decisions.slice(0, 10) // 最多 10 条
  }

  /** 生成一句话总结 */
  private generateOneLiner(
    messages: ChatMessage[],
    topics: Topic[],
    todos: { priority: string }[]
  ): string {
    const participants = new Set(messages.map(m => m.sender)).size
    const highPriority = todos.filter(t => t.priority === 'high').length
    const parts: string[] = [
      `共 ${messages.length} 条消息`,
      `${participants} 人参与`,
      `${topics.length} 个话题`,
    ]
    if (highPriority > 0) parts.push(`⚠️ ${highPriority} 条紧急待办`)
    if (todos.length > 0) parts.push(`📋 ${todos.length} 条待办`)

    return parts.join('，')
  }

  /** 空报告 */
  private emptyReport(groupId: string, groupName: string): DigestReport {
    return {
      id: `digest-${groupId}-${Date.now()}`,
      groupName,
      groupId,
      timeRange: { from: 0, to: 0 },
      totalMessages: 0,
      activeParticipants: [],
      topics: [],
      todos: [],
      decisions: [],
      oneLiner: '暂无消息',
      generatedAt: Date.now(),
    }
  }
}
