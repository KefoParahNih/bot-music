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

    const resource = createAudioResource(song.stream_url, {
      metadata: { title: song.title },
      inputType: StreamType.Arbitrary, // Anda bisa bereksperimen dengan ini
    });

    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.removeAllListeners("error");
    serverQueue.player.on("error", (error) => {
      console.error(
        `Error: ${error.message} with resource ${error.resource.metadata.title}`
      );
      serverQueue.textChannel.send(
        `❌ Terjadi error saat memutar lagu. Melewati...`
      );
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
    if (serverQueue.songs.length > 0) serverQueue.songs.shift();
    play(guild, serverQueue.songs[0], client);
  }

  serverQueue.player.removeAllListeners(AudioPlayerStatus.Idle);
  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    if (serverQueue.loopMode === 1) {
      // Loop lagu
    } else if (serverQueue.loopMode === 2) {
      // Loop antrian
      serverQueue.songs.push(serverQueue.songs.shift());
    } else {
      // Loop mati
      serverQueue.songs.shift();
    }

    // --- PERBAIKAN UTAMA: MEMBERI JEDA UNTUK MENCEGAH RACE CONDITION ---
    setTimeout(() => {
      // Cek lagi apakah antrian masih ada, karena bisa saja user menekan tombol stop
      // saat jeda singkat ini.
      if (client.queues.has(guild.id)) {
        play(guild, serverQueue.songs[0], client);
      }
    }, 1000); // Jeda 500 milidetik (0.5 detik) sebelum memutar lagu selanjutnya
  });
};

module.exports = {
  createButtonRow,
  play,
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
          return {
            title: track.title,
            url: track.permalink_url,
            thumbnail: track.artwork_url || "https://i.imgur.com/xK30X7V.png",
            duration: track.duration / 1000,
            author: track.user.username,
            stream_url: await scdl
              .download(track.permalink_url)
              .catch(() => null),
            requester: interaction.user,
          };
        });
        songs = (await Promise.all(trackPromises)).filter((s) => s.stream_url);
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

    if (songs.length === 0) {
      return interaction.followUp({
        content:
          "Tidak ada lagu yang valid yang bisa ditambahkan dari sumber tersebut.",
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

      if (isQueueEmpty && !playlistTitle) {
        await interaction.deleteReply().catch(console.error);
      } else {
        await interaction.followUp({ content: replyMessage, ephemeral: true });
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
