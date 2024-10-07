import { exec } from "child_process";
import * as fs from 'fs'
import * as path from "path";
import * as vscode from "vscode";
import * as fswin from "fswin";

export function hideFolderOnWindows(repoPath: string) {
  const vbsScript = `
Set objFSO = CreateObject("Scripting.FileSystemObject")
Set folder = objFSO.GetFolder("${repoPath}")
folder.Attributes = folder.Attributes + 2
`;

  const vbsFilePath = path.join(repoPath, "setHidden.vbs");
  fs.writeFileSync(vbsFilePath, vbsScript);

  const command = `cscript.exe //Nologo "${vbsFilePath}"`;

  exec(command, (err, stdout, stderr) => {
    fs.unlinkSync(vbsFilePath); // Clean up the VBS file
    if (err) {
      vscode.window.showErrorMessage(
        `Failed to hide folder on Windows: ${err.message}`
      );
      console.error(`Error: ${err.message}`);
    } else {
      vscode.window.showInformationMessage(
        `Folder is now hidden.`
      );
      console.log(`Success: ${stdout}`);
    }
  });
}

export function hideFolderInVSCode(repoPath: string) {
  const folderName = ".gs";
  const config = vscode.workspace.getConfiguration("files", vscode.Uri.file(repoPath));
  const currentExclusions =
    config.get<{ [key: string]: boolean }>("exclude") || {};

  if (!(folderName in currentExclusions)) {
    const newExclusions = { ...currentExclusions, [`**/${folderName}`]: true };
    config.update(
      "exclude",
      newExclusions,
      vscode.ConfigurationTarget.WorkspaceFolder
    );
  }
}
