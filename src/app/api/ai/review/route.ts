import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { code, mode, question, history } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "DESCRIBE") {
      systemPrompt = `You are a Senior Security Engineer. 
      The user will provide a code snippet. 
      ACT NOW: Provide a direct, technical breakdown of the logic provided.
      
      RULES:
      - Do NOT explain your process.
      - Do NOT say "Here is an example".
      - Directly explain what the code DOES.
      - Use 🛡️ for security, ⚡ for logic, and 📟 for data.
      - Use Markdown with bold headers.`;

      userPrompt = `Analyze this code snippet:\n\n${code}`;

    } else if (mode === "ASK") {
      systemPrompt = `You are an expert chatbot assistant inside a chat app called RevChat.
      The user is asking questions about a specific message or code snippet.
      Be concise, technical, and helpful. Use code examples when relevant.
      Maintain context from the conversation history provided.If a user is asking something non coding related answer that too.`;

      userPrompt = `Context message the user is asking about:
\`\`\`
${code}
\`\`\`

${history ? `Conversation so far:\n${history}\n\n` : ""}User's latest question: ${question}`;

    } else {
      systemPrompt = `You are a Senior Code Reviewer. 
      Analyze the provided code for errors, security flaws, and performance issues. 
      Provide a concise review with: 1. Error Detection, 2. Suggestions, 3. Improved Code Snippet. 
      Use Markdown.`;

      userPrompt = `Please review this code:\n\n${code}`;
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
    });

    return NextResponse.json({
      suggestion: completion.choices[0]?.message?.content
    });

  } catch (error) {
    console.error("Groq API Error:", error);
    return NextResponse.json({ error: "AI Processing failed" }, { status: 500 });
  }
}