import { Sandbox } from "@e2b/code-interpreter";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function buildUploadCode(filename, content_b64) {
  // Both filename ([a-zA-Z0-9._-]) and base64 ([A-Za-z0-9+/=])
  // are safe inside Python double-quoted strings — no injection risk.
  return [
    "import base64, requests",
    `content = base64.b64decode("${content_b64}")`,
    `r = requests.post(`,
    `    "https://litterbox.catbox.moe/api",`,
    `    data={"reqtype": "fileupload", "time": "72h"},`,
    `    files={"fileToUpload": ("${filename}", content)},`,
    `    timeout=30`,
    `)`,
    `r.raise_for_status()`,
    `print("LINK_SUCCESS|" + r.text.strip())`,
  ].join("\n");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return respond({ error: "POST only" }, 405);

    let body;
    try { body = await request.json(); }
    catch { return respond({ error: "Invalid JSON body" }, 400); }

    const apiKey = env.E2B_API_KEY;
    if (!apiKey) return respond({ error: "E2B_API_KEY not configured" }, 500);

    // Route: upload_file action vs raw code execution
    let code;
    if (body.action === "upload_file") {
      const { filename, content_b64 } = body;
      if (!filename || !content_b64)
        return respond({ error: "upload_file requires filename and content_b64" }, 400);
      code = buildUploadCode(filename, content_b64);
    } else if (typeof body.code === "string" && body.code.trim()) {
      code = body.code;
    } else {
      return respond({ error: "Provide 'code' string or action='upload_file'" }, 400);
    }

    let sandbox;
    try {
      sandbox = await Sandbox.create({ apiKey });

      // 25s timeout — CF Workers wall-clock limit is 30s
      const execution = await Promise.race([
        sandbox.runCode(code),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("E2B timed out after 25s")), 25000)
        ),
      ]);

      // *** THE ACTUAL FIX ***
      // execution.text == first rich result only (DataFrames, etc.) — NOT print()
      // print() goes to execution.logs.stdout, which is string[]
      const stdout = (execution.logs?.stdout ?? []).join("\n");
      const stderr = (execution.logs?.stderr ?? []).join("\n");
      const errorText = execution.error
        ? `[ERROR] ${execution.error.value}\n${execution.error.traceback ?? ""}`.trim()
        : "";

      const result = [stdout, stderr ? `[STDERR] ${stderr}` : "", errorText]
        .filter(Boolean)
        .join("\n");

      return respond({ result, stdout, stderr, has_error: !!execution.error });

    } catch (err) {
      // Always return result key so plugin null-checks don't blow up
      return respond({ error: err.message, result: "", stdout: "", stderr: "" }, 500);
    } finally {
      if (sandbox) try { await sandbox.kill(); } catch { /* ignore kill errors */ }
    }
  },
};
