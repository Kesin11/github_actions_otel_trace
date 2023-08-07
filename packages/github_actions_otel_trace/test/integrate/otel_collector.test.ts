import fs from 'node:fs';
import path from "node:path";
import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GithubActionsTracer } from '../../src/tracer';
import { WorkflowJobs, WorkflowRun } from '../../src/github';

const testTraceJson = path.join(__dirname, 'test_trace.json')
let beforeJsonSize: number

// NOTE: Need to run otel-collector before run this test
// otel-collector --config ./test/integrate/test_config.yaml 2> ./test/integrate/test_trace.json
describe('Integrate test', () => {
  beforeEach(async () => {
    const stat = await fs.promises.stat(testTraceJson)
    beforeJsonSize = stat.size
  });

  it('Output trace to OTEL collector', async () => {
    const githubActionsTracer = new GithubActionsTracer({
      serviceName: 'github_actions',
      otlpEndpoint: "http://localhost:4318/v1/traces",
      // debug: true
    })

    const workflowRun = {
      repository: {
        full_name: 'test/test',
      },
      name: 'test_workflow',
      workflow_id: 'test',
      html_url: '',
      run_id: 1,
      run_number: 1,
      event: 'push',
      status: 'completed',
      conclusion: 'success',
      created_at: '2021-01-01T00:00:00Z',
      updated_at: '2021-01-01T00:10:00Z',
    } as unknown as WorkflowRun
    const jobs = [{
      id: 1,
      run_id: 1,
      name: 'test_job',
      status: 'completed',
      conclusion: 'success',
      started_at: '2021-01-01T00:00:00Z',
      completed_at: '2021-01-01T00:10:00Z',
      steps: [{
        name: 'step1',
        status: 'completed',
        conclusion: 'success',
        number: 1,
        started_at: '2021-01-01T00:00:00Z',
        completed_at: '2021-01-01T00:10:00Z',
      }]
    }] as WorkflowJobs

    assert.doesNotThrow(async () => {
      githubActionsTracer.startWorkflowSpan(workflowRun)
      githubActionsTracer.addJobSpans(jobs)
      githubActionsTracer.endWorkflowSpan(workflowRun)
      await githubActionsTracer.shutdown()
    })

    // Wait for flushing file
    await setTimeout(500)

    assert.ok(fs.existsSync(testTraceJson), './test_trace.json is exists')
    const stat = await fs.promises.stat(testTraceJson)
    const afterJsonSize = stat.size

    assert.ok(afterJsonSize > beforeJsonSize, `Collector receive trace and append to log. log size: after:${afterJsonSize} > before:${beforeJsonSize}`)
  });
}); 
