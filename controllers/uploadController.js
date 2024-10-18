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
