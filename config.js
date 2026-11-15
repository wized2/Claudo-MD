module.exports = {
  botName: 'Claudo-MD',
  tagline: 'Everything, beautifully',
  ownerNumber: process.env.OWNER || '923073477752',
  pairNumber: process.env.PAIR_NUMBER || process.env.OWNER || '923073477752',
  prefix: '.',
  port: Number(process.env.PORT) || 3000,
  host: '0.0.0.0',
  sessionDir: process.env.SESSION_DIR || './session',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  richBotJid: process.env.RICH_BOT_JID || '867051314767696@bot',
  adminPassword: process.env.ADMIN_PASSWORD || '',
};
