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
          res.json(result);
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});