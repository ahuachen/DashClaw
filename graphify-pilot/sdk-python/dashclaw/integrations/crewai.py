from typing import Any, Dict, Optional
import time

try:
    from crewai import Agent, Task
except ImportError:
    # Dummy classes if crewai not installed
    class Agent: pass
    class Task: pass

from dashclaw import DashClaw

class DashClawCrewIntegration:
    """
    CrewAI Integration for DashClaw.
    Provides callbacks to automatically log Task execution to DashClaw.
    
    Usage:
        integration = DashClawCrewIntegration(claw)
        
        task = Task(
            description="...",
            agent=my_agent,
            callback=integration.task_callback
        )
    """

    def __init__(self, client: DashClaw):
        self.client = client
        self.active_tasks = {} # task_id -> action_id

    def task_callback(self, output: Any) -> None:
        """
        Callback for CrewAI Task completion.
        Logs the finished task as a completed action in DashClaw.
        """
        try:
            # CrewAI Task callback only provides output string/object
            # We try to infer context or just log the result
            output_str = str(output)
            
            self.client.create_action(
                action_type="task",
                declared_goal="CrewAI Task Completed",
                status="completed",
                output_summary=output_str[:1000] if len(output_str) > 1000 else output_str,
                risk_score=20
            )
        except Exception as e:
            print(f"[DashClaw] Failed to log CrewAI task: {e}")

    def instrument_agent(self, agent: Agent):
        """
        Experimental: Patch a CrewAI agent to log step-by-step progress.
        """
        # This is more complex because CrewAI doesn't have a standard 'start' callback yet
        # But we could wrap the agent's execute_task method
        original_execute = agent.execute_task
        
        def wrapped_execute(task, context=None, tools=None):
            res = self.client.create_action(
                action_type="research",
                declared_goal=f"Agent {agent.role} executing task",
                input_summary=task.description,
                agent_name=agent.role,
                risk_score=30
            )
            action_id = res.get('action_id') if res else None
            
            start_time = time.time()
            try:
                result = original_execute(task, context, tools)
                if action_id:
                    self.client.update_outcome(
                        action_id, 
                        status="completed", 
                        output_summary=str(result),
                        duration_ms=int((time.time() - start_time) * 1000)
                    )
                return result
            except Exception as e:
                if action_id:
                    self.client.update_outcome(
                        action_id, 
                        status="failed", 
                        error_message=str(e),
                        duration_ms=int((time.time() - start_time) * 1000)
                    )
                raise e
        
        agent.execute_task = wrapped_execute
        return agent
