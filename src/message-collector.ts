import type { ChatMessage } from './types.js'

/**
 * MessageCollector — 消息收集器
 * 
 * 收集群聊消息，按群组 ID 分桶存储，支持时间范围查询。
 * 内存存储 + 定期清理，避免无限增长。
 */
export class MessageCollector {
  /** groupId → messages[] */
  private readonly buckets = new Map<string, ChatMessage[]>()
  private readonly maxPerGroup: number
  private readonly retentionMs: number

  constructor(opts: { maxPerGroup?: number; retentionHours?: number } = {}) {
    this.maxPerGroup = opts.maxPerGroup ?? 2000
    this.retentionMs = (opts.retentionHours ?? 72) * 3600_000
  }

  /** 添加一条消息 */
  push(msg: ChatMessage): void {
    let bucket = this.buckets.get(msg.groupId)
    if (!bucket) {
      bucket = []
      this.buckets.set(msg.groupId, bucket)
    }
    bucket.push(msg)

    // 超过上限，丢弃最旧的
    if (bucket.length > this.maxPerGroup) {
      bucket.splice(0, bucket.length - this.maxPerGroup)
    }
  }

  /** 批量添加 */
  pushBatch(msgs: ChatMessage[]): void {
    for (const msg of msgs) this.push(msg)
  }

  /** 获取指定群组、时间范围内的消息 */
  query(groupId: string, from: number, to: number): ChatMessage[] {
    const bucket = this.buckets.get(groupId) ?? []
    return bucket.filter(m => m.timestamp >= from && m.timestamp <= to)
  }

  /** 获取指定群组的所有消息 */
  getAll(groupId: string): ChatMessage[] {
    return this.buckets.get(groupId) ?? []
  }

  /** 获取所有群组 ID */
  getGroupIds(): string[] {
    return [...this.buckets.keys()]
  }

  /** 获取指定群组中 @用户 的消息 */
  getMentions(groupId: string, from?: number): ChatMessage[] {
    const bucket = this.buckets.get(groupId) ?? []
    return bucket.filter(m => m.mentionsUser && (!from || m.timestamp >= from))
  }

  /** 清理过期消息 */
  cleanup(): number {
    const cutoff = Date.now() - this.retentionMs
    let removed = 0

    for (const [groupId, bucket] of this.buckets) {
      const before = bucket.length
      const filtered = bucket.filter(m => m.timestamp >= cutoff)
      if (filtered.length < before) {
        this.buckets.set(groupId, filtered)
        removed += before - filtered.length
      }
      if (filtered.length === 0) {
        this.buckets.delete(groupId)
      }
    }

    return removed
  }

  /** 统计信息 */
  stats(): { groups: number; totalMessages: number } {
    let totalMessages = 0
    for (const bucket of this.buckets.values()) {
      totalMessages += bucket.length
    }
    return { groups: this.buckets.size, totalMessages }
  }
}
