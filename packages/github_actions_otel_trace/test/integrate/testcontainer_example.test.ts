import { setTimeout } from 'node:timers/promises';
import { describe, before, after, it } from "node:test"
import assert from "node:assert/strict"
import { GenericContainer, StartedTestContainer } from "testcontainers";

describe("GenericContainer", () => {
  let container: StartedTestContainer;
  let hostPort: number

  before(async () => {
    console.log("Starting container...")
    container = await new GenericContainer("nginx")
      .withExposedPorts(80)
      .withName("testcontainer")
      .start();
    console.log("Container started")

    // (await container.logs()).on("data", line => console.log(line))

    hostPort = container.getFirstMappedPort()
  });

  after(async () => {
    await container.stop();
  });

  it("container exec", async () => {
    const { output, exitCode } = await container.exec(["echo", "foobar"]);
    assert.equal(output, "foobar\n");
    assert.equal(exitCode, 0);
  });

  it("fetch localhost", async () => {
    const res = await fetch(`http://localhost:${hostPort}`)
    assert.equal(res.status, 200)
    assert.ok(res.body)
  });

  it("docker log", async () => {
    const startTimeSec = (new Date().getTime()) / 1000
    // Wait for each test to be split into independent logs.
    await setTimeout(1000)

    const res = await fetch(`http://localhost:${hostPort}`);

    const promise = new Promise(async (resolve, reject) => {
      (await container.logs({ since: startTimeSec }))
        .on("data", line => {
          // console.log(line)
          if (line.match(/GET/)) {
            return resolve(true)
          }
        })
        .on("end", () => reject(new Error("Not found GET log")))
    })
    assert.doesNotReject(promise)
  });
});
