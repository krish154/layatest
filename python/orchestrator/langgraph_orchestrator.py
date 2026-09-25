"""
LangGraph Integration for Complex Task Orchestration
=====================================================
Uses LangGraph for stateful, multi-step task execution when Qwen is invoked.

This provides:
- Stateful graph execution for complex tasks
- Tool orchestration with memory
- Recovery and retry logic
- Conditional branching based on observations

Usage:
    from langgraph_orchestrator import create_agent_graph
    graph = create_agent_graph(tools)
    result = await graph.ainvoke({"input": "complex task"})
"""

import json
from typing import Any, Dict, List, Optional, Annotated
from dataclasses import dataclass, field

try:
    from langgraph.graph import StateGraph, END
    from langgraph.graph.message import add_messages
    from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
    from langchain_core.tools import tool
    HAS_LANGGRAPH = True
except ImportError:
    HAS_LANGGRAPH = False
    print("LangGraph not installed. Install with: pip install langgraph langchain-core")


# ============================================================
# State Definition
# ============================================================

@dataclass
class AgentState:
    """State for the LangGraph agent."""
    messages: List[Dict] = field(default_factory=list)
    current_step: int = 0
    total_steps: int = 0
    tool_calls: List[Dict] = field(default_factory=list)
    observations: List[Dict] = field(default_factory=list)
    final_answer: Optional[str] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3


# ============================================================
# Tool Wrapper for LangGraph
# ============================================================

class ToolWrapper:
    """Wraps MCP tools for LangGraph compatibility."""
    
    def __init__(self, name: str, description: str, handler: callable, input_schema: Dict = None):
        self.name = name
        self.description = description
        self.handler = handler
        self.input_schema = input_schema or {}
    
    async def execute(self, **kwargs) -> Dict:
        """Execute the tool."""
        try:
            result = await self.handler(**kwargs)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}


# ============================================================
# LangGraph Agent
# ============================================================

class LangGraphAgent:
    """
    LangGraph-based agent for complex multi-step tasks.
    
    Graph structure:
    1. Plan: Qwen creates a plan
    2. Execute: Execute current step
    3. Observe: Collect results
    4. Decide: Continue, retry, or finish
    5. Loop or End
    """
    
    def __init__(self, tools: List[ToolWrapper], qwen_client=None):
        if not HAS_LANGGRAPH:
            raise RuntimeError("LangGraph not installed")
        
        self.tools = {t.name: t for t in tools}
        self.qwen_client = qwen_client
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """Build the LangGraph state machine."""
        
        # Define nodes
        async def plan_node(state: AgentState) -> AgentState:
            """Create execution plan using Qwen."""
            if not self.qwen_client:
                state.error = "Qwen client not available"
                return state
            
            # Get last user message
            user_input = ""
            for msg in reversed(state.messages):
                if msg.get("role") == "user":
                    user_input = msg.get("content", "")
                    break
            
            # Ask Qwen to plan
            plan_prompt = f"""Create a step-by-step plan for this task:

Task: {user_input}

Available tools: {list(self.tools.keys())}

Respond with JSON:
{{
    "steps": [
        {{"step": 1, "action": "description", "tool": "tool_name or null", "args": {{}}}}
    ],
    "estimated_steps": 3
}}"""
            
            plan_result = await self.qwen_client.complete_json(plan_prompt)
            steps = plan_result.get("steps", [])
            
            state.total_steps = len(steps)
            state.messages.append({
                "role": "assistant",
                "content": f"Plan created with {len(steps)} steps",
                "plan": steps
            })
            
            return state
        
        async def execute_node(state: AgentState) -> AgentState:
            """Execute current step."""
            if state.current_step >= state.total_steps:
                return state
            
            # Get current step from plan
            plan = None
            for msg in reversed(state.messages):
                if "plan" in msg:
                    plan = msg["plan"]
                    break
            
            if not plan or state.current_step >= len(plan):
                return state
            
            step = plan[state.current_step]
            tool_name = step.get("tool")
            tool_args = step.get("args", {})
            
            if tool_name and tool_name in self.tools:
                result = await self.tools[tool_name].execute(**tool_args)
                
                state.tool_calls.append({
                    "step": state.current_step,
                    "tool": tool_name,
                    "args": tool_args,
                    "result": result
                })
                
                state.observations.append({
                    "step": state.current_step,
                    "observation": result
                })
            
            state.current_step += 1
            return state
        
        async def observe_node(state: AgentState) -> AgentState:
            """Collect and analyze observations."""
            # For now, just continue
            # Could add Laya-based analysis here
            return state
        
        async def decide_node(state: AgentState) -> AgentState:
            """Decide whether to continue, retry, or finish."""
            if state.current_step >= state.total_steps:
                # All steps done - generate final answer
                if self.qwen_client:
                    # Synthesize results
                    synth_prompt = f"""Based on these observations, provide a final answer:

Task: {state.messages[0].get('content', '') if state.messages else ''}
Observations: {json.dumps(state.observations[-5:])}

Provide a clear, concise answer."""
                    
                    final_answer = await self.qwen_client.complete(synth_prompt)
                    state.final_answer = final_answer
                
                return state
            
            # Check if we need to retry
            last_obs = state.observations[-1] if state.observations else None
            if last_obs and not last_obs.get("observation", {}).get("success", True):
                if state.retry_count < state.max_retries:
                    state.retry_count += 1
                    # Retry same step
                    state.current_step -= 1
                else:
                    state.error = "Max retries exceeded"
            
            return state
        
        # Build graph
        workflow = StateGraph(AgentState)
        
        workflow.add_node("plan", plan_node)
        workflow.add_node("execute", execute_node)
        workflow.add_node("observe", observe_node)
        workflow.add_node("decide", decide_node)
        
        workflow.set_entry_point("plan")
        
        workflow.add_edge("plan", "execute")
        workflow.add_edge("execute", "observe")
        workflow.add_edge("observe", "decide")
        
        # Conditional edge: continue or end
        def should_continue(state: AgentState) -> str:
            if state.error:
                return "end"
            if state.current_step >= state.total_steps and state.final_answer:
                return "end"
            return "execute"
        
        workflow.add_conditional_edges(
            "decide",
            should_continue,
            {
                "execute": "execute",
                "end": END
            }
        )
        
        return workflow.compile()
    
    async def run(self, user_input: str) -> Dict:
        """Run the agent on a task."""
        initial_state = AgentState(
            messages=[{"role": "user", "content": user_input}]
        )
        
        final_state = await self.graph.ainvoke(initial_state)
        
        return {
            "answer": final_state.final_answer,
            "tool_calls": final_state.tool_calls,
            "observations": final_state.observations,
            "error": final_state.error,
            "steps_completed": final_state.current_step,
            "total_steps": final_state.total_steps,
        }


# ============================================================
# Fallback: Simple Orchestrator (if LangGraph not available)
# ============================================================

class SimpleOrchestrator:
    """
    Simple orchestrator for complex tasks when LangGraph is not available.
    Implements the same observe-decide-act-verify loop.
    """
    
    def __init__(self, tools: Dict[str, callable], qwen_client=None):
        self.tools = tools
        self.qwen_client = qwen_client
    
    async def run(self, user_input: str) -> Dict:
        """Run complex task with simple orchestration."""
        observations = []
        tool_calls = []
        
        # Step 1: Plan (if Qwen available)
        if self.qwen_client:
            plan_prompt = f"""Create a step-by-step plan:

Task: {user_input}
Tools: {list(self.tools.keys())}

Respond with JSON:
{{"steps": [{{"step": 1, "tool": "name", "args": {{}}}}]}}"""
            
            plan_result = await self.qwen_client.complete_json(plan_prompt)
            steps = plan_result.get("steps", [])
        else:
            steps = []
        
        # Step 2: Execute each step
        for step in steps:
            tool_name = step.get("tool")
            tool_args = step.get("args", {})
            
            if tool_name and tool_name in self.tools:
                try:
                    handler = self.tools[tool_name]
                    result = await handler(**tool_args) if asyncio.iscoroutinefunction(handler) else handler(**tool_args)
                    
                    tool_calls.append({"tool": tool_name, "args": tool_args, "result": result})
                    observations.append({"step": step.get("step"), "observation": result})
                except Exception as e:
                    observations.append({"step": step.get("step"), "error": str(e)})
        
        # Step 3: Synthesize final answer
        final_answer = None
        if self.qwen_client and observations:
            synth_prompt = f"""Based on these observations, provide a final answer:

Task: {user_input}
Observations: {json.dumps(observations[-5:])}

Provide a clear answer."""
            
            final_answer = await self.qwen_client.complete(synth_prompt)
        
        return {
            "answer": final_answer or "Task completed",
            "tool_calls": tool_calls,
            "observations": observations,
            "steps_completed": len(steps),
        }


import asyncio
