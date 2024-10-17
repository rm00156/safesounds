const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const logger = require("pino")();
const filter = require("leo-profanity");
const rootDir = process.cwd();
const ffmpeg = require("fluent-ffmpeg");

function createFolder(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

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
  "fucker",
  "shit's",
];

filter.add(filterArray);

function getMuteCommands(whisperResponse) {
  const result = JSON.parse(whisperResponse);
  const muteCommands = [];
  result.segments.forEach((segment) => {
    segment.words.forEach((wordObj) => {
      const word = wordObj.word;
      logger.info(word);
      if (filter.check(word)) {
        logger.info(
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

async function processVideo(job, uploadPath, date, fileNameWithOutExtension) {
  // Create the uploads directory if it doesn't exist

  const outputDir = path.join(
    rootDir,
    `output/${date}/${fileNameWithOutExtension}`
  );
  createFolder(outputDir);

  const seperateAudioFromVideoCommand = `ffmpeg -i ${uploadPath} -q:a 0 -map a output/${date}/${fileNameWithOutExtension}/video_audio.wav`;
  job.progress(10);
  try {
    await execCommand(seperateAudioFromVideoCommand);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  // exec(seperateAudioFromVideoCommand, (error, stdout, stderr) => {
  // if (error) {
  //   return { error: "Error saving the file" };
  // } else {
  job.progress(20);
  const spleeterCommand = `spleeter separate -p spleeter:2stems -o output/${date}/${fileNameWithOutExtension} output/${date}/${fileNameWithOutExtension}/video_audio.wav`;

  try {
    await execCommand(spleeterCommand);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  // exec(spleeterCommand, (error, stdout, stderr) => {
  //   if (error) {
  //     return { error: "Error processing the file" };
  //   } else {
  job.progress(30);

  const fileToBeProcessed = `output/${date}/${fileNameWithOutExtension}/video_audio/vocals.wav`;

  let durationInSeconds;
  try {
    durationInSeconds = await executeFfmpegFfProbe(fileToBeProcessed);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }

  let process;
  try {
    process = spawn("unbuffer", [
      "whisper",
      fileToBeProcessed,
      "--model",
      "turbo",
      "--language",
      "en",
      "--output_format",
      "json",
      "--output_dir",
      `output/${date}/${fileNameWithOutExtension}`,
      "--word_timestamps",
      "True",
    ]);
  } catch (err) {
    logger.error(err);
  }
  process.stdout.on("data", (data) => {
    const timestamp = getProcessedCurrentTimeStamp(data.toString());
    if (timestamp) {
      const percentageOfWhisperProcessed = timestamp / durationInSeconds;
      job.progress(Math.round(30 + 55 * percentageOfWhisperProcessed));
    }
  });

  try {
    await awaitSpawnClose(process);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  // exec(pythonScript, (error, stdout, stderr) => {
  //   if (error) {
  //     logger.error(`Error executing Whisper script: ${error.message}`);
  //     return { error: "Error processing the file" };
  //   } else {

  const result = fs.readFileSync(
    `output/${date}/${fileNameWithOutExtension}/vocals.json`,
    "utf8"
  );
  job.progress(85);
  const muteCommands = getMuteCommands(result);
  if (muteCommands.length === 0) throw new Error("No changes found");

  const ffmpegCommand = `ffmpeg -i output/${date}/${fileNameWithOutExtension}/video_audio/vocals.wav -af "${muteCommands.join(
    ","
  )}" output/${date}/${fileNameWithOutExtension}/video_audio/scrubbed_vocals.mp3`;

  try {
    await execCommand(ffmpegCommand);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }

  // exec(ffmpegCommand, (error) => {
  //   if (error) {
  //     return { error: "Error processing the file" };
  //   } else {
  job.progress(90);
  const combineCommand = `ffmpeg -i output/${date}/${fileNameWithOutExtension}/video_audio/accompaniment.wav -i output/${date}/${fileNameWithOutExtension}/video_audio/scrubbed_vocals.mp3 -filter_complex "[0][1]amix=inputs=2" output/${date}/${fileNameWithOutExtension}/video_audio/final_output.wav`;

  try {
    await execCommand(combineCommand);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  // exec(combineCommand, (error) => {
  //   if (error) {
  //     logger.error(`Error: ${error.message}`);
  //     return { error: "Error processing the file" };
  //   } else {
  job.progress(95);
  const publicOutputDir = path.join(
    rootDir,
    `public/output/${date}/${fileNameWithOutExtension}`
  );
  createFolder(publicOutputDir);
  const command = `ffmpeg -i ${uploadPath} -i output/${date}/${fileNameWithOutExtension}/video_audio/final_output.wav -c:v copy -map 0:v:0 -map 1:a:0 public/output/${date}/${fileNameWithOutExtension}/final_output.mp4`;

  try {
    await execCommand(command);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }

  job.progress(100);

  //   }
  // });
  //   }
  // });

  //   }
  // });
  // }
  // });
  // }
  // });
}

async function executeFfmpegFfProbe(fileToBeProcessed) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(fileToBeProcessed, (err, metadata) => {
      if (err) {
        reject("Error:", err);
      }

      resolve(metadata.format.duration);
    });
  });
}

async function awaitSpawnClose(process) {
  return new Promise((resolve, reject) => {
    process.on("close", async (code) => {
      logger.error(code);
      if (code === 0) {
        return resolve();
      }

      reject(code);
    });
  });
}

async function processAudio(job, uploadPath, date, fileNameWithOutExtension) {
  const spleeterCommand = `spleeter separate -p spleeter:2stems -o output/${date} ${uploadPath}`;
  job.progress(10);

  try {
    await execCommand(spleeterCommand);
  } catch (err) {
    logger.error(err);
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }

  // exec(spleeterCommand, async (error) => {
  // if (error) {
  //   logger.error(error);
  //   return
  // } else {

  // throw new Error('reece')
  job.progress(20);
  const fileToBeProcessed = `output/${date}/${fileNameWithOutExtension}/vocals.wav`;

  // ffmpeg.ffprobe(fileToBeProcessed, (err, metadata) => {
  // if (err) {
  //   console.error('Error:', err);
  //   return;
  // }
  let durationInSeconds;
  try {
    durationInSeconds = await executeFfmpegFfProbe(fileToBeProcessed);
  } catch (err) {
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  //  metadata.format.duration;
  const process = spawn("unbuffer", [
    "whisper",
    fileToBeProcessed,
    "--model",
    "turbo",
    "--language",
    "en",
    "--output_format",
    "json",
    "--output_dir",
    `output/${date}/${fileNameWithOutExtension}`,
    "--word_timestamps",
    "True",
  ]);

  process.stdout.on("data", (data) => {
    const timestamp = getProcessedCurrentTimeStamp(data.toString());
    if (timestamp) {
      const percentageOfWhisperProcessed = timestamp / durationInSeconds;
      job.progress(Math.round(20 + 75 * percentageOfWhisperProcessed));
    }
  });

  try {
    await awaitSpawnClose(process);
  } catch (err) {
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  // process.on('close', async (code) => {
  // console.log(code)
  // if(code === 0) {
  // read from json file;

  const result = fs.readFileSync(
    `output/${date}/${fileNameWithOutExtension}/vocals.json`,
    "utf8"
  );
  const muteCommands = getMuteCommands(result);

  const outputDir = path.join(
    rootDir,
    `public/output/${date}/${fileNameWithOutExtension}`
  );

  createFolder(outputDir);

  if (muteCommands.length === 0) {
    throw new Error("No changes found");
  }

  const ffmpegCommand = `ffmpeg -i ${uploadPath} -af "${muteCommands.join(
    ","
  )}" output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3`;
  try {
    await execCommand(ffmpegCommand);
  } catch (err) {
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  job.progress(95);
  const combineCommand = `ffmpeg -i output/${date}/${fileNameWithOutExtension}/accompaniment.wav -i output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3 -filter_complex "[0][1]amix=inputs=2" public/output/${date}/${fileNameWithOutExtension}/final_output.wav`;
  try {
    await execCommand(combineCommand);
  } catch (err) {
    throw new Error(
      "There was an error processing the file. Please contact support."
    );
  }
  job.progress(100);

  fs.unlink(uploadPath, () => {
    fs.rm(`output/${date}`, { recursive: true, force: true }, () => {

    });
  });

  
  // exec(ffmpegCommand, (error) => {
  //   if (error) {
  //     logger.error(`Error: ${error.message}`);
  //     // return res
  //     //   .status(400)
  //     //   .send("Error processing file:", error.message);
  //   } else {

  //     job.progress(95);
  //     const combineCommand = `ffmpeg -i output/${date}/${fileNameWithOutExtension}/accompaniment.wav -i output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3 -filter_complex "[0][1]amix=inputs=2" public/output/${date}/${fileNameWithOutExtension}/final_output.wav`;
  //     exec(combineCommand, (error) => {
  //       if (error) {
  //         logger.error(`Error: ${error.message}`);
  //         // return res
  //         //   .status(400)
  //         //   .send("Error processing file:", error.message);
  //       } else {

  //         job.progress(100);

  //       }
  //     });
  //   }
  // });
  // } else {

  // }

  // }
  // })

  // } )

  // const stdout = await transcribeAudio(`output/${date}/${fileNameWithOutExtension}/vocals.wav`)

  // const pythonScript = `python3 public/py/whisper_speech_to_text.py output/${date}/${fileNameWithOutExtension}/vocals.wav`;
  // const pythonScript2 = `python3 public/py/whisper_model.py`;

  // exec(pythonScript2, (error, stdout) => {
  // if (error) {
  //   logger.error(`Error executing Whisper script: ${error.message}`);
  //   return res.status(500).send("Whisper transcription failed.");
  // }

  // // job.progress(60);

  // // const muteCommands = getMuteCommands(stdout);

  // // const outputDir = path.join(
  // //   rootDir,
  // //   `public/output/${date}/${fileNameWithOutExtension}`
  // // );

  // // createFolder(outputDir);

  // // if (muteCommands.length > 0) {
  // //   const ffmpegCommand = `ffmpeg -i ${uploadPath} -af "${muteCommands.join(
  // //     ","
  // //   )}" output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3`;
  // //   exec(ffmpegCommand, (error) => {
  // //     if (error) {
  // //       logger.error(`Error: ${error.message}`);
  // //       return res
  // //         .status(400)
  // //         .send("Error processing file:", error.message);
  // //     } else {

  // //       job.progress(80);
  // //       const combineCommand = `ffmpeg -i output/${date}/${fileNameWithOutExtension}/accompaniment.wav -i output/${date}/${fileNameWithOutExtension}/scrubbed_vocals.mp3 -filter_complex "[0][1]amix=inputs=2" public/output/${date}/${fileNameWithOutExtension}/final_output.wav`;
  // //       exec(combineCommand, (error) => {
  // //         if (error) {
  // //           logger.error(`Error: ${error.message}`);
  // //           return res
  // //             .status(400)
  // //             .send("Error processing file:", error.message);
  // //         } else {

  // //           job.progress(100);

  // //         }
  // //       });
  // //     }
  // //   });
  // } else {
  //   res.status(200).json({ change: false });
  // }
  // });
  // }
  // });
}

async function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error: ${error.message}`);
      }

      resolve(stdout);
    });
  });
}

async function writeFileAsync(
  job,
  uploadPath,
  data,
  fileExtension,
  fileNameWithOutExtension,
  date
) {
  await fs.promises.writeFile(uploadPath, data);

  if (fileExtension === ".mp4") {
    // Create the uploads directory if it doesn't exist
    await processVideo(job, uploadPath, date, fileNameWithOutExtension);
  } else {
    await processAudio(job, uploadPath, date, fileNameWithOutExtension);
  }
}

async function uploadAndProcessFile(job) {
  const { uploadPath, file, fileExtension, fileNameWithOutExtension, date } =
    job.data;

  const data = Buffer.from(file.data);

  await writeFileAsync(
    job,
    uploadPath,
    data,
    fileExtension,
    fileNameWithOutExtension,
    date
  );
}

const convertToSeconds = (time) => {
  const [minutes, secondsWithMilliseconds] = time.split(":");
  const [seconds, milliseconds] = secondsWithMilliseconds.split(".");
  const totalSeconds =
    parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  return totalSeconds;
};

function getProcessedCurrentTimeStamp(str) {
  // const regex = /\[(\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}\.\d{3})\]/g;

  // // Find all matches
  // const matches = str.match(regex);

  // // Get the last match if there are any
  // const lastMatch = matches ? matches[matches.length - 1] : null;

  const regex = /\b\d{2}:\d{2}\.\d{3}\b/g;
  const matches = str.match(regex);
  if (matches === null) return null;

  const endTime = matches[matches.length - 1];

  // if(!lastMatch)
  //   return null;

  //   // Extract the end timestamp from the last match
  //   const endTime = lastMatch.match(\b\d{2}:\d{2}\.\d{3}\b)[0];

  //   // Function to convert MM:SS.mmm to seconds

  return convertToSeconds(endTime);
  console.log(`Last timestamp: ${endTime}`); // Output: Last timestamp: 00:40.880
  console.log(`Total seconds: ${totalSeconds}`); // Output: Total seconds: 40.88
}

module.exports = {
  uploadAndProcessFile,
};
