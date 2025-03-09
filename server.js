const tmi = require("tmi.js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const twitchChannel = "nymn"; // Change to your channel

// Function to sanitize text to prevent XSS
const sanitizeText = (text) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Twitch chat configuration
const client = new tmi.Client({
  connection: { reconnect: true },
  channels: [twitchChannel],
});

// When a message is received in Twitch chat, sanitize it and send it to the frontend
client.on("message", (channel, tags, message, self) => {
  if (!self) {
    const sanitizedUser = sanitizeText(tags["display-name"]);
    const sanitizedMessage = sanitizeText(message);
    io.emit("chatMessage", { user: sanitizedUser, message: sanitizedMessage });
  }
});

// Start listening to Twitch chat
client.connect();

// Serve frontend files
app.use(express.static("public"));

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});