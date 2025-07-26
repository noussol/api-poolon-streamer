const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { sleep } = require('./tools');
const axios = require('axios');
const logger = require('./logger');

const mailServer = global.sharedConfig.mail.server
const username = global.sharedConfig.mail.users.contact.username
const fromNoReplay = `"PoolOn - Contact" <${username}>`
const mailResetAdminPassword = global.sharedConfig.templateMail.resetAdminPassword
const mailCreateAdmin = global.sharedConfig.templateMail.mailCreateAdmin
const mailDeleteAdmin = global.sharedConfig.templateMail.deleteAdmin

const mailCreateUser = global.sharedConfig.templateMail.mailCreateUser
const mailDeleteUser = global.sharedConfig.templateMail.deleteUser
const mailResetUserPassword = global.sharedConfig.templateMail.resetUserPassword



const transporterNoreplay = nodemailer.createTransport({
  host: mailServer,
  port: global.sharedConfig.mail.port,
  secure: true, // true for 465, false for other ports
  auth: {
      user: `${global.sharedConfig.mail.users.contact.username}`,
      pass: global.sharedConfig.mail.users.contact.password
  },
  tls: {
      ciphers: 'SSLv3'
  }
});

exports.sendNoReplay = (mail, subject, text, html) => {
  let mailOptions = {
    from: fromNoReplay, // sender address
    to: mail, // list of receivers
    subject: subject, // Subject line
    text, // plain text body
    html // html body
  }
  return new Promise((resolve, reject) => {
    transporterNoreplay.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error)
        return console.log(error);
      }
      resolve({ok: true})
  });
  })
}

exports.sendNewPasswordAdmin = async (name, password, mail) => {
    try {
        const template = fs.readFileSync(mailResetAdminPassword, 'utf8');
        const mailHtml = template.replace(/{{name}}/g, name).replace(/{{new_password}}/g, password)
        await this.sendNoReplay(mail, `[Poolon manager - new password for poolon manager backoffice`, `Hi ${name}, new password for your account has been set: ${password}`, mailHtml)
    } catch (error) {
        logger.error(`Error while sending new password to admin ${name} (${mail}), error was: `, error);
        return;
    }
}

exports.sendCreateAdminMail = async (name, password, mail) => {
    try {
        const template = fs.readFileSync(mailCreateAdmin, 'utf8');
        const mailHtml = template.replace(/{{name}}/g, name).replace(/{{password}}/g, password)
        await this.sendNoReplay(mail, `[Poolon manager - admin account created`, `Hi ${name}, new password for your account as admin has been set: ${password}`, mailHtml)
    } catch (error) {
        logger.error(`Error while sending new password to admin ${name} (${mail}), error was: `, error);
        return;
    }
}

exports.sendCreateUserMail = async (name, password, mail) => {
    try {
        const template = fs.readFileSync(mailCreateUser, 'utf8');
        const mailHtml = template.replace(/{{name}}/g, name).replace(/{{password}}/g, password)
        await this.sendNoReplay(mail, `[Poolon streamer - account created`, `Hi ${name}, your account has been created with the following password : ${password}`, mailHtml)
    } catch (error) {
        logger.error(`Error while sending new password to user ${name} (${mail}), error was: `, error);
        return;
    }
}

exports.sendNewPasswordUserMail = async (name, password, mail) => {
    try {
        const template = fs.readFileSync(mailResetUserPassword, 'utf8');
        const mailHtml = template.replace(/{{name}}/g, name).replace(/{{password}}/g, password)
        await this.sendNoReplay(mail, `[Poolon streamer - new password`, `Hi ${name}, your new password is : ${password}`, mailHtml)
    } catch (error) {
        logger.error(`Error while sending new password to user ${name} (${mail}), error was: `, error);
        return;
    }
}

exports.sendDeleteUserMail = async (name, mail) => {
    try {
        const template = fs.readFileSync(mailDeleteUser, 'utf8');
        const mailHtml = template.replace(/{{name}}/g, name)
        await this.sendNoReplay(mail, `[Poolon streamer - account Deleted`, `Hi ${name}, your account has been deleted`, mailHtml)
    } catch (error) {
        logger.error(`Error while sendDeleteUserMail to user ${name} (${mail}), error was: `, error);
        return;
    }
}

exports.sendDeletedAdminMail = async (name, mail) => {
    try {
        const template = fs.readFileSync(mailDeleteAdmin, 'utf8');
        const mailHtml = template.replace(/{{name}}/g, name)
        await this.sendNoReplay(mail, `[Poolon manager - admin account deleted`, `Hi ${name}, Your admin account has been deleted.`, mailHtml)
    } catch (error) {
        logger.error(`Error while sendDeletedAdminMail ${name} (${mail}), error was: `, error);
        return;
    }
}