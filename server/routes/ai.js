const express = require('express');
const router = express.Router();
const { authMiddleware, requireRoles, logAuditAction } = require('../auth');
const { processAiQuery } = require('../services/aiAssistant');

router.use(authMiddleware);
router.use(requireRoles('owner', 'director', 'admin'));

router.post('/ask', (req, res) => {
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
