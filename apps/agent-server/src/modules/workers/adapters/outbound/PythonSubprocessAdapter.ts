import { spawn } from "node:child_process";
import type { IPythonSubprocess } from "../../ports/outbound/IPythonSubprocess";

export class PythonSubprocessAdapter implements IPythonSubprocess {
  async run<TInput, TOutput>(scriptPath: string, input: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn("python", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Python subprocess exited with code ${code}.`));
          return;
        }

        try {
          resolve(JSON.parse(stdout) as TOutput);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(JSON.stringify(input));
    });
  }
}
