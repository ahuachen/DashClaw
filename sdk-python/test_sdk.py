import os
import sys
from dashclaw import DashClaw, DashClawError

def test_sdk():
    print("Testing DashClaw Python SDK...")
    
    # Use environment variables or defaults for local testing
    base_url = os.environ.get("DASHCLAW_URL", "http://localhost:3000")
    api_key = os.environ.get("DASHCLAW_API_KEY", "test-key")
    
    claw = DashClaw(
        base_url=base_url,
        api_key=api_key,
        agent_id="python-test-agent",
        agent_name="Python Test Agent"
    )

    print(f"Target URL: {base_url}")

    try:
        # 1. Test Action Tracking (Context Manager)
        print("\n1. Testing track()...")
        with claw.track(action_type="test", declared_goal="Verify Python SDK track()") as ctx:
            print(f"   Started action: {ctx['action_id']}")
            # Simulate work
            pass
        print("   ✅ track() completed")

        # 2. Test Goal Creation
        print("\n2. Testing create_goal()...")
        goal = claw.create_goal(title="Finish Python SDK", status="active", progress=90)
        print(f"   ✅ Goal created")

        # 3. Test Learning
        print("\n3. Testing record_decision()...")
        claw.record_decision(decision="Used urllib for zero-deps", reasoning="Keep SDK lightweight", outcome="success")
        print("   ✅ Decision recorded")

        # 4. Test Signals (Read)
        print("\n4. Testing get_signals()...")
        signals = claw.get_signals()
        print(f"   ✅ Fetched {len(signals.get('signals', []))} signals")

        print("\n🎉 All local tests passed (assuming server reachable)!")

    except DashClawError as e:
        print(f"\n❌ SDK Error: {e}")
        if e.status == 401:
            print("   (Note: This likely means your API key is invalid or server is not running)")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_sdk()
