import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSpans, summarizeTrace, summarizeTraces } from '../src/jaeger.ts';

const str = (key: string, value: string) => ({ key, value: { stringValue: value } });
const span = (traceId: string, spanId: string, parentSpanId: string, name: string, extra: object = {}) => ({
  traceId,
  spanId,
  parentSpanId,
  name,
  kind: 2,
  startTimeUnixNano: '1792444840000000000',
  endTimeUnixNano: '1792444840050000000',
  ...extra,
});
const body = {
  result: {
    resourceSpans: [
      {
        resource: { attributes: [str('service.name', 'checkout')] },
        scopeSpans: [
          {
            spans: [
              span('t1', 'a', '', 'PlaceOrder', {
                attributes: [str('user.id', 'u1'), str('http.method', 'POST')],
                status: { code: 2 },
                events: [{ name: 'exception', attributes: [str('exception.message', 'could not charge')] }],
              }),
              span('t2', 'x', '', 'PlaceOrder', { attributes: [str('user.id', 'u2')] }),
            ],
          },
        ],
      },
      {
        resource: { attributes: [str('service.name', 'product-catalog')] },
        scopeSpans: [
          {
            spans: [
              span('t1', 'b', 'a', 'GetProduct', { attributes: [str('product.name', 'Telescope')] }),
              span('t2', 'y', 'x', 'GetProduct', { attributes: [str('product.name', 'Telescope')] }),
            ],
          },
        ],
      },
    ],
  },
};

test('parses OTLP spans with service, duration, error message and attributes', () => {
  const spans = parseSpans(body);
  assert.equal(spans.length, 4);
  const root = spans.find((s) => s.spanId === 'a')!;
  assert.equal(root.service, 'checkout');
  assert.equal(root.kind, 'server');
  assert.equal(root.durationMs, 50);
  assert.equal(root.error, 'could not charge');
});

test('summarizes traces with errors, business attributes (no transport noise) and a tally', () => {
  const text = summarizeTraces(parseSpans(body), 10);
  assert.match(text, /^2 traces matched/);
  assert.match(text, /errors: could not charge \(in checkout "PlaceOrder"\)/);
  assert.match(text, /product\.name=Telescope/);
  assert.doesNotMatch(text, /http\.method/);
  assert.match(text, /- product\.name: Telescope \(2\)/);
});

test('renders one trace as a span tree', () => {
  const text = summarizeTrace(parseSpans(body).filter((s) => s.traceId === 't1'));
  assert.match(text, /- checkout "PlaceOrder" \(server, 50 ms\) ERROR: could not charge/);
  assert.match(text, /\n {2}- product-catalog "GetProduct"/);
});
