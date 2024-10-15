const Queue = require("bull");
const workerQueue = new Queue("worker", {
  redis: {
    portport: process.env.CLOUD_REDIS_PORT,
    host: process.env.CLOUD_REDIS_HOST,
    password: process.env.CLOUD_REDIS_PASSWORD,
  },
});

async function createUploadAndProcessJob(
  uploadPath,
  file,
  fileExtension,
  fileNameWithOutExtension,
  date
) {
  return workerQueue.add({
    process: "uploadAndProcessFile",
    uploadPath,
    file,
    fileExtension,
    fileNameWithOutExtension,
    date
  });
}

async function getJob(id) {
  return workerQueue.getJob(id);
}

module.exports = {
  createUploadAndProcessJob,
  getJob,
};
