# Use a pipeline as a high-level helper
from transformers import pipeline
import torch
import json

whisper = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3-turbo",torch_dtype=torch.float16, device="mps:0")

result = whisper('press.mp3', return_timestamps=True)

print(json.dumps(result))
# for text, start, end in zip(result.text, result.timestamps[:, 0], result.timestamps[:, 1]):
#     print(f"Text: {text}, Start: {start:.2f}, End: {end:.2f}")