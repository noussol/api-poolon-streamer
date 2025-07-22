const express = require('express');
const { decryptPassword } = require('../services/helpers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../services/logger');
const { Op } = require('sequelize');
const { User } = require('../models/userModel');
const { Admin } = require('../models/adminModel');
const { sendNewPasswordAdmin, sendCreateAdminMail, sendDeletedAdminMail } = require('../services/mailer');
const mailer = require('../services/mailer');
const { UserDevice } = require('../models/userDeviceModel');
const { UserCategory } = require('../models/userCategoryModel');

const JWT_SECRET = global.sharedConfig.JWT_SECRET;
const JWT_SECRET_USER = global.sharedConfig.JWT_SECRET_USER;

const generateToken = (user, isAdmin) => {
    const copyuser = JSON.parse(JSON.stringify(user));
    delete copyuser.password; // remove password from token payload
    const _token = jwt.sign({ 
            ...copyuser,
            isAdmin: isAdmin ?? false, // add isAdmin flag to token payload
        }, JWT_SECRET
    );
    return {
        _token
    }
}

const generateUserToken = (user, isAdmin) => {
    const copyuser = JSON.parse(JSON.stringify(user));
    delete copyuser.password; // remove password from token payload
    copyuser.isAdmin = isAdmin ?? false; // add isAdmin flag to user object
    const _token = jwt.sign({ 
            ...copyuser,
        }, JWT_SECRET_USER
    );
    return {
        _token, copyuser
    }
}

const loginUser = async (req, res, next) => {
    const { mail, password } = req.body;
    try {
        // different users can have same phone number under several dialingCodes
        const where = { mail }
        
        let user = await Admin.findOne({ where });
        let isAdmin = true;
        if (!user) {
          isAdmin = false;
            user = await User.findOne({ where, include: ['devices', 'categories'] });
            if(!user) {
              logger.error(`got login user ${mail} which does not exists on DB. `)
              return res.status(401).json({ error: 'Authentication failed' });
            }
        }
        const isMatch = await bcrypt.compare(decryptPassword(password), user.password);
        if(isMatch){
            const {_token, copyuser} = generateUserToken(user, isAdmin)
        
            res.json({
                ...copyuser,
                message: 'Authentication successful', 
                token: _token, 
            });
            logger.info(`login user ${mail} successfuly.`)
        }else{
            logger.error(`got login user ${mail} with wrong password. `)
            return res.status(401).json({ error: 'Authentication failed' });
        }
    } catch (error) {
      logger.error(`error while loginUser. , error was: ` + error);
      res.status(500).json({ error: 'Loggin error' });
    }
};

const loginAdmin = async (req, res, next) => {
    const { mail, password } = req.body;
    try {
        logger.info(`got login admin with mail: ${mail}`)
        const where = { mail }
        const user = await Admin.findOne({ where });
        logger.info(`got login admin with user: ${JSON.stringify(user)}`)
        if (!user) {
            logger.error(`got login admin ${mail} which does not exists on DB. `)
            return res.status(401).json({ error: 'Authentication failed' });
        }
        logger.info(`got login admin ${mail} with pass: ${decryptPassword(password)} while real pass is : ${user.password}`)
        const isMatch = await bcrypt.compare(decryptPassword(password), user.password);
        if(isMatch){
            const {_token} = generateToken(user)

            const userCopy = JSON.parse(JSON.stringify(user));
            delete userCopy.password;
        
            res.json({
                ...userCopy,
                message: 'Authentication successful', 
                token: _token, 
            });
            logger.info(`login admin ${mail} successfuly.`)
        }else{
            logger.error(`got login admin ${mail} with wrong password. `)
            return res.status(401).json({ error: 'Authentication failed' });
        }
    } catch (error) {
      logger.error(`error while loginAdmin. , error was: ${error}`);
      res.status(500).json({ error: 'Loggin error' });
    }
};

const listAdmins = async (req, res) => {
  const token = req.headers['authorization']
  if (!token) {
    logger.error(`tried to verify with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const admins = await Admin.findAll({ limit: 100000 });
    const adminsCopy = JSON.parse(JSON.stringify(admins))
    for (const admin of adminsCopy) {
        delete admin.password
    }
    res.status(200).json({ admins: adminsCopy });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`listAdmins an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`listAdmins an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while listAdmins. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to listAdmins' });
  }
};

const listUsers = async (req, res) => {
  const token = req.headers['authorization']
  if (!token) {
    logger.error(`tried to verify with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const users = await User.findAll({ limit: 100000, include: ['devices', 'categories'] });
    const usersCopy = JSON.parse(JSON.stringify(users))
    for (const user of usersCopy) {
        delete user.password
    }
    res.status(200).json({ users: usersCopy });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`listUsers an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`listUsers an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while listUsers. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to listUsers' });
  }
};

const verifyAdmin = async (req, res) => {
  const token = req.headers['authorization']
  if (!token) {
    logger.error(`tried to verify with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const renewAt = decoded.exp ? Math.max(100,(decoded.exp - (Math.floor(Date.now() / 1000)+30))*1000): null
    const user = await Admin.findOne({ where: {mail: decoded.mail} });
    const userCopy = JSON.parse(JSON.stringify(user));
    delete userCopy.password;
    if (!user) {
        logger.error(`got login admin ${mail} which does not exists on DB. `)
        return res.status(401).json({ error: 'verification failed' });
    }
    res.status(200).json({ user: userCopy , renewAt });
    logger.debug(`token for user ${decoded.mail} still working. valid until : ${renewAt} `);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`verified an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`verified an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while verifyUser. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const changeAdminPassword = async (req, res) => {
  const token = req.headers['authorization']
  const { newPassword } = req.body;
  if (!token) {
    logger.error(`tried to changeAdminPassword with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const renewAt = decoded.exp ? Math.max(100,(decoded.exp - (Math.floor(Date.now() / 1000)+30))*1000): null

    const password = decryptPassword(newPassword)
    const admin = await Admin.findOne({ where: { mail: decoded.mail } });
    if (!admin) {
        return res.status(404).json({ error: 'Admin not found' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    admin.password = hashedPassword;
    admin.should_change_password = false;
    await admin.save();
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`verified an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`verified an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while verifyUser. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const changeUserPassword = async (req, res) => {
  const token = req.headers['authorization']
  const { newPassword, oldPassword } = req.body;
  if (!token) {
    logger.error(`tried to changeUserPassword with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET_USER);

    const password = decryptPassword(newPassword)
    const user = await User.findOne({ where: { mail: decoded.mail } });
    if (!user) {
        return res.status(404).json({ error: 'Admin not found' });
    }
    const isMatch = await bcrypt.compare(decryptPassword(oldPassword), user.password);
    if(!isMatch){
      logger.error(`got changeUserPassword for user ${decoded.mail} with wrong old password. `)
      return res.status(401).json({ error: 'Old password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.should_change_password = false;
    await user.save();
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`verified an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`verified an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while user. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const createNewAdmin = async (req, res) => {
  const token = req.headers['authorization']
  const { first_name, last_name, mail } = req.body;
  if (!token) {
    logger.error(`tried to createNewAdmin with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({ where: { mail } });
    if (admin) {
        return res.status(401).json({ error: 'Admin already exists' });
    }
    const newAdmin = new Admin({
      first_name, last_name, mail, should_change_password: true
    })
    const randomPassword = uuidv4().slice(0, 8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    newAdmin.password = hashedPassword;
    await newAdmin.save();
    await sendCreateAdminMail(newAdmin?.first_name ?? '', randomPassword, mail);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`createNewAdmin an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`createNewAdmin an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while createNewAdmin. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const createNewUser = async (req, res) => {
  const token = req.headers['authorization']
  const { first_name, last_name, mail, active, validUntil, devices, categories } = req.body;
  if (!token) {
    logger.error(`tried to createNewUser with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    //decoded is forcely an admin, as users token use other secret
    let decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ where: { mail } });
    const admin = await Admin.findOne({ where: { mail } });
    if (user || admin) {
        return res.status(401).json({ error: 'User already exists' });
    }
    let valid_until = null;
    if (validUntil && validUntil > 0) {
      const date = new Date();
      date.setTime(date.getTime() + (validUntil * 24 * 60 * 60 * 1000)); // add days to current date if validUntil is provided
      valid_until = date;
    }
    const newUser = new User({
      first_name, last_name, mail, should_change_password: true, active, valid_until, verified: false
    })
    const randomPassword = uuidv4().slice(0, 8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    newUser.password = hashedPassword;
    const savedUser = await newUser.save();
    if (devices && devices.length > 0) {
      for (const device of devices.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))) {
        if (device.id) {
          const uDevice = new UserDevice({
            id_user: savedUser.id,
            id_device: device.id
          })
          await uDevice.save()
        }
      }
    }
    if (categories && categories.length > 0) {
      for (const cat of categories.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))) {
        if (cat.id) {
          const uCat = new UserCategory({
            id_user: savedUser.id,
            id_category: cat.id
          })
          await uCat.save()
        }
      }
    }
    await mailer.sendCreateUserMail(first_name ?? '', randomPassword, mail);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`createNewUser an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`createNewUser an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while createNewUser. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const editUser = async (req, res) => {
  const token = req.headers['authorization']
  const { first_name, last_name, mail, active, validUntil, valid_until, devices, categories } = req.body;
  const oldValidUntil = valid_until ? Math.floor((((new Date(valid_until)).getTime() - (new Date()).getTime()) / (24*60*60*1000)) +1 ) : null
  if (!token) {
    logger.error(`tried to editUser with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    //decoded is forcely an admin, as users token use other secret
    let decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ where: { mail }, include: ['devices', 'categories'] });
    if (!user) {
        return res.status(401).json({ error: 'User does not exist' });
    }
    if(!validUntil){
      user.valid_until = null; // if old validUntil is provided, but not new one, set valid_until to null (unlimited)
    }else if (validUntil !== oldValidUntil) {
      // if validUntil is provided, but different from old one, set valid_until to new value
      const date = new Date();
      date.setTime(date.getTime() + (validUntil * 24 * 60 * 60 * 1000)); // add days to current date if validUntil is provided
      user.valid_until = date;
    }
    user.first_name = first_name;
    user.last_name = last_name;
    user.active = active ?? false; // Default to false if not provided
    
    await user.save();
    if (devices && devices.length > 0 && (user.devices?.map(x => x.id)!== devices.map(x => x.id))) {
      await UserDevice.destroy({ where: { id_user: user.id } });
      for (const device of devices.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))) {
        if (device.id) {
          const uDevice = new UserDevice({
            id_user: user.id,
            id_device: device.id
          })
          await uDevice.save()
        }
      }
    }else{
      // if no devices provided, remove all devices for this user
      await UserDevice.destroy({ where: { id_user: user.id } });
    }
    if (categories && categories.length > 0 && (user.categories?.map(x => x.id)!== categories.map(x => x.id))) {
      await UserCategory.destroy({ where: { id_user: user.id } });
      for (const cat of categories.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))) {
        if (cat.id) {
          const uCat = new UserCategory({
            id_user: user.id,
            id_category: cat.id
          })
          await uCat.save()
        }
      }
    }else{
      // if no categories provided, remove all categories for this user
      await UserCategory.destroy({ where: { id_user: user.id } });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`editUser an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`editUser an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while editUser. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const deleteUser = async (req, res) => {
  const token = req.headers['authorization']
  const { id } = req.body;
  if (!token) {
    logger.error(`tried to deleteUser with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    //decoded is forcely an admin, as users token use other secret
    let decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ where: { id } });
    if (!user) {
        return res.status(401).json({ error: 'User account not found' });
    }
    await UserDevice.destroy({ where: { id_user: user.id } });
    await UserCategory.destroy({ where: { id_user: user.id } });
    await user.destroy();
    logger.warn(`user ${user.mail} has been deleted by admin ${decoded.mail}`)
    await mailer.sendDeleteUserMail(user.first_name ?? '', user.mail);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`createNewUser an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`createNewUser an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while createNewUser. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const deleteAdmin = async (req, res) => {
  const token = req.headers['authorization']
  const { mail } = req.body;
  if (!token) {
    logger.error(`tried to createNewAdmin with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({ where: { mail } });
    if (!admin) {
        return res.status(401).json({ error: 'Admin account not found' });
    }
    else if (admin && admin.mail===decoded.mail) {
        return res.status(401).json({ error: 'Cannot delete your own account, please ask another admin to do so.' });
    }
    const name = admin.first_name
    await admin.destroy()
    await sendDeletedAdminMail(name, mail);
    res.status(200).json({ success: true });
    logger.warn(`admin ${mail} has been deleted by user ${decoded.mail}`)
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`deleteAdmin an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`deleteAdmin an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while deleteAdmin. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const editAdmin = async (req, res) => {
  const token = req.headers['authorization']
  const { first_name, last_name, mail } = req.body;
  if (!token) {
    logger.error(`tried to createNewAdmin with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({ where: { mail } });
    if (!admin) {
        return res.status(401).json({ error: 'Admin account not found' });
    }
    admin.first_name = first_name
    admin.last_name = last_name
    await admin.save()
    res.status(200).json({ success: true });
    logger.info(`admin ${mail} informations has been edited by user ${decoded.mail}`)
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`editAdmin an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`editAdmin an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while editAdmin. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

// does mail exists for user
const doesMailExists = async (req, res, next) => {
    try {
        const { mail } = req.body;
        const admin = await Admin.count({ where: { mail } });
        const user = await User.count({ where: { mail } });
        if(user>0 || admin>0){
            return res.status(401).send('Not Allowed');
        }else{
            res.status(200).json({Allowed: true});
        }
    } catch (error) {
        logger.error('error while doesMailExists, was: ',error);
        res.status(500).send('Not Allowed');
    }
};

const resetAdminPassword = async (req, res, next) => {
    const { mail } = req.body;
    try {
        const randomPassword = uuidv4().slice(0, 8);
        const admin = await Admin.findOne({ where: { mail } });
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        admin.password = hashedPassword;
        await admin.save();
        await sendNewPasswordAdmin(admin?.first_name ?? '', randomPassword, mail);
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        logger.error('error while resetAdminPassword, was: ', error);
        res.status(500).json({ error: 'Error resetting password' });
    }
};

const router = express.Router();

router.post('/login', loginUser)
router.post('/login-admin', loginAdmin)
router.get('/verify-admin', verifyAdmin)
router.post('/reset-admin-password', resetAdminPassword)
router.post('/change-admin-password', changeAdminPassword)

router.post('/exists/user-email', doesMailExists);
router.post('/exists/admin-email', doesMailExists);

router.post('/create/admin', createNewAdmin);
router.post('/edit/admin', editAdmin);
router.post('/delete/admin', deleteAdmin);

router.get('/list-admins', listAdmins)
router.get('/list-users', listUsers)

router.post('/create/user', createNewUser);
router.post('/edit/user', editUser);
router.post('/delete/user', deleteUser);
router.post('/change-user-password', changeUserPassword)

module.exports = router;