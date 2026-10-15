import type { AuthUser, SkillTag } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as repo from '../repositories/contractRepo.ts';
import * as dlvRepo from '../repositories/deliverableRepo.ts';
import * as skillRepo from '../repositories/skillRepo.ts';
import * as userRepo from '../repositories/userRepo.ts';
import { forbidden, notFound } from '../utils/errors.ts';
import { currentMonth } from '../utils/month.ts';
import { newId, nowStamp } from '../utils/misc.ts';

const DICT: Array<{ tag: string; keywords: string[] }> = [
  { tag: '需求与产品分析能力', keywords: ['需求', '产品', '原型', 'PRD', '用户故事', '产品分析'] },
  { tag: 'Java 后端开发能力', keywords: ['Java', '后端', '接口', '服务', 'Spring', '联调'] },
  { tag: '前端开发能力', keywords: ['前端', '页面', 'React', 'Vue', '组件', 'UI', 'H5'] },
  { tag: '数据库与 SQL 调优能力', keywords: ['SQL', '数据库', '慢SQL', '调优', '索引', '数据报表', '迁移脚本'] },
  { tag: '系统架构与治理能力', keywords: ['架构', '治理', '分布式', '重构', '稳定性', '高可用', '生产稳定'] },
  { tag: '测试与质量保障能力', keywords: ['测试', '质量', '单测', '回归', '验收', '测试报告'] },
  { tag: '项目管理与协同能力', keywords: ['项目', '协同', '排期', '评审', '推动', '上线单'] },
  { tag: 'AI 应用与数据能力', keywords: ['AI', '模型', '算法', '智能', '数据', 'PoC'] },
];

function matchScore(text: string): Map<string, number> {
  const hits = new Map<string, number>();
  for (const entry of DICT) {
    for (const kw of entry.keywords) {
      if (text.includes(kw)) { hits.set(entry.tag, (hits.get(entry.tag) ?? 0) + 1); }
    }
  }
  return hits;
}

/** FR-08 R1：工作包文本命中1分 / 交付物类型命中1分 / 进度留痕命中0.5分；≥2 生成 */
export function regenerateSkills(user: AuthUser, targetUserId: string): SkillTag[] {
  const db = getDb();
  const target = userRepo.findUserById(db, targetUserId);
  if (target === null) throw notFound('用户不存在');
  if (user.role === 'employee' && user.id !== targetUserId) throw forbidden();

  const contract = repo.findContractByUserMonth(db, targetUserId, currentMonth());
  const items = contract === null ? [] : repo.listItemsByContract(db, contract.id);
  const scores = new Map<string, { score: number; evidence: string[] }>();

  for (const item of items) {
    const textHits = matchScore(item.title + ' ' + item.targetDesc + ' ' + item.deliverableDesc);
    for (const [tag, n] of textHits) {
      const cur = scores.get(tag) ?? { score: 0, evidence: [] };
      cur.score += 1; // 文本命中 1 分（每个标签最多计 1 分）
      if (!cur.evidence.includes(item.id)) cur.evidence.push(item.id);
      scores.set(tag, cur);
    }
    const logs = dlvRepo.listProgressLogs(db, item.id);
    for (const log of logs) {
      const logHits = matchScore(log.rawText);
      for (const tag of logHits.keys()) {
        const cur = scores.get(tag) ?? { score: 0, evidence: [] };
        cur.score += 0.5;
        if (!cur.evidence.includes(item.id)) cur.evidence.push(item.id);
        scores.set(tag, cur);
      }
    }
  }

  const result: SkillTag[] = [];
  for (const [tag, v] of scores) {
    if (v.score < 2) continue;
    const tagRow: SkillTag = { id: 'tag_' + targetUserId + '_' + tag, userId: targetUserId, tagName: tag, score: Math.round(v.score * 10) / 10, evidenceItemIds: JSON.stringify(v.evidence), updatedAt: nowStamp(), hidden: 0 };
    skillRepo.upsertSkillTag(db, tagRow);
    result.push(tagRow);
  }
  return result;
}

export function listSkills(user: AuthUser, targetUserId: string): SkillTag[] {
  if (user.role === 'employee' && user.id !== targetUserId) throw forbidden();
  return skillRepo.listSkillTags(getDb(), targetUserId);
}

export function hideSkill(user: AuthUser, tagId: string): void {
  if (user.role === 'center') { /* 中心可隐藏 */ } else { throw forbidden(); }
  skillRepo.hideSkillTag(getDb(), tagId);
}