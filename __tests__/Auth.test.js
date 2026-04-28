process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const privateKey = process.env.JWT_SECRET;

const mockVerifyIdToken = jest.fn();
const mockClientInstance = { verifyIdToken: mockVerifyIdToken };

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => mockClientInstance)
}));

jest.mock('../sequelize', () => ({
  models: {
    User: {
      findOne: jest.fn(),
      create: jest.fn()
    }
  }
}));

const sequelize = require('../sequelize');
const { decodeSessionToken, requireAuth, handleGoogleAuth } = require('../Auth');

describe('Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeSessionToken', () => {
    it('should return decoded token for valid JWT in cookie', () => {
      const token = jwt.sign({ user_id: 'test-user-123' }, privateKey);
      const req = { cookies: { session_jwt: token } };

      const result = decodeSessionToken(req);

      expect(result).toMatchObject({ user_id: 'test-user-123' });
    });

    it('should return null for invalid JWT in cookie', () => {
      const req = { cookies: { session_jwt: 'invalid-token' } };

      const result = decodeSessionToken(req);

      expect(result).toBeNull();
    });

    it('should return null when cookie is missing', () => {
      const req = { cookies: {} };

      const result = decodeSessionToken(req);

      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = jwt.sign({ user_id: 'test-user-123' }, privateKey, { expiresIn: '-1s' });
      const req = { cookies: { session_jwt: token } };

      const result = decodeSessionToken(req);

      expect(result).toBeNull();
    });
  });

  describe('requireAuth middleware', () => {
    it('should call next() and attach token for valid cookie', () => {
      const token = jwt.sign({ user_id: 'test-user-123' }, privateKey);
      const req = { cookies: { session_jwt: token } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.token).toMatchObject({ user_id: 'test-user-123' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid cookie', () => {
      const req = { cookies: { session_jwt: 'invalid-token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', message: 'Unauthorized' })
      );
    });

    it('should return 401 when cookie is missing', () => {
      const req = { cookies: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('handleGoogleAuth', () => {
    const makeRes = () => ({
      json: jest.fn(),
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis()
    });

    it('should set HttpOnly cookie and return user data for existing user', async () => {
      const mockPayload = { sub: 'google-123', name: 'Test User', email: 'test@example.com' };
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => mockPayload });
      sequelize.models.User.findOne.mockResolvedValue({ id: 'user-uuid-123' });

      const req = { body: { token: 'google-id-token' } };
      const res = makeRes();

      await handleGoogleAuth(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'session_jwt',
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test User', email: 'test@example.com', user_id: 'user-uuid-123' })
      );
      expect(res.json.mock.calls[0][0]).not.toHaveProperty('session_jwt');
    });

    it('should create new user and set cookie when user does not exist', async () => {
      const mockPayload = { sub: 'google-456', name: 'New User', email: 'new@example.com' };
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => mockPayload });
      sequelize.models.User.findOne.mockResolvedValue(null);
      sequelize.models.User.create.mockResolvedValue({});

      const req = { body: { token: 'google-id-token' } };
      const res = makeRes();

      await handleGoogleAuth(req, res);

      expect(sequelize.models.User.create).toHaveBeenCalledWith(
        expect.objectContaining({ google_login_id: 'google-456' })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'session_jwt',
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New User', email: 'new@example.com' })
      );
    });

    it('should return 401 when Google token verification fails', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const req = { body: { token: 'bad-token' } };
      const res = makeRes();

      await handleGoogleAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', message: 'Authentication failed' })
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });
});
