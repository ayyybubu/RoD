const tmi = require("tmi.js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const twitchChannel = "nymn"; // Change to your channel

// Twitch chat configuration
const client = new tmi.Client({
  connection: { reconnect: true },
  channels: [twitchChannel],
});

// When a message is received in Twitch chat, send it to the frontend
client.on("message", (channel, tags, message, self) => {
  if (!self) {
    io.emit("chatMessage", { user: tags["display-name"], message });
  }
});

// Start listening to Twitch chat
client.connect();

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve the game
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});