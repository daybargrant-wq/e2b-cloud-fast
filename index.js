import { Sandbox } from '@e2b/code-interpreter';

export default {
  async fetch(request) {
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
      
      // 1. Using the new v2 Sandbox structure
      const sandbox = await Sandbox.create({ 
        apiKey: "e2b_f6446dd6b0a51f5aa98dffe3ae859ce4917f505a" 
      });

      // 2. Swapped to the lightning fast execution method
      const execution = await sandbox.runCode(code);
      let output = execution.text || "";
      
      if (execution.error) {
        output += "\nError: " + execution.error.value;
      }

      await sandbox.kill();

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
