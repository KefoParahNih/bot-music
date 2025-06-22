const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const commands = [];
const foldersPath = path.join(__dirname, "src/commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `[PERINGATAN] Command di ${filePath} tidak memiliki properti "data" atau "execute".`
      );
    }
  }
}

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);

// Mengambil Client ID dari environment variable atau hardcode
const clientId = process.env.DISCORD_CLIENT_ID; // Pastikan Anda menambahkan ID Client ke file .env
// atau const clientId = 'ID_CLIENT_BOT_ANDA';

// Perubahan utama ada di sini!
// Kita menggunakan applicationCommands (global) bukan applicationGuildCommands (spesifik server)
(async () => {
  try {
    console.log(
      `Memulai mendaftarkan ${commands.length} application (/) commands secara global.`
    );

    // Method `put` digunakan untuk me-refresh semua command dengan set yang sekarang
    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(
      `Berhasil mendaftarkan ${data.length} application (/) commands secara global.`
    );
  } catch (error) {
    // Pastikan untuk log error secara detail
    console.error(error);
  }
})();
