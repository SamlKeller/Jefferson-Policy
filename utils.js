import { } from "dotenv/config";

import express from "express";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import path from "path";
import passport from "passport";
import flash from 'express-flash';
import _ from 'lodash';

import User from './schemas/userSchema.js';

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
app.use(express.static(path.join(_dirname, "../static")));


class Utils {

    static escapeHtml(text) {

        if (text == null) return '';
        
        const str = String(text);
        
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    
    }

    static ensureNotLogin(req, res, next) {
        if (req.isAuthenticated()) {
            return res.redirect('/home');
        }
        next();
    }

    static ensureLogin(req, res, next) {
        if (!req.isAuthenticated()) {
            return res.redirect('/login');
        }
        next();
    }

    static ensureLogin(req, res, next) {
        
        if (req.isAuthenticated()) {
        
            if (req.user.role.officer) {
                next();
            }

            return res.redirect('/');

        }

        return res.redirect('/');

    }

    static async getNameUsername (id) {
        //not sure why this needs to be two steps
        const usr = await User.findById(id);
        return [usr.name, usr.username];
    }

    static async getPublicProfile (id) {

        const user = await User.findById(id);
        
        return {
            name: user.name,
            username: user.username,
            profilePic: user.profilePic,
            creds: user.creds
        }

    }

}
  
export default Utils;