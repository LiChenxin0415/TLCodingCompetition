// 本地 Mock LLM（OpenAI 兼容），断网时演示 AI 链路
import http from 'node:http';

const PORT = Number(process.env.MOCK_LLM_PORT ?? 3021);

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer((req, res) => {
  void (async () => {
    if (req.method !== 'POST' || req.url === undefined || !req.url.includes('/chat/completions')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    const raw = await readBody(req);
    let prompt = '';
    try { prompt = ((JSON.parse(raw) as { messages?: Array<{ content?: string }> }).messages ?? []).map((m) => m.content ?? '').join('\n'); } catch { prompt = raw; }

    let content: string;
    if (prompt.includes('进度解析')) {
      content = JSON.stringify({ item_id: 'item_m01_1', new_progress: 90, delta: 20, evidence: ['联调完成'], confidence: 0.9, candidates: [{ item_id: 'item_m01_1', title: '慢SQL治理' }] });
    } else if (prompt.includes('日报周报摘要')) {
      content = JSON.stringify({ summary: ['完成联调', '环境问题解决'], suggestions: [{ title: '慢SQL治理', delta: 10, reason: '联调完成' }] });
    } else {
      content = JSON.stringify({ items: [
        { type: '治理改善类', title: '慢SQL治理', target_desc: '治理 10 条慢SQL，平均耗时下降 30%', deliverable: { type: '数据报表', desc: '治理清单与对比报表' }, weight: 30, priority: '高', due_date: '2026-10-31', objective_id: 'obj_001' },
        { type: '重点交付类', title: '核心模块联调', target_desc: '完成核心系统联调并通过测试', deliverable: { type: '代码合并请求', desc: '联调 MR' }, weight: 40, priority: '高', due_date: '2026-10-28', objective_id: 'obj_001' },
        { type: '基础履职类', title: '生产稳定性保障', target_desc: '保障生产稳定，工单及时处理', deliverable: { type: '运维记录', desc: '本月运维工单记录' }, weight: 30, priority: '中', due_date: '2026-10-30', objective_id: null },
      ], total_weight: 100 });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'mock', object: 'chat.completion', model: 'mock-model', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
  })();
});

server.listen(PORT, () => console.log('Mock LLM: http://127.0.0.1:' + PORT + '/v1/chat/completions'));