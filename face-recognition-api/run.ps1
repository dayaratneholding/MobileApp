# ZKBio sets PYTHONHOME machine-wide, which breaks every other Python.
Remove-Item Env:\PYTHONHOME -ErrorAction SilentlyContinue

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Error "Virtual environment is missing. From this folder run: py -3.13 -m venv .venv after clearing PYTHONHOME."
    exit 1
}

& $python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
