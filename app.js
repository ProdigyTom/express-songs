const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;
const cors = require('cors');
const sequelize = require('./sequelize');
const { Sequelize } = require('sequelize');
const { requireAuth, handleGoogleAuth } = require('./Auth');

allowedOrigins = [
  'http://localhost:3000',
  'https://song-project.xyz'
];

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json());

app.post('/api/auth/google', async (req, res) => handleGoogleAuth(req, res));

app.get('/api/songs', requireAuth, (req, res) => {
  const userId = req.token.user_id;

  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  const query = req.query.query ? `%${req.query.query}%` : null;

  sequelize.models.Song.findAll({
    where: {
      user_id: userId,
      ...(query && {
        [Sequelize.Op.or]: [
          { title: { [Sequelize.Op.iLike]: query } },
          { artist: { [Sequelize.Op.iLike]: query } }
        ]
      })
    },
    order: [['artist', 'ASC'], ['title', 'ASC']],
    limit,
    offset
  })
  .then(result => {
    res.json(result);
  })
  .catch(err => {
    console.error('Error executing query', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  });
});

app.get('/api/songs/:id', requireAuth, (req, res) => {
  const userId = req.token.user_id;

  const songId = req.params.id;
  sequelize.models.Song.findOne({ where: { id: songId, user_id: userId } })
    .then(result => {
      if (!result) {
        return res.status(404).json({
          id: 'not_found',
          message: 'Song not found',
          timestamp: new Date().toISOString(),
        });
      } 

      const song = result;

      res.json({
        id: song.id,
        title: song.title,
        artist: song.artist
      });
    })
    .catch(err => {
      console.error('Error executing query', err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
});

app.get('/api/tabs/:songId', requireAuth, (req, res) => {
  const userId = req.token.user_id;
  const songId = req.params.songId;

  sequelize.models.Song.findOne({ where: { id: songId, user_id: userId } })
    .then(song => {
      if (!song) {
        return res.status(404).json({
          status: 'error',
          message: 'Song not found',
          timestamp: new Date().toISOString(),
        });
      }

      sequelize.models.Tab.findOne({ where: { song_id: songId } })
        .then(result => {
          res.json({
            id: result.id,
            text: result.text
          });
        });
    })
    .catch(err => {
      console.error('Error executing query', err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
});

app.get('/api/videos/:songId', requireAuth, (req, res) => {
  const userId = req.token.user_id;
  const songId = req.params.songId;

  sequelize.models.Song.findOne({ where: { id: songId, user_id: userId } })
    .then(song => {
      if (!song) {
        return res.status(404).json({
          status: 'error',
          message: 'Song not found',
          timestamp: new Date().toISOString(),
        });
      }

      sequelize.models.Video.findAll({ where: { song_id: songId } })
        .then(result => {
          res.json(result.map(video => ({
            id: video.id,
            video_type: video.video_type,
            url: video.url
          })));
        });
    })
    .catch(err => {
      console.error('Error executing query', err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
});

app.delete('/api/songs/:songId', requireAuth, (req, res) => {
  const userId = req.token.user_id;
  const songId = req.params.songId;

  sequelize.models.Song.findOne({ where: { id: songId, user_id: userId } })
    .then(song => {
      if (!song) {
        return res.status(404).json({
          status: 'error',
          message: 'Song not found',
          timestamp: new Date().toISOString(),
        });
      }

      const videoPromise = sequelize.models.Video.destroy({ where: { song_id: songId } })
      const tabPromise = sequelize.models.Tab.destroy({ where: { song_id: songId } })
      const songPromise = song.destroy();

      return Promise.all([videoPromise, tabPromise, songPromise])
        .then(() => {
          res.status(204).send();
        });
    })
    .catch(err => {
      console.error('Error executing query', err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
});

app.post('/api/songs', requireAuth, (req, res) => {
  const userId = req.token.user_id;
  const { title, artist, tab_text, videos } = req.body;

  if (!title || !artist || !tab_text) {
    return res.status(400).json({
      status: 'error',
      message: 'title, artist, and tab_text are required',
      timestamp: new Date().toISOString(),
    });
  }

  if (videos && !Array.isArray(videos)) {
    return res.status(400).json({
      status: 'error',
      message: 'videos must be an array',
      timestamp: new Date().toISOString(),
    });
  }

  if (videos && videos.length > 5) {
    return res.status(400).json({
      status: 'error',
      message: 'Maximum of 5 videos allowed',
      timestamp: new Date().toISOString(),
    });
  }

  if (videos && videos.some(v => !v.url || !v.video_type)) {
    return res.status(400).json({
      status: 'error',
      message: 'Each video must have a url and video_type',
      timestamp: new Date().toISOString(),
    });
  }

  sequelize.models.Song.create({
    title,
    artist,
    user_id: userId
  })
    .then(song => {
      const tabPromise = sequelize.models.Tab.create({
        text: tab_text,
        song_id: song.id
      });

      const videoPromises = (videos || []).map(video =>
        sequelize.models.Video.create({
          url: video.url,
          video_type: video.video_type,
          song_id: song.id
        })
      );

      return Promise.all([tabPromise, ...videoPromises])
        .then(([tab, ...createdVideos]) => {
          res.status(201).json({
            song: {
              id: song.id,
              title: song.title,
              artist: song.artist
            },
            tab: {
              id: tabPromise.id,
              text: tabPromise.text
            },
            videos: videoPromises.map(v => ({
              id: v.id,
              video_type: v.video_type,
              url: v.url
            }))
          });
        });
    })
    .catch(err => {
      console.error('Error creating song', err.message);
      console.error('Error Stack', err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
});

app.put('/api/songs/:songId', requireAuth, (req, res) => {
  const userId = req.token.user_id;
  const songId = req.params.songId;
  const { title, artist, tab_text, videos } = req.body;

  if (!title || !artist || !tab_text) {
    return res.status(400).json({
      status: 'error',
      message: 'title, artist, and tab_text are required',
      timestamp: new Date().toISOString(),
    });
  }

  if (videos && !Array.isArray(videos)) {
    return res.status(400).json({
      status: 'error',
      message: 'videos must be an array',
      timestamp: new Date().toISOString(),
    });
  }

  if (videos && videos.length > 5) {
    return res.status(400).json({
      status: 'error',
      message: 'Maximum of 5 videos allowed',
      timestamp: new Date().toISOString(),
    });
  }

  if (videos && videos.some(v => !v.url || !v.video_type)) {
    return res.status(400).json({
      status: 'error',
      message: 'Each video must have a url and video_type',
      timestamp: new Date().toISOString(),
    });
  }

  sequelize.models.Song.findOne({ where: { id: songId, user_id: userId } })
    .then(song => {
      if (!song) {
        return res.status(404).json({
          status: 'error',
          message: 'Song not found',
          timestamp: new Date().toISOString(),
        });
      }

      song.title = title;
      song.artist = artist;

      const tabPromise = sequelize.models.Tab.findOne({ where: { song_id: songId } })
        .then(tab => {
          if (!tab) {
            return Promise.reject(new Error('Tab not found'));
          }
          tab.text = tab_text;
          return tab.save();
        });

      sequelize.models.Video.findAll({ where: { song_id: songId } }).then(existingVideos => {
        // update videos if they exist, create new ones if they don't, delete videos not in the new list
        const existingVideoIds = existingVideos.map(v => v.id);
        const newVideoIds = (videos || []).map(v => v.id).filter(Boolean);

        const videosToDelete = existingVideoIds.filter(id => !newVideoIds.includes(id));
        const videosToUpdate = existingVideos.filter(v => newVideoIds.includes(v.id));
        const videosToCreate = (videos || []).filter(v => !v.id);

        // Delete videos
        videosToDelete.map(id => sequelize.models.Video.destroy({ where: { id } }));

        // Update videos
        const updatePromises = videosToUpdate.map(video => {
          const newData = videos.find(v => v.id === video.id);
          if (newData) {
            video.url = newData.url;
            video.video_type = newData.video_type;
            return video.save();
          }
          return Promise.resolve();
        });

        // Create new videos
        const createPromises = videosToCreate.map(video => {
          return sequelize.models.Video.create({
            url: video.url,
            video_type: video.video_type,
            song_id: songId
          });
        });

        return Promise.all([tabPromise,, ...updatePromises, ...createPromises])
        .then(() => {
          res.status(200).json({
            song: {
              id: song.id,
              title: song.title,
              artist: song.artist
            },
            tab: {
              id: tabPromise.id,
              text: tabPromise.text
            },
            videos: [...updatePromises, ...createPromises].map(v => ({
              id: v.id,
              video_type: v.video_type,
              url: v.url
            }))
          });
        });
      });
    })
    .catch(err => {
      console.error('Error updating song', err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;