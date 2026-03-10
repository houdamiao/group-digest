/**
 * 快速验证 — 不依赖 OpenClaw runtime
 */
import { MessageCollector } from './src/message-collector.js'
import { DigestGenerator } from './src/digest-generator.js'
import { Formatter } from './src/formatter.js'
import type { ChatMessage } from './src/types.js'

// 模拟群聊消息
const now = Date.now()
const messages: ChatMessage[] = [
  {
    id: '1', sender: '张三', senderId: 'u1', content: '大家好，今天讨论一下新版本发布计划',
    timestamp: now - 3600_000 * 3, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: false, type: 'text',
  },
  {
    id: '2', sender: '李四', senderId: 'u2', content: '我觉得可以下周三发布',
    timestamp: now - 3600_000 * 2.9, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: false, type: 'text',
  },
  {
    id: '3', sender: '张三', senderId: 'u1', content: '确定了，就下周三发布',
    timestamp: now - 3600_000 * 2.8, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: false, type: 'text',
  },
  {
    id: '4', sender: '王五', senderId: 'u3', content: '@小明 请帮忙今天之内把产品文档更新完，紧急！',
    timestamp: now - 3600_000 * 2, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: true, type: 'text',
  },
  {
    id: '5', sender: '李四', senderId: 'u2', content: '@小明 帮忙看一下明天之前上线后的数据可以吗？',
    timestamp: now - 3600_000 * 1.5, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: true, type: 'text',
  },
  {
    id: '6', sender: '赵六', senderId: 'u4', content: '有空的话帮忙 review 一下我的 PR',
    timestamp: now - 3600_000 * 1, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: false, type: 'text',
  },
  {
    id: '7', sender: '张三', senderId: 'u1', content: '@小明 有空回复一下客户的邮件？',
    timestamp: now - 3600_000 * 0.5, groupName: '产品讨论群', groupId: 'g1',
    mentionsUser: true, type: 'text',
  },
]

// 测试
const collector = new MessageCollector()
collector.pushBatch(messages)

const generator = new DigestGenerator()
const formatter = new Formatter()

const report = generator.generate(messages, 'g1', '产品讨论群')
const output = formatter.format(report, 'markdown')

console.log(output)
console.log('\n--- 统计 ---')
console.log(`收集器: ${JSON.stringify(collector.stats())}`)
console.log(`待办: ${report.todos.length} 条`)
console.log(`决定: ${report.decisions.length} 条`)
console.log(`话题: ${report.topics.length} 个`)
