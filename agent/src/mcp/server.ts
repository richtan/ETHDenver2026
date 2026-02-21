import { type Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools, type OrchestratorRef } from "./tools.js";
import { registerResources } from "./resources.js";

export function mountMcpServer(app: Express, orchestratorRef: OrchestratorRef) {
  const mcpServer = new McpServer({
    name: "taskmaster-agent",
    version: "1.0.0",
  });

  registerTools(mcpServer, orchestratorRef);
  registerResources(mcpServer, orchestratorRef);

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  // POST /mcp — JSON-RPC requests from clients
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      const id = [...sessions.entries()].find(([, t]) => t === transport)?.[0];
      if (id) sessions.delete(id);
    };

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // GET /mcp — SSE stream for server-to-client notifications
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — terminate session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  });

  console.log("MCP server mounted at /mcp");
}
