const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const USER_ATTR = {
  mail: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  first_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  should_change_password: {
    type: DataTypes.BOOLEAN,
    default: true
  },
  // When null the user is valid undefinetly
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_connected: {
    type: DataTypes.DATE,
    allowNull: true
  }

}


const User = sequelize.define('users', USER_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('users');
    logger.debug(`existing attributes in users Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(USER_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(USER_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in users Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from users Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = USER_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('users', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('users', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('users table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update users table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('users table sync successfully.'))
    .catch((error) => console.error('Failed to create users table:', error));
};

syncTable();

module.exports = { User };