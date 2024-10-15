import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import librosa
# Load the Whisper model and processor

if torch.backends.mps.is_available():
    mps_device = torch.device("mps")
    x = torch.ones(1, device=mps_device)
    print (x)
else:
    print ("MPS device not found.")

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large")
processor = WhisperProcessor.from_pretrained("openai/whisper-large")

# audio_input = processor(
#     "final_output(1).wav",
#     return_tensors="pt"
# )

audio_path = "polyglot.wav"
audio, sampling_rate = librosa.load(audio_path)

# if sampling_rate != 16000:
#     # Resample to 16 kHz
#     audio = librosa.resample(audio, orig_sr=sampling_rate, target_sr=16000)


audio_input = processor(audio=audio, sampling_rate=16000, return_tensors="pt")

# print(audio_input)
# Generate transcription and timestamps
result = model(audio_input.input_features)
print(result)
transcription = processor.decode(result.logits[0].argmax(dim=-1))
segments = result.segments[0]

# Tokenize the transcription
tokens = transcription.split()

# Calculate duration per token
total_duration = segments[:, 1] - segments[:, 0]
duration_per_token = total_duration / len(tokens)

# Assign timestamps to tokens
word_timestamps = []
for i, token in enumerate(tokens):
    start_time = segments[0, 0] + i * duration_per_token
    end_time = start_time + duration_per_token
    word_timestamps.append((token, start_time.item(), end_time.item()))

# Print the word-level timestamps
for word, start, end in word_timestamps:
    print(f"{word}: {start:.2f} - {end:.2f}")