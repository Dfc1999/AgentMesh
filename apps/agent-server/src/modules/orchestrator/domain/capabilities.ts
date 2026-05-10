export const CAPABILITY_BITS: Record<string, bigint> = {
  research: 1n << 0n,
  analysis: 1n << 1n,
  execution: 1n << 2n,
  validation: 1n << 3n,
  orchestration: 1n << 4n,
  defi: 1n << 5n,
  coding: 1n << 6n,
  summarization: 1n << 7n,
};

export function capabilityMaskFor(capabilities: string[]): bigint {
  return capabilities.reduce((mask, capability) => {
    const bit = CAPABILITY_BITS[capability.toLowerCase()] ?? 0n;
    return mask | bit;
  }, 0n);
}

export function inferCapabilities(description: string): string[] {
  const text = description.toLowerCase();
  const capabilities = new Set<string>();

  if (/research|investiga|fuente|document|mercado|search/.test(text)) {
    capabilities.add("research");
  }
  if (/analiza|analysis|compar|metric|riesgo|tradeoff|evalua/.test(text)) {
    capabilities.add("analysis");
  }
  if (/codigo|code|implement|ejecut|transacci|defi|swap|deploy/.test(text)) {
    capabilities.add("execution");
  }
  if (/valid|test|qa|verifica|audit|seguridad/.test(text)) {
    capabilities.add("validation");
  }
  if (/defi|solana|wallet|token|escrow|on-chain/.test(text)) {
    capabilities.add("defi");
  }
  if (/api|typescript|rust|nestjs|anchor|pinocchio/.test(text)) {
    capabilities.add("coding");
  }

  if (capabilities.size === 0) {
    capabilities.add("analysis");
  }

  return [...capabilities];
}
