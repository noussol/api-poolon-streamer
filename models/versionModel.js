const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const VERSION_ATTR = {
  device: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  android: {
    type: DataTypes.STRING(255),
    defaultValue: false
  },
  ios:{
    type: DataTypes.STRING(255),
    allowNull: false
  },
  androidUrl: {
    type: DataTypes.STRING(255),
    defaultValue: false
  },
  iosUrl:{
    type: DataTypes.STRING(255),
    allowNull: false
  },
}


const Version = sequelize.define('versions', VERSION_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('versions');
    logger.debug(`existing attributes in versions Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(VERSION_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(VERSION_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in versions Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from versions Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = VERSION_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('versions', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('versions', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('versions table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update versions table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('versions table sync successfully.'))
    .catch((error) => console.error('Failed to create versions table:', error));
};

syncTable();

module.exports = { Version };