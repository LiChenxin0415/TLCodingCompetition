/**
 * 本地 Mock LLM 服务（OpenAI 兼容协议）
 *
 * 用途（比赛现场很关键）：
 *   1) 没有真实 API Key / 现场网络不通时，仍可完整演示"AI 生成"链路（GEN-04/06/07）；
 *   2) 单元/冒烟测试 AI 解析与归一化逻辑（配合 npm run smoke）。
 *
 * 用法：
 *   npm run mock:llm                       # 默认监听 3021
 *   LLM_BASE_URL=http://127.0.0.1:3021/v1  # 后端指向该 Mock
 *
 * 行为约定：
 *   - 请求体包含"团队级周报" → 返回团队四段结构（不带代码围栏）
 *   - 输入包含 HANG        → 故意不响应（用于验证 20s 超时 504，GEN-04）
 *   - 其他情况             → 返回个人周报四字段（**带 markdown 围栏**，用于验证围栏剥离）
 */

import http from 'node:http';

const PORT = Number(process.env.MOCK_LLM_PORT ?? 3021);

const PERSONAL_JSON = {
  weekDone: ['完成登录接口联调', '周报模块 CRUD 实现'],
  ongoing: ['权限校验模块（60%）'],
  issues: ['暂无'],
  nextPlan: ['权限用例测试', '总览页联调'],
};

const TEAM_JSON = {
  overall: '本周团队整体推进顺利，核心接口联调完成，总览页待收尾。',
  achievements: ['李成员：完成登录与周报 CRUD', '张成员：模板查询接口', '王负责人：代补风险说明'],
  risks: ['刘成员：权限测试阻塞，需后端支持'],
  nextFocus: ['权限用例测试', '团队总览页联调', '演示数据灌入'],
};

interface ChatBody {
  messages?: Array<{ role?: string; content?: unknown }>;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer((req, res) => {
  void (async () => {
    if (req.method !== 'POST' || req.url === undefined || !req.url.includes('/chat/completions')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'mock llm: only POST /v1/chat/completions' } }));
      return;
    }

    const raw = await readBody(req);
    let prompt = '';
    try {
      const parsed = JSON.parse(raw) as ChatBody;
      prompt = (parsed.messages ?? []).map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
    } catch {
      prompt = raw;
    }

    if (prompt.includes('HANG')) {
      console.log('[mock-llm] 收到 HANG 指令，故意不响应（用于验证超时 504）');
      return; // 不响应，让客户端 AbortController 超时
    }

    const isTeam = prompt.includes('团队级周报');
    const content = isTeam
      ? JSON.stringify(TEAM_JSON)
      : `\`\`\`json\n${JSON.stringify(PERSONAL_JSON)}\n\`\`\``; // 带围栏，验证解析容错

    console.log(`[mock-llm] 返回${isTeam ? '团队' : '个人'}周报（prompt ${prompt.length} 字符）`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'mock-model',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      }),
    );
  })();
});

server.listen(PORT, () => {
  console.log(`Mock LLM 已启动：http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log('把后端 LLM_BASE_URL 指到 http://127.0.0.1:' + PORT + '/v1 即可离线演示 AI 生成');
});
