# whisper_server.py
import whisper
import json

# Load the Whisper model once
model = whisper.load_model("medium.en")

def transcribe(audio_file):
    result = model.transcribe(audio_file, word_timestamps=True)
    return json.dumps(result)

if __name__ == "__main__":
    while True:
        audio_file = input()  # receive audio file name from Node.js process
        if audio_file == 'exit':
            break
        # Transcribe the audio and print the result (to be received by Node.js)
        transcription = transcribe(audio_file)
        print(transcription)
