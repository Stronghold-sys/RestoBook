# Script to add 'export const runtime = edge' to all route.ts files
$apiRoutes = Get-ChildItem -Path "src\app\api" -Recurse -Filter "route.ts"
$pageRoutes = Get-ChildItem -Path "src\app\customer\orders\[id]" -Filter "page.tsx" -ErrorAction SilentlyContinue

$allFiles = @()
$allFiles += $apiRoutes
if ($pageRoutes) { $allFiles += $pageRoutes }

foreach ($file in $allFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -notmatch "export const runtime") {
        $newContent = "export const runtime = 'edge';`r`n`r`n" + $content
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "Added: $($file.FullName)" -ForegroundColor Green
    } else {
        Write-Host "Skip: $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! All route files updated." -ForegroundColor Cyan
