import { Router } from "express";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { SUPPORTED_LANGUAGES, isLanguageSupported } from "../config/languages.js";

import type { Request, Response } from "express";

const router = Router();

const EXECUTION_TIMEOUT = parseInt(process.env.DOCKER_EXECUTION_TIMEOUT || "10000", 10);
const MEMORY_LIMIT = process.env.DOCKER_MEMORY_LIMIT || "128m";

router.post("/", async (req: Request, res: Response) => {
    const { language, code, stdin } = req.body;

    // --- Validation ---
    if (!language || typeof language !== "string") {
        res.status(400).json({ error: "Missing or invalid 'language' field." });
        return;
    }
    if (!code || typeof code !== "string") {
        res.status(400).json({ error: "Missing or invalid 'code' field." });
        return;
    }
    if (!isLanguageSupported(language)) {
        res.status(400).json({
            error: `Unsupported language: '${language}'. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(", ")}`,
        });
        return;
    }

    const langConfig = SUPPORTED_LANGUAGES[language]!;
    const filename = `code.${langConfig.extension}`;
    const containerFilePath = `/tmp/${filename}`;

    // Create a temporary directory to hold the source code file
    let tmpDir: string | null = null;

    try {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-exec-"));
        const hostFilePath = path.join(tmpDir, filename);
        await fs.writeFile(hostFilePath, code, "utf-8");

        // Build docker run command arguments
        const dockerArgs = [
            "run",
            "-i",                            // Keep STDIN open even if not attached
            "--rm",                          // Auto-remove container after exit
            "--network", "none",             // No network access
            "--memory", MEMORY_LIMIT,        // Memory limit
            "--cpus", "0.5",                 // CPU limit
            "--pids-limit", "64",            // Process limit
            "--user", "1000:1000",           // Non-root user
            "--read-only",                   // Read-only root filesystem
            "--tmpfs", "/tmp:rw,exec,nosuid,size=64m",    // Writable /tmp, exec required for C/C++ binaries
            "--security-opt", "no-new-privileges",        // No privilege escalation
            "-v", `${hostFilePath}:${containerFilePath}:ro`,  // Mount code file read-only
            langConfig.image,
            "sh", "-c", langConfig.command(containerFilePath),
        ];

        const result = await runDocker(dockerArgs, EXECUTION_TIMEOUT, stdin);

        res.json({
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
        });
    } catch (error: any) {
        console.error("Execution error:", error);
        res.status(500).json({
            error: "Code execution failed.",
            stderr: error.message || "Internal server error",
            exitCode: 1,
            timedOut: false,
        });
    } finally {
        // Clean up the temporary directory
        if (tmpDir) {
            try {
                await fs.rm(tmpDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    }
});

interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
}

function runDocker(args: string[], timeoutMs: number, stdin?: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
        const child = execFile("docker", args, {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024, // 1MB output limit
            encoding: "utf-8",
        }, (error, stdout, stderr) => {
            if (error && (error as any).killed) {
                // Process was killed due to timeout
                resolve({
                    stdout: stdout || "",
                    stderr: "⏱️ Execution timed out. Your code took too long to run.\n" + (stderr || ""),
                    exitCode: 124,
                    timedOut: true,
                });
                return;
            }

            resolve({
                stdout: stdout || "",
                stderr: stderr || "",
                exitCode: error ? (error as any).code ?? 1 : 0,
                timedOut: false,
            });
        });

        // If standard input was provided, write it to the child process
        if (stdin) {
            child.stdin?.write(stdin);
            child.stdin?.end();
        }
    });
}

export default router;
