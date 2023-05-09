const express = require("express");
const authMiddleware = require("../middleware/authMiddleware")

const multer = require("multer");
const upload = multer();


const router = express.Router();

const {helloWorld, saveImage, initialiseBalance} = require("../controller/UserController");

router.get("/",authMiddleware,helloWorld);

router.post("/saveImage",authMiddleware, upload.single("my-image-file"),saveImage);
router.post("/initialiseBalance", authMiddleware, initialiseBalance);

module.exports = router;