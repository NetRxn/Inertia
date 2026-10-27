#!/usr/bin/env python3
"""Transcribe a meeting recording locally with open-source Whisper, for upload to Inertia.

Runs entirely on your machine: nothing is sent anywhere. Any audio or video
format ffmpeg can read works (mp3, m4a, wav, mp4, webm, ...). The output is a
Markdown transcript with timestamps that Inertia reads as a meeting:

    pip install faster-whisper          # once; ffmpeg must be installed too
    python3 scripts/transcribe.py recording.m4a --title "Roundtable 2026-10-28"
    # -> recording.transcript.md, then Org → Data → drop it in (or setup-org.ts --file)

Model sizes: tiny, base, small (default, good on a laptop CPU), medium,
large-v3-turbo (best; use a GPU). The model downloads once on first use.
Speaker names are not guessed: lines are timestamped, and a person can add
names before uploading.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe a recording locally for Inertia.")
    parser.add_argument("recording", help="audio or video file")
    parser.add_argument("--title", help="meeting title for the transcript heading")
    parser.add_argument("--model", default="small", help="Whisper model size (default: small)")
    parser.add_argument("--language", default=None, help="language code, e.g. en (default: detect)")
    parser.add_argument("--out", help="output file (default: <recording>.transcript.md)")
    args = parser.parse_args()

    if not os.path.isfile(args.recording):
        sys.exit(f"No such file: {args.recording}")
    base = os.path.splitext(args.recording)[0]
    out = args.out or f"{base}.transcript.md"
    title = args.title or os.path.basename(base)

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
    print(f"Wrote {out} ({len(segments)} segments). Upload it in Org → Data.")


if __name__ == "__main__":
    main()
