import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { getTrace, listTraceOperations, searchTraces } from './jaeger.ts';

/**
 * An MCP server over streamable HTTP for Jaeger's v3 query API (JAEGER_URL). Its tools return short
 * text summaries, not raw spans. Stateless: every POST /mcp gets a fresh server and transport.
 */

const text = async (run: () => Promise<string>) => ({ content: [{ type: 'text' as const, text: await run() }] });

function buildServer() {
  const server = new McpServer({ name: 'jaeger-toy-mcp', version: '0.1.0' });
  server.registerTool(
    'list_trace_operations',
    {
      description:
        'List the services that send traces, or, given a service, the operations (span names) it handles and calls, by span kind. Use this first to learn what to search for.',
      inputSchema: { service: z.string().nullish().describe('A service name, or null to list all services') },
    },
    ({ service }) => text(() => listTraceOperations(service ?? undefined)),
  );
  server.registerTool(
    'search_traces',
    {
      description:
        'Find recent traces for a service and summarize each one: services involved, errors and where they happened, and the business attributes on its spans. Starts with a tally of attribute values across the traces.',
      inputSchema: {
        service: z.string().describe('Service whose spans must appear in the trace, for example "checkout"'),
        operation: z.string().nullish().describe('Exact operation (span name) from list_trace_operations, or null'),
        errorsOnly: z.boolean().nullish().describe('true to return only traces with a failed span'),
        attributes: z
          .record(z.string(), z.string())
          .nullish()
          .describe('Span attributes that must match exactly, for example {"demo.product.id": "OLJCESPC7Z"}, or null'),
        minDurationMs: z.number().nullish().describe('Only traces at least this slow, or null'),
        lookbackMinutes: z.number().nullish().describe('How far back to search, default 15'),
        limit: z.number().nullish().describe('How many traces to summarize, default 10, max 20'),
      },
    },
    (input) => text(() => searchTraces(input)),
  );
  server.registerTool(
    'get_trace',
    {
      description:
        'Show one trace as a tree of spans: service, operation, kind, duration, errors and business attributes. Use a trace ID from search_traces or from logs.',
      inputSchema: { traceId: z.string().describe('32-character hex trace ID') },
    },
    ({ traceId }) => text(() => getTrace(traceId)),
  );
  return server;
}

const port = Number(process.env.PORT ?? 9300);
createServer(async (req, res) => {
  if (req.url !== '/mcp') {
    res.writeHead(404).end();
    return;
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}).listen(port, () => console.log(`jaeger-toy-mcp on http://localhost:${port}/mcp (JAEGER_URL=${process.env.JAEGER_URL})`));
