const jwt = require('jsonwebtoken');

// Create mock client instance that we can control
const mockVerifyIdToken = jest.fn();
const mockClientInstance = {
  verifyIdToken: mockVerifyIdToken
};

// Mock dependencies before requiring Auth module
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => mockClientInstance)
}));

jest.mock('../sequelize', () => ({
  models: {
    User: {
      findOne: jest.fn(),
      create: jest.fn()
    },
    user: {
      create: jest.fn()
    }
  }
}));

const sequelize = require('../sequelize');
const { decodeSessionToken, requireAuth, handleGoogleAuth } = require('../Auth');

const privateKey = 'my_super_secret_key';

describe('Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeSessionToken', () => {
    it('should return decoded token for valid JWT', () => {
      const token = jwt.sign({ user_id: 'test-user-123' }, privateKey);
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };

      const result = decodeSessionToken(req);

      expect(result).toMatchObject({ user_id: 'test-user-123' });
    });

    it('should return null for invalid JWT', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };

      const result = decodeSessionToken(req);

      expect(result).toBeNull();
    });

    it('should return null when authorization header is missing', () => {
      const req = {
        headers: {}
      };

      const result = decodeSessionToken(req);

      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = jwt.sign({ user_id: 'test-user-123' }, privateKey, { expiresIn: '-1s' });
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };

      const result = decodeSessionToken(req);

      expect(result).toBeNull();
    });
  });

  describe('requireAuth middleware', () => {
    it('should call next() and attach token for valid auth', () => {
      const token = jwt.sign({ user_id: 'test-user-123' }, privateKey);
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.token).toMatchObject({ user_id: 'test-user-123' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid auth', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Unauthorized'
        })
      );
    });

    it('should return 401 when authorization header is missing', () => {
      const req = {
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('handleGoogleAuth', () => {
    it('should return user data for existing user', async () => {
      const mockPayload = {
        sub: 'google-123',
        name: 'Test User',
        email: 'test@example.com'
      };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload
      });

      sequelize.models.User.findOne.mockResolvedValue({
        id: 'user-uuid-123'
      });

      const req = {
        body: { token: 'google-id-token' }
      };
      const res = {
        json: jest.fn()
      };

      await handleGoogleAuth(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com',
          user_id: 'user-uuid-123'
        })
      );
      expect(res.json.mock.calls[0][0]).toHaveProperty('session_jwt');
    });

    it('should create new user when user does not exist', async () => {
      const mockPayload = {
        sub: 'google-456',
        name: 'New User',
        email: 'new@example.com'
      };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload
      });

      sequelize.models.User.findOne.mockResolvedValue(null);
      sequelize.models.user.create.mockResolvedValue({});

      const req = {
        body: { token: 'google-id-token' }
      };
      const res = {
        json: jest.fn()
      };

      await handleGoogleAuth(req, res);

      expect(sequelize.models.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          google_login_id: 'google-456'
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@example.com'
        })
      );
    });
  });
});
