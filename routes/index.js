const express = require("express");
const multer = require('multer');
const { uploadAndProcessJob, uploadFile } = require("../controllers/uploadController.js");
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/'); // Set the destination folder
  },
  filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Use a unique filename
  },
});
const upload = multer({ storage });

router.get("/", (req, res) => {
  res.render("home");
});

router.post("/upload", uploadFile);
router.get("/upload/job/id/:id", uploadAndProcessJob);

module.exports = router;
