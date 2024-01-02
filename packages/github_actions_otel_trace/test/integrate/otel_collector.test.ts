import { setTimeout } from 'node:timers/promises';
import path from 'node:path'
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { GithubActionsTracer } from '../../src/tracer';
import { WorkflowJobs, WorkflowRun } from '../../src/github';

// renovate: datasource=docker depName=otel/opentelemetry-collector-contrib
const otelCollectorImage = "otel/opentelemetry-collector-contrib:0.87.0"

const DEBUG = false

describe('Integrate test', () => {
  let container: StartedTestContainer;
  let hostPort: number

  before(async () => {
    console.debug("Starting container...")
    container = await new GenericContainer(otelCollectorImage)
      .withExposedPorts({ host: 4318, container: 4318 })
      .withName("test-otel-col")
      .withCommand(["--config=/test-config.yaml"])
      .withBindMounts([{ source: path.join(__dirname, "test-config.yaml"), target: "/test-config.yaml", mode: "ro" }])
      .withWaitStrategy(Wait.forLogMessage("Everything is ready. Begin running and processing data."))
      .start();
    console.log("Container started")

    hostPort = container.getFirstMappedPort()
  });

  beforeEach(async () => {
  });
  after(async () => await container.stop())

  describe("GithubActionsTracer", () => {
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

    it('Tracer can output to OTEL collector', async () => {
      const githubActionsTracer = new GithubActionsTracer({
        serviceName: 'github_actions',
        otlpEndpoint: `http://localhost:${hostPort}/v1/traces`,
        debug: DEBUG
      })

      assert.doesNotThrow(async () => {
        githubActionsTracer.startWorkflowSpan(workflowRun)
        githubActionsTracer.addJobSpans(jobs)
        githubActionsTracer.endWorkflowSpan(workflowRun)
        await githubActionsTracer.shutdown()
      })
    });

    it('OTEL collector receive tracer', async () => {
      // Setup
      const githubActionsTracer = new GithubActionsTracer({
        serviceName: 'github_actions',
        otlpEndpoint: `http://localhost:${hostPort}/v1/traces`,
        debug: DEBUG
      })

      const startTimeSec = (new Date().getTime()) / 1000
      // Wait for each test to be split into independent logs.
      await setTimeout(1000)

      // Execute
      githubActionsTracer.startWorkflowSpan(workflowRun)
      githubActionsTracer.addJobSpans(jobs)
      githubActionsTracer.endWorkflowSpan(workflowRun)
      await githubActionsTracer.shutdown()

      // Assert
      const promise = new Promise(async (resolve, reject) => {
        (await container.logs({ since: startTimeSec }))
          .on("data", line => {
            if (DEBUG) console.log(line)

            if (line.match(/InstrumentationScope github_actions/)) {
              return resolve(true)
            }
          })
          .on("end", () => reject(new Error("Not found 'InstrumentationScope github_actions' in container logs")))
      })
      assert.doesNotReject(promise)
    })
  })
}); 
