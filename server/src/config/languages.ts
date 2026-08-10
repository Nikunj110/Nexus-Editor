// Centralized language configuration for code execution.
// Only lightweight alpine-based images are used to keep resource usage low.

export interface LanguageConfig {
    image: string;
    extension: string;
    command: (filepath: string) => string;
    // For languages that need a compile step before running
    compileCommand?: (filepath: string, outpath: string) => string;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
    javascript: {
        image: "node:20-alpine",
        extension: "js",
        command: (f) => `node ${f}`,
    },
    c: {
        image: "alpine-cpp",
        extension: "c",
        command: (f) => `gcc ${f} -o /tmp/out && /tmp/out`,
    },
    python: {
        image: "python:3.12-alpine",
        extension: "py",
        command: (f) => `python ${f}`,
    },
    cpp: {
        image: "alpine-cpp",
        extension: "cpp",
        command: (f) => `g++ ${f} -o /tmp/out && /tmp/out`,
    },
};

export const LANGUAGE_NAMES = Object.keys(SUPPORTED_LANGUAGES);

export function isLanguageSupported(language: string): boolean {
    return language in SUPPORTED_LANGUAGES;
}
