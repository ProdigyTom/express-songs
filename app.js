const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const sequelize = require('./sequelize');
const { Sequelize } = require('sequelize');
const { requireAuth, handleGoogleAuth } = require('./Auth');

allowedOrigins = [
  'http://localhost:5173',
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
              id: tab.id,
              text: tab.text
            },
            videos: createdVideos.map(v => ({
              id: v.id,
              video_type: v.video_type,
              url: v.url
            }))
          });
        });
    })
    .catch(err => {
      console.error('Error creating song', err.stack);
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