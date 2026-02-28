const { text } = require('express');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('song_project_db', 'tomturner', 'DBPassword', {
  host: 'localhost',
  port: 5432,
  dialect: 'postgres'
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

module.exports = sequelize;