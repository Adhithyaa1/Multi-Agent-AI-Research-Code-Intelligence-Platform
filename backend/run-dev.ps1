# Dev server — excludes data/ from file watching so GitHub clones don't restart uvicorn.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
    Write-Error "Create the venv first: python -m venv .venv"
}

. .venv\Scripts\Activate.ps1

# Single-quoted patterns prevent PowerShell from expanding data/* into file paths.
uvicorn main:app --reload --port 8000 --reload-exclude 'data'
