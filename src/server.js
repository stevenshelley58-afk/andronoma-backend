import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(express.json());

let personas = [];

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  if ((email === 'demo@example.com' && password === 'demo123') || 
      (email === 'admin@andronoma.ai' && password === 'admin123')) {
    res.json({
      success: true,
      data: {
        token: 'demo-token-' + Date.now(),
        user: { email, name: email.split('@')[0], role: 'CUSTOMER' }
      }
    });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.get('/api/v1/audiences', (req, res) => {
  res.json({ success: true, data: { personas: personas.slice(0, 50) } });
});

app.post('/api/v1/audiences/generate', async (req, res) => {
  try {
    const { businessDescription, productService, targetGoals, numPersonas = 3 } = req.body;

    if (!businessDescription || !productService) {
      return res.status(400).json({
        success: false,
        error: 'Business description and product/service are required'
      });
    }

    console.log(\🎯 Generating \ personas...\);
    
    const prompt = \You are an expert Meta Ads audience strategist. Generate \ distinct audience personas for:

Business: \
Product/Service: \
Goals: \

Respond ONLY with valid JSON array. No markdown, no explanations:
[
  {
    "name": "string",
    "description": "string",
    "ageRange": "25-34",
    "gender": "All",
    "location": "Urban areas",
    "income": "\,000-\,000",
    "education": "Bachelor's",
    "interests": ["array", "of", "strings"],
    "behaviors": ["array", "of", "strings"],
    "painPoints": ["array", "of", "strings"],
    "motivations": ["array", "of", "strings"],
    "estimatedReach": 2500000
  }
]\;

    const startTime = Date.now();
    let generatedPersonas;
    let provider = 'OPENAI';
    let cost = 0;
    let tokensUsed = 0;

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \Bearer \\,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Respond ONLY with valid JSON. No markdown.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(\OpenAI Error: \\);
      }

      const data = await response.json();
      let text = data.choices[0].message.content.trim();
      text = text.replace(/\\\json\\n?/g, '').replace(/\\\\\n?/g, '').trim();
      
      generatedPersonas = JSON.parse(text);
      tokensUsed = data.usage.total_tokens;
      cost = (tokensUsed / 1000000) * 0.15;
      
    } else if (process.env.GOOGLE_API_KEY) {
      provider = 'GOOGLE';
      const response = await fetch(
        \https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=\\,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(\Google Error: \\);
      }

      const data = await response.json();
      let text = data.candidates[0].content.parts[0].text.trim();
      text = text.replace(/\\\json\\n?/g, '').replace(/\\\\\n?/g, '').trim();
      
      generatedPersonas = JSON.parse(text);
      tokensUsed = data.usageMetadata?.totalTokenCount || 1000;
      cost = (tokensUsed / 1000000) * 0.075;
      
    } else {
      throw new Error('No AI API key configured');
    }

    const duration = Date.now() - startTime;

    const newPersonas = generatedPersonas.map((p, idx) => ({
      ...p,
      id: \\-\\,
      createdAt: new Date().toISOString(),
    }));

    personas = [...newPersonas, ...personas].slice(0, 100);

    console.log(\✅ Generated \ personas (\$\)\);

    res.json({
      success: true,
      data: {
        personas: newPersonas,
        jobId: \job-\\,
        metadata: {
          provider,
          costUSD: parseFloat(cost.toFixed(4)),
          tokensUsed,
          modelName: provider === 'OPENAI' ? 'gpt-4o-mini' : 'gemini-2.0-flash-exp',
          durationMs: duration,
        }
      }
    });

  } catch (error) {
    console.error('❌ Generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/v1/audiences/:id', (req, res) => {
  personas = personas.filter(p => p.id !== req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\🚀 Server running on port \\);
  console.log(\🔑 OpenAI: \\);
  console.log(\🔑 Google: \\);
});
