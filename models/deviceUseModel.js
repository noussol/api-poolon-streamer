const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const DEVICE_USE_ATTR = {
  id_device: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  from: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true, // in seconds
  },
  connected_to_internet: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  city: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  ip: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // When null, it was a personnal video
  id_category: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // When null, it was a personnal video
  id_video: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}


const DeviceUse = sequelize.define('device_uses', DEVICE_USE_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('device_uses');
    logger.debug(`existing attributes in device_uses Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(DEVICE_USE_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(DEVICE_USE_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in device_uses Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from device_uses Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = DEVICE_USE_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('device_uses', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('device_uses', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('device_uses table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update device_uses table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('device_uses table sync successfully.'))
    .catch((error) => console.error('Failed to create device_uses table:', error));
};

syncTable();

module.exports = { DeviceUse };