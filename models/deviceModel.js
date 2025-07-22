const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');
const { hash } = require('crypto');

/** @type {Sequelize} */
const sequelize = global.sequelize

const DEVICE_ATTR = {
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  id_version:{
    type: DataTypes.INTEGER,
    allowNull: true
  },
//   Space in MB
  total_space: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  used_space: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  // When null the user is valid undefinetly
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  main_user: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  paiment_ref: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  is_connected_to_internet: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  current_wifi: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  last_city: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  last_country: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  last_connection: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_localization: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true
  },
  last_ip: {
    type: DataTypes.STRING(255),
    allowNull: true
  }

}


const Device = sequelize.define('devices', DEVICE_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('devices');
    logger.debug(`existing attributes in devices Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(DEVICE_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(DEVICE_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in devices Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from devices Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = DEVICE_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('devices', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('devices', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('devices table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update devices table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('devices table sync successfully.'))
    .catch((error) => console.error('Failed to create devices table:', error));
};

syncTable();

module.exports = { Device };