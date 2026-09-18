Add-Type -AssemblyName System.Drawing

function Generate-Icon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#1b382b'))

    $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f59e0b'))
    $cx = [float]($size / 2)

    # Top tier
    $p1 = [System.Drawing.PointF]::new($cx, [float]($size * 0.16))
    $p2 = [System.Drawing.PointF]::new([float]($cx - $size * 0.18), [float]($size * 0.38))
    $p3 = [System.Drawing.PointF]::new([float]($cx + $size * 0.18), [float]($size * 0.38))
    $g.FillPolygon($goldBrush, @($p1, $p2, $p3))

    # Middle tier
    $p4 = [System.Drawing.PointF]::new($cx, [float]($size * 0.32))
    $p5 = [System.Drawing.PointF]::new([float]($cx - $size * 0.26), [float]($size * 0.56))
    $p6 = [System.Drawing.PointF]::new([float]($cx + $size * 0.26), [float]($size * 0.56))
    $g.FillPolygon($goldBrush, @($p4, $p5, $p6))

    # Bottom tier
    $p7 = [System.Drawing.PointF]::new($cx, [float]($size * 0.48))
    $p8 = [System.Drawing.PointF]::new([float]($cx - $size * 0.34), [float]($size * 0.74))
    $p9 = [System.Drawing.PointF]::new([float]($cx + $size * 0.34), [float]($size * 0.74))
    $g.FillPolygon($goldBrush, @($p7, $p8, $p9))

    # Trunk
    $trunkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#b45309'))
    $tw = [float]($size * 0.12)
    $th = [float]($size * 0.14)
    $tx = [float]($cx - $tw / 2)
    $ty = [float]($size * 0.74)
    $g.FillRectangle($trunkBrush, $tx, $ty, $tw, $th)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $path ($size x $size)"
}

Generate-Icon 192 "public/icons/icon-192x192.png"
Generate-Icon 512 "public/icons/icon-512x512.png"
