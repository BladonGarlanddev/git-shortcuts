import * as fs from "fs";
import * as path from "path";

export function logGitCommand(command: string, repoPath: string) {
  const logFolderPath = path.join(repoPath, ".git-command-log");
  if (!fs.existsSync(logFolderPath)) {
    fs.mkdirSync(logFolderPath);
  }
  const logFilePath = path.join(logFolderPath, "git-commands.log");
  const logEntry = `${new Date().toISOString()} - ${command}\n`;
  fs.appendFileSync(logFilePath, logEntry);
}
