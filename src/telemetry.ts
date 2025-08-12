import * as otel from '@opentelemetry/api'

const TRACE_NAME = '@torm/sqlite'

const trace = otel.trace.getTracer(TRACE_NAME)

export function start_span(name: string, attributes?: otel.Attributes) {
  const span = trace.startSpan(name, {attributes})
  return span
}
