/** 群聊消息结构 */
export interface ChatMessage {
  /** 消息 ID */
  id: string
  /** 发送者名称 */
  sender: string
  /** 发送者 ID */
  senderId: string
  /** 消息内容 */
  content: string
  /** 时间戳 (ms) */
  timestamp: number
  /** 群组名称 */
  groupName: string
  /** 群组 ID */
  groupId: string
  /** 是否 @了用户 */
  mentionsUser: boolean
  /** 消息类型 */
  type: 'text' | 'image' | 'file' | 'link' | 'voice' | 'other'
  /** 回复的消息 ID */
  replyTo?: string
}

/** 待办事项 */
export interface TodoItem {
  /** 原始消息 */
  message: ChatMessage
  /** 提取的待办内容 */
  summary: string
  /** 优先级: high / medium / low */
  priority: 'high' | 'medium' | 'low'
  /** 是否需要回复 */
  needsReply: boolean
  /** 提到的截止时间（如有） */
  deadline?: string
}

/** 话题聚类 */
export interface Topic {
  /** 话题标题 */
  title: string
  /** 关键消息 */
  keyMessages: ChatMessage[]
  /** 参与人 */
  participants: string[]
  /** 消息数量 */
  messageCount: number
  /** 摘要 */
  summary: string
}

/** 摘要报告 */
export interface DigestReport {
  /** 报告 ID */
  id: string
  /** 群组名称 */
  groupName: string
  /** 群组 ID */
  groupId: string
  /** 时间范围 */
  timeRange: { from: number; to: number }
  /** 消息总数 */
  totalMessages: number
  /** 活跃参与者 */
  activeParticipants: string[]
  /** 话题列表 */
  topics: Topic[]
  /** 待办事项 */
  todos: TodoItem[]
  /** 重要决定 */
  decisions: string[]
  /** 一句话总结 */
  oneLiner: string
  /** 生成时间 */
  generatedAt: number
}

/** 插件配置 */
export interface GroupDigestConfig {
  digestSchedule: 'hourly' | 'daily' | 'weekly'
  maxMessages: number
  todoKeywords: string[]
  outputFormat: 'markdown' | 'text' | 'json'
}
