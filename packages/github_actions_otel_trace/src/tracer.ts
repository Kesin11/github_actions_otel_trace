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

  // TODO: providerの作り方あたりをこれの実装と比べてみる https://github.com/inception-health/otel-export-trace-action

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

    const runSpan = this.tracer.startSpan(
      workflowRun.name ?? String(workflowRun.workflow_id),
      {
        startTime: new Date(workflowRun.created_at),
        attributes: {
          'github.run.workflow_name': workflowRun.name ?? '',
          'github.run.workflow_id': workflowRun.workflow_id,
          'github.run.html_url': workflowRun.html_url,
          'github.run.run_id': workflowRun.id,
          'github.run.number': workflowRun.run_number,
          'github.run.event': workflowRun.event,
          'github.run.status': workflowRun.status ?? '',
          'guthub.run.conclusion': workflowRun.conclusion ?? ''
        },
        root: true,
      }
    )
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
    for (const job of workflowJobs) {
      const jobSpan = this.tracer.startSpan(
        job.name,
        {
          startTime: new Date(job.started_at),
          attributes: {
            'github.job.name': job.name,
            'github.job.id': job.id,
            'github.job.run_id': job.run_id,
            'github.job.status': job.status ?? '',
            'github.job.conclusion': job.conclusion ?? ''
          }
        },
        trace.setSpan(context.active(), this.workflowRunSpan)
      )
      jobSpan.setStatus(
        (job.conclusion !== 'success')
        ? { code: SpanStatusCode.ERROR }
        : { code: SpanStatusCode.OK }
      )

      // Steps Span
      for (const step of job.steps!) {
        const stepSpan = this.tracer.startSpan(
          step.name,
          {
            startTime: new Date(step.started_at!),
            attributes: {
              'github.step.name': step.name,
              'github.step.number': step.number,
              'github.step.status': step.status ?? '',
              'github.step.conclusion': step.conclusion ?? ''
            }
          },
          trace.setSpan(context.active(), jobSpan)
        )
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