import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export class AppLogger {
  readonly #logPath: string;

  public constructor(userDataPath: string) {
    this.#logPath = join(userDataPath, "logs", "main.log");
  }

  public async info(event: string): Promise<void> {
    await this.#write("INFO", event);
  }

  public async error(event: string, error: unknown): Promise<void> {
    const summary = error instanceof Error ? error.message : "Unknown error";
    await this.#write("ERROR", `${event}: ${summary}`);
  }

  async #write(level: string, message: string): Promise<void> {
    try {
      await mkdir(dirname(this.#logPath), { recursive: true });
      await appendFile(
        this.#logPath,
        `${new Date().toISOString()} ${level} ${message}\n`,
        "utf8",
      );
    } catch {
      // Logging must never block project work.
    }
  }
}
