import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { diag, DiagConsoleLogger, DiagLogLevel, trace, context, SpanStatusCode, Tracer, Span } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPExporterNodeConfigBase } from '@opentelemetry/otlp-exporter-base';
import { WorkflowJobs, WorkflowRun } from './github';

export class GithubActionsTracer {
  private debug: boolean
  exporter?: OTLPTraceExporter
  tracer?: Tracer
  workflowRunSpan?: Span
  constructor(args: {
    serviceName: string,
    debug?: boolean,
    otlpEndpoint?: string,
    otlpExporterNodeConfig?: OTLPExporterNodeConfigBase,
  }) {
    this.debug = args.debug ?? false
    if (this.debug) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    this.setupTracer(args.serviceName, { otlpEndpoint: args.otlpEndpoint, otlpExporterNodeConfig: args.otlpExporterNodeConfig })
  }

  setupTracer(serviceName: string, options?: { otlpEndpoint?: string, otlpExporterNodeConfig?: OTLPExporterNodeConfigBase }) {
    const provider = new BasicTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
    });

    switch (options) {
      case options?.otlpEndpoint:
        this.exporter = new OTLPTraceExporter({ url: options?.otlpEndpoint })
        break
      case options?.otlpExporterNodeConfig:
        this.exporter = new OTLPTraceExporter({ ...options?.otlpExporterNodeConfig })
        break
      default:
        this.exporter = new OTLPTraceExporter()
        break
    }

    if (this.debug) provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.addSpanProcessor(new SimpleSpanProcessor(this.exporter))
    this.tracer = provider.getTracer(serviceName)
  }

  async shutdown() {
    return this.exporter?.shutdown()
  }

  startWorkflowSpan(workflowRun: WorkflowRun) {
    if (this.tracer === undefined) throw new Error(`tracer is undefined!`)

    const runSpan = this.tracer.startSpan(
      `${workflowRun.repository.full_name}:${workflowRun.name ?? workflowRun.workflow_id}`,
      {
        startTime: new Date(workflowRun.created_at),
        attributes: {
          'github.run.full_name': workflowRun.repository.full_name,
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
