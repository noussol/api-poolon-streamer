const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const VIDEO_ATTR = {
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  id_category: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  size: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  src: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  img: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
}


const Video = sequelize.define('videos', VIDEO_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('videos');
    logger.debug(`existing attributes in videos Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(VIDEO_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(VIDEO_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in videos Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from videos Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = VIDEO_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('videos', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('videos', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('videos table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update videos table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('videos table sync successfully.'))
    .catch((error) => console.error('Failed to create videos table:', error));
};

syncTable();

module.exports = { Video };