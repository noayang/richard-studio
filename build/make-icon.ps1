Add-Type -AssemblyName System.Drawing

$src = "C:\Users\admin\Desktop\F227FD01-9A54-414F-9805-3AEFC29C166B.PNG"
$png256 = "C:\Users\admin\renpy-studio\build\icon-256.png"
$icoOut = "C:\Users\admin\renpy-studio\build\icon.ico"

$srcImg = [System.Drawing.Image]::FromFile($src)
Write-Output ("SOURCE " + $srcImg.Width + "x" + $srcImg.Height)

function New-Resized($img, $w, $h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()
    return $bmp
}

# 256x256 PNG
$b256 = New-Resized $srcImg 256 256
$b256.Save($png256, [System.Drawing.Imaging.ImageFormat]::Png)
$srcImg.Dispose()

# Build a multi-size ICO (16/32/48/64/128/256), small sizes as 32bpp BMP, 256 as PNG
$sizes = @(16, 32, 48, 64, 128, 256)
$entries = New-Object System.Collections.Generic.List[System.Object]
$images = New-Object System.Collections.Generic.List[System.Object]
$pngData = $null

foreach ($s in $sizes) {
    $bmp = New-Resized $b256 $s $s
    $ms = New-Object System.IO.MemoryStream
    if ($s -eq 256) {
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $data = $ms.ToArray()
    } else {
        # write 32bpp BMP with alpha (BITMAPINFOHEADER, height*2, BGRA bottom-up)
        $bmpData = $bmp.LockBits((New-Object System.Drawing.Rectangle(0,0,$s,$s)), [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $stride = $bmpData.Stride
        $bytes = New-Object byte[] ($stride * $s)
        [System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $bytes, 0, $bytes.Length)
        $bmp.UnlockBits($bmpData)
        # BITMAPINFOHEADER (40 bytes) + pixel data
        $ms2 = New-Object System.IO.MemoryStream
        $bw = New-Object System.IO.BinaryWriter($ms2)
        $bw.Write([UInt32]40)                      # biSize
        $bw.Write([Int32]$s)                       # width
        $bw.Write([Int32]($s * 2))                 # height (XOR + AND mask)
        $bw.Write([UInt16]1)                       # planes
        $bw.Write([UInt16]32)                      # bitcount
        $bw.Write([UInt32]0)                       # compression
        $bw.Write([UInt32]($bytes.Length))         # image size
        $bw.Write([Int32]0); $bw.Write([Int32]0)   # res
        $bw.Write([UInt32]0); $bw.Write([UInt32]0) # colors
        $bw.Write($bytes)                          # pixel data (bottom-up BGRA)
        # AND mask (1 bit per pixel, padded to 32-bit rows) — all zeros (opaque)
        $andStride = [int]((($s + 31) / 32) * 4)
        $andBytes = New-Object byte[] ($andStride * $s)
        $bw.Write($andBytes)
        $bw.Close()
        $data = $ms2.ToArray()
        $ms2.Dispose()
    }
    $entries.Add(@{ s = $s; data = $data })
    $ms.Dispose()
    $bmp.Dispose()
}
$b256.Dispose()

# Write ICO file
$fs = [System.IO.File]::Create($icoOut)
$bw2 = New-Object System.IO.BinaryWriter($fs)
$bw2.Write([UInt16]0)              # reserved
$bw2.Write([UInt16]1)              # type icon
$bw2.Write([UInt16]$entries.Count) # count
$offset = 6 + 16 * $entries.Count
foreach ($e in $entries) {
    $s = $e.s
    if ($s -ge 256) { $b = 0 } else { $b = $s }
    $bw2.Write([byte]$b)                    # width
    $bw2.Write([byte]$b)                    # height
    $bw2.Write([byte]0)                     # palette
    $bw2.Write([byte]0)                     # reserved
    $bw2.Write([UInt16]1)                   # planes
    $bw2.Write([UInt16]32)                  # bitcount
    $bw2.Write([UInt32]$e.data.Length)      # size
    $bw2.Write([UInt32]$offset)             # offset
    $offset += $e.data.Length
}
foreach ($e in $entries) {
    $bw2.Write($e.data)
}
$bw2.Close()

Write-Output ("ICO_WRITTEN " + (Get-Item $icoOut).Length + " bytes, " + $entries.Count + " sizes")
