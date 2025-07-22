const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const USER_CATEGORY_ATTR = {
  id_user: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  id_category: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
}


const UserCategory = sequelize.define('user_categories', USER_CATEGORY_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('user_categories');
    logger.debug(`existing attributes in user_categories Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(USER_CATEGORY_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(USER_CATEGORY_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in user_categories Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from user_categories Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = USER_CATEGORY_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('user_categories', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('user_categories', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('user_categories table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update user_categories table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('user_categories table sync successfully.'))
    .catch((error) => console.error('Failed to create user_categories table:', error));
};

syncTable();

module.exports = { UserCategory };