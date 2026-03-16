import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODELS = {
  fast: "llama-3.1-8b-instant",
  smart: "llama-3.3-70b-versatile",
};

export async function POST(req: Request) {
  try {
    const { code, mode, question, history } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";
    let model = MODELS.smart;

    if (mode === "DESCRIBE") {
      model = MODELS.smart;
      systemPrompt = `You are a Senior Software Engineer giving a technical explanation of code to a peer developer.

Your response must:
- Start immediately with what the code does — no preamble, no "Sure!", no "Here is"
- Use clear section headers (bold, no hashtags) like: **What it does**, **Key logic**, **Data flow**, **Security notes**
- Write in concise paragraphs, not bullet soup
- Mention edge cases, potential issues, or notable patterns if relevant
- End with one sentence summary of the overall purpose
- Keep total response under 300 words unless the code is complex
- Use inline code formatting for variable names, function names, types`;

      userPrompt = `Explain this code:\n\n\`\`\`\n${code}\n\`\`\``;

    } else if (mode === "ASK") {
      model = MODELS.smart;
      systemPrompt = `You are a knowledgeable assistant inside RevChat, a developer-focused chat application.

Rules:
- Answer the user's question directly and accurately
- If the question is about the code/message context, reference it specifically
- If it's a general question unrelated to code, answer it naturally and helpfully
- Use code blocks only when showing actual code examples
- Keep answers focused — don't pad with unnecessary explanation
- If you don't know something, say so plainly
- Maintain context from conversation history when provided`;

      userPrompt = `${code ? `Context (message or code the user is referring to):\n\`\`\`\n${code}\n\`\`\`\n\n` : ""}${history ? `Conversation history:\n${history}\n\n` : ""}User's question: ${question}`;

    } else if (mode === "REVIEW") {
      model = MODELS.smart;
      systemPrompt = `You are a Senior Code Reviewer conducting a professional code review.

Structure your response exactly as follows:

**Summary**
One or two sentences describing what the code does and your overall assessment.

**Issues Found**
List actual bugs, logic errors, security vulnerabilities, or performance problems. For each: describe the problem, explain why it matters, and show the fix inline. Skip this section if there are no real issues — don't invent problems.

**Improvements**
Concrete suggestions for better readability, maintainability, or efficiency. Only include if genuinely useful.

**Revised Code**
Provide the improved version only if changes are substantial. Use a code block with the correct language.

Rules:
- Be specific and technical, not generic
- Don't praise trivial things ("good variable naming!")
- Don't add issues that aren't there just to seem thorough
- If the code is fine, say so briefly and explain why`;

      userPrompt = `Review this code:\n\n\`\`\`\n${code}\n\`\`\``;

    } else if (mode === "FREE") {
      // Free chat mode — general assistant
      model = MODELS.smart;
      systemPrompt = `You are a helpful, technically sharp assistant embedded in RevChat, a developer chat app.

Be direct and useful. Match the tone of the question — casual questions get casual answers, technical questions get technical answers. Use code blocks when showing code. Don't be verbose.`;

      userPrompt = history
        ? `${history}\n\nUser: ${question}`
        : question;

    } else {
      // Default fallback — same as REVIEW
      model = MODELS.smart;
      systemPrompt = `You are a Senior Code Reviewer. Analyze the provided code for bugs, security issues, and performance problems.

**Summary**
Brief description and overall quality assessment.

**Issues Found**
Real problems only — describe each issue and provide the fix.

**Improvements**
Optional concrete suggestions.

**Revised Code**
Only if changes are substantial.`;

      userPrompt = `Review this code:\n\n\`\`\`\n${code}\n\`\`\``;
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: mode === "ASK" || mode === "FREE" ? 0.5 : 0.3,
      max_tokens: mode === "DESCRIBE" ? 500 : 1500,
    });

    const output = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ suggestion: output });

  } catch (error: any) {
    console.error("Groq API Error:", error);
    return NextResponse.json(
      { error: "AI processing failed", detail: error?.message },
      { status: 500 }
    );
  }
}