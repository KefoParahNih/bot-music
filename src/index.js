// src/index.js

const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
require("dotenv").config(); // Muat variabel dari .env

// Buat instance client baru
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages, // Diperlukan untuk mendeteksi pesan jika menggunakan prefix command
  ],
});

// Membuat collection untuk menyimpan commands
client.commands = new Collection();
client.queues = new Map(); // Map untuk menyimpan queue musik per server

// ================== MEMUAT COMMANDS ==================
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set item baru di Collection dengan key sebagai nama command dan value sebagai module yang diexport
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[PERINGATAN] Command di ${filePath} tidak memiliki properti "data" atau "execute".`
      );
    }
  }
}

// ================== MEMUAT EVENTS ==================
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client)); // Kirim client ke event handler
  }
}

// Login ke Discord dengan token bot
client.login(process.env.DISCORD_TOKEN);
