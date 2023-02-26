import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"
import { retry } from '@octokit/plugin-retry'

export type WorkflowRun = RestEndpointMethodTypes["actions"]["getWorkflowRun"]["response"]["data"]
export type WorkflowJobs = RestEndpointMethodTypes["actions"]["listJobsForWorkflowRun"]["response"]["data"]["jobs"]

export class GithubClient {
  private octokit: Octokit
  constructor(options: {token?: string, octokit?: Octokit}) {
    if (options.octokit) {
      this.octokit = options.octokit
    } else if (options.token) {
      const MyOctokit = Octokit.plugin(retry)
      this.octokit = new MyOctokit({ auth: options.token })
    } else {
      throw new Error("token or octokit is required")
    }
  }

  async fetchWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun> {
    const workflowRun = await this.octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId
    })
    return workflowRun.data
  }

  async fetchWorkflowJobs(owner: string, repo: string, runId: number): Promise<WorkflowJobs> {
    const jobs = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId
    })
    return jobs.data.jobs
  }
}
