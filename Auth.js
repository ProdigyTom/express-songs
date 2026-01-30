const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = '348459928331-3g606qfio1p157c6f9lblr31osb5ao78.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const jwt = require('jsonwebtoken');
const sequelize = require('./sequelize');

const privateKey = 'my_super_secret_key';

const handleGoogleAuth = async (req, res) => {
  const { token } = req.body;
  const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  const google_user_id = payload.sub;

  sequelize.models.User.findOne({ where: { google_login_id: google_user_id } }).then(user => {
    if (user) {
      const user_id = user.id;
      const session_jwt = jwt.sign({ user_id: user_id }, privateKey)

      res.json({ name: payload.name, email: payload.email, user_id, session_jwt });
    } else {
      // If they don't exist create a new user
      const user_id = uuidv4();

      sequelize.models.user.create({ id: user_id, google_login_id: google_user_id }).then(() => {
        const session_jwt = jwt.sign({ user_id: user_id }, privateKey)
        res.json({ name: payload.name, email: payload.email, user_id, session_jwt });
      });
    }
  });
};

const decodeSessionToken = (req) => {
  const token = req.headers['authorization']?.split(' ')[1];

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