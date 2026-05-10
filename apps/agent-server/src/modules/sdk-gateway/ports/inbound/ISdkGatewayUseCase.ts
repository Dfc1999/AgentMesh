import type {
  AgentInfo,
  AgentReputation,
  CancelTaskResult,
  QueryAgentsFilter,
  RegisterAgentInput,
} from "../../domain/types";

export interface ISdkGatewayUseCase {
  registerAgent(input: RegisterAgentInput): AgentInfo;
  queryAgents(filter: QueryAgentsFilter): AgentInfo[];
  getAgentReputation(agentId: string): AgentReputation;
  cancelTask(taskId: string): CancelTaskResult;
}
