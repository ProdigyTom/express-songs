const { Sequelize } = require('sequelize');

const isProduction = process.env.NODE_ENV === 'production';

const sequelize = isProduction
  ? new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
      }
    )
  : new Sequelize({
      dialect: 'sqlite',
      storage: './dev.sqlite',
      logging: false,
    });

sequelize.define('User', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  google_login_id: {
    type: Sequelize.STRING,
    allowNull: false
  }
},
{
    tableName: 'users',
    timestamps: false
});

sequelize.define('Song', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false
  },
  artist: {
    type: Sequelize.STRING,
    allowNull: false
  },
  user_id: {
    type: Sequelize.UUID,
    allowNull: false
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  }
},
{
    tableName: 'songs',
    timestamps: false
});

sequelize.define('Tab', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  text: {
    type: Sequelize.TEXT,
    allowNull: false
  },
  scroll_speed: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  song_id: {
    type: Sequelize.UUID,
    allowNull: false
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  }
},
{
    tableName: 'tabs',
    timestamps: false
});

sequelize.define('Video', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  video_type: {
    type: Sequelize.STRING,
    allowNull: false
  },
  url: {
    type: Sequelize.STRING,
    allowNull: false
  },
  song_id: {
    type: Sequelize.UUID,
    allowNull: false
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  }
},
{
    tableName: 'videos',
    timestamps: false
});

// iLike is PostgreSQL-only; SQLite LIKE is case-insensitive for ASCII so Op.like suffices
sequelize.likeOp = isProduction ? Sequelize.Op.iLike : Sequelize.Op.like;

module.exports = sequelize;