const responseSchema = {
  type: 'object', additionalProperties: false, required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['question', 'optionA', 'optionB', 'optionC', 'optionD', 'correct', 'difficulty', 'explanation'],
        properties: {
          question: { type: 'string' }, optionA: { type: 'string' }, optionB: { type: 'string' },
          optionC: { type: 'string' }, optionD: { type: 'string' },
          correct: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
          explanation: { type: 'string' }
        }
      }
    }
  }
};

export default async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'Server AI is not configured. Add OPENAI_API_KEY to Netlify environment variables.' }, { status: 503 });
  try {
    const { topic, batch = 'ALL', previousQuestions = [] } = await request.json();
    if (typeof topic !== 'string' || topic.trim().length < 2 || topic.length > 180) {
      return Response.json({ error: 'Please provide a valid topic.' }, { status: 400 });
    }
    const prior = Array.isArray(previousQuestions) ? previousQuestions.filter((q) => typeof q === 'string').slice(-250) : [];
    const prompt = `Create exactly 35 high-quality four-option MCQs for Deep Education, a Computer Application / Computer Science teaching centre in West Bengal. Topic: ${topic}. Batch: ${batch}. Use correct syllabus-level facts, precise wording, plausible distractors, no ambiguous questions, and distribute difficulty as 10 Easy, 17 Medium, 8 Hard. Vary the correct option positions. Include concise explanations. Do not repeat or paraphrase these previously used questions: ${JSON.stringify(prior)}. Output only the required JSON schema.`;
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.85,
        response_format: { type: 'json_schema', json_schema: { name: 'deep_education_quiz', strict: true, schema: responseSchema } },
        messages: [
          { role: 'system', content: 'You are an experienced Computer Science and Computer Application examiner. Never invent facts. Ensure exactly one correct answer per question.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const payload = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(payload.error?.message || 'AI provider request failed.');
    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');
    const questions = parsed.questions || [];
    if (questions.length !== 35) throw new Error('AI did not return exactly 35 questions. Please retry.');
    const normalized = questions.map((q) => ({ ...q, question: q.question.trim() }));
    const fingerprint = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const fingerprints = normalized.map((q) => fingerprint(q.question));
    if (new Set(fingerprints).size !== 35) throw new Error('AI generated duplicate questions. Please retry.');
    const previousSet = new Set(prior.map(fingerprint));
    if (fingerprints.some((value) => previousSet.has(value))) throw new Error('AI repeated a previously published question. Generate again.');
    const distribution = normalized.reduce((counts, q) => { counts[q.difficulty] = (counts[q.difficulty] || 0) + 1; return counts; }, {});
    if (distribution.Easy !== 10 || distribution.Medium !== 17 || distribution.Hard !== 8) throw new Error('AI returned an incorrect difficulty distribution. Generate again.');
    return Response.json({ questions: normalized });
  } catch (error) {
    return Response.json({ error: error.message || 'Quiz generation failed.' }, { status: 502 });
  }
};
