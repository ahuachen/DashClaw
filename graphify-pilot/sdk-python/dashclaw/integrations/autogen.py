from typing import Any, Dict, List, Optional, Union
import time

from dashclaw import DashClaw

class DashClawAutoGenIntegration:
    """
    AutoGen Integration for DashClaw.
    Automatically logs agent conversations and tool usage to DashClaw.
    
    Usage:
        integration = DashClawAutoGenIntegration(claw)
        integration.instrument_agent(agent)
    """

    def __init__(self, client: DashClaw):
        self.client = client
        self.active_conversations = {} # session_id -> action_id

    def instrument_agent(self, agent: Any):
        """
        Registers hooks on an AutoGen agent to log activity.
        Works with ConversableAgent and its subclasses.
        """
        # Hook into message reception (start of a turn)
        agent.register_hook(
            hookable_method="process_last_received_message",
            hook=self._process_message_hook
        )
        
        # We could also hook into tool calls if AutoGen exposes them clearly via hooks
        return agent

    def _process_message_hook(self, message: Union[Dict, str]) -> Union[Dict, str]:
        """
        Hook called when an agent receives a message.
        Logs the turn as an action in DashClaw.
        """
        try:
            content = message["content"] if isinstance(message, dict) else message
            sender = message.get("name", "unknown") if isinstance(message, dict) else "unknown"
            
            # Create a 'message' action in DashClaw
            self.client.create_action(
                action_type="message",
                declared_goal=f"Process message from {sender}",
                input_summary=content[:500] if content else "Empty message",
                risk_score=10
            )
        except Exception as e:
            print(f"[DashClaw] Failed to log AutoGen message: {e}")
            
        return message # Return unmodified to continue pipeline
