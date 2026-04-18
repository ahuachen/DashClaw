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
        )
        out = emit_skill(shape)

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
