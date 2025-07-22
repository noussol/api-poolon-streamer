const { DataTypes, Sequelize } = require('sequelize');
const logger = require('../services/logger');

/** @type {Sequelize} */
const sequelize = global.sequelize

const CATEGORY_ATTR = {
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  icon: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'inbox'
  }
}


const Category = sequelize.define('categories', CATEGORY_ATTR, {timestamps: false});

const syncTable = async () => {
  try {
    // Get existing table structure
    const existingAttributes = await sequelize.getQueryInterface().describeTable('categories');
    logger.debug(`existing attributes in categories Model are ${JSON.stringify(existingAttributes)}`)
    
    // Determine which attributes to add and which to remove
    const attributesToAdd = Object.keys(CATEGORY_ATTR).filter(attr => !existingAttributes[attr])
    const attributesToRemove = Object.keys(existingAttributes).filter(x => ![...Object.keys(CATEGORY_ATTR),'id', 'updatedAt', 'createdAt'].includes(x))

    logger.debug(`attributes to add in categories Model are ${attributesToAdd}`)
    logger.debug(`attributes to remove from categories Model are ${attributesToRemove}`)
    // Add new columns
    for (const attr of attributesToAdd) {
      const columnDefinition = CATEGORY_ATTR[attr];
      await sequelize.getQueryInterface().addColumn('categories', attr, columnDefinition);
      console.log(`Added column: ${attr}`);
    }

    // Remove unused columns
    for (const attr of attributesToRemove) {
      await sequelize.getQueryInterface().removeColumn('categories', attr);
      console.log(`Removed column: ${attr}`);
    }

    console.log('categories table schema updated successfully.');
  } catch (error) {
    console.error('Failed to update categories table schema:', error);
  }
  sequelize.sync()
    .then(() => console.log('categories table sync successfully.'))
    .catch((error) => console.error('Failed to create categories table:', error));
};

syncTable();

module.exports = { Category };