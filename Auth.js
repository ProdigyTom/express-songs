const { OAuth2Client } = require('google-auth-library');
const { randomUUID } = require('crypto');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const jwt = require('jsonwebtoken');
const sequelize = require('./sequelize');

const privateKey = process.env.JWT_SECRET;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const handleGoogleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const google_user_id = payload.sub;

    const user = await sequelize.models.User.findOne({ where: { google_login_id: google_user_id } });

    if (user) {
      const user_id = user.id;
      const session_jwt = jwt.sign({ user_id: user_id }, privateKey, { expiresIn: '7d' });
      res.cookie('session_jwt', session_jwt, COOKIE_OPTIONS);
      res.json({ name: payload.name, email: payload.email, user_id });
    } else {
      const user_id = randomUUID();
      await sequelize.models.User.create({ id: user_id, google_login_id: google_user_id });
      const session_jwt = jwt.sign({ user_id: user_id }, privateKey, { expiresIn: '7d' });
      res.cookie('session_jwt', session_jwt, COOKIE_OPTIONS);
      res.json({ name: payload.name, email: payload.email, user_id });
    }
  } catch (error) {
    res.status(401).json({ status: 'error', message: 'Authentication failed' });
  }
};

const decodeSessionToken = (req) => {
  const token = req.cookies?.session_jwt;

  try {
    return jwt.verify(token, privateKey);
  } catch (error) {
    return null;
  }
};

const requireAuth = (req, res, next) => {
  const decoded = decodeSessionToken(req);

  if (!decoded) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized',
      timestamp: new Date().toISOString(),
    });
  }

  req.token = decoded;
  next();
};

module.exports = {
  handleGoogleAuth,
  decodeSessionToken,
  requireAuth
};