# jaeger-toy-mcp

A small MCP server for Jaeger's v3 query API, over streamable HTTP. Its tools return short text summaries of traces rather than raw spans, so an LLM can read them:

- `list_trace_operations`: the services that send traces, or one service's operations by span kind.
- `search_traces`: recent traces for a service, filtered by operation, errors, attributes or duration, with a tally of attribute values across them.
- `get_trace`: one trace as an indented span tree.

`skill.md` is the matching skill: paste it into the integration's skill in Voice Commander (or any client that takes Markdown instructions).

## Run

Node 24 runs the TypeScript directly; there is no build step.

```bash
npm install
JAEGER_URL=http://localhost:8080/jaeger/ui npm start
```

The server listens on `http://localhost:9300/mcp` (`PORT` changes the port). `JAEGER_URL` is the Jaeger query UI base; the server calls `<JAEGER_URL>/api/v3`.

With Docker:

```bash
docker build -t jaeger-toy-mcp .
docker run --rm -p 127.0.0.1:9300:9300 -e JAEGER_URL=http://jaeger:16686/jaeger/ui jaeger-toy-mcp
```

There is no authentication: run it only on a private network or bound to localhost.

## Test

```bash
npm test
npm run typecheck
```
