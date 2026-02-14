import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    // 1. Capture the 'mode' sent from the frontend
    const { code, mode } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    // 2. Determine the AI's "Personality" based on the mode
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
  
  // FIX: Assign the code to userPrompt!
  userPrompt = `Analyze this code snippet:\n\n${code}`; 
} else {
      // Default: Standard Code Review
      systemPrompt = `You are a Senior Code Reviewer. 
      Analyze the provided code for errors, security flaws, and performance issues. 
      Provide a concise review with: 1. Error Detection, 2. Suggestions, 3. Improved Code Snippet. 
      Use Markdown.`;
      
      userPrompt = `Please review this code:\n\n${code}`;
    }

    // 3. Call Groq with the dynamic prompts
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
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