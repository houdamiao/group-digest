import type { ChatMessage } from './types.js'

/**
 * FeishuFetcher — 从飞书 API 拉取群聊消息历史
 * 
 * 使用飞书开放平台 API 获取指定群的消息列表，
 * 转换为 GroupDigest 的标准 ChatMessage 格式。
 */

interface FeishuMessageItem {
  message_id: string
  root_id?: string
  parent_id?: string
  create_time: string  // 毫秒时间戳字符串
  chat_id: string
  msg_type: string
  body?: { content: string }
  sender?: {
    id: string
    id_type: string
    sender_type: string
    tenant_key?: string
  }
  mentions?: Array<{
    key: string
    id: { open_id?: string; user_id?: string; union_id?: string }
    name: string
    tenant_key?: string
  }>
}

interface FeishuTokenResponse {
  code: number
  msg: string
  tenant_access_token?: string
  expire?: number
}

interface FeishuMessagesResponse {
  code: number
  msg: string
  data?: {
    items?: FeishuMessageItem[]
    has_more?: boolean
    page_token?: string
  }
}

export class FeishuFetcher {
  private readonly appId: string
  private readonly appSecret: string
  private readonly baseUrl = 'https://open.feishu.cn/open-apis'
  private token: string | null = null
  private tokenExpireAt = 0

  constructor(appId: string, appSecret: string) {
    this.appId = appId
    this.appSecret = appSecret
  }

  /** 获取 tenant_access_token */
  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpireAt) {
      return this.token
    }

    const res = await fetch(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    })

    const data = await res.json() as FeishuTokenResponse
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`获取飞书 token 失败: ${data.msg}`)
    }

    this.token = data.tenant_access_token
    this.tokenExpireAt = Date.now() + (data.expire ?? 7200) * 1000 - 60_000 // 提前1分钟过期
    return this.token
  }

  /** 拉取指定群的消息历史 */
  async fetchMessages(
    chatId: string,
    opts: { hoursBack?: number; limit?: number; botOpenId?: string } = {}
  ): Promise<ChatMessage[]> {
    const token = await this.getToken()
    const hoursBack = opts.hoursBack ?? 24
    const limit = opts.limit ?? 200
    const startTime = String(Date.now() - hoursBack * 3600_000)
    const endTime = String(Date.now())

    const allMessages: ChatMessage[] = []
    let pageToken: string | undefined
    let hasMore = true

    while (hasMore && allMessages.length < limit) {
      const params = new URLSearchParams({
        container_id_type: 'chat',
        container_id: chatId,
        start_time: startTime,
        end_time: endTime,
        sort_type: 'ByCreateTimeAsc',
        page_size: String(Math.min(50, limit - allMessages.length)),
      })
      if (pageToken) params.set('page_token', pageToken)

      const res = await fetch(
        `${this.baseUrl}/im/v1/messages?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await res.json() as FeishuMessagesResponse
      if (data.code !== 0) {
        throw new Error(`拉取消息失败: ${data.msg} (code: ${data.code})`)
      }

      const items = data.data?.items ?? []
      for (const item of items) {
        const msg = this.convertMessage(item, chatId, opts.botOpenId)
        if (msg) allMessages.push(msg)
      }

      hasMore = data.data?.has_more ?? false
      pageToken = data.data?.page_token
    }

    return allMessages
  }

  /** 转换飞书消息为标准格式 */
  private convertMessage(
    item: FeishuMessageItem,
    chatId: string,
    botOpenId?: string
  ): ChatMessage | null {
    // 只处理文本消息
    if (item.msg_type !== 'text' && item.msg_type !== 'post') return null

    let content = ''
    try {
      if (item.msg_type === 'text' && item.body?.content) {
        const parsed = JSON.parse(item.body.content)
        content = parsed.text ?? ''
      } else if (item.msg_type === 'post' && item.body?.content) {
        // 富文本，提取纯文本
        const parsed = JSON.parse(item.body.content)
        content = this.extractPostText(parsed)
      }
    } catch {
      content = item.body?.content ?? ''
    }

    if (!content.trim()) return null

    // 判断是否 @了机器人
    const mentionsBot = botOpenId
      ? (item.mentions ?? []).some(m => m.id?.open_id === botOpenId)
      : false

    return {
      id: item.message_id,
      sender: item.sender?.id ?? 'unknown',
      senderId: item.sender?.id ?? 'unknown',
      content,
      timestamp: parseInt(item.create_time, 10),
      groupName: chatId,
      groupId: chatId,
      mentionsUser: mentionsBot,
      type: 'text',
      replyTo: item.parent_id,
    }
  }

  /** 从富文本 post 中提取纯文本 */
  private extractPostText(post: Record<string, unknown>): string {
    const parts: string[] = []
    const content = (post as Record<string, Record<string, unknown>[][]>)
    
    // post 格式: { zh_cn: { title, content: [[{tag, text}]] } }
    for (const lang of Object.values(content)) {
      if (Array.isArray(lang)) {
        // lang 是 content 数组
        for (const line of lang) {
          if (Array.isArray(line)) {
            for (const node of line) {
              if ((node as Record<string, string>).text) {
                parts.push((node as Record<string, string>).text)
              }
            }
          }
        }
      } else if (typeof lang === 'object' && lang !== null) {
        const obj = lang as Record<string, unknown>
        if (obj.title) parts.push(String(obj.title))
        if (Array.isArray(obj.content)) {
          for (const line of obj.content) {
            if (Array.isArray(line)) {
              for (const node of line) {
                if ((node as Record<string, string>).text) {
                  parts.push((node as Record<string, string>).text)
                }
              }
            }
          }
        }
      }
    }
    
    return parts.join(' ')
  }

  /** 获取群信息 */
  async getChatInfo(chatId: string): Promise<{ name: string; description?: string }> {
    const token = await this.getToken()
    const res = await fetch(`${this.baseUrl}/im/v1/chats/${chatId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json() as { code: number; data?: { name?: string; description?: string } }
    return {
      name: data.data?.name ?? chatId,
      description: data.data?.description,
    }
  }
}
