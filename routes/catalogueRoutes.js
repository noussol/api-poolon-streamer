const express = require('express');
const { decryptPassword } = require('../services/helpers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../services/logger');
const { Op, where } = require('sequelize');
const { User } = require('../models/userModel');
const { Admin } = require('../models/adminModel');
const { sendCreateAdminMail, sendDeletedAdminMail } = require('../services/mailer');
const fs = require('fs').promises;
const path = require('path');
const { Category } = require('../models/categoryModel');
const { Video } = require('../models/videosModel');
const { humanFileSize, genrateThumbnails } = require('../services/tools');
const uploader = require('../services/uploader');

const JWT_SECRET = global.sharedConfig.JWT_SECRET;
const JWT_SECRET_USER = global.sharedConfig.JWT_SECRET_USER;

const serverApi = global.sharedConfig.serverApi
const videoPath = global.sharedConfig.videoPath
const thumbnailsPath = global.sharedConfig.thumbnailsPath

const fetchVideosAndCategoriesFs = async () => {
  try {
    logger.debug(`will start fetchVideosAndCategoriesFs`)

    const fsCategories = await fs.readdir(videoPath, { withFileTypes: true });
    for (const category of fsCategories) {
      if (category.isDirectory()) {
        const categoryName = category.name;
        const cat = await Category.findOrCreate({
          where: { title: categoryName }
        })
        const categoryPath = path.join(videoPath, category.name);
        const categoryVideos = (await fs.readdir(categoryPath, { withFileTypes: true })).filter( file => file.isFile());
        logger.debug(`will fetch videos for category ${categoryName} with ${categoryVideos.length} videos`)
        for (const video of categoryVideos) {
          const src = `${serverApi}/catalogue/get-video/${categoryName}/${video.name}`;
          const img = `${serverApi}/catalogue/get-thumbnail/${categoryName}/${video.name}.jpg`;
          const foundVideo = await Video.count({where: { src }})
          if( foundVideo <= 0) {
            const videoStat = await fs.stat(path.join(categoryPath, video.name));
            await Video.create({ title: video.name, id_category: cat[0].id, src, img, description: '', size: humanFileSize(videoStat.size) })
          }
        }
      }
    }
    const fsExistingCategories = fsCategories.filter(cat => cat.isDirectory()).map(cat => cat.name);
    const allDbCategories = (await Category.findAll({limit: 100000})).map(cat => cat.title);
    const toCreateFsCategories = (allDbCategories).filter(cat => !fsExistingCategories.includes(cat));

    for (const category of toCreateFsCategories) {
      logger.info(`Creating path category ${category} existing in database`)
      const categoryPath = path.join(videoPath, category);
      await fs.mkdir(categoryPath, { recursive: true });
    }
    // TODO: now should cleanUp the thumbnails too

  } catch (error) {
    logger.error(`Error while fetchVideosAndCategoriesFs, error was ${error}`)
    console.error(`Error while fetchVideosAndCategoriesFs, error was`, error)
  }
}

// fetchVideosAndCategoriesFs()

const getAllVideos = async (req, res) => {
  try {
    const categories = await Category.findAll({ limit: 100000, include: [ 'videos' ] });

    res.status(200).json(categories);
  } catch (error) {
    logger.error(`error while listAdmins. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to getAllVideos' });
  }
};

const getAllVideosToUser = async (req, res) => {
  try {
    const token = req.headers['authorization'];
    if (!token) {
      logger.error(`tried to getAllVideosToUser with no token. `)
      return res.status(401).json({ error: 'Not allowed' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET_USER);
      logger.debug(`getAllVideosToUser decoded user: ${JSON.stringify(decoded)}`);
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn(`getAllVideosToUser an expired token. `);
        return res.status(401).send('Not Allowed');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn(`getAllVideosToUser an incorrect token. `);
        return res.status(401).send('Not Allowed');
      }
      logger.error(`error while getAllVideosToUser. error was: ${error}`);
      return res.status(500).json({ error: 'Failed to authenticate token' });
    }
    let categories;
    if(decoded.isAdmin || !decoded.categories || decoded.categories.length <= 0){
      categories = await Category.findAll({ limit: 100000, include: [ 'videos' ] });
      return getAllVideos(req, res);
    }else{
      categories = await Category.findAll({ where: {id: {[Op.in]: decoded.categories.map(x=>x.id)}}, limit: 100000, include: [ 'videos' ] })
      return res.status(200).json(categories);
    };

    
  } catch (error) {
    logger.error(`error while listAdmins. . error was: ${error}`);
    return res.status(500).json({ error: 'Failed to getAllVideos' });
  }
};


const getVideoThumbnail = async (req, res) => {
  const { cat, name } = req.params;
  const thumbnailPath = path.join(thumbnailsPath, cat, `${name}`);
  try {
    await fs.access(thumbnailPath);
    res.sendFile(thumbnailPath);
  } catch (error) {
    logger.error(`error while getVideoThumbnail for ${cat}/${name}. error was: ${error}`);
    return res.status(404).json({ error: 'Thumbnail not found' });
  }
};

const getVideo = async (req, res) => {
  const { cat, name } = req.params;
  const videoPathFull = path.join(videoPath, cat, name);
  try {
    await fs.access(videoPathFull);
    res.sendFile(videoPathFull);
  } catch (error) {
    logger.error(`error while getVideo for ${cat}/${name}. error was: ${error}`);
    return res.status(404).json({ error: 'Video not found' });
  }
};

const addCategory = async (req, res) => {
  const token = req.headers['authorization']
  let { title } = req.body;
  if (!token) {
    logger.error(`tried to addCategory with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    title = title.trim().replaceAll("/","").replaceAll("\\","").replaceAll("..","");
    let decoded = jwt.verify(token, JWT_SECRET);
    const category = await Category.findOne({ where: { title } });
    if (category) {
        return res.status(401).json({ error: 'Category already exists' });
    }
    await fs.mkdir(path.join(videoPath, title), { recursive: true });
    await fs.mkdir(path.join(thumbnailsPath, title), { recursive: true });
    const newCategory = await Category.create({ title });
    logger.info(`Category ${title} has been created by user ${decoded.mail}`)
    res.status(200).json({ success: true, category: newCategory });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`addCategory an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`addCategory an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while addCategory. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const editCategory = async (req, res) => {
  const token = req.headers['authorization']
  const { cat } = req.body;
  if (!token) {
    logger.error(`tried to editCategory with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const category = await Category.findOne({ where: { id: cat.id } });
    if (!category) {
        return res.status(401).json({ error: 'Category does not exists' });
    }
    const newTitle = cat.title.trim().replaceAll("/","").replaceAll("\\","").replaceAll("..","");
    await fs.rename(path.join(videoPath, category.title), path.join(videoPath, newTitle))
    await fs.rename(path.join(thumbnailsPath, category.title), path.join(thumbnailsPath, newTitle))
    const oldTitle = category.title;
    category.title = newTitle;
    category.icon = cat.icon;
    await category.save();
    // Update all videos in this category to the new title
    const allVideos= await Video.findAll({ where: { id_category: category.id } });
    for (const video of allVideos) {
      video.src = video.src.replace(`/${oldTitle}/`, `/${newTitle}/`);
      video.img = video.img.replace(`/${oldTitle}/`, `/${newTitle}/`);
      await video.save();
    }
    logger.info(`Category ${cat.title} has been edited by user ${decoded.mail}`)
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`editCategory an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`editCategory an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while editCategory. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const editVideo = async (req, res) => {
  const token = req.headers['authorization']
  const { vid } = req.body;
  if (!token) {
    logger.error(`tried to editVideo with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const video = await Video.findOne({ where: { id: vid.id } });
    if (!video) {
        return res.status(401).json({ error: 'Video does not exists' });
    }
    video.title = vid.title.trim();
    video.description = vid.description;
    await video.save();
    logger.info(`Video ${video.id} has been edited by user ${decoded.mail}`)
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`editVideo an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`editVideo an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while editVideo. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const deleteCategory = async (req, res) => {
  const token = req.headers['authorization']
  const { title } = req.body;
  if (!token) {
    logger.error(`tried to deleteCategory with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const category = await Category.findOne({ where: { title } });
    if (!category) {
        return res.status(401).json({ error: 'Category doesnot exists' });
    }
    await fs.rmdir(path.join(videoPath, title), { recursive: true });
    await fs.rmdir(path.join(thumbnailsPath, title), { recursive: true });
    await Video.destroy({ where: { id_category: category.id } });
    await category.destroy();
    logger.info(`Category ${title} has been deleted by user ${decoded.mail}`)
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`deleteCategory an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`deleteCategory an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while deleteCategory. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const deleteVideo = async (req, res) => {
  const token = req.headers['authorization']
  const { id, category } = req.body;
  if (!token) {
    logger.error(`tried to deleteVideo with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    const video = await Video.findOne({ where: { id } });
    if (!video) {
        return res.status(401).json({ error: 'Video does not exists' });
    }
    const videoPathFull = path.join(videoPath, category, video.src.split('/').pop());
    const videoPosterPathFull = path.join(thumbnailsPath, category, video.img.split('/').pop());
    await fs.rm(videoPathFull, { recursive: true });
    await fs.rm(videoPosterPathFull, { recursive: true });
    await Video.destroy({ where: { id } });
    logger.info(`Video ${id} has been deleted by user ${decoded.mail}`)
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`deleteVideo an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`deleteVideo an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while deleteVideo. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const uploadNewVideo = async (req, res) => {
  const token = req.headers['authorization']
  const { category } = req.params;
  if (!token) {
    logger.error(`tried to uploadNewVideo with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    if (!req.file) {
      logger.error(`tried to uploadNewVideo with no file. `)
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const randomName = `${uuidv4()}${path.extname(req.file.originalname)}`;
    const videoPathFull = path.join(videoPath, category, randomName);
    await fs.mkdir(path.join(videoPath, category), { recursive: true });
    await fs.writeFile(videoPathFull, req.file.buffer);
    
    await fs.mkdir(path.join(thumbnailsPath, category), { recursive: true });
    // Generate thumbnails for the uploaded video
    await genrateThumbnails(videoPathFull, randomName, path.join(thumbnailsPath, category));

    const videoStat = await fs.stat(videoPathFull);
    const newVideo = await Video.create({
      title: req.file.originalname,
      id_category: (await Category.findOrCreate({ where: { title: category } }))[0].id,
      src: `${serverApi}/catalogue/get-video/${category}/${randomName}`,
      img: `${serverApi}/catalogue/get-thumbnail/${category}/${randomName}.jpg`,
      description: '',
      size: humanFileSize(videoStat.size)
    });

    logger.info(`Video ${newVideo.title} has been uploaded by user ${decoded.mail}`)
    res.status(200).json({ success: true, video: newVideo });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`uploadNewVideo an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`uploadNewVideo an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while uploadNewVideo. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const changeVideoPoster = async (req, res) => {
  const token = req.headers['authorization']
  logger.debug(`headers are: ${JSON.stringify(req.headers)}`)
  const { name, category } = req.params;
  if (!token) {
    logger.error(`tried to changeVideoPoster with no token. `)
    return res.status(401).json({ error: 'Not allowed' });
  }
  try {
    let decoded = jwt.verify(token, JWT_SECRET);
    if (!req.file) {
      logger.error(`tried to changeVideoPoster with no file. `)
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const thumbnailFullPath = path.join(thumbnailsPath, category, name);
    await fs.mkdir(path.join(thumbnailsPath, category), { recursive: true });
    await fs.writeFile(thumbnailFullPath, req.file.buffer);

    logger.info(`Poster ${name} in category ${category} has been changed by user ${decoded.mail}`)
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`changeVideoPoster an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`changeVideoPoster an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while changeVideoPoster. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const changeVideoPosterBis = async (req, res) => {
  const { name, category } = req.params;
  try {
    if (!req.file) {
      logger.error(`tried to changeVideoPoster with no file. `)
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const thumbnailFullPath = path.join(thumbnailsPath, category, name);
    await fs.mkdir(path.join(thumbnailsPath, category), { recursive: true });
    await fs.writeFile(thumbnailFullPath, req.file.buffer);

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`changeVideoPoster an expired token. `);
      return res.status(401).send('Not Allowed')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`changeVideoPoster an incorrect token. `);
      return res.status(401).send('Not Allowed')
    }
    logger.error(`error while changeVideoPoster. error was: ${error}`);
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

const router = express.Router();

router.get('/user/all', getAllVideosToUser)
router.get('/all', getAllVideos)
router.get('/get-thumbnail/:cat/:name', getVideoThumbnail)
router.get('/get-video/:cat/:name', getVideo)

router.post('/add-category', addCategory)
router.post('/edit-category', editCategory)
router.post('/delete-category', deleteCategory)

router.post('/upload-new-video/:category', uploader.uploadFile, uploadNewVideo)
router.post('/change-video-poster/:name/:category', uploader.uploadFile, changeVideoPoster)
router.post('/change-video-poster-bis/:name/:category', uploader.uploadFile, changeVideoPosterBis)

router.post('/edit-video', editVideo)
router.post('/delete-video', deleteVideo)


module.exports = {router, fetchVideosAndCategoriesFs};