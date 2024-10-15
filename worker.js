const throng = require("throng");
const logger = require("pino")();
const Queue = require("bull");
const { uploadAndProcessFile } = require("./helpers/uploadAndProcessHelper");


const isDevelopment = process.env.NODE_ENV === undefined;
if (isDevelopment) {
  require("dotenv").config(); // Load variables from .env file
}

const workers = process.env.WEB_CONCURRENCY || 2;

const maxJobsPerWorker = 15;

function start() {
  // Connect to the named work queue

  const workerQueue = new Queue("worker", {
    redis: {
      port: process.env.CLOUD_REDIS_PORT,
      host: process.env.CLOUD_REDIS_HOST,
      password: process.env.CLOUD_REDIS_PASSWORD,
    },
  });

  workerQueue
    .process(maxJobsPerWorker, async (job) => {
      if (job.data.process === "uploadAndProcessFile") {
        await uploadAndProcessFile(job);
        
      }
    })
    .catch((err) => {
      logger.error(err);
    });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });
