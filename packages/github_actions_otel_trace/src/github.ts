import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"

export type WorkflowRun = RestEndpointMethodTypes["actions"]["getWorkflowRun"]["response"]["data"]
export type WorkflowJobs = RestEndpointMethodTypes["actions"]["listJobsForWorkflowRun"]["response"]["data"]["jobs"]

export class GithubClient {
  private octokit: Octokit
  constructor(token: string) {
    this.octokit = new Octokit({ auth: token })
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
