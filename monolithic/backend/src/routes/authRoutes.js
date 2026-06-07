const express = require("express");
const { login, register } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/health", (_req, res) => res.json({ service: "auth", status: "ok" }));

module.exports = router;
