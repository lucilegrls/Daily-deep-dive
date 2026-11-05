param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = 'Stop'

if (-not $env:SOURCE_DATABASE_URL) {
  throw 'SOURCE_DATABASE_URL is required in the current process and must never be committed.'
}

$supabase = Get-Command supabase -ErrorAction Stop
$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Path $resolvedDestination -Force | Out-Null

& $supabase.Source db dump --db-url $env:SOURCE_DATABASE_URL --role-only -f (Join-Path $resolvedDestination 'roles.sql')
if ($LASTEXITCODE -ne 0) { throw 'Role backup failed.' }

& $supabase.Source db dump --db-url $env:SOURCE_DATABASE_URL -f (Join-Path $resolvedDestination 'schema.sql')
if ($LASTEXITCODE -ne 0) { throw 'Schema backup failed.' }

& $supabase.Source db dump --db-url $env:SOURCE_DATABASE_URL --use-copy --data-only -f (Join-Path $resolvedDestination 'data.sql')
if ($LASTEXITCODE -ne 0) { throw 'Data backup failed.' }

Get-ChildItem -LiteralPath $resolvedDestination -File |
  Get-FileHash -Algorithm SHA256 |
  Select-Object Path, Hash |
  Export-Csv -NoTypeInformation -Encoding utf8 (Join-Path $resolvedDestination 'SHA256SUMS.csv')

Write-Host "Backup completed at $resolvedDestination"
