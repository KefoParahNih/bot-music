// src/events/ready.js
const { Events } = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Siap! Login sebagai ${client.user.tag}`);
    // Jika Anda ingin mendaftarkan slash command secara global (butuh waktu ~1 jam untuk update)
    // const { REST } = require('@discordjs/rest');
    // const { Routes } = require('discord-api-types/v9');
    // const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
    // (async () => {
    //     try {
    //         await rest.put(
    //             Routes.applicationCommands(client.user.id),
    //             { body: client.commands.map(cmd => cmd.data.toJSON()) },
    //         );
    //         console.log('Slash commands berhasil didaftarkan secara global.');
    //     } catch (error) {
    //         console.error(error);
    //     }
    // })();
  },
};
