import * as otel from '@opentelemetry/api'

const TRACE_NAME = '@torm/sqlite'

const tracer = otel.trace.getTracer(TRACE_NAME)

export function attribute(name: string, value: any) {
  otel.trace.getActiveSpan()?.setAttribute(name, value)
}

export function instrument(span_name?: string) {
  return function(original_method: any, context: ClassMethodDecoratorContext) {
    const method_name = String(context.name);

    function replacement_method(...args: any[]) {
      // @ts-ignore
      const thisClass = this as any
      const final_span_name = span_name || `${thisClass.constructor.name}.${method_name}`;

      return tracer.startActiveSpan(final_span_name, (span: otel.Span) => {
        try {
          span.setAttributes({
            'class.name': thisClass.constructor.name,
            'method.name': method_name,
          });

          // execute the original method
          // note that currentl we only support synchronous methods. In the future, we can easily add promise support here, but since our only driver is sqlite, this is fine for now
          return original_method.call(thisClass, ...args);
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end()
        }
      });
    }

    context.addInitializer(function (this) {
      const thisClass = this as any
      // also bind any method we set up this way
      thisClass[method_name] = thisClass[method_name].bind(thisClass)
    });

    return replacement_method;
  };
}
