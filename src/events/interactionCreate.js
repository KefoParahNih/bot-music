const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} = require("@discordjs/voice");
const scdl = require("soundcloud-downloader").default;

const createButtonRow = (queue) => {
  const isPaused = queue.player.state.status === AudioPlayerStatus.Paused;
  const loopMode = queue.loopMode;

  const pauseResumeButton = new ButtonBuilder()
    .setCustomId("music_pause_resume")
    .setLabel(isPaused ? "Lanjutkan" : "Jeda")
    .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setEmoji(isPaused ? "▶️" : "⏸️");

  const skipButton = new ButtonBuilder()
    .setCustomId("music_skip")
    .setLabel("Lewati")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("⏭️");

  const stopButton = new ButtonBuilder()
    .setCustomId("music_stop")
    .setLabel("Hentikan")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("⏹️");

  const loopButton = new ButtonBuilder()
    .setCustomId("music_loop")
    .setLabel(
      `Ulang: ${loopMode === 1 ? "Lagu" : loopMode === 2 ? "Antrian" : "Mati"}`
    )
    .setStyle(loopMode === 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
    .setEmoji("🔁");

  const shuffleButton = new ButtonBuilder()
    .setCustomId("music_shuffle")
    .setLabel("Acak")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🔀");

  return new ActionRowBuilder().addComponents(
    pauseResumeButton,
    skipButton,
    stopButton,
    loopButton,
    shuffleButton
  );
};

const play = async (guild, song, client) => {
  const serverQueue = client.queues.get(guild.id);

  if (!song) {
    if (serverQueue.nowPlayingMessage) {
      await serverQueue.nowPlayingMessage.delete().catch(() => {});
    }
    serverQueue.textChannel.send("🎶 Antrian telah selesai.");
    setTimeout(() => {
      const currentQueue = client.queues.get(guild.id);
      if (
        currentQueue &&
        currentQueue.songs.length === 0 &&
        currentQueue.connection
      ) {
        currentQueue.connection.destroy();
        client.queues.delete(guild.id);
      }
    }, 300000);
    return;
  }

  try {
    if (serverQueue.nowPlayingMessage) {
      await serverQueue.nowPlayingMessage.delete().catch(() => {});
    }

    // Clean up previous resource if exists
    if (serverQueue.currentResource) {
      try {
        serverQueue.currentResource.playStream.removeAllListeners();
        if (serverQueue.currentResource.playStream.destroy) {
          serverQueue.currentResource.playStream.destroy();
        }
      } catch (err) {
        console.log("Error cleaning up previous resource:", err.message);
      }
    }

    // Create audio resource with better error handling
    const resource = createAudioResource(song.stream_url, {
      metadata: {
        title: song.title,
      },
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });

    // Store current resource for cleanup
    serverQueue.currentResource = resource;

    // Set max listeners to prevent memory leak warnings
    if (resource.playStream.setMaxListeners) {
      resource.playStream.setMaxListeners(20);
    }

    // Enhanced error handling for the stream
    const streamErrorHandler = (error) => {
      console.error(`Stream error for ${song.title}:`, error.message);

      // Don't handle the same error multiple times
      if (serverQueue.handlingError) return;
      serverQueue.handlingError = true;

      // Clean up the current resource
      resource.playStream.removeAllListeners();

      // Skip to next song after a short delay
      setTimeout(() => {
        serverQueue.handlingError = false;
        if (serverQueue.songs.length > 0) {
          serverQueue.textChannel.send(
            `⚠️ Terjadi masalah dengan **${song.title}**, melewati ke lagu berikutnya...`
          );
          handleNextSong(serverQueue, guild, client);
        }
      }, 1000);
    };

    // Add error handlers with proper cleanup
    resource.playStream.once("error", streamErrorHandler);

    // Handle premature close
    resource.playStream.once("close", () => {
      if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
        console.log(`Stream closed prematurely for: ${song.title}`);
        streamErrorHandler(new Error("Stream closed prematurely"));
      }
    });

    // Handle stream end normally
    resource.playStream.once("end", () => {
      console.log(`Stream ended normally for: ${song.title}`);
    });

    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    // Clean up previous player listeners
    serverQueue.player.removeAllListeners("error");

    // Add player error handler
    serverQueue.player.once("error", (error) => {
      console.error(
        `Player Error: ${error.message} with resource ${
          error.resource?.metadata?.title || "Unknown"
        }`
      );

      if (!serverQueue.handlingError) {
        serverQueue.handlingError = true;
        serverQueue.textChannel.send(
          `❌ Terjadi error saat memutar lagu: **${song.title}**. Melewati ke lagu berikutnya...`
        );

        setTimeout(() => {
          serverQueue.handlingError = false;
          handleNextSong(serverQueue, guild, client);
        }, 1000);
      }
    });

    const embed = new EmbedBuilder()
      .setColor("#ff5500")
      .setTitle("🎶 Sedang Memutar")
      .setDescription(`**[${song.title}](${song.url})**`)
      .setThumbnail(song.thumbnail)
      .addFields(
        { name: "Oleh", value: song.author, inline: true },
        { name: "Diminta oleh", value: `${song.requester}`, inline: true },
        {
          name: "Durasi",
          value: new Date(song.duration * 1000).toISOString().slice(11, 19),
          inline: true,
        }
      );

    const row = createButtonRow(serverQueue);
    const nowPlayingMessage = await serverQueue.textChannel.send({
      embeds: [embed],
      components: [row],
    });
    serverQueue.nowPlayingMessage = nowPlayingMessage;
  } catch (error) {
    console.error("Error saat play:", error);
    if (!serverQueue.handlingError) {
      serverQueue.handlingError = true;
      serverQueue.textChannel.send(
        `❌ Terjadi error saat mencoba memainkan lagu: **${song.title}**. Melewati ke lagu berikutnya...`
      );

      setTimeout(() => {
        serverQueue.handlingError = false;
        handleNextSong(serverQueue, guild, client);
      }, 1000);
    }
    return;
  }

  // Clean up previous idle listeners
  serverQueue.player.removeAllListeners(AudioPlayerStatus.Idle);

  // Add idle listener for when song finishes
  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    // Clean up the current resource
    if (serverQueue.currentResource) {
      try {
        serverQueue.currentResource.playStream.removeAllListeners();
        if (serverQueue.currentResource.playStream.destroy) {
          serverQueue.currentResource.playStream.destroy();
        }
      } catch (err) {
        console.log("Error cleaning up resource on idle:", err.message);
      }
      serverQueue.currentResource = null;
    }

    if (!serverQueue.handlingError) {
      handleNextSong(serverQueue, guild, client);
    }
  });
};

// Fungsi baru untuk menangani perpindahan lagu
const handleNextSong = (serverQueue, guild, client) => {
  if (serverQueue.loopMode === 1) {
    // Loop lagu: tidak perlu mengubah array songs
    play(guild, serverQueue.songs[0], client);
  } else if (serverQueue.loopMode === 2) {
    // Loop antrian: pindah lagu ke belakang
    const currentSong = serverQueue.songs.shift();
    serverQueue.songs.push(currentSong);
    play(guild, serverQueue.songs[0], client);
  } else {
    // Mode normal: hapus lagu saat ini
    serverQueue.songs.shift();
    play(guild, serverQueue.songs[0], client);
  }
};

// Fungsi baru untuk skip lagu dengan mempertimbangkan loop queue
const skipSong = (serverQueue, guild, client) => {
  // Clean up current resource before skipping
  if (serverQueue.currentResource) {
    try {
      serverQueue.currentResource.playStream.removeAllListeners();
      if (serverQueue.currentResource.playStream.destroy) {
        serverQueue.currentResource.playStream.destroy();
      }
    } catch (err) {
      console.log("Error cleaning up resource on skip:", err.message);
    }
    serverQueue.currentResource = null;
  }

  if (serverQueue.loopMode === 2) {
    // Loop antrian: pindah ke lagu berikutnya, jika sudah di akhir maka kembali ke awal
    const currentSong = serverQueue.songs.shift();
    serverQueue.songs.push(currentSong);
  } else {
    // Mode normal atau loop lagu: hapus lagu saat ini
    serverQueue.songs.shift();
  }

  // Stop player untuk trigger event idle yang akan memanggil play lagi
  serverQueue.player.stop();
};

module.exports = {
  createButtonRow,
  play,
  skipSong,
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Memainkan lagu atau playlist dari SoundCloud.")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Link lagu/playlist SoundCloud atau judul lagu.")
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "Kamu harus berada di voice channel untuk memainkan musik!",
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferReply();

    let serverQueue = client.queues.get(interaction.guild.id);

    if (!serverQueue) {
      const queueContruct = {
        textChannel: interaction.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        player: createAudioPlayer(),
        playing: true,
        isShuffled: false,
        loopMode: 0,
        nowPlayingMessage: null,
        currentResource: null, // Add this to track current resource
        handlingError: false, // Add this to prevent multiple error handling
      };
      client.queues.set(interaction.guild.id, queueContruct);
      serverQueue = client.queues.get(interaction.guild.id);
    }

    let songs = [];
    let playlistTitle = "";

    try {
      if (scdl.isValidUrl(query) && query.includes("/sets/")) {
        const playlistInfo = await scdl.getSetInfo(query);
        playlistTitle = playlistInfo.title;
        const trackPromises = playlistInfo.tracks.map(async (track) => {
          try {
            const streamUrl = await scdl.download(track.permalink_url);
            return {
              title: track.title,
              url: track.permalink_url,
              thumbnail: track.artwork_url || "https://i.imgur.com/xK30X7V.png",
              duration: track.duration / 1000,
              author: track.user.username,
              stream_url: streamUrl,
              requester: interaction.user,
            };
          } catch (error) {
            console.error(
              `Failed to download track: ${track.title}`,
              error.message
            );
            return null;
          }
        });
        songs = (await Promise.all(trackPromises)).filter(
          (s) => s !== null && s.stream_url
        );
      } else {
        let songInfo;
        if (scdl.isValidUrl(query)) {
          songInfo = await scdl.getInfo(query);
        } else {
          const searchResults = await scdl.search({
            query: query,
            resourceType: "tracks",
          });
          if (searchResults.collection.length === 0)
            return interaction.followUp({ content: "Lagu tidak ditemukan." });
          songInfo = searchResults.collection[0];
        }
        const song = {
          title: songInfo.title,
          url: songInfo.permalink_url,
          thumbnail: songInfo.artwork_url || "https://i.imgur.com/xK30X7V.png",
          duration: songInfo.duration / 1000,
          author: songInfo.user.username,
          stream_url: await scdl.download(songInfo.permalink_url),
          requester: interaction.user,
        };
        songs.push(song);
      }
    } catch (error) {
      console.error(error);
      return interaction.followUp({
        content:
          "Gagal mendapatkan info dari SoundCloud. Link mungkin tidak valid, privat, atau lagu tidak dapat di-streaming.",
      });
    }

    serverQueue.songs.push(...songs);
    const isQueueEmpty = serverQueue.songs.length === songs.length;

    if (interaction.deferred) {
      let replyMessage = "";
      if (playlistTitle) {
        replyMessage = `✅ Menambahkan **${songs.length} lagu** dari playlist **${playlistTitle}**.`;
      } else if (!isQueueEmpty) {
        replyMessage = `✅ Ditambahkan ke antrian: **${songs[0].title}**.`;
      }

      // Hapus "Thinking..." dan ganti dengan pesan atau tidak sama sekali
      if (isQueueEmpty && !playlistTitle) {
        await interaction.deleteReply().catch(console.error);
      } else {
        await interaction.followUp({
          content: replyMessage,
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (!serverQueue.connection) {
      try {
        serverQueue.connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
      } catch (err) {
        client.queues.delete(interaction.guild.id);
        return interaction.followUp({
          content: `Gagal bergabung ke voice channel: ${err.message}`,
        });
      }
    }

    if (isQueueEmpty) {
      play(interaction.guild, serverQueue.songs[0], client);
    }
  },
};
