const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const db = require('./db');

// Ensure all database writes are committed to Supabase before sending JSON response
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async function(data) {
    try {
      if (db.flushWrites) {
        await db.flushWrites();
      }
    } catch (e) {
      console.warn('[Flush writes warning]:', e.message);
    }
    return originalJson(data);
  };
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/children', require('./routes/children'));
app.use('/api/specialists', require('./routes/specialists'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/directions', require('./routes/directions'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Asar Qadam Smart CRM/ERP',
    currency: 'KZT (₸)',
    timezone: 'Asia/Almaty',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/supabase', async (req, res) => {
  const health = await db.getSupabaseHealth();
  res.json(health);
});


// Serve static frontend in production if built
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Asar Qadam Server] Running on http://localhost:${PORT}`);
  });
}

module.exports = app;

