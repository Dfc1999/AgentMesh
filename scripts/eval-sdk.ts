import { AgentMeshClient, type FetchLike } from "../packages/sdk/src";

async function main() {
  const fetch = createMockFetch();
  const client = new AgentMeshClient({
    apiBaseUrl: "http://agentmesh.test",
    fetch,
    pollIntervalMs: 1,
  });
  const wallet = { publicKey: "FrontendWallet111111111111111111111111111111" };

  const handle = await client.postTask(
    "Build a frontend-ready AgentMesh SDK eval.",
    2_000_000n,
    wallet,
    {
      taskId: "sdk-eval-task",
    },
  );
  const status = await handle.getStatus();
  const result = await handle.waitForCompletion({ pollIntervalMs: 1, timeoutMs: 500 });
  const registered = await client.registerAgent(
    {
      name: "Frontend SDK Agent",
      agentClass: "worker",
      capabilities: ["frontend", "integration"],
      pricePerTaskLamports: 123_000n,
      minTier: "simple",
    },
    wallet,
  );
  const agents = await client.queryAgents({ capabilities: ["frontend"] });
  const reputation = await client.getAgentReputation(registered.agentId);
  const cancel = await handle.cancel();

  console.table([
    { case: "post task", ok: handle.taskId === "sdk-eval-task", detail: handle.taskId },
    { case: "status", ok: status.status === "completed", detail: status.status },
    { case: "result", ok: result.content.includes("SDK result"), detail: result.status },
    {
      case: "register agent",
      ok: registered.ownerPubkey === wallet.publicKey,
      detail: registered.agentId,
    },
    { case: "query agents", ok: agents.length === 1, detail: agents[0]?.name ?? "" },
    {
      case: "reputation",
      ok: reputation.agentId === registered.agentId,
      detail: reputation.reputationScore,
    },
    { case: "cancel contract", ok: cancel.cancelled === false, detail: cancel.reason ?? "" },
  ]);

  if (
    handle.taskId !== "sdk-eval-task" ||
    status.status !== "completed" ||
    !result.content.includes("SDK result") ||
    agents.length !== 1 ||
    reputation.agentId !== registered.agentId
  ) {
    throw new Error("SDK eval failed.");
  }
}

function createMockFetch(): FetchLike {
  const agents = new Map<string, Record<string, unknown>>();

  return async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";

    if (url.pathname === "/orchestrator/tasks" && method === "POST") {
      return json(taskResponse("sdk-eval-task"));
    }
    if (url.pathname === "/orchestrator/tasks/sdk-eval-task") {
      return json(taskResponse("sdk-eval-task"));
    }
    if (url.pathname === "/sdk/agents" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const agent = {
        agentId: "agent-sdk-eval",
        reputationScore: 0,
        completedTasks: 0,
        failedTasks: 0,
        registeredAt: new Date(0).toISOString(),
        ...body,
      };
      agents.set(String(agent.agentId), agent);
      return json(agent);
    }
    if (url.pathname === "/sdk/agents") {
      return json([...agents.values()]);
    }
    if (url.pathname === "/sdk/agents/agent-sdk-eval/reputation") {
      return json({
        agentId: "agent-sdk-eval",
        reputationScore: 0,
        completedTasks: 0,
        failedTasks: 0,
        successRate: 0,
        updatedAt: new Date(0).toISOString(),
      });
    }
    if (url.pathname === "/sdk/tasks/sdk-eval-task/cancel" && method === "POST") {
      return json({
        taskId: "sdk-eval-task",
        cancelled: false,
        reason: "not_supported_in_eval",
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

function taskResponse(taskId: string) {
  return {
    taskId,
    status: "completed",
    subtaskCount: 1,
    completedSubtasks: 1,
    failedSubtasks: 0,
    records: [
      {
        subtask: {
          id: "sdk-eval-subtask",
          index: 0,
          description: "Evaluate SDK.",
          estimatedBudgetLamports: "100000",
        },
        status: "completed",
        worker: {
          agentPda: "ResearcherAgentLocal",
          pricePerTaskLamports: "100000",
        },
        routerDecision: {
          tier: "simple",
          modelId: "claude-haiku-4-5",
          budgetSliceLamports: "100000",
          confidence: 0.9,
        },
        judgeResult: {
          score: 0.92,
        },
        resultHash: "hash-sdk-eval",
        resultContent: "SDK result for frontend integration.",
      },
    ],
  };
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
