const request = require('supertest');
const jwt = require('jsonwebtoken');

const privateKey = 'my_super_secret_key';

// Create mock client instance that we can control
const mockVerifyIdToken = jest.fn();
const mockClientInstance = {
  verifyIdToken: mockVerifyIdToken
};

// Mock dependencies before requiring app
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => mockClientInstance)
}));

jest.mock('../sequelize', () => ({
  models: {
    User: {
      findOne: jest.fn(),
      create: jest.fn()
    },
    Song: {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn()
    },
    Tab: {
      findOne: jest.fn(),
      create: jest.fn()
    },
    Video: {
      findAll: jest.fn(),
      create: jest.fn()
    }
  }
}));

const sequelize = require('../sequelize');
const app = require('../app');

// Helper to create valid auth token
const createAuthToken = (userId = 'test-user-123') => {
  return jwt.sign({ user_id: userId }, privateKey);
};

describe('Express App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/songs', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/songs');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Unauthorized'
      });
    });

    it('should return songs for authenticated user', async () => {
      const mockSongs = [
        { id: 'song-1', title: 'Song One', artist: 'Artist A', user_id: 'test-user-123' },
        { id: 'song-2', title: 'Song Two', artist: 'Artist B', user_id: 'test-user-123' }
      ];

      sequelize.models.Song.findAll.mockResolvedValue(mockSongs);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/songs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSongs);
      expect(sequelize.models.Song.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'test-user-123' }),
          limit: 10,
          offset: 0
        })
      );
    });

    it('should respect limit and offset parameters', async () => {
      sequelize.models.Song.findAll.mockResolvedValue([]);

      const token = createAuthToken();
      await request(app)
        .get('/api/songs?limit=5&offset=10')
        .set('Authorization', `Bearer ${token}`);

      expect(sequelize.models.Song.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 10
        })
      );
    });

    it('should handle search query parameter', async () => {
      sequelize.models.Song.findAll.mockResolvedValue([]);

      const token = createAuthToken();
      await request(app)
        .get('/api/songs?query=test')
        .set('Authorization', `Bearer ${token}`);

      expect(sequelize.models.Song.findAll).toHaveBeenCalled();
      const callArgs = sequelize.models.Song.findAll.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('user_id', 'test-user-123');
    });

    it('should return 500 on database error', async () => {
      sequelize.models.Song.findAll.mockRejectedValue(new Error('Database error'));

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/songs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Internal Server Error'
      });
    });
  });

  describe('GET /api/songs/:id', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/songs/song-123');

      expect(response.status).toBe(401);
    });

    it('should return song for valid id', async () => {
      const mockSong = {
        id: 'song-123',
        title: 'Test Song',
        artist: 'Test Artist',
        user_id: 'test-user-123'
      };

      sequelize.models.Song.findOne.mockResolvedValue(mockSong);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/songs/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'song-123',
        title: 'Test Song',
        artist: 'Test Artist'
      });
    });

    it('should return 404 for non-existent song', async () => {
      sequelize.models.Song.findOne.mockResolvedValue(null);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/songs/non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        id: 'not_found',
        message: 'Song not found'
      });
    });

    it('should return 500 on database error', async () => {
      sequelize.models.Song.findOne.mockRejectedValue(new Error('Database error'));

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/songs/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Internal Server Error'
      });
    });
  });

  describe('GET /api/tabs/:songId', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/tabs/song-123');

      expect(response.status).toBe(401);
    });

    it('should return tab for valid song', async () => {
      const mockSong = {
        id: 'song-123',
        title: 'Test Song',
        artist: 'Test Artist',
        user_id: 'test-user-123'
      };

      const mockTab = {
        id: 'tab-123',
        text: 'Am G C F',
        song_id: 'song-123'
      };

      sequelize.models.Song.findOne.mockResolvedValue(mockSong);
      sequelize.models.Tab.findOne.mockResolvedValue(mockTab);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/tabs/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'tab-123',
        text: 'Am G C F'
      });
    });

    it('should return 404 when song not found', async () => {
      sequelize.models.Song.findOne.mockResolvedValue(null);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/tabs/non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Song not found'
      });
    });

    it('should return 500 on database error', async () => {
      sequelize.models.Song.findOne.mockRejectedValue(new Error('Database error'));

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/tabs/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Internal Server Error'
      });
    });
  });

  describe('GET /api/videos/:songId', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/videos/song-123');

      expect(response.status).toBe(401);
    });

    it('should return videos for valid song', async () => {
      const mockSong = {
        id: 'song-123',
        title: 'Test Song',
        artist: 'Test Artist',
        user_id: 'test-user-123'
      };

      const mockVideos = [
        {
          id: 'video-1',
          video_type: 'youtube',
          url: 'https://youtube.com/watch?v=abc123',
          song_id: 'song-123',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'video-2',
          video_type: 'vimeo',
          url: 'https://vimeo.com/123456',
          song_id: 'song-123',
          created_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z'
        }
      ];

      sequelize.models.Song.findOne.mockResolvedValue(mockSong);
      sequelize.models.Video.findAll.mockResolvedValue(mockVideos);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/videos/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: 'video-1', video_type: 'youtube', url: 'https://youtube.com/watch?v=abc123' },
        { id: 'video-2', video_type: 'vimeo', url: 'https://vimeo.com/123456' }
      ]);
      expect(sequelize.models.Video.findAll).toHaveBeenCalledWith({
        where: { song_id: 'song-123' }
      });
    });

    it('should return empty array when song has no videos', async () => {
      const mockSong = {
        id: 'song-123',
        title: 'Test Song',
        artist: 'Test Artist',
        user_id: 'test-user-123'
      };

      sequelize.models.Song.findOne.mockResolvedValue(mockSong);
      sequelize.models.Video.findAll.mockResolvedValue([]);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/videos/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 404 when song not found', async () => {
      sequelize.models.Song.findOne.mockResolvedValue(null);

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/videos/non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Song not found'
      });
    });

    it('should return 500 on database error', async () => {
      sequelize.models.Song.findOne.mockRejectedValue(new Error('Database error'));

      const token = createAuthToken();
      const response = await request(app)
        .get('/api/videos/song-123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Internal Server Error'
      });
    });
  });

  describe('POST /api/songs', () => {
    const validPayload = {
      title: 'Wonderwall',
      artist: 'Oasis',
      tab_text: 'Em7 G Dsus4 A7sus4',
      videos: [
        { url: 'https://youtube.com/watch?v=abc', video_type: 'youtube' },
        { url: 'https://vimeo.com/123', video_type: 'vimeo' }
      ]
    };

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/songs')
        .send(validPayload);

      expect(response.status).toBe(401);
    });

    it('should return 400 when title is missing', async () => {
      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ artist: 'Oasis', tab_text: 'Am G' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'title, artist, and tab_text are required'
      });
    });

    it('should return 400 when artist is missing', async () => {
      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', tab_text: 'Am G' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'title, artist, and tab_text are required'
      });
    });

    it('should return 400 when tab_text is missing', async () => {
      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', artist: 'Oasis' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'title, artist, and tab_text are required'
      });
    });

    it('should return 400 when videos is not an array', async () => {
      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', artist: 'Oasis', tab_text: 'Am G', videos: 'not-array' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'videos must be an array'
      });
    });

    it('should return 400 when more than 5 videos are provided', async () => {
      const videos = Array.from({ length: 6 }, (_, i) => ({
        url: `https://youtube.com/watch?v=${i}`,
        video_type: 'youtube'
      }));

      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', artist: 'Oasis', tab_text: 'Am G', videos });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Maximum of 5 videos allowed'
      });
    });

    it('should return 400 when a video is missing url', async () => {
      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Wonderwall',
          artist: 'Oasis',
          tab_text: 'Am G',
          videos: [{ video_type: 'youtube' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Each video must have a url and video_type'
      });
    });

    it('should return 400 when a video is missing video_type', async () => {
      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Wonderwall',
          artist: 'Oasis',
          tab_text: 'Am G',
          videos: [{ url: 'https://youtube.com/watch?v=abc' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Each video must have a url and video_type'
      });
    });

    it('should create song, tab, and videos successfully', async () => {
      const mockSong = { id: 'song-new-123', title: 'Wonderwall', artist: 'Oasis' };
      const mockTab = { id: 'tab-new-123', text: 'Em7 G Dsus4 A7sus4' };
      const mockVideos = [
        { id: 'video-new-1', video_type: 'youtube', url: 'https://youtube.com/watch?v=abc' },
        { id: 'video-new-2', video_type: 'vimeo', url: 'https://vimeo.com/123' }
      ];

      sequelize.models.Song.create.mockResolvedValue(mockSong);
      sequelize.models.Tab.create.mockResolvedValue(mockTab);
      sequelize.models.Video.create
        .mockResolvedValueOnce(mockVideos[0])
        .mockResolvedValueOnce(mockVideos[1]);

      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        song: { id: 'song-new-123', title: 'Wonderwall', artist: 'Oasis' },
        tab: { id: 'tab-new-123', text: 'Em7 G Dsus4 A7sus4' },
        videos: [
          { id: 'video-new-1', video_type: 'youtube', url: 'https://youtube.com/watch?v=abc' },
          { id: 'video-new-2', video_type: 'vimeo', url: 'https://vimeo.com/123' }
        ]
      });

      expect(sequelize.models.Song.create).toHaveBeenCalledWith({
        title: 'Wonderwall',
        artist: 'Oasis',
        user_id: 'test-user-123'
      });
      expect(sequelize.models.Tab.create).toHaveBeenCalledWith({
        text: 'Em7 G Dsus4 A7sus4',
        song_id: 'song-new-123'
      });
      expect(sequelize.models.Video.create).toHaveBeenCalledTimes(2);
    });

    it('should create song with no videos when videos array is empty', async () => {
      const mockSong = { id: 'song-new-123', title: 'Wonderwall', artist: 'Oasis' };
      const mockTab = { id: 'tab-new-123', text: 'Am G' };

      sequelize.models.Song.create.mockResolvedValue(mockSong);
      sequelize.models.Tab.create.mockResolvedValue(mockTab);

      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', artist: 'Oasis', tab_text: 'Am G', videos: [] });

      expect(response.status).toBe(201);
      expect(response.body.videos).toEqual([]);
      expect(sequelize.models.Video.create).not.toHaveBeenCalled();
    });

    it('should create song with no videos when videos is omitted', async () => {
      const mockSong = { id: 'song-new-123', title: 'Wonderwall', artist: 'Oasis' };
      const mockTab = { id: 'tab-new-123', text: 'Am G' };

      sequelize.models.Song.create.mockResolvedValue(mockSong);
      sequelize.models.Tab.create.mockResolvedValue(mockTab);

      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', artist: 'Oasis', tab_text: 'Am G' });

      expect(response.status).toBe(201);
      expect(response.body.videos).toEqual([]);
      expect(sequelize.models.Video.create).not.toHaveBeenCalled();
    });

    it('should allow exactly 5 videos', async () => {
      const videos = Array.from({ length: 5 }, (_, i) => ({
        url: `https://youtube.com/watch?v=${i}`,
        video_type: 'youtube'
      }));

      const mockSong = { id: 'song-new-123', title: 'Wonderwall', artist: 'Oasis' };
      const mockTab = { id: 'tab-new-123', text: 'Am G' };

      sequelize.models.Song.create.mockResolvedValue(mockSong);
      sequelize.models.Tab.create.mockResolvedValue(mockTab);
      videos.forEach((_, i) => {
        sequelize.models.Video.create.mockResolvedValueOnce({
          id: `video-${i}`,
          video_type: 'youtube',
          url: `https://youtube.com/watch?v=${i}`
        });
      });

      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Wonderwall', artist: 'Oasis', tab_text: 'Am G', videos });

      expect(response.status).toBe(201);
      expect(response.body.videos).toHaveLength(5);
      expect(sequelize.models.Video.create).toHaveBeenCalledTimes(5);
    });

    it('should return 500 on database error', async () => {
      sequelize.models.Song.create.mockRejectedValue(new Error('Database error'));

      const token = createAuthToken();
      const response = await request(app)
        .post('/api/songs')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Internal Server Error'
      });
    });
  });

  describe('POST /api/auth/google', () => {
    it('should authenticate existing user', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-123',
          name: 'Test User',
          email: 'test@example.com'
        })
      });

      sequelize.models.User.findOne.mockResolvedValue({
        id: 'user-uuid-123'
      });

      const response = await request(app)
        .post('/api/auth/google')
        .send({ token: 'google-id-token' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'Test User',
        email: 'test@example.com',
        user_id: 'user-uuid-123'
      });
      expect(response.body).toHaveProperty('session_jwt');
    });
  });
});
