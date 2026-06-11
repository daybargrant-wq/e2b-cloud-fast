import { CodeInterpreter } from '@e2b/code-interpreter';

export default {
  async fetch(request) {
    // 1. Bypass Browser CORS Blocks
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    try {
      const { code } = await request.json();
      
      // 2. Open Cloud Server with your Key
      const sandbox = await CodeInterpreter.create({ 
        apiKey: "e2b_f6446dd6b0a51f5aa98dffe3ae859ce4917f505a" 
      });

      // 3. Execute Code & Catch Output
      const execution = await sandbox.notebook.execCell(code);
      let output = execution.text || "";
      
      if (execution.error) {
        output += "\nError: " + execution.error.value;
      }

      await sandbox.close();

      // 4. Return Output to TypingMind
      return new Response(JSON.stringify({ result: output }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};
