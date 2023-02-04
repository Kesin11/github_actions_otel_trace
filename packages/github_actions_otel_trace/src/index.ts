import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { diag, DiagConsoleLogger, DiagLogLevel, trace, context, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { fetchWorkflowJobs, fetchWorkflowRun } from './github';

const OWNER = "Kesin11"
const REPO = "setup-job-workspace-action"
const RUN_ID = 4020585393

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

function setupTracer() {
  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'github_actions',
    }),
  });

  const exporter = new OTLPTraceExporter({
    url: "http://localhost:4318/v1/traces", // url is optional and can be omitted - default is http://localhost:4318/v1/traces
    headers: {}, // an optional object containing custom headers to be sent with each request will only work with http
    // concurrencyLimit: 10, // an optional limit on pending requests
  })
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
  return {
    tracer: provider.getTracer(REPO),
    exporter,
  }
}

const main = async () => {
  const { tracer, exporter } = setupTracer()
  const workflowRun = await fetchWorkflowRun(OWNER, REPO, RUN_ID)
  const runSpan = tracer.startSpan(workflowRun.name!, { startTime: new Date(workflowRun.created_at )})
  runSpan.setAttributes({
    'run.status': workflowRun.status ?? '',
    'run.conclusion': workflowRun.conclusion ?? ''
  })
  runSpan.setStatus(
    (workflowRun.conclusion !== 'success')
    ? { code: SpanStatusCode.ERROR }
    : { code: SpanStatusCode.OK }
  )

  // Add queue time
  const workflowCreated = new Date(workflowRun.created_at)
  const queueSpan = tracer.startSpan(
    'in_queued',
    { startTime: workflowCreated },
    trace.setSpan(context.active(), runSpan)
  )

  // Jobs span
  const jobs = await fetchWorkflowJobs(OWNER, REPO, RUN_ID)
  queueSpan.end(new Date(jobs[0].started_at)) // NOTE: 本当はjobsのstarted_atで一番最初を求めるべき
  for (const job of jobs) {
    const jobSpan = tracer.startSpan(
      job.name,
      { startTime: new Date(job.started_at) },
      trace.setSpan(context.active(), runSpan)
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
      const stepSpan = tracer.startSpan(
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

  runSpan.end(new Date(workflowRun.updated_at!)) // NOTE: 本当はjobsの最後のcompleted_atを入れるべき
  exporter.shutdown()
}
main()
