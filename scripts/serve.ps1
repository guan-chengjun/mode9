# Zero-dependency static file server based on .NET HttpListener
# Usage: .\scripts\serve.ps1 [-Port 8080]
param(
    [int]$Port = 8080
)

$root = Split-Path -Parent $PSScriptRoot
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Failed to bind port $Port. Try: .\scripts\serve.ps1 -Port 9000" -ForegroundColor Red
    exit 1
}

$mimes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.glb'  = 'model/gltf-binary'
    '.gltf' = 'model/gltf+json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff2'= 'font/woff2'
}

Write-Host ""
Write-Host "  3D Hydraulic Press demo server started" -ForegroundColor Cyan
Write-Host "  Root:  $root"
Write-Host "  URL:   $prefix" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop"
Write-Host ""

try { Start-Process $prefix | Out-Null } catch {}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }

    $rawUrl = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    $relPath = $rawUrl.TrimStart('/')
    if ([string]::IsNullOrEmpty($relPath)) { $relPath = 'index.html' }

    $filePath = Join-Path $root $relPath
    if ((Test-Path $filePath) -and -not (Get-Item $filePath).PSIsContainer) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ctx.Response.ContentType = $mime
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host "200  $rawUrl" -ForegroundColor DarkGray
    } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rawUrl")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
        Write-Host "404  $rawUrl" -ForegroundColor Yellow
    }
    $ctx.Response.OutputStream.Close()
}

$listener.Stop()
Write-Host "Server stopped" -ForegroundColor Cyan
