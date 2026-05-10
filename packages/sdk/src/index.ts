export type AgentClass = "worker" | "router" | "judge" | "optimizer" | "validator";

export type Tier = "simple" | "medium" | "complex";

export type ModelId = "gemini-2.5-flash-lite" | "gpt-4.1-mini" | "gpt-4.1" | "gpt-5";

export interface AgentMeshClientConfig {
  apiBaseUrl: string;
  rpcUrl?: string;
  fetch?: FetchLike;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
  websocketUrl?: string;
}

export interface WalletLike {
  publicKey: string | { toString(): string };
  signTransaction?: (transaction: unknown) => Promise<unknown>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface PostTaskOptions {
  taskId?: string;
  taskPda?: string;
  routerAgentPda?: string;
  orchestratorAgentPda?: string;
  timeoutSlots?: number;
}

export interface RegisterAgentConfig {
  agentId?: string;
  name: string;
  agentClass: AgentClass;
  capabilities: string[];
  pricePerTaskLamports: bigint | number | string;
  minTier?: Tier;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface QueryAgentsFilter {
  capabilities?: string[];
  agentClass?: AgentClass;
  minReputationScore?: number;
  maxPricePerTaskLamports?: bigint | number | string;
}

export interface AgentInfo {
  agentId: string;
  name: string;
  ownerPubkey: string;
  agentClass: AgentClass;
  capabilities: string[];
  reputationScore: number;
  completedTasks: number;
  failedTasks: number;
  pricePerTaskLamports: bigint;
  minTier?: Tier;
  endpoint?: string;
  registeredAt: string;
  metadata?: Record<string, unknown>;
}

export type TaskStatus = "accepted" | "completed" | "partial_failure" | "rejected" | "not_found";

export interface Task {
  taskId: string;
  status: TaskStatus;
  subtaskCount: number;
  completedSubtasks: number;
  failedSubtasks: number;
  totalBudgetLamports?: bigint;
  releaseOrchestratorFeeSignature?: string;
  subtasks: Subtask[];
}

export interface Subtask {
  id: string;
  index: number;
  description: string;
  status: string;
  workerAgentPda?: string;
  declaredTier?: Tier;
  modelId?: ModelId;
  judgeScore?: number;
  confidence?: number;
  costLamports: bigint;
  resultHash?: string;
  resultContent?: string;
  error?: string;
}

export interface CostBreakdown {
  totalBudgetLamports: bigint;
  allocatedLamports: bigint;
  spentLamports: bigint;
  refundedLamports: bigint;
  orchestratorFeeLamports: bigint;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  content: string;
  costBreakdown: CostBreakdown;
  subtasks: Subtask[];
}

export interface CancelTaskResult {
  taskId: string;
  cancelled: boolean;
  reason?: string;
}

export interface WaitForCompletionOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onProgress?: (task: Task) => void;
  preferWebSocket?: boolean;
}

export interface AgentReputation {
  agentId: string;
  reputationScore: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  updatedAt: string;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface OrchestratorRecordResponse {
  subtask?: {
    id?: string;
    index?: number;
    description?: string;
    estimatedBudgetLamports?: string | number | bigint;
  };
  status?: string;
  worker?: {
    agentPda?: string;
    pricePerTaskLamports?: string | number | bigint;
  };
  routerDecision?: {
    tier?: Tier;
    modelId?: ModelId;
    budgetSliceLamports?: string | number | bigint;
    confidence?: number;
  };
  judgeResult?: {
    score?: number;
  };
  resultHash?: string;
  resultContent?: string;
  error?: string;
}

interface OrchestratorTaskResponse {
  taskId: string;
  status: TaskStatus;
  subtaskCount?: number;
  completedSubtasks?: number;
  failedSubtasks?: number;
  releaseOrchestratorFeeSignature?: string;
  records?: OrchestratorRecordResponse[];
}

export class AgentMeshClient {
  private readonly fetchImpl: FetchLike;
  private readonly apiBaseUrl: string;

  constructor(private readonly config: AgentMeshClientConfig) {
    this.apiBaseUrl = trimTrailingSlash(config.apiBaseUrl);
    this.fetchImpl = config.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetchImpl) {
      throw new Error("AgentMeshClient requires a fetch implementation.");
    }
  }

  get rpcUrl(): string | undefined {
    return this.config.rpcUrl;
  }

  get websocketUrl(): string | undefined {
    return this.config.websocketUrl;
  }

  async postTask(
    brief: string,
    budgetLamports: bigint | number | string,
    wallet: WalletLike,
    options: PostTaskOptions = {},
  ): Promise<TaskHandle> {
    const response = await this.request<OrchestratorTaskResponse>("/orchestrator/tasks", {
      method: "POST",
      body: {
        taskId: options.taskId,
        creatorPubkey: walletPublicKey(wallet),
        brief,
        budgetLamports: toLamportString(budgetLamports),
        taskPda: options.taskPda,
        routerAgentPda: options.routerAgentPda,
        orchestratorAgentPda: options.orchestratorAgentPda,
        timeoutSlots: options.timeoutSlots,
      },
    });

    return new TaskHandle(this, normalizeTask(response, budgetLamports));
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await this.request<OrchestratorTaskResponse>(`/orchestrator/tasks/${taskId}`);
    return normalizeTask(response);
  }

  async registerAgent(config: RegisterAgentConfig, wallet: WalletLike): Promise<AgentInfo> {
    const response = await this.request<SerializedAgentInfo>("/sdk/agents", {
      method: "POST",
      body: {
        ...config,
        ownerPubkey: walletPublicKey(wallet),
        pricePerTaskLamports: toLamportString(config.pricePerTaskLamports),
      },
    });
    return normalizeAgent(response);
  }

  async queryAgents(filter: QueryAgentsFilter = {}): Promise<AgentInfo[]> {
    const search = new URLSearchParams();
    for (const capability of filter.capabilities ?? []) {
      search.append("capability", capability);
    }
    if (filter.agentClass) {
      search.set("agentClass", filter.agentClass);
    }
    if (filter.minReputationScore !== undefined) {
      search.set("minReputationScore", String(filter.minReputationScore));
    }
    if (filter.maxPricePerTaskLamports !== undefined) {
      search.set("maxPricePerTaskLamports", toLamportString(filter.maxPricePerTaskLamports));
    }

    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    const response = await this.request<SerializedAgentInfo[]>(`/sdk/agents${suffix}`);
    return response.map(normalizeAgent);
  }

  async getAgentReputation(agentPubkey: string): Promise<AgentReputation> {
    return this.request<AgentReputation>(
      `/sdk/agents/${encodeURIComponent(agentPubkey)}/reputation`,
    );
  }

  async cancelTask(taskId: string): Promise<CancelTaskResult> {
    return this.request<CancelTaskResult>(`/sdk/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: "POST",
    });
  }

  createTaskHandle(taskId: string): TaskHandle {
    return new TaskHandle(this, {
      taskId,
      status: "accepted",
      subtaskCount: 0,
      completedSubtasks: 0,
      failedSubtasks: 0,
      subtasks: [],
    });
  }

  async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const controller =
      this.config.requestTimeoutMs !== undefined ? new AbortController() : undefined;
    const timeout =
      controller && this.config.requestTimeoutMs
        ? setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
        : undefined;

    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
        method: init.method ?? "GET",
        headers: init.body ? { "content-type": "application/json" } : undefined,
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: controller?.signal,
      });

      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as unknown) : undefined;
      if (!response.ok) {
        throw new AgentMeshHttpError(response.status, response.statusText, parsed);
      }
      return parsed as T;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}

export class TaskHandle {
  constructor(
    private readonly client: AgentMeshClient,
    private currentTask: Task,
  ) {}

  get taskId(): string {
    return this.currentTask.taskId;
  }

  snapshot(): Task {
    return this.currentTask;
  }

  async getStatus(): Promise<Task> {
    this.currentTask = await this.client.getTask(this.taskId);
    return this.currentTask;
  }

  async waitForCompletion(options: WaitForCompletionOptions = {}): Promise<TaskResult> {
    if (options.preferWebSocket) {
      const websocketResult = await this.tryWaitWithWebSocket(options);
      if (websocketResult) {
        return websocketResult;
      }
    }

    const startedAt = Date.now();
    const intervalMs = options.pollIntervalMs ?? 1_500;
    for (;;) {
      const status = await this.getStatus();
      options.onProgress?.(status);
      if (isTerminal(status.status)) {
        return this.getResult();
      }
      if (options.timeoutMs !== undefined && Date.now() - startedAt > options.timeoutMs) {
        throw new Error(`Task ${this.taskId} did not complete within ${options.timeoutMs}ms.`);
      }
      await sleep(intervalMs);
    }
  }

  async getResult(): Promise<TaskResult> {
    const task = isTerminal(this.currentTask.status) ? this.currentTask : await this.getStatus();
    const content = task.subtasks
      .filter((subtask) => subtask.resultContent)
      .sort((left, right) => left.index - right.index)
      .map((subtask) => subtask.resultContent)
      .join("\n\n");

    return {
      taskId: task.taskId,
      status: task.status,
      content,
      costBreakdown: buildCostBreakdown(task),
      subtasks: task.subtasks,
    };
  }

  async cancel(): Promise<CancelTaskResult> {
    return this.client.cancelTask(this.taskId);
  }

  private async tryWaitWithWebSocket(
    options: WaitForCompletionOptions,
  ): Promise<TaskResult | null> {
    if (!this.client.websocketUrl || typeof WebSocket === "undefined") {
      return null;
    }

    return new Promise((resolve, reject) => {
      const url = `${trimTrailingSlash(this.client.websocketUrl!)}/tasks/${this.taskId}`;
      const socket = new WebSocket(url);
      const timeout =
        options.timeoutMs !== undefined
          ? setTimeout(() => {
              socket.close();
              reject(
                new Error(`Task ${this.taskId} did not complete within ${options.timeoutMs}ms.`),
              );
            }, options.timeoutMs)
          : undefined;

      socket.onmessage = (event) => {
        const task = normalizeTask(JSON.parse(String(event.data)) as OrchestratorTaskResponse);
        this.currentTask = task;
        options.onProgress?.(task);
        if (isTerminal(task.status)) {
          if (timeout) {
            clearTimeout(timeout);
          }
          socket.close();
          void this.getResult().then(resolve, reject);
        }
      };
      socket.onerror = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        socket.close();
        resolve(null);
      };
    });
  }
}

export class AgentMeshHttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
  ) {
    super(`AgentMesh API request failed with ${status} ${statusText}`);
  }
}

interface SerializedAgentInfo extends Omit<AgentInfo, "pricePerTaskLamports"> {
  pricePerTaskLamports: string | number | bigint;
}

function normalizeTask(
  response: OrchestratorTaskResponse,
  budgetLamports: LamportsLike = 0n,
): Task {
  const subtasks = (response.records ?? []).map((record, index) => {
    const costLamports = toBigInt(
      record.worker?.pricePerTaskLamports ??
        record.routerDecision?.budgetSliceLamports ??
        record.subtask?.estimatedBudgetLamports ??
        0n,
    );
    return {
      id: record.subtask?.id ?? `subtask-${index}`,
      index: record.subtask?.index ?? index,
      description: record.subtask?.description ?? "",
      status: record.status ?? "pending",
      workerAgentPda: record.worker?.agentPda,
      declaredTier: record.routerDecision?.tier,
      modelId: record.routerDecision?.modelId,
      judgeScore: record.judgeResult?.score,
      confidence: record.routerDecision?.confidence,
      costLamports,
      resultHash: record.resultHash,
      resultContent: record.resultContent,
      error: record.error,
    } satisfies Subtask;
  });

  return {
    taskId: response.taskId,
    status: response.status,
    subtaskCount: response.subtaskCount ?? subtasks.length,
    completedSubtasks: response.completedSubtasks ?? countStatus(subtasks, "completed"),
    failedSubtasks: response.failedSubtasks ?? countFailed(subtasks),
    totalBudgetLamports: toBigInt(budgetLamports),
    releaseOrchestratorFeeSignature: response.releaseOrchestratorFeeSignature,
    subtasks,
  };
}

function normalizeAgent(agent: SerializedAgentInfo): AgentInfo {
  return {
    ...agent,
    pricePerTaskLamports: toBigInt(agent.pricePerTaskLamports),
  };
}

function buildCostBreakdown(task: Task): CostBreakdown {
  const spentLamports = task.subtasks.reduce((sum, subtask) => {
    return subtask.status === "completed" ? sum + subtask.costLamports : sum;
  }, 0n);
  const allocatedLamports = task.subtasks.reduce((sum, subtask) => sum + subtask.costLamports, 0n);
  const totalBudgetLamports = task.totalBudgetLamports ?? allocatedLamports;

  return {
    totalBudgetLamports,
    allocatedLamports,
    spentLamports,
    refundedLamports:
      totalBudgetLamports > spentLamports ? totalBudgetLamports - spentLamports : 0n,
    orchestratorFeeLamports: 0n,
  };
}

function walletPublicKey(wallet: WalletLike): string {
  return typeof wallet.publicKey === "string" ? wallet.publicKey : wallet.publicKey.toString();
}

type LamportsLike = bigint | number | string;

function toLamportString(value: LamportsLike): string {
  return toBigInt(value).toString();
}

function toBigInt(value: LamportsLike): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isTerminal(status: TaskStatus): boolean {
  return status === "completed" || status === "partial_failure" || status === "rejected";
}

function countStatus(subtasks: Subtask[], status: string): number {
  return subtasks.filter((subtask) => subtask.status === status).length;
}

function countFailed(subtasks: Subtask[]): number {
  return subtasks.filter((subtask) => subtask.status === "failed" || subtask.status === "skipped")
    .length;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
