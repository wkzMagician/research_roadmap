# Agent Systems roadmap paper refresh — 2026-09-04

## Method

- Audited `data/roadmaps/agent-systems-research-landscape-v1.json` for repeated URLs, repeated titles, missing URLs, empty nodes, and unreachable links.
- Searched recent work with Exa because the local `parallel-cli`, `PARALLEL_API_KEY`, `OPENROUTER_API_KEY`, and `EXA_API_KEY` were unavailable. Queries covered agent sandboxes, multi-agent shared environments, context/KV tiering, online trajectory monitoring, budget prediction, and regression-gated harness evolution.
- Verified selected arXiv identifiers against the arXiv export API. Existing URLs were checked with HTTP requests; all responded except the AAAI MemoryBank page, which failed at the transport layer but was not observed returning a 404.
- Preferred canonical arXiv, ACL Anthology, conference proceedings, USENIX, or publisher URLs over aggregator pages.

## Searches

1. `2024 2025 2026 LLM agent adaptive sandbox capability hot-plug speculative prewarming multi-agent environment sharing research paper`
2. `2024 2025 2026 research papers LLM agents progress prediction remaining cost stuck loop detection runtime controller online trajectory monitoring`
3. `research paper LLM agent early success prediction trajectory prefix progress success probability Agent Foresight 2024 2025 2026`
4. `2024 2025 2026 research papers LLM agents multi-timescale context management context placement tiering memory hierarchy KV cache agent serving`
5. `2025 2026 research paper LLM agent sandbox capability hot plug dynamic environment construction multi agent shared sandbox dependency store rollout infrastructure`
6. `2024 2025 2026 research paper self-evolving LLM agents regression testing safety gate agent harness evolution benchmark`
7. `2025 2026 multi-agent shared sandbox environment research paper agent execution environment sharing`

## Selected additions

| Node | Paper | Why it belongs |
|---|---|---|
| A3 | [Crab: A Semantics-Aware Checkpoint/Restore Runtime for Agent Sandboxes](https://arxiv.org/abs/2604.28138) | Agent-turn-aware checkpointing and restoration directly updates the snapshot/restore branch. |
| A9 | [CAR: Empowering Agents with Dynamic Tool Synthesis and Global Trajectory Rectification](https://aclanthology.org/2026.findings-acl.869/) | Dynamically expands the tool/action space and loads generated tools at runtime. |
| A12 | [Multi-agent Collaboration with State Management (STORM)](https://arxiv.org/abs/2605.20563) | Coordinates concurrent agents over shared workspace state with write-time conflict handling. |
| A13 | [ProRL Agent: Rollout-as-a-Service for RL Training of Multi-Turn LLM Agents](https://arxiv.org/abs/2603.18815) | Provides decoupled, scalable, sandboxed rollout infrastructure for agentic RL. |
| A14 | [SpecBox: Speculative Sandbox Scheduling for Efficient LLM Agent Serving](https://arxiv.org/abs/2607.23933) | Directly studies intent-aware sandbox prewarming and cross-step stochastic prefetching. |
| C8 | [HyMem: Hierarchical Context Management for Long-Horizon Agents via Information Isolation](https://arxiv.org/abs/2608.15703) | Separates planning, execution, and analysis context at different functional timescales. |
| C9 | [TTKV: Temporal-Tiered KV Cache for Long-Context LLM Inference](https://arxiv.org/abs/2604.19769) | Places KV state across temporal and hardware tiers with different precision and latency. |
| D8 | [Pancake: A Hierarchical Memory System for Multi-Agent LLM Serving](https://arxiv.org/abs/2602.21477) | Studies hierarchical, cross-agent memory indexing and GPU/CPU placement. |
| E7/E8 | [AgentForesight: Online Auditing for Early Failure Prediction in Multi-Agent Systems](https://arxiv.org/abs/2605.08715) | Produces prefix-only online failure alarms and localizes decisive errors. |
| E8 | [PrefixGuard: From LLM-Agent Traces to Online Failure-Warning Monitors](https://arxiv.org/abs/2605.06455) | Explicitly shows that ranking trajectory risk is not the same as obtaining actionable low-false-alarm warnings. |
| E9 | [BAGEN: Are LLM Agents Budget-Aware?](https://arxiv.org/abs/2606.00198) | Predicts remaining budget intervals, feasibility, and early stopping from trajectory prefixes. |
| E10 | [TrajAD: Trajectory Anomaly Detection for Trustworthy LLM Agents](https://arxiv.org/abs/2602.06443) | Detects and localizes loops, redundant actions, and other process anomalies. |
| E12 | [Online Monitoring and Corrective Steering of Programming Agents (LivePlan)](https://arxiv.org/abs/2608.06701) | Closes the monitoring loop with selective runtime interventions and corrective steering. |
| F10 | [Self-Harness: Harnesses That Improve Themselves](https://arxiv.org/abs/2606.09498) | Accepts harness changes only after held-in and held-out regression testing. |
| F10 | [HarnessEvolve: Learning from Reference Trajectories for Reliable Agent Self-Evolution](https://arxiv.org/abs/2609.00829) | Uses quality and performance gates to prevent shortcut learning and catastrophic forgetting. |

## Foundation links restored

- [ReAct](https://arxiv.org/abs/2210.03629)
- [Voyager](https://arxiv.org/abs/2305.16291)
- [Toolformer](https://arxiv.org/abs/2302.04761)
- [τ-bench](https://arxiv.org/abs/2406.12045)
- [Reflexion](https://arxiv.org/abs/2303.11366)
- [Self-Refine](https://arxiv.org/abs/2303.17651)
- [Tree of Thoughts](https://arxiv.org/abs/2305.10601)
- [AgentBench](https://arxiv.org/abs/2308.03688)
- [SWE-bench](https://arxiv.org/abs/2310.06770)
- [OSWorld](https://arxiv.org/abs/2404.07972)

## Additional surfaced work not selected

These were relevant but overlapped more directly with papers already selected or represented adjacent topics:

- [LLM-in-Sandbox](https://arxiv.org/abs/2601.16206)
- [A Policy-Driven Runtime Layer for Agentic LLM Serving](https://arxiv.org/abs/2605.27744)
- [The Cognitive Companion](https://arxiv.org/abs/2604.13759)
- [TRACES](https://arxiv.org/abs/2605.27690)
- [PreAct-Bench](https://arxiv.org/abs/2606.09890)
- [Adaptive KV Retention for LLM Agents at Human-Approval Timescales](https://arxiv.org/abs/2608.30830)
- [Learning Agent Execution for KV-Cache Management in Agentic Serving](https://arxiv.org/abs/2608.14624)
- [Strata: Hierarchical Context Caching for Long Context Language Model Serving](https://www.usenix.org/system/files/osdi26-xie-zhiqiang.pdf)
- [Orchard: An Open-Source Agentic Modeling Framework](https://arxiv.org/abs/2605.15040)
- [Shepherd](https://arxiv.org/abs/2605.10913)
- [Learning to Share](https://arxiv.org/abs/2602.05965)
- [OpenTinker](https://arxiv.org/abs/2601.07376)
- [Safety Harness Evolution](https://arxiv.org/abs/2608.09885)
- [Evo-Bench](https://arxiv.org/abs/2608.09096)
- [Test-Time Harness Evolution](https://arxiv.org/abs/2607.08124)
- [HarnessDev](https://arxiv.org/abs/2609.01437)
- [SafeEvolve](https://arxiv.org/abs/2609.02786)

## Data decision

The previous file contained 83 paper records but only 44 distinct non-empty URLs. Twenty-two URL groups were repeated across nodes, and the same paper could have multiple IDs and independent reading states. The refreshed format keeps one canonical paper record in top-level `papers`; each node stores only paper IDs. This preserves cross-topic references while making title, URL, and reading status global and consistent.
