import whisper
import sys
import json

# Load the Whisper model
model = whisper.load_model("turbo")

# Get the audio file path from command-line arguments
audio_file = sys.argv[1]
# audio_file = 'output/1728503478006/family/vocals.wav'

# Transcribe audio
result = model.transcribe(audio_file, word_timestamps=True)

# Output the transcription
print(json.dumps(result))