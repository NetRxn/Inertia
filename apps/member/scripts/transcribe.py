#!/usr/bin/env python3
"""Transcribe a meeting recording locally with open-source Whisper, for upload to Inertia.

Runs entirely on your machine: nothing is sent anywhere. Any audio or video
format ffmpeg can read works (mp3, m4a, wav, mp4, webm, ...). The output is a
Markdown transcript with timestamps that Inertia reads as a meeting:

    pip install faster-whisper          # once; ffmpeg must be installed too
    python3 scripts/transcribe.py recording.m4a --title "Roundtable 2026-10-28"
    # -> recording.transcript.md, then Org → Data → drop it in (or setup-org.ts --file)

With --post it also sends the transcript to the app's ingest endpoint, so it
appears in Org → Data without an upload. It reads MEMBER_APP_BASE_URL and
MEMBER_APP_INGEST_TOKEN from the environment. A transcript a meeting tool
already made (.vtt, .srt, .txt, .md; e.g. Google Meet or Zoom) skips Whisper:

    python3 scripts/transcribe.py meet-transcript.vtt --title "Roundtable 2026-10-28" --post

Model sizes: tiny, base, small (default, good on a laptop CPU), medium,
large-v3-turbo (best; use a GPU). The model downloads once on first use.
Speaker names are not guessed: lines are timestamped, and a person can add
names before uploading.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

TRANSCRIPT_EXTENSIONS = (".vtt", ".srt", ".txt", ".md", ".markdown")


def to_wav(source: str, target: str) -> None:
    """16 kHz mono WAV, the input Whisper expects."""
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is not installed. Install it first (brew install ffmpeg / apt install ffmpeg).")
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", source, "-ac", "1", "-ar", "16000", target],
        check=True,
    )


def clock(seconds: float) -> str:
    seconds = int(seconds)
    h, rest = divmod(seconds, 3600)
    m, s = divmod(rest, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def transcribe(wav: str, model_size: str, language: str | None):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed. Run: pip install faster-whisper")
    model = WhisperModel(model_size, device="auto", compute_type="auto")
    segments, info = model.transcribe(wav, language=language, vad_filter=True)
    return info, list(segments)


def transcript_text(raw: str) -> str:
    """Drops WebVTT/SRT headers, cue numbers and timing lines, keeping what was said."""
    keep = [
        line for line in raw.replace("\r\n", "\n").split("\n")
        if not line.startswith("WEBVTT") and not line.startswith("NOTE")
        and not re.fullmatch(r"\s*\d+\s*", line) and "-->" not in line
    ]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(keep)).strip()


def post(title: str, text: str, origin: str) -> None:
    """Sends the transcript to the member app as a meeting (POST /api/org/ingest)."""
    base = os.environ.get("MEMBER_APP_BASE_URL", "").rstrip("/")
    token = os.environ.get("MEMBER_APP_INGEST_TOKEN", "")
    if not base or not token:
        sys.exit("--post needs MEMBER_APP_BASE_URL and MEMBER_APP_INGEST_TOKEN in the environment.")
    body = json.dumps({"kind": "meeting", "title": title, "text": text, "origin": origin}).encode("utf-8")
    request = urllib.request.Request(
        f"{base}/api/org/ingest",
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        sys.exit(f"The app refused the transcript ({error.code}): {error.read().decode('utf-8', 'replace')}")
    except urllib.error.URLError as error:
        sys.exit(f"Could not reach {base}: {error.reason}")
    if result.get("duplicate"):
        print("The app already had this transcript; nothing new was added.")
    else:
        print("Sent to the app: it is in Org → Data. Use Find work in this to turn it into tasks.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe a recording locally for Inertia.")
    parser.add_argument("recording", help="audio or video file")
    parser.add_argument("--title", help="meeting title for the transcript heading")
    parser.add_argument("--model", default="small", help="Whisper model size (default: small)")
    parser.add_argument("--language", default=None, help="language code, e.g. en (default: detect)")
    parser.add_argument("--out", help="output file (default: <recording>.transcript.md)")
    parser.add_argument("--post", action="store_true", help="also send the transcript to the member app")
    args = parser.parse_args()

    if not os.path.isfile(args.recording):
        sys.exit(f"No such file: {args.recording}")
    base = os.path.splitext(args.recording)[0]
    title = args.title or os.path.basename(base)
    origin = f"transcript:{os.path.basename(args.recording)}"

    if args.recording.lower().endswith(TRANSCRIPT_EXTENSIONS):
        if not args.post:
            sys.exit("That is already a transcript. Upload it in Org → Data, or add --post to send it.")
        with open(args.recording, encoding="utf-8", errors="replace") as handle:
            text = transcript_text(handle.read())
        if not text:
            sys.exit("That transcript is empty.")
        post(title, text, origin)
        return

    out = args.out or f"{base}.transcript.md"

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "audio.wav")
        to_wav(args.recording, wav)
        info, segments = transcribe(wav, args.model, args.language)

    lines = [
        f"# {title} (transcript)",
        "",
        f"Machine transcript, unreviewed. Whisper {args.model}, language {info.language}. Speakers not identified.",
        "",
    ]
    lines += [f"[{clock(seg.start)}] {seg.text.strip()}" for seg in segments if seg.text.strip()]
    with open(out, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    if args.post:
        print(f"Wrote {out} ({len(segments)} segments).")
        post(title, "\n".join(lines), origin)
    else:
        print(f"Wrote {out} ({len(segments)} segments). Upload it in Org → Data, or rerun with --post.")


if __name__ == "__main__":
    main()
