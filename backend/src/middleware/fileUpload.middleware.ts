import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';

const fileUploadMiddleware = fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
    useTempFiles: true,
    tempFileDir: path.join(__dirname, '../../uploads/temp'),
    createParentPath: true,
    abortOnLimit: true,
    responseOnLimit: 'File size limit has been reached',
    debug: process.env.NODE_ENV === 'development',
});

export default fileUploadMiddleware;

