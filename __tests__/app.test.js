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
      findOne: jest.fn()
    },
    Tab: {
      findOne: jest.fn()
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
      expect(response.body).toEqual(mockTab);
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
