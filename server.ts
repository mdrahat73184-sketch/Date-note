import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const distPath = path.resolve(__dirname, 'dist');
const hasDistBuild = fs.existsSync(path.join(distPath, 'index.html'));
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' && hasDistBuild);

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface GenerateLetterBody {
  senderName?: unknown;
  receiverName?: unknown;
  outingTopic?: unknown;
  day?: unknown;
  time?: unknown;
  location?: unknown;
  plan?: unknown;
  treatPayer?: unknown;
  treatChoice?: unknown;
  treatClicks?: unknown;
  noDodges?: unknown;
  lang?: unknown;
}

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function cleanCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10000, Math.floor(value)));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/generate-letter', async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      const body = (req.body || {}) as GenerateLetterBody;
      const senderName = cleanString(body.senderName, 60);
      const receiverName = cleanString(body.receiverName, 60);
      const outingTopic = cleanString(body.outingTopic, 80) || 'Date';
      const day = cleanString(body.day, 60);
      const time = cleanString(body.time, 60);
      const location = cleanString(body.location, 120);
      const plan = cleanString(body.plan, 120);
      const treatPayer = body.treatPayer === 'sender' ? 'sender' : 'receiver';
      const treatChoice = cleanString(body.treatChoice, 40);
      const treatClicks = cleanCount(body.treatClicks);
      const noDodges = cleanCount(body.noDodges);
      const lang = body.lang === 'bn' ? 'bn' : 'en';

      if (!senderName || !receiverName || !day || !time || !plan || !treatChoice) {
        res.status(400).json({
          error: 'Missing required date details to generate the letter.',
        });
        return;
      }

      const treatContext =
        treatPayer === 'sender'
          ? treatClicks > 0
            ? `${senderName} (you) insisted on treating! ${receiverName} tried to pay ${treatClicks} time(s), so tease them warmly that they can pay next time.`
            : `${senderName} (you) is happily treating ${receiverName} this time.`
          : treatClicks > 0
            ? `${receiverName} is treating (after tapping "${senderName} treats" ${treatClicks} time(s) trying to make ${senderName} pay until it vanished!).`
            : `${receiverName} generously offered to treat right away.`;

      const dodgeContext =
        noDodges > 0
          ? `${receiverName} also chased the "No" button ${noDodges} time(s) before saying yes.`
          : `${receiverName} clicked yes right away.`;

      const langInstruction =
        lang === 'bn'
          ? `Write the entire letter in natural, warm, slightly nervous everyday Bengali (বাংলা). End with the exact sign-off:\nতোমার (একটু নার্ভাস হয়ে),\n— ${senderName}`
          : `Write the letter in warm, playful English. End with the exact sign-off:\nYours (a little nervously),\n— ${senderName}`;

      const prompt = [
        `Write a short, playful, slightly nervous 4 to 5 line outing/date confirmation letter from ${senderName}'s first-person point of view ("I") addressed to ${receiverName} by name.`,
        `Details:`,
        `- Outing / Occasion: ${outingTopic}`,
        `- Day: ${day}`,
        `- Time: ${time}`,
        ...(location ? [`- Location: ${location}`] : []),
        `- Plan: ${plan}`,
        `- Treating situation: ${treatContext}`,
        `- Saying yes note: ${dodgeContext}`,
        `Rules:`,
        `- Keep it strictly 4 to 5 short lines plus the greeting and sign-off.`,
        `- Mention the occasion/plan, day, time${location ? ', location' : ''}, and who is treating in a funny, affectionate way.`,
        `- Plain text only (no markdown asterisks, no bullet points, no quotes wrapping the whole letter).`,
        `- ${langInstruction}`,
      ].join('\n');

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You write short, charming, slightly nervous romantic/playful outing letters from the sender point of view. Keep it 4-5 lines, witty, warm, and natural.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const letter = (response.text ?? '').trim();
      if (!letter) {
        res.status(502).json({
          error: 'The letter generator returned an empty response. Please try again.',
        });
        return;
      }

      res.json({ letter: letter.slice(0, 4000) });
    } catch (error) {
      console.error('Error generating letter via Gemini:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to generate keepsake letter.';
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
