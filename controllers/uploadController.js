const fs = require("fs");
const path = require("path");

const { exec } = require("child_process");
// const logger = require("pino")();
const filter = require("leo-profanity");
const rootDir = process.cwd();
const uploadDir = path.join(rootDir, "uploads");
const { createUploadAndProcessJob, getJob } = require("../helpers/queueHelper");

function createFolder(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

// Create the uploads directory if it doesn't exist
createFolder(uploadDir);

const filterArray = [
  "n***a",
  "niggas",
  "N***a",
  "fucked",
  "-assed",
  "-ass",
  "pussy",
  "hoe",
  "hoes",
  "nigga's",
  "pussies",
  "motherfuckin'",
  "nigga?",
  "fuckin'",
  "niggas?",
  "motherfucking",
  "shit's"
];

filter.add(filterArray);

function getFileExtension(file) {
  switch (file.mimetype) {
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
      return ".wav";
    case "video/mp4":
      return ".mp4";
    default:
      return null;
  }
}

function getMuteCommands(whisperResponse) {
  const result = JSON.parse(whisperResponse);
  const muteCommands = [];
  result.segments.forEach((segment) => {
    segment.words.forEach((wordObj) => {
      const word = wordObj.word;
      console.log(word);
      if (filter.check(word) || filterArray.some(item => word.includes(item))) {
        console.log(
          `Foul word detected: ${word} at ${wordObj.start}-${wordObj.end}`
        );
        muteCommands.push(
          `volume=enable='between(t,${wordObj.start - 0.15},${
            wordObj.end + 0.15
          })':volume=0`
        );
      }
    });
  });

  return muteCommands;
}

function processVideo(res, uploadPath, date) {
  // Create the uploads directory if it doesn't exist
  const outputDir = path.join(rootDir, `output/${date}`);
  createFolder(outputDir);

  const seperateAudioFromVideoCommand = `ffmpeg -i ${uploadPath} -q:a 0 -map a output/${date}/video_audio.wav`;
  exec(seperateAudioFromVideoCommand, (error, stdout, stderr) => {
    if (error) {
      return res.status(400).send("Error saving the file:", error);
    } else {
      const spleeterCommand = `spleeter separate -p spleeter:2stems -o output/${date} output/${date}/video_audio.wav`;

      exec(spleeterCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(error);
        } else {
          const pythonScript = `python3 public/py/whisper_speech_to_text.py output/${date}/video_audio/vocals.wav`;
          exec(pythonScript, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing Whisper script: ${error.message}`);
              return res.status(500).send("Whisper transcription failed.");
            } else {
              const muteCommands = getMuteCommands(stdout);

              if (muteCommands.length > 0) {
                const ffmpegCommand = `ffmpeg -i output/${date}/video_audio/vocals.wav -af "${muteCommands.join(
                  ","
                )}" output/${date}/video_audio/scrubbed_vocals.mp3`;
                exec(ffmpegCommand, (error) => {
                  if (error) {
                    return res
                      .status(400)
                      .send("Error processing file:", error);
                  } else {
                    const combineCommand = `ffmpeg -i output/${date}/video_audio/accompaniment.wav -i output/${date}/video_audio/scrubbed_vocals.mp3 -filter_complex "[0][1]amix=inputs=2" output/${date}/video_audio/final_output.wav`;
                    exec(combineCommand, (error) => {
                      if (error) {
                        // logger.error(`Error: ${error.message}`);
                        return res
                          .status(400)
                          .send("Error processing file:", error.message);
                      } else {
                        const publicOutputDir = path.join(
                          rootDir,
                          `public/output/${date}`
                        );
                        createFolder(publicOutputDir);
                        const command = `ffmpeg -i ${uploadPath} -i output/${date}/video_audio/final_output.wav -c:v copy -map 0:v:0 -map 1:a:0 public/output/${date}/final_output.mp4`;
                        exec(command, (error) => {
                          if (error) {
                            // logger.error(`Error: ${error.message}`);
                            return res
                              .status(400)
                              .send("Error processing file:", error.message);
                          }

                          return res.status(200).json({
                            change: true,
                            url: `output/${date}/final_output.mp4`,
                          });
                        });
                      }
                    });
                  }
                });
              } else {
                return res.status(200).json({ changed: false });
              }
            }
          });
        }
      });
    }
  });
}

function processAudio(res, uploadPath, date, fileNameWithOutExtension) {
  const spleeterCommand = `spleeter separate -p spleeter:2stems -o output/${date} ${uploadPath}`;

  exec(spleeterCommand, (error) => {
    if (error) {
      // logger.error(error);
      return res.status(400).send("Error processing file");
    } else {
      const pythonScript = `python3 public/py/whisper_speech_to_text.py output/${date}/${fileNameWithOutExtension}/vocals.wav`;
      exec(pythonScript, (error, stdout) => {
        if (error) {
          // logger.error(`Error executing Whisper script: ${error.message}`);
          return res.status(500).send("Whisper transcription failed.");
        }

        const muteCommands = getMuteCommands(stdout);

        const outputDir = path.join(
          rootDir,
          `public/output/${date}/${fileNameWithOutExtension}`
        );

        createFolder(outputDir);

        if (muteCommands.length > 0) {
          const ffmpegCommand = `ffmpeg -i ${uploadPath} -af "${muteCommands.join(
            ","
          )}" output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3`;
          exec(ffmpegCommand, (error) => {
            if (error) {
              // logger.error(`Error: ${error.message}`);
              return res
                .status(400)
                .send("Error processing file:", error.message);
            } else {
              const combineCommand = `ffmpeg -i output/${date}/${fileNameWithOutExtension}/accompaniment.wav -i output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3 -filter_complex "[0][1]amix=inputs=2" public/output/${date}/${fileNameWithOutExtension}/final_output.wav`;
              exec(combineCommand, (error) => {
                if (error) {
                  // logger.error(`Error: ${error.message}`);
                  return res
                    .status(400)
                    .send("Error processing file:", error.message);
                } else {
                  return res.status(200).json({
                    change: true,
                    url: `/output/${date}/${fileNameWithOutExtension}/final_output.wav`,
                  });
                }
              });
            }
          });
        } else {
          res.status(200).json({ change: false });
        }
      });
    }
  });
}

async function uploadFile(req, res) {
  const { file } = req.files;

  //check file is type wav or mp3, mp4

  if (!file) return res.status(400).send("No file has been uploaded");

  const fileExtension = getFileExtension(file);

  if (!fileExtension) {
    return res.status(400).send("File must be a mp3, mp4 or wav.");
  }

  const fileNameWithOutExtension = file.name
    .replace(fileExtension, "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll(" ", "")
    .replaceAll(".", "")
    .replaceAll("&", "");

  const uploadPath = path.join(
    uploadDir,
    `${fileNameWithOutExtension}${fileExtension}`
  );

  const date = Date.now();
  // try {
  const job = await createUploadAndProcessJob(
    uploadPath,
    file,
    fileExtension,
    fileNameWithOutExtension,
    date
  );
  job.progress(0);

  // const job = await createUploadAndProcessJob(file.filename);
  return res.status(200).json({ id: job.id, filename: file.name, date, fileNameWithOutExtension, fileExtension });
  // } catch(err) {
  //   console.log(err)
  // }

  fs.writeFile(uploadPath, file.data, (err) => {
    if (err) {
      return res.status(400).json({ error: "Error saving the file:", err });
    } else {
      const date = Date.now();
      if (fileExtension === ".mp4") {
        // Create the uploads directory if it doesn't exist
        return processVideo(res, uploadPath, date);
      } else {
        return processAudio(res, uploadPath, date, fileNameWithOutExtension);
      }
    }
  });
}

async function uploadAndProcessJob(req, res) {
  const id = req.params.id;
  const job = await getJob(id);

  if (job === null) {
    return res.status(404).end();
  } else {
    const state = await job.getState();
    const progress = job._progress;
    const reason = job.failedReason;
    const process = job.data.process;
    const date = job.data.date;
    const fileExtension = job.data.fileExtension;
    const fileNameWithOutExtension = job.data.fileNameWithOutExtension;
    return res.json({ id, state, progress, date, reason, process, fileExtension, fileNameWithOutExtension });
  }
}

module.exports = {
  uploadAndProcessJob,
  uploadFile,
};
