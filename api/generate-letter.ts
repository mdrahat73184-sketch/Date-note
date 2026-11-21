import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

interface GenerateLetterBody {
  senderName?: unknown;
  receiverName?: unknown;
  outingTopic?: unknown;
  day?: unknown;
  time?: unknown;
  plan?: unknown;
  treatPayer?: unknown;
  treatChoice?: unknown;
  treatClicks?: unknown;
  noDodges?: unknown;
  lang?: unknown;
}

interface ServerlessRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: ServerlessRequest): Promise<GenerateLetterBody> {
  if (req.body && typeof req.body === 'object') {
    return req.body as GenerateLetterBody;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as GenerateLetterBody;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as GenerateLetterBody;
  } catch {
    return {};
  }
}

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function cleanCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10000, Math.floor(value)));
}

export default async function handler(req: ServerlessRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      sendJson(res, 500, {
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const body = await readJsonBody(req);
    const senderName = cleanString(body.senderName, 60);
    const receiverName = cleanString(body.receiverName, 60);
    const outingTopic = cleanString(body.outingTopic, 80) || 'Date';
    const day = cleanString(body.day, 60);
    const time = cleanString(body.time, 60);
    const plan = cleanString(body.plan, 120);
    const treatPayer = body.treatPayer === 'sender' ? 'sender' : 'receiver';
    const treatChoice = cleanString(body.treatChoice, 40);
    const treatClicks = cleanCount(body.treatClicks);
    const noDodges = cleanCount(body.noDodges);
    const lang = body.lang === 'bn' ? 'bn' : 'en';

    if (!senderName || !receiverName || !day || !time || !plan || !treatChoice) {
      sendJson(res, 400, {
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
      `- Plan: ${plan}`,
      `- Treating situation: ${treatContext}`,
      `- Saying yes note: ${dodgeContext}`,
      `Rules:`,
      `- Keep it strictly 4 to 5 short lines plus the greeting and sign-off.`,
      `- Mention the occasion/plan, day, time, and who is treating in a funny, affectionate way.`,
      `- Plain text only (no markdown asterisks, no bullet points, no quotes wrapping the whole letter).`,
      `- ${langInstruction}`,
    ].join('\n');

    const ai = new GoogleGenAI({ apiKey });
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
      sendJson(res, 502, {
        error: 'The letter generator returned an empty response. Please try again.',
      });
      return;
    }

    sendJson(res, 200, { letter: letter.slice(0, 4000) });
  } catch (error) {
    console.error('Error generating letter via Gemini:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate keepsake letter.';
    sendJson(res, 500, { error: message });
  }
}
