pub mod cpi {
    use crate::{AgentRegistration, CpiRequest, ReputationQuery, TaskPost};

    pub fn register_agent(agent: AgentRegistration) -> CpiRequest {
        CpiRequest {
            program: "agent_registry",
            instruction: "register_agent",
            accounts: vec![agent.owner_pubkey, agent.agent_pubkey],
            data: agent.capabilities,
        }
    }

    pub fn post_task(task: TaskPost) -> CpiRequest {
        CpiRequest {
            program: "task_escrow",
            instruction: "post_task",
            accounts: vec![task.creator_pubkey, task.task_pda],
            data: task.budget_lamports.to_le_bytes().to_vec(),
        }
    }

    pub fn query_reputation(query: ReputationQuery) -> CpiRequest {
        CpiRequest {
            program: "reputation_ledger",
            instruction: "query_reputation",
            accounts: vec![query.agent_pubkey],
            data: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentRegistration {
    pub owner_pubkey: String,
    pub agent_pubkey: String,
    pub capabilities: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskPost {
    pub creator_pubkey: String,
    pub task_pda: String,
    pub budget_lamports: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReputationQuery {
    pub agent_pubkey: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CpiRequest {
    pub program: &'static str,
    pub instruction: &'static str,
    pub accounts: Vec<String>,
    pub data: Vec<u8>,
}

#[cfg(test)]
mod tests {
    use super::{cpi, AgentRegistration, ReputationQuery, TaskPost};

    #[test]
    fn builds_register_agent_request() {
        let request = cpi::register_agent(AgentRegistration {
            owner_pubkey: "owner".to_string(),
            agent_pubkey: "agent".to_string(),
            capabilities: vec![1, 2, 3],
        });

        assert_eq!(request.program, "agent_registry");
        assert_eq!(request.instruction, "register_agent");
        assert_eq!(request.accounts, vec!["owner".to_string(), "agent".to_string()]);
        assert_eq!(request.data, vec![1, 2, 3]);
    }

    #[test]
    fn builds_task_post_request() {
        let request = cpi::post_task(TaskPost {
            creator_pubkey: "creator".to_string(),
            task_pda: "task".to_string(),
            budget_lamports: 42,
        });

        assert_eq!(request.program, "task_escrow");
        assert_eq!(request.instruction, "post_task");
        assert_eq!(request.data, 42_u64.to_le_bytes().to_vec());
    }

    #[test]
    fn builds_reputation_query_request() {
        let request = cpi::query_reputation(ReputationQuery {
            agent_pubkey: "agent".to_string(),
        });

        assert_eq!(request.program, "reputation_ledger");
        assert_eq!(request.accounts, vec!["agent".to_string()]);
    }
}
