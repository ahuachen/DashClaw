"""Tests for the settings, events, and adapters collectors.

These three collectors extend ShapeModel with the per-org config surface
(VALID_SETTING_KEYS), the realtime event vocabulary (EVENTS), and the
notification adapter registry. The skill emitter renders each as a new
section so the platform-intelligence skill can answer questions like
"how do I enable cost alerts?" or "which events can I subscribe to?"
without an LLM having to grep the repo.
"""
import os
import tempfile
import unittest


class TestSettingsCollector(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        target = os.path.join(self.tmpdir, "app", "lib", "repositories")
        os.makedirs(target, exist_ok=True)
        self.path = os.path.join(target, "settings.repository.js")

    def _write(self, body):
        with open(self.path, "w", encoding="utf-8") as f:
            f.write(body)

    def test_parses_keys_with_section_comments(self):
        self._write("""
// leading comment unrelated
export const VALID_SETTING_KEYS = [
  // AI Providers
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  // Databases
  'DATABASE_URL',
  // Native governance alert settings
  'DASHCLAW_ALERTS_SLACK',
  'DASHCLAW_ACTION_COST_THRESHOLD',
];
""")
        from livingcode.collectors.settings import collect_setting_keys
        keys = collect_setting_keys(self.tmpdir)
        names = [k.name for k in keys]
        self.assertEqual(names, [
            'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DATABASE_URL',
            'DASHCLAW_ALERTS_SLACK', 'DASHCLAW_ACTION_COST_THRESHOLD',
        ])
        sections = {k.name: k.section for k in keys}
        self.assertEqual(sections['OPENAI_API_KEY'], 'AI Providers')
        self.assertEqual(sections['DATABASE_URL'], 'Databases')
        # No section comment separates DASHCLAW_ACTION_COST_THRESHOLD from
        # the prior one, so it inherits "Native governance alert settings".
        self.assertEqual(sections['DASHCLAW_ACTION_COST_THRESHOLD'],
                         'Native governance alert settings')

    def test_deduplicates_repeated_keys(self):
        # Defensive: if someone accidentally lists the same key twice, we
        # report it once rather than inflating the skill.
        self._write("""
export const VALID_SETTING_KEYS = [
  // AI
  'KEY_A', 'KEY_A',
];
""")
        from livingcode.collectors.settings import collect_setting_keys
        keys = collect_setting_keys(self.tmpdir)
        self.assertEqual([k.name for k in keys], ['KEY_A'])

    def test_missing_file_returns_empty(self):
        from livingcode.collectors.settings import collect_setting_keys
        self.assertEqual(collect_setting_keys(self.tmpdir), [])


class TestEventsCollector(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        target = os.path.join(self.tmpdir, "app", "lib")
        os.makedirs(target, exist_ok=True)
        self.path = os.path.join(target, "events.js")

    def test_parses_events_block(self):
        with open(self.path, "w", encoding="utf-8") as f:
            f.write("""
import { EventEmitter } from 'events';

export const EVENTS = {
  ACTION_CREATED: 'action.created',
  ACTION_UPDATED: 'action.updated',
  ACTION_COST_EXCEEDED: 'action.cost_exceeded',
  SIGNAL_DETECTED: 'signal.detected',
};

// unrelated code below — must not be matched
const other = 'ignored';
""")
        from livingcode.collectors.events import collect_events
        events = collect_events(self.tmpdir)
        constants = [e.constant for e in events]
        self.assertEqual(constants, [
            'ACTION_CREATED', 'ACTION_UPDATED',
            'ACTION_COST_EXCEEDED', 'SIGNAL_DETECTED',
        ])
        event_strings = [e.event for e in events]
        self.assertIn('action.cost_exceeded', event_strings)

    def test_missing_file_returns_empty(self):
        from livingcode.collectors.events import collect_events
        self.assertEqual(collect_events(self.tmpdir), [])


class TestAdaptersCollector(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.dir = os.path.join(self.tmpdir, "app", "lib", "notification-adapters")
        os.makedirs(self.dir, exist_ok=True)
        # index.js is the registry; the collector must skip it.
        with open(os.path.join(self.dir, "index.js"), "w") as f:
            f.write("export const ADAPTERS = [];\n")

    def _write(self, fname, body):
        with open(os.path.join(self.dir, fname), "w", encoding="utf-8") as f:
            f.write(body)

    def test_parses_adapter_files(self):
        self._write("slack.js", """
export const slackAdapter = {
  name: 'slack',
  requiredKeys: ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'],
  async send() {}
};
""")
        self._write("discord.js", """
export const discordAdapter = {
  name: 'discord',
  requiredKeys: ['DISCORD_WEBHOOK_URL'],
};
""")
        from livingcode.collectors.adapters import collect_adapters
        adapters = collect_adapters(self.tmpdir)
        names = [a.name for a in adapters]
        self.assertEqual(sorted(names), ['discord', 'slack'])

        by_name = {a.name: a for a in adapters}
        self.assertEqual(by_name['slack'].required_keys,
                         ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'])
        self.assertEqual(by_name['discord'].required_keys,
                         ['DISCORD_WEBHOOK_URL'])

    def test_missing_dir_returns_empty(self):
        from livingcode.collectors.adapters import collect_adapters
        self.assertEqual(collect_adapters("/does/not/exist"), [])


class TestSignalsCollector(unittest.TestCase):
    """The signals collector scans files that CALL the delivery pipeline
    (fireWebhooksForOrg / deliverNativeNotifications) and harvests
    `type: '<name>'` literals. Files that don't import either function must
    be ignored — otherwise status enums, tool_type strings, etc. would
    leak in as false positives."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.lib = os.path.join(self.tmpdir, "app", "lib")
        os.makedirs(self.lib, exist_ok=True)

    def _write(self, rel_path, body):
        full = os.path.join(self.tmpdir, rel_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(body)

    def test_collects_types_from_delivery_call_sites(self):
        self._write("app/lib/cost-alerts.js", """
import { fireWebhooksForOrg } from './webhooks.js';
export function buildSignal() {
  return { type: 'cost_exceeded', severity: 'red' };
}
export async function fire(sql, org) {
  await fireWebhooksForOrg(org, [{ type: 'cost_exceeded' }], sql);
}
""")
        self._write("app/lib/signals.js", """
import { deliverNativeNotifications } from './notification-adapters/index.js';
export function agentMismatch() {
  return { type: 'integration_mismatch', severity: 'amber' };
}
export async function flushSignals(sql, org, signals, settings) {
  await deliverNativeNotifications(org, signals, settings, sql);
}
""")
        from livingcode.collectors.signals import collect_signal_types
        types = collect_signal_types(self.tmpdir)
        self.assertEqual(types, ['cost_exceeded', 'integration_mismatch'])

    def test_ignores_files_that_dont_call_delivery(self):
        # Looks like a signal but nothing in this file calls the pipeline,
        # so the collector must leave its `type:` alone.
        self._write("app/lib/unrelated.js", """
export const TOOL_TYPES = [
  { type: 'bash' },
  { type: 'edit' },
];
""")
        from livingcode.collectors.signals import collect_signal_types
        self.assertEqual(collect_signal_types(self.tmpdir), [])

    def test_catches_signal_builders_that_dont_deliver(self):
        """signals.js returns signal objects for a caller to deliver later —
        the collector must catch those via the signal-shape heuristic
        (type + red/amber severity in close proximity)."""
        self._write("app/lib/signals.js", """
export function collectSignals() {
  return [
    { type: 'integration_mismatch', severity: 'red', label: 'Bad cred' },
    { type: 'stale_running_action', severity: 'amber', label: 'Stuck' },
  ];
}
""")
        from livingcode.collectors.signals import collect_signal_types
        types = collect_signal_types(self.tmpdir)
        self.assertEqual(types, ['integration_mismatch', 'stale_running_action'])

    def test_rejects_unrelated_types_in_signal_builder_files(self):
        """A file like demoFixtures.js can contain REAL signal fixtures
        (type+severity) alongside unrelated `type:` fields (memory entities,
        tool types). Only the signal-shaped ones should survive — if we
        qualify once and then scrape every `type:` in the file, demo entity
        `type:` values leak into the skill."""
        self._write("app/lib/demo/demoFixtures.js", """
// Unrelated memory entity — has `type:` but no severity nearby.
export const MEMORY = {
  entities: [
    { name: 'Concept A', type: 'concept', mentions: 32 },
    { name: 'Concept B', type: 'concept', mentions: 28 },
  ],
};
// Lots of padding so the proximity window doesn't reach up to the memory block.
// .........................................................................
// .........................................................................
// .........................................................................
// .........................................................................
// Actual signal fixture lives way down here.
export const SIGNAL_FIXTURES = [
  { severity: 'red', type: 'autonomy_spike', agent_id: 'x' },
];
""")
        from livingcode.collectors.signals import collect_signal_types
        types = collect_signal_types(self.tmpdir)
        # The real signal survives; the unrelated `concept` entities don't.
        self.assertIn('autonomy_spike', types)
        self.assertNotIn('concept', types)

    def test_dedupes_across_files(self):
        self._write("app/lib/a.js", """
import { fireWebhooksForOrg } from './webhooks.js';
const s = { type: 'shared_type', severity: 'red' };
fireWebhooksForOrg('org', [s], {});
""")
        self._write("app/lib/b.js", """
import { deliverNativeNotifications } from './notification-adapters/index.js';
const s = { type: 'shared_type', severity: 'amber' };
deliverNativeNotifications('org', [s], [], {});
""")
        from livingcode.collectors.signals import collect_signal_types
        self.assertEqual(collect_signal_types(self.tmpdir), ['shared_type'])


class TestSkillEmitterNewSections(unittest.TestCase):
    """Verify the emitter renders the new sections when the shape carries them."""

    def test_renders_all_three_new_sections(self):
        from livingcode.types import (
            ShapeModel, SettingKeyInfo, EventInfo, AdapterInfo,
        )
        from livingcode.emitters.skill import emit_skill

        shape = ShapeModel(
            timestamp="sha1:test",
            routes=[],
            env_vars=[],
            tables=[],
            setting_keys=[
                SettingKeyInfo(name='OPENAI_API_KEY', section='AI Providers'),
                SettingKeyInfo(name='DASHCLAW_ACTION_COST_THRESHOLD',
                               section='Cost alerts'),
            ],
            events=[
                EventInfo(constant='ACTION_COST_EXCEEDED',
                          event='action.cost_exceeded'),
            ],
            adapters=[
                AdapterInfo(name='slack', required_keys=['SLACK_WEBHOOK_URL']),
            ],
            signal_types=['cost_exceeded', 'integration_health_changed'],
        )
        out = emit_skill(shape)

        self.assertIn('## Signal Types', out)
        self.assertIn('`cost_exceeded`', out)
        self.assertIn('`integration_health_changed`', out)

        self.assertIn('## Configuration Knobs', out)
        self.assertIn('### AI Providers', out)
        self.assertIn('### Cost alerts', out)
        self.assertIn('`DASHCLAW_ACTION_COST_THRESHOLD`', out)

        self.assertIn('## Realtime & Webhook Events', out)
        self.assertIn('`ACTION_COST_EXCEEDED`', out)
        self.assertIn('`action.cost_exceeded`', out)

        self.assertIn('## Native Notification Adapters', out)
        self.assertIn('`slack`', out)
        self.assertIn('`SLACK_WEBHOOK_URL`', out)

    def test_omits_sections_when_shape_has_no_data(self):
        from livingcode.types import ShapeModel
        from livingcode.emitters.skill import emit_skill
        # Empty setting_keys/events/adapters (defaults) → sections don't render.
        shape = ShapeModel(
            timestamp="sha1:test", routes=[], env_vars=[], tables=[],
        )
        out = emit_skill(shape)
        self.assertNotIn('## Configuration Knobs', out)
        self.assertNotIn('## Realtime & Webhook Events', out)
        self.assertNotIn('## Native Notification Adapters', out)


if __name__ == '__main__':
    unittest.main()
