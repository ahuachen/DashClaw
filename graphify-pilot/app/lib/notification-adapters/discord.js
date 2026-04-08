export const discordAdapter = {
  name: 'discord',
  requiredKeys: ['DISCORD_WEBHOOK_URL'],

  async send(signals, creds) {
    const redCount = signals.filter(s => s.severity === 'red').length;
    const amberCount = signals.filter(s => s.severity === 'amber').length;

    const fields = signals.slice(0, 10).map(s => ({
      name: `${s.severity === 'red' ? '\uD83D\uDD34' : '\uD83D\uDFE1'} ${s.label}`,
      value: s.detail.slice(0, 200) + (s.agent_id ? `\n*Agent:* ${s.agent_id}` : ''),
      inline: false,
    }));

    const embed = {
      title: `DashClaw: ${signals.length} governance signal${signals.length > 1 ? 's' : ''}`,
      description: `**${redCount} critical** · ${amberCount} amber`,
      color: redCount > 0 ? 0xff4444 : 0xffaa00,
      fields,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(creds.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (res.status === 204 || res.ok) return { success: true, message: 'Posted to Discord' };
    return { success: false, message: `Discord returned ${res.status}` };
  },
};
