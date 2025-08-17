import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import axios from 'axios';

const ION_BASE_URL = 'https://ion.tjhsst.edu';

console.log('[Ion Strategy] Initializing with:', {
    clientID: process.env.OAUTHCLIENTID ? 'Set' : 'Missing',
    clientSecret: process.env.OAUTHCLIENTSECRET ? 'Set' : 'Missing',
    callbackURL: process.env.ION_REDIRECT_URI
});

const IonStrategy = new OAuth2Strategy({
    authorizationURL: `${ION_BASE_URL}/oauth/authorize`,
    tokenURL: `${ION_BASE_URL}/oauth/token/`,
    clientID: process.env.OAUTHCLIENTID,
    clientSecret: process.env.OAUTHCLIENTSECRET,
    callbackURL: process.env.ION_REDIRECT_URI,
    scope: ['read'],
    state: true
}, async (accessToken, refreshToken, params, profile, done) => {
    console.log('[Ion Strategy] Got tokens, fetching profile...');
    
    try {
        const response = await axios.get(`${ION_BASE_URL}/api/profile`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const ionProfile = response.data;
        console.log('[Ion Strategy] Profile received:', ionProfile.ion_username);
        
        const user = {
            username: ionProfile.ion_username,
            email: ionProfile.tj_email || ionProfile.emails?.[0] || `${ionProfile.ion_username}@tjhsst.edu`,
            firstName: ionProfile.first_name,
            lastName: ionProfile.last_name,
            fullName: ionProfile.full_name,
            displayName: ionProfile.display_name || ionProfile.full_name,
            graduationYear: ionProfile.graduation_year,
            grade: ionProfile.grade?.number || ionProfile.grade,
            accessToken: accessToken,
            refreshToken: refreshToken
        };
        
        console.log('[Ion Strategy] Returning user object');
        return done(null, user);
    } catch (error) {
        console.error('[Ion Strategy] Error fetching profile:', error.message);
        if (error.response) {
            console.error('[Ion Strategy] Response error:', error.response.status, error.response.data);
        }
        return done(error, null);
    }
});

IonStrategy.name = 'ion';

export default IonStrategy;