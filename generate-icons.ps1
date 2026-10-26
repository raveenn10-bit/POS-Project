# PowerShell script to generate Harsh Apex POS branding and favicons
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BrandingProcessor {
    public static void Process(string sourcePath, string outputDir) {
        if (!File.Exists(sourcePath)) {
            throw new FileNotFoundException("Source file not found: " + sourcePath);
        }

        Directory.CreateDirectory(outputDir);

        using (Bitmap src = new Bitmap(sourcePath)) {
            // 1. Create clean 1024x1024 master
            using (Bitmap master1024 = new Bitmap(1024, 1024, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(master1024)) {
                    g.Clear(Color.White);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.CompositingQuality = CompositingQuality.HighQuality;

                    using (ImageAttributes wrapMode = new ImageAttributes()) {
                        wrapMode.SetWrapMode(WrapMode.TileFlipXY);
                        g.DrawImage(src, new Rectangle(0, 0, 1024, 1024), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel, wrapMode);
                    }
                }

                // Clean up near-white pixels (JPEG compression artifacts) to pure white (#FFFFFF)
                BitmapData data = master1024.LockBits(new Rectangle(0, 0, 1024, 1024), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                int byteCount = Math.Abs(data.Stride) * data.Height;
                byte[] pixels = new byte[byteCount];
                Marshal.Copy(data.Scan0, pixels, 0, byteCount);
                for (int i = 0; i < byteCount; i += 4) {
                    byte b = pixels[i];
                    byte g = pixels[i + 1];
                    byte r = pixels[i + 2];
                    if (r >= 250 && g >= 250 && b >= 250) {
                        pixels[i] = 255;
                        pixels[i + 1] = 255;
                        pixels[i + 2] = 255;
                        pixels[i + 3] = 255;
                    }
                }
                Marshal.Copy(pixels, 0, data.Scan0, byteCount);
                master1024.UnlockBits(data);

                // Save harsh-apex-logo.png (1024x1024 master)
                string logoPath = Path.Combine(outputDir, "harsh-apex-logo.png");
                master1024.Save(logoPath, ImageFormat.Png);
                Console.WriteLine("Generated master logo: " + logoPath);

                // Helper to resize with high quality
                Func<int, Bitmap> resize = (int size) => {
                    Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
                    using (Graphics g = Graphics.FromImage(bmp)) {
                        g.Clear(Color.White);
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        g.CompositingQuality = CompositingQuality.HighQuality;

                        using (ImageAttributes wrapMode = new ImageAttributes()) {
                            wrapMode.SetWrapMode(WrapMode.TileFlipXY);
                            g.DrawImage(master1024, new Rectangle(0, 0, size, size), 0, 0, 1024, 1024, GraphicsUnit.Pixel, wrapMode);
                        }
                    }
                    return bmp;
                };

                // Generate individual PNG files
                using (Bitmap b512 = resize(512)) {
                    b512.Save(Path.Combine(outputDir, "icon-512.png"), ImageFormat.Png);
                }
                using (Bitmap b192 = resize(192)) {
                    b192.Save(Path.Combine(outputDir, "icon-192.png"), ImageFormat.Png);
                    b192.Save(Path.Combine(outputDir, "icon.png"), ImageFormat.Png);
                }
                using (Bitmap b180 = resize(180)) {
                    b180.Save(Path.Combine(outputDir, "apple-touch-icon.png"), ImageFormat.Png);
                }
                using (Bitmap b96 = resize(96)) {
                    b96.Save(Path.Combine(outputDir, "favicon-96x96.png"), ImageFormat.Png);
                }

                using (Bitmap b48 = resize(48))
                using (Bitmap b32 = resize(32))
                using (Bitmap b16 = resize(16)) {
                    b48.Save(Path.Combine(outputDir, "favicon-48x48.png"), ImageFormat.Png);
                    b32.Save(Path.Combine(outputDir, "favicon-32x32.png"), ImageFormat.Png);
                    b16.Save(Path.Combine(outputDir, "favicon-16x16.png"), ImageFormat.Png);

                    // Multi-size favicon.ico
                    SaveIco(new Bitmap[] { b16, b32, b48 }, Path.Combine(outputDir, "favicon.ico"));
                }
            }
        }
    }

    private static byte[] CreateIcoEntry(Bitmap bmp) {
        int width = bmp.Width;
        int height = bmp.Height;
        int maskRowStride = ((width + 31) / 32) * 4;
        int maskSize = maskRowStride * height;

        using (MemoryStream ms = new MemoryStream())
        using (BinaryWriter bw = new BinaryWriter(ms)) {
            // BITMAPINFOHEADER (40 bytes)
            bw.Write((uint)40); // biSize
            bw.Write((int)width); // biWidth
            bw.Write((int)(height * 2)); // biHeight (XOR mask height + AND mask height)
            bw.Write((ushort)1); // biPlanes
            bw.Write((ushort)32); // biBitCount
            bw.Write((uint)0); // biCompression = BI_RGB
            bw.Write((uint)(width * height * 4 + maskSize)); // biSizeImage
            bw.Write((int)0); // biXPelsPerMeter
            bw.Write((int)0); // biYPelsPerMeter
            bw.Write((uint)0); // biClrUsed
            bw.Write((uint)0); // biClrImportant

            // XOR mask (bottom-to-top, 32-bit BGRA)
            for (int y = height - 1; y >= 0; y--) {
                for (int x = 0; x < width; x++) {
                    Color c = bmp.GetPixel(x, y);
                    bw.Write(c.B);
                    bw.Write(c.G);
                    bw.Write(c.R);
                    bw.Write(c.A);
                }
            }

            // AND mask (bottom-to-top, 1-bit per pixel, 0 = opaque, 1 = transparent)
            byte[] maskRow = new byte[maskRowStride];
            for (int y = height - 1; y >= 0; y--) {
                Array.Clear(maskRow, 0, maskRow.Length);
                for (int x = 0; x < width; x++) {
                    Color c = bmp.GetPixel(x, y);
                    if (c.A == 0) {
                        maskRow[x / 8] |= (byte)(0x80 >> (x % 8));
                    }
                }
                bw.Write(maskRow);
            }

            return ms.ToArray();
        }
    }

    public static void SaveIco(Bitmap[] bitmaps, string outputPath) {
        byte[][] entries = new byte[bitmaps.Length][];
        for (int i = 0; i < bitmaps.Length; i++) {
            entries[i] = CreateIcoEntry(bitmaps[i]);
        }

        using (FileStream fs = new FileStream(outputPath, FileMode.Create))
        using (BinaryWriter bw = new BinaryWriter(fs)) {
            bw.Write((ushort)0); // Reserved
            bw.Write((ushort)1); // Type 1 = Icon
            bw.Write((ushort)bitmaps.Length); // Image count

            int offset = 6 + (16 * bitmaps.Length);
            for (int i = 0; i < bitmaps.Length; i++) {
                Bitmap b = bitmaps[i];
                bw.Write((byte)(b.Width >= 256 ? 0 : b.Width));
                bw.Write((byte)(b.Height >= 256 ? 0 : b.Height));
                bw.Write((byte)0); // Colors
                bw.Write((byte)0); // Reserved
                bw.Write((ushort)1); // Color planes
                bw.Write((ushort)32); // Bits per pixel
                bw.Write((uint)entries[i].Length); // Size of entry in bytes
                bw.Write((uint)offset); // Offset of image data
                offset += entries[i].Length;
            }

            for (int i = 0; i < bitmaps.Length; i++) {
                bw.Write(entries[i]);
            }
        }
        Console.WriteLine("Generated multi-size favicon.ico: " + outputPath);
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$source = "C:/Users/USER/.gemini/antigravity/brain/60e4c26d-60d3-42eb-9276-515096651bf1/.user_uploaded/media_1793036509811.jpg"
$destDir = "f:\pos web app"

[BrandingProcessor]::Process($source, $destDir)
Write-Host "Branding processing completed successfully!"
