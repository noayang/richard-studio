Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 1) try bitmap
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($null -ne $img) {
    $img.Save("C:\Users\admin\renpy-studio\build\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output ("SAVED " + $img.Width + "x" + $img.Height)
    exit 0
}

# 2) try file drop list (image copied as a file)
$files = [System.Windows.Forms.Clipboard]::GetFileDropList()
if ($files -and $files.Count -gt 0) {
    foreach ($f in $files) {
        Write-Output ("FILE " + $f)
    }
    exit 0
}

# 3) try text (maybe a path)
try {
    $txt = [System.Windows.Forms.Clipboard]::GetText()
    if ($txt) { Write-Output ("TEXT " + $txt) }
} catch {}

Write-Output "NOTHING"
