const mysql = require('mysql2/promise')
const { Sequelize } = require('sequelize')

exports.initDataBase = async (databaseInfos) => {
  global.sequelize = await this.setDb(databaseInfos)
}

exports.setDb = async (databaseInfos) => {
  let seqToReturn = null
  if(!databaseInfos.socketPath){

    const { host, port, user, password, database } = databaseInfos;
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
    await connection.query(`ALTER DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
  
    // connect to db
    seqToReturn =  new Sequelize(database, user, password, { dialect: 'mysql', host: host, port: port, logging: false });
  
  }else{
  
    const { host, port, user, password, database, socketPath } = databaseInfos;
    const connection = await mysql.createConnection({ host, port, user, password, socketPath });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
    await connection.query(`ALTER DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
  
    // connect to db
    seqToReturn = new Sequelize(database, user, password, { dialect: 'mysql', dialectOptions: {socketPath}, host: host, port: port, logging: false });
  }

  global.sequelize = seqToReturn


  const { Video } = require('../models/videosModel')
  const { Category } = require('../models/categoryModel')
  const { User } = require('../models/userModel')
  const { Device } = require('../models/deviceModel')
  const { UserDevice } = require('../models/userDeviceModel')
  const { DeviceUse } = require('../models/deviceUseModel')
  const { UserCategory } = require('../models/userCategoryModel')
  const { Version } = require('../models/versionModel')

  Video.belongsTo(Category, { foreignKey: 'id_category', as: 'category' , onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  Category.hasMany(Video, { foreignKey: 'id_category', as: 'videos' , onDelete: 'CASCADE', onUpdate: 'CASCADE' });


  User.belongsToMany(Category, { through: UserCategory, foreignKey: 'id_user', as: 'categories', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  Category.belongsToMany(User, { through: UserCategory, foreignKey: 'id_category', as: 'users', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

  User.belongsToMany(Device, { through: UserDevice, foreignKey: 'id_user', as: 'devices', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  Device.belongsToMany(User, { through: UserDevice, foreignKey: 'id_device', as: 'users', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  User.hasMany(Device, { foreignKey: 'main_user', as: 'mainDevices', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  Device.belongsTo(User, { foreignKey: 'main_user', as: 'mainUser', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  Device.hasMany(DeviceUse, { foreignKey: 'id_device', as: 'uses', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  DeviceUse.belongsTo(Device, { foreignKey: 'id_device', as: 'device', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

  Version.hasMany(Device, { foreignKey: 'id_version', as: 'devices', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  Device.belongsTo(Version, { foreignKey: 'id_version', as: 'version', onDelete: 'SET NULL', onUpdate: 'CASCADE' });


  return seqToReturn
}