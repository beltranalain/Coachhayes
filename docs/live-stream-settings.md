# Live Stream Quality — Settings for Coach

The website and app show **exactly** what you stream to YouTube — we don't change
or lower it. So the way to make the stream look sharp everywhere is to improve it
at the source (your streaming setup). Here's the short version.

## The settings that matter (in your encoder: OBS / Streamlabs / YouTube app)

| Setting | Use this | Why |
|---|---|---|
| **Resolution** | 1920×1080 (1080p) | Sharpest that YouTube serves to most viewers |
| **Frame rate** | 30 fps (60 if you have the upload for it) | Smooth motion |
| **Video bitrate** | 6,000–9,000 kbps | The #1 thing people *see*. Low bitrate = blocky/soft |
| **Encoder** | Hardware (NVENC / Apple / AMD) if available, else x264 "veryfast" | Better quality for the same CPU |
| **Keyframe interval** | 2 seconds | YouTube requires this |
| **Audio bitrate** | 128–160 kbps | Clear voice |

## The thing that quietly ruins quality: upload speed
Even perfect settings look bad on a weak connection. You need a **stable 10+ Mbps
upload** (not download — upload).
- **Use a wired/Ethernet connection** if at all possible. Wi-Fi drops cause the
  stream to downgrade mid-show.
- Test at [fast.com](https://fast.com) → click "Show more info" → look at **upload**.
- If upload is under ~6 Mbps, drop the video bitrate to ~4,500 kbps so it stays
  stable instead of stuttering.

## Quick wins in order
1. **Raise the video bitrate** to 6,000–9,000 kbps. Biggest visible jump.
2. **Go wired** (Ethernet) instead of Wi-Fi. Kills the mid-show quality drops.
3. **Stream at 1080p** if you aren't already.
4. **Good lighting + a decent camera** — a webcam in a dark room looks soft no
   matter the bitrate.

## What viewers can do on their end
- Tap the **gear icon** on the player to pick a higher quality manually.
- On bad Wi-Fi, YouTube lowers quality on purpose to avoid buffering — that's
  the viewer's connection, not the stream.

---
*We can't make the stream look better than what's sent to YouTube — these
settings are where real quality comes from.*
