# Tree-kill any leftover isolated Extension Development Host windows started by
# the recorder (identified by the temporary "labnote-edh-*" user-data dir).
# Only touches those isolated instances, never the user's real editor.
$procs = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like '*labnote-edh*' -and $_.CommandLine -notlike '*--type=*'
}
foreach ($p in $procs) {
  Write-Output ("treekill " + $p.ProcessId)
  & taskkill /T /F /PID $p.ProcessId 2>&1 | Out-Null
}
Start-Sleep -Seconds 2
$remain = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*labnote-edh*' }
if ($remain) {
  # Kill any stragglers directly.
  foreach ($p in $remain) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  $remain2 = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*labnote-edh*' }
  if ($remain2) { Write-Output ("REMAINING: " + ($remain2.ProcessId -join ',')) }
  else { Write-Output "ALL EDH CLEANED" }
} else {
  Write-Output "ALL EDH CLEANED"
}
