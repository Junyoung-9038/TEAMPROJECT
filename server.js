import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, allowedTypes.has(file.mimetype))
});

const prescriptionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['medicines'],
  properties: {
    medicines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount_per_dose', 'frequency_per_day', 'times', 'meal_timing', 'duration'],
        properties: {
          name: { type: 'string' },
          amount_per_dose: { type: 'string' },
          frequency_per_day: { type: 'string' },
          times: { type: 'array', items: { type: 'string' } },
          meal_timing: { type: 'string' },
          duration: { type: 'string' }
        }
      }
    }
  }
};

const extractionPrompt = `You are performing OCR and data structuring only, not medical advice. Read only medication directions visibly written in the supplied Korean prescription or medicine-bag images. Do not infer, calculate, normalize, or invent information. For every unreadable, ambiguous, or absent scalar field, return exactly "확인 필요". For times, return an empty array unless an explicit clock time is visible. Never convert meal-based directions into guessed times. Include only medicines supported by the images. Return Korean text that conforms to the supplied JSON schema.`;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function generateWithRetry(ai, request) {
  const delays = [0, 1000, 2500];
  let lastError;
  for (const delay of delays) {
    if (delay) await wait(delay);
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || error?.statusCode);
      if (![429, 500, 503].includes(status)) throw error;
    }
  }
  throw lastError;
}

app.use(express.static('.'));

app.post('/api/analyze-prescription', upload.array('photos', 5), async (request, response) => {
  if (!process.env.GEMINI_API_KEY) {
    return response.status(503).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해 주세요.' });
  }
  if (!request.files?.length) return response.status(400).json({ error: '분석할 이미지가 없습니다.' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await generateWithRetry(ai, {
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: extractionPrompt },
          ...request.files.map(file => ({
            inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype }
          }))
        ]
      }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: prescriptionSchema
      }
    });
    const data = JSON.parse(result.text);
    response.json(data);
  } catch (error) {
    console.error('Gemini prescription analysis failed:', error);
    const providerMessage = typeof error?.message === 'string'
      ? error.message.replace(/AIza[\w-]+|AQ\.[\w-]+/g, '[API 키 숨김]')
      : '알 수 없는 Gemini API 오류';
    const providerStatus = Number(error?.status || error?.statusCode);
    if (providerStatus === 503) {
      return response.status(503).json({ error: 'Gemini 서버가 현재 혼잡합니다. 잠시 후 다시 시도해 주세요.' });
    }
    const status = [400, 401, 403, 404, 429].includes(providerStatus) ? providerStatus : 502;
    response.status(status).json({ error: `Gemini API 요청 실패: ${providerMessage}` });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) return response.status(400).json({ error: '사진은 최대 5장, 각 10MB까지 첨부할 수 있습니다.' });
  response.status(400).json({ error: 'JPG, PNG, WEBP, GIF 형식의 사진만 첨부할 수 있습니다.' });
});

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`약속시간 서버 (Gemini 기반): http://localhost:${port}`));
}

export default app;
