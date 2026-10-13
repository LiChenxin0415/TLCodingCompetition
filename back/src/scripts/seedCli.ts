/**
 * 种子数据 CLI（REP-04）
 * 用法：npm run seed（幂等，已存在的数据不会被覆盖）
 */

import { closeDb, getDb, resolveDbFile } from '../db/index.ts';
import { seedDemoData, SEED_USERS } from '../db/seed.ts';

const db = getDb();
const result = seedDemoData(db);

console.log('种子数据执行完成');
console.log(`  数据库文件 : ${resolveDbFile()}`);
console.log(`  预置账号   : ${SEED_USERS.map((u) => `${u.id}(${u.name}/${u.role})`).join('、')}`);
console.log(`  新增账号   : ${result.users} 个（已存在则跳过）`);
console.log(`  新增历史周报: ${result.reports} 条（已存在则跳过）`);

closeDb();
