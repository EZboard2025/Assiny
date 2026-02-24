[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$WshShell = New-Object -ComObject WScript.Shell

$electronExe = "C:\Users\ADM\OneDrive\Documentos\Ramppy plataforma dev gabriel\Assiny\desktop\node_modules\electron\dist\electron.exe"
$workingDir  = "C:\Users\ADM\OneDrive\Documentos\Ramppy plataforma dev gabriel\Assiny\desktop"
$iconPath    = "C:\Users\ADM\OneDrive\Documentos\Ramppy plataforma dev gabriel\Assiny\desktop\assets\icon.ico"

# Get actual Desktop path from system
$desktopDir = [Environment]::GetFolderPath('Desktop')

# Desktop shortcut
$desktopPath = Join-Path $desktopDir "Ramppy.lnk"
$shortcut = $WshShell.CreateShortcut($desktopPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = "."
$shortcut.WorkingDirectory = $workingDir
$shortcut.IconLocation = "$iconPath, 0"
$shortcut.Description = "Ramppy - Plataforma de vendas com IA"
$shortcut.Save()
Write-Host "Desktop shortcut created: $desktopPath"

# Start Menu shortcut
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$startMenuPath = Join-Path $startMenuDir "Ramppy.lnk"
$shortcut2 = $WshShell.CreateShortcut($startMenuPath)
$shortcut2.TargetPath = $electronExe
$shortcut2.Arguments = "."
$shortcut2.WorkingDirectory = $workingDir
$shortcut2.IconLocation = "$iconPath, 0"
$shortcut2.Description = "Ramppy - Plataforma de vendas com IA"
$shortcut2.Save()
Write-Host "Start Menu shortcut created: $startMenuPath"

Write-Host "Done!"
