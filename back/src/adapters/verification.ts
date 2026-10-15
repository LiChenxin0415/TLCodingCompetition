// 数据适配层（PRD §5.2 / HLD §10）：本期 Mock，接口就绪后替换
export interface VerificationResult {
  actual: string;
  suggest_score: number;
  basis: string;
}

export async function fetchEvidence(item: { title: string; targetDesc: string }): Promise<VerificationResult> {
  // Mock：返回预置核验数据（演示用）
  return {
    actual: item.title + '：' + item.targetDesc + '（Mock 取数结果，待接治理平台）',
    suggest_score: 105,
    basis: '来自 Mock 取数适配器，仅演示',
  };
}