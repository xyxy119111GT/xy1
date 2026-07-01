import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const model = "gpt-5.4-mini";
const indexPath = path.join(__dirname, "index.html");

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/", (req, res) => {
  res.sendFile(indexPath);
});

app.use(express.static(__dirname));

function sendError(res, status, error, message) {
  res.status(status).json({ error, message });
}

function cleanText(value) {
  return String(value || "").trim();
}

function validatePayload(payload) {
  const data = {
    industry: cleanText(payload.industry),
    style: cleanText(payload.style),
    need: cleanText(payload.need),
    customer: cleanText(payload.customer),
    points: cleanText(payload.points),
  };

  const missingFields = Object.entries(data)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { data, missingFields };
}

function getOpenAIKeyValidation() {
  const apiKey = cleanText(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    return { apiKey: "", isValid: false };
  }

  const hasOnlyHeaderSafeCharacters = /^[\x21-\x7E]+$/.test(apiKey);
  const looksLikeOpenAIKey = apiKey.startsWith("sk-");

  return {
    apiKey,
    isValid: hasOnlyHeaderSafeCharacters && looksLikeOpenAIKey,
  };
}

function buildPrompt(data) {
  return `
你是一位有实战经验的中文私域营销文案顾问，擅长把产品卖点转化为自然、可信、适合成交的内容。

请根据用户提供的信息，生成 4 类中文文案：微信朋友圈文案、抖音短视频文案、小红书种草文案、私聊成交话术。

要求：
1. 只返回 JSON，不要返回 Markdown，不要用代码块。
2. JSON 必须包含 wechat、douyin、xiaohongshu、sales 四个字段。
3. 语言自然、像真人表达，不要像机器人模板。
4. 不要太夸张，不要虚假承诺，不要保证效果，不要使用违规、敏感或高风险表述。
5. 每类文案都要明显不同，不能只是换标题。
6. 微信朋友圈文案：像真实分享，口吻自然，有轻微信任感。
7. 抖音短视频文案：适合口播，有开头钩子、清晰节奏和行动引导。
8. 小红书种草文案：可以稍微种草，但要克制、真实、有体验感。
9. 私聊成交话术：更像真人聊天，先理解客户情况，再给建议，不要像广告。
10. 每类文案控制在 90 到 180 个中文字符左右。
11. 必须融合行业、文案风格、需求、目标客户和产品卖点。

用户信息：
行业：${data.industry}
文案风格：${data.style}
需求：${data.need}
目标客户：${data.customer}
产品卖点：${data.points}
`;
}

function buildWeeklyPlanPrompt(data) {
  return `
你是一位熟悉微信私域运营的中文内容策划顾问，擅长把一个产品或服务拆成 7 天朋友圈内容节奏。

请根据用户提供的信息，生成一套“7 天朋友圈内容计划”。

内容节奏必须严格按照：
第 1 天：破冰介绍
第 2 天：痛点引导
第 3 天：产品/服务价值
第 4 天：案例展示
第 5 天：信任建立
第 6 天：限时引导
第 7 天：成交转化

每一天都必须包含：
1. 朋友圈标题
2. 正文内容
3. 配图建议
4. 适合发布时间
5. 明确运营目的

写作要求：
1. 只返回 JSON，不要返回 Markdown，不要用代码块。
2. JSON 必须包含 plan 字段，plan 必须是 7 个对象组成的数组。
3. 内容要像真人朋友圈，不要像硬广告。
4. 每天内容要有节奏，不能重复，不能只是换个标题。
5. 不要夸大承诺，不要虚假宣传，不要保证效果。
6. 不要出现违规、敏感、高风险表述。
7. 适合微信私域运营，语言自然、接地气、有信任感。
8. 每天正文控制在 90 到 180 个中文字符左右。
9. 必须融合行业、文案风格、需求、目标客户和产品卖点。

用户信息：
行业：${data.industry}
文案风格：${data.style}
需求：${data.need}
目标客户：${data.customer}
产品卖点：${data.points}
`;
}

function parseModelJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

function getWeeklyPlanSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      plan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day: { type: "number" },
            theme: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            imageSuggestion: { type: "string" },
            publishTime: { type: "string" },
            purpose: { type: "string" },
          },
          required: [
            "day",
            "theme",
            "title",
            "content",
            "imageSuggestion",
            "publishTime",
            "purpose",
          ],
        },
      },
    },
    required: ["plan"],
  };
}

function handleOpenAIError(res, error) {
  const status = error?.status || error?.response?.status;
  const code = error?.code || error?.error?.code;
  const type = error?.type || error?.error?.type;

  console.error("OpenAI generation failed. Sensitive details were not printed.");

  if (status === 401) {
    sendError(res, 500, "invalid_api_key", "请检查 OpenAI API Key 是否正确。");
    return;
  }

  if (
    status === 402 ||
    status === 403 ||
    code === "insufficient_quota" ||
    type === "insufficient_quota"
  ) {
    sendError(res, 500, "account_or_permission", "请检查 OpenAI API 账户余额或模型权限。");
    return;
  }

  if (status === 429) {
    sendError(res, 500, "account_or_permission", "请检查 OpenAI API 账户余额或模型权限。");
    return;
  }

  sendError(res, 500, "service_unavailable", "AI 服务暂时不可用，请稍后重试。");
}

app.post("/api/generate", async (req, res) => {
  const keyValidation = getOpenAIKeyValidation();

  if (!keyValidation.isValid) {
    const errorType = process.env.OPENAI_API_KEY ? "invalid_api_key" : "missing_api_key";
    const message = errorType === "missing_api_key"
      ? "请先配置 OpenAI API Key。"
      : "请检查 OpenAI API Key 是否正确。";

    sendError(res, 500, errorType, message);
    return;
  }

  const { data, missingFields } = validatePayload(req.body || {});

  if (missingFields.length > 0) {
    sendError(res, 400, "invalid_request", "请完整填写行业、文案风格、需求、目标客户和产品卖点。");
    return;
  }

  try {
    const client = new OpenAI({
      apiKey: keyValidation.apiKey,
    });

    const response = await client.responses.create({
      model,
      input: buildPrompt(data),
      text: {
        format: {
          type: "json_schema",
          name: "copywriter_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              wechat: { type: "string" },
              douyin: { type: "string" },
              xiaohongshu: { type: "string" },
              sales: { type: "string" },
            },
            required: ["wechat", "douyin", "xiaohongshu", "sales"],
          },
        },
      },
    });

    const result = parseModelJson(response.output_text);

    res.json({
      wechat: result.wechat,
      douyin: result.douyin,
      xiaohongshu: result.xiaohongshu,
      sales: result.sales,
    });
  } catch (error) {
    handleOpenAIError(res, error);
  }
});

app.post("/api/generate-weekly-plan", async (req, res) => {
  const keyValidation = getOpenAIKeyValidation();

  if (!keyValidation.isValid) {
    const errorType = process.env.OPENAI_API_KEY ? "invalid_api_key" : "missing_api_key";
    const message = errorType === "missing_api_key"
      ? "请先配置 OpenAI API Key。"
      : "请检查 OpenAI API Key 是否正确。";

    sendError(res, 500, errorType, message);
    return;
  }

  const { data, missingFields } = validatePayload(req.body || {});

  if (missingFields.length > 0) {
    sendError(res, 400, "invalid_request", "请完整填写行业、文案风格、需求、目标客户和产品卖点。");
    return;
  }

  try {
    const client = new OpenAI({
      apiKey: keyValidation.apiKey,
    });

    const response = await client.responses.create({
      model,
      input: buildWeeklyPlanPrompt(data),
      text: {
        format: {
          type: "json_schema",
          name: "weekly_plan_result",
          strict: true,
          schema: getWeeklyPlanSchema(),
        },
      },
    });

    const result = parseModelJson(response.output_text);

    if (!Array.isArray(result.plan) || result.plan.length !== 7) {
      sendError(res, 500, "service_unavailable", "AI 服务暂时不可用，请稍后重试。");
      return;
    }

    res.json({
      plan: result.plan,
    });
  } catch (error) {
    handleOpenAIError(res, error);
  }
});

app.listen(port, () => {
  console.log(`AI 私域文案生成器已启动：http://localhost:${port}`);
});
