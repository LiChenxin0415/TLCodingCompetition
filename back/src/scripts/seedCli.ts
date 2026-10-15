import { closeDb, getDb, resolveDbFile } from '../db/index.ts';
import { seedDemoData } from '../db/seed.ts';

const db = getDb();
const r = seedDemoData(db);
console.log('种子数据完成：账号 ' + r.users + ' 个 / 合约 ' + r.contracts + ' 份 / 工作包 ' + r.items + ' 个');
console.log('数据库文件：' + resolveDbFile());
closeDb();