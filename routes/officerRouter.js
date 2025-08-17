import { } from "dotenv/config";

import express from "express";
import _ from 'lodash';

import Utils from '../utils.js';

import User from '../schemas/userSchema.js';

const router = express.Router();

router.use(
    express.json({
        verify: (req, res, buffer) => (req['rawBody'] = buffer),
    })
);

router.get('/', async (req, res) => {

    console.log("Got rq");

    res.render('officers');

});


export default router;