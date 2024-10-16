const Queue = require("bull");
const workerQueue = new Queue("worker", {
  redis: {
    port: 6379,
    host: process.env.REDIS_HOST
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
