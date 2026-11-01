const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');
const { processAiQuery } = require('../services/aiAssistant');
const { askGemini } = require('../services/geminiService');

// All authenticated users can use the Gemini assistant
router.use(authMiddleware);

// 1. Google Gemini Site Assistant
router.post('/chat', async (req, res) => {
  const { message, history, currentView } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  try {
    const result = await askGemini({
      message: message.trim(),
      history: history || [],
      currentView: currentView || 'dashboard',
      userRole: req.user.role,
      userName: req.user.name
    });

    logAuditAction({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'AI_GEMINI_QUERY',
      entityType: 'ai_assistant',
      details: `Запрос к Google Gemini (${result.modelUsed}): "${message.slice(0, 80)}"`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      reply: result.reply,
      model: result.modelUsed
    });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'Ошибка ассистента Gemini: ' + err.message });
  }
});

// 2. Programmatic Financial AI Accountant (owner, director, admin)
router.post('/ask', requireRoles('owner', 'director', 'admin'), (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Вопрос не может быть пустым' });
  }

  try {
    const analysis = processAiQuery(question, req.user.role);

    logAuditAction({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'AI_ACCOUNTANT_QUERY',
      entityType: 'ai_assistant',
      details: `Запрос к AI-бухгалтеру: "${question}" (Интент: ${analysis.intent})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (err) {
    console.error('AI assistant error:', err);
    res.status(500).json({ error: 'Ошибка при обработке запроса AI-бухгалтером: ' + err.message });
  }
});

module.exports = router;
