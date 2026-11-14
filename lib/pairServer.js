const express = require('express');
const path = require('path');

function startPairServer(config, state) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/status', (_q, res) => {
    const { connected, registered, socketReady, user, lastQrDataUrl, pairingCode, message, lastError } = state;
    res.json({ botName: config.botName, connected: !!connected, registered: !!registered, socketReady: !!socketReady, user: user || null, lastQrDataUrl: lastQrDataUrl || null, pairingCode: pairingCode || null, pairNumber: config.pairNumber, message: message || '', lastError: lastError || null });
  });

  app.post('/api/request-code', async (req, res) => {
    try {
      if (typeof state.requestPairingCode !== 'function') return res.status(503).json({ ok: false, error: 'Bot is starting, wait a few seconds' });
      const code = await state.requestPairingCode(String((req.body && req.body.number) || config.pairNumber || ''));
      res.json({ ok: true, code, hint: 'WhatsApp, Linked devices, Link with phone number. Enter the code within a minute.' });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.post('/api/clear-session', async (_q, res) => {
    try {
      await state.clearSessionAndRestart();
      res.json({ ok: true, message: 'Session cleared. Wait for Ready, then Get code.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  const port = Number(process.env.PORT) || Number(config.port) || 3000;
  const server = app.listen(port, '0.0.0.0', () => console.log('[pair] listening on http://0.0.0.0:' + port));
  server.on('error', (e) => console.error('[pair] server error:', e.code || e.message));
  return server;
}

module.exports = { startPairServer };
