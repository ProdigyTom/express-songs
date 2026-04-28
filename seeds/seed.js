// Populates the local SQLite dev database from seeds/data.json.
// Run with: npm run seed
// WARNING: drops and recreates all tables — any local changes will be lost.
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const sequelize = require('../sequelize');
const data = require('./data.json');

async function run() {
  await sequelize.sync({ force: true });

  const { User, Song, Tab, Video } = sequelize.models;

  for (const row of data.users) await User.create(row);
  for (const row of data.songs) await Song.create(row);
  for (const row of data.tabs) await Tab.create(row);
  for (const row of data.videos) await Video.create(row);

  console.log(`Seeded: ${data.users.length} users, ${data.songs.length} songs, ${data.tabs.length} tabs, ${data.videos.length} videos`);
  await sequelize.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
