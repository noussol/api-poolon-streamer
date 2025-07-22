const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const ADMIN_ATTR = {
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
  should_change_password: {
    type: DataTypes.BOOLEAN,
    default: true
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'admin'
  },
}


const Admin = sequelize.define('admins', ADMIN_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('admins');
    logger.debug(`existing attributes in admins Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(ADMIN_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(ADMIN_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in admins Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from admins Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = ADMIN_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('admins', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('admins', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('admins table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update admins table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('admins table sync successfully.'))
    .catch((error) => console.error('Failed to create admins table:', error));
};

syncTable();

module.exports = { Admin };