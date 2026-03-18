$env:ELECTRON_RUN_AS_NODE = $null
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath "$PSScriptRoot\node_modules\electron\dist\electron.exe" -ArgumentList "." -WorkingDirectory $PSScriptRoot
