# Draw a small demo "plot" image and place it on the Windows clipboard so the
# recorder can exercise the Section Editor's clipboard image-paste feature.
# Run with: powershell -sta -File set-clipboard-image.ps1
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$w = 360
$h = 240
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::White)

# Axes
$axis = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120,120,120)), 2
$g.DrawLine($axis, 40, 200, 330, 200)
$g.DrawLine($axis, 40, 200, 40, 20)

# A simple rising curve
$curve = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(37,99,235)), 3
$points = @(
  (New-Object System.Drawing.Point 40,190),
  (New-Object System.Drawing.Point 100,150),
  (New-Object System.Drawing.Point 160,120),
  (New-Object System.Drawing.Point 220,70),
  (New-Object System.Drawing.Point 300,40)
)
$g.DrawLines($curve, $points)

# Data points
$dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220,38,38))
foreach ($p in $points) { $g.FillEllipse($dot, $p.X-4, $p.Y-4, 8, 8) }

# Title
$font = New-Object System.Drawing.Font 'Segoe UI', 12, ([System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30,30,30))
$g.DrawString('Growth Curve (OD600)', $font, $brush, 60, 8)

$g.Dispose()
[System.Windows.Forms.Clipboard]::SetImage($bmp)
Write-Output 'clipboard-image-set'
