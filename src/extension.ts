// Import the VS Code extensibility API
import * as vscode from "vscode";
import * as fs from "fs";
import { exec } from "child_process";
import * as path from "path";
import * as winattr from "winattr";
import { promisify } from "util";
import {logGitCommand} from './gitLogger'
import { hideFolderInVSCode, hideFolderOnWindows } from "./folderHider";
// This function is called when your extension is activated
// Your extension is activated the first time the command is executed

interface gitData {
  mainBranch:string,
  branch:string,
  addedFiles:string[],
  untrackedChanges:boolean,
  committedFiles:string[],
  allCommitted:boolean,
}

export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  async function getGitInfo() {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && workspaceFolders.length > 0) {
      const currentDir = workspaceFolders[0].uri.fsPath;

      try {
        // Check if .git directory exists in the current directory
        const gitPath = path.join(currentDir, ".git");
        if (fs.existsSync(gitPath)) {
          // If the .git folder exists, parse git information
          const gitInfo = await parseGitInfo(currentDir);
          return gitInfo;
        } else {
          throw new Error("Not a Git repository");
        }
      } catch (error) {
        if (error instanceof Error) {
          vscode.window.showErrorMessage(
            `Error: ${error.message}`
          );
        } else {
          vscode.window.showErrorMessage(
            "An unknown error occurred while parsing Git info."
          );
        }
      }
    } else {
      vscode.window.showErrorMessage("No workspace folder is open.");
    }
  }

  // Register a command that is defined in the package.json
  // The commandId parameter must match the command field in package.json
  const showSuggestions = vscode.commands.registerCommand(
    "git-shortcuts.showSuggestions",
    async () => {
      // Code that gets executed when the command is invoke
      
        let terminal = vscode.window.activeTerminal;
        const gitInfo = await getGitInfo();

        const reccomendedations = generateReccomendations(gitInfo);
        
        if (reccomendedations) {
          vscode.window
            .showQuickPick(reccomendedations, {
              placeHolder: "Choose a Git command to run",
            })
            .then((selected) => {
              if (selected) {
                let terminal =
                  vscode.window.activeTerminal ||
                  vscode.window.createTerminal("Git Shortcuts");
                terminal.show();
                terminal.sendText(selected, false);
              }
            });
        }
        /*
        if(reccomendedations) {
          terminal?.sendText(
            `\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b`,
            false
          );
          terminal?.sendText(reccomendedations[suggestionIndex], false);
          if (reccomendedations.length > suggestionIndex) {
            suggestionIndex += 1;
          } 
        } else {
          vscode.window.showErrorMessage(
            `Reccomendations was empty`
          );
        }
        */
        //createGSFolder();
      }
  );

  // Add to a list of disposables which are disposed when this extension is deactivated
  context.subscriptions.push(showSuggestions);
}

function generateReccomendations(gitInfo:gitData|undefined) {
  
  if(!gitInfo) {
    return undefined;
  }

  let reccomendedations:string[] = [];

  if (gitInfo.untrackedChanges) {
    reccomendedations.push("git add .");
  } else if (gitInfo.allCommitted) {
      if (gitInfo.branch === gitInfo.mainBranch) {
        reccomendedations.splice(0, 0, `git push origin ${gitInfo.mainBranch}`);
        reccomendedations.splice(1, 0, `git pull origin ${gitInfo.mainBranch}`);
        reccomendedations.splice(2, 0, `git tag -a`);
      } else {
        reccomendedations.splice(0, 0, `git checkout ${gitInfo.mainBranch}`);
        reccomendedations.splice(1, 0, `git push origin ${gitInfo.branch}`);
        reccomendedations.splice(2, 0, `git fetch origin`);
      }
  } else {
    reccomendedations.splice(0, 0, `git commit -m "`);
    reccomendedations.splice(1, 0, `git status`);
    reccomendedations.splice(2, 0, `git diff --cached`);
    reccomendedations.splice(3, 0, `git stash`);    
  }

  return reccomendedations;
}

const execAsync = promisify(exec);

async function parseGitInfo(currentDir: string): Promise<gitData | undefined> {
  let mainBranch:string;
  let branch:string;
  let addedFiles:string[];
  let untrackedChanges:boolean = false;
  let committedFiles:string[];
  let allCommitted:boolean;

  try {
    // Get the current branch
    let result = await execAsync("git branch --show-current", {
      cwd: currentDir,
    });
    branch = result.stdout.trim();
    
    //get main branch
    result = await execAsync("git symbolic-ref refs/remotes/origin/HEAD", {
      cwd: currentDir,
    });

    const splitResult = result.stdout.split("/");
    mainBranch = splitResult[splitResult.length - 1];

    // Get the added files
    const statusResult = await execAsync("git status --short", {
      cwd: currentDir,
    });
    addedFiles = statusResult.stdout
      .split("\n")
      .filter((line) => line.startsWith("A "))
      .map((line) => line.substring(2).trim());

    // Get the committed files from the latest commit
    const commitResult = await execAsync(
      "git diff-tree --no-commit-id --name-only -r HEAD",
      {
        cwd: currentDir,
      }
    );
    committedFiles = commitResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const allCommittedResult = await execAsync("git status", {
      cwd: currentDir,
    });

    const splitAllCommittedResult = allCommittedResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    // Check for "nothing to commit" and untracked files
    const hasNothingToCommit = splitAllCommittedResult.some((line) =>
      line.includes("nothing to commit")
    );

    const hasUntrackedFiles = splitAllCommittedResult.some((line) =>
      line.includes("Untracked files")
    );

    if (hasNothingToCommit && !hasUntrackedFiles) {
      allCommitted = true;
      untrackedChanges = false;
    } else {
      allCommitted = false;
      untrackedChanges = hasUntrackedFiles;
    }

    let gitInfo: gitData = {
      mainBranch: mainBranch,
      branch: branch,
      addedFiles: addedFiles,
      untrackedChanges: untrackedChanges,
      committedFiles: committedFiles,
      allCommitted: allCommitted,
    };

    // Return the parsed information
    return gitInfo;
  } catch (error) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(
        `Error parsing Git info: ${error.message}`
      );
    } else {
      vscode.window.showErrorMessage(
        "An unknown error occurred while parsing Git info."
      );
    }

    return undefined;
  }
}

function checkForGSFolder():boolean {
  const workspaceFolders = vscode.workspace.workspaceFolders

  if (workspaceFolders && workspaceFolders.length > 0) {
    const rootPath: string = workspaceFolders[0].uri.fsPath;
    const gsFolderPath = path.join(rootPath, ".gs");

    if (fs.existsSync(gsFolderPath)) {
      console.log(`GS folder found at: ${gsFolderPath}`);
      return true;
    } else {
      console.log("GS folder not found.");
      return false;
    }
  } else {
    vscode.window.showErrorMessage("Must be within project directory to utilize git shortcuts");
    return false;
  }
}

function createGSFolder() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (workspaceFolders && workspaceFolders.length > 0) {
    const rootPath:string = workspaceFolders[0].uri.fsPath;
    const gsFolderPath = path.join(rootPath, '.gs');

    if (!fs.existsSync(gsFolderPath)) {
      fs.mkdirSync(gsFolderPath);
      hideFolderInVSCode(gsFolderPath);
      hideFolderOnWindows(gsFolderPath);
      vscode.window.showInformationMessage(
        `GS folder created at: ${gsFolderPath}`
      );
    }
  }
}

// This function is called when your extension is deactivated
export function deactivate() {}
