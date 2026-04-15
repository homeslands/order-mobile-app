#!/usr/bin/env bash
#
# QA Transition Frame Analysis — Đếm số frame trong transition từ video 60fps.
#
# Cách dùng:
#   ./scripts/qa-transition-frame-analysis.sh <video.mp4>
#
# Yêu cầu: ffmpeg
#
# Logic: Trích xuất tất cả frame → đếm frame giữa 2 lần thay đổi mạnh (transition start/end).
# Cách đơn giản hơn: trích N frame đầu, user đánh dấu frame bắt đầu/kết thúc transition.
#

set -e

VIDEO="$1"
OUTPUT_DIR="${2:-./qa-transition-frames}"

if [ -z "$VIDEO" ] || [ ! -f "$VIDEO" ]; then
  echo "Usage: $0 <video.mp4> [output_dir]"
  echo ""
  echo "Extracts frames from video for manual transition duration analysis."
  echo "At 60fps: 120ms ≈ 7-8 frames. At 30fps: 120ms ≈ 4 frames."
  echo ""
  echo "Example:"
  echo "  ./scripts/qa-transition-frame-analysis.sh transition.mp4"
  exit 1
fi

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
  echo "Error: ffmpeg not found. Install: brew install ffmpeg"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Get video info
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "$VIDEO" 2>/dev/null | head -1)
echo "Video: $VIDEO"
echo "FPS: $FPS"
echo "Output: $OUTPUT_DIR"
echo ""

# Extract frames (60fps → 60 frames/sec; we extract all for manual review)
# Limit to first 5 seconds to avoid huge output
echo "Extracting frames (first 5 seconds)..."
ffmpeg -i "$VIDEO" -t 5 -vf "fps=60" -q:v 2 "$OUTPUT_DIR/frame_%04d.png" -y 2>/dev/null || \
ffmpeg -i "$VIDEO" -t 5 -vf "fps=30" -q:v 2 "$OUTPUT_DIR/frame_%04d.png" -y 2>/dev/null

COUNT=$(ls -1 "$OUTPUT_DIR"/frame_*.png 2>/dev/null | wc -l)
echo "Extracted $COUNT frames to $OUTPUT_DIR/"
echo ""
echo "Manual analysis:"
echo "  1. Open frames in order (frame_0001.png, frame_0002.png, ...)"
echo "  2. Find first frame where transition STARTS (screen begins sliding)"
echo "  3. Find first frame where transition ENDS (screen fully visible)"
echo "  4. Count frames between them"
echo ""
echo "Expected: 7-8 frames at 60fps for 120ms transition"
echo "          (120ms / 16.67ms per frame ≈ 7.2 frames)"
