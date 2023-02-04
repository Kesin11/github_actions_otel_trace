import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
})

export async function fetchWorkflowRun(owner: string, repo: string, runId: number) {
  const workflowRun = await octokit.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId
  })
  return workflowRun.data
}

export async function fetchWorkflowJobs(owner: string, repo: string, runId: number) {
  const jobs = await octokit.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId
  })
  return jobs.data.jobs
}
