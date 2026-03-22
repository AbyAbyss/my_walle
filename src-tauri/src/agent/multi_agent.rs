//! Sub-agent chain execution — sequential DAG order, emits `chain:progress` on the chat window.

use std::collections::{HashMap, VecDeque};
use std::time::Duration;

use serde::Deserialize;
use serde_json::json;
use tauri::AppHandle;
use tauri::Emitter;

use crate::agent::llm;

#[derive(Debug, Deserialize, Clone)]
pub struct ChainAgentDef {
    pub id: String,
    pub goal: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
}

fn topo_order(agents: &[ChainAgentDef]) -> Result<Vec<ChainAgentDef>, String> {
    let mut id_to = HashMap::new();
    for a in agents {
        id_to.insert(a.id.clone(), a.clone());
    }
    let mut deps_count: HashMap<String, usize> = HashMap::new();
    let mut dependents: HashMap<String, Vec<String>> = HashMap::new();
    for a in agents {
        deps_count.insert(a.id.clone(), a.depends_on.len());
        for d in &a.depends_on {
            dependents.entry(d.clone()).or_default().push(a.id.clone());
        }
    }
    let mut q: VecDeque<String> = VecDeque::new();
    for a in agents {
        if deps_count[&a.id] == 0 {
            q.push_back(a.id.clone());
        }
    }
    let mut out = Vec::new();
    while let Some(id) = q.pop_front() {
        let agent = id_to.get(&id).ok_or_else(|| format!("unknown agent id {id}"))?.clone();
        out.push(agent);
        for next in dependents.get(&id).into_iter().flatten() {
            let e = deps_count.entry(next.clone()).or_insert(0);
            *e -= 1;
            if *e == 0 {
                q.push_back(next.clone());
            }
        }
    }
    if out.len() != agents.len() {
        return Err("chain: cyclic dependency or missing agent reference".into());
    }
    Ok(out)
}

pub async fn run_chain(app: &AppHandle, params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let agents: Vec<ChainAgentDef> =
        serde_json::from_value(params.get("agents").cloned().ok_or_else(|| "agents required".to_string())?)
            .map_err(|e| e.to_string())?;
    if agents.is_empty() {
        return Err("chain: empty agents".into());
    }
    if agents.len() > 8 {
        return Err("chain: too many agents (max 8)".into());
    }
    let ordered = topo_order(&agents)?;
    let app_h = app.clone();
    let work = async move {
        let mut results: HashMap<String, String> = HashMap::new();
        for a in ordered {
            let mut ctx = String::new();
            for d in &a.depends_on {
                if let Some(t) = results.get(d) {
                    ctx.push_str(&format!("Agent {}:\n{}\n", d, t));
                }
            }
            let _ = app_h.emit_to(
                "chat",
                "chain:progress",
                json!({ "id": a.id, "status": "running", "goal": a.goal }),
            );
            let completion = llm::chain_sub_agent_completion(&app_h, &a.goal, &ctx).await?;
            results.insert(a.id.clone(), completion.raw.clone());
            let _ = app_h.emit_to(
                "chat",
                "chain:progress",
                json!({
                    "id": a.id,
                    "status": "done",
                    "output": completion.raw,
                }),
            );
        }
        let mut synth = String::from("Combine these sub-agent results into one concise answer for the user:\n");
        for (k, v) in &results {
            synth.push_str(&format!("\n## {}\n{}\n", k, v));
        }
        let final_c = llm::chain_sub_agent_completion(&app_h, &synth, "").await?;
        Ok::<serde_json::Value, String>(json!({
            "ok": true,
            "summary": final_c.raw,
            "agentResults": results,
        }))
    };

    tokio::time::timeout(Duration::from_secs(300), work)
        .await
        .map_err(|_| "chain: timed out after 5 minutes".to_string())?
}
