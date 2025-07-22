const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const USER_DEVICE_ATTR = {
  id_user: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  id_device: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
}


const UserDevice = sequelize.define('user_devices', USER_DEVICE_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('user_devices');
    logger.debug(`existing attributes in user_devices Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(USER_DEVICE_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(USER_DEVICE_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in user_devices Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from user_devices Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = USER_DEVICE_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('user_devices', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('user_devices', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('user_devices table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update user_devices table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('user_devices table sync successfully.'))
    .catch((error) => console.error('Failed to create user_devices table:', error));
};

syncTable();

module.exports = { UserDevice };