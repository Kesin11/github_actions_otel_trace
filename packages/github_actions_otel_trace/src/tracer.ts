import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { diag, DiagConsoleLogger, DiagLogLevel, trace, context, SpanStatusCode, Tracer, Span } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { WorkflowJobs, WorkflowRun } from './github';

export class GithubActionsTracer {
  private debug: boolean
  exporter?: OTLPTraceExporter
  tracer?: Tracer
  workflowRunSpan?: Span
  constructor(options: {
    debug?: boolean,
    serviceName: string,
    otlpEndpoint?: string
  }) {
    this.debug = options.debug ?? false
    if (this.debug) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    this.setupTracer(options.serviceName, this.debug, options.otlpEndpoint)
  }

  setupTracer(serviceName: string, debug: boolean, otlpEndpoint?: string) {
    const url = otlpEndpoint ?? "http://localhost:4318/v1/traces"
    const provider = new BasicTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
    });

    this.exporter = new OTLPTraceExporter({
      url, // url is optional and can be omitted - default is http://localhost:4318/v1/traces
      headers: {}, // an optional object containing custom headers to be sent with each request will only work with http
      // concurrencyLimit: 10, // an optional limit on pending requests
    })

    if (debug) provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.addSpanProcessor(new SimpleSpanProcessor(this.exporter))
    this.tracer = provider.getTracer(serviceName)
  }

  shutdown() {
    this.exporter?.shutdown()
  }

  startWorkflowSpan(workflowRun: WorkflowRun) {
    if (this.tracer === undefined) throw new Error(`tracer is undefined!`)

    const runSpan = this.tracer.startSpan(workflowRun.name!, { startTime: new Date(workflowRun.created_at )})
    runSpan.setAttributes({
      'run.status': workflowRun.status ?? '',
      'run.conclusion': workflowRun.conclusion ?? ''
    })
    runSpan.setStatus(
      (workflowRun.conclusion !== 'success')
      ? { code: SpanStatusCode.ERROR }
      : { code: SpanStatusCode.OK }
    )
    this.workflowRunSpan = runSpan
  }

  endWorkflowSpan(workflowRun: WorkflowRun) {
    this.workflowRunSpan?.end(new Date(workflowRun.updated_at!))
  }

  async addJobSpans(workflowJobs: WorkflowJobs) {
    if (this.tracer === undefined) throw new Error(`tracer is undefined!`)
    if (this.workflowRunSpan === undefined) throw new Error(`workflowRunSpan is undefined!`)
    // TODO: Add queue span to each job

    for (const job of workflowJobs) {
      const jobSpan = this.tracer.startSpan(
        job.name,
        { startTime: new Date(job.started_at) },
        trace.setSpan(context.active(), this.workflowRunSpan)
      )
      jobSpan.setAttributes({
        'job.name': job.name,
        'job.id': job.id,
        'job.status': job.status ?? '',
        'job.conclusion': job.conclusion ?? ''
      })
      jobSpan.setStatus(
        (job.conclusion !== 'success')
        ? { code: SpanStatusCode.ERROR }
        : { code: SpanStatusCode.OK }
      )

      // Steps Span
      for (const step of job.steps!) {
        const stepSpan = this.tracer.startSpan(
          step.name,
          { startTime: new Date(step.started_at!) },
          trace.setSpan(context.active(), jobSpan)
        )
        stepSpan.setAttributes({
          'step.name': step.name,
          'step.id': step.number,
          'step.status': job.status ?? '',
          'conclusion': job.conclusion ?? ''
        })
        stepSpan.setStatus(
          (step.conclusion !== 'success')
          ? { code: SpanStatusCode.ERROR }
          : { code: SpanStatusCode.OK }
        )
        stepSpan.end(new Date(step.completed_at!))
      }

      jobSpan.end(new Date(job.completed_at!))
    }
  }
}