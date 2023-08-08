import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GithubActionsTracer } from '../../src/tracer';
import { WorkflowJobs, WorkflowRun } from '../../src/github';
import { execSync } from 'node:child_process';

let beforeLogSize: number

// NOTE: Need to run otel-collector before run this test
// docker compose -f test/integrate/compose.yml up -d --wait
describe('Integrate test', () => {
  beforeEach(async () => {
    const logs = execSync("docker compose logs", { cwd: __dirname, encoding: "utf-8" })
    beforeLogSize = logs.length
  });

  it('Output trace to OTEL collector', async () => {
    const githubActionsTracer = new GithubActionsTracer({
      serviceName: 'github_actions',
      otlpEndpoint: "http://localhost:4318/v1/traces",
      debug: true
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

    // Wait for stability
    await setTimeout(1000)

    const logs = execSync("docker compose logs", { cwd: __dirname, encoding: "utf-8" })
    const afterLogSize = logs.length

    assert.ok(afterLogSize > beforeLogSize, `Assert OTEL collector received trace and appended to log. log size: after:${afterLogSize} > before:${beforeLogSize}`)
  });
}); 
