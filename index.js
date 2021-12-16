'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const ejs = require('ejs');
const nodeHtmlToImage = require('node-html-to-image');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

function getHTMLFromEjs(ejsData) {
  let filePathName = path.resolve(__dirname, ejsData.ejsTemplateName);
  const htmlString = fs.readFileSync(filePathName).toString();
  const template = ejs.compile(htmlString);
  return template(ejsData);
}

function getGCFilePath(certificateInfo) {
  const { orgCode, courseId, studentId } = certificateInfo;
  const fileFormat = '.png';
  return `${orgCode}/certificate_${studentId}_${courseId}${fileFormat}`;
}

async function generateImageFileFromHTML(htmlData) {
  console.log('Started to generate certificate');
  return await nodeHtmlToImage({
    output: './a_image.png',
    html: htmlData,
  });
}

// generateCertificate generates a certificate in image format
exports.generateCertificate = async (req, res) => {
  try {
    let reqData = req.body;
    const err = validateRequest(reqData);
    if (err) {
      return res.status(400).send(err);
    }
    reqData = addDefaultValuesForRequestBodyData(reqData);

    // convert ejs into html
    const htmlFile = getHTMLFromEjs(reqData);
    // convert html into image file
    // const imageBuffer = await generateImageFileFromHTML(htmlFile)
    await generateImageFileFromHTML(htmlFile);
    // return res.send(imageBuffer)
    return res.send('success');
  } catch (err) {
    res.status(500).send(err.message);
  }
};

async function uploadFileToGoogleCloud(fileBuffer, uploadRequiredData) {
  const filePath = getGCFilePath(uploadRequiredData);

  return new Promise((resolve, reject) => {
    const stream = storage.bucket(process.env.BUCKET).file(filePath).createWriteStream({
      resumable: false,
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=30000' },
    });
    stream.on('error', err => {
      reject(err);
    });
    stream.on('finish', async () => {
      const certificateUrl = `https://storage.googleapis.com/${process.env.BUCKET}/${filePath}`;
      resolve(certificateUrl);
    });

    // Converting file buffer into read stream
    const readable = new Readable();
    readable._read = () => {
    };
    readable.push(fileBuffer);
    readable.push(null);

    readable.pipe(stream);
  });
}

function addDefaultValuesForRequestBodyData(reqData) {
  return {
    ejsTemplateName: reqData.ejsTemplateName || '',
    name: reqData.name || '',
    date: reqData.date || '',
    courseName: reqData.courseName || '',
    title: reqData.title || '',
    subtitle: reqData.subtitle || '',
    orgLogo: reqData.orgLogo || '',
    orgCode: reqData.orgCode || 0,
    orgName: reqData.orgName || '',
    signature: reqData.signature || '',
    courseId: reqData.courseId || 0,
    studentId: reqData.studentId || 0,
  };
}

function getGcUploadRequiredData(reqData) {
  return {
    orgCode: reqData.orgCode,
    courseId: reqData.courseId,
    studentId: reqData.studentId,
  };
}

const validateRequest = reqData => {
  let errMessage = '';
  if (!reqData.ejsTemplateName) {
    errMessage = 'ejsTemplateName is required';
  }
  if (!reqData.name) {
    errMessage = 'name is required';
  }
  if (!reqData.date) {
    errMessage = 'date is required';
  }
  if (!reqData.courseName) {
    errMessage = 'courseName is required';
  }
  if (!reqData.subtitle) {
    errMessage = 'subtitle is required';
  }
  if (!reqData.orgCode) {
    errMessage = 'orgCode is required';
  }
  if (!reqData.orgLogo) {
    errMessage = 'orgLogo is required';
  }
  if (!reqData.signature) {
    errMessage = 'signature is required';
  }
  if (!reqData.courseId) {
    errMessage = 'courseId is required';
  }
  if (!reqData.studentId) {
    errMessage = 'studentId is required';
  }

  // check for invalid values
  if (reqData.orgCode && reqData.orgCode < 0) {
    errMessage = 'invalid orgCode';
  }
  if (reqData.courseId && reqData.courseId < 0) {
    errMessage = 'invalid courseId';
  }
  if (reqData.studentId && reqData.studentId < 0) {
    errMessage = 'invalid studentId';
  }

  return errMessage
    ? { status: 'failed', data: {}, message: errMessage }
    : null;
};

async function uploadFileToGoogleCloud(fileBuffer, uploadRequiredData) {
  const filePath = getGCFilePath(uploadRequiredData);

  return new Promise((resolve, reject) => {
    const writeStream = storage.bucket(process.env.BUCKET).file(filePath).createWriteStream({
      resumable: false,
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=30000' },
    });

    // Converting file buffer into read stream
    const readable = new Readable();
    readable._read = () => {
    };
    readable.push(fileBuffer);
    readable.push(null);

    readable.pipe(writeStream)
      .on('error', err => {
        reject(err);
      })
      .on('finish', async () => {
        const certificateUrl = `https://storage.googleapis.com/${process.env.BUCKET}/${filePath}`;
        resolve(certificateUrl);
      });
  });
}
